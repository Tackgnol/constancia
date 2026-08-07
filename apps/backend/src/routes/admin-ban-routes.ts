import type { FastifyPluginAsync } from 'fastify';
import { getPrismaClient } from '../auth/prisma.js';
import { deleted, ok, sendError, sendNotFound } from '../http-responses.js';
import {
  adminOverviewSchema,
  createBanBodySchema,
  deleteResponseSchema,
  disableCampaignBodySchema,
  discordUserBanSchema,
  singleResponseSchema,
  standardResponseSchema,
} from '../schemas.js';

interface BanRow {
  id: string;
  discordUserId: string;
  internalNote: string;
  reasonShownToUser: string | null;
  bannedByUserId: string | null;
  createdAt: Date;
}

const banSelect = {
  id: true,
  discordUserId: true,
  internalNote: true,
  reasonShownToUser: true,
  bannedByUserId: true,
  createdAt: true,
} as const;

function mapBan(ban: BanRow) {
  return {
    id: ban.id,
    discordUserId: ban.discordUserId,
    internalNote: ban.internalNote,
    ...(ban.reasonShownToUser === null ? {} : { reasonShownToUser: ban.reasonShownToUser }),
    ...(ban.bannedByUserId === null ? {} : { bannedByUserId: ban.bannedByUserId }),
    createdAt: ban.createdAt.toISOString(),
  };
}

const adminBanRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/overview',
    {
      schema: {
        tags: ['admin'],
        summary: 'List active bans and disabled campaigns',
        operationId: 'getAdminOverview',
        response: { 200: singleResponseSchema(adminOverviewSchema), 403: standardResponseSchema },
      },
    },
    async () => {
      const prisma = getPrismaClient();
      const [bans, disabledCampaigns] = await Promise.all([
        prisma.discordUserBan.findMany({ orderBy: { createdAt: 'desc' }, select: banSelect }),
        prisma.campaign.findMany({
          where: { disabledAt: { not: null } },
          orderBy: { disabledAt: 'desc' },
          select: {
            id: true,
            name: true,
            disabledAt: true,
            disabledInternalNote: true,
            disabledPublicReason: true,
          },
        }),
      ]);

      return ok({
        bans: bans.map(mapBan),
        disabledCampaigns: disabledCampaigns.map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          disabledAt: campaign.disabledAt?.toISOString() ?? new Date(0).toISOString(),
          ...(campaign.disabledInternalNote === null
            ? {}
            : { disabledInternalNote: campaign.disabledInternalNote }),
          ...(campaign.disabledPublicReason === null
            ? {}
            : { disabledPublicReason: campaign.disabledPublicReason }),
        })),
      });
    },
  );

  app.post<{ Body: { discordUserId: string; internalNote: string; reasonShownToUser?: string } }>(
    '/bans',
    {
      schema: {
        tags: ['admin'],
        summary: 'Ban a Discord user from Constancia',
        operationId: 'createDiscordUserBan',
        body: createBanBodySchema,
        response: { 201: singleResponseSchema(discordUserBanSchema), 403: standardResponseSchema },
      },
    },
    async (request, reply) => {
      if (request.access.kind !== 'session') {
        return sendError(reply, 403, 'Superuser access required');
      }

      const ban = await getPrismaClient().discordUserBan.upsert({
        where: { discordUserId: request.body.discordUserId },
        create: {
          ...request.body,
          reasonShownToUser: request.body.reasonShownToUser ?? null,
          bannedByUserId: request.access.userId,
        },
        update: {
          internalNote: request.body.internalNote,
          reasonShownToUser: request.body.reasonShownToUser ?? null,
          bannedByUserId: request.access.userId,
        },
        select: banSelect,
      });

      reply.code(201);
      return ok(mapBan(ban));
    },
  );

  app.delete<{ Params: { discordUserId: string } }>(
    '/bans/:discordUserId',
    {
      schema: {
        tags: ['admin'],
        summary: 'Lift a Discord user ban',
        operationId: 'deleteDiscordUserBan',
        response: { 200: deleteResponseSchema, 403: standardResponseSchema },
      },
    },
    async (request) => {
      const result = await getPrismaClient().discordUserBan.deleteMany({
        where: { discordUserId: request.params.discordUserId },
      });
      return deleted(result.count > 0);
    },
  );

  app.post<{ Params: { id: string }; Body: { internalNote: string; publicReason?: string } }>(
    '/campaigns/:id/disable',
    {
      schema: {
        tags: ['admin'],
        summary: 'Suspend a campaign and silence its queued deliveries',
        operationId: 'disableCampaign',
        body: disableCampaignBodySchema,
        response: {
          200: standardResponseSchema,
          403: standardResponseSchema,
          404: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (request.access.kind !== 'session') {
        return sendError(reply, 403, 'Superuser access required');
      }

      const prisma = getPrismaClient();
      const campaign = await prisma.campaign.findUnique({
        where: { id: request.params.id },
        select: { id: true },
      });
      if (campaign === null) {
        return sendNotFound(reply, 'Campaign not found');
      }

      await prisma.$transaction([
        prisma.campaign.update({
          where: { id: request.params.id },
          data: {
            disabledAt: new Date(),
            disabledInternalNote: request.body.internalNote,
            disabledPublicReason: request.body.publicReason ?? null,
            disabledByUserId: request.access.userId,
          },
        }),
        prisma.eventDelivery.updateMany({
          where: {
            status: { in: ['pending', 'failed'] },
            execution: { campaignId: request.params.id },
          },
          data: { status: 'cancelled' },
        }),
      ]);

      return ok({ disabled: true });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/campaigns/:id/enable',
    {
      schema: {
        tags: ['admin'],
        summary: 'Lift a campaign suspension',
        operationId: 'enableCampaign',
        response: {
          200: standardResponseSchema,
          403: standardResponseSchema,
          404: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      const campaign = await prisma.campaign.findUnique({
        where: { id: request.params.id },
        select: { id: true },
      });
      if (campaign === null) {
        return sendNotFound(reply, 'Campaign not found');
      }

      await prisma.campaign.update({
        where: { id: request.params.id },
        data: {
          disabledAt: null,
          disabledInternalNote: null,
          disabledPublicReason: null,
          disabledByUserId: null,
        },
      });

      return ok({ enabled: true });
    },
  );
};

export default adminBanRoutes;
