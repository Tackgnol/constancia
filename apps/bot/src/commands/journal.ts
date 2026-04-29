import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type InteractionDeferReplyOptions,
} from 'discord.js';
import {
  getBotJournalForPlayer,
  getCampaignByGuild,
} from '@constancia/api-client/endpoints/bot/bot';
import type {
  GetBotJournalForPlayer200Data,
  GetBotJournalForPlayer200DataNpcsItem,
  GetBotJournalForPlayer200DataQuestsItem,
  GetBotJournalForPlayer200DataQuestsItemEntriesItem,
} from '@constancia/api-client/model';
import { requestPlayerJournalMagicLink } from '../auth/request-player-journal-magic-link.js';
import { botRequestOptions, loadBotConfig } from '../config.js';
import type { BotChatCommand, BotComponentHandler } from '../discord/command-types.js';

const JOURNAL_COMPONENT_PREFIX = 'journal:';
const JOURNAL_CATEGORY_PREFIX = `${JOURNAL_COMPONENT_PREFIX}category:`;
const JOURNAL_DETAIL_PREFIX = `${JOURNAL_COMPONENT_PREFIX}detail:`;
const JOURNAL_BACK_PREFIX = `${JOURNAL_COMPONENT_PREFIX}back:`;
const MAX_DETAIL_BUTTONS = 20;

type JournalCategory = 'quests' | 'npcs' | 'lore';

interface JournalContext {
  guildId: string;
  campaignId: string;
  journal: GetBotJournalForPlayer200Data;
  journalUrl: string;
}

function encodeCustomIdPart(value: string): string {
  return encodeURIComponent(value);
}

function decodeCustomIdPart(value: string): string {
  return decodeURIComponent(value);
}

function buildJournalUrlFallback(campaignId: string): string {
  const config = loadBotConfig();
  return new URL(
    `/player/campaigns/${encodeURIComponent(campaignId)}/journal`,
    config.frontendUrl,
  ).toString();
}

async function loadJournalContext(guildId: string, discordUserId: string): Promise<JournalContext> {
  const campaignResult = await getCampaignByGuild({ guildId }, botRequestOptions());
  const campaignId = campaignResult.data.id;
  const [journalResult, linkResult] = await Promise.all([
    getBotJournalForPlayer({ id: campaignId, discordUserId }, botRequestOptions()),
    requestPlayerJournalMagicLink({ discordUserId, guildId }),
  ]);

  return {
    guildId,
    campaignId,
    journal: journalResult.data,
    journalUrl: linkResult.url || buildJournalUrlFallback(campaignId),
  };
}

function createBaseEmbed(context: JournalContext): EmbedBuilder {
  const { quests, summaries, npcs } = context.journal;

  return new EmbedBuilder()
    .setTitle('Player Journal')
    .setColor(0x58a6ff)
    .setDescription('Pick a section, then choose a specific entry to inspect.')
    .addFields(
      {
        name: 'Quests',
        value: `${quests.length} visible`,
        inline: true,
      },
      {
        name: 'NPCs',
        value: `${npcs.length} known`,
        inline: true,
      },
      {
        name: 'Lore',
        value: 'Pending',
        inline: true,
      },
      {
        name: 'Sessions',
        value:
          summaries.length > 0
            ? summaries.map((summary) => summary.title).join('\n')
            : 'None released',
      },
    );
}

function createWebJournalButton(journalUrl: string): ButtonBuilder {
  return new ButtonBuilder()
    .setLabel('Open web journal')
    .setStyle(ButtonStyle.Link)
    .setURL(journalUrl);
}

function createBackButton(context: JournalContext): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(`${JOURNAL_BACK_PREFIX}${encodeCustomIdPart(context.guildId)}`)
    .setLabel('Back')
    .setStyle(ButtonStyle.Secondary);
}

function chunkButtons(
  buttons: ButtonBuilder[],
  chunkSize: number,
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let index = 0; index < buttons.length; index += chunkSize) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...buttons.slice(index, index + chunkSize),
      ),
    );
  }
  return rows;
}

