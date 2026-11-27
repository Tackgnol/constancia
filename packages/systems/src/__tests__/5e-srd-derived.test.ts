import { describe, expect, it } from 'vitest';
import { ProficiencyTier } from '../5e-srd/data.js';
import {
  abilityModifier,
  deriveFiveEStats,
  proficiencyBonus,
  skillCheckModifier,
} from '../5e-srd/derived.js';
import { gameSystemRegistry } from '../game-system-registry.js';

const rogue = {
  core: { level: 5 },
  abilities: { str: 8, dex: 18, con: 12, int: 13, wis: 11, cha: 14 },
  saves: { dexSave: true, intSave: true },
  skills: {
    stealth: ProficiencyTier.Expertise,
    perception: ProficiencyTier.Proficient,
    insight: ProficiencyTier.Untrained,
  },
};

describe('5E derived values', () => {
  it('computes ability modifiers', () => {
    expect([1, 8, 9, 10, 11, 18, 30].map(abilityModifier)).toEqual([-5, -1, -1, 0, 0, 4, 10]);
  });

  it('computes the proficiency bonus for levels 1 to 20', () => {
    const bonuses = Array.from({ length: 20 }, (_, index) => proficiencyBonus(index + 1));
    expect(bonuses).toEqual([2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6]);
  });

  it('derives saves, skills and passives from the stored inputs', () => {
    const derived = deriveFiveEStats(rogue);

    expect(derived.proficiencyBonus).toBe(3);
    expect(derived.saves.dex).toBe(7);
    expect(derived.saves.str).toBe(-1);
    expect(derived.skills.stealth).toBe(10);
    expect(derived.skills.perception).toBe(3);
    expect(derived.skills.insight).toBe(0);
    expect(derived.passives.perception).toBe(13);
  });

  it('pairs any skill with any ability', () => {
    expect(skillCheckModifier(rogue, 'stealth', 'cha')).toBe(2 + 6);
  });

  it('falls back to defaults for an empty sheet', () => {
    const derived = deriveFiveEStats({});
    expect(derived.level).toBe(1);
    expect(derived.abilityModifiers.str).toBe(0);
    expect(derived.passives.perception).toBe(10);
  });

  it('registers the system without D&D in its name or id', () => {
    const system = gameSystemRegistry.require('5e-srd');
    expect(system.name).toBe('5E (SRD 5.2.1)');
    expect(`${system.id} ${system.name}`).not.toMatch(/D&D|Dungeons/i);
    expect(system.archetypes.map((archetype) => archetype.key)).toEqual(['class', 'species']);
    expect(system.archetypes[0]?.options).toHaveLength(12);
    expect(system.archetypes[1]?.options).toHaveLength(9);
    expect(system.attribution).toContain('SRD 5.2.1');
  });
});
