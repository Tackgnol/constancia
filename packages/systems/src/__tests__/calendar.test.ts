import type { GameCalendarDefinition } from '@constancia/contracts';
import { describe, expect, it } from 'vitest';
import {
  GREGORIAN_CALENDAR,
  formatGameDate,
  getCalendarMonthDays,
  validateGameDate,
} from '../calendar.js';

describe('game calendars', () => {
  it('applies Gregorian leap-year exclusions and re-inclusions', () => {
    expect(getCalendarMonthDays(GREGORIAN_CALENDAR, 'february', 2024)).toBe(29);
    expect(getCalendarMonthDays(GREGORIAN_CALENDAR, 'february', 2100)).toBe(28);
    expect(getCalendarMonthDays(GREGORIAN_CALENDAR, 'february', 2000)).toBe(29);
  });

  it('formats and validates a Gregorian game date', () => {
    const date = { calendarId: 'gregorian', year: 2026, monthId: 'july', day: 17 };

    expect(validateGameDate(GREGORIAN_CALENDAR, date)).toEqual({ valid: true });
    expect(formatGameDate(date, GREGORIAN_CALENDAR)).toBe('17 July 2026');
  });

  it('supports a dictionary calendar with an intercalary leap period', () => {
    const calendar: GameCalendarDefinition = {
      id: 'harptos-like',
      name: 'Harptos-like calendar',
      months: {
        midsummer: {
          name: 'Midsummer',
          shortName: 'Mid',
          days: 1,
          kind: 'intercalary',
        },
      },
      monthOrder: ['midsummer'],
      leapYearRules: [{ monthId: 'midsummer', extraDays: 1, interval: 4 }],
    };

    expect(getCalendarMonthDays(calendar, 'midsummer', 3)).toBe(1);
    expect(getCalendarMonthDays(calendar, 'midsummer', 4)).toBe(2);
  });
});
