import type { GameDate } from '@constancia/contracts';
import type { Prisma } from '@constancia/db';
import {
  formatGameDate,
  gameSystemRegistry,
  parseGameDate,
  validateGameDate,
} from '@constancia/systems';

export function getGameDateValidationError(systemId: string, date: GameDate): string | null {
  const system = gameSystemRegistry.get(systemId);
  if (!system) {
    return `Game system ${systemId} is not registered.`;
  }

  const calendar = system.calendars[date.calendarId];
  if (!calendar) {
    return `Calendar ${date.calendarId} is not available for ${system.name}.`;
  }

  const validation = validateGameDate(calendar, date);
  return validation.valid ? null : validation.message;
}

export function toGameDateJson(date: GameDate): Prisma.InputJsonObject {
  return {
    calendarId: date.calendarId,
    year: date.year,
    monthId: date.monthId,
    day: date.day,
  };
}

export function formatCampaignGameDate(systemId: string, value: unknown): string | null {
  const date = parseGameDate(value);
  if (!date) {
    return null;
  }

  const calendar = gameSystemRegistry.get(systemId)?.calendars[date.calendarId];
  return calendar ? formatGameDate(date, calendar) : null;
}
