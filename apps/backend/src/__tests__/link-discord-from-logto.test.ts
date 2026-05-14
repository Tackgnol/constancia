import type { PrismaClient } from '@constancia/db';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  linkDiscordFromLogto,
  linkDiscordFromLogtoAccount,
} from '../auth/link-discord-from-logto.js';
import { mergeDiscordShadowUser } from '../auth/merge-discord-shadow-user.js';

function asPrismaClient(value: unknown): PrismaClient {
  return value as PrismaClient;
}

function encodeJwtPayload(payload: Record<string, unknown>): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `header.${encodedPayload}.signature`;
}

describe('linkDiscordFromLogto', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when Logto did not provide a Discord claim', async () => {
    const prisma = {
      account: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    };

    await expect(
      linkDiscordFromLogto({
        prisma: asPrismaClient(prisma),
        logtoUserId: 'logto-user-1',
        logtoAccountId: 'logto-sub-1',
        discordUserId: null,
      }),
    ).resolves.toEqual({
      status: 'no-discord-claim',
      logtoUserId: 'logto-user-1',
      logtoAccountId: 'logto-sub-1',
    });

    expect(prisma.account.findUnique).not.toHaveBeenCalled();
    expect(prisma.account.create).not.toHaveBeenCalled();
  });

  it('creates the Discord account row when it does not exist yet', async () => {
    const prisma = {
      account: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'account-1' }),
      },
    };

    await expect(
      linkDiscordFromLogto({
        prisma: asPrismaClient(prisma),
        logtoUserId: 'logto-user-1',
        logtoAccountId: 'logto-sub-1',
        discordUserId: 'discord-user-1',
      }),
    ).resolves.toEqual({
      status: 'linked',
      logtoUserId: 'logto-user-1',
      discordUserId: 'discord-user-1',
    });

    expect(prisma.account.create).toHaveBeenCalledWith({
      data: {
        providerId: 'discord',
        accountId: 'discord-user-1',
        userId: 'logto-user-1',
      },
    });
  });

  it('does nothing when the Discord account already points to the Logto user', async () => {
    const prisma = {
      account: {
        findUnique: vi.fn().mockResolvedValue({ userId: 'logto-user-1' }),
        create: vi.fn(),
      },
    };

    await expect(
      linkDiscordFromLogto({
        prisma: asPrismaClient(prisma),
        logtoUserId: 'logto-user-1',
        logtoAccountId: 'logto-sub-1',
        discordUserId: 'discord-user-1',
      }),
    ).resolves.toEqual({
      status: 'noop',
      logtoUserId: 'logto-user-1',
      discordUserId: 'discord-user-1',
    });
  });

  it('extracts the Discord claim from persisted Logto account tokens', async () => {
    const prisma = {
      account: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'account-1' }),
      },
    };
    const idToken = encodeJwtPayload({
      sub: 'logto-sub-1',
      email: 'user@example.com',
      discord_user_id: 'discord-user-1',
    });

    await expect(
      linkDiscordFromLogtoAccount(
        {
          providerId: 'logto',
          accountId: 'logto-sub-1',
          userId: 'logto-user-1',
          idToken,
        },
        { prisma: asPrismaClient(prisma), logtoEndpoint: 'https://auth.example.com' },
      ),
    ).resolves.toEqual({
      status: 'linked',
      logtoUserId: 'logto-user-1',
      discordUserId: 'discord-user-1',
    });
  });

  it('can link a late-arriving Discord claim from a later account update', async () => {
    const prisma = {
      account: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'account-1' }),
      },
    };

    await expect(
      linkDiscordFromLogtoAccount(
        {
          providerId: 'logto',
          accountId: 'logto-sub-1',
          userId: 'logto-user-1',
          idToken: null,
        },
        { prisma: asPrismaClient(prisma), logtoEndpoint: 'https://auth.example.com' },
      ),
    ).resolves.toEqual({
      status: 'no-discord-claim',
      logtoUserId: 'logto-user-1',
      logtoAccountId: 'logto-sub-1',
    });
    expect(prisma.account.findUnique).not.toHaveBeenCalled();

    await expect(
      linkDiscordFromLogtoAccount(
        {
          providerId: 'logto',
          accountId: 'logto-sub-1',
          userId: 'logto-user-1',
          idToken: encodeJwtPayload({
            sub: 'logto-sub-1',
            email: 'user@example.com',
            discord_user_id: 'discord-user-1',
          }),
        },
        { prisma: asPrismaClient(prisma), logtoEndpoint: 'https://auth.example.com' },
      ),
    ).resolves.toEqual({
      status: 'linked',
      logtoUserId: 'logto-user-1',
      discordUserId: 'discord-user-1',
    });
    expect(prisma.account.create).toHaveBeenCalledWith({
      data: {
        providerId: 'discord',
        accountId: 'discord-user-1',
        userId: 'logto-user-1',
      },
    });
  });

  it('warns when the Discord account belongs to a non-shadow user', async () => {
    const logger = {
      warn: vi.fn(),
    };
    const tx = {
      account: {
        findUnique: vi.fn().mockResolvedValue({ id: 'account-1', userId: 'real-user-1' }),
        update: vi.fn(),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ email: 'real-user@example.com' }),
        update: vi.fn(),
        delete: vi.fn(),
      },
      uploadAsset: {
        updateMany: vi.fn(),
      },
      messageReport: {
        updateMany: vi.fn(),
      },
      session: {
        deleteMany: vi.fn(),
      },
    };
    const prisma = {
      account: {
        findUnique: vi.fn().mockResolvedValue({ userId: 'real-user-1' }),
        create: vi.fn(),
      },
      $transaction: vi.fn(
        async (
          callback: (
            transaction: typeof tx,
          ) => Promise<Awaited<ReturnType<typeof mergeDiscordShadowUser>>>,
        ) => callback(tx),
      ),
    };

    await expect(
      linkDiscordFromLogto({
        prisma: asPrismaClient(prisma),
        logger,
        logtoUserId: 'logto-user-1',
        logtoAccountId: 'logto-sub-1',
        discordUserId: 'discord-user-1',
      }),
    ).resolves.toEqual({
      status: 'not-shadow',
      shadowUserId: 'real-user-1',
      discordUserId: 'discord-user-1',
    });

    expect(logger.warn).toHaveBeenCalledWith(
      {
        logtoUserId: 'logto-user-1',
        shadowUserId: 'real-user-1',
        discordUserId: 'discord-user-1',
      },
      'Refused to link Logto user to Discord account owned by a non-shadow user',
    );
  });
});

