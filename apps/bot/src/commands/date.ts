import type { ChatInputCommandInteraction } from 'discord.js';
import { botBackend, type BotBackend } from '../backend/bot-backend.js';
import { BotAccessRevokedError } from '../backend/access-revoked.js';
import type { BotChatCommand } from '../discord/command-types.js';

export async function handleDate(
  interaction: ChatInputCommandInteraction,
  backend: BotBackend = botBackend,
): Promise<void> {
  await interaction.deferReply();

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply('This command can only be used in a server.');
    return;
  }

  try {
    const formatted = await backend.getCampaignDate(guildId);
    if (formatted === undefined) {
      await interaction.editReply('This server has no campaign set up. Run `/setup` first.');
      return;
    }

    if (formatted === null) {
      await interaction.editReply(
        'No game date set yet. The GM can set one from the War Room top bar.',
      );
      return;
    }

    await interaction.editReply(`📅 Current game date: **${formatted}**`);
  } catch (error) {
    if (error instanceof BotAccessRevokedError) throw error;
    console.error('Date command error:', error);
    await interaction.editReply('Failed to fetch the game date. Please try again later.');
  }
}

export const dateCommand: BotChatCommand = {
  data: {
    name: 'date',
    description: '[Player] Show the current in-game date of the campaign (visible to the channel)',
  },
  execute: handleDate,
};
