import type { FastifyPluginAsync } from 'fastify';
import { getPrismaClient } from '../auth/prisma.js';
import { isPrismaNotFoundError, ok, sendNotFound } from '../http-responses.js';
import {
  campaignBodySchema,
  campaignParamsSchema,
  campaignPatchBodySchema,
  campaignSchema,
  listResponseSchema,
  singleResponseSchema,
} from '../schemas.js';
import { moderatePayloadText } from '../services/content-moderation.js';

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
}

const select = { id: true, name: true, discordGuildId: true, gameSystemId: true } as const;

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
    async () => {
      const prisma = getPrismaClient();
      const campaigns = await prisma.campaign.findMany({
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
      const { name, discordGuildId, gameSystemId } = request.body;
      const campaign = await prisma.campaign.create({
        data: { name, discordGuildId, gameSystemId },
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
      const { name, gameSystemId } = request.body;
      const data: { name?: string; gameSystemId?: string } = {};
      if (name !== undefined) data.name = name;
      if (gameSystemId !== undefined) data.gameSystemId = gameSystemId;
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
