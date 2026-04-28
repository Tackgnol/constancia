import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import type { BlockMessage } from '@constancia/contracts';
import { getPrismaClient } from '../auth/prisma.js';
import { sendMessagesToBotAsync } from '../services/bot-client.js';
import {
  campaignParamsSchema,
  playerMessageBodySchema,
  playerMessageResultSchema,
  singleResponseSchema,
  standardResponseSchema,
} from '../schemas.js';

interface CampaignParams {
  id: string;
}

interface PlayerMessageBody {
  channelId: string;
  discordUserIds: string[];
  content: string;
  imageUrl?: string;
}

function uniqueTrimmedIds(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

const messageRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: CampaignParams; Body: PlayerMessageBody }>(
    '/players',
    {
      schema: {
        tags: ['messages'],
        summary: 'Send an ad-hoc message to selected players',
        operationId: 'sendPlayerMessage',
        params: campaignParamsSchema,
        body: playerMessageBodySchema,
        response: {
          200: singleResponseSchema(playerMessageResultSchema),
          400: standardResponseSchema,
          404: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      const { id: campaignId } = request.params;
      const { channelId, content, imageUrl } = request.body;
      const discordUserIds = uniqueTrimmedIds(request.body.discordUserIds);

      if (discordUserIds.length === 0) {
        return reply
          .code(400)
          .send({ status: 'error', data: { message: 'At least one player is required' } });
      }

      const channel = await prisma.channel.findFirst({
        where: { id: channelId, campaignId },
        select: { discordChannelId: true },
      });

      if (channel === null) {
        return reply.code(404).send({ status: 'error', data: { message: 'Channel not found' } });
      }

      const message: BlockMessage =
        discordUserIds.length === 1
          ? {
              target: 'player',
              targetId: discordUserIds[0],
              content,
              ...(imageUrl ? { imageUrl } : {}),
            }
          : {
              target: 'group',
              targetIds: discordUserIds,
              content,
              ...(imageUrl ? { imageUrl } : {}),
            };

      await sendMessagesToBotAsync(app.config.botInternalUrl, app.config.botApiKey, {
        kind: 'messages',
        eventId: `ad-hoc-${randomUUID()}`,
        discordChannelId: channel.discordChannelId,
        messages: [message],
      });

      return {
        status: 'ok',
        data: {
          campaignId,
          channelId,
          deliveredTo: discordUserIds,
        },
      };
    },
  );
};

export default messageRoutes;
