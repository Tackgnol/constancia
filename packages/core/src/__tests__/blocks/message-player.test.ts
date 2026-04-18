import { describe, it, expect } from 'vitest';
import { messagePlayerBlock } from '../../blocks/message-player.js';
import type { BlockContext } from '@constancia/contracts';

const ctx: BlockContext = {
  campaignId: 'c1',
  channelId: 'ch1',
  playerId: 'p1',
  characterData: {},
};

describe('MessagePlayer block', () => {
  it('sends a message targeted at player', async () => {
    const result = await messagePlayerBlock.execute({ content: 'Hello player' }, ctx);
    expect(result.messages).toHaveLength(1);
    expect(result.messages?.[0].target).toBe('player');
    expect(result.messages?.[0].content).toBe('Hello player');
  });

  it('includes imageUrl when provided', async () => {
    const result = await messagePlayerBlock.execute(
      { content: 'Look', imageUrl: 'http://img.png' },
      ctx,
    );
    expect(result.messages?.[0].imageUrl).toBe('http://img.png');
  });
});
