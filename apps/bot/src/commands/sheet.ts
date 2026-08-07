import {
  MessageFlags,
  type ChatInputCommandInteraction,
  type InteractionDeferReplyOptions,
} from 'discord.js';
import type { BotChatCommand } from '../discord/command-types.js';
import { botBackend, type BotBackend } from '../backend/bot-backend.js';
import { BotAccessRevokedError } from '../backend/access-revoked.js';

export async function handleSheet(
  interaction: ChatInputCommandInteraction,
  backend: BotBackend = botBackend,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral } as InteractionDeferReplyOptions);

  try {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.editReply('This command can only be used in a server.');
      return;
    }

    const result = await backend.requestPlayerSheetMagicLink(interaction.user.id, guildId);

    await interaction.editReply({
      content:
        `Open your campaign sheet here: <${result.url}>\n\n` +
        '*This link signs you into your player sheet. It is unique to your Discord account and should not be shared.*',
    });
  } catch (error) {
    if (error instanceof BotAccessRevokedError) throw error;
    console.error('Sheet command error:', error);
    await interaction.editReply('Failed to generate a player sheet link. Please try again later.');
  }
}

export const sheetCommand: BotChatCommand = {
  data: {
    name: 'sheet',
    description: 'Get a magic link to your player sheet',
  },
  execute: handleSheet,
};
