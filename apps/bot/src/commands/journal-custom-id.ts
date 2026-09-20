export const JOURNAL_COMPONENT_PREFIX = 'journal:';

const JOURNAL_CATEGORY_PREFIX = `${JOURNAL_COMPONENT_PREFIX}category:`;
const JOURNAL_DETAIL_PREFIX = `${JOURNAL_COMPONENT_PREFIX}detail:`;
const JOURNAL_BACK_PREFIX = `${JOURNAL_COMPONENT_PREFIX}back:`;

export type JournalCategory = 'quests' | 'npcs' | 'lore';

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function isJournalCategory(value: string | undefined): value is JournalCategory {
  return value === 'quests' || value === 'npcs' || value === 'lore';
}

export function buildJournalCategoryCustomId(guildId: string, category: JournalCategory): string {
  return `${JOURNAL_CATEGORY_PREFIX}${encodeURIComponent(guildId)}:${category}`;
}

export function buildJournalDetailCustomId(
  guildId: string,
  category: JournalCategory,
  id: string,
): string {
  return `${JOURNAL_DETAIL_PREFIX}${encodeURIComponent(guildId)}:${category}:${encodeURIComponent(id)}`;
}

export function buildJournalBackCustomId(guildId: string): string {
  return `${JOURNAL_BACK_PREFIX}${encodeURIComponent(guildId)}`;
}

export function parseJournalCategoryCustomId(
  customId: string,
): { guildId: string; category: JournalCategory } | null {
  if (!customId.startsWith(JOURNAL_CATEGORY_PREFIX)) {
    return null;
  }

  const [guildIdPart, category, ...rest] = customId
    .slice(JOURNAL_CATEGORY_PREFIX.length)
    .split(':');
  const guildId = guildIdPart ? decode(guildIdPart) : null;
  return guildId !== null && rest.length === 0 && isJournalCategory(category)
    ? { guildId, category }
    : null;
}

export function parseJournalDetailCustomId(
  customId: string,
): { guildId: string; category: JournalCategory; id: string } | null {
  if (!customId.startsWith(JOURNAL_DETAIL_PREFIX)) {
    return null;
  }

  const [guildIdPart, category, idPart, ...rest] = customId
    .slice(JOURNAL_DETAIL_PREFIX.length)
    .split(':');
  const guildId = guildIdPart ? decode(guildIdPart) : null;
  const id = idPart ? decode(idPart) : null;

  return guildId !== null && id !== null && rest.length === 0 && isJournalCategory(category)
    ? { guildId, category, id }
    : null;
}

export function parseJournalBackCustomId(customId: string): { guildId: string } | null {
  if (!customId.startsWith(JOURNAL_BACK_PREFIX)) {
    return null;
  }

  const guildIdPart = customId.slice(JOURNAL_BACK_PREFIX.length);
  const guildId = guildIdPart ? decode(guildIdPart) : null;
  return guildId === null ? null : { guildId };
}
