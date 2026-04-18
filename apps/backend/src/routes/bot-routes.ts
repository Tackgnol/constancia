import type { FastifyPluginAsync } from 'fastify';
import {
  botTestResultBodySchema,
  channelParamsSchema,
  guildParamsSchema,
  standardResponseSchema,
} from '../schemas.js';

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

const botRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/test-result',
    {
      schema: {
        tags: ['bot'],
        summary: 'Submit a player test result',
        operationId: 'submitBotTestResult',
        body: botTestResultBodySchema,
        response: {
          200: standardResponseSchema,
        },
      },
    },
    async (request) => {
      const body = request.body as BotTestResultBody;
      return {
        status: 'stub',
        data: {
          accepted: true,
          ...body,
        },
      };
    },
  );

  app.get(
    '/campaign-by-guild/:guildId',
    {
      schema: {
        tags: ['bot'],
        summary: 'Resolve guild to campaign',
        operationId: 'getCampaignByGuild',
        params: guildParamsSchema,
        response: {
          200: standardResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as GuildParams;
      return {
        status: 'stub',
        data: {
          guildId: params.guildId,
          campaignId: 'campaign-1',
          gameSystemId: 'vtm-v5',
        },
      };
    },
  );

  app.get(
    '/channel-events/:channelId',
    {
      schema: {
        tags: ['bot'],
        summary: 'Get active channel events',
        operationId: 'getChannelEvents',
        params: channelParamsSchema,
        response: {
          200: standardResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as ChannelParams;
      return {
        status: 'stub',
        data: [
          {
            id: 'event-1',
            channelId: params.channelId,
            status: 'ready',
          },
        ],
      };
    },
  );
};

export default botRoutes;
