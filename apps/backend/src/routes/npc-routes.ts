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
import { getPrismaClient } from '../auth/prisma.js';

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

const npcRoutes: FastifyPluginAsync = async (app) => {
  // GET / - list NPCs for campaign
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
      const prisma = getPrismaClient();
      const { id } = request.params;
      const npcs = await prisma.npc.findMany({
        where: { campaignId: id },
        select: { id: true, name: true, imageUrl: true, description: true, campaignId: true },
      });
      return { status: 'ok', data: npcs };
    },
  );

  // POST / - create NPC
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
      const prisma = getPrismaClient();
      const { id } = request.params;
      const { name, imageUrl, description } = request.body;
      const npc = await prisma.npc.create({
        data: { name, imageUrl, description: description ?? '', campaignId: id },
        select: { id: true, name: true, imageUrl: true, description: true, campaignId: true },
      });
      reply.code(201);
      return { status: 'ok', data: npc };
    },
  );

  // PATCH /:npcId - update NPC
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
    async (request, reply) => {
      const prisma = getPrismaClient();
      const { npcId } = request.params;
      const { name, imageUrl, description } = request.body;
      const data: { name?: string; imageUrl?: string; description?: string } = {};
      if (name !== undefined) data.name = name;
      if (imageUrl !== undefined) data.imageUrl = imageUrl;
      if (description !== undefined) data.description = description;
      try {
        const npc = await prisma.npc.update({
          where: { id: npcId },
          data,
          select: { id: true, name: true, imageUrl: true, description: true, campaignId: true },
        });
        return { status: 'ok', data: npc };
      } catch (err) {
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: unknown }).code === 'P2025'
        ) {
          return reply.code(404).send({ status: 'error', data: { message: 'NPC not found' } });
        }
        throw err;
      }
    },
  );

  // POST /:npcId/facts - add fact to NPC
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
      const prisma = getPrismaClient();
      const { npcId } = request.params;
      const { content, sortOrder } = request.body;
      const fact = await prisma.npcFact.create({
        data: { npcId, content, sortOrder: sortOrder ?? 0 },
        select: { id: true, content: true, sortOrder: true, npcId: true },
      });
      reply.code(201);
      return { status: 'ok', data: fact };
    },
  );

  // POST /:npcId/reveal - reveal NPC facts to players
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
    async (request, reply) => {
      const prisma = getPrismaClient();
      const { id, npcId } = request.params;
      const { npcFactIds, discordUserIds } = request.body;

      // 1. Find characters for the given discord users in this campaign
      const characters = await prisma.character.findMany({
        where: { campaignId: id, discordUserId: { in: discordUserIds } },
        select: { id: true },
      });

      // 2. Upsert NpcKnowledge for each character × each npcFactId
      await prisma.npcKnowledge.createMany({
        data: characters.flatMap((char) =>
          npcFactIds.map((npcFactId) => ({ characterId: char.id, npcFactId })),
        ),
        skipDuplicates: true,
      });

      // 3. Return the NPC with its facts
      const npc = await prisma.npc.findUnique({
        where: { id: npcId },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          description: true,
          campaignId: true,
          facts: { select: { id: true, content: true, sortOrder: true, npcId: true } },
        },
      });
      if (!npc) {
        return reply.code(404).send({ status: 'error', data: { message: 'NPC not found' } });
      }
      return { status: 'ok', data: npc };
    },
  );

  // GET /for/:discordId - list NPCs visible to a player
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
      const prisma = getPrismaClient();
      const { id, discordId } = request.params;

      // Find character for this discord user in this campaign
      const character = await prisma.character.findUnique({
        where: { discordUserId_campaignId: { discordUserId: discordId, campaignId: id } },
        select: { id: true },
      });
      if (!character) {
        return { status: 'ok', data: [] };
      }

      // Get all NpcKnowledge for this character, grouped by NPC
      const knowledge = await prisma.npcKnowledge.findMany({
        where: { characterId: character.id },
        select: {
          npcFact: {
            select: {
              id: true,
              content: true,
              sortOrder: true,
              npcId: true,
              npc: {
                select: {
                  id: true,
                  name: true,
                  imageUrl: true,
                  description: true,
                  campaignId: true,
                },
              },
            },
          },
        },
      });

      // Group facts by NPC
      const npcMap = new Map<
        string,
        {
          id: string;
          name: string;
          imageUrl: string | null;
          description: string;
          campaignId: string;
          facts: Array<{ id: string; content: string; sortOrder: number; npcId: string }>;
        }
      >();
      for (const { npcFact } of knowledge) {
        const npc = npcFact.npc;
        if (!npcMap.has(npc.id)) {
          npcMap.set(npc.id, { ...npc, facts: [] });
        }
        npcMap.get(npc.id)!.facts.push({
          id: npcFact.id,
          content: npcFact.content,
          sortOrder: npcFact.sortOrder,
          npcId: npcFact.npcId,
        });
      }

      return { status: 'ok', data: [...npcMap.values()] };
    },
  );
};

export default npcRoutes;
