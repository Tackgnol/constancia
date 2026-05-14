import type { StatSchema } from '@constancia/contracts';
import { getApiBaseUrl } from './api-url';

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

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function readSheetResponse(response: Response): Promise<CharacterSheetData> {
  const payloadText = await response.text();
  const payload =
    payloadText.length > 0 ? (JSON.parse(payloadText) as { data?: unknown; message?: string }) : {};

  if (!response.ok || !payload.data) {
    throw new ApiRequestError(
      payload.message || `Sheet request failed with status ${response.status}`,
      response.status,
    );
  }

  return payload.data as CharacterSheetData;
}

export async function getCharacterSheet(
  campaignId: string,
  charId: string,
  options?: RequestInit,
): Promise<CharacterSheetData> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/campaigns/${campaignId}/characters/${charId}/sheet`,
    {
      ...options,
      method: 'GET',
    },
  );

  return readSheetResponse(response);
}

export async function updateCharacterSheet(
  campaignId: string,
  charId: string,
  body: CharacterSheetPatchBody,
  options?: RequestInit,
): Promise<CharacterSheetData> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/campaigns/${campaignId}/characters/${charId}/sheet`,
    {
      ...options,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    },
  );

  return readSheetResponse(response);
}

export async function getPlayerCharacterSheet(
  campaignId: string,
  options?: RequestInit,
): Promise<CharacterSheetData> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/campaigns/${campaignId}/player-character/sheet`,
    {
      ...options,
      method: 'GET',
    },
  );

  return readSheetResponse(response);
}

export async function updatePlayerCharacterSheet(
  campaignId: string,
  body: CharacterSheetPatchBody,
  options?: RequestInit,
): Promise<CharacterSheetData> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/campaigns/${campaignId}/player-character/sheet`,
    {
      ...options,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    },
  );

  return readSheetResponse(response);
}
