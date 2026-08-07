import { describe, expect, it, vi } from 'vitest';
import {
  AccessRevokedError,
  assertCampaignActive,
  assertNotBanned,
  CAMPAIGN_DISABLED_FALLBACK,
  USER_BANNED_FALLBACK,
  type BanLookupPrisma,
} from '../services/moderation-enforcement.js';

function banPrisma(ban: { reasonShownToUser: string | null } | null): BanLookupPrisma {
  return { discordUserBan: { findUnique: vi.fn().mockResolvedValue(ban) } };
}

describe('assertNotBanned', () => {
  it('passes when no ban exists', async () => {
    await expect(assertNotBanned(banPrisma(null), 'discord-gm')).resolves.toBeUndefined();
  });

  it('uses the private user-facing reason and preserves the handled error shape', async () => {
    const error = await assertNotBanned(
      banPrisma({ reasonShownToUser: 'Repeated harassment.' }),
      'discord-gm',
    ).catch((failure: unknown) => failure);

    expect(error).toBeInstanceOf(AccessRevokedError);
    expect(error).toMatchObject({
      message: 'Repeated harassment.',
      code: 'ACCESS_REVOKED',
      statusCode: 403,
    });
  });

  it('falls back to a neutral line', async () => {
    await expect(
      assertNotBanned(banPrisma({ reasonShownToUser: null }), 'discord-gm'),
    ).rejects.toThrow(USER_BANNED_FALLBACK);
  });
});

describe('assertCampaignActive', () => {
  it('passes for an active campaign', () => {
    expect(() =>
      assertCampaignActive({ disabledAt: null, disabledPublicReason: null }),
    ).not.toThrow();
  });

  it('uses the campaign public reason', () => {
    expect(() =>
      assertCampaignActive({
        disabledAt: new Date('2026-08-06T00:00:00.000Z'),
        disabledPublicReason: 'Suspended pending review.',
      }),
    ).toThrow('Suspended pending review.');
  });

  it('falls back to a neutral line', () => {
    expect(() =>
      assertCampaignActive({
        disabledAt: new Date('2026-08-06T00:00:00.000Z'),
        disabledPublicReason: null,
      }),
    ).toThrow(CAMPAIGN_DISABLED_FALLBACK);
  });
});
