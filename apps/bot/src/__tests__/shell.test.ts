import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestAdminMagicLink } from '../auth/request-admin-magic-link.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('bot shell', () => {
  it('requests a Better Auth-backed magic link for a Discord GM', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 201,
        text: async () =>
          JSON.stringify({
            status: 'ok',
            data: {
              url: 'http://localhost:3000/auth?token=magic-token',
              token: 'magic-token',
              discordUserId: 'discord-user-1',
              guildId: 'guild-1',
            },
          }),
      }),
    );

    await expect(
      requestAdminMagicLink({
        discordUserId: 'discord-user-1',
        guildId: 'guild-1',
      }),
    ).resolves.toEqual({
      status: 'ok',
      url: 'http://localhost:3000/auth?token=magic-token',
      token: 'magic-token',
      discordUserId: 'discord-user-1',
      guildId: 'guild-1',
    });
  });
});
