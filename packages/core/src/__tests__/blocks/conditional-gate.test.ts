import { describe, it, expect } from 'vitest';
import { conditionalGateBlock } from '../../blocks/conditional-gate.js';
import type { BlockContext } from '@constancia/contracts';

describe('ConditionalGate block', () => {
  it('passes when stat meets threshold', async () => {
    const ctx: BlockContext = {
      campaignId: 'c1',
      channelId: 'ch1',
      playerId: 'p1',
      characterData: { occult: 4 },
    };

    const config = { statPath: 'occult', operator: 'gte' as const, threshold: 4 };
    const result = await conditionalGateBlock.execute(config, ctx);
    expect(result.halt).toBeFalsy();
  });

  it('halts when stat below threshold', async () => {
    const ctx: BlockContext = {
      campaignId: 'c1',
      channelId: 'ch1',
      playerId: 'p1',
      characterData: { occult: 2 },
    };

    const config = { statPath: 'occult', operator: 'gte' as const, threshold: 4 };
    const result = await conditionalGateBlock.execute(config, ctx);
    expect(result.halt).toBe(true);
  });

  it('supports nested stat paths', async () => {
    const ctx: BlockContext = {
      campaignId: 'c1',
      channelId: 'ch1',
      playerId: 'p1',
      characterData: { attributes: { wits: 3 } },
    };

    const config = { statPath: 'attributes.wits', operator: 'gte' as const, threshold: 3 };
    const result = await conditionalGateBlock.execute(config, ctx);
    expect(result.halt).toBeFalsy();
  });
});
