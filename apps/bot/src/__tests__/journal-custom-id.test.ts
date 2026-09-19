import { describe, expect, it } from 'vitest';
import {
  buildJournalBackCustomId,
  buildJournalCategoryCustomId,
  buildJournalDetailCustomId,
  parseJournalBackCustomId,
  parseJournalCategoryCustomId,
  parseJournalDetailCustomId,
} from '../commands/journal-custom-id.js';

describe('journal custom IDs', () => {
  it('round-trips category, detail, and back targets', () => {
    const guildId = 'guild:łódź';

    expect(parseJournalCategoryCustomId(buildJournalCategoryCustomId(guildId, 'npcs'))).toEqual({
      guildId,
      category: 'npcs',
    });
    expect(
      parseJournalDetailCustomId(buildJournalDetailCustomId(guildId, 'lore', 'entry:one')),
    ).toEqual({
      guildId,
      category: 'lore',
      id: 'entry:one',
    });
    expect(parseJournalBackCustomId(buildJournalBackCustomId(guildId))).toEqual({ guildId });
  });

  it.each([
    'other:category:guild:quests',
    'journal:category:guild:unknown',
    'journal:category:guild:quests:extra',
    'journal:category:%E0%A4%A:quests',
  ])('rejects malformed category IDs: %s', (customId) => {
    expect(parseJournalCategoryCustomId(customId)).toBeNull();
  });

  it('rejects incomplete detail and back IDs', () => {
    expect(parseJournalDetailCustomId('journal:detail:guild:quests')).toBeNull();
    expect(parseJournalBackCustomId('journal:back:')).toBeNull();
  });
});
