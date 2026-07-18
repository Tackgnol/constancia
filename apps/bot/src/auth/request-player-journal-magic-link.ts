import { botBackend } from '../backend/bot-backend.js';

export interface PlayerJournalMagicLinkRequestInput {
  discordUserId: string;
  guildId: string;
}

export interface PlayerJournalMagicLinkRequestResult {
  status: string;
  url: string;
  token: string;
  discordUserId: string;
  guildId: string;
  campaignId: string;
}

export async function requestPlayerJournalMagicLink(
  input: PlayerJournalMagicLinkRequestInput,
): Promise<PlayerJournalMagicLinkRequestResult> {
  const link = await botBackend.requestPlayerJournalMagicLink(input.discordUserId, input.guildId);
  if (!link.campaignId) {
    throw new Error('Backend returned an invalid player journal magic link payload');
  }
  return { ...link, campaignId: link.campaignId };
}
