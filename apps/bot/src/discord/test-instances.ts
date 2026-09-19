import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Client,
} from 'discord.js';
import { type SendTestInstancePayload } from '@constancia/contracts';
import { botBackend } from '../backend/bot-backend.js';
import type { BotComponentHandler, BotModalHandler } from './command-types.js';
import { buildMessageReportButton } from './message-reports.js';

const TEST_INSTANCE_SUBMIT_PREFIX = 'test-instance:submit:';
const TEST_INSTANCE_MODAL_PREFIX = 'test-instance:modal:';
const TEST_INSTANCE_SCORE_INPUT_ID = 'player-score';
const TEST_INSTANCE_FOOTER = 'Submit your actual result. The bot does not roll for you.';

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

function buildTestInstanceEmbed(payload: SendTestInstancePayload): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(payload.title)
    .setColor(0x58a6ff)
    .setFooter({ text: testInstanceFooter() });

  if (payload.description) {
    embed.setDescription(payload.description);
  }

  if (payload.imageUrl) {
    embed.setImage(payload.imageUrl);
  }

  return embed;
}

function buildTestInstanceButton(
  payload: SendTestInstancePayload,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${TEST_INSTANCE_SUBMIT_PREFIX}${payload.instanceId}`)
      .setLabel('Submit Result')
      .setStyle(ButtonStyle.Primary),
    buildMessageReportButton(payload.eventId),
  );
}

function buildScoreModal(instanceId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${TEST_INSTANCE_MODAL_PREFIX}${instanceId}`)
    .setTitle('Submit Test Result')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(TEST_INSTANCE_SCORE_INPUT_ID)
          .setLabel('Final score')
          .setPlaceholder('Enter the resolved result, for example 4')
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
    components: [buildTestInstanceButton(payload)],
    ...(deliveryId ? { nonce: deliveryId.slice(0, 25), enforceNonce: true } : {}),
  });

  return { delivered: 1, skipped: 0 };
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

    await interaction.showModal(buildScoreModal(instanceId));
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
        content: 'Enter a whole number for the final score.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

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
      playerScore,
      idempotencyKey: interaction.id,
    });

    if (interaction.isFromMessage()) {
      const [card] = interaction.message.embeds;
      if (card) {
        // The result is already saved; a failed cosmetic count refresh must not report an error.
        await interaction.message
          .edit({
            embeds: [
              EmbedBuilder.from(card).setFooter({
                text: testInstanceFooter(result.submittedCount),
              }),
            ],
          })
          .catch((error: unknown) =>
            console.warn('[test-instance] Card count refresh failed:', error),
          );
      }
    }

    const summaryLines = ['Result submitted.'];
    const deliveryStatuses = result.deliveries.map((delivery) => delivery.status);
    if (deliveryStatuses.some((status) => status !== 'delivered')) {
      summaryLines.push('Follow-up delivery is queued and will retry.');
    } else if (deliveryStatuses.length > 0) {
      summaryLines.push('Follow-up delivered.');
    }

    await interaction.editReply(summaryLines.join('\n'));
  },
};
