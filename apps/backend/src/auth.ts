import { randomUUID } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { magicLink } from 'better-auth/plugins';
import { loadConfig } from './config.js';
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

  if (callbackURL) {
    url.searchParams.set('next', callbackURL);
  }

  return url.toString();
}

function getRequestId(metadata?: Record<string, unknown>) {
  return typeof metadata?.requestId === 'string' ? metadata.requestId : randomUUID();
}

const socialProviders =
  config.discordClientId && config.discordClientSecret
    ? {
        discord: {
          clientId: config.discordClientId,
          clientSecret: config.discordClientSecret,
        },
      }
    : undefined;

export const auth = betterAuth({
  appName: 'Constancia',
  baseURL: config.betterAuthUrl,
  basePath: config.betterAuthPath,
  secret: config.betterAuthSecret,
  trustedOrigins: [config.frontendUrl, config.betterAuthUrl],
  ...(socialProviders ? { socialProviders } : {}),
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['discord'],
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
  ],
});
