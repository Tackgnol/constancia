import { createMagicLink } from '@constancia/api-client/endpoints/auth/auth';
import { botRequestOptions } from '../config.js';

export interface MagicLinkRequestInput {
  discordUserId: string;
  guildId: string;
}

export interface MagicLinkRequestResult {
  status: string;
  url: string;
  token: string;
  discordUserId: string;
  guildId: string;
}

export async function requestAdminMagicLink(
  input: MagicLinkRequestInput,
): Promise<MagicLinkRequestResult> {
  const response = await createMagicLink(input, botRequestOptions());
  const payload = response.data as Record<string, unknown> | undefined;

  if (
    !payload ||
    typeof payload.url !== 'string' ||
    typeof payload.token !== 'string' ||
    typeof payload.discordUserId !== 'string' ||
    typeof payload.guildId !== 'string'
  ) {
    throw new Error('Backend returned an invalid magic link payload');
  }

  return {
    status: response.status,
    url: payload.url,
    token: payload.token,
    discordUserId: payload.discordUserId,
    guildId: payload.guildId,
  };
}
