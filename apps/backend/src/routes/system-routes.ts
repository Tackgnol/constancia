import type { FastifyPluginAsync } from 'fastify';
import {
  gameSystemSchema,
  identifierParamsSchema,
  listResponseSchema,
  singleResponseSchema,
} from '../schemas.js';
import { getGameSystemSummary, listSupportedGameSystems } from '@constancia/systems';
import { ok, sendNotFound } from '../http-responses.js';

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
    async () => ok(listSupportedGameSystems()),
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
        return sendNotFound(reply, 'Game system not found');
      }
      return ok(system);
    },
  );
};

export default systemRoutes;
