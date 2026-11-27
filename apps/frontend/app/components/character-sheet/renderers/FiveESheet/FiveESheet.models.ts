import type { FiveEDerivedStats, ProficiencyTier } from '@constancia/systems';
import type { StatValue } from '../types';

export interface TierPipProps {
  tier: ProficiencyTier;
  label: string;
  disabled?: boolean;
  onCycle?: () => void;
}

export interface FiveENumberInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  className?: string;
  onChange: (value: number) => void;
}

export interface FiveEAbilityBlockProps {
  ability: { value: string; label: string };
  stats: Record<string, StatValue>;
  derived: FiveEDerivedStats;
  disabled?: boolean;
  onChange: (key: string, value: StatValue) => void;
}
