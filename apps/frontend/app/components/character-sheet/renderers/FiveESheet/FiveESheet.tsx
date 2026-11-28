import { FIVE_E_ABILITIES, ProficiencyTier, deriveFiveEStats } from '@constancia/systems';
import type { SheetRendererProps } from '../types';
import { FiveEAbilityBlock } from './FiveEAbilityBlock';
import { FiveENumberInput } from './FiveENumberInput';
import { TIER_NAMES, readNumberStat, signed, toFiveECharacterData } from './FiveESheet.utils';
import './FiveESheet.styles.css';

const PASSIVES = [
  { key: 'perception', label: 'Perception' },
  { key: 'insight', label: 'Insight' },
  { key: 'investigation', label: 'Investigation' },
] as const;

const TIERS = [ProficiencyTier.Untrained, ProficiencyTier.Proficient, ProficiencyTier.Expertise];

/** The 5E sheet: a header band of vitals and passives, then one block per ability with its save and skills. */
export function FiveESheet({ stats, onChange, disabled }: SheetRendererProps) {
  const derived = deriveFiveEStats(toFiveECharacterData(stats));
  const hpMax = Math.max(1, readNumberStat(stats, 'hpMax', 0));
  const hp = Math.min(hpMax, Math.max(0, readNumberStat(stats, 'hpCurrent', 0)));

  return (
    <div className="five-e-variant five-e-sheet">
      <header className="five-e-c-head">
        <div className="five-e-c-vital">
          <span className="five-e-label">Level</span>
          <FiveENumberInput
            className="five-e-num-display"
            label="Level"
            value={derived.level}
            min={1}
            max={20}
            disabled={disabled}
            onChange={(value) => onChange('level', value)}
          />
        </div>
        <div className="five-e-c-vital">
          <span className="five-e-label">Proficiency</span>
          <strong className="five-e-display">{signed(derived.proficiencyBonus)}</strong>
        </div>
        <div className="five-e-c-vital">
          <span className="five-e-label">Armor class</span>
          <FiveENumberInput
            className="five-e-num-display"
            label="Armor class"
            value={readNumberStat(stats, 'ac', 10)}
            min={0}
            max={40}
            disabled={disabled}
            onChange={(value) => onChange('ac', value)}
          />
        </div>
        <div className="five-e-c-vital five-e-c-hp">
          <span className="five-e-label">Hit points</span>
          <span className="five-e-hp-inputs">
            <FiveENumberInput
              label="Current hit points"
              value={hp}
              min={0}
              max={999}
              disabled={disabled}
              onChange={(value) => onChange('hpCurrent', value)}
            />
            <span className="five-e-quiet">/</span>
            <FiveENumberInput
              label="Maximum hit points"
              value={readNumberStat(stats, 'hpMax', 0)}
              min={0}
              max={999}
              disabled={disabled}
              onChange={(value) => onChange('hpMax', value)}
            />
          </span>
          <meter
            className="five-e-hp-track"
            aria-label="Hit points"
            min={0}
            max={hpMax}
            value={hp}
          />
        </div>
        <dl className="five-e-c-passives">
          {PASSIVES.map((passive) => (
            <div key={passive.key}>
              <dt>Passive {passive.label}</dt>
              <dd>{derived.passives[passive.key]}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="five-e-c-grid">
        {FIVE_E_ABILITIES.map((ability) => (
          <FiveEAbilityBlock
            key={ability.value}
            ability={ability}
            stats={stats}
            derived={derived}
            disabled={disabled}
            onChange={onChange}
          />
        ))}
      </div>

      <p className="five-e-legend">
        {TIERS.map((tier) => (
          <span key={tier}>
            <span className="five-e-pip" data-tier={tier} aria-hidden="true" />
            {tier === ProficiencyTier.Expertise
              ? `${TIER_NAMES[tier]} (double proficiency)`
              : TIER_NAMES[tier]}
          </span>
        ))}
      </p>
    </div>
  );
}
