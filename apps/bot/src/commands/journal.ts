import type { ChatInputCommandInteraction } from 'discord.js';
import { getCampaignByGuild } from '@constancia/api-client/endpoints/bot/bot';
import { getJournalForPlayer } from '@constancia/api-client/endpoints/journal/journal';
import { botRequestOptions } from '../api/bot-headers.js';
import type { BotChatCommand } from '../discord/command-types.js';

export async function handleJournal(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply('This command must be used in a server.');
    return;
  }

  const campaignResult = await getCampaignByGuild({ guildId }, botRequestOptions());
  const campaignId = campaignResult.data.id;

  const journalResult = await getJournalForPlayer(
    { id: campaignId, discordId: interaction.user.id },
    botRequestOptions(),
  );

  const { quests, summaries } = journalResult.data;

  if (quests.length === 0 && summaries.length === 0) {
    await interaction.editReply('Your journal is empty.');
    return;
  }

  const lines: string[] = [];

  if (quests.length > 0) {
    lines.push('**Quests**');
    for (const quest of quests) {
      lines.push(`• ${quest.name} [${quest.status}]`);
      for (const entry of quest.entries ?? []) {
        lines.push(`  - ${entry.content} [${entry.status}]`);
      }
    }
  }

  if (summaries.length > 0) {
    lines.push('**Session Summaries**');
    for (const summary of summaries) {
      lines.push(`• ${summary.title} — ${summary.sessionDate}`);
    }
  }

  await interaction.editReply(lines.join('\n'));
}

export const journalCommand: BotChatCommand = {
  data: {
    name: 'journal',
    description: 'View your quest journal and session summaries',
  },
  execute: handleJournal,
};
