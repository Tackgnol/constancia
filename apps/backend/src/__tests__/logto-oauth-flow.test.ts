import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

interface LogtoTestProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  discord_user_id?: string;
  identities?: {
    discord?: {
      userId?: string;
      details?: {
        id?: string;
      };
    };
  };
}

interface OAuthStart {
  state: string;
  cookie: string;
  authorizationUrl: string;
}

interface OAuthHarness {
  app: FastifyInstance;
  prisma: ReturnType<typeof createPrismaMock>['prisma'];
  tx: ReturnType<typeof createPrismaMock>['tx'];
  setIdTokenProfile: (profile: LogtoTestProfile) => void;
  setUserInfoProfile: (profile: LogtoTestProfile | null) => void;
}

const originalEnv = { ...process.env };
const logtoEndpoint = 'https://logto.constancia.example.com';
const discoveryUrl = `${logtoEndpoint}/oidc/.well-known/openid-configuration`;
const authorizationEndpoint = `${logtoEndpoint}/oidc/auth`;
const tokenEndpoint = `${logtoEndpoint}/oidc/token`;
const userInfoEndpoint = `${logtoEndpoint}/oidc/me`;
const oauthFlowTestTimeoutMs = 10_000;

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  vi.doUnmock('../auth/prisma.js');
  vi.resetModules();
});

describe('Logto OAuth callback flow', () => {
  it(
    'starts Constancia Logto sign-in directly at Discord social login',
    async () => {
      const harness = await createOAuthHarness({ discordAccountOwner: null });

      try {
        const start = await startLogtoOAuth(harness.app);
        const authorizationUrl = new URL(start.authorizationUrl);

        expect(authorizationUrl.searchParams.get('direct_sign_in')).toBe('social:discord');
      } finally {
        await harness.app.close();
      }
    },
    oauthFlowTestTimeoutMs,
  );

  it(
    'creates a Discord account binding when the callback carries a new Discord claim',
    async () => {
      const harness = await createOAuthHarness({ discordAccountOwner: null });
      harness.setIdTokenProfile(
        createProfile({
          sub: 'logto-user-new',
          email: 'new-user@example.com',
          discordUserId: 'discord-user-new',
        }),
      );

      try {
        const start = await startLogtoOAuth(harness.app);
        const response = await completeLogtoOAuth(harness.app, start);

        expect(response.statusCode).toBe(302);
        expect(harness.prisma.account.findUnique).toHaveBeenCalledWith({
          where: {
            providerId_accountId: {
              providerId: 'discord',
              accountId: 'discord-user-new',
            },
          },
          select: { userId: true },
        });
        expect(harness.prisma.account.create).toHaveBeenCalledWith({
          data: {
            providerId: 'discord',
            accountId: 'discord-user-new',
            userId: expect.any(String) as string,
          },
        });
      } finally {
        await harness.app.close();
      }
    },
    oauthFlowTestTimeoutMs,
  );

  it(
    'merges an existing synthetic Discord shadow user from the callback hook',
    async () => {
      const harness = await createOAuthHarness({ discordAccountOwner: 'shadow-user-1' });
      harness.setIdTokenProfile(createProfile({ sub: 'logto-user-shadow' }));
      harness.setUserInfoProfile(
        createProfile({
          sub: 'logto-user-shadow',
          discordUserId: 'discord-user-shadow',
        }),
      );

      try {
        const start = await startLogtoOAuth(harness.app);
        const response = await completeLogtoOAuth(harness.app, start);

        expect(response.statusCode).toBe(302);
        expect(harness.tx.account.update).toHaveBeenCalledWith({
          where: { id: 'discord-account-1' },
          data: { userId: expect.any(String) as string },
        });
        expect(harness.tx.user.delete).toHaveBeenCalledWith({
          where: { id: 'shadow-user-1' },
        });
      } finally {
        await harness.app.close();
      }
    },
    oauthFlowTestTimeoutMs,
  );

  it(
    'leaves Discord binding untouched when neither ID token nor userinfo has a Discord claim',
    async () => {
      const harness = await createOAuthHarness({ discordAccountOwner: null });
      harness.setIdTokenProfile(createProfile({ sub: 'logto-user-no-claim' }));
      harness.setUserInfoProfile(createProfile({ sub: 'logto-user-no-claim' }));

      try {
        const start = await startLogtoOAuth(harness.app);
        const response = await completeLogtoOAuth(harness.app, start);

        expect(response.statusCode).toBe(302);
        expect(harness.prisma.account.findUnique).not.toHaveBeenCalled();
        expect(harness.prisma.account.create).not.toHaveBeenCalled();
        expect(harness.prisma.$transaction).not.toHaveBeenCalled();
      } finally {
        await harness.app.close();
      }
    },
    oauthFlowTestTimeoutMs,
  );

  it(
    'does not auto-link an unverified Logto account to an existing same-email user',
    async () => {
      const harness = await createOAuthHarness({ discordAccountOwner: null });

      try {
        harness.setIdTokenProfile(
          createProfile({
            sub: 'logto-existing-email-verified',
            email: 'same-email@example.com',
            emailVerified: true,
          }),
        );
        harness.setUserInfoProfile(null);
        const firstStart = await startLogtoOAuth(harness.app, { errorCallbackURL: '/oauth-error' });
        const firstResponse = await completeLogtoOAuth(harness.app, firstStart, 'first-code');
        expect(firstResponse.statusCode).toBe(302);

        harness.setIdTokenProfile(
          createProfile({
            sub: 'logto-existing-email-unverified',
            email: 'same-email@example.com',
            emailVerified: false,
          }),
        );
        harness.setUserInfoProfile(null);
        const secondStart = await startLogtoOAuth(harness.app, {
          errorCallbackURL: '/oauth-error',
        });
        const secondResponse = await completeLogtoOAuth(harness.app, secondStart, 'second-code');

        expect(secondResponse.statusCode).toBe(302);
        expect(secondResponse.headers.location).toBe('/oauth-error?error=account_not_linked');
      } finally {
        await harness.app.close();
      }
    },
    oauthFlowTestTimeoutMs,
  );

  it(
    'sets the configured cookie domain on Logto callback session cookies',
    async () => {
      const harness = await createOAuthHarness({
        authCookieDomain: 'constancia.example.com',
        discordAccountOwner: null,
      });
      harness.setIdTokenProfile(createProfile({ sub: 'logto-cookie-domain' }));
      harness.setUserInfoProfile(createProfile({ sub: 'logto-cookie-domain' }));

      try {
        const start = await startLogtoOAuth(harness.app);
        const response = await completeLogtoOAuth(harness.app, start);
        const cookies = readSetCookies(response.headers['set-cookie']);

        expect(response.statusCode).toBe(302);
        expect(cookies.some((cookie) => cookie.includes('Domain=constancia.example.com'))).toBe(
          true,
        );
      } finally {
        await harness.app.close();
      }
    },
    oauthFlowTestTimeoutMs,
  );
});

