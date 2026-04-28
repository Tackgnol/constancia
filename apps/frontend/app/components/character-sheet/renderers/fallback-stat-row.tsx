import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { StatRowProps } from './types';
import { toNumericValue } from './types';

export function FallbackStatRow({
  field,
  value,
  onChange,
  onBlur,
  disabled,
  error,
  inputId,
}: StatRowProps) {
  if (field.type === 'boolean') {
    return (
      <Checkbox
        id={inputId}
        checked={value === true}
        onCheckedChange={(next) => onChange(next === true)}
        onBlur={onBlur}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
      />
    );
  }

  if (field.type === 'number') {
    return (
      <Input
        id={inputId}
        type="number"
        inputMode="numeric"
        value={toNumericValue(value, 0)}
        min={field.min}
        max={field.max}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        onBlur={onBlur}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === '' ? 0 : Number(raw));
        }}
      />
    );
  }

  return (
    <Input
      id={inputId}
      type="text"
      value={typeof value === 'string' ? value : ''}
      disabled={disabled}
      aria-invalid={error ? true : undefined}
      onBlur={onBlur}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
