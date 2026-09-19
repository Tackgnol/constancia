export const QUEST_STATUSES = ['active', 'completed', 'failed'] as const;
export const QUEST_ENTRY_STATUSES = ['pending', 'done'] as const;

export type QuestStatus = (typeof QUEST_STATUSES)[number];
export type QuestEntryStatus = (typeof QUEST_ENTRY_STATUSES)[number];

export function normalizeQuestStatus(status: string): QuestStatus {
  return QUEST_STATUSES.includes(status as QuestStatus) ? (status as QuestStatus) : 'active';
}

export function normalizeQuestEntryStatus(status: string): QuestEntryStatus {
  return QUEST_ENTRY_STATUSES.includes(status as QuestEntryStatus)
    ? (status as QuestEntryStatus)
    : 'pending';
}

export function sortQuestEntries<T extends { sortOrder: number }>(
  entries: readonly T[] | undefined,
): T[] {
  return [...(entries ?? [])].sort((left, right) => left.sortOrder - right.sortOrder);
}
