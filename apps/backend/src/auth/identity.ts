const DISCORD_AUTH_EMAIL_DOMAIN = 'discord.constancia.local';

export function discordUserIdToAuthEmail(discordUserId: string): string {
  return `${discordUserId}@${DISCORD_AUTH_EMAIL_DOMAIN}`;
}

export function authEmailToDiscordUserId(email: string): string | null {
  const [discordUserId, domain] = email.split('@');

  if (!discordUserId || domain !== DISCORD_AUTH_EMAIL_DOMAIN) {
    return null;
  }

  return discordUserId;
}
