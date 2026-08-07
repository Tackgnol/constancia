export const CAMPAIGN_DISABLED_FALLBACK = 'This campaign has been suspended. Contact the operator.';

export const USER_BANNED_FALLBACK =
  'Your access to Constancia has been revoked. Contact the operator.';

export class AccessRevokedError extends Error {
  readonly statusCode = 403;
  readonly code = 'ACCESS_REVOKED';

  constructor(message: string) {
    super(message);
    this.name = 'AccessRevokedError';
  }
}

export interface BanLookupPrisma {
  discordUserBan: {
    findUnique(args: {
      where: { discordUserId: string };
      select: { reasonShownToUser: true };
    }): Promise<{ reasonShownToUser: string | null } | null>;
  };
}

export async function assertNotBanned(
  prisma: BanLookupPrisma,
  discordUserId: string,
): Promise<void> {
  const ban = await prisma.discordUserBan.findUnique({
    where: { discordUserId },
    select: { reasonShownToUser: true },
  });

  if (ban !== null) {
    throw new AccessRevokedError(ban.reasonShownToUser ?? USER_BANNED_FALLBACK);
  }
}

export function assertCampaignActive(campaign: {
  disabledAt: Date | null;
  disabledPublicReason: string | null;
}): void {
  if (campaign.disabledAt !== null) {
    throw new AccessRevokedError(campaign.disabledPublicReason ?? CAMPAIGN_DISABLED_FALLBACK);
  }
}
