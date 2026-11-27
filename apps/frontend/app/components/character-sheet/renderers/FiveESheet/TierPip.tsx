import type { TierPipProps } from './FiveESheet.models';
import { TIER_NAMES } from './FiveESheet.utils';

/** Three-state proficiency pip: clicking cycles Untrained → Proficient → Expertise. */
export function TierPip({ tier, label, disabled, onCycle }: TierPipProps) {
  return (
    <button
      type="button"
      className="five-e-pip"
      data-tier={tier}
      aria-label={`${label}: ${TIER_NAMES[tier]}. Change`}
      title={TIER_NAMES[tier]}
      disabled={disabled}
      onClick={onCycle}
    />
  );
}
