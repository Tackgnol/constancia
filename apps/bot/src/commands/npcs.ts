import type { ChatInputCommandInteraction } from 'discord.js';
import { getCampaignByGuild } from '../api/generated/endpoints/bot/bot.js';
import { listVisibleNpcsForPlayer } from '../api/generated/endpoints/npcs/npcs.js';
import { botRequestOptions } from '../api/bot-headers.js';

export async function handleNpcs(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply('This command must be used in a server.');
    return;
  }

  const campaignResult = await getCampaignByGuild({ guildId }, botRequestOptions());
  const campaignId = campaignResult.data.id;

  const npcsResult = await listVisibleNpcsForPlayer(
    { id: campaignId, discordId: interaction.user.id },
    botRequestOptions(),
  );

  const npcs = npcsResult.data;

  if (npcs.length === 0) {
    await interaction.editReply("You haven't encountered any NPCs yet.");
    return;
  }

  const lines: string[] = [];

  for (const npc of npcs) {
    lines.push(`**${npc.name}**`);
    for (const fact of npc.facts) {
      const content = fact['content'];
      if (typeof content === 'string') {
        lines.push(`  • ${content}`);
      }
    }
  }

  await interaction.editReply(lines.join('\n'));
}
