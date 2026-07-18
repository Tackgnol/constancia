import { useId } from 'react';
import { FallbackStatRow } from './fallback-stat-row';
import type { StatRowProps } from './types';
import { clampNumeric, toNumericValue } from './types';

const DEFAULT_MIN = -3;
const DEFAULT_MAX = 3;

function formatSigned(value: number): string {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

export function MorkBorgStatRow(props: StatRowProps) {
  const labelId = useId();
  if (props.field.type !== 'number') {
    return <FallbackStatRow {...props} />;
  }

  const { field, value, onChange, onBlur, disabled, error, inputId } = props;
  const min = typeof field.min === 'number' ? field.min : DEFAULT_MIN;
  const max = typeof field.max === 'number' ? field.max : DEFAULT_MAX;
  const current = clampNumeric(toNumericValue(value, 0), min, max);
  const options = Array.from({ length: Math.max(max - min + 1, 1) }, (_, i) => min + i);

  const commit = (next: number) => {
    const clamped = clampNumeric(next, min, max);
    if (clamped !== current) onChange(clamped);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      commit(current + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      commit(current - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      commit(min);
    } else if (event.key === 'End') {
      event.preventDefault();
      commit(max);
    }
  };

  return (
    <div
      aria-disabled={disabled}
      aria-invalid={error ? true : undefined}
      aria-labelledby={labelId}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={current}
      className={`stat-segmented${disabled ? ' is-disabled' : ''}${error ? ' is-invalid' : ''}`}
      id={inputId}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      role="slider"
      tabIndex={disabled ? -1 : 0}
    >
      <span className="stat-pip-row-sr" id={labelId}>
        {field.label}
      </span>
      {options.map((option) => (
        <button
          aria-label={`Set ${field.label} to ${formatSigned(option)}`}
          aria-pressed={option === current}
          className={`stat-segment${option === current ? ' is-active' : ''}${option === 0 ? ' is-zero' : ''}`}
          disabled={disabled}
          key={option}
          onClick={(event) => {
            event.preventDefault();
            commit(option);
          }}
          tabIndex={-1}
          type="button"
        >
          {formatSigned(option)}
        </button>
      ))}
    </div>
  );
}
