import {
  MessageFlags,
  type ChatInputCommandInteraction,
  type InteractionDeferReplyOptions,
} from 'discord.js';
import { botBackend, type BotBackend } from '../backend/bot-backend.js';
import type { BotChatCommand } from '../discord/command-types.js';

export async function handleLogin(
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

    const result = await backend.requestAdminMagicLink(interaction.user.id, guildId);

    await interaction.editReply({
      content: `Use this link to log in to the Constancia web dashboard: <${result.url}>\n\n*Note: This link is unique to you and should not be shared.*`,
    });
  } catch (error) {
    console.error('Login command error:', error);
    await interaction.editReply('Failed to generate a login link. Please try again later.');
  }
}

export const loginCommand: BotChatCommand = {
  data: {
    name: 'login',
    description: 'Get a magic link to log in to the web dashboard',
  },
  execute: handleLogin,
};
