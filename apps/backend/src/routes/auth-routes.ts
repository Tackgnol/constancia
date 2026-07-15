import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { randomUUID } from 'node:crypto';
import { auth } from '../auth.js';
import { consumeMagicLinkDelivery } from '../auth/magic-link-delivery.js';
import { ensureDiscordUser } from '../auth/ensure-discord-user.js';
import { applyBetterAuthCookies, forwardToBetterAuth } from '../auth/http.js';
import {
  authMagicLinkBodySchema,
  playerJournalMagicLinkBodySchema,
  playerSheetMagicLinkBodySchema,
  standardResponseSchema,
  tokenQuerySchema,
} from '../schemas.js';
import { getPrismaClient } from '../auth/prisma.js';
import { sendNotFound } from '../http-responses.js';

interface MagicLinkBody {
  discordUserId: string;
  guildId: string;
}

type PlayerLinkTarget = 'sheet' | 'journal';

interface VerifyQuery {
  token: string;
}

interface VerifyPayload {
  session?: unknown;
  user?: unknown;
  message?: string;
  error?: {
    message?: string;
  };
}

function isSuccessfulVerifyResponse(response: Response) {
  return response.ok;
}

function readRedirectError(response: Response) {
  const location = response.headers.get('location');

  if (!location) {
    return null;
  }

  try {
    return new URL(location).searchParams.get('error');
  } catch {
    return null;
  }
}

function readBetterAuthError(response: Response, payload: VerifyPayload) {
  return payload.error?.message ?? payload.message ?? readRedirectError(response);
}

function readVerifyPayload(rawPayload: string) {
  if (rawPayload.length === 0) {
    return {};
  }

  try {
    return JSON.parse(rawPayload) as VerifyPayload;
  } catch {
    return {};
  }
}

// Public auth endpoints — safe to expose without bot or session auth.
// /verify is hit by the browser when the user clicks the magic link.
// /logout ends the current session cookie.
export const authPublicRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: VerifyQuery }>(
    '/verify',
    {
      schema: {
        tags: ['auth'],
        summary: 'Verify a magic link token',
        operationId: 'verifyMagicLink',
        querystring: tokenQuerySchema,
        response: {
          200: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const query = request.query;
      const response = await forwardToBetterAuth(
        request,
        `${app.config.betterAuthPath}/magic-link/verify?token=${encodeURIComponent(query.token)}`,
        { method: 'GET' },
      );

      applyBetterAuthCookies(response, reply);

      const rawPayload = await response.text();
      const payload = readVerifyPayload(rawPayload);
      const verified = isSuccessfulVerifyResponse(response);

      reply.code(200).type('application/json');
      return {
        status: verified ? 'ok' : 'error',
        data: {
          verified,
          session: payload.session ?? null,
          user: payload.user ?? null,
          error:
            readBetterAuthError(response, payload) ??
            (verified ? null : `Better Auth returned ${response.status}`),
        },
      };
    },
  );

  app.post(
    '/logout',
    {
      schema: {
        tags: ['auth'],
        summary: 'Logout the current session',
        operationId: 'logoutSession',
        response: {
          200: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const response = await forwardToBetterAuth(request, `${app.config.betterAuthPath}/sign-out`, {
        method: 'POST',
      });

      applyBetterAuthCookies(response, reply);
      reply.type('application/json');

      return {
        status: response.ok ? 'ok' : 'error',
        data: {
          loggedOut: response.ok,
        },
      };
    },
  );
};

// Bot-only auth endpoints — must be registered inside the bot-auth scope.
// /magic-link mints a login token for an arbitrary Discord user id, so it is
// protected by the bot API key.
export const authBotRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: MagicLinkBody }>(
    '/magic-link',
    {
      schema: {
        tags: ['auth'],
        summary: 'Request a Discord magic link',
        operationId: 'createMagicLink',
        body: authMagicLinkBodySchema,
        response: {
          201: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const requestId = randomUUID();
      const callbackURL = '/';
      const discordUser = await ensureDiscordUser(body.discordUserId);
      if (process.env.NODE_ENV !== 'test') {
        const prisma = getPrismaClient();
        const campaign = await prisma.campaign.findUnique({
          where: { discordGuildId: body.guildId },
          select: { id: true },
        });

        if (campaign) {
          await prisma.campaignAdmin.upsert({
            where: {
              discordUserId_campaignId: {
                discordUserId: body.discordUserId,
                campaignId: campaign.id,
              },
            },
            create: {
              discordUserId: body.discordUserId,
              campaignId: campaign.id,
              role: 'gm',
            },
            update: {
              role: 'gm',
            },
          });
        }
      }

      const result = await auth.api.signInMagicLink({
        body: {
          email: discordUser.email,
          name: `Discord ${body.discordUserId}`,
          callbackURL,
          metadata: {
            requestId,
            discordUserId: body.discordUserId,
            guildId: body.guildId,
            callbackURL,
          },
        },
        headers: fromNodeHeaders(request.headers),
      });
      const delivery = consumeMagicLinkDelivery(requestId);

      if (!delivery) {
        throw new Error('Magic link delivery payload was not captured');
      }

      reply.code(201);
      return {
        status: result.status ? 'ok' : 'error',
        data: {
          token: delivery.token,
          url: delivery.url,
          email: delivery.email,
          ...body,
        },
      };
    },
  );

  async function createPlayerLink(
    request: FastifyRequest<{ Body: MagicLinkBody }>,
    reply: FastifyReply,
    target: PlayerLinkTarget,
  ) {
    const body = request.body;
    const prisma = getPrismaClient();
    const campaign = await prisma.campaign.findUnique({
      where: { discordGuildId: body.guildId },
      select: { id: true },
    });

    if (campaign === null) {
      return sendNotFound(reply, 'Campaign not found for this guild');
    }

    const requestId = randomUUID();
    const callbackURL = `/player/campaigns/${campaign.id}/${target}`;
    const discordUser = await ensureDiscordUser(body.discordUserId);
    const result = await auth.api.signInMagicLink({
      body: {
        email: discordUser.email,
        name: `Discord ${body.discordUserId}`,
        callbackURL,
        metadata: {
          requestId,
          discordUserId: body.discordUserId,
          guildId: body.guildId,
          campaignId: campaign.id,
          callbackURL,
        },
      },
      headers: fromNodeHeaders(request.headers),
    });
    const delivery = consumeMagicLinkDelivery(requestId);

    if (!delivery) {
      throw new Error('Magic link delivery payload was not captured');
    }

    reply.code(201);
    return {
      status: result.status ? 'ok' : 'error',
      data: {
        token: delivery.token,
        url: delivery.url,
        email: delivery.email,
        campaignId: campaign.id,
        ...body,
      },
    };
  }

  app.post<{ Body: MagicLinkBody }>(
    '/player-sheet-link',
    {
      schema: {
        tags: ['auth'],
        summary: 'Request a player sheet magic link',
        operationId: 'createPlayerSheetMagicLink',
        body: playerSheetMagicLinkBodySchema,
        response: {
          201: standardResponseSchema,
        },
      },
    },
    async (request, reply) => createPlayerLink(request, reply, 'sheet'),
  );

  app.post<{ Body: MagicLinkBody }>(
    '/player-journal-link',
    {
      schema: {
        tags: ['auth'],
        summary: 'Request a player journal magic link',
        operationId: 'createPlayerJournalMagicLink',
        body: playerJournalMagicLinkBodySchema,
        response: {
          201: standardResponseSchema,
        },
      },
    },
    async (request, reply) => createPlayerLink(request, reply, 'journal'),
  );
};
