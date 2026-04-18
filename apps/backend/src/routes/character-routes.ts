import type { FastifyPluginAsync } from 'fastify';
import {
  campaignParamsSchema,
  characterBodySchema,
  characterParamsSchema,
  characterPatchBodySchema,
  characterSchema,
  listResponseSchema,
  singleResponseSchema,
} from '../schemas.js';

interface CampaignParams {
  id: string;
}

interface CharacterParams {
  id: string;
  charId: string;
}

interface CharacterBody {
  name: string;
  discordUserId: string;
  backstory?: string;
  notes?: string;
  systemData?: Record<string, unknown>;
}

interface CharacterPatchBody {
  name?: string;
  backstory?: string;
  notes?: string;
  systemData?: Record<string, unknown>;
}

const sampleCharacter = {
  id: 'char-1',
  name: 'Annabelle',
  discordUserId: 'discord-user-1',
  campaignId: 'campaign-1',
  backstory: 'A wary occultist.',
  notes: 'Keeps secrets.',
  systemData: {
    attributes: {
      wits: 3,
    },
    skills: {
      awareness: 2,
    },
  },
};

const characterRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: CampaignParams }>(
    '/',
    {
      schema: {
        tags: ['characters'],
        summary: 'List campaign characters',
        operationId: 'listCharacters',
        params: campaignParamsSchema,
        response: {
          200: listResponseSchema(characterSchema),
        },
      },
    },
    async (request) => {
      const params = request.params;
      return {
        status: 'stub',
        data: [{ ...sampleCharacter, campaignId: params.id }],
      };
    },
  );

  app.post<{ Params: CampaignParams; Body: CharacterBody }>(
    '/',
    {
      schema: {
        tags: ['characters'],
        summary: 'Create a character',
        operationId: 'createCharacter',
        params: campaignParamsSchema,
        body: characterBodySchema,
        response: {
          201: singleResponseSchema(characterSchema),
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
          id: 'char-new',
          campaignId: params.id,
          backstory: '',
          notes: '',
          ...body,
        },
      };
    },
  );

  app.get<{ Params: CharacterParams }>(
    '/:charId',
    {
      schema: {
        tags: ['characters'],
        summary: 'Get a character',
        operationId: 'getCharacter',
        params: characterParamsSchema,
        response: {
          200: singleResponseSchema(characterSchema),
        },
      },
    },
    async (request) => {
      const params = request.params;
      return {
        status: 'stub',
        data: {
          ...sampleCharacter,
          id: params.charId,
          campaignId: params.id,
        },
      };
    },
  );

  app.patch<{ Params: CharacterParams; Body: CharacterPatchBody }>(
    '/:charId',
    {
      schema: {
        tags: ['characters'],
        summary: 'Update a character',
        operationId: 'updateCharacter',
        params: characterParamsSchema,
        body: characterPatchBodySchema,
        response: {
          200: singleResponseSchema(characterSchema),
        },
      },
    },
    async (request) => {
      const params = request.params;
      const body = request.body;
      return {
        status: 'stub',
        data: {
          ...sampleCharacter,
          id: params.charId,
          campaignId: params.id,
          ...body,
        },
      };
    },
  );
};

export default characterRoutes;
