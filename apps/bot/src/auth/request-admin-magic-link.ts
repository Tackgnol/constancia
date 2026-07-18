import { botBackend, type BotMagicLink } from '../backend/bot-backend.js';

export interface MagicLinkRequestInput {
  discordUserId: string;
  guildId: string;
}

export type MagicLinkRequestResult = BotMagicLink;

export async function requestAdminMagicLink(
  input: MagicLinkRequestInput,
): Promise<MagicLinkRequestResult> {
  return botBackend.requestAdminMagicLink(input.discordUserId, input.guildId);
}
