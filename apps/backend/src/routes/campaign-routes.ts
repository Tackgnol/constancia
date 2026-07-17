import type { FastifyPluginAsync } from 'fastify';
import type { GameDate } from '@constancia/contracts';
import { Prisma } from '@constancia/db';
import { getPrismaClient } from '../auth/prisma.js';
import { isPrismaNotFoundError, ok, sendError, sendNotFound } from '../http-responses.js';
import {
  campaignBodySchema,
  campaignParamsSchema,
  campaignPatchBodySchema,
  campaignSchema,
  listResponseSchema,
  singleResponseSchema,
} from '../schemas.js';
import { moderatePayloadText } from '../services/content-moderation.js';
import { createCampaignAccess } from '../services/campaign-access.js';
import { getGameDateValidationError, toGameDateJson } from '../services/game-date.js';
import { parseGameDate } from '@constancia/systems';

interface CampaignParams {
  id: string;
}

interface CampaignBody {
  name: string;
  discordGuildId: string;
  gameSystemId: string;
}

interface CampaignPatchBody {
  name?: string;
  gameSystemId?: string;
  gameDate?: GameDate | null;
}

const select = {
  id: true,
  name: true,
  discordGuildId: true,
  gameSystemId: true,
  gameDate: true,
} as const;

const campaignRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      schema: {
        tags: ['campaigns'],
        summary: 'List campaigns',
        operationId: 'listCampaigns',
        response: {
          200: listResponseSchema(campaignSchema),
        },
      },
    },
    async (request) => {
      const prisma = getPrismaClient();
      const where: Prisma.CampaignWhereInput =
        request.access.kind === 'session' && request.access.isSuperUser
          ? {}
          : request.access.kind === 'session' && request.access.discordUserId !== null
            ? { admins: { some: { discordUserId: request.access.discordUserId } } }
            : { id: { in: [] } };
      const campaigns = await prisma.campaign.findMany({
        where,
        select,
        orderBy: { updatedAt: 'desc' },
      });
      return ok(campaigns);
    },
  );

  app.post<{ Body: CampaignBody }>(
    '/',
    {
      schema: {
        tags: ['campaigns'],
        summary: 'Create a campaign',
        operationId: 'createCampaign',
        body: campaignBodySchema,
        response: {
          201: singleResponseSchema(campaignSchema),
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      await moderatePayloadText(app.config, request.body);
      const discordUserId = request.access.kind === 'session' ? request.access.discordUserId : null;
      if (discordUserId === null) {
        return sendError(reply, 403, 'A linked Discord account is required to create a campaign');
      }
      const { name, discordGuildId, gameSystemId } = request.body;
      const campaign = await prisma.campaign.create({
        data: {
          name,
          discordGuildId,
          gameSystemId,
          admins: { create: { discordUserId, role: 'owner' } },
        },
        select,
      });
      reply.code(201);
      return ok(campaign);
    },
  );

  app.get<{ Params: CampaignParams }>(
    '/:id',
    {
      schema: {
        tags: ['campaigns'],
        summary: 'Get campaign details',
        operationId: 'getCampaign',
        params: campaignParamsSchema,
        response: {
          200: singleResponseSchema(campaignSchema),
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      await moderatePayloadText(app.config, request.body);
      const { id } = request.params;
      await createCampaignAccess(prisma).requireAdmin(request.access, id);
      const campaign = await prisma.campaign.findUnique({ where: { id }, select });
      if (campaign === null) {
        return sendNotFound(reply, 'Campaign not found');
      }
      return ok(campaign);
    },
  );

  app.patch<{ Params: CampaignParams; Body: CampaignPatchBody }>(
    '/:id',
    {
      schema: {
        tags: ['campaigns'],
        summary: 'Update a campaign',
        operationId: 'updateCampaign',
        params: campaignParamsSchema,
        body: campaignPatchBodySchema,
        response: {
          200: singleResponseSchema(campaignSchema),
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      const { id } = request.params;
      await createCampaignAccess(prisma).requireAdmin(request.access, id);
      const { name, gameSystemId, gameDate } = request.body;
      const current = await prisma.campaign.findUnique({
        where: { id },
        select: { gameSystemId: true, gameDate: true },
      });
      if (current === null) {
        return sendNotFound(reply, 'Campaign not found');
      }

      const targetSystemId = gameSystemId ?? current.gameSystemId;
      const targetGameDate = gameDate === undefined ? parseGameDate(current.gameDate) : gameDate;
      if (targetGameDate !== null) {
        const validationError = getGameDateValidationError(targetSystemId, targetGameDate);
        if (validationError !== null) {
          return sendError(reply, 400, validationError);
        }
      }

      const data: Prisma.CampaignUpdateInput = {};
      if (name !== undefined) data.name = name;
      if (gameSystemId !== undefined) data.gameSystemId = gameSystemId;
      if (gameDate !== undefined) {
        data.gameDate = gameDate === null ? Prisma.DbNull : toGameDateJson(gameDate);
      }
      try {
        const campaign = await prisma.campaign.update({ where: { id }, data, select });
        return ok(campaign);
      } catch (err) {
        if (isPrismaNotFoundError(err)) {
          return sendNotFound(reply, 'Campaign not found');
        }
        throw err;
      }
    },
  );
};

export default campaignRoutes;