function createProfile(input: {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  discordUserId?: string;
}): LogtoTestProfile {
  const profile: LogtoTestProfile = {
    sub: input.sub,
    email: input.email ?? `${input.sub}@example.com`,
    email_verified: input.emailVerified ?? true,
    name: input.sub,
  };

  if (input.discordUserId) {
    profile.discord_user_id = input.discordUserId;
    profile.identities = { discord: { userId: input.discordUserId } };
  }

  return profile;
}

async function createOAuthHarness(input: {
  authCookieDomain?: string;
  discordAccountOwner: string | null;
}): Promise<OAuthHarness> {
  vi.resetModules();
  const { prisma, tx } = createPrismaMock(input.discordAccountOwner);
  let idTokenProfile = createProfile({ sub: 'logto-user-1' });
  let userInfoProfile: LogtoTestProfile | null = null;

  vi.doMock('../auth/prisma.js', () => ({
    getPrismaClient: () => prisma,
  }));

  vi.stubGlobal(
    'fetch',
    vi.fn((request: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const url = readRequestUrl(request);
      const method = init?.method ?? 'GET';

      if (url === discoveryUrl) {
        return jsonResponse({
          issuer: `${logtoEndpoint}/oidc`,
          authorization_endpoint: authorizationEndpoint,
          token_endpoint: tokenEndpoint,
          userinfo_endpoint: userInfoEndpoint,
        });
      }

      if (url === tokenEndpoint && method === 'POST') {
        return jsonResponse({
          access_token: 'access-token-1',
          token_type: 'Bearer',
          id_token: createUnsignedJwt(idTokenProfile),
          expires_in: 3600,
          scope: 'openid email profile identities',
        });
      }

      if (url === userInfoEndpoint) {
        return jsonResponse(userInfoProfile ?? idTokenProfile);
      }

      return jsonResponse({ error: `Unhandled test fetch URL: ${url}` }, 404);
    }),
  );

  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    AUTH_COOKIE_DOMAIN: input.authCookieDomain,
    BETTER_AUTH_URL: 'https://api.constancia.example.com',
    FRONTEND_URL: 'https://gm.constancia.example.com',
    BETTER_AUTH_SECRET: 'constancia-test-secret-12345678901234567890',
    BOT_API_KEY: 'constancia-bot-dev-key',
    LOGTO_ENABLED: 'true',
    LOGTO_ENDPOINT: logtoEndpoint,
    LOGTO_APP_ID: 'constancia-logto-app',
    LOGTO_APP_SECRET: 'constancia-logto-secret',
    LOGTO_REDIRECT_URI: 'https://api.constancia.example.com/api/auth/oauth2/callback/logto',
    LOGTO_SCOPES: 'openid email profile identities',
  };

  const { buildApp } = await import('../app.js');
  const { loadConfig } = await import('../config.js');
  const app = await buildApp({ config: loadConfig(process.env) });

  return {
    app,
    prisma,
    tx,
    setIdTokenProfile: (profile) => {
      idTokenProfile = profile;
    },
    setUserInfoProfile: (profile) => {
      userInfoProfile = profile;
    },
  };
}

