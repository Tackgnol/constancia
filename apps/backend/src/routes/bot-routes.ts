import type { FastifyPluginAsync } from 'fastify';
import {
  botTestResultBodySchema,
  botTestResultResponseSchema,
  campaignSchema,
  channelParamsSchema,
  gameEventSchema,
  guildParamsSchema,
  listResponseSchema,
  singleResponseSchema,
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
      const body = request.body;
      return {
        status: 'stub',
        data: {
          eventId: body.eventId,
          campaignId: body.campaignId,
          messages: [],
          halted: false,
        },
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
    async (request) => {
      const params = request.params;
      return {
        status: 'stub',
        data: {
          id: 'campaign-1',
          name: 'Chicago by Night',
          discordGuildId: params.guildId,
          gameSystemId: 'vtm-v5',
        },
      };
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
      const params = request.params;
      return {
        status: 'stub',
        data: [
          {
            id: 'event-1',
            name: 'Spot The Sigil',
            type: 'test',
            channelId: params.channelId,
            campaignId: 'campaign-1',
            status: 'ready',
            shortCircuit: false,
            pipeline: [],
          },
        ],
      };
    },
  );
};

export default botRoutes;
