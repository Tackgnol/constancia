import type { FastifyPluginAsync } from 'fastify';
import { getPrismaClient } from '../auth/prisma.js';
import { ok, sendError, sendNotFound } from '../http-responses.js';
import {
  campaignParamsSchema,
  characterSheetPatchBodySchema,
  standardResponseSchema,
} from '../schemas.js';
import {
  getPlayerCharacterSheet,
  updatePlayerCharacterSheet,
} from '../services/character-sheets.js';
import { moderatePayloadText } from '../services/content-moderation.js';

interface CampaignParams {
  id: string;
}

interface CharacterSheetPatchBody {
  gameName?: string;
  backstory?: string;
  notes?: string;
  stats?: Record<string, unknown>;
}

const playerCharacterRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: CampaignParams }>(
    '/sheet',
    {
      schema: {
        tags: ['characters'],
        summary: 'Get the current player sheet',
        operationId: 'getPlayerCharacterSheet',
        params: campaignParamsSchema,
        response: {
          200: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const discordUserId = request.access.kind === 'session' ? request.access.discordUserId : null;
      if (!discordUserId) {
        return sendError(reply, 403, 'Discord identity required');
      }

      await moderatePayloadText(app.config, request.body);
      const prisma = getPrismaClient();
      const { id } = request.params;
      const sheet = await getPlayerCharacterSheet(prisma, id, discordUserId);

      if (sheet === null) {
        return sendNotFound(reply, 'Player sheet not found');
      }

      return ok(sheet);
    },
  );

  app.patch<{ Params: CampaignParams; Body: CharacterSheetPatchBody }>(
    '/sheet',
    {
      schema: {
        tags: ['characters'],
        summary: 'Update the current player sheet',
        operationId: 'updatePlayerCharacterSheet',
        params: campaignParamsSchema,
        body: characterSheetPatchBodySchema,
        response: {
          200: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const discordUserId = request.access.kind === 'session' ? request.access.discordUserId : null;
      if (!discordUserId) {
        return sendError(reply, 403, 'Discord identity required');
      }

      const prisma = getPrismaClient();
      const { id } = request.params;
      const sheet = await updatePlayerCharacterSheet(prisma, id, discordUserId, request.body);

      if (sheet === null) {
        return sendNotFound(reply, 'Player sheet not found');
      }

      return ok(sheet);
    },
  );
};

export default playerCharacterRoutes;
