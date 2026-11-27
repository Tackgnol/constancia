import { FIVE_E_SKILLS, saveKey, ProficiencyTier, type FiveEAbility } from '@constancia/systems';
import { FiveENumberInput } from './FiveENumberInput';
import type { FiveEAbilityBlockProps } from './FiveESheet.models';
import { nextTier, readNumberStat, signed, toTier } from './FiveESheet.utils';
import { TierPip } from './TierPip';

/** One ability: its modifier and score, then its saving throw, then the skills that use it. */
export function FiveEAbilityBlock({
  ability,
  stats,
  derived,
  disabled,
  onChange,
}: FiveEAbilityBlockProps) {
  const key = ability.value as FiveEAbility;
  const saveStatKey = saveKey(key);
  const saveProficient = stats[saveStatKey] === true;
  const skills = FIVE_E_SKILLS.filter((skill) => skill.ability === key);

  return (
    <section className="five-e-c-ability" aria-label={ability.label}>
      <div className="five-e-c-ability-head">
        <h3>{ability.label}</h3>
        <strong className="five-e-c-mod">{signed(derived.abilityModifiers[key])}</strong>
        <label className="five-e-c-score">
          <span className="five-e-label">Score</span>
          <FiveENumberInput
            label={`${ability.label} score`}
            value={readNumberStat(stats, key, 10)}
            min={1}
            max={30}
            disabled={disabled}
            onChange={(value) => onChange(key, value)}
          />
        </label>
      </div>
      <ul className="five-e-c-rows">
        <li className="five-e-c-row is-save">
          <TierPip
            tier={saveProficient ? ProficiencyTier.Proficient : ProficiencyTier.Untrained}
            label={`${ability.label} saving throw`}
            disabled={disabled}
            onCycle={() => onChange(saveStatKey, !saveProficient)}
          />
          <span>Saving throw</span>
          <span className="five-e-total">{signed(derived.saves[key])}</span>
        </li>
        {skills.length === 0 ? (
          <li className="five-e-c-row is-empty">No skills use {ability.label}</li>
        ) : null}
        {skills.map((skill) => {
          const tier = toTier(stats[skill.value]);
          return (
            <li key={skill.value} className="five-e-c-row" data-tier={tier}>
              <TierPip
                tier={tier}
                label={skill.label}
                disabled={disabled}
                onCycle={() => onChange(skill.value, nextTier(tier))}
              />
              <span>{skill.label}</span>
              <span className="five-e-total">{signed(derived.skills[skill.value])}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
