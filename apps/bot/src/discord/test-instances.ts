import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Client,
  type Message,
  type MessageComponentInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';
import { type SendTestInstancePayload } from '@constancia/contracts';
import { botBackend, type BotTestResult } from '../backend/bot-backend.js';
import type { BotComponentHandler, BotModalHandler } from './command-types.js';
import { buildMessageReportButton } from './message-reports.js';

const TEST_INSTANCE_SUBMIT_PREFIX = 'test-instance:submit:';
const TEST_INSTANCE_ROLL_PREFIX = 'test-instance:roll:';
const TEST_INSTANCE_MODAL_PREFIX = 'test-instance:modal:';
const TEST_INSTANCE_SCORE_INPUT_ID = 'player-score';
const TEST_INSTANCE_FOOTER = 'Enter your final result, or let the bot roll for you.';
const HINT_SUFFIX = 'Consult your character sheet; enter your final result.';
// showModal must be the first response within Discord's 3-second window; leave headroom.
const HINT_FETCH_BUDGET_MS = 1500;

const hintCache = new Map<string, string | null>();

export function decodeTestInstanceId(customId: string, prefix: string): string | null {
  if (!customId.startsWith(prefix)) {
    return null;
  }

  const instanceId = customId.slice(prefix.length).trim();
  return instanceId.length > 0 && !instanceId.includes(':') ? instanceId : null;
}

export function testInstanceFooter(submittedCount?: number): string {
  return submittedCount === undefined
    ? TEST_INSTANCE_FOOTER
    : `${submittedCount} submitted · ${TEST_INSTANCE_FOOTER}`;
}

/** The modal's hint line: the Game System's modifier hint when known, otherwise the plain instruction. */
export function modalHintText(hint: string | null | undefined): string {
  return hint ? `${hint} ${HINT_SUFFIX}` : HINT_SUFFIX;
}

/** Returns the cached hint, or waits briefly for the backend and caches it; undefined means "not in time". */
export async function getHintWithinBudget(
  instanceId: string,
  discordUserId: string,
  budgetMs = HINT_FETCH_BUDGET_MS,
): Promise<string | null | undefined> {
  const key = `${instanceId}:${discordUserId}`;
  if (hintCache.has(key)) return hintCache.get(key);

  const fetched = botBackend
    .getTestHint(instanceId, discordUserId)
    .then((hint) => {
      hintCache.set(key, hint);
      return hint;
    })
    .catch((error: unknown) => {
      console.warn('[test-instance] Hint lookup failed:', error);
      return undefined;
    });
  const timeout = new Promise<undefined>((resolve) => {
    setTimeout(() => resolve(undefined), budgetMs);
  });
  return Promise.race([fetched, timeout]);
}

export function clearHintCache(): void {
  hintCache.clear();
}

function buildTestInstanceEmbed(payload: SendTestInstancePayload): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(payload.title)
    .setColor(0x58a6ff)
    .setFooter({ text: testInstanceFooter() });

  const description = [payload.description, payload.rollModifierLine].filter(Boolean).join('\n\n');
  if (description) {
    embed.setDescription(description);
  }

  if (payload.imageUrl) {
    embed.setImage(payload.imageUrl);
  }

  return embed;
}

function buildTestInstanceButtons(
  payload: SendTestInstancePayload,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${TEST_INSTANCE_SUBMIT_PREFIX}${payload.instanceId}`)
      .setLabel('Enter result')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${TEST_INSTANCE_ROLL_PREFIX}${payload.instanceId}`)
      .setLabel('🎲 Roll for me')
      .setStyle(ButtonStyle.Secondary),
    buildMessageReportButton(payload.eventId),
  );
}

