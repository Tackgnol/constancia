import type { StatField, StatSchema } from '@constancia/contracts';
import { MB_STAT_SCHEMA } from './mork-borg/data.js';
import { VTM_STAT_SCHEMA } from './vtm-v5/data.js';

export interface GameSystemSummary {
  id: string;
  name: string;
  version: string;
}

type SystemStatValue = number | string | boolean;

const DEFAULT_SYSTEM_SUMMARY_VERSION = '0.1.0';

export const GAME_SYSTEM_SUMMARIES: readonly GameSystemSummary[] = [
  {
    id: 'vtm-v5',
    name: 'Vampire: The Masquerade 5th Edition',
    version: DEFAULT_SYSTEM_SUMMARY_VERSION,
  },
  {
    id: 'mork-borg',
    name: 'Mork Borg',
    version: DEFAULT_SYSTEM_SUMMARY_VERSION,
  },
] as const;

const GAME_SYSTEM_STAT_SCHEMAS: Record<string, StatSchema> = {
  'vtm-v5': VTM_STAT_SCHEMA,
  'mork-borg': MB_STAT_SCHEMA,
};

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

export function getGameSystemSummary(systemId: string): GameSystemSummary | null {
  return GAME_SYSTEM_SUMMARIES.find((system) => system.id === systemId) ?? null;
}

export function getStatSchemaForSystem(systemId: string): StatSchema {
  return GAME_SYSTEM_STAT_SCHEMAS[systemId] ?? { groups: [] };
}

export function extractSystemStats(
  systemId: string,
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
  systemId: string,
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
