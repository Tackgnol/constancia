import type { FastifyPluginAsync } from 'fastify';
import { authMagicLinkBodySchema, standardResponseSchema, tokenQuerySchema } from '../schemas.js';

interface MagicLinkBody {
  discordUserId: string;
  guildId: string;
}

interface VerifyQuery {
  token: string;
}

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
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
      const body = request.body as MagicLinkBody;
      reply.code(201);
      return {
        status: 'stub',
        data: {
          token: 'magic-token',
          url: 'https://frontend/auth?token=magic-token',
          ...body,
        },
      };
    },
  );

  app.get(
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
    async (request) => {
      const query = request.query as VerifyQuery;
      return {
        status: 'stub',
        data: {
          verified: true,
          token: query.token,
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
    async () => ({
      status: 'stub',
      data: {
        loggedOut: true,
      },
    }),
  );
};

export default authRoutes;
