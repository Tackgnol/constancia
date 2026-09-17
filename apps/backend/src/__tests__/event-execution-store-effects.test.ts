import { describe, expect, it, vi } from 'vitest';
import { applyBlockEffect } from '../services/event-execution-store.js';

function createTransaction() {
  return {
    campaign: {
      findUniqueOrThrow: vi.fn(async () => ({
        gameDate: { calendarId: 'gregorian', year: 2026, monthId: 'july', day: 17 },
      })),
    },
    quest: { create: vi.fn(async () => ({ id: 'quest-1' })) },
    sessionSummary: { create: vi.fn(async () => ({ id: 'summary-1' })) },
    character: { findUniqueOrThrow: vi.fn(async () => ({ id: 'character-1' })) },
    loreKnowledge: { createMany: vi.fn(async () => ({ count: 1 })) },
    npcKnowledge: { createMany: vi.fn(async () => ({ count: 1 })) },
  };
}

describe('Event execution block effects', () => {
  it('writes a quest into the event campaign', async () => {
    const transaction = createTransaction();

    await applyBlockEffect(transaction, 'campaign-1', {
      kind: 'add-quest',
      name: 'Find the missing Harpy',
      description: 'Follow the trail beyond Elysium.',
      visible: true,
    });

    expect(transaction.quest.create).toHaveBeenCalledWith({
      data: {
        name: 'Find the missing Harpy',
        description: 'Follow the trail beyond Elysium.',
        campaignId: 'campaign-1',
        visible: true,
      },
    });
    expect(transaction.sessionSummary.create).not.toHaveBeenCalled();
  });

  it('writes a journal entry into the event campaign and channel', async () => {
    const transaction = createTransaction();

    await applyBlockEffect(transaction, 'campaign-1', {
      kind: 'add-journal-entry',
      title: 'The Prince arrives',
      content: 'The court falls silent as the doors open.',
      visible: true,
      channelId: 'channel-1',
    });

    expect(transaction.sessionSummary.create).toHaveBeenCalledWith({
      data: {
        title: 'The Prince arrives',
        content: 'The court falls silent as the doors open.',
        campaignId: 'campaign-1',
        sessionDate: expect.any(Date),
        gameDate: { calendarId: 'gregorian', year: 2026, monthId: 'july', day: 17 },
        visible: true,
        channelId: 'channel-1',
      },
    });
    expect(transaction.quest.create).not.toHaveBeenCalled();
    expect(transaction.campaign.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'campaign-1' },
      select: { gameDate: true },
    });
  });

  it('grants a Lore entry to the resolved character, deduplicating on repeat', async () => {
    const transaction = createTransaction();

    await applyBlockEffect(transaction, 'campaign-1', {
      kind: 'grant-lore-entry',
      loreEntryId: 'lore-1',
      discordUserId: 'discord-player',
    });

    expect(transaction.character.findUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        discordUserId_campaignId: { discordUserId: 'discord-player', campaignId: 'campaign-1' },
      },
      select: { id: true },
    });
    expect(transaction.loreKnowledge.createMany).toHaveBeenCalledWith({
      data: [{ characterId: 'character-1', loreEntryId: 'lore-1' }],
      skipDuplicates: true,
    });
  });

  it('grants an NPC fact to the resolved character, deduplicating on repeat', async () => {
    const transaction = createTransaction();

    await applyBlockEffect(transaction, 'campaign-1', {
      kind: 'grant-npc-fact',
      npcFactId: 'fact-1',
      discordUserId: 'discord-player',
    });

    expect(transaction.npcKnowledge.createMany).toHaveBeenCalledWith({
      data: [{ characterId: 'character-1', npcFactId: 'fact-1' }],
      skipDuplicates: true,
    });
  });
});
