import { ApplicationCommandOptionType, type ChatInputCommandInteraction } from 'discord.js';
import {
  getCampaignByGuild,
  listBotVisibleNpcsForPlayer,
} from '../api/generated/endpoints/bot/bot.js';
import { botRequestOptions } from '../api/bot-headers.js';
import { loadBotConfig } from '../config.js';
import type { BotChatCommand } from '../discord/command-types.js';

const NPC_NAME_OPTION = 'name';

function normalizeQuery(input: string): string {
  return input.trim().toLowerCase();
}

function getPlayerNpcUrl(campaignId: string, npcId: string): string {
  const config = loadBotConfig();
  return new URL(
    `/player/campaigns/${encodeURIComponent(campaignId)}/npcs/${encodeURIComponent(npcId)}`,
    config.frontendUrl,
  ).toString();
}

export async function handleNpcs(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply('This command must be used in a server.');
    return;
  }

  const campaignResult = await getCampaignByGuild({ guildId }, botRequestOptions());
  const campaignId = campaignResult.data.id;
  const requestedName = interaction.options.getString(NPC_NAME_OPTION, true);
  const normalizedQuery = normalizeQuery(requestedName);

  const npcsResult = await listBotVisibleNpcsForPlayer(
    { id: campaignId, discordUserId: interaction.user.id },
    botRequestOptions(),
  );

  const npcs = npcsResult.data;

  if (npcs.length === 0) {
    await interaction.editReply("You haven't encountered any NPCs yet.");
    return;
  }

  const exactMatch = npcs.find((npc) => normalizeQuery(npc.name) === normalizedQuery);
  const partialMatches = npcs.filter((npc) => normalizeQuery(npc.name).includes(normalizedQuery));
  const selectedNpc = exactMatch ?? (partialMatches.length === 1 ? partialMatches[0] : null);

  if (selectedNpc === null) {
    if (partialMatches.length > 1) {
      await interaction.editReply(
        `More than one dossier matches **${requestedName}**. Try one of these exact names:\n${partialMatches
          .slice(0, 8)
          .map((npc) => `• ${npc.name}`)
          .join('\n')}`,
      );
      return;
    }

    await interaction.editReply(
      `No known NPC matches **${requestedName}**. Known dossiers: ${npcs
        .slice(0, 8)
        .map((npc) => npc.name)
        .join(', ')}${npcs.length > 8 ? '…' : ''}`,
    );
    return;
  }

  const previewFacts = selectedNpc.facts.slice(0, 6);
  const remainingFacts = selectedNpc.facts.length - previewFacts.length;

  const lines: string[] = [
    `**${selectedNpc.name}**`,
    `${selectedNpc.facts.length} confirmed detail${selectedNpc.facts.length === 1 ? '' : 's'} in your dossier.`,
    '',
    ...previewFacts.map((fact) => `• ${fact.content}`),
    ...(remainingFacts > 0 ? ['', `…and ${remainingFacts} more in the linked dossier.`] : []),
    '',
    `Field dossier: ${getPlayerNpcUrl(campaignId, selectedNpc.id)}`,
  ];

  await interaction.editReply(lines.join('\n'));
}

export const npcCommand: BotChatCommand = {
  data: {
    name: 'npc',
    description: 'Inspect a known NPC dossier',
    options: [
      {
        name: NPC_NAME_OPTION,
        type: ApplicationCommandOptionType.String,
        description: 'The NPC name you want to inspect',
        required: true,
      },
    ],
  },
  execute: handleNpcs,
};
