import type { FastifyPluginAsync } from 'fastify';
import {
  campaignParamsSchema,
  eventBodySchema,
  eventParamsSchema,
  eventPatchBodySchema,
  standardResponseSchema,
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

const sampleEvent = {
  id: 'event-1',
  name: 'Spot The Sigil',
  type: 'test',
  channelId: 'channel-1',
  status: 'ready',
  shortCircuit: true,
  pipeline: [
    {
      blockType: 'vtm-pool-resolver',
      config: { attribute: 'wits', skill: 'awareness', difficulty: 3 },
    },
  ],
};

const eventRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      schema: {
        tags: ['events'],
        summary: 'List events',
        operationId: 'listEvents',
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
        data: [{ ...sampleEvent, campaignId: params.id }],
      };
    },
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['events'],
        summary: 'Create an event',
        operationId: 'createEvent',
        params: campaignParamsSchema,
        body: eventBodySchema,
        response: {
          201: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as CampaignParams;
      const body = request.body as EventBody;
      reply.code(201);
      return {
        status: 'stub',
        data: {
          id: 'event-new',
          campaignId: params.id,
          status: 'draft',
          ...body,
        },
      };
    },
  );

  app.patch(
    '/:eventId',
    {
      schema: {
        tags: ['events'],
        summary: 'Update an event',
        operationId: 'updateEvent',
        params: eventParamsSchema,
        body: eventPatchBodySchema,
        response: {
          200: standardResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as EventParams;
      const body = request.body as EventPatchBody;
      return {
        status: 'stub',
        data: {
          ...sampleEvent,
          id: params.eventId,
          campaignId: params.id,
          ...body,
        },
      };
    },
  );

  app.post(
    '/:eventId/fire',
    {
      schema: {
        tags: ['events'],
        summary: 'Fire an event pipeline',
        operationId: 'fireEvent',
        params: eventParamsSchema,
        response: {
          200: standardResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as EventParams;
      return {
        status: 'stub',
        data: {
          fired: true,
          eventId: params.eventId,
          campaignId: params.id,
        },
      };
    },
  );
};

export default eventRoutes;
