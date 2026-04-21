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
  it('returns the matching outcome for exact score', async () => {
    const config = {
      outcomes: [
        { minScore: 0, maxScore: 0, text: 'Critical failure' },
        { minScore: 1, maxScore: 2, text: 'Partial success' },
        { minScore: 3, maxScore: 5, text: 'Full success' },
      ],
    };

    const result = await outcomeMapBlock.execute(config, ctx);
    expect(result.messages).toHaveLength(1);
    expect(result.messages?.[0].content).toBe('Full success');
    expect(result.messages?.[0].target).toBe('player');
  });

  it('returns no messages when no outcome matches', async () => {
    const config = {
      outcomes: [{ minScore: 5, maxScore: 10, text: 'Very high' }],
    };

    const result = await outcomeMapBlock.execute(config, ctx);
    expect(result.messages).toHaveLength(0);
  });

  it('short-circuits: returns only the closest matching outcome', async () => {
    const config = {
      outcomes: [
        { minScore: 0, maxScore: 1, text: 'Fail' },
        { minScore: 2, maxScore: 3, text: 'Partial' },
        { minScore: 4, maxScore: 6, text: 'Full' },
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
        { minScore: 0, maxScore: 1, text: 'Fail' },
        { minScore: 2, maxScore: 3, text: 'Partial' },
        { minScore: 4, maxScore: 6, text: 'Full' },
      ],
      shortCircuit: false,
    };

    const ctxWith5 = { ...ctx, playerScore: 5 };
    const result = await outcomeMapBlock.execute(config, ctxWith5);
    expect(result.messages).toHaveLength(3);
  });
});
