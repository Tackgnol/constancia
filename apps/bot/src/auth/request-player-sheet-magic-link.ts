import { botBackend } from '../backend/bot-backend.js';

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
  const link = await botBackend.requestPlayerSheetMagicLink(input.discordUserId, input.guildId);
  if (!link.campaignId) {
    throw new Error('Backend returned an invalid player sheet magic link payload');
  }
  return { ...link, campaignId: link.campaignId };
}
