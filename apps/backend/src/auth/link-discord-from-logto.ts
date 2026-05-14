import type { PrismaClient } from '@constancia/db';
import { getPrismaClient } from './prisma.js';
import {
  mergeDiscordShadowUser,
  type MergeDiscordShadowUserResult,
} from './merge-discord-shadow-user.js';
import { readLogtoDiscordUserIdFromTokens } from './logto-profile.js';

interface LinkDiscordLogger {
  warn: (payload: Record<string, unknown>, message: string) => void;
}

export interface LinkDiscordFromLogtoInput {
  prisma?: PrismaClient;
  logger?: LinkDiscordLogger;
  logtoUserId: string;
  logtoAccountId: string;
  discordUserId: string | null;
}

export type LinkDiscordFromLogtoResult =
  | { status: 'no-discord-claim'; logtoUserId: string; logtoAccountId: string }
  | { status: 'linked'; logtoUserId: string; discordUserId: string }
  | { status: 'noop'; logtoUserId: string; discordUserId: string }
  | MergeDiscordShadowUserResult;

export async function linkDiscordFromLogto({
  prisma = getPrismaClient(),
  logger = console,
  logtoUserId,
  logtoAccountId,
  discordUserId,
}: LinkDiscordFromLogtoInput): Promise<LinkDiscordFromLogtoResult> {
  if (!discordUserId) {
    return { status: 'no-discord-claim', logtoUserId, logtoAccountId };
  }

  const existingDiscordAccount = await prisma.account.findUnique({
    where: {
      providerId_accountId: {
        providerId: 'discord',
        accountId: discordUserId,
      },
    },
    select: { userId: true },
  });

  if (!existingDiscordAccount) {
    await prisma.account.create({
      data: {
        providerId: 'discord',
        accountId: discordUserId,
        userId: logtoUserId,
      },
    });

    return { status: 'linked', logtoUserId, discordUserId };
  }

  if (existingDiscordAccount.userId === logtoUserId) {
    return { status: 'noop', logtoUserId, discordUserId };
  }

  const mergeResult = await mergeDiscordShadowUser({
    prisma,
    shadowUserId: existingDiscordAccount.userId,
    logtoUserId,
    discordUserId,
  });

  if (mergeResult.status === 'not-shadow') {
    logger.warn(
      {
        logtoUserId,
        shadowUserId: mergeResult.shadowUserId,
        discordUserId,
      },
      'Refused to link Logto user to Discord account owned by a non-shadow user',
    );
  }

  return mergeResult;
}

export async function linkDiscordFromLogtoAccount(
  account: {
    providerId: string;
    accountId: string;
    userId: string;
    accessToken?: string | null;
    idToken?: string | null;
  },
  options: {
    prisma?: PrismaClient;
    logger?: LinkDiscordLogger;
    logtoEndpoint?: string;
  },
): Promise<LinkDiscordFromLogtoResult | null> {
  if (account.providerId !== 'logto') {
    return null;
  }

  const discordUserId = options.logtoEndpoint
    ? await readLogtoDiscordUserIdFromTokens(
        {
          idToken: account.idToken,
          accessToken: account.accessToken,
          logtoEndpoint: options.logtoEndpoint,
        },
        fetch,
        options.logger,
      )
    : null;

  return linkDiscordFromLogto({
    prisma: options.prisma,
    logger: options.logger,
    logtoUserId: account.userId,
    logtoAccountId: account.accountId,
    discordUserId,
  });
}
