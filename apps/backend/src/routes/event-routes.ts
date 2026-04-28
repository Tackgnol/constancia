import type { FastifyPluginAsync } from 'fastify';
import type { Prisma, EventStatus } from '@constancia/db';
import type { BlockInstance, BlockMessage } from '@constancia/contracts';
import { PipelineRunner } from '@constancia/core';
import { getPrismaClient } from '../auth/prisma.js';
import { buildBlockRegistry } from '../blocks.js';
import { sendMessagesToBotAsync } from '../services/bot-client.js';
import { filterInsightResolutionPipeline, resolveInsightScore } from '../services/insight-event.js';
import { buildTestInstancePayload } from '../services/test-instance.js';
import {
  campaignParamsSchema,
  eventBodySchema,
  eventParamsSchema,
  eventPatchBodySchema,
  fireEventResultSchema,
  gameEventSchema,
  listResponseSchema,
  singleResponseSchema,
} from '../schemas.js';

interface CampaignParams {
  id: string;
}

interface EventParams {
  id: string;
  eventId: string;
}

interface EventBlockInput {
  blockType: string;
  config: Record<string, unknown>;
}

interface EventBody {
  name: string;
  type: string;
  channelId: string;
  shortCircuit?: boolean;
  pipeline: EventBlockInput[];
}

interface EventPatchBody {
  name?: string;
  status?: string;
  shortCircuit?: boolean;
  pipeline?: EventBlockInput[];
}

const eventSelect = {
  id: true,
  name: true,
  type: true,
  channelId: true,
  campaignId: true,
  status: true,
  shortCircuit: true,
  pipeline: true,
} as const;

const eventRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: CampaignParams }>(
    '/',
    {
      schema: {
        tags: ['events'],
        summary: 'List events',
        operationId: 'listEvents',
        params: campaignParamsSchema,
        response: {
          200: listResponseSchema(gameEventSchema),
        },
      },
    },
    async (request) => {
      const prisma = getPrismaClient();
      const { id } = request.params;
      const events = await prisma.event.findMany({
        where: { campaignId: id },
        select: eventSelect,
      });
      return { status: 'ok', data: events };
    },
  );

  app.post<{ Params: CampaignParams; Body: EventBody }>(
    '/',
    {
      schema: {
        tags: ['events'],
        summary: 'Create an event',
        operationId: 'createEvent',
        params: campaignParamsSchema,
        body: eventBodySchema,
        response: {
          201: singleResponseSchema(gameEventSchema),
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      const { id } = request.params;
      const { name, type, channelId, shortCircuit, pipeline } = request.body;
      const event = await prisma.event.create({
        data: {
          name,
          type,
          channelId,
          campaignId: id,
          shortCircuit: shortCircuit ?? false,
          pipeline: pipeline as unknown as Prisma.InputJsonValue,
          status: 'draft',
        },
        select: eventSelect,
      });
      reply.code(201);
      return { status: 'ok', data: event };
    },
  );

  app.get<{ Params: EventParams }>(
    '/:eventId',
    {
      schema: {
        tags: ['events'],
        summary: 'Get an event',
        operationId: 'getEvent',
        params: eventParamsSchema,
        response: {
          200: singleResponseSchema(gameEventSchema),
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      const { eventId } = request.params;
      const event = await prisma.event.findUnique({ where: { id: eventId }, select: eventSelect });
      if (event === null) {
        return reply.code(404).send({ status: 'error', data: { message: 'Event not found' } });
      }
      return { status: 'ok', data: event };
    },
  );

  app.patch<{ Params: EventParams; Body: EventPatchBody }>(
    '/:eventId',
    {
      schema: {
        tags: ['events'],
        summary: 'Update an event',
        operationId: 'updateEvent',
        params: eventParamsSchema,
        body: eventPatchBodySchema,
        response: {
          200: singleResponseSchema(gameEventSchema),
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      const { eventId } = request.params;
      const { name, status, shortCircuit, pipeline } = request.body;
      const data: Prisma.EventUpdateInput = {};
      if (name !== undefined) data.name = name;
      if (status !== undefined) data.status = status as EventStatus;
      if (shortCircuit !== undefined) data.shortCircuit = shortCircuit;
      if (pipeline !== undefined) data.pipeline = pipeline as unknown as Prisma.InputJsonValue;
      try {
        const event = await prisma.event.update({
          where: { id: eventId },
          data,
          select: eventSelect,
        });
        return { status: 'ok', data: event };
      } catch (err) {
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: unknown }).code === 'P2025'
        ) {
          return reply.code(404).send({ status: 'error', data: { message: 'Event not found' } });
        }
        throw err;
      }
    },
  );

  app.post<{ Params: EventParams }>(
    '/:eventId/fire',
    {
      schema: {
        tags: ['events'],
        summary: 'Fire an event pipeline',
        operationId: 'fireEvent',
        params: eventParamsSchema,
        response: {
          200: singleResponseSchema(fireEventResultSchema),
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      const { eventId } = request.params;
      const event = await prisma.event.findUnique({ where: { id: eventId }, select: eventSelect });
      if (event === null) {
        return reply.code(404).send({ status: 'error', data: { message: 'Event not found' } });
      }

      const channel = await prisma.channel.findUnique({
        where: { id: event.channelId },
        select: { discordChannelId: true },
      });
      if (channel === null) {
        request.log.warn(
          { eventId, channelId: event.channelId },
          'Skipping bot delivery: channel not found',
        );
      } else if (event.type === 'test') {
        const testInstance = buildTestInstancePayload(event, channel.discordChannelId);
        if (testInstance === null) {
          request.log.warn(
            { eventId },
            'Skipping test-instance delivery: no threshold mapping found',
          );
        } else {
          const config = app.config;
          void sendMessagesToBotAsync(config.botInternalUrl, config.botApiKey, testInstance);
        }
      } else if (event.type === 'insight') {
        const characters = await prisma.character.findMany({
          where: { campaignId: event.campaignId },
          select: {
            discordUserId: true,
            systemData: true,
          },
        });

        const registry = buildBlockRegistry();
        const runner = new PipelineRunner(registry);
        const eventPipeline = event.pipeline as unknown as BlockInstance[];
        const filteredPipeline = filterInsightResolutionPipeline(eventPipeline);
        const insightMessages: BlockMessage[] = [];

        if (filteredPipeline.length === eventPipeline.length) {
          request.log.warn(
            { eventId },
            'Skipping insight delivery: no supported insight resolver found',
          );
          return {
            status: 'ok',
            data: {
              eventId,
              messages: [],
              halted: false,
            },
          };
        }

        for (const character of characters) {
          const characterData = (character.systemData ?? {}) as Record<string, unknown>;
          const scoreResult = resolveInsightScore(eventPipeline, characterData);

          if (scoreResult === null) {
            continue;
          }

          const result = await runner.run(filteredPipeline, {
            campaignId: event.campaignId,
            channelId: event.channelId,
            playerId: character.discordUserId,
            playerScore: scoreResult.score,
            characterData,
          });

          insightMessages.push(...result.messages);
        }

        if (insightMessages.length > 0) {
          const config = app.config;
          void sendMessagesToBotAsync(config.botInternalUrl, config.botApiKey, {
            kind: 'messages',
            eventId,
            discordChannelId: channel.discordChannelId,
            messages: insightMessages,
          });
        }

        return {
          status: 'ok',
          data: {
            eventId,
            messages: insightMessages,
            halted: false,
          },
        };
      } else {
        const registry = buildBlockRegistry();
        const runner = new PipelineRunner(registry);
        const result = await runner.run(event.pipeline as unknown as BlockInstance[], {
          campaignId: event.campaignId,
          channelId: event.channelId,
          playerId: 'system',
          characterData: {},
        });

        if (result.messages.length > 0) {
          const config = app.config;
          void sendMessagesToBotAsync(config.botInternalUrl, config.botApiKey, {
            kind: 'messages',
            eventId,
            discordChannelId: channel.discordChannelId,
            messages: result.messages,
          });
        }

        return {
          status: 'ok',
          data: {
            eventId,
            messages: result.messages,
            halted: result.halted,
          },
        };
      }

      return {
        status: 'ok',
        data: {
          eventId,
          messages: [],
          halted: false,
        },
      };
    },
  );
};

export default eventRoutes;
