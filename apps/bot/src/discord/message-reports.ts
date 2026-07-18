import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ButtonInteraction,
} from 'discord.js';
import { botBackend } from '../backend/bot-backend.js';
import type { BotComponentHandler } from './command-types.js';

export const MESSAGE_REPORT_PREFIX = 'message-report:';

export function buildMessageReportButton(eventId: string): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(`${MESSAGE_REPORT_PREFIX}${encodeURIComponent(eventId)}`)
    .setLabel('Report')
    .setStyle(ButtonStyle.Secondary);
}

export function buildMessageReportRow(eventId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(buildMessageReportButton(eventId));
}

function decodeReportEventId(customId: string): string | null {
  if (!customId.startsWith(MESSAGE_REPORT_PREFIX)) {
    return null;
  }

  const encoded = customId.slice(MESSAGE_REPORT_PREFIX.length);
  if (!encoded) {
    return null;
  }

  return decodeURIComponent(encoded);
}

function getEmbedImageUrl(interaction: ButtonInteraction): string | undefined {
  return interaction.message.embeds[0]?.image?.url ?? undefined;
}

function getMessageContent(interaction: ButtonInteraction): string {
  const content = interaction.message.content.trim();
  if (content.length > 0) {
    return content;
  }

  const embed = interaction.message.embeds[0];
  const lines = [embed?.title, embed?.description].filter(
    (line): line is string => typeof line === 'string' && line.length > 0,
  );
  return lines.join('\n');
}

async function submitMessageReport(interaction: ButtonInteraction, eventId: string): Promise<void> {
  await botBackend.submitMessageReport({
    eventId,
    ...(interaction.guildId ? { discordGuildId: interaction.guildId } : {}),
    ...(interaction.channelId ? { discordChannelId: interaction.channelId } : {}),
    discordMessageId: interaction.message.id,
    discordUserId: interaction.user.id,
    messageTarget: interaction.inGuild() ? 'channel' : 'dm',
    messageContent: getMessageContent(interaction),
    ...(getEmbedImageUrl(interaction) ? { imageUrl: getEmbedImageUrl(interaction) } : {}),
  });
}

export const messageReportComponentHandler: BotComponentHandler = {
  customIdPrefix: MESSAGE_REPORT_PREFIX,
  execute: async (interaction) => {
    if (!interaction.isButton()) {
      return;
    }

    const eventId = decodeReportEventId(interaction.customId);
    if (!eventId) {
      await interaction.reply({
        content: 'This report button is missing event context.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await submitMessageReport(interaction, eventId);
    await interaction.editReply('Reported. The GM can review it later.');
  },
};
