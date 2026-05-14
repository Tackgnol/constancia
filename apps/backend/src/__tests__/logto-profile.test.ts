import { describe, expect, it, vi } from 'vitest';
import {
  createLogtoUserInfoGetter,
  decodeJwtPayload,
  extractLogtoDiscordUserId,
  fetchLogtoUserInfoProfile,
  getLogtoDiscoveryUrl,
  mapLogtoProfileToUser,
  readLogtoDiscordUserIdFromTokens,
  readLogtoScopeList,
} from '../auth/logto-profile.js';

function encodeJwtPayload(payload: Record<string, unknown>): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `header.${encodedPayload}.signature`;
}

describe('logto profile helpers', () => {
  it('maps the core Better Auth user fields and keeps emailVerified strict', () => {
    const mapped = mapLogtoProfileToUser({
      sub: 'logto-user-1',
      email: 'USER@example.com',
      email_verified: false,
      name: 'A User',
      picture: 'https://example.com/avatar.png',
      discord_user_id: 'discord-user-1',
    });

    expect(mapped).toEqual({
      user: {
        id: 'logto-user-1',
        email: 'USER@example.com',
        emailVerified: false,
        name: 'A User',
        image: 'https://example.com/avatar.png',
      },
      discordUserId: 'discord-user-1',
    });
  });

  it('does not default a missing email_verified claim to true', () => {
    const mapped = mapLogtoProfileToUser({
      sub: 'logto-user-1',
      email: 'user@example.com',
    });

    expect(mapped.user.emailVerified).toBe(false);
  });

  it('extracts supported Discord claim shapes in priority order', () => {
    expect(extractLogtoDiscordUserId({ discord_user_id: 'direct' })).toBe('direct');
    expect(extractLogtoDiscordUserId({ identities: { discord: { userId: 'identity' } } })).toBe(
      'identity',
    );
    expect(
      extractLogtoDiscordUserId({
        identities: { discord: { details: { id: 'details' } } },
      }),
    ).toBe('details');
    expect(extractLogtoDiscordUserId({ social: { discord: { id: 'social' } } })).toBe('social');
    expect(extractLogtoDiscordUserId({})).toBeNull();
  });

  it('decodes JWT payloads without trusting unneeded token fields', () => {
    expect(decodeJwtPayload(encodeJwtPayload({ sub: 'logto-user-1' }))).toEqual({
      sub: 'logto-user-1',
    });
  });

  it('fetches the Logto userinfo endpoint from OIDC discovery', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ userinfo_endpoint: 'https://auth.example.com/oidc/me' })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sub: 'logto-user-1', discord_user_id: 'discord-user-1' })),
      );

    await expect(
      fetchLogtoUserInfoProfile('https://auth.example.com', 'access-token', fetchMock),
    ).resolves.toEqual({
      sub: 'logto-user-1',
      discord_user_id: 'discord-user-1',
    });

    expect(fetchMock).toHaveBeenLastCalledWith('https://auth.example.com/oidc/me', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer access-token',
      },
    });
  });

  it('falls back to userinfo when the ID token lacks the Discord identity claim', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ userinfo_endpoint: 'https://auth.example.com/oidc/me' })),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sub: 'logto-user-1',
            email: 'user@example.com',
            email_verified: true,
            name: 'A User',
            identities: { discord: { userId: 'discord-user-1' } },
          }),
        ),
      );

    const getter = createLogtoUserInfoGetter('https://auth.example.com', fetchMock);

    await expect(
      getter({
        idToken: encodeJwtPayload({
          sub: 'logto-user-1',
          email: 'user@example.com',
          email_verified: true,
          name: 'A User',
        }),
        accessToken: 'access-token',
      }),
    ).resolves.toEqual({
      id: 'logto-user-1',
      email: 'user@example.com',
      emailVerified: true,
      name: 'A User',
      image: undefined,
    });
  });

  it('continues with the ID-token profile when userinfo lookup fails', async () => {
    const logger = {
      warn: vi.fn(),
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ userinfo_endpoint: 'https://auth.example.com/oidc/me' })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'temporarily unavailable' }), { status: 503 }),
      );

    const getter = createLogtoUserInfoGetter('https://auth.example.com', fetchMock, logger);

    await expect(
      getter({
        idToken: encodeJwtPayload({
          sub: 'logto-user-1',
          email: 'user@example.com',
          email_verified: true,
          name: 'A User',
        }),
        accessToken: 'access-token',
      }),
    ).resolves.toEqual({
      id: 'logto-user-1',
      email: 'user@example.com',
      emailVerified: true,
      name: 'A User',
      image: undefined,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      {
        logtoEndpoint: 'https://auth.example.com',
        error: 'Logto request failed with status 503',
      },
      'Logto userinfo lookup failed; continuing with ID-token profile only',
    );
  });

  it('reads Discord claims from persisted OAuth tokens without module state', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ userinfo_endpoint: 'https://auth.example.com/oidc/me' })),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sub: 'logto-user-1',
            email: 'user@example.com',
            identities: { discord: { details: { id: 'discord-user-1' } } },
          }),
        ),
      );

    await expect(
      readLogtoDiscordUserIdFromTokens(
        {
          idToken: encodeJwtPayload({ sub: 'logto-user-1', email: 'user@example.com' }),
          accessToken: 'access-token',
          logtoEndpoint: 'https://auth.example.com',
        },
        fetchMock,
      ),
    ).resolves.toBe('discord-user-1');
  });

  it('normalizes scopes and discovery URLs', () => {
    expect(readLogtoScopeList(undefined)).toEqual(['openid', 'email', 'profile', 'identities']);
    expect(readLogtoScopeList('openid,email profile custom')).toEqual([
      'openid',
      'email',
      'profile',
      'custom',
    ]);
    expect(getLogtoDiscoveryUrl('https://auth.example.com/')).toBe(
      'https://auth.example.com/oidc/.well-known/openid-configuration',
    );
  });
});
