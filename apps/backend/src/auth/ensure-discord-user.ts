import { discordUserIdToAuthEmail } from './identity.js';
import { getPrismaClient } from './prisma.js';

function getUploadDefaultEnabled(): boolean {
  return process.env.UPLOAD_DEFAULT_ENABLED === 'true';
}

export interface DiscordUserLookup {
  userId: string;
  email: string;
  created: boolean;
}

// Resolves the Better Auth user bound to a Discord user id, creating one on the
// fly when the Discord user has never signed in before. The (providerId='discord',
// accountId=discordUserId) row is the single source of truth — it lets the bot
// magic-link flow and the native Discord OAuth flow converge on the same user.
export async function ensureDiscordUser(discordUserId: string): Promise<DiscordUserLookup> {
  if (process.env.NODE_ENV === 'test') {
    // The memory adapter used in tests has no Prisma connection. Better Auth's
    // magic-link plugin will auto-create the user on verify.
    return {
      userId: '',
      email: discordUserIdToAuthEmail(discordUserId),
      created: false,
    };
  }

  const prisma = getPrismaClient();
  const email = discordUserIdToAuthEmail(discordUserId);

  const existing = await prisma.account.findUnique({
    where: {
      providerId_accountId: {
        providerId: 'discord',
        accountId: discordUserId,
      },
    },
    select: {
      userId: true,
      user: { select: { email: true } },
    },
  });

  if (existing) {
    return { userId: existing.userId, email: existing.user.email, created: false };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  const linked = await prisma.$transaction(async (tx) => {
    const user =
      existingUser ??
      (await tx.user.upsert({
        where: { email },
        create: {
          email,
          name: `Discord ${discordUserId}`,
          emailVerified: true,
          uploadsEnabled: getUploadDefaultEnabled(),
        },
        // If the synthetic Discord email already exists, reuse it rather than
        // crashing on the unique index. This keeps bot magic-link login and
        // future Discord OAuth/account-linking idempotent.
        update: {
          emailVerified: true,
        },
        select: { id: true, email: true },
      }));

    const account = await tx.account.upsert({
      where: {
        providerId_accountId: {
          providerId: 'discord',
          accountId: discordUserId,
        },
      },
      create: {
        providerId: 'discord',
        accountId: discordUserId,
        userId: user.id,
      },
      update: {},
      select: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return account.user;
  });

  return { userId: linked.id, email: linked.email, created: existingUser === null };
}
