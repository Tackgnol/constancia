import type { FastifyPluginAsync } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { randomUUID } from 'node:crypto';
import { auth } from '../auth.js';
import { consumeMagicLinkDelivery } from '../auth/magic-link-delivery.js';
import { ensureDiscordUser } from '../auth/ensure-discord-user.js';
import { forwardToBetterAuth } from '../auth/http.js';
import {
  authMagicLinkBodySchema,
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

interface VerifyQuery {
  token: string;
}

interface VerifyPayload {
  session?: unknown;
  user?: unknown;
  error?: {
    message?: string;
  };
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

      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      const rawPayload = await response.text();
      const payload = rawPayload.length > 0 ? (JSON.parse(rawPayload) as VerifyPayload) : {};

      reply.code(200);
      return {
        status: response.ok ? 'ok' : 'error',
        data: {
          verified: response.ok,
          token: query.token,
          session: payload.session ?? null,
          user: payload.user ?? null,
          error: payload.error?.message ?? null,
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

      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });

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
    async (request, reply) => {
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
      const callbackURL = `/player/campaigns/${campaign.id}/sheet`;
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
    },
  );
};
