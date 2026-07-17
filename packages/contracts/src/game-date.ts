export interface GameDate {
  calendarId: string;
  year: number;
  monthId: string;
  day: number;
}

export interface CalendarMonthDefinition {
  name: string;
  shortName: string;
  days: number;
  kind?: 'month' | 'intercalary';
}

export interface CalendarLeapYearRule {
  monthId: string;
  extraDays: number;
  interval: number;
  offset?: number;
  excludeIntervals?: number[];
  includeIntervals?: number[];
}

export interface GameCalendarDefinition {
  id: string;
  name: string;
  months: Record<string, CalendarMonthDefinition>;
  monthOrder: string[];
  weekdays?: string[];
  leapYearRules?: CalendarLeapYearRule[];
}
