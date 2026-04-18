import type { FastifyPluginAsync } from 'fastify';
import {
  campaignParamsSchema,
  discordTargetParamsSchema,
  npcBodySchema,
  npcFactBodySchema,
  npcPatchBodySchema,
  npcParamsSchema,
  npcRevealBodySchema,
  standardResponseSchema,
} from '../schemas.js';

interface CampaignParams {
  id: string;
}

interface NpcParams {
  id: string;
  npcId: string;
}

interface DiscordTargetParams {
  id: string;
  discordId: string;
}

interface NpcBody {
  name: string;
  imageUrl?: string;
  description?: string;
}

interface NpcPatchBody {
  name?: string;
  imageUrl?: string;
  description?: string;
}

interface NpcFactBody {
  content: string;
  sortOrder?: number;
}

interface NpcRevealBody {
  npcFactIds: string[];
  discordUserIds: string[];
}

const sampleNpc = {
  id: 'npc-1',
  name: 'Regent Hale',
  imageUrl: 'https://example.com/regent-hale.png',
  description: 'A composed Tremere regent.',
};

const npcRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      schema: {
        tags: ['npcs'],
        summary: 'List campaign NPCs',
        operationId: 'listNpcs',
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
        data: [{ ...sampleNpc, campaignId: params.id }],
      };
    },
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['npcs'],
        summary: 'Create an NPC',
        operationId: 'createNpc',
        params: campaignParamsSchema,
        body: npcBodySchema,
        response: {
          201: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as CampaignParams;
      const body = request.body as NpcBody;
      reply.code(201);
      return {
        status: 'stub',
        data: {
          id: 'npc-new',
          campaignId: params.id,
          ...body,
        },
      };
    },
  );

  app.patch(
    '/:npcId',
    {
      schema: {
        tags: ['npcs'],
        summary: 'Update an NPC',
        operationId: 'updateNpc',
        params: npcParamsSchema,
        body: npcPatchBodySchema,
        response: {
          200: standardResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as NpcParams;
      const body = request.body as NpcPatchBody;
      return {
        status: 'stub',
        data: {
          ...sampleNpc,
          id: params.npcId,
          campaignId: params.id,
          ...body,
        },
      };
    },
  );

  app.post(
    '/:npcId/facts',
    {
      schema: {
        tags: ['npcs'],
        summary: 'Add an NPC fact',
        operationId: 'createNpcFact',
        params: npcParamsSchema,
        body: npcFactBodySchema,
        response: {
          201: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as NpcParams;
      const body = request.body as NpcFactBody;
      reply.code(201);
      return {
        status: 'stub',
        data: {
          id: 'fact-new',
          npcId: params.npcId,
          ...body,
        },
      };
    },
  );

  app.post(
    '/:npcId/reveal',
    {
      schema: {
        tags: ['npcs'],
        summary: 'Reveal NPC facts to players',
        operationId: 'revealNpcFacts',
        params: npcParamsSchema,
        body: npcRevealBodySchema,
        response: {
          200: standardResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as NpcParams;
      const body = request.body as NpcRevealBody;
      return {
        status: 'stub',
        data: {
          npcId: params.npcId,
          ...body,
        },
      };
    },
  );

  app.get(
    '/for/:discordId',
    {
      schema: {
        tags: ['npcs'],
        summary: 'List NPCs visible to a player',
        operationId: 'listVisibleNpcsForPlayer',
        params: discordTargetParamsSchema,
        response: {
          200: standardResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as DiscordTargetParams;
      return {
        status: 'stub',
        data: [
          {
            ...sampleNpc,
            campaignId: params.id,
            visibleTo: params.discordId,
            facts: ['Knows the chantry sigil.'],
          },
        ],
      };
    },
  );
};

export default npcRoutes;
