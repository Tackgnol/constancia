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
import {
  blockMessageSchema,
  type BlockMessage,
  type SendMessagesPayload,
  type SendTestInstancePayload,
} from '@constancia/contracts';
import { submitBotTestResult } from '@constancia/api-client/endpoints/bot/bot';
import { botRequestOptions } from '../config.js';
import { deliverMessages } from '../delivery.js';
import type { BotComponentHandler, BotModalHandler } from './command-types.js';
import { buildMessageReportButton } from './message-reports.js';

const TEST_INSTANCE_SUBMIT_PREFIX = 'test-instance:submit:';
const TEST_INSTANCE_MODAL_PREFIX = 'test-instance:modal:';
const TEST_INSTANCE_SCORE_INPUT_ID = 'player-score';

function encodeTestInstanceKey(eventId: string, campaignId: string): string {
  return `${eventId}:${campaignId}`;
}

function decodeTestInstanceKey(
  customId: string,
  prefix: string,
): { eventId: string; campaignId: string } | null {
  if (!customId.startsWith(prefix)) {
    return null;
  }

  const encoded = customId.slice(prefix.length);
  const [eventId, campaignId, ...rest] = encoded.split(':');
  if (!eventId || !campaignId || rest.length > 0) {
    return null;
  }

  return { eventId, campaignId };
}

function buildTestInstanceEmbed(payload: SendTestInstancePayload): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(payload.title)
    .setColor(0x58a6ff)
    .setFooter({ text: 'Submit your actual result. The bot does not roll for you.' });

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
      .setCustomId(
        `${TEST_INSTANCE_SUBMIT_PREFIX}${encodeTestInstanceKey(payload.eventId, payload.campaignId)}`,
      )
      .setLabel('Submit Result')
      .setStyle(ButtonStyle.Primary),
    buildMessageReportButton(payload.eventId),
  );
}

function buildScoreModal(eventId: string, campaignId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${TEST_INSTANCE_MODAL_PREFIX}${encodeTestInstanceKey(eventId, campaignId)}`)
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

function parseResultMessages(messages: unknown): BlockMessage[] | null {
  const parsed = blockMessageSchema.array().safeParse(messages);
  return parsed.success ? parsed.data : null;
}

function splitResultMessages(
  messages: readonly BlockMessage[],
  currentUserId: string,
): {
  playerReplyLines: string[];
  forwardMessages: BlockMessage[];
} {
  const playerReplyLines: string[] = [];
  const forwardMessages: BlockMessage[] = [];

  for (const message of messages) {
    if (
      message.target === 'player' &&
      (message.targetId === undefined || message.targetId === currentUserId)
    ) {
      const content = [message.content.trim(), message.imageUrl?.trim()].filter(Boolean).join('\n');
      if (content) {
        playerReplyLines.push(content);
      }
      continue;
    }

    forwardMessages.push(message);
  }

  return { playerReplyLines, forwardMessages };
}

export async function deliverTestInstance(
  client: Client,
  payload: SendTestInstancePayload,
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
  });

  return { delivered: 1, skipped: 0 };
}

export const testInstanceComponentHandler: BotComponentHandler = {
  customIdPrefix: TEST_INSTANCE_SUBMIT_PREFIX,
  execute: async (interaction) => {
    const ids = decodeTestInstanceKey(interaction.customId, TEST_INSTANCE_SUBMIT_PREFIX);
    if (!ids) {
      await interaction.reply({
        content: 'This test card is missing its event context.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.showModal(buildScoreModal(ids.eventId, ids.campaignId));
  },
};

export const testInstanceModalHandler: BotModalHandler = {
  customIdPrefix: TEST_INSTANCE_MODAL_PREFIX,
  execute: async (interaction) => {
    const ids = decodeTestInstanceKey(interaction.customId, TEST_INSTANCE_MODAL_PREFIX);
    if (!ids) {
      await interaction.reply({
        content: 'This test submission is missing its event context.',
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

    const result = await submitBotTestResult(
      {
        eventId: ids.eventId,
        campaignId: ids.campaignId,
        channelId: interaction.channelId,
        discordUserId: interaction.user.id,
        playerScore,
      },
      botRequestOptions(),
    );

    const parsedMessages = parseResultMessages(result.data.messages);
    if (!parsedMessages) {
      await interaction.editReply('The backend returned an invalid test result payload.');
      return;
    }

    const { playerReplyLines, forwardMessages } = splitResultMessages(
      parsedMessages,
      interaction.user.id,
    );
    const deliveryPayload: SendMessagesPayload = {
      kind: 'messages',
      eventId: ids.eventId,
      discordChannelId: interaction.channelId,
      messages: forwardMessages,
    };
    const forwarded = await deliverMessages(interaction.client, deliveryPayload);

    const summaryLines = ['Result submitted.'];
    if (playerReplyLines.length > 0) {
      summaryLines.push('', ...playerReplyLines);
    }
    if (forwarded.delivered > 0 || forwarded.skipped > 0) {
      summaryLines.push('', `Forwarded ${forwarded.delivered} follow-up message(s).`);
      if (forwarded.skipped > 0) {
        summaryLines.push(`Skipped ${forwarded.skipped} message(s) that could not be delivered.`);
      }
    }

    await interaction.editReply(summaryLines.join('\n'));
  },
};
