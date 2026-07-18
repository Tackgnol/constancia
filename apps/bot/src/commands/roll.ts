import type { ChatInputCommandInteraction } from 'discord.js';
import { botBackend, type BotBackend } from '../backend/bot-backend.js';
import type { BotChatCommand } from '../discord/command-types.js';

export async function handleRoll(
  interaction: ChatInputCommandInteraction,
  backend: BotBackend = botBackend,
): Promise<void> {
  await interaction.deferReply();

  const events = await backend.getChannelEvents(interaction.channelId);

  if (events.length === 0) {
    await interaction.editReply('No active events in this channel.');
    return;
  }

  const event = events[0];
  if (event.type === 'test') {
    await interaction.editReply('Use the active test card in this channel to submit your result.');
    return;
  }

  await interaction.editReply(
    'The active event is not a player test. Fire it from the GM Play View.',
  );
}

export const rollCommand: BotChatCommand = {
  data: {
    name: 'roll',
    description: 'Fire the active event in this channel',
  },
  execute: handleRoll,
};
