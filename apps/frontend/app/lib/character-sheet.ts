import type { StatSchema } from '@constancia/contracts';

export interface CharacterSheetData {
  character: {
    id: string;
    name: string;
    discordName: string;
    gameName: string;
    discordUserId: string;
    campaignId: string;
    backstory: string;
    notes: string;
    systemData: Record<string, unknown>;
  };
  campaign: {
    id: string;
    name: string;
    discordGuildId: string;
    gameSystemId: string;
  };
  system: {
    id: string;
    name: string;
    version: string;
    statSchema: StatSchema;
  };
  stats: Record<string, string | number | boolean>;
  access: {
    mode: 'gm' | 'player';
    canEdit: boolean;
  };
}

export interface CharacterSheetPatchBody {
  gameName: string;
  backstory: string;
  notes: string;
  stats: Record<string, string | number | boolean>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPrimitiveStatValue(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function isStatsRecord(value: unknown): value is Record<string, string | number | boolean> {
  return isRecord(value) && Object.values(value).every(isPrimitiveStatValue);
}

export function isCharacterSheetPatchBody(value: unknown): value is CharacterSheetPatchBody {
  return (
    isRecord(value) &&
    typeof value.gameName === 'string' &&
    typeof value.backstory === 'string' &&
    typeof value.notes === 'string' &&
    isStatsRecord(value.stats)
  );
}

function isCharacterSheetData(value: unknown): value is CharacterSheetData {
  if (!isRecord(value)) {
    return false;
  }

  const { character, campaign, system, stats, access } = value;
  return (
    isRecord(character) &&
    typeof character.id === 'string' &&
    typeof character.name === 'string' &&
    typeof character.discordName === 'string' &&
    typeof character.gameName === 'string' &&
    typeof character.discordUserId === 'string' &&
    typeof character.campaignId === 'string' &&
    typeof character.backstory === 'string' &&
    typeof character.notes === 'string' &&
    isRecord(character.systemData) &&
    isRecord(campaign) &&
    typeof campaign.id === 'string' &&
    typeof campaign.name === 'string' &&
    typeof campaign.discordGuildId === 'string' &&
    typeof campaign.gameSystemId === 'string' &&
    isRecord(system) &&
    typeof system.id === 'string' &&
    typeof system.name === 'string' &&
    typeof system.version === 'string' &&
    isRecord(system.statSchema) &&
    isStatsRecord(stats) &&
    isRecord(access) &&
    (access.mode === 'gm' || access.mode === 'player') &&
    typeof access.canEdit === 'boolean'
  );
}

export function parseCharacterSheetPatchPayload(
  input: FormDataEntryValue | null,
): CharacterSheetPatchBody | null {
  if (typeof input !== 'string' || input.length === 0) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(input);
    return isCharacterSheetPatchBody(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readCharacterSheetData(data: unknown): CharacterSheetData {
  if (!isCharacterSheetData(data)) {
    throw new Error('The backend returned an invalid character sheet.');
  }

  return data;
}
