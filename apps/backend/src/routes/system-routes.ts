import type { FastifyPluginAsync } from 'fastify';
import { identifierParamsSchema, standardResponseSchema } from '../schemas.js';

interface SystemParams {
  id: string;
}

const sampleSystems = [
  {
    id: 'vtm-v5',
    name: 'Vampire: The Masquerade 5th Edition',
    version: '0.1.0',
    statSchema: {
      attributes: ['strength', 'dexterity', 'wits'],
      skills: ['awareness', 'occult', 'technology'],
    },
    blocks: ['vtm-stats', 'vtm-pool-resolver', 'vtm-hunger-check', 'vtm-rouse'],
  },
  {
    id: 'mork-borg',
    name: 'Mork Borg',
    version: '0.1.0',
    statSchema: {
      attributes: ['agility', 'presence', 'strength', 'toughness'],
    },
    blocks: ['mb-stats', 'mb-d20-resolver', 'mb-omens'],
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
          200: standardResponseSchema,
        },
      },
    },
    async () => ({
      status: 'stub',
      data: sampleSystems,
    }),
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: ['systems'],
        summary: 'Get a game system',
        operationId: 'getGameSystem',
        params: identifierParamsSchema,
        response: {
          200: standardResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as SystemParams;
      return {
        status: 'stub',
        data: sampleSystems.find((system) => system.id === params.id) ?? sampleSystems[0],
      };
    },
  );
};

export default systemRoutes;
