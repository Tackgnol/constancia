import type { FiveENumberInputProps } from './FiveESheet.models';

/** A clamped numeric input styled for the 5E sheet. */
export function FiveENumberInput({
  label,
  value,
  min,
  max,
  disabled,
  className = '',
  onChange,
}: FiveENumberInputProps) {
  return (
    <input
      aria-label={label}
      className={`five-e-num ${className}`}
      type="number"
      min={min}
      max={max}
      value={value}
      disabled={disabled}
      onChange={(event) => {
        const parsed = event.target.valueAsNumber;
        if (Number.isNaN(parsed)) return;
        onChange(Math.max(min, Math.min(max, parsed)));
      }}
    />
  );
}
