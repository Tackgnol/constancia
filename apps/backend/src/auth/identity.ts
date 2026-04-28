const DISCORD_AUTH_EMAIL_DOMAIN = 'discord.constancia.local';

// Synthetic email used as a profile placeholder for users created via the bot
// magic-link flow before they have ever signed in with Discord OAuth. Identity
// is keyed off the account table (providerId='discord'), not this email.
export function discordUserIdToAuthEmail(discordUserId: string): string {
  return `${discordUserId}@${DISCORD_AUTH_EMAIL_DOMAIN}`;
}
