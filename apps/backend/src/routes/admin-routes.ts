import type { FastifyPluginAsync } from 'fastify';
import { getPrismaClient } from '../auth/prisma.js';
import { ok, sendError, sendNotFound } from '../http-responses.js';
import {
  adminMessageReportSchema,
  listResponseSchema,
  singleResponseSchema,
  standardResponseSchema,
  updateMessageReportBodySchema,
} from '../schemas.js';

const REPORT_STATUSES = ['pending', 'reviewed', 'dismissed'] as const;
type ReportStatus = (typeof REPORT_STATUSES)[number];

const reportSelect = {
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
} as const;

interface ReportRow {
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
}

interface CampaignContext {
  id: string;
  name: string;
  disabledAt: Date | null;
  admins: Array<{ discordUserId: string }>;
}

function mapMessageReport(report: ReportRow, campaign?: CampaignContext) {
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
    ...(campaign === undefined
      ? {}
      : {
          campaign: {
            id: campaign.id,
            name: campaign.name,
            ...(campaign.disabledAt === null
              ? {}
              : { disabledAt: campaign.disabledAt.toISOString() }),
            admins: campaign.admins.map((admin) => admin.discordUserId),
          },
        }),
  };
}

function parseStatus(value: string | undefined): ReportStatus {
  return REPORT_STATUSES.includes(value as ReportStatus) ? (value as ReportStatus) : 'pending';
}

const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { status?: string } }>(
    '/message-reports',
    {
      schema: {
        tags: ['admin'],
        summary: 'List Discord message reports',
        operationId: 'listMessageReports',
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { status: { type: 'string', enum: [...REPORT_STATUSES] } },
        },
        response: {
          200: listResponseSchema(adminMessageReportSchema),
          403: standardResponseSchema,
        },
      },
    },
    async (request) => {
      const prisma = getPrismaClient();
      const reports = await prisma.messageReport.findMany({
        where: { status: parseStatus(request.query.status) },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: reportSelect,
      });
      const campaignIds = [
        ...new Set(
          reports.map((report) => report.campaignId).filter((id): id is string => id !== null),
        ),
      ];
      const unresolvedEventIds = reports
        .filter((report) => report.campaignId === null)
        .map((report) => report.eventId)
        .filter((id): id is string => id !== null);
      const events = await prisma.event.findMany({
        where: { id: { in: unresolvedEventIds } },
        select: { id: true, campaignId: true },
      });
      const campaignIdByEventId = new Map(events.map((event) => [event.id, event.campaignId]));
      for (const campaignId of campaignIdByEventId.values()) {
        campaignIds.push(campaignId);
      }
      const campaigns = await prisma.campaign.findMany({
        where: { id: { in: [...new Set(campaignIds)] } },
        select: {
          id: true,
          name: true,
          disabledAt: true,
          admins: { select: { discordUserId: true } },
        },
      });
      const campaignsById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));

      return ok(
        reports.map((report) => {
          const campaignId =
            report.campaignId ??
            (report.eventId === null ? undefined : campaignIdByEventId.get(report.eventId));
          return mapMessageReport(
            report,
            campaignId === undefined ? undefined : campaignsById.get(campaignId),
          );
        }),
      );
    },
  );

  app.patch<{ Params: { id: string }; Body: { status: 'reviewed' | 'dismissed' } }>(
    '/message-reports/:id',
    {
      schema: {
        tags: ['admin'],
        summary: 'Mark a Discord message report reviewed or dismissed',
        operationId: 'updateMessageReport',
        body: updateMessageReportBodySchema,
        response: {
          200: singleResponseSchema(adminMessageReportSchema),
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
      const existing = await prisma.messageReport.findUnique({
        where: { id: request.params.id },
        select: { id: true },
      });
      if (existing === null) {
        return sendNotFound(reply, 'Message report not found');
      }

      const report = await prisma.messageReport.update({
        where: { id: request.params.id },
        data: {
          status: request.body.status,
          reviewedAt: new Date(),
          reviewedByUserId: request.access.userId,
        },
        select: reportSelect,
      });

      return ok(mapMessageReport(report));
    },
  );
};

export default adminRoutes;
