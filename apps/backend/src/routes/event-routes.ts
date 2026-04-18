import type { FastifyPluginAsync } from 'fastify';
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

const sampleEvent = {
  id: 'event-1',
  name: 'Spot The Sigil',
  type: 'test',
  channelId: 'channel-1',
  campaignId: 'campaign-1',
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
      const params = request.params;
      return {
        status: 'stub',
        data: [{ ...sampleEvent, campaignId: params.id }],
      };
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
      const params = request.params;
      const body = request.body;
      reply.code(201);
      return {
        status: 'stub',
        data: {
          id: 'event-new',
          campaignId: params.id,
          status: 'draft',
          shortCircuit: body.shortCircuit ?? false,
          ...body,
        },
      };
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
    async (request) => {
      const params = request.params;
      return {
        status: 'stub',
        data: {
          ...sampleEvent,
          id: params.eventId,
          campaignId: params.id,
        },
      };
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
    async (request) => {
      const params = request.params;
      const body = request.body;
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
    async (request) => {
      const params = request.params;
      return {
        status: 'stub',
        data: {
          eventId: params.eventId,
          messages: [],
          halted: false,
        },
      };
    },
  );
};

export default eventRoutes;
