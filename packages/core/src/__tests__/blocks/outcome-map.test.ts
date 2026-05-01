import { describe, it, expect } from 'vitest';
import { outcomeMapBlock } from '../../blocks/outcome-map.js';
import type { BlockContext } from '@constancia/contracts';

const ctx: BlockContext = {
  campaignId: 'c1',
  channelId: 'ch1',
  playerId: 'p1',
  playerScore: 3,
  characterData: {},
};

describe('OutcomeMap block', () => {
  it('returns the highest threshold outcome below the score by default', async () => {
    const config = {
      outcomes: [
        { threshold: 0, text: 'Critical failure' },
        { threshold: 1, text: 'Partial success' },
        { threshold: 2, text: 'Full success' },
      ],
    };

    const result = await outcomeMapBlock.execute(config, ctx);
    expect(result.messages).toHaveLength(1);
    expect(result.messages?.[0].content).toBe('Full success');
    expect(result.messages?.[0].target).toBe('player');
    expect(result.messages?.[0]).toMatchObject({ targetId: 'p1' });
  });

  it('returns no messages when no outcome matches', async () => {
    const config = {
      outcomes: [{ threshold: 5, text: 'Very high' }],
    };

    const result = await outcomeMapBlock.execute(config, ctx);
    expect(result.messages).toHaveLength(0);
  });

  it('short-circuits: returns only the highest matching threshold', async () => {
    const config = {
      outcomes: [
        { threshold: 0, text: 'Fail' },
        { threshold: 1, text: 'Partial' },
        { threshold: 4, text: 'Full' },
      ],
      shortCircuit: true,
    };

    const ctxWith2 = { ...ctx, playerScore: 2 };
    const result = await outcomeMapBlock.execute(config, ctxWith2);
    expect(result.messages).toHaveLength(1);
    expect(result.messages?.[0].content).toBe('Partial');
  });

  it('non-short-circuit: returns all outcomes up to score', async () => {
    const config = {
      outcomes: [
        { threshold: 0, text: 'Fail' },
        { threshold: 2, text: 'Partial' },
        { threshold: 4, text: 'Full' },
      ],
      shortCircuit: false,
    };

    const ctxWith5 = { ...ctx, playerScore: 5 };
    const result = await outcomeMapBlock.execute(config, ctxWith5);
    expect(result.messages).toHaveLength(3);
    expect(result.messages?.map((message) => message.content)).toEqual(['Fail', 'Partial', 'Full']);
  });
});
