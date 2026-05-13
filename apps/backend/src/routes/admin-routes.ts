import type { FastifyPluginAsync } from 'fastify';
import { getPrismaClient } from '../auth/prisma.js';
import { ok, sendError } from '../http-responses.js';
import { listResponseSchema, messageReportSchema, standardResponseSchema } from '../schemas.js';

function mapMessageReport(report: {
  id: string;
  eventId: string | null;
  campaignId: string | null;
  discordGuildId: string | null;
  discordChannelId: string | null;
  discordMessageId: string | null;
  discordUserId: string;
  messageTarget: string | null;
  messageContent: string;
  imageUrl: string | null;
  status: string;
  createdAt: Date;
}) {
  return {
    id: report.id,
    ...(report.eventId === null ? {} : { eventId: report.eventId }),
    ...(report.campaignId === null ? {} : { campaignId: report.campaignId }),
    ...(report.discordGuildId === null ? {} : { discordGuildId: report.discordGuildId }),
    ...(report.discordChannelId === null ? {} : { discordChannelId: report.discordChannelId }),
    ...(report.discordMessageId === null ? {} : { discordMessageId: report.discordMessageId }),
    discordUserId: report.discordUserId,
    ...(report.messageTarget === null ? {} : { messageTarget: report.messageTarget }),
    messageContent: report.messageContent,
    ...(report.imageUrl === null ? {} : { imageUrl: report.imageUrl }),
    status: report.status,
    createdAt: report.createdAt.toISOString(),
  };
}

const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/message-reports',
    {
      schema: {
        tags: ['admin'],
        summary: 'List pending Discord message reports',
        operationId: 'listMessageReports',
        response: {
          200: listResponseSchema(messageReportSchema),
          403: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (request.access.kind !== 'session' || !request.access.isSuperUser) {
        return sendError(reply, 403, 'Superuser access required');
      }

      const prisma = getPrismaClient();
      const reports = await prisma.messageReport.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          eventId: true,
          campaignId: true,
          discordGuildId: true,
          discordChannelId: true,
          discordMessageId: true,
          discordUserId: true,
          messageTarget: true,
          messageContent: true,
          imageUrl: true,
          status: true,
          createdAt: true,
        },
      });

      return ok(reports.map(mapMessageReport));
    },
  );
};

export default adminRoutes;
