import { createHash } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import type { BlockMessage } from '@constancia/contracts';
import { getPrismaClient } from '../auth/prisma.js';
import { ok, sendError, sendNotFound } from '../http-responses.js';
import { createHttpBotDeliveryPort } from '../services/bot-delivery-port.js';
import { deliverAdHocChannelMessage } from '../services/ad-hoc-channel-message.js';
import { moderatePayloadText } from '../services/content-moderation.js';
import {
  campaignParamsSchema,
  channelMessageBodySchema,
  channelMessageResultSchema,
  idempotencyKeyHeaderSchema,
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

interface ChannelMessageBody {
  channelId: string;
  content: string;
  imageUrl?: string;
}

interface IdempotencyHeaders {
  'idempotency-key': string;
}

function uniqueTrimmedIds(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

const messageRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Params: CampaignParams;
    Body: ChannelMessageBody;
    Headers: IdempotencyHeaders;
  }>(
    '/channel',
    {
      schema: {
        tags: ['messages'],
        summary: 'Send an ad-hoc narration to a campaign channel',
        operationId: 'sendChannelMessage',
        params: campaignParamsSchema,
        headers: idempotencyKeyHeaderSchema,
        body: channelMessageBodySchema,
        response: {
          200: singleResponseSchema(channelMessageResultSchema),
          400: standardResponseSchema,
          404: standardResponseSchema,
          503: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      await moderatePayloadText(app.config, request.body);
      const campaignId = request.campaignScope.campaignId;
      const { channelId, content, imageUrl } = request.body;
      const channel = await prisma.channel.findFirst({
        where: { id: channelId, campaignId },
        select: { discordChannelId: true },
      });

      if (channel === null) {
        return sendNotFound(reply, 'Channel not found');
      }

      const result = await deliverAdHocChannelMessage(
        createHttpBotDeliveryPort({
          botInternalUrl: app.config.botInternalUrl,
          botApiKey: app.config.botApiKey,
        }),
        {
          campaignId,
          channelId,
          discordChannelId: channel.discordChannelId,
          content,
          idempotencyKey: request.headers['idempotency-key'],
          ...(imageUrl ? { imageUrl } : {}),
        },
      );

      if (result.delivery.status !== 'delivered') {
        return sendError(
          reply,
          503,
          'Discord delivery is temporarily unavailable. Retry the same narration.',
        );
      }

      return ok({
        campaignId,
        channelId,
        delivered: result.delivery.delivered,
        skipped: result.delivery.skipped,
      });
    },
  );

  app.post<{
    Params: CampaignParams;
    Body: PlayerMessageBody;
    Headers: IdempotencyHeaders;
  }>(
    '/players',
    {
      schema: {
        tags: ['messages'],
        summary: 'Send an ad-hoc message to selected players',
        operationId: 'sendPlayerMessage',
        params: campaignParamsSchema,
        headers: idempotencyKeyHeaderSchema,
        body: playerMessageBodySchema,
        response: {
          200: singleResponseSchema(playerMessageResultSchema),
          400: standardResponseSchema,
          404: standardResponseSchema,
          503: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      await moderatePayloadText(app.config, request.body);
      const campaignId = request.campaignScope.campaignId;
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

      const idempotencyKey = request.headers['idempotency-key'];
      const deliveryId = createHash('sha256')
        .update(`ad-hoc:${campaignId}:${idempotencyKey}`)
        .digest('base64url')
        .slice(0, 25);
      const delivery = await createHttpBotDeliveryPort({
        botInternalUrl: app.config.botInternalUrl,
        botApiKey: app.config.botApiKey,
      }).deliver({
        deliveryId,
        payload: {
          kind: 'messages',
          eventId: `ad-hoc-${deliveryId}`,
          discordChannelId: channel.discordChannelId,
          messages: [message],
        },
      });

      if (delivery.status === 'failed') {
        return sendError(
          reply,
          503,
          'Discord delivery is temporarily unavailable. Retry the same whisper.',
        );
      }

      return ok({
        campaignId,
        channelId,
        deliveredTo: discordUserIds,
      });
    },
  );
};

export default messageRoutes;
