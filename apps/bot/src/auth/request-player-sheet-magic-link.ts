import { loadBotConfig } from '../config.js';
import { botRequestOptions } from '../config.js';

export interface PlayerSheetMagicLinkRequestInput {
  discordUserId: string;
  guildId: string;
}

export interface PlayerSheetMagicLinkRequestResult {
  status: string;
  url: string;
  token: string;
  discordUserId: string;
  guildId: string;
  campaignId: string;
}

export async function requestPlayerSheetMagicLink(
  input: PlayerSheetMagicLinkRequestInput,
): Promise<PlayerSheetMagicLinkRequestResult> {
  const config = loadBotConfig();
  const response = await fetch(`${config.backendUrl}/api/v1/auth/player-sheet-link`, {
    ...botRequestOptions(config),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(botRequestOptions(config).headers ?? {}),
    },
    body: JSON.stringify(input),
  });
  const body = await response.text();
  const payload = body.length > 0 ? (JSON.parse(body) as { data?: Record<string, unknown> }) : {};
  const data = payload.data;

  if (!response.ok || !data) {
    throw new Error(`Backend returned ${response.status} while requesting a player sheet link`);
  }

  if (
    typeof data.url !== 'string' ||
    typeof data.token !== 'string' ||
    typeof data.discordUserId !== 'string' ||
    typeof data.guildId !== 'string' ||
    typeof data.campaignId !== 'string'
  ) {
    throw new Error('Backend returned an invalid player sheet magic link payload');
  }

  return {
    status: 'ok',
    url: data.url,
    token: data.token,
    discordUserId: data.discordUserId,
    guildId: data.guildId,
    campaignId: data.campaignId,
  };
}
