import type { BlockInstance } from '@constancia/contracts';
import { PipelineRunner } from '@constancia/core';
import type { EventStatus } from '@constancia/db';
import type { FastifyPluginAsync } from 'fastify';
import { getPrismaClient } from '../auth/prisma.js';
import { buildBlockRegistry } from '../blocks.js';
import {
  botTestResultBodySchema,
  botTestResultResponseSchema,
  campaignSchema,
  campaignDiscordUserParamsSchema,
  channelParamsSchema,
  deleteResponseSchema,
  gameEventSchema,
  guildParamsSchema,
  listResponseSchema,
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
import { filterManualTestResolutionPipeline } from '../services/test-instance.js';

interface BotTestResultBody {
  eventId: string;
  campaignId: string;
  channelId: string;
  discordUserId: string;
  playerScore: number;
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
    async (request, reply) => {
      const { eventId, campaignId, channelId, discordUserId, playerScore } = request.body;
      const prisma = getPrismaClient();

      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, type: true, pipeline: true, channelId: true, campaignId: true },
      });
      if (!event) {
        return reply.code(404).send({ status: 'error', data: { message: 'Event not found' } });
      }

      const character = await prisma.character.findUnique({
        where: { discordUserId_campaignId: { discordUserId, campaignId } },
        select: { systemData: true },
      });

      const registry = buildBlockRegistry();
      const runner = new PipelineRunner(registry);
      const pipeline =
        event.type === 'test'
          ? filterManualTestResolutionPipeline(event.pipeline as unknown as BlockInstance[])
          : (event.pipeline as unknown as BlockInstance[]);
      const result = await runner.run(pipeline, {
        campaignId,
        channelId,
        playerId: discordUserId,
        playerScore,
        characterData: (character?.systemData ?? {}) as Record<string, unknown>,
      });

      return {
        status: 'ok',
        data: { eventId, campaignId, messages: result.messages, halted: result.halted },
      };
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
        select: { id: true, name: true, discordGuildId: true, gameSystemId: true },
      });
      if (!campaign) {
        return reply.code(404).send({ status: 'error', data: { message: 'Campaign not found' } });
      }

      return { status: 'ok', data: campaign };
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

      return { status: 'ok', data: npcs.map(mapPlayerVisibleNpc) };
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
          status: 'ready' as EventStatus,
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

      return { status: 'ok', data: events };
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
      const { guildId, discordChannelId, channelName, campaignName, gameSystemId } = request.body;

      const existingCampaign = await prisma.campaign.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true },
      });

      const campaign = await prisma.campaign.upsert({
        where: { discordGuildId: guildId },
        create: { name: campaignName, discordGuildId: guildId, gameSystemId },
        update: {},
        select: { id: true, name: true, discordGuildId: true, gameSystemId: true },
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

      return {
        status: 'ok',
        data: {
          campaign,
          channel,
          created: {
            campaign: existingCampaign === null,
            channel: existingChannel === null,
          },
        },
      };
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
      const { guildId, participants } = request.body;

      const campaign = await prisma.campaign.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true },
      });
      if (!campaign) {
        return reply
          .code(404)
          .send({ status: 'error', data: { message: 'Campaign not found. Run /setup first.' } });
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

      return { status: 'ok', data: { campaignId: campaign.id, upserted: participants.length } };
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
        return reply.code(404).send({ status: 'error', data: { message: 'Campaign not found.' } });
      }

      try {
        await prisma.character.delete({
          where: { discordUserId_campaignId: { discordUserId, campaignId: campaign.id } },
        });
        return { status: 'ok', deleted: true };
      } catch (err) {
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: unknown }).code === 'P2025'
        ) {
          return reply
            .code(404)
            .send({ status: 'error', data: { message: 'Participant not found.' } });
        }
        throw err;
      }
    },
  );
};

export default botRoutes;
