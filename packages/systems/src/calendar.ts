import type { CalendarLeapYearRule, GameCalendarDefinition, GameDate } from '@constancia/contracts';

const GREGORIAN_MONTHS = {
  january: { name: 'January', shortName: 'Jan', days: 31 },
  february: { name: 'February', shortName: 'Feb', days: 28 },
  march: { name: 'March', shortName: 'Mar', days: 31 },
  april: { name: 'April', shortName: 'Apr', days: 30 },
  may: { name: 'May', shortName: 'May', days: 31 },
  june: { name: 'June', shortName: 'Jun', days: 30 },
  july: { name: 'July', shortName: 'Jul', days: 31 },
  august: { name: 'August', shortName: 'Aug', days: 31 },
  september: { name: 'September', shortName: 'Sep', days: 30 },
  october: { name: 'October', shortName: 'Oct', days: 31 },
  november: { name: 'November', shortName: 'Nov', days: 30 },
  december: { name: 'December', shortName: 'Dec', days: 31 },
} satisfies GameCalendarDefinition['months'];

export const GREGORIAN_CALENDAR: GameCalendarDefinition = {
  id: 'gregorian',
  name: 'Gregorian calendar',
  months: GREGORIAN_MONTHS,
  monthOrder: Object.keys(GREGORIAN_MONTHS),
  weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  leapYearRules: [
    {
      monthId: 'february',
      extraDays: 1,
      interval: 4,
      excludeIntervals: [100],
      includeIntervals: [400],
    },
  ],
};

function isDivisible(value: number, interval: number): boolean {
  return value % interval === 0;
}

export function leapYearRuleApplies(rule: CalendarLeapYearRule, year: number): boolean {
  const cycleYear = year - (rule.offset ?? 0);
  if (!isDivisible(cycleYear, rule.interval)) {
    return false;
  }

  if (rule.includeIntervals?.some((interval) => isDivisible(cycleYear, interval))) {
    return true;
  }

  return !rule.excludeIntervals?.some((interval) => isDivisible(cycleYear, interval));
}

export function getCalendarMonthDays(
  calendar: GameCalendarDefinition,
  monthId: string,
  year: number,
): number | null {
  const month = calendar.months[monthId];
  if (!month) {
    return null;
  }

  const leapDays = (calendar.leapYearRules ?? [])
    .filter((rule) => rule.monthId === monthId && leapYearRuleApplies(rule, year))
    .reduce((total, rule) => total + rule.extraDays, 0);

  return month.days + leapDays;
}

export type GameDateValidation = { valid: true } | { valid: false; message: string };

export function validateGameDate(
  calendar: GameCalendarDefinition,
  date: GameDate,
): GameDateValidation {
  if (date.calendarId !== calendar.id) {
    return { valid: false, message: `Calendar ${date.calendarId} is not available here.` };
  }

  if (!Number.isInteger(date.year) || date.year < 1) {
    return { valid: false, message: 'Year must be a positive whole number.' };
  }

  if (!calendar.monthOrder.includes(date.monthId) || !calendar.months[date.monthId]) {
    return { valid: false, message: 'Choose a valid calendar month or period.' };
  }

  const days = getCalendarMonthDays(calendar, date.monthId, date.year);
  if (days === null || !Number.isInteger(date.day) || date.day < 1 || date.day > days) {
    return {
      valid: false,
      message: `Day must be between 1 and ${days ?? 1} for the selected period.`,
    };
  }

  return { valid: true };
}

export function formatGameDate(date: GameDate, calendar: GameCalendarDefinition): string {
  const validation = validateGameDate(calendar, date);
  if (!validation.valid) {
    return 'Invalid game date';
  }

  return `${date.day} ${calendar.months[date.monthId]?.name ?? date.monthId} ${date.year}`;
}

export function parseGameDate(value: unknown): GameDate | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  return typeof record.calendarId === 'string' &&
    typeof record.year === 'number' &&
    typeof record.monthId === 'string' &&
    typeof record.day === 'number'
    ? {
        calendarId: record.calendarId,
        year: record.year,
        monthId: record.monthId,
        day: record.day,
      }
    : null;
}
