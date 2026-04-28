import type { FastifyPluginAsync } from 'fastify';
import {
  gameSystemSchema,
  identifierParamsSchema,
  listResponseSchema,
  singleResponseSchema,
} from '../schemas.js';
import { getGameSystemSummary, listSupportedGameSystems } from '@constancia/systems';

interface SystemParams {
  id: string;
}

const systemRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      schema: {
        tags: ['systems'],
        summary: 'List registered game systems',
        operationId: 'listGameSystems',
        response: {
          200: listResponseSchema(gameSystemSchema),
        },
      },
    },
    async () => ({
      status: 'ok',
      data: listSupportedGameSystems(),
    }),
  );

  app.get<{ Params: SystemParams }>(
    '/:id',
    {
      schema: {
        tags: ['systems'],
        summary: 'Get a game system',
        operationId: 'getGameSystem',
        params: identifierParamsSchema,
        response: {
          200: singleResponseSchema(gameSystemSchema),
        },
      },
    },
    async (request, reply) => {
      const params = request.params;
      const system = getGameSystemSummary(params.id);
      if (!system) {
        return reply
          .code(404)
          .send({ status: 'error', data: { message: 'Game system not found' } });
      }
      return { status: 'ok', data: system };
    },
  );
};

export default systemRoutes;
