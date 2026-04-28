import type { StatField } from '@constancia/contracts';

export type StatValue = number | string | boolean;

export interface StatRowProps {
  field: StatField;
  value: StatValue;
  onChange: (value: StatValue) => void;
  onBlur?: () => void;
  disabled?: boolean;
  error?: string;
  inputId: string;
}

export type StatRowComponent = (props: StatRowProps) => React.ReactElement;

export function clampNumeric(value: number, min?: number, max?: number): number {
  let next = value;
  if (typeof min === 'number' && next < min) next = min;
  if (typeof max === 'number' && next > max) next = max;
  return next;
}

export function toNumericValue(value: StatValue | undefined | null, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}
