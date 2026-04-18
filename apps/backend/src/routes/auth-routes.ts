import type { FastifyPluginAsync } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { randomUUID } from 'node:crypto';
import { auth } from '../auth.js';
import { consumeMagicLinkDelivery } from '../auth/magic-link-delivery.js';
import { discordUserIdToAuthEmail } from '../auth/identity.js';
import { forwardToBetterAuth } from '../auth/http.js';
import { authMagicLinkBodySchema, standardResponseSchema, tokenQuerySchema } from '../schemas.js';

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

const authRoutes: FastifyPluginAsync = async (app) => {
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
      const result = await auth.api.signInMagicLink({
        body: {
          email: discordUserIdToAuthEmail(body.discordUserId),
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

export default authRoutes;
