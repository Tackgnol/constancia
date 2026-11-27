import {
  FIVE_E_ABILITIES,
  FIVE_E_SKILLS,
  ProficiencyTier,
  saveKey,
  type FiveEAbility,
  type FiveESkill,
} from './data.js';

export interface FiveEDerivedStats {
  level: number;
  proficiencyBonus: number;
  abilityModifiers: Record<FiveEAbility, number>;
  saves: Record<FiveEAbility, number>;
  skills: Record<FiveESkill, number>;
  passives: Record<FiveESkill, number>;
}

function readGroup(characterData: Record<string, unknown>, key: string): Record<string, unknown> {
  const group = characterData[key];
  return typeof group === 'object' && group !== null && !Array.isArray(group)
    ? (group as Record<string, unknown>)
    : {};
}

function readNumber(group: Record<string, unknown>, key: string, fallback: number): number {
  const value = group[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** SRD 5.2.1 p. 8: +2 at level 1 rising to +6 at level 17. */
export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((Math.min(20, Math.max(1, level)) - 1) / 4);
}

/** Reads a skill's training tier, treating anything outside 0–2 as untrained. */
export function readProficiencyTier(
  characterData: Record<string, unknown>,
  skill: FiveESkill,
): ProficiencyTier {
  const raw = readNumber(readGroup(characterData, 'skills'), skill, ProficiencyTier.Untrained);
  return raw === ProficiencyTier.Expertise
    ? ProficiencyTier.Expertise
    : raw === ProficiencyTier.Proficient
      ? ProficiencyTier.Proficient
      : ProficiencyTier.Untrained;
}

/** A skill check total with any ability: ability modifier plus proficiency bonus times the training tier. */
export function skillCheckModifier(
  characterData: Record<string, unknown>,
  skill: FiveESkill,
  ability: FiveEAbility,
): number {
  const derived = deriveFiveEStats(characterData);
  return (
    derived.abilityModifiers[ability] +
    derived.proficiencyBonus * readProficiencyTier(characterData, skill)
  );
}

/** Every value the 5E sheet, resolvers and hints show; computed from the stored inputs, never stored. */
export function deriveFiveEStats(characterData: Record<string, unknown>): FiveEDerivedStats {
  const level = readNumber(readGroup(characterData, 'core'), 'level', 1);
  const abilities = readGroup(characterData, 'abilities');
  const saves = readGroup(characterData, 'saves');
  const pb = proficiencyBonus(level);

  const abilityModifiers = Object.fromEntries(
    FIVE_E_ABILITIES.map((ability) => [
      ability.value,
      abilityModifier(readNumber(abilities, ability.value, 10)),
    ]),
  ) as Record<FiveEAbility, number>;

  const saveTotals = Object.fromEntries(
    FIVE_E_ABILITIES.map((ability) => [
      ability.value,
      abilityModifiers[ability.value] + (saves[saveKey(ability.value)] === true ? pb : 0),
    ]),
  ) as Record<FiveEAbility, number>;

  const skillTotals = Object.fromEntries(
    FIVE_E_SKILLS.map((skill) => [
      skill.value,
      abilityModifiers[skill.ability] + pb * readProficiencyTier(characterData, skill.value),
    ]),
  ) as Record<FiveESkill, number>;

  const passives = Object.fromEntries(
    FIVE_E_SKILLS.map((skill) => [skill.value, 10 + skillTotals[skill.value]]),
  ) as Record<FiveESkill, number>;

  return {
    level,
    proficiencyBonus: pb,
    abilityModifiers,
    saves: saveTotals,
    skills: skillTotals,
    passives,
  };
}
