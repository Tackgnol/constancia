import { randomUUID } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { genericOAuth, magicLink } from 'better-auth/plugins';
import { loadConfig } from './config.js';
import { linkDiscordFromLogtoAccount } from './auth/link-discord-from-logto.js';
import {
  createLogtoUserInfoGetter,
  getLogtoDiscoveryUrl,
  readLogtoScopeList,
} from './auth/logto-profile.js';
import { rememberMagicLinkDelivery } from './auth/magic-link-delivery.js';
import { getPrismaClient } from './auth/prisma.js';

const config = loadConfig();
const memoryDb: Record<string, Array<Record<string, unknown>>> = {
  user: [],
  session: [],
  account: [],
  verification: [],
};

function createFrontendMagicLink(token: string, callbackURL?: string) {
  const url = new URL(config.magicLinkFrontendPath, config.frontendUrl);
  url.searchParams.set('token', token);

  const next = callbackURL ?? '/';
  const frontendCallbackUrl = new URL(next, config.frontendUrl);
  url.searchParams.set('next', frontendCallbackUrl.toString());

  return url.toString();
}

function getRequestId(metadata?: Record<string, unknown>) {
  return typeof metadata?.requestId === 'string' ? metadata.requestId : randomUUID();
}

export const auth = betterAuth({
  appName: 'Constancia',
  baseURL: config.betterAuthUrl,
  basePath: config.betterAuthPath,
  secret: config.betterAuthSecret,
  trustedOrigins: [config.frontendUrl, config.betterAuthUrl],
  ...(config.authCookieDomain
    ? {
        advanced: {
          crossSubDomainCookies: {
            enabled: true,
            domain: config.authCookieDomain,
          },
        },
      }
    : {}),
  account: {
    accountLinking: {
      enabled: true,
      // No direct Discord OAuth provider is configured, but these account rows
      // are still the durable identity anchor created by the bot magic-link path.
      trustedProviders: ['discord'],
    },
  },
  databaseHooks: {
    account: {
      create: {
        after: async (account) => {
          await linkDiscordFromLogtoAccount(account, { logtoEndpoint: config.logtoEndpoint });
        },
      },
      update: {
        after: async (account) => {
          // Logto may start emitting the Discord claim after the account exists;
          // this helper is idempotent and only acts on logto account rows.
          await linkDiscordFromLogtoAccount(account, { logtoEndpoint: config.logtoEndpoint });
        },
      },
    },
  },
  database:
    process.env.NODE_ENV === 'test'
      ? memoryAdapter(memoryDb)
      : prismaAdapter(getPrismaClient(), {
          provider: 'postgresql',
        }),
  verification: {
    storeIdentifier: 'hashed',
  },
  plugins: [
    magicLink({
      storeToken: 'hashed',
      sendMagicLink: async ({ email, token, metadata }) => {
        const requestId = getRequestId(metadata);
        const callbackURL = typeof metadata?.callbackURL === 'string' ? metadata.callbackURL : '/';
        const url = createFrontendMagicLink(token, callbackURL);

        rememberMagicLinkDelivery({
          requestId,
          email,
          token,
          url,
          metadata,
        });
      },
    }),
    ...(config.logtoEnabled &&
    config.logtoEndpoint &&
    config.logtoAppId &&
    config.logtoAppSecret &&
    config.logtoRedirectUri
      ? [
          genericOAuth({
            config: [
              {
                providerId: 'logto',
                discoveryUrl: getLogtoDiscoveryUrl(config.logtoEndpoint),
                clientId: config.logtoAppId,
                clientSecret: config.logtoAppSecret,
                redirectURI: config.logtoRedirectUri,
                pkce: true,
                scopes: readLogtoScopeList(config.logtoScopes),
                authorizationUrlParams: {
                  direct_sign_in: 'social:discord',
                },
                getUserInfo: createLogtoUserInfoGetter(config.logtoEndpoint),
              },
            ],
          }),
        ]
      : []),
  ],
});
