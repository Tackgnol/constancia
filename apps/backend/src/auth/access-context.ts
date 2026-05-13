import type { auth } from '../auth.js';
import { getPrismaClient } from './prisma.js';

export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export interface SessionAccessContext {
  kind: 'session';
  userId: string;
  email: string | null;
  discordUserId: string | null;
  isSuperUser: boolean;
}

export interface BotAccessContext {
  kind: 'bot';
}

export type AccessContext = SessionAccessContext | BotAccessContext;

export type DiscordAccountLookup = (userId: string) => Promise<string | null>;
export type SuperUserLookup = (userId: string) => Promise<boolean>;

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

async function lookupIsSuperUser(userId: string): Promise<boolean> {
  if (process.env.NODE_ENV === 'test') {
    return false;
  }

  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperUser: true },
  });

  return user?.isSuperUser ?? false;
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
  lookupSuperUser: SuperUserLookup = lookupIsSuperUser,
): Promise<SessionAccessContext> {
  const email = typeof session.user.email === 'string' ? session.user.email : null;

  return {
    kind: 'session',
    userId: session.user.id,
    email,
    discordUserId: await resolveDiscordUserIdForSession(session, lookupDiscordAccount),
    isSuperUser: await lookupSuperUser(session.user.id),
  };
}

export function createBotAccessContext(): BotAccessContext {
  return {
    kind: 'bot',
  };
}
