import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vtmPoolResolverBlock } from '../vtm-v5/pool-resolver.js';
import type { BlockContext } from '@constancia/contracts';

// Math.floor(Math.random() * 10) + 1 == v  ←→  Math.random() returns (v-1)/10
function mockForDie(value: number): number {
  return (value - 1) / 10;
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
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  it('returns success for a normal roll with enough successes', async () => {
    // pool=4, hunger=0, difficulty=2
    // dice: [7, 8, 3, 4] → 2 successes (7 and 8), no 10s, no hungerOnes
    randomSpy
      .mockReturnValueOnce(mockForDie(7))
      .mockReturnValueOnce(mockForDie(8))
      .mockReturnValueOnce(mockForDie(3))
      .mockReturnValueOnce(mockForDie(4));

    const ctx = makeContext({
      characterData: { attributes: { strength: 2 }, skills: { brawl: 2 } },
    });

    const result = await vtmPoolResolverBlock.execute(
      { attribute: 'strength', skill: 'brawl', difficulty: 2 },
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
    expect(output.difficulty).toBe(2);
  });

  it('returns critical_success when two 10s are rolled with no hunger', async () => {
    // pool=4, hunger=0, difficulty=1
    // dice: [10, 10, 3, 4] → base=2 successes, critPairs=1, bonus=+2, total=4, no hunger10s
    randomSpy
      .mockReturnValueOnce(mockForDie(10))
      .mockReturnValueOnce(mockForDie(10))
      .mockReturnValueOnce(mockForDie(3))
      .mockReturnValueOnce(mockForDie(4));

    const ctx = makeContext({
      characterData: { attributes: { dexterity: 2 }, skills: { firearms: 2 } },
    });

    const result = await vtmPoolResolverBlock.execute(
      { attribute: 'dexterity', skill: 'firearms', difficulty: 1 },
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
    randomSpy
      .mockReturnValueOnce(mockForDie(10)) // normal die 1
      .mockReturnValueOnce(mockForDie(3)) // normal die 2
      .mockReturnValueOnce(mockForDie(10)); // hunger die 1

    const ctx = makeContext({
      characterData: {
        attributes: { wits: 2 },
        skills: { stealth: 1 },
        hunger: 1,
      },
    });

    const result = await vtmPoolResolverBlock.execute(
      { attribute: 'wits', skill: 'stealth', difficulty: 1 },
      ctx,
    );

    const output = result.output as {
      critPairs: number;
      outcome: string;
    };

    expect(output.critPairs).toBe(1);
    expect(output.outcome).toBe('messy_critical');
  });

  it('returns failure when no successes and no hunger ones', async () => {
    // pool=3, hunger=0, difficulty=3
    // dice: [1, 2, 3] → 0 successes
    randomSpy
      .mockReturnValueOnce(mockForDie(1))
      .mockReturnValueOnce(mockForDie(2))
      .mockReturnValueOnce(mockForDie(3));

    const ctx = makeContext({
      characterData: { attributes: { intelligence: 1 }, skills: { academics: 2 } },
    });

    const result = await vtmPoolResolverBlock.execute(
      { attribute: 'intelligence', skill: 'academics', difficulty: 3 },
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
    randomSpy.mockReturnValueOnce(mockForDie(1)).mockReturnValueOnce(mockForDie(2));

    const ctx = makeContext({
      characterData: {
        attributes: { resolve: 1 },
        skills: { composure: 1 },
        hunger: 2,
      },
    });

    const result = await vtmPoolResolverBlock.execute(
      { attribute: 'resolve', skill: 'composure', difficulty: 2 },
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
    // Missing attribute/skill → pool=0 → immediate failure, Math.random never called
    const ctx = makeContext({
      characterData: { attributes: {}, skills: {} },
    });

    const result = await vtmPoolResolverBlock.execute(
      { attribute: 'missing_attr', skill: 'missing_skill', difficulty: 2 },
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
    expect(randomSpy).not.toHaveBeenCalled();
  });

  it('emits player and channel messages', async () => {
    // pool=2, hunger=0, difficulty=1, dice: [7, 8]
    randomSpy.mockReturnValueOnce(mockForDie(7)).mockReturnValueOnce(mockForDie(8));

    const ctx = makeContext({
      characterData: { attributes: { stamina: 1 }, skills: { athletics: 1 } },
    });

    const result = await vtmPoolResolverBlock.execute(
      { attribute: 'stamina', skill: 'athletics', difficulty: 1 },
      ctx,
    );

    expect(result.messages).toHaveLength(2);

    const playerMsg = result.messages?.find((m: { target: string }) => m.target === 'player');
    const channelMsg = result.messages?.find((m: { target: string }) => m.target === 'channel');

    expect(playerMsg).toBeDefined();
    expect(channelMsg).toBeDefined();

    // Player message should contain key numbers
    expect(playerMsg?.content).toContain('Pool: 2');
    expect(playerMsg?.content).toContain('2'); // successes
    expect(playerMsg?.content).toContain('difficulty 1');
  });
});
