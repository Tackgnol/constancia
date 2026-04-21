import type { FastifyPluginAsync } from 'fastify';
import type { ChannelType } from '@constancia/db';
import { getPrismaClient } from '../auth/prisma.js';
import {
  campaignChannelParamsSchema,
  campaignParamsSchema,
  channelBodySchema,
  channelPatchBodySchema,
  channelSchema,
  deleteResponseSchema,
  listResponseSchema,
  singleResponseSchema,
} from '../schemas.js';

interface CampaignParams {
  id: string;
}

interface ChannelParams {
  id: string;
  chanId: string;
}

interface ChannelBody {
  name: string;
  discordChannelId: string;
  type?: ChannelType;
}

interface ChannelPatchBody {
  name?: string;
  type?: ChannelType;
}

const select = {
  id: true,
  name: true,
  discordChannelId: true,
  campaignId: true,
  type: true,
} as const;

const channelRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: CampaignParams }>(
    '/',
    {
      schema: {
        tags: ['channels'],
        summary: 'List channels for a campaign',
        operationId: 'listChannels',
        params: campaignParamsSchema,
        response: {
          200: listResponseSchema(channelSchema),
        },
      },
    },
    async (request) => {
      const prisma = getPrismaClient();
      const { id } = request.params;
      const channels = await prisma.channel.findMany({ where: { campaignId: id }, select });
      return { status: 'ok', data: channels };
    },
  );

  app.post<{ Params: CampaignParams; Body: ChannelBody }>(
    '/',
    {
      schema: {
        tags: ['channels'],
        summary: 'Register a Discord channel with a campaign',
        operationId: 'createChannel',
        params: campaignParamsSchema,
        body: channelBodySchema,
        response: {
          201: singleResponseSchema(channelSchema),
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      const { id } = request.params;
      const { name, discordChannelId, type } = request.body;
      const channel = await prisma.channel.create({
        data: { name, discordChannelId, campaignId: id, type: type ?? 'main' },
        select,
      });
      reply.code(201);
      return { status: 'ok', data: channel };
    },
  );

  app.patch<{ Params: ChannelParams; Body: ChannelPatchBody }>(
    '/:chanId',
    {
      schema: {
        tags: ['channels'],
        summary: 'Update a channel',
        operationId: 'updateChannel',
        params: campaignChannelParamsSchema,
        body: channelPatchBodySchema,
        response: {
          200: singleResponseSchema(channelSchema),
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      const { chanId } = request.params;
      const { name, type } = request.body;
      const data: { name?: string; type?: ChannelType } = {};
      if (name !== undefined) data.name = name;
      if (type !== undefined) data.type = type;
      try {
        const channel = await prisma.channel.update({ where: { id: chanId }, data, select });
        return { status: 'ok', data: channel };
      } catch (err) {
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: unknown }).code === 'P2025'
        ) {
          return reply.code(404).send({ status: 'error', data: { message: 'Channel not found' } });
        }
        throw err;
      }
    },
  );

  app.delete<{ Params: ChannelParams }>(
    '/:chanId',
    {
      schema: {
        tags: ['channels'],
        summary: 'Delete a channel',
        operationId: 'deleteChannel',
        params: campaignChannelParamsSchema,
        response: {
          200: deleteResponseSchema,
        },
      },
    },
    async (request) => {
      const prisma = getPrismaClient();
      const { chanId } = request.params;
      try {
        await prisma.channel.delete({ where: { id: chanId } });
        return { status: 'ok', deleted: true };
      } catch (err) {
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: unknown }).code === 'P2025'
        ) {
          return { status: 'ok', deleted: false };
        }
        throw err;
      }
    },
  );
};

export default channelRoutes;
