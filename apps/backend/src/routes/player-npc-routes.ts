import type { FastifyPluginAsync } from 'fastify';
import { getPrismaClient } from '../auth/prisma.js';
import {
  campaignParamsSchema,
  listResponseSchema,
  npcParamsSchema,
  playerVisibleNpcSchema,
  singleResponseSchema,
} from '../schemas.js';
import {
  listVisibleNpcRecordsForPlayer,
  mapPlayerVisibleNpc,
} from '../services/player-visible-npcs.js';

interface CampaignParams {
  id: string;
}

interface NpcParams {
  id: string;
  npcId: string;
}

const playerNpcRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: CampaignParams }>(
    '/',
    {
      schema: {
        tags: ['npcs'],
        summary: 'List NPCs visible to the current player',
        operationId: 'listVisibleNpcsForCurrentPlayer',
        params: campaignParamsSchema,
        response: {
          200: listResponseSchema(playerVisibleNpcSchema),
        },
      },
    },
    async (request, reply) => {
      const discordUserId = request.access.kind === 'session' ? request.access.discordUserId : null;

      if (!discordUserId) {
        return reply
          .code(403)
          .send({ status: 'error', data: { message: 'Discord identity required' } });
      }

      const prisma = getPrismaClient();
      const { id } = request.params;
      const npcs = await listVisibleNpcRecordsForPlayer(prisma, id, discordUserId);

      return { status: 'ok', data: npcs.map(mapPlayerVisibleNpc) };
    },
  );

  app.get<{ Params: NpcParams }>(
    '/:npcId',
    {
      schema: {
        tags: ['npcs'],
        summary: 'Get an NPC dossier for the current player',
        operationId: 'getVisibleNpcForCurrentPlayer',
        params: npcParamsSchema,
        response: {
          200: singleResponseSchema(playerVisibleNpcSchema),
        },
      },
    },
    async (request, reply) => {
      const discordUserId = request.access.kind === 'session' ? request.access.discordUserId : null;

      if (!discordUserId) {
        return reply
          .code(403)
          .send({ status: 'error', data: { message: 'Discord identity required' } });
      }

      const prisma = getPrismaClient();
      const { id, npcId } = request.params;
      const npcs = await listVisibleNpcRecordsForPlayer(prisma, id, discordUserId);
      const npc = npcs.find((entry) => entry.id === npcId);

      if (npc === undefined) {
        return reply
          .code(404)
          .send({ status: 'error', data: { message: 'NPC dossier not found' } });
      }

      return { status: 'ok', data: mapPlayerVisibleNpc(npc) };
    },
  );
};

export default playerNpcRoutes;
