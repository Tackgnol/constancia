import { VTM_ATTRIBUTES, VTM_SKILLS } from './data.js';

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export type ProgenyVtmCharacterExport = JsonObject & {
  name: string;
  description?: string;
  notes?: string;
  attributes: Record<string, number>;
  skills: Record<string, number>;
  version: number;
  characterVersion?: number;
};

export interface ProgenyVtmSheetImport {
  source: ProgenyVtmCharacterExport;
  gameName: string;
  backstory: string;
  notes: string;
  systemData: JsonObject;
}

export class ProgenyImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProgenyImportError';
  }
}

const MAX_GAME_NAME_LENGTH = 80;
const MAX_LONGFORM_LENGTH = 4_000;
const RESERVED_EXPORT_KEYS = new Set([
  'id',
  'name',
  'description',
  'player',
  'chronicle',
  'notes',
  'attributes',
  'skills',
  'version',
  'characterVersion',
]);
const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneJsonValue(value: unknown, path: string): JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) => cloneJsonValue(entry, `${path}[${index}]`));
  }

  if (isRecord(value)) {
    const result: JsonObject = {};
    for (const [key, entry] of Object.entries(value)) {
      if (!UNSAFE_OBJECT_KEYS.has(key)) {
        result[key] = cloneJsonValue(entry, `${path}.${key}`);
      }
    }
    return result;
  }

  throw new ProgenyImportError(`Progeny field ${path} is not valid JSON data.`);
}

function cloneJsonObject(value: unknown): JsonObject {
  const cloned = cloneJsonValue(value, 'character');
  if (Array.isArray(cloned) || cloned === null || typeof cloned !== 'object') {
    throw new ProgenyImportError('The selected file is not a Progeny character export.');
  }
  return cloned;
}

function readText(
  source: JsonObject,
  key: string,
  { required = false, maxLength }: { required?: boolean; maxLength: number },
): string {
  const value = source[key];
  if (value === undefined && !required) {
    return '';
  }
  if (typeof value !== 'string') {
    throw new ProgenyImportError(`Progeny field ${key} must be text.`);
  }

  const trimmed = value.trim();
  if (required && trimmed.length === 0) {
    throw new ProgenyImportError(`Progeny field ${key} cannot be empty.`);
  }
  if (trimmed.length > maxLength) {
    throw new ProgenyImportError(
      `Progeny field ${key} is too long. The maximum is ${maxLength} characters.`,
    );
  }
  return trimmed;
}

function normalizeStatKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]+/g, '');
}

function normalizeStatGroup(
  source: JsonObject,
  groupKey: 'attributes' | 'skills',
  expectedKeys: readonly string[],
): Record<string, number> {
  const group = source[groupKey];
  if (group === null || Array.isArray(group) || typeof group !== 'object') {
    throw new ProgenyImportError(`Progeny field ${groupKey} must be an object.`);
  }

  const valuesByNormalizedKey = new Map(
    Object.entries(group).map(([key, value]) => [normalizeStatKey(key), value]),
  );
  const normalized: Record<string, number> = {};

  for (const key of expectedKeys) {
    const rawValue = valuesByNormalizedKey.get(normalizeStatKey(key)) ?? 0;
    if (
      typeof rawValue !== 'number' ||
      !Number.isInteger(rawValue) ||
      rawValue < 0 ||
      rawValue > 5
    ) {
      throw new ProgenyImportError(
        `Progeny stat ${groupKey}.${key} must be a whole number from 0 to 5.`,
      );
    }
    normalized[key] = rawValue;
  }

  return normalized;
}

function readExportVersion(source: JsonObject): number {
  const version = source.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ProgenyImportError('The selected file is missing a valid Progeny export version.');
  }
  return version;
}

function readCharacterVersion(source: JsonObject): number | undefined {
  const version = source.characterVersion;
  if (version === undefined) {
    return undefined;
  }
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    throw new ProgenyImportError('Progeny field characterVersion must be a non-negative integer.');
  }
  return version;
}

function buildProgenyMetadata(source: JsonObject, version: number): JsonObject {
  const metadata: JsonObject = {
    source: 'progeny',
    version,
  };

  for (const key of ['id', 'player', 'chronicle', 'characterVersion'] as const) {
    const value = source[key];
    if (value !== undefined) {
      metadata[key] = value;
    }
  }

  return metadata;
}

export function parseProgenyVtmCharacter(value: unknown): ProgenyVtmSheetImport {
  const source = cloneJsonObject(value);
  const gameName = readText(source, 'name', {
    required: true,
    maxLength: MAX_GAME_NAME_LENGTH,
  });
  const backstory = readText(source, 'description', { maxLength: MAX_LONGFORM_LENGTH });
  const notes = readText(source, 'notes', { maxLength: MAX_LONGFORM_LENGTH });
  const version = readExportVersion(source);
  const characterVersion = readCharacterVersion(source);
  const attributes = normalizeStatGroup(
    source,
    'attributes',
    VTM_ATTRIBUTES.map((attribute) => attribute.value),
  );
  const skills = normalizeStatGroup(
    source,
    'skills',
    VTM_SKILLS.map((skill) => skill.value),
  );

  const systemData: JsonObject = {};
  for (const [key, entry] of Object.entries(source)) {
    if (!RESERVED_EXPORT_KEYS.has(key)) {
      systemData[key] = entry;
    }
  }
  systemData.attributes = attributes;
  systemData.skills = skills;
  systemData.progeny = buildProgenyMetadata(source, version);

  const normalizedSource: ProgenyVtmCharacterExport = {
    ...source,
    name: gameName,
    attributes,
    skills,
    version,
    ...(source.description === undefined ? {} : { description: backstory }),
    ...(source.notes === undefined ? {} : { notes }),
    ...(characterVersion === undefined ? {} : { characterVersion }),
  };

  return {
    source: normalizedSource,
    gameName,
    backstory,
    notes,
    systemData,
  };
}