function buildHomeComponents(context: JournalContext): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${JOURNAL_CATEGORY_PREFIX}${encodeCustomIdPart(context.guildId)}:quests`)
        .setLabel('Quests')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(context.journal.quests.length === 0),
      new ButtonBuilder()
        .setCustomId(`${JOURNAL_CATEGORY_PREFIX}${encodeCustomIdPart(context.guildId)}:npcs`)
        .setLabel('NPCs')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(context.journal.npcs.length === 0),
      new ButtonBuilder()
        .setCustomId(`${JOURNAL_CATEGORY_PREFIX}${encodeCustomIdPart(context.guildId)}:lore`)
        .setLabel('Lore')
        .setStyle(ButtonStyle.Secondary),
      createWebJournalButton(context.journalUrl),
    ),
  ];
}

function buildCategoryEmbed(context: JournalContext, category: JournalCategory): EmbedBuilder {
  if (category === 'quests') {
    return new EmbedBuilder()
      .setTitle('Journal - Quests')
      .setColor(0x58a6ff)
      .setDescription(
        context.journal.quests.length > 0
          ? 'Choose a quest to inspect its visible steps.'
          : 'No visible quests have been released yet.',
      );
  }

  if (category === 'npcs') {
    return new EmbedBuilder()
      .setTitle('Journal - NPCs')
      .setColor(0xd2a8ff)
      .setDescription(
        context.journal.npcs.length > 0
          ? 'Choose an NPC dossier to inspect revealed facts.'
          : 'No NPC facts have been revealed to you yet.',
      );
  }

  return new EmbedBuilder()
    .setTitle('Journal - Lore')
    .setColor(0x3fb950)
    .setDescription(
      'Lore entries are not wired yet. Open the web journal for the full player view once lore lands.',
    );
}

function buildCategoryComponents(
  context: JournalContext,
  category: JournalCategory,
): ActionRowBuilder<ButtonBuilder>[] {
  const buttons =
    category === 'quests'
      ? context.journal.quests.slice(0, MAX_DETAIL_BUTTONS).map((quest) =>
          new ButtonBuilder()
            .setCustomId(
              `${JOURNAL_DETAIL_PREFIX}${encodeCustomIdPart(context.guildId)}:quests:${encodeCustomIdPart(quest.id)}`,
            )
            .setLabel(quest.name.slice(0, 80))
            .setStyle(ButtonStyle.Secondary),
        )
      : category === 'npcs'
        ? context.journal.npcs.slice(0, MAX_DETAIL_BUTTONS).map((npc) =>
            new ButtonBuilder()
              .setCustomId(
                `${JOURNAL_DETAIL_PREFIX}${encodeCustomIdPart(context.guildId)}:npcs:${encodeCustomIdPart(npc.id)}`,
              )
              .setLabel(npc.name.slice(0, 80))
              .setStyle(ButtonStyle.Secondary),
          )
        : [];

  return [
    ...chunkButtons(buttons, 5),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      createBackButton(context),
      createWebJournalButton(context.journalUrl),
    ),
  ];
}

function formatQuestEntries(
  entries: GetBotJournalForPlayer200DataQuestsItemEntriesItem[] | undefined,
): string {
  const sorted = [...(entries ?? [])].sort((left, right) => left.sortOrder - right.sortOrder);
  if (sorted.length === 0) {
    return 'No visible steps filed yet.';
  }

  return sorted
    .map((entry, index) => `${index + 1}. ${entry.content} [${entry.status}]`)
    .join('\n')
    .slice(0, 1_000);
}

function buildQuestDetailEmbed(quest: GetBotJournalForPlayer200DataQuestsItem): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(quest.name)
    .setColor(0x58a6ff)
    .addFields(
      { name: 'Status', value: quest.status, inline: true },
      { name: 'Steps', value: formatQuestEntries(quest.entries) },
    );

  if (quest.description) {
    embed.setDescription(quest.description);
  }

  return embed;
}

function buildNpcDetailEmbed(npc: GetBotJournalForPlayer200DataNpcsItem): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(npc.name)
    .setColor(0xd2a8ff)
    .setDescription(
      npc.facts.length > 0
        ? npc.facts
            .map((fact, index) => `${index + 1}. ${fact.content}`)
            .join('\n')
            .slice(0, 1_500)
        : 'No facts have been revealed.',
    );
}

function buildDetailComponents(
  context: JournalContext,
  category: JournalCategory,
): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${JOURNAL_CATEGORY_PREFIX}${encodeCustomIdPart(context.guildId)}:${category}`)
        .setLabel(category === 'quests' ? 'Back to quests' : 'Back to NPCs')
        .setStyle(ButtonStyle.Secondary),
      createWebJournalButton(context.journalUrl),
    ),
  ];
}

function findQuest(
  journal: GetBotJournalForPlayer200Data,
  questId: string,
): GetBotJournalForPlayer200DataQuestsItem | null {
  return journal.quests.find((quest) => quest.id === questId) ?? null;
}

