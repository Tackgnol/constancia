import type { FastifyPluginAsync } from 'fastify';
import {
  campaignBodySchema,
  campaignParamsSchema,
  campaignPatchBodySchema,
  standardResponseSchema,
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
          200: standardResponseSchema,
        },
      },
    },
    async () => ({
      status: 'stub',
      data: [sampleCampaign],
    }),
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['campaigns'],
        summary: 'Create a campaign',
        operationId: 'createCampaign',
        body: campaignBodySchema,
        response: {
          201: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = request.body as CampaignBody;
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

  app.get(
    '/:id',
    {
      schema: {
        tags: ['campaigns'],
        summary: 'Get campaign details',
        operationId: 'getCampaign',
        params: campaignParamsSchema,
        response: {
          200: standardResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as CampaignParams;
      return {
        status: 'stub',
        data: {
          ...sampleCampaign,
          id: params.id,
        },
      };
    },
  );

  app.patch(
    '/:id',
    {
      schema: {
        tags: ['campaigns'],
        summary: 'Update a campaign',
        operationId: 'updateCampaign',
        params: campaignParamsSchema,
        body: campaignPatchBodySchema,
        response: {
          200: standardResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as CampaignParams;
      const body = request.body as CampaignPatchBody;
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