function createPrismaMock(discordAccountOwner: string | null) {
  const tx = {
    account: {
      findUnique: vi.fn(async () =>
        discordAccountOwner
          ? {
              id: 'discord-account-1',
              userId: discordAccountOwner,
            }
          : null,
      ),
      update: vi.fn(async () => ({
        id: 'discord-account-1',
      })),
    },
    user: {
      findUnique: vi.fn(async (args: { where: { id: string } }) =>
        discordAccountOwner && args.where.id === discordAccountOwner
          ? {
              id: discordAccountOwner,
              email: 'discord-user-shadow@discord.constancia.local',
              isSuperUser: false,
              uploadsEnabled: false,
              uploadAllowanceBytes: 50 * 1024 * 1024,
            }
          : {
              id: args.where.id,
              isSuperUser: false,
              uploadsEnabled: false,
              uploadAllowanceBytes: 50 * 1024 * 1024,
            },
      ),
      update: vi.fn(async () => ({
        id: 'logto-user-1',
      })),
      delete: vi.fn(async () => ({
        id: discordAccountOwner,
      })),
    },
    uploadAsset: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    messageReport: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    session: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  };
  const prisma = {
    account: {
      findUnique: vi.fn(async () => (discordAccountOwner ? { userId: discordAccountOwner } : null)),
      create: vi.fn(async () => ({ id: 'discord-account-created' })),
    },
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };

  return { prisma, tx };
}

async function startLogtoOAuth(
  app: FastifyInstance,
  body: { callbackURL?: string; errorCallbackURL?: string } = {},
): Promise<OAuthStart> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/oauth2',
    payload: {
      providerId: 'logto',
      callbackURL: body.callbackURL ?? '/',
      errorCallbackURL: body.errorCallbackURL,
    },
  });

  expect(response.statusCode).toBe(200);
  const authorizationUrl = readStringProperty(response.json(), 'url');
  const state = new URL(authorizationUrl).searchParams.get('state');
  expect(state).toBeTruthy();

  return {
    authorizationUrl,
    state: state ?? '',
    cookie: createCookieHeader(response.headers['set-cookie']),
  };
}

async function completeLogtoOAuth(app: FastifyInstance, start: OAuthStart, code = 'code-1') {
  return app.inject({
    method: 'GET',
    url: `/api/auth/oauth2/callback/logto?code=${code}&state=${encodeURIComponent(start.state)}`,
    headers: { cookie: start.cookie },
  });
}

function readStringProperty(value: unknown, property: string): string {
  if (typeof value !== 'object' || value === null || !(property in value)) {
    throw new Error(`Expected response JSON to include ${property}`);
  }

  const propertyValue = (value as Record<string, unknown>)[property];
  if (typeof propertyValue !== 'string') {
    throw new Error(`Expected response JSON property ${property} to be a string`);
  }

  return propertyValue;
}

function createUnsignedJwt(payload: object): string {
  return [
    encodeBase64Url(JSON.stringify({ alg: 'none', typ: 'JWT' })),
    encodeBase64Url(JSON.stringify(payload)),
    '',
  ].join('.');
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function readRequestUrl(request: Parameters<typeof fetch>[0]): string {
  if (typeof request === 'string') {
    return request;
  }

  if (request instanceof URL) {
    return request.toString();
  }

  return request.url;
}

function jsonResponse(payload: object, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status,
      headers: {
        'content-type': 'application/json',
      },
    }),
  );
}

function readSetCookies(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function createCookieHeader(value: string | string[] | undefined): string {
  return readSetCookies(value)
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}
