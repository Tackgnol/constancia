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
  it('falls back to ctx.playerId when playerIds is omitted', async () => {
    const result = await messagePlayerBlock.execute({ content: 'Hello player' }, ctx);
    expect(result.messages).toHaveLength(1);
    expect(result.messages?.[0].target).toBe('player');
    expect((result.messages?.[0] as { targetId?: string }).targetId).toBe('p1');
    expect(result.messages?.[0].content).toBe('Hello player');
  });

  it('falls back to ctx.playerId when playerIds is an empty string', async () => {
    const result = await messagePlayerBlock.execute({ content: 'Hello', playerIds: '' }, ctx);
    expect(result.messages).toHaveLength(1);
    expect((result.messages?.[0] as { targetId?: string }).targetId).toBe('p1');
  });

  it('fans out one message per player ID in playerIds', async () => {
    const result = await messagePlayerBlock.execute(
      { content: 'To many', playerIds: 'p2, p3, p4' },
      ctx,
    );
    expect(result.messages).toHaveLength(3);
    const ids = result.messages!.map((m) => (m as { targetId?: string }).targetId);
    expect(ids).toEqual(['p2', 'p3', 'p4']);
    result.messages!.forEach((m) => {
      expect(m.target).toBe('player');
      expect(m.content).toBe('To many');
    });
  });

  it('includes imageUrl when provided', async () => {
    const result = await messagePlayerBlock.execute(
      { content: 'Look', imageUrl: 'http://img.png', playerIds: 'p2' },
      ctx,
    );
    expect(result.messages?.[0].imageUrl).toBe('http://img.png');
  });
});
