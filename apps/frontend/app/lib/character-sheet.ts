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

function getApiBaseUrl() {
  return import.meta.env.SSR
    ? (process.env.BACKEND_URL ?? 'http://backend:3000')
    : (import.meta.env.VITE_API_URL ?? 'http://localhost:3001');
}

async function readSheetResponse(response: Response): Promise<CharacterSheetData> {
  const payloadText = await response.text();
  const payload = payloadText.length > 0 ? (JSON.parse(payloadText) as { data?: unknown }) : {};

  if (!response.ok || !payload.data) {
    throw new Error(`Sheet request failed with status ${response.status}`);
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
