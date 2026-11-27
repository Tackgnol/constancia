import { FIVE_E_STAT_SCHEMA, ProficiencyTier } from '@constancia/systems';
import type { StatValue } from '../types';

/** Rebuilds the nested systemData shape the 5E derive function reads from the sheet's flat stats. */
export function toFiveECharacterData(
  stats: Record<string, StatValue>,
): Record<string, Record<string, StatValue>> {
  return Object.fromEntries(
    FIVE_E_STAT_SCHEMA.groups.map((group) => [
      group.key,
      Object.fromEntries(
        group.fields.flatMap((field) =>
          stats[field.key] === undefined ? [] : [[field.key, stats[field.key]]],
        ),
      ),
    ]),
  );
}

export function signed(value: number): string {
  return value < 0 ? `${value}` : `+${value}`;
}

export function toTier(value: StatValue | undefined): ProficiencyTier {
  return value === ProficiencyTier.Expertise
    ? ProficiencyTier.Expertise
    : value === ProficiencyTier.Proficient
      ? ProficiencyTier.Proficient
      : ProficiencyTier.Untrained;
}

/** Untrained → Proficient → Expertise → Untrained. */
export function nextTier(tier: ProficiencyTier): ProficiencyTier {
  return tier === ProficiencyTier.Untrained
    ? ProficiencyTier.Proficient
    : tier === ProficiencyTier.Proficient
      ? ProficiencyTier.Expertise
      : ProficiencyTier.Untrained;
}

export const TIER_NAMES: Record<ProficiencyTier, string> = {
  [ProficiencyTier.Untrained]: 'Untrained',
  [ProficiencyTier.Proficient]: 'Proficient',
  [ProficiencyTier.Expertise]: 'Expertise',
};

export function readNumberStat(
  stats: Record<string, StatValue>,
  key: string,
  fallback: number,
): number {
  const value = stats[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
