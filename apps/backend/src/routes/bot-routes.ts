import type { FastifyPluginAsync } from 'fastify';
import { getPrismaClient } from '../auth/prisma.js';
import { deleted, isPrismaNotFoundError, ok, sendNotFound } from '../http-responses.js';
import {
  botTestResultBodySchema,
  botTestResultResponseSchema,
  botCampaignDateSchema,
  campaignSchema,
  botMessageReportBodySchema,
  campaignDiscordUserParamsSchema,
  channelParamsSchema,
  deleteResponseSchema,
  gameEventSchema,
  journalForPlayerSchema,
  guildParamsSchema,
  listResponseSchema,
  messageReportSchema,
  playerVisibleNpcSchema,
  participantParamsSchema,
  setupChannelBodySchema,
  setupChannelDataSchema,
  singleResponseSchema,
  syncParticipantsBodySchema,
  syncParticipantsDataSchema,
} from '../schemas.js';
import {
  listVisibleNpcRecordsForPlayer,
  mapPlayerVisibleNpc,
} from '../services/player-visible-npcs.js';
import { moderatePayloadText } from '../services/content-moderation.js';
import { getPlayerJournal } from '../services/player-journal.js';
import { formatCampaignGameDate } from '../services/game-date.js';

interface BotTestResultBody {
  eventId: string;
  discordUserId: string;
  discordChannelId: string;
  playerScore: number;
  idempotencyKey: string;
}

interface BotMessageReportBody {
  eventId: string;
  campaignId?: string;
  discordGuildId?: string;
  discordChannelId?: string;
  discordMessageId?: string;
  discordUserId: string;
  messageTarget?: string;
  messageContent?: string;
  imageUrl?: string;
}

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

interface GuildParams {
  guildId: string;
}

interface ChannelParams {
  channelId: string;
}

interface SetupChannelBody {
  guildId: string;
  guildName: string;
  discordChannelId: string;
  channelName: string;
  campaignName: string;
  gameSystemId: string;
}

interface SyncParticipantsBody {
  guildId: string;
  participants: Array<{ discordUserId: string; discordName: string }>;
}

interface ParticipantParams {
  guildId: string;
  discordUserId: string;
}

interface CampaignDiscordUserParams {
  id: string;
  discordUserId: string;
}

const botRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: BotMessageReportBody }>(
    '/message-reports',
    {
      schema: {
        tags: ['bot'],
        summary: 'Store a Discord message report from a player',
        operationId: 'createBotMessageReport',
        body: botMessageReportBodySchema,
        response: {
          201: singleResponseSchema(messageReportSchema),
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      const report = await prisma.messageReport.create({
        data: {
          eventId: request.body.eventId,
          campaignId: request.body.campaignId,
          discordGuildId: request.body.discordGuildId,
          discordChannelId: request.body.discordChannelId,
          discordMessageId: request.body.discordMessageId,
          discordUserId: request.body.discordUserId,
          messageTarget: request.body.messageTarget,
          messageContent: request.body.messageContent ?? '',
          imageUrl: request.body.imageUrl,
        },
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

      reply.code(201);
      return ok(mapMessageReport(report));
    },
  );

  app.post<{ Body: BotTestResultBody }>(
    '/test-result',
    {
      schema: {
        tags: ['bot'],
        summary: 'Submit a player test result',
        operationId: 'submitBotTestResult',
        body: botTestResultBodySchema,
        response: {
          200: singleResponseSchema(botTestResultResponseSchema),
        },
      },
    },
    async (request) => {
      const { eventId, discordUserId, discordChannelId, playerScore, idempotencyKey } =
        request.body;
      const receipt = await app.eventExecution.submitTestResult({
        eventId,
        discordUserId,
        discordChannelId,
        playerScore,
        idempotencyKey,
      });
      return ok(receipt);
    },
  );

  app.get<{ Params: GuildParams }>(
    '/campaign-by-guild/:guildId',
    {
      schema: {
        tags: ['bot'],
        summary: 'Resolve guild to campaign',
        operationId: 'getCampaignByGuild',
        params: guildParamsSchema,
        response: {
          200: singleResponseSchema(campaignSchema),
        },
      },
    },
    async (request, reply) => {
      const { guildId } = request.params;
      const prisma = getPrismaClient();

      const campaign = await prisma.campaign.findUnique({
        where: { discordGuildId: guildId },
        select: {
          id: true,
          name: true,
          discordGuildId: true,
          gameSystemId: true,
          gameDate: true,
        },
      });
      if (!campaign) {
        return sendNotFound(reply, 'Campaign not found');
      }

      return ok(campaign);
    },
  );

  app.get<{ Params: GuildParams }>(
    '/campaign-date/:guildId',
    {
      schema: {
        tags: ['bot'],
        summary: 'Get the current campaign date formatted for Discord',
        operationId: 'getBotCampaignDate',
        params: guildParamsSchema,
        response: {
          200: singleResponseSchema(botCampaignDateSchema),
        },
      },
    },
    async (request, reply) => {
      const campaign = await getPrismaClient().campaign.findUnique({
        where: { discordGuildId: request.params.guildId },
        select: { gameSystemId: true, gameDate: true },
      });
      if (!campaign) {
        return sendNotFound(reply, 'Campaign not found');
      }

      return ok({
        formatted: formatCampaignGameDate(campaign.gameSystemId, campaign.gameDate),
      });
    },
  );

  app.get<{ Params: CampaignDiscordUserParams }>(
    '/campaigns/:id/visible-npcs/:discordUserId',
    {
      schema: {
        tags: ['bot'],
        summary: 'List NPCs visible to a Discord player',
        operationId: 'listBotVisibleNpcsForPlayer',
        params: campaignDiscordUserParamsSchema,
        response: {
          200: listResponseSchema(playerVisibleNpcSchema),
        },
      },
    },
    async (request) => {
      const prisma = getPrismaClient();
      const { id, discordUserId } = request.params;
      const npcs = await listVisibleNpcRecordsForPlayer(prisma, id, discordUserId);

      return ok(npcs.map(mapPlayerVisibleNpc));
    },
  );

  app.get<{ Params: CampaignDiscordUserParams }>(
    '/campaigns/:id/journal/:discordUserId',
    {
      schema: {
        tags: ['bot'],
        summary: 'Get player journal for a Discord player',
        operationId: 'getBotJournalForPlayer',
        params: campaignDiscordUserParamsSchema,
        response: {
          200: singleResponseSchema(journalForPlayerSchema),
        },
      },
    },
    async (request) => {
      const prisma = getPrismaClient();
      const { id, discordUserId } = request.params;

      return ok(await getPlayerJournal(prisma, id, discordUserId));
    },
  );

  app.get<{ Params: ChannelParams }>(
    '/channel-events/:channelId',
    {
      schema: {
        tags: ['bot'],
        summary: 'Get active channel events',
        operationId: 'getChannelEvents',
        params: channelParamsSchema,
        response: {
          200: listResponseSchema(gameEventSchema),
        },
      },
    },
    async (request) => {
      const { channelId } = request.params;
      const prisma = getPrismaClient();

      const events = await prisma.event.findMany({
        where: {
          channel: { discordChannelId: channelId },
          status: 'ready',
        },
        select: {
          id: true,
          name: true,
          type: true,
          channelId: true,
          campaignId: true,
          status: true,
          shortCircuit: true,
          pipeline: true,
        },
      });

      return ok(events);
    },
  );

  app.post<{ Body: SetupChannelBody }>(
    '/setup-channel',
    {
      schema: {
        tags: ['bot'],
        summary: 'Upsert campaign and channel from Discord context',
        operationId: 'setupChannel',
        body: setupChannelBodySchema,
        response: {
          200: singleResponseSchema(setupChannelDataSchema),
        },
      },
    },
    async (request) => {
      const prisma = getPrismaClient();
      await moderatePayloadText(app.config, request.body);
      const { guildId, discordChannelId, channelName, campaignName, gameSystemId } = request.body;

      const existingCampaign = await prisma.campaign.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true },
      });

      const campaign = await prisma.campaign.upsert({
        where: { discordGuildId: guildId },
        create: { name: campaignName, discordGuildId: guildId, gameSystemId },
        update: {},
        select: {
          id: true,
          name: true,
          discordGuildId: true,
          gameSystemId: true,
          gameDate: true,
        },
      });

      const existingChannel = await prisma.channel.findUnique({
        where: { discordChannelId },
        select: { id: true },
      });

      const channel = await prisma.channel.upsert({
        where: { discordChannelId },
        create: { name: channelName, discordChannelId, campaignId: campaign.id, type: 'main' },
        update: {},
        select: { id: true, name: true, discordChannelId: true, campaignId: true, type: true },
      });

      return ok({
        campaign,
        channel,
        created: {
          campaign: existingCampaign === null,
          channel: existingChannel === null,
        },
      });
    },
  );

  app.post<{ Body: SyncParticipantsBody }>(
    '/sync-participants',
    {
      schema: {
        tags: ['bot'],
        summary: 'Upsert campaign participants from Discord users',
        operationId: 'syncParticipants',
        body: syncParticipantsBodySchema,
        response: {
          200: singleResponseSchema(syncParticipantsDataSchema),
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      await moderatePayloadText(app.config, request.body);
      const { guildId, participants } = request.body;

      const campaign = await prisma.campaign.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true },
      });
      if (!campaign) {
        return sendNotFound(reply, 'Campaign not found. Run /setup first.');
      }

      await prisma.$transaction(
        participants.map((p) =>
          prisma.character.upsert({
            where: {
              discordUserId_campaignId: { discordUserId: p.discordUserId, campaignId: campaign.id },
            },
            create: {
              discordUserId: p.discordUserId,
              discordName: p.discordName,
              gameName: '',
              name: p.discordName,
              campaignId: campaign.id,
              backstory: '',
              notes: '',
              systemData: {},
            },
            update: {
              discordName: p.discordName,
              name: p.discordName,
              // gameName intentionally omitted — GM owns that field
            },
          }),
        ),
      );

      return ok({ campaignId: campaign.id, upserted: participants.length });
    },
  );

  app.delete<{ Params: ParticipantParams }>(
    '/participant/:guildId/:discordUserId',
    {
      schema: {
        tags: ['bot'],
        summary: 'Remove a participant from a campaign',
        operationId: 'removeParticipant',
        params: participantParamsSchema,
        response: {
          200: deleteResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      const { guildId, discordUserId } = request.params;

      const campaign = await prisma.campaign.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true },
      });
      if (!campaign) {
        return sendNotFound(reply, 'Campaign not found.');
      }

      try {
        await prisma.character.delete({
          where: { discordUserId_campaignId: { discordUserId, campaignId: campaign.id } },
        });
        return deleted(true);
      } catch (err) {
        if (isPrismaNotFoundError(err)) {
          return sendNotFound(reply, 'Participant not found.');
        }
        throw err;
      }
    },
  );
};

export default botRoutes;
