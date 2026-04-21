import { describe, it, expect } from 'vitest';
import { messageGroupBlock } from '../../blocks/message-group.js';

describe('MessageGroup block', () => {
  it('emits one structured group message when ids are provided as an array', async () => {
    const result = await messageGroupBlock.execute(
      { content: 'To the scouts', groupPlayerIds: ['p2', 'p3'] },
      {
        campaignId: 'c1',
        channelId: 'ch1',
        playerId: 'p1',
        characterData: {},
      },
    );

    expect(result.messages).toEqual([
      {
        target: 'group',
        targetIds: ['p2', 'p3'],
        content: 'To the scouts',
        imageUrl: undefined,
      },
    ]);
  });

  it('remains backward compatible with comma-separated ids', async () => {
    const result = await messageGroupBlock.execute(
      { content: 'Legacy ids', groupPlayerIds: 'p2, p3' },
      {
        campaignId: 'c1',
        channelId: 'ch1',
        playerId: 'p1',
        characterData: {},
      },
    );

    expect(result.messages?.[0]).toMatchObject({
      target: 'group',
      targetIds: ['p2', 'p3'],
      content: 'Legacy ids',
    });
  });

  it('emits no messages when no recipients are configured', async () => {
    const result = await messageGroupBlock.execute(
      { content: 'Nobody hears this' },
      {
        campaignId: 'c1',
        channelId: 'ch1',
        playerId: 'p1',
        characterData: {},
      },
    );

    expect(result.messages).toEqual([]);
  });
});

