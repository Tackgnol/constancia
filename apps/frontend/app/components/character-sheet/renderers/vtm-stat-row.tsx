import { useId } from 'react';
import { FallbackStatRow } from './fallback-stat-row';
import type { StatRowProps } from './types';
import { clampNumeric, toNumericValue } from './types';

const DEFAULT_MAX = 5;

export function VtmStatRow(props: StatRowProps) {
  const labelId = useId();
  if (props.field.type !== 'number') {
    return <FallbackStatRow {...props} />;
  }

  const { field, value, onChange, onBlur, disabled, error, inputId } = props;
  const max = typeof field.max === 'number' ? field.max : DEFAULT_MAX;
  const min = typeof field.min === 'number' ? field.min : 0;
  const current = clampNumeric(toNumericValue(value, min), min, max);
  const pips = Array.from({ length: Math.max(max - min, 0) });

  const commit = (next: number) => {
    const clamped = clampNumeric(next, min, max);
    if (clamped !== current) onChange(clamped);
  };

  const setFromPip = (pipIndex: number) => {
    const pipValue = min + pipIndex + 1;
    if (pipValue === current) {
      commit(min);
    } else {
      commit(pipValue);
    }
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
      className={`stat-pip-row${disabled ? ' is-disabled' : ''}${error ? ' is-invalid' : ''}`}
      id={inputId}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      role="slider"
      tabIndex={disabled ? -1 : 0}
    >
      <span className="stat-pip-row-sr" id={labelId}>
        {field.label}
      </span>
      {pips.map((_, index) => {
        const pipValue = min + index + 1;
        const isFilled = pipValue <= current;
        return (
          <button
            aria-label={`Set ${field.label} to ${pipValue}`}
            className={`stat-pip${isFilled ? ' is-filled' : ''}`}
            disabled={disabled}
            key={pipValue}
            onClick={(event) => {
              event.preventDefault();
              setFromPip(index);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              commit(current - 1);
            }}
            tabIndex={-1}
            type="button"
          />
        );
      })}
      <span aria-hidden="true" className="stat-pip-value">
        {current}
      </span>
    </div>
  );
}
