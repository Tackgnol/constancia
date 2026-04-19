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
import { getPrismaClient } from '../auth/prisma.js';
import type { Prisma } from '@constancia/db';

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
  gameName?: string;
  backstory?: string;
  notes?: string;
  systemData?: Record<string, unknown>;
}

const select = {
  id: true,
  name: true,
  discordName: true,
  gameName: true,
  discordUserId: true,
  campaignId: true,
  backstory: true,
  notes: true,
  systemData: true,
} as const;

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
      const prisma = getPrismaClient();
      const { id } = request.params;
      const characters = await prisma.character.findMany({ where: { campaignId: id }, select });
      return { status: 'ok', data: characters };
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
      const prisma = getPrismaClient();
      const { id } = request.params;
      const { name, discordUserId, backstory, notes, systemData } = request.body;
      const character = await prisma.character.create({
        data: {
          campaignId: id,
          name,
          discordUserId,
          backstory: backstory ?? '',
          notes: notes ?? '',
          systemData: (systemData ?? {}) as Prisma.InputJsonValue,
        },
        select,
      });
      reply.code(201);
      return { status: 'ok', data: character };
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
    async (request, reply) => {
      const prisma = getPrismaClient();
      const { charId } = request.params;
      const character = await prisma.character.findUnique({ where: { id: charId }, select });
      if (character === null) {
        return reply.code(404).send({ status: 'error', data: { message: 'Character not found' } });
      }
      return { status: 'ok', data: character };
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
    async (request, reply) => {
      const prisma = getPrismaClient();
      const { charId } = request.params;
      const { name, gameName, backstory, notes, systemData } = request.body;
      const data: Partial<{
        name: string;
        gameName: string;
        backstory: string;
        notes: string;
        systemData: Prisma.InputJsonValue;
      }> = {};
      if (name !== undefined) data.name = name;
      if (gameName !== undefined) data.gameName = gameName;
      if (backstory !== undefined) data.backstory = backstory;
      if (notes !== undefined) data.notes = notes;
      if (systemData !== undefined) data.systemData = systemData as Prisma.InputJsonValue;
      try {
        const character = await prisma.character.update({ where: { id: charId }, data, select });
        return { status: 'ok', data: character };
      } catch (err) {
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: unknown }).code === 'P2025'
        ) {
          return reply
            .code(404)
            .send({ status: 'error', data: { message: 'Character not found' } });
        }
        throw err;
      }
    },
  );
};

export default characterRoutes;
