import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlockContext } from '@constancia/contracts';
import { rollDice } from '../dice.js';
import { ProficiencyTier } from '../5e-srd/data.js';
import {
  fiveEInsightResolverBlock,
  fiveEModifierHint,
  fiveEPassiveScore,
  fiveETestResolverBlock,
} from '../5e-srd/resolvers.js';

vi.mock('../dice.js', () => ({ rollDice: vi.fn() }));

const rollDiceMock = vi.mocked(rollDice);

const characterData = {
  core: { level: 5 },
  abilities: { str: 8, dex: 16, con: 12, int: 10, wis: 14, cha: 10 },
  saves: { dexSave: true },
  skills: { stealth: ProficiencyTier.Expertise, perception: ProficiencyTier.Proficient },
};

function ctx(overrides?: Partial<BlockContext>): BlockContext {
  return {
    campaignId: 'campaign-1',
    channelId: 'channel-1',
    playerId: 'player-1',
    characterData,
    ...overrides,
  };
}

beforeEach(() => {
  rollDiceMock.mockReset();
});

describe('5E test-resolver', () => {
  it('adds the ability modifier and doubled proficiency for an expert skill check', async () => {
    rollDiceMock.mockResolvedValue([12]);

    const result = await fiveETestResolverBlock.execute(
      { mode: 'check', ability: 'dex', skill: 'stealth' },
      ctx(),
    );

    expect(rollDiceMock).toHaveBeenCalledWith(1, 20);
    expect(result.playerScore).toBe(12 + 3 + 6);
    expect(result.messages?.[0]?.content).toBe('🎲 d20 [12] +3 DEX +6 prof = 21');
  });

  it('uses save proficiency for a saving throw', async () => {
    rollDiceMock.mockResolvedValue([5]);

    const proficient = await fiveETestResolverBlock.execute(
      { mode: 'save', ability: 'dex' },
      ctx(),
    );
    rollDiceMock.mockResolvedValue([5]);
    const untrained = await fiveETestResolverBlock.execute({ mode: 'save', ability: 'str' }, ctx());

    expect(proficient.playerScore).toBe(5 + 3 + 3);
    expect(untrained.playerScore).toBe(5 - 1);
    expect(untrained.messages?.[0]?.content).toBe('🎲 d20 [5] -1 STR = 4');
  });

  it('keeps the higher die with advantage and the lower with disadvantage', async () => {
    rollDiceMock.mockResolvedValue([12, 7]);
    const advantage = await fiveETestResolverBlock.execute(
      { mode: 'check', ability: 'wis', skill: 'perception' },
      ctx({ rollModifiers: { mode: 'advantage' } }),
    );
    rollDiceMock.mockResolvedValue([12, 7]);
    const disadvantage = await fiveETestResolverBlock.execute(
      { mode: 'check', ability: 'wis', skill: 'perception' },
      ctx({ rollModifiers: { mode: 'disadvantage' } }),
    );

    expect(rollDiceMock).toHaveBeenCalledWith(2, 20);
    expect(advantage.playerScore).toBe(12 + 2 + 3);
    expect(advantage.messages?.[0]?.content).toBe('🎲 d20 [12, 7] advantage +2 WIS +3 prof = 17');
    expect(disadvantage.playerScore).toBe(7 + 2 + 3);
  });

  it('treats natural 1s and 20s as plain numbers', async () => {
    rollDiceMock.mockResolvedValue([20]);
    const result = await fiveETestResolverBlock.execute({ mode: 'check', ability: 'str' }, ctx());
    expect(result.playerScore).toBe(19);
  });
});

describe('5E insight-resolver', () => {
  it('scores 10 plus the modifier, with no advantage bonus', async () => {
    expect(fiveEPassiveScore({ ability: 'wis', skill: 'perception' }, characterData)).toBe(15);
    expect(fiveEPassiveScore({ ability: 'wis' }, characterData)).toBe(12);

    const result = await fiveEInsightResolverBlock.execute(
      { ability: 'wis', skill: 'perception' },
      ctx({ rollModifiers: { mode: 'advantage' } }),
    );
    expect(result.playerScore).toBe(15);
  });
});

describe('5E modifier hint', () => {
  it("names the player's modifier for the Test", () => {
    expect(
      fiveEModifierHint({ mode: 'check', ability: 'dex', skill: 'stealth' }, characterData),
    ).toBe('Your **Dexterity (Stealth): +9**.');
    expect(fiveEModifierHint({ mode: 'save', ability: 'dex' }, characterData)).toBe(
      'Your **Dexterity save: +6**.',
    );
    expect(fiveEModifierHint({ mode: 'check', ability: 'str' }, characterData)).toBe(
      'Your **Strength: -1**.',
    );
    expect(fiveEModifierHint({ mode: 'check' }, characterData)).toBeNull();
  });
});
