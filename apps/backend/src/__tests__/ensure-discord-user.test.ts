import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  account: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('../auth/prisma.js', () => ({
  getPrismaClient: () => prismaMock,
}));

import { ensureDiscordUser } from '../auth/ensure-discord-user.js';

const discordUserId = 'discord-user-1';
const syntheticEmail = 'discord-user-1@discord.constancia.local';

describe('ensureDiscordUser', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback({
        account: prismaMock.account,
        user: prismaMock.user,
      }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the linked Better Auth user when the Discord account already exists', async () => {
    prismaMock.account.findUnique.mockResolvedValue({
      userId: 'user-1',
      user: { email: syntheticEmail },
    });

    await expect(ensureDiscordUser(discordUserId)).resolves.toEqual({
      userId: 'user-1',
      email: syntheticEmail,
      created: false,
    });

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('reuses an existing synthetic email user and backfills the Discord account link', async () => {
    prismaMock.account.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: syntheticEmail,
    });
    prismaMock.account.upsert.mockResolvedValue({
      user: {
        id: 'user-1',
        email: syntheticEmail,
      },
    });

    await expect(ensureDiscordUser(discordUserId)).resolves.toEqual({
      userId: 'user-1',
      email: syntheticEmail,
      created: false,
    });

    expect(prismaMock.user.upsert).not.toHaveBeenCalled();
    expect(prismaMock.account.upsert).toHaveBeenCalledWith({
      where: {
        providerId_accountId: {
          providerId: 'discord',
          accountId: discordUserId,
        },
      },
      create: {
        providerId: 'discord',
        accountId: discordUserId,
        userId: 'user-1',
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
  });

  it('creates the synthetic user and links the Discord account for a first-time login', async () => {
    prismaMock.account.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.upsert.mockResolvedValue({
      id: 'user-2',
      email: syntheticEmail,
    });
    prismaMock.account.upsert.mockResolvedValue({
      user: {
        id: 'user-2',
        email: syntheticEmail,
      },
    });

    await expect(ensureDiscordUser(discordUserId)).resolves.toEqual({
      userId: 'user-2',
      email: syntheticEmail,
      created: true,
    });

    expect(prismaMock.user.upsert).toHaveBeenCalledWith({
      where: { email: syntheticEmail },
      create: {
        email: syntheticEmail,
        name: `Discord ${discordUserId}`,
        emailVerified: true,
        uploadsEnabled: false,
      },
      update: {
        emailVerified: true,
      },
      select: { id: true, email: true },
    });
  });

  it('short-circuits in test mode without hitting Prisma', async () => {
    process.env.NODE_ENV = 'test';

    await expect(ensureDiscordUser(discordUserId)).resolves.toEqual({
      userId: '',
      email: syntheticEmail,
      created: false,
    });

    expect(prismaMock.account.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});