function buildScoreModal(instanceId: string, hint: string | null | undefined): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${TEST_INSTANCE_MODAL_PREFIX}${instanceId}`)
    .setTitle('Enter your result')
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(modalHintText(hint)))
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Final result')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(TEST_INSTANCE_SCORE_INPUT_ID)
            .setPlaceholder('For example 4')
            .setRequired(true)
            .setStyle(TextInputStyle.Short),
        ),
    );
}

function parsePlayerScore(value: string): number | null {
  const normalized = value.trim();
  if (!/^-?\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function deliverTestInstance(
  client: Client,
  payload: SendTestInstancePayload,
  deliveryId?: string,
): Promise<{ delivered: number; skipped: number }> {
  const channel = await client.channels.fetch(payload.discordChannelId);
  if (!channel || !channel.isSendable() || channel.isDMBased()) {
    console.warn('[bot-http] Unable to deliver test instance:', {
      discordChannelId: payload.discordChannelId,
    });
    return { delivered: 0, skipped: 1 };
  }

  await channel.send({
    embeds: [buildTestInstanceEmbed(payload)],
    components: [buildTestInstanceButtons(payload)],
    ...(deliveryId ? { nonce: deliveryId.slice(0, 25), enforceNonce: true } : {}),
  });

  return { delivered: 1, skipped: 0 };
}

async function refreshCardCount(card: Message | null, submittedCount: number): Promise<void> {
  const [embed] = card?.embeds ?? [];
  if (!card || !embed) return;

  // The result is already saved; a failed cosmetic count refresh must not report an error.
  await card
    .edit({
      embeds: [EmbedBuilder.from(embed).setFooter({ text: testInstanceFooter(submittedCount) })],
    })
    .catch((error: unknown) => console.warn('[test-instance] Card count refresh failed:', error));
}

function summaryLines(result: BotTestResult): string[] {
  const lines = [...(result.roll?.breakdown ?? []), 'Result submitted.'];
  const deliveryStatuses = result.deliveries.map((delivery) => delivery.status);
  if (deliveryStatuses.some((status) => status !== 'delivered')) {
    lines.push('Follow-up delivery is queued and will retry.');
  } else if (deliveryStatuses.length > 0) {
    lines.push('Follow-up delivered.');
  }
  return lines;
}

async function submitAndReply(
  interaction: MessageComponentInteraction | ModalSubmitInteraction,
  card: Message | null,
  instanceId: string,
  score: { playerScore: number } | { rollForMe: true },
): Promise<void> {
  if (!interaction.channelId) {
    await interaction.reply({
      content: 'This test can only be submitted from a server channel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await botBackend.submitTestResult({
    instanceId,
    discordUserId: interaction.user.id,
    discordChannelId: interaction.channelId,
    idempotencyKey: interaction.id,
    ...score,
  });

  await refreshCardCount(card, result.submittedCount);
  await interaction.editReply(summaryLines(result).join('\n'));
}

export const testInstanceComponentHandler: BotComponentHandler = {
  customIdPrefix: TEST_INSTANCE_SUBMIT_PREFIX,
  execute: async (interaction) => {
    const instanceId = decodeTestInstanceId(interaction.customId, TEST_INSTANCE_SUBMIT_PREFIX);
    if (!instanceId) {
      await interaction.reply({
        content: 'This test card is missing its test context.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const hint = await getHintWithinBudget(instanceId, interaction.user.id);
    await interaction.showModal(buildScoreModal(instanceId, hint));
  },
};

export const testInstanceRollHandler: BotComponentHandler = {
  customIdPrefix: TEST_INSTANCE_ROLL_PREFIX,
  execute: async (interaction) => {
    const instanceId = decodeTestInstanceId(interaction.customId, TEST_INSTANCE_ROLL_PREFIX);
    if (!instanceId) {
      await interaction.reply({
        content: 'This test card is missing its test context.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await submitAndReply(interaction, interaction.message, instanceId, { rollForMe: true });
  },
};

export const testInstanceModalHandler: BotModalHandler = {
  customIdPrefix: TEST_INSTANCE_MODAL_PREFIX,
  execute: async (interaction) => {
    const instanceId = decodeTestInstanceId(interaction.customId, TEST_INSTANCE_MODAL_PREFIX);
    if (!instanceId) {
      await interaction.reply({
        content: 'This test submission is missing its test context.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const playerScore = parsePlayerScore(
      interaction.fields.getTextInputValue(TEST_INSTANCE_SCORE_INPUT_ID),
    );
    if (playerScore === null) {
      await interaction.reply({
        content: 'Enter a whole number for the final result.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const card = interaction.isFromMessage() ? interaction.message : null;
    await submitAndReply(interaction, card, instanceId, { playerScore });
  },
};
