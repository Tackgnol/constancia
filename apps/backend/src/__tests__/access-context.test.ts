import { describe, expect, it, vi } from 'vitest';
import {
  createSessionAccessContext,
  resolveDiscordUserIdForSession,
  type AuthSession,
} from '../auth/access-context.js';

function createSession(overrides: Partial<AuthSession['user']> = {}): AuthSession {
  return {
    session: {
      id: 'session-1',
      userId: 'user-1',
      expiresAt: new Date('2026-04-21T00:00:00.000Z'),
      token: 'session-token',
      createdAt: new Date('2026-04-21T00:00:00.000Z'),
      updatedAt: new Date('2026-04-21T00:00:00.000Z'),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: 'user-1',
      name: 'Player One',
      email: 'gm@example.com',
      emailVerified: true,
      image: null,
      createdAt: new Date('2026-04-21T00:00:00.000Z'),
      updatedAt: new Date('2026-04-21T00:00:00.000Z'),
      ...overrides,
    },
  } as AuthSession;
}

describe('access context', () => {
  it('resolves the Discord user id from the linked account row', async () => {
    const lookupDiscordAccount = vi.fn().mockResolvedValue('discord-42');

    await expect(
      resolveDiscordUserIdForSession(createSession(), lookupDiscordAccount),
    ).resolves.toBe('discord-42');
    expect(lookupDiscordAccount).toHaveBeenCalledWith('user-1');
  });

  it('returns null when no Discord account is linked to the user', async () => {
    const lookupDiscordAccount = vi.fn().mockResolvedValue(null);

    await expect(
      resolveDiscordUserIdForSession(createSession(), lookupDiscordAccount),
    ).resolves.toBeNull();
  });

  it('ignores the session email — identity lives on the account table', async () => {
    const lookupDiscordAccount = vi.fn().mockResolvedValue('discord-linked');

    await expect(
      resolveDiscordUserIdForSession(
        createSession({ email: 'someone@discord.constancia.local' }),
        lookupDiscordAccount,
      ),
    ).resolves.toBe('discord-linked');
    expect(lookupDiscordAccount).toHaveBeenCalledWith('user-1');
  });

  it('builds a session access context with the resolved Discord identity', async () => {
    const lookupDiscordAccount = vi.fn().mockResolvedValue('discord-account-99');

    await expect(
      createSessionAccessContext(createSession({ email: 'gm@example.com' }), lookupDiscordAccount),
    ).resolves.toEqual({
      kind: 'session',
      userId: 'user-1',
      email: 'gm@example.com',
      discordUserId: 'discord-account-99',
      isSuperUser: false,
    });
  });
});
