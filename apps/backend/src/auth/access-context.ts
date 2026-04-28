import type { auth } from '../auth.js';
import { getPrismaClient } from './prisma.js';

export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export interface SessionAccessContext {
  kind: 'session';
  userId: string;
  email: string | null;
  discordUserId: string | null;
}

export interface BotAccessContext {
  kind: 'bot';
}

export type AccessContext = SessionAccessContext | BotAccessContext;

export type DiscordAccountLookup = (userId: string) => Promise<string | null>;

async function lookupDiscordAccountUserId(userId: string): Promise<string | null> {
  if (process.env.NODE_ENV === 'test') {
    // Tests use the in-memory adapter, which does not expose the account table
    // through Prisma. Fall back to "no linked Discord account" for these runs.
    return null;
  }

  const prisma = getPrismaClient();
  const account = await prisma.account.findFirst({
    where: {
      userId,
      providerId: 'discord',
    },
    select: {
      accountId: true,
    },
  });

  return account?.accountId ?? null;
}

export async function resolveDiscordUserIdForSession(
  session: AuthSession,
  lookupDiscordAccount: DiscordAccountLookup = lookupDiscordAccountUserId,
): Promise<string | null> {
  return lookupDiscordAccount(session.user.id);
}

export async function createSessionAccessContext(
  session: AuthSession,
  lookupDiscordAccount: DiscordAccountLookup = lookupDiscordAccountUserId,
): Promise<SessionAccessContext> {
  const email = typeof session.user.email === 'string' ? session.user.email : null;

  return {
    kind: 'session',
    userId: session.user.id,
    email,
    discordUserId: await resolveDiscordUserIdForSession(session, lookupDiscordAccount),
  };
}

export function createBotAccessContext(): BotAccessContext {
  return {
    kind: 'bot',
  };
}
