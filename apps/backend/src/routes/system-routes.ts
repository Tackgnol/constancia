import type { FastifyPluginAsync } from 'fastify';
import {
  gameSystemSchema,
  identifierParamsSchema,
  listResponseSchema,
  singleResponseSchema,
} from '../schemas.js';

interface SystemParams {
  id: string;
}

const sampleSystems = [
  {
    id: 'vtm-v5',
    name: 'Vampire: The Masquerade 5th Edition',
    version: '0.1.0',
  },
  {
    id: 'mork-borg',
    name: 'Mork Borg',
    version: '0.1.0',
  },
];

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
      status: 'stub',
      data: sampleSystems,
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
    async (request) => {
      const params = request.params;
      return {
        status: 'stub',
        data: sampleSystems.find((system) => system.id === params.id) ?? sampleSystems[0],
      };
    },
  );
};

export default systemRoutes;
