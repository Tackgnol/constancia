import type {
  GameCalendarDefinition,
  GameSystemId,
  StatField,
  StatSchema,
} from '@constancia/contracts';
import { gameSystemRegistry } from './game-system-registry.js';

export interface GameSystemSummary {
  id: GameSystemId;
  name: string;
  version: string;
  defaultCalendarId: string;
  calendars: Record<string, GameCalendarDefinition>;
  attribution?: string;
}

type SystemStatValue = number | string | boolean;

export const GAME_SYSTEM_SUMMARIES: readonly GameSystemSummary[] = gameSystemRegistry
  .list()
  .map(({ id, name, version, defaultCalendarId, calendars, attribution }) => ({
    id,
    name,
    version,
    defaultCalendarId,
    calendars,
    ...(attribution ? { attribution } : {}),
  }));

/** Narrows a raw id or alias (from the database or a request) to its Game System id; throws when unknown. */
export function resolveGameSystemId(systemIdOrAlias: string): GameSystemId {
  return gameSystemRegistry.require(systemIdOrAlias).id;
}

function coerceStatValue(field: StatField, rawValue: unknown): SystemStatValue {
  if (field.type === 'number') {
    const numeric =
      typeof rawValue === 'number'
        ? rawValue
        : typeof rawValue === 'string' && rawValue.trim().length > 0
          ? Number(rawValue)
          : field.defaultValue;
    const value = typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : 0;
    const min = typeof field.min === 'number' ? field.min : value;
    const max = typeof field.max === 'number' ? field.max : value;
    return Math.min(max, Math.max(min, value));
  }

  if (field.type === 'boolean') {
    if (typeof rawValue === 'boolean') {
      return rawValue;
    }

    if (typeof rawValue === 'string') {
      return rawValue === 'true';
    }

    return typeof field.defaultValue === 'boolean' ? field.defaultValue : false;
  }

  if (typeof rawValue === 'string') {
    return rawValue;
  }

  return typeof field.defaultValue === 'string' ? field.defaultValue : '';
}

export function listSupportedGameSystems(): readonly GameSystemSummary[] {
  return GAME_SYSTEM_SUMMARIES;
}

export function getGameSystemSummary(systemId: GameSystemId): GameSystemSummary | null {
  return GAME_SYSTEM_SUMMARIES.find((system) => system.id === systemId) ?? null;
}

export function getStatSchemaForSystem(systemId: GameSystemId): StatSchema {
  return gameSystemRegistry.get(systemId)?.statSchema ?? { groups: [] };
}

export function extractSystemStats(
  systemId: GameSystemId,
  systemData: Record<string, unknown> | null | undefined,
): Record<string, SystemStatValue> {
  const source = systemData ?? {};
  const schema = getStatSchemaForSystem(systemId);

  return Object.fromEntries(
    schema.groups.flatMap((group) => {
      const groupSource =
        typeof source[group.key] === 'object' && source[group.key] !== null
          ? (source[group.key] as Record<string, unknown>)
          : source;

      return group.fields.map((field) => [
        field.key,
        coerceStatValue(field, groupSource[field.key]),
      ]);
    }),
  );
}

export function mergeSystemStats(
  systemId: GameSystemId,
  systemData: Record<string, unknown> | null | undefined,
  statValues: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...(systemData ?? {}) };
  const schema = getStatSchemaForSystem(systemId);

  for (const group of schema.groups) {
    const currentGroup =
      typeof next[group.key] === 'object' && next[group.key] !== null
        ? { ...(next[group.key] as Record<string, unknown>) }
        : {};

    for (const field of group.fields) {
      currentGroup[field.key] =
        typeof statValues[field.key] === 'undefined'
          ? coerceStatValue(field, currentGroup[field.key])
          : coerceStatValue(field, statValues[field.key]);
    }

    next[group.key] = currentGroup;
  }

  return next;
}