describe('mergeDiscordShadowUser', () => {
  it('repoints the Discord account, transfers owned records, invalidates sessions, and deletes the shadow user', async () => {
    const tx = {
      account: {
        findUnique: vi.fn().mockResolvedValue({ id: 'account-1', userId: 'shadow-user-1' }),
        update: vi.fn().mockResolvedValue({ id: 'account-1' }),
      },
      user: {
        findUnique: vi.fn(async (args: { where: { id: string } }) =>
          args.where.id === 'shadow-user-1'
            ? {
                email: 'discord-user-1@discord.constancia.local',
                isSuperUser: false,
                uploadsEnabled: false,
                uploadAllowanceBytes: 50 * 1024 * 1024,
              }
            : {
                isSuperUser: false,
                uploadsEnabled: false,
                uploadAllowanceBytes: 50 * 1024 * 1024,
              },
        ),
        update: vi.fn().mockResolvedValue({ id: 'logto-user-1' }),
        delete: vi.fn().mockResolvedValue({ id: 'shadow-user-1' }),
      },
      uploadAsset: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      messageReport: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      session: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: vi.fn(
        async (
          callback: (
            transaction: typeof tx,
          ) => Promise<Awaited<ReturnType<typeof mergeDiscordShadowUser>>>,
        ) => callback(tx),
      ),
    };

    await expect(
      mergeDiscordShadowUser({
        prisma: asPrismaClient(prisma),
        shadowUserId: 'shadow-user-1',
        logtoUserId: 'logto-user-1',
        discordUserId: 'discord-user-1',
      }),
    ).resolves.toEqual({
      status: 'merged',
      shadowUserId: 'shadow-user-1',
      logtoUserId: 'logto-user-1',
      discordUserId: 'discord-user-1',
    });

    expect(tx.uploadAsset.updateMany).toHaveBeenCalledWith({
      where: { userId: 'shadow-user-1' },
      data: { userId: 'logto-user-1' },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'logto-user-1' },
      data: {
        isSuperUser: false,
        uploadsEnabled: false,
        uploadAllowanceBytes: 50 * 1024 * 1024,
      },
    });
    expect(tx.messageReport.updateMany).toHaveBeenCalledWith({
      where: { reviewedByUserId: 'shadow-user-1' },
      data: { reviewedByUserId: 'logto-user-1' },
    });
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'shadow-user-1' } });
    expect(tx.account.update).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      data: { userId: 'logto-user-1' },
    });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'shadow-user-1' } });
  });

  it('preserves elevated role and upload grants from the shadow user', async () => {
    const tx = {
      account: {
        findUnique: vi.fn().mockResolvedValue({ id: 'account-1', userId: 'shadow-user-1' }),
        update: vi.fn().mockResolvedValue({ id: 'account-1' }),
      },
      user: {
        findUnique: vi.fn(async (args: { where: { id: string } }) =>
          args.where.id === 'shadow-user-1'
            ? {
                email: 'discord-user-1@discord.constancia.local',
                isSuperUser: true,
                uploadsEnabled: true,
                uploadAllowanceBytes: 200 * 1024 * 1024,
              }
            : {
                isSuperUser: false,
                uploadsEnabled: false,
                uploadAllowanceBytes: 500 * 1024 * 1024,
              },
        ),
        update: vi.fn().mockResolvedValue({ id: 'logto-user-1' }),
        delete: vi.fn().mockResolvedValue({ id: 'shadow-user-1' }),
      },
      uploadAsset: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      messageReport: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      session: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      $transaction: vi.fn(
        async (
          callback: (
            transaction: typeof tx,
          ) => Promise<Awaited<ReturnType<typeof mergeDiscordShadowUser>>>,
        ) => callback(tx),
      ),
    };

    await mergeDiscordShadowUser({
      prisma: asPrismaClient(prisma),
      shadowUserId: 'shadow-user-1',
      logtoUserId: 'logto-user-1',
      discordUserId: 'discord-user-1',
    });

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'logto-user-1' },
      data: {
        isSuperUser: true,
        uploadsEnabled: true,
        uploadAllowanceBytes: 500 * 1024 * 1024,
      },
    });
  });

  it('is idempotent when the Discord account already points at the Logto user', async () => {
    const tx = {
      account: {
        findUnique: vi.fn().mockResolvedValue({ id: 'account-1', userId: 'logto-user-1' }),
      },
    };
    const prisma = {
      $transaction: vi.fn(
        async (
          callback: (
            transaction: typeof tx,
          ) => Promise<Awaited<ReturnType<typeof mergeDiscordShadowUser>>>,
        ) => callback(tx),
      ),
    };

    await expect(
      mergeDiscordShadowUser({
        prisma: asPrismaClient(prisma),
        shadowUserId: 'shadow-user-1',
        logtoUserId: 'logto-user-1',
        discordUserId: 'discord-user-1',
      }),
    ).resolves.toEqual({ status: 'noop' });
  });

  it('refuses to merge a non-shadow account owner', async () => {
    const tx = {
      account: {
        findUnique: vi.fn().mockResolvedValue({ id: 'account-1', userId: 'real-user-1' }),
        update: vi.fn(),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ email: 'real-user@example.com' }),
        update: vi.fn(),
        delete: vi.fn(),
      },
      uploadAsset: {
        updateMany: vi.fn(),
      },
      messageReport: {
        updateMany: vi.fn(),
      },
      session: {
        deleteMany: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(
        async (
          callback: (
            transaction: typeof tx,
          ) => Promise<Awaited<ReturnType<typeof mergeDiscordShadowUser>>>,
        ) => callback(tx),
      ),
    };

    await expect(
      mergeDiscordShadowUser({
        prisma: asPrismaClient(prisma),
        shadowUserId: 'real-user-1',
        logtoUserId: 'logto-user-1',
        discordUserId: 'discord-user-1',
      }),
    ).resolves.toEqual({
      status: 'not-shadow',
      shadowUserId: 'real-user-1',
      discordUserId: 'discord-user-1',
    });

    expect(tx.account.update).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.user.delete).not.toHaveBeenCalled();
    expect(tx.session.deleteMany).not.toHaveBeenCalled();
  });
});