function findNpc(
  journal: GetBotJournalForPlayer200Data,
  npcId: string,
): GetBotJournalForPlayer200DataNpcsItem | null {
  return journal.npcs.find((npc) => npc.id === npcId) ?? null;
}

function parseCategoryCustomId(
  customId: string,
): { guildId: string; category: JournalCategory } | null {
  if (!customId.startsWith(JOURNAL_CATEGORY_PREFIX)) {
    return null;
  }

  const [guildIdPart, category, ...rest] = customId
    .slice(JOURNAL_CATEGORY_PREFIX.length)
    .split(':');
  if (!guildIdPart || rest.length > 0 || !isJournalCategory(category)) {
    return null;
  }

  return { guildId: decodeCustomIdPart(guildIdPart), category };
}

function parseDetailCustomId(
  customId: string,
): { guildId: string; category: Exclude<JournalCategory, 'lore'>; id: string } | null {
  if (!customId.startsWith(JOURNAL_DETAIL_PREFIX)) {
    return null;
  }

  const [guildIdPart, category, idPart, ...rest] = customId
    .slice(JOURNAL_DETAIL_PREFIX.length)
    .split(':');
  if (
    !guildIdPart ||
    !idPart ||
    rest.length > 0 ||
    (category !== 'quests' && category !== 'npcs')
  ) {
    return null;
  }

  return {
    guildId: decodeCustomIdPart(guildIdPart),
    category,
    id: decodeCustomIdPart(idPart),
  };
}

function parseBackCustomId(customId: string): { guildId: string } | null {
  if (!customId.startsWith(JOURNAL_BACK_PREFIX)) {
    return null;
  }

  const guildIdPart = customId.slice(JOURNAL_BACK_PREFIX.length);
  return guildIdPart ? { guildId: decodeCustomIdPart(guildIdPart) } : null;
}

function isJournalCategory(value: string | undefined): value is JournalCategory {
  return value === 'quests' || value === 'npcs' || value === 'lore';
}

export async function handleJournal(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral } as InteractionDeferReplyOptions);

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply('This command must be used in a server.');
    return;
  }

  const context = await loadJournalContext(guildId, interaction.user.id);

  await interaction.editReply({
    embeds: [createBaseEmbed(context)],
    components: buildHomeComponents(context),
  });
}

export const journalCommand: BotChatCommand = {
  data: {
    name: 'journal',
    description: 'View your quest journal, session summaries, and known NPC facts',
  },
  execute: handleJournal,
};

export const journalComponentHandler: BotComponentHandler = {
  customIdPrefix: JOURNAL_COMPONENT_PREFIX,
  execute: async (interaction) => {
    if (!interaction.isButton()) {
      return;
    }

    await handleJournalButton(interaction);
  },
};

async function handleJournalButton(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();

  const categoryTarget = parseCategoryCustomId(interaction.customId);
  if (categoryTarget) {
    const context = await loadJournalContext(categoryTarget.guildId, interaction.user.id);
    await interaction.editReply({
      embeds: [buildCategoryEmbed(context, categoryTarget.category)],
      components: buildCategoryComponents(context, categoryTarget.category),
    });
    return;
  }

  const detailTarget = parseDetailCustomId(interaction.customId);
  if (detailTarget) {
    const context = await loadJournalContext(detailTarget.guildId, interaction.user.id);
    const target =
      detailTarget.category === 'quests'
        ? findQuest(context.journal, detailTarget.id)
        : findNpc(context.journal, detailTarget.id);

    if (!target) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Journal entry unavailable')
            .setColor(0xf0883e)
            .setDescription('That entry is no longer visible in your journal.'),
        ],
        components: buildCategoryComponents(context, detailTarget.category),
      });
      return;
    }

    await interaction.editReply({
      embeds: [
        detailTarget.category === 'quests'
          ? buildQuestDetailEmbed(target as GetBotJournalForPlayer200DataQuestsItem)
          : buildNpcDetailEmbed(target as GetBotJournalForPlayer200DataNpcsItem),
      ],
      components: buildDetailComponents(context, detailTarget.category),
    });
    return;
  }

  const backTarget = parseBackCustomId(interaction.customId);
  if (backTarget) {
    const context = await loadJournalContext(backTarget.guildId, interaction.user.id);
    await interaction.editReply({
      embeds: [createBaseEmbed(context)],
      components: buildHomeComponents(context),
    });
  }
}
