import type { GameCalendarDefinition, GameDate } from '@constancia/contracts';
import { formatGameDate, getCalendarMonthDays, validateGameDate } from '@constancia/systems';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

interface GameDateFormValues {
  monthId: string;
  day: number;
  year: number;
}

interface GameDateControlProps {
  calendar: GameCalendarDefinition;
  value: GameDate | null;
  busy?: boolean;
  error?: string | null;
  onSave: (date: GameDate) => void;
  onDraftChange?: () => void;
}

function defaultValues(
  calendar: GameCalendarDefinition,
  value: GameDate | null,
): GameDateFormValues {
  const today = new Date();
  return {
    monthId: value?.calendarId === calendar.id ? value.monthId : (calendar.monthOrder[0] ?? ''),
    day: value?.calendarId === calendar.id ? value.day : today.getDate(),
    year: value?.calendarId === calendar.id ? value.year : today.getFullYear(),
  };
}

function gameDateKey(value: GameDate | null): string {
  return value ? `${value.calendarId}:${value.year}:${value.monthId}:${value.day}` : 'not-set';
}

export function GameDateControl({ calendar, value, ...props }: GameDateControlProps) {
  return (
    <GameDateControlForm
      key={`${calendar.id}:${gameDateKey(value)}`}
      calendar={calendar}
      value={value}
      {...props}
    />
  );
}

function GameDateControlForm({
  calendar,
  value,
  busy = false,
  error = null,
  onSave,
  onDraftChange,
}: GameDateControlProps) {
  const [isEditing, setIsEditing] = useState(false);
  const schema = useMemo(
    () =>
      z
        .object({
          monthId: z.string().min(1, 'Choose a month or calendar period.'),
          day: z.number().int().min(1, 'Day must be a positive whole number.'),
          year: z.number().int().min(1, 'Year must be a positive whole number.'),
        })
        .superRefine((values, context) => {
          const validation = validateGameDate(calendar, {
            calendarId: calendar.id,
            ...values,
          });
          if (!validation.valid) {
            context.addIssue({ code: 'custom', message: validation.message, path: ['day'] });
          }
        }),
    [calendar],
  );
  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<GameDateFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(calendar, value),
  });
  const monthId = useWatch({ control, name: 'monthId' });
  const year = useWatch({ control, name: 'year' });
  const maxDay = getCalendarMonthDays(calendar, monthId, Number.isInteger(year) ? year : 1) ?? 1;

  if (!isEditing) {
    return (
      <button
        className={`game-date-trigger${value ? '' : ' is-unset'}`}
        onClick={() => setIsEditing(true)}
        type="button"
      >
        <span>Game date</span>
        <strong>{value ? formatGameDate(value, calendar) : 'Set date'}</strong>
      </button>
    );
  }

  return (
    <form
      className="game-date-form"
      onChange={onDraftChange}
      onSubmit={handleSubmit((values) => onSave({ calendarId: calendar.id, ...values }))}
      noValidate
    >
      <div className="game-date-field game-date-month-field">
        <label htmlFor="topbar-game-date-month">Month</label>
        <select id="topbar-game-date-month" {...register('monthId')}>
          {calendar.monthOrder.map((id) => (
            <option key={id} value={id}>
              {calendar.months[id]?.shortName ?? id}
            </option>
          ))}
        </select>
      </div>
      <div className="game-date-field">
        <label htmlFor="topbar-game-date-day">Day</label>
        <input
          id="topbar-game-date-day"
          max={maxDay}
          min={1}
          type="number"
          {...register('day', { valueAsNumber: true })}
        />
      </div>
      <div className="game-date-field game-date-year-field">
        <label htmlFor="topbar-game-date-year">Year</label>
        <input
          id="topbar-game-date-year"
          min={1}
          type="number"
          {...register('year', { valueAsNumber: true })}
        />
      </div>
      <div className="game-date-actions">
        <button disabled={busy} type="submit">
          {busy ? 'Saving' : 'Save'}
        </button>
        <button
          disabled={busy}
          onClick={() => {
            reset(defaultValues(calendar, value));
            setIsEditing(false);
          }}
          type="button"
        >
          Cancel
        </button>
      </div>
      {errors.day?.message || error ? (
        <span className="game-date-error" role="alert">
          {errors.day?.message ?? error}
        </span>
      ) : null}
    </form>
  );
}
