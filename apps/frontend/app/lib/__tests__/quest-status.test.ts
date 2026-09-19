import { describe, expect, it } from 'vitest';
import { normalizeQuestEntryStatus, normalizeQuestStatus, sortQuestEntries } from '../quest-status';

describe('quest status utilities', () => {
  it('preserves known statuses and falls back for unknown values', () => {
    expect(normalizeQuestStatus('completed')).toBe('completed');
    expect(normalizeQuestStatus('unknown')).toBe('active');
    expect(normalizeQuestEntryStatus('done')).toBe('done');
    expect(normalizeQuestEntryStatus('unknown')).toBe('pending');
  });

  it('sorts a copy of quest entries by sort order', () => {
    const entries = [
      { id: 'later', sortOrder: 2 },
      { id: 'first', sortOrder: 0 },
    ];

    expect(sortQuestEntries(entries).map((entry) => entry.id)).toEqual(['first', 'later']);
    expect(entries.map((entry) => entry.id)).toEqual(['later', 'first']);
  });
});
