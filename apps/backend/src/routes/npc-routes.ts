import type { FastifyPluginAsync } from 'fastify';
import {
  campaignParamsSchema,
  discordTargetParamsSchema,
  npcBodySchema,
  npcFactBodySchema,
  npcFactSchema,
  npcPatchBodySchema,
  npcParamsSchema,
  npcRevealBodySchema,
  npcSchema,
  npcWithFactsSchema,
  listResponseSchema,
  singleResponseSchema,
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
  campaignId: 'campaign-1',
};

const npcRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: CampaignParams }>(
    '/',
    {
      schema: {
        tags: ['npcs'],
        summary: 'List campaign NPCs',
        operationId: 'listNpcs',
        params: campaignParamsSchema,
        response: {
          200: listResponseSchema(npcSchema),
        },
      },
    },
    async (request) => {
      const params = request.params;
      return {
        status: 'stub',
        data: [{ ...sampleNpc, campaignId: params.id }],
      };
    },
  );

  app.post<{ Params: CampaignParams; Body: NpcBody }>(
    '/',
    {
      schema: {
        tags: ['npcs'],
        summary: 'Create an NPC',
        operationId: 'createNpc',
        params: campaignParamsSchema,
        body: npcBodySchema,
        response: {
          201: singleResponseSchema(npcSchema),
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
          id: 'npc-new',
          description: '',
          campaignId: params.id,
          ...body,
        },
      };
    },
  );

  app.patch<{ Params: NpcParams; Body: NpcPatchBody }>(
    '/:npcId',
    {
      schema: {
        tags: ['npcs'],
        summary: 'Update an NPC',
        operationId: 'updateNpc',
        params: npcParamsSchema,
        body: npcPatchBodySchema,
        response: {
          200: singleResponseSchema(npcSchema),
        },
      },
    },
    async (request) => {
      const params = request.params;
      const body = request.body;
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

  app.post<{ Params: NpcParams; Body: NpcFactBody }>(
    '/:npcId/facts',
    {
      schema: {
        tags: ['npcs'],
        summary: 'Add an NPC fact',
        operationId: 'createNpcFact',
        params: npcParamsSchema,
        body: npcFactBodySchema,
        response: {
          201: singleResponseSchema(npcFactSchema),
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
          id: 'fact-new',
          npcId: params.npcId,
          sortOrder: body.sortOrder ?? 0,
          ...body,
        },
      };
    },
  );

  app.post<{ Params: NpcParams; Body: NpcRevealBody }>(
    '/:npcId/reveal',
    {
      schema: {
        tags: ['npcs'],
        summary: 'Reveal NPC facts to players',
        operationId: 'revealNpcFacts',
        params: npcParamsSchema,
        body: npcRevealBodySchema,
        response: {
          200: singleResponseSchema(npcWithFactsSchema),
        },
      },
    },
    async (request) => {
      const params = request.params;
      return {
        status: 'stub',
        data: {
          ...sampleNpc,
          id: params.npcId,
          campaignId: params.id,
          facts: [],
        },
      };
    },
  );

  app.get<{ Params: DiscordTargetParams }>(
    '/for/:discordId',
    {
      schema: {
        tags: ['npcs'],
        summary: 'List NPCs visible to a player',
        operationId: 'listVisibleNpcsForPlayer',
        params: discordTargetParamsSchema,
        response: {
          200: listResponseSchema(npcWithFactsSchema),
        },
      },
    },
    async (request) => {
      const params = request.params;
      return {
        status: 'stub',
        data: [
          {
            ...sampleNpc,
            campaignId: params.id,
            facts: [{ content: 'Knows the chantry sigil.', visibleTo: params.discordId }],
          },
        ],
      };
    },
  );
};

export default npcRoutes;
