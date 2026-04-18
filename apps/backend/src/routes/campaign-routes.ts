import type { FastifyPluginAsync } from 'fastify';
import {
  campaignBodySchema,
  campaignParamsSchema,
  campaignPatchBodySchema,
  campaignSchema,
  listResponseSchema,
  singleResponseSchema,
} from '../schemas.js';

interface CampaignParams {
  id: string;
}

interface CampaignBody {
  name: string;
  discordGuildId: string;
  gameSystemId: string;
}

interface CampaignPatchBody {
  name?: string;
  gameSystemId?: string;
}

const sampleCampaign = {
  id: 'campaign-1',
  name: 'Chicago by Night',
  discordGuildId: 'guild-1',
  gameSystemId: 'vtm-v5',
};

const campaignRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      schema: {
        tags: ['campaigns'],
        summary: 'List campaigns',
        operationId: 'listCampaigns',
        response: {
          200: listResponseSchema(campaignSchema),
        },
      },
    },
    async () => ({
      status: 'stub',
      data: [sampleCampaign],
    }),
  );

  app.post<{ Body: CampaignBody }>(
    '/',
    {
      schema: {
        tags: ['campaigns'],
        summary: 'Create a campaign',
        operationId: 'createCampaign',
        body: campaignBodySchema,
        response: {
          201: singleResponseSchema(campaignSchema),
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      reply.code(201);
      return {
        status: 'stub',
        data: {
          id: 'campaign-new',
          ...body,
        },
      };
    },
  );

  app.get<{ Params: CampaignParams }>(
    '/:id',
    {
      schema: {
        tags: ['campaigns'],
        summary: 'Get campaign details',
        operationId: 'getCampaign',
        params: campaignParamsSchema,
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
          ...sampleCampaign,
          id: params.id,
        },
      };
    },
  );

  app.patch<{ Params: CampaignParams; Body: CampaignPatchBody }>(
    '/:id',
    {
      schema: {
        tags: ['campaigns'],
        summary: 'Update a campaign',
        operationId: 'updateCampaign',
        params: campaignParamsSchema,
        body: campaignPatchBodySchema,
        response: {
          200: singleResponseSchema(campaignSchema),
        },
      },
    },
    async (request) => {
      const params = request.params;
      const body = request.body;
      return {
        status: 'stub',
        data: {
          ...sampleCampaign,
          id: params.id,
          ...body,
        },
      };
    },
  );
};

export default campaignRoutes;
