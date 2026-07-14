import type { FastifyPluginAsync } from 'fastify';
import { getPrismaClient } from '../auth/prisma.js';
import { ok, sendError, sendNotFound } from '../http-responses.js';
import {
  campaignParamsSchema,
  characterSheetPatchBodySchema,
  progenyVtmCharacterBodySchema,
  standardResponseSchema,
} from '../schemas.js';
import {
  getPlayerCharacterSheet,
  importPlayerCharacterFromProgeny,
  updatePlayerCharacterSheet,
} from '../services/character-sheets.js';
import { moderatePayloadText } from '../services/content-moderation.js';
import { ProgenyImportError, type JsonObject } from '@constancia/systems';

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

  app.post<{ Params: CampaignParams; Body: JsonObject }>(
    '/sheet/imports/progeny',
    {
      schema: {
        tags: ['characters'],
        summary: 'Import the current player sheet from Progeny',
        operationId: 'importPlayerCharacterFromProgeny',
        params: campaignParamsSchema,
        body: progenyVtmCharacterBodySchema,
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

      try {
        const result = await importPlayerCharacterFromProgeny(
          getPrismaClient(),
          request.params.id,
          discordUserId,
          request.body,
        );

        if (result.status === 'not-found') {
          return sendNotFound(reply, 'Player sheet not found');
        }
        if (result.status === 'unsupported-system') {
          return sendError(reply, 400, 'Progeny imports are only supported for VTM V5 campaigns');
        }

        return ok(result.sheet);
      } catch (caught) {
        if (caught instanceof ProgenyImportError) {
          return sendError(reply, 400, caught.message);
        }
        throw caught;
      }
    },
  );
};

export default playerCharacterRoutes;
