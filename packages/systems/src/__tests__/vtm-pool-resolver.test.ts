import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vtmPoolResolverBlock } from '../vtm-v5/pool-resolver.js';
import { rollDice } from '../dice.js';
import type { BlockContext } from '@constancia/contracts';

vi.mock('../dice.js', () => ({ rollDice: vi.fn() }));

const queuedDice: number[] = [];
const rollDiceMock = vi.mocked(rollDice);

/** Queues die faces; the mocked roller hands them out in order. */
function queueDice(...values: number[]): void {
  queuedDice.push(...values);
}

function makeContext(overrides?: Partial<BlockContext>): BlockContext {
  return {
    campaignId: 'campaign-1',
    channelId: 'channel-1',
    playerId: 'player-1',
    characterData: {},
    ...overrides,
  };
}

describe('vtmPoolResolverBlock', () => {
  beforeEach(() => {
    queuedDice.length = 0;
    rollDiceMock.mockReset();
    rollDiceMock.mockImplementation(async (count) => queuedDice.splice(0, count));
  });

  it('returns success for a normal roll with enough successes', async () => {
    // pool=4, hunger=0, default difficulty=1
    // dice: [7, 8, 3, 4] → 2 successes (7 and 8), no 10s, no hungerOnes
    queueDice(7, 8, 3, 4);
    const ctx = makeContext({
      characterData: { attributes: { strength: 2 }, skills: { brawl: 2 } },
    });

    const result = await vtmPoolResolverBlock.execute(
      { attribute: 'strength', skill: 'brawl' },
      ctx,
    );

    const output = result.output as {
      pool: number;
      normalDice: number[];
      hungerDice: number[];
      successes: number;
      critPairs: number;
      hungerOnes: number;
      outcome: string;
      difficulty: number;
    };

    expect(output.pool).toBe(4);
    expect(output.normalDice).toEqual([7, 8, 3, 4]);
    expect(output.hungerDice).toEqual([]);
    expect(output.successes).toBe(2);
    expect(output.critPairs).toBe(0);
    expect(output.hungerOnes).toBe(0);
    expect(output.outcome).toBe('success');
    expect(output.difficulty).toBe(1);
  });

  it('returns critical_success when two 10s are rolled with no hunger', async () => {
    // pool=4, hunger=0, default difficulty=1
    // dice: [10, 10, 3, 4] → base=2 successes, critPairs=1, bonus=+2, total=4, no hunger10s
    queueDice(10, 10, 3, 4);
    const ctx = makeContext({
      characterData: { attributes: { dexterity: 2 }, skills: { firearms: 2 } },
    });

    const result = await vtmPoolResolverBlock.execute(
      { attribute: 'dexterity', skill: 'firearms' },
      ctx,
    );

    const output = result.output as {
      successes: number;
      critPairs: number;
      outcome: string;
    };

    expect(output.critPairs).toBe(1);
    expect(output.successes).toBe(4); // 2 base + 2 bonus
    expect(output.outcome).toBe('critical_success');
  });

  it('returns messy_critical when a crit pair includes a hunger 10', async () => {
    // pool=3, hunger=1 → normalDiceCount=2, hungerDiceCount=1
    // normal dice: [10, 3], hunger dice: [10]
    // normal10s=1, hunger10s=1 → critPairs=1 → messy_critical
    queueDice(10, 3, 10);

    const ctx = makeContext({
      characterData: {
        attributes: { wits: 2 },
        skills: { stealth: 1 },
        hunger: 1,
      },
    });

    const result = await vtmPoolResolverBlock.execute({ attribute: 'wits', skill: 'stealth' }, ctx);

    const output = result.output as {
      critPairs: number;
      outcome: string;
    };

    expect(output.critPairs).toBe(1);
    expect(output.outcome).toBe('messy_critical');
  });

  it('returns failure when no successes and no hunger ones', async () => {
    // pool=3, hunger=0, default difficulty=1
    // dice: [1, 2, 3] → 0 successes
    queueDice(1, 2, 3);
    const ctx = makeContext({
      characterData: { attributes: { intelligence: 1 }, skills: { academics: 2 } },
    });

    const result = await vtmPoolResolverBlock.execute(
      { attribute: 'intelligence', skill: 'academics' },
      ctx,
    );

    const output = result.output as {
      successes: number;
      hungerOnes: number;
      outcome: string;
    };

    expect(output.successes).toBe(0);
    expect(output.hungerOnes).toBe(0);
    expect(output.outcome).toBe('failure');
  });

  it('returns bestial_failure when hunger die shows 1 and no successes', async () => {
    // pool=2, hunger=2 → normalDiceCount=0, hungerDiceCount=2
    // hunger dice: [1, 2] → 0 successes, hungerOnes=1 → bestial_failure
    queueDice(1, 2);
    const ctx = makeContext({
      characterData: {
        attributes: { resolve: 1 },
        skills: { composure: 1 },
        hunger: 2,
      },
    });

    const result = await vtmPoolResolverBlock.execute(
      { attribute: 'resolve', skill: 'composure' },
      ctx,
    );

    const output = result.output as {
      normalDice: number[];
      hungerDice: number[];
      successes: number;
      hungerOnes: number;
      outcome: string;
    };

    expect(output.normalDice).toEqual([]);
    expect(output.hungerDice).toEqual([1, 2]);
    expect(output.successes).toBe(0);
    expect(output.hungerOnes).toBe(1);
    expect(output.outcome).toBe('bestial_failure');
  });

  it('returns immediate failure with empty dice arrays when pool is zero', async () => {
    // Missing attribute/skill → pool=0 → immediate failure, the roller is never called
    const ctx = makeContext({
      characterData: { attributes: {}, skills: {} },
    });

    const result = await vtmPoolResolverBlock.execute(
      { attribute: 'missing_attr', skill: 'missing_skill' },
      ctx,
    );

    const output = result.output as {
      pool: number;
      normalDice: number[];
      hungerDice: number[];
      successes: number;
      outcome: string;
    };

    expect(output.pool).toBe(0);
    expect(output.normalDice).toEqual([]);
    expect(output.hungerDice).toEqual([]);
    expect(output.successes).toBe(0);
    expect(output.outcome).toBe('failure');
    expect(rollDiceMock).not.toHaveBeenCalled();
  });

  it('emits player and channel messages', async () => {
    // pool=2, hunger=0, default difficulty=1, dice: [7, 8]
    queueDice(7, 8);
    const ctx = makeContext({
      characterData: { attributes: { stamina: 1 }, skills: { athletics: 1 } },
    });

    const result = await vtmPoolResolverBlock.execute(
      { attribute: 'stamina', skill: 'athletics' },
      ctx,
    );

    expect(result.messages).toHaveLength(2);

    const playerMsg = result.messages?.find((m: { target: string }) => m.target === 'player');
    const channelMsg = result.messages?.find((m: { target: string }) => m.target === 'channel');

    expect(playerMsg).toBeDefined();
    expect(channelMsg).toBeDefined();
    expect(playerMsg).toMatchObject({ targetId: 'player-1' });

    // Player message should contain key numbers
    expect(playerMsg?.content).toContain('Pool: 2');
    expect(playerMsg?.content).toContain('2'); // successes
    expect(playerMsg?.content).toContain('difficulty 1');
  });

  it('does not target a system pseudo-player when directly executed', async () => {
    const ctx = makeContext({
      playerId: 'system',
      characterData: { attributes: {}, skills: {} },
    });

    const result = await vtmPoolResolverBlock.execute(
      { attribute: 'missing_attr', skill: 'missing_skill' },
      ctx,
    );

    expect(result.messages).toEqual([
      {
        target: 'player',
        content: '🎲 Pool: 0 dice — no dice to roll. Successes: 0 vs difficulty 1 → Failure',
      },
      { target: 'channel', content: '❌ Failure — no dice in pool.' },
    ]);
  });
});
