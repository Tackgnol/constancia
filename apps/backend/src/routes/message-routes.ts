import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import type { BlockMessage } from '@constancia/contracts';
import { getPrismaClient } from '../auth/prisma.js';
import { ok, sendError, sendNotFound } from '../http-responses.js';
import { sendMessagesToBotAsync } from '../services/bot-client.js';
import { moderatePayloadText } from '../services/content-moderation.js';
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
      await moderatePayloadText(app.config, request.body);
      const { id: campaignId } = request.params;
      const { channelId, content, imageUrl } = request.body;
      const discordUserIds = uniqueTrimmedIds(request.body.discordUserIds);

      if (discordUserIds.length === 0) {
        return sendError(reply, 400, 'At least one player is required');
      }

      const channel = await prisma.channel.findFirst({
        where: { id: channelId, campaignId },
        select: { discordChannelId: true },
      });

      if (channel === null) {
        return sendNotFound(reply, 'Channel not found');
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

      return ok({
        campaignId,
        channelId,
        deliveredTo: discordUserIds,
      });
    },
  );
};

export default messageRoutes;
