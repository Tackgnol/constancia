import type { ChatInputCommandInteraction } from 'discord.js';
import { getChannelEvents, submitBotTestResult } from '../api/generated/endpoints/bot/bot.js';
import { botRequestOptions } from '../api/bot-headers.js';
import type { BotChatCommand } from '../discord/command-types.js';

export async function handleRoll(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const eventsResult = await getChannelEvents(
    { channelId: interaction.channelId },
    botRequestOptions(),
  );

  if (!eventsResult.data || eventsResult.data.length === 0) {
    await interaction.editReply('No active events in this channel.');
    return;
  }

  const event = eventsResult.data[0];

  const result = await submitBotTestResult(
    {
      eventId: event.id,
      campaignId: event.campaignId,
      channelId: interaction.channelId,
      discordUserId: interaction.user.id,
      playerScore: 0,
    },
    botRequestOptions(),
  );

  const playerMessages: string[] = [];

  for (const msg of result.data.messages) {
    const target = msg['target'];
    const content = msg['content'];
    if (typeof content !== 'string') continue;

    if (target === 'channel') {
      const ch = interaction.channel;
      if (ch && ch.isTextBased() && !ch.isDMBased()) {
        await ch.send(content);
      }
    } else if (target === 'player') {
      playerMessages.push(content);
    }
  }

  await interaction.editReply(playerMessages.join('\n') || 'Roll complete.');
}

export const rollCommand: BotChatCommand = {
  data: {
    name: 'roll',
    description: 'Fire the active event in this channel',
  },
  execute: handleRoll,
};

