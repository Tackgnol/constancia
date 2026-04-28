import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPlayerSheetMagicLink } from '../auth/request-player-sheet-magic-link.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requestPlayerSheetMagicLink', () => {
  it('returns the parsed backend payload for a valid response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: async () =>
          JSON.stringify({
            status: 'ok',
            data: {
              url: 'http://localhost:3000/auth?token=abc&next=%2Fplayer%2Fcampaigns%2Fcampaign-1%2Fsheet',
              token: 'abc',
              discordUserId: 'discord-user-1',
              guildId: 'guild-1',
              campaignId: 'campaign-1',
            },
          }),
      }),
    );

    await expect(
      requestPlayerSheetMagicLink({ discordUserId: 'discord-user-1', guildId: 'guild-1' }),
    ).resolves.toEqual({
      status: 'ok',
      url: 'http://localhost:3000/auth?token=abc&next=%2Fplayer%2Fcampaigns%2Fcampaign-1%2Fsheet',
      token: 'abc',
      discordUserId: 'discord-user-1',
      guildId: 'guild-1',
      campaignId: 'campaign-1',
    });
  });

  it('throws when the backend response is missing required fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ status: 'ok', data: { url: 'http://localhost:3000' } }),
      }),
    );

    await expect(
      requestPlayerSheetMagicLink({ discordUserId: 'discord-user-1', guildId: 'guild-1' }),
    ).rejects.toThrow('invalid player sheet magic link payload');
  });
});
