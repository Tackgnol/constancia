import type { ChatInputCommandInteraction } from 'discord.js';
import { getCampaignByGuild } from '@constancia/api-client/endpoints/bot/bot';
import { getGameSystem } from '@constancia/api-client/endpoints/systems/systems';
import type { GameCalendarDefinition } from '@constancia/contracts';
import { formatGameDate, parseGameDate } from '@constancia/systems';
import { botRequestOptions } from '../config.js';
import type { BotChatCommand } from '../discord/command-types.js';

export async function handleDate(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply('This command can only be used in a server.');
    return;
  }

  try {
    const campaignResult = await getCampaignByGuild({ guildId }, botRequestOptions());
    if (campaignResult.status !== 'ok') {
      await interaction.editReply('This server has no campaign set up. Run `/setup` first.');
      return;
    }

    const gameDate = parseGameDate(campaignResult.data.gameDate);
    if (!gameDate) {
      await interaction.editReply(
        'No game date set yet. The GM can set one from the War Room top bar.',
      );
      return;
    }

    const systemResult = await getGameSystem(
      { id: campaignResult.data.gameSystemId },
      botRequestOptions(),
    );
    const calendar =
      systemResult.status === 'ok'
        ? (systemResult.data.calendars[gameDate.calendarId] as GameCalendarDefinition | undefined)
        : undefined;

    const formatted = calendar
      ? formatGameDate(gameDate, calendar)
      : `${gameDate.day} ${gameDate.monthId} ${gameDate.year}`;
    await interaction.editReply(`📅 Current game date: **${formatted}**`);
  } catch (error) {
    console.error('Date command error:', error);
    await interaction.editReply('Failed to fetch the game date. Please try again later.');
  }
}

export const dateCommand: BotChatCommand = {
  data: {
    name: 'date',
    description: 'Show the current in-game date',
  },
  execute: handleDate,
};
