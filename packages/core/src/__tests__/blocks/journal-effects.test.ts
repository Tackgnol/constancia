import type { BlockContext } from '@constancia/contracts';
import { describe, expect, it } from 'vitest';
import { addJournalEntryBlock } from '../../blocks/add-journal-entry.js';
import { addQuestBlock } from '../../blocks/add-quest.js';

const context: BlockContext = {
  campaignId: 'campaign-1',
  channelId: 'channel-1',
  playerId: 'system',
  characterData: {},
};

describe('journal write blocks', () => {
  it('emits a player-visible journal entry effect for the event channel', async () => {
    const result = await addJournalEntryBlock.execute(
      {
        title: 'The Prince arrives',
        content: 'The court falls silent as the doors open.',
      },
      context,
    );

    expect(result.effects).toEqual([
      {
        kind: 'add-journal-entry',
        title: 'The Prince arrives',
        content: 'The court falls silent as the doors open.',
        visible: true,
        channelId: 'channel-1',
      },
    ]);
  });

  it('emits a player-visible quest effect', async () => {
    const result = await addQuestBlock.execute(
      {
        name: 'Find the missing Harpy',
        description: 'Follow the trail beyond Elysium.',
      },
      context,
    );

    expect(result.effects).toEqual([
      {
        kind: 'add-quest',
        name: 'Find the missing Harpy',
        description: 'Follow the trail beyond Elysium.',
        visible: true,
      },
    ]);
  });
});
