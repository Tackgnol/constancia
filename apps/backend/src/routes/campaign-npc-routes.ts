import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@constancia/db';
import {
  campaignParamsSchema,
  deleteResponseSchema,
  listResponseSchema,
  npcBodySchema,
  npcFactBodySchema,
  npcFactSchema,
  npcParamsSchema,
  npcPatchBodySchema,
  npcRevealBodySchema,
  npcSchema,
  npcWithFactsSchema,
  npcWithKnowledgeSchema,
  singleResponseSchema,
} from '../schemas.js';
import { getPrismaClient } from '../auth/prisma.js';
import { isPrismaNotFoundError, ok, sendNotFound, deleted } from '../http-responses.js';
import { moderatePayloadText } from '../services/content-moderation.js';
import { createCampaignAccess } from '../services/campaign-access.js';
import {
  normalizeNpcSystemBlocks,
  toNpcSystemBlocksInput,
  type NpcSystemBlockInput,
} from '../services/npc-system-blocks.js';

interface CampaignParams {
  id: string;
}

interface NpcParams {
  id: string;
  npcId: string;
}

interface NpcBody {
  name: string;
  imageUrl?: string;
  description?: string;
  systemBlocks?: NpcSystemBlockInput[];
  facts?: Array<{
    content: string;
    sortOrder?: number;
  }>;
}

interface NpcPatchBody {
  name?: string;
  imageUrl?: string;
  description?: string;
  systemBlocks?: NpcSystemBlockInput[];
}

interface NpcFactBody {
  content: string;
  sortOrder?: number;
}

interface NpcRevealBody {
  npcFactIds: string[];
  discordUserIds: string[];
}

type KnownCharacterRecord = {
  id: string;
  discordUserId: string;
  discordName: string;
  gameName: string;
  name: string;
};

type NpcKnowledgeFactRecord = {
  id: string;
  content: string;
  sortOrder: number;
  npcId: string;
  knowledge: Array<{ character: KnownCharacterRecord }>;
};

type NpcWithKnowledgeRecord = {
  id: string;
  name: string;
  imageUrl: string | null;
  description: string;
  systemBlocks: Prisma.JsonValue;
  campaignId: string;
  facts: NpcKnowledgeFactRecord[];
};

type NpcWithFactsRecord = {
  id: string;
  name: string;
  imageUrl: string | null;
  description: string;
  systemBlocks: Prisma.JsonValue;
  campaignId: string;
  facts: Array<{
    id: string;
    content: string;
    sortOrder: number;
    npcId: string;
  }>;
};

const knownCharacterSelect = {
  id: true,
  discordUserId: true,
  discordName: true,
  gameName: true,
  name: true,
} satisfies Prisma.CharacterSelect;

const npcFactsOrderBy: Prisma.NpcFactOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { id: 'asc' },
];

const npcBaseSelect = {
  id: true,
  name: true,
  imageUrl: true,
  description: true,
  systemBlocks: true,
  campaignId: true,
} satisfies Prisma.NpcSelect;

const npcFactSelect = {
  id: true,
  content: true,
  sortOrder: true,
  npcId: true,
} satisfies Prisma.NpcFactSelect;

const npcWithFactsSelect = {
  ...npcBaseSelect,
  facts: {
    orderBy: npcFactsOrderBy,
    select: npcFactSelect,
  },
} satisfies Prisma.NpcSelect;

const npcWithKnowledgeSelect = {
  ...npcBaseSelect,
  facts: {
    orderBy: npcFactsOrderBy,
    select: {
      ...npcFactSelect,
      knowledge: {
        select: {
          character: {
            select: knownCharacterSelect,
          },
        },
      },
    },
  },
} satisfies Prisma.NpcSelect;

function mapKnownPlayer(character: KnownCharacterRecord) {
  const displayName = character.gameName || character.discordName || character.name;
  const secondaryLabel = [character.discordName || character.name, character.discordUserId]
    .filter(Boolean)
    .join(' · ');

  return {
    characterId: character.id,
    discordUserId: character.discordUserId,
    displayName,
    secondaryLabel,
  };
}

function mapNpcWithKnowledge(npc: NpcWithKnowledgeRecord) {
  return {
    id: npc.id,
    name: npc.name,
    imageUrl: npc.imageUrl ?? undefined,
    description: npc.description,
    systemBlocks: normalizeNpcSystemBlocks(npc.systemBlocks),
    campaignId: npc.campaignId,
    facts: npc.facts.map((fact) => ({
      id: fact.id,
      content: fact.content,
      sortOrder: fact.sortOrder,
      npcId: fact.npcId,
      knownTo: fact.knowledge.map(({ character }) => mapKnownPlayer(character)),
    })),
  };
}

function mapNpcWithFacts(npc: NpcWithFactsRecord) {
  return {
    id: npc.id,
    name: npc.name,
    imageUrl: npc.imageUrl ?? undefined,
    description: npc.description,
    systemBlocks: normalizeNpcSystemBlocks(npc.systemBlocks),
    campaignId: npc.campaignId,
    facts: npc.facts.map((fact) => ({
      id: fact.id,
      content: fact.content,
      sortOrder: fact.sortOrder,
      npcId: fact.npcId,
    })),
  };
}

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
          200: listResponseSchema(npcWithKnowledgeSchema),
        },
      },
    },
    async (request) => {
      const prisma = getPrismaClient();
      const npcs = await prisma.npc.findMany({
        where: { campaignId: request.campaignScope.campaignId },
        orderBy: { name: 'asc' },
        select: npcWithKnowledgeSelect,
      });

      return ok(npcs.map(mapNpcWithKnowledge));
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
          201: singleResponseSchema(npcWithFactsSchema),
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      await moderatePayloadText(app.config, request.body);
      const { name, imageUrl, description, systemBlocks, facts } = request.body;

      const npc = await prisma.$transaction(async (transaction) => {
        const createdNpc = await transaction.npc.create({
          data: {
            campaignId: request.campaignScope.campaignId,
            name,
            imageUrl,
            description: description ?? '',
            systemBlocks: toNpcSystemBlocksInput(systemBlocks),
          },
          select: { id: true },
        });

        if ((facts ?? []).length > 0) {
          await transaction.npcFact.createMany({
            data: facts!.map((fact, index) => ({
              npcId: createdNpc.id,
              content: fact.content,
              sortOrder: fact.sortOrder ?? index,
            })),
          });
        }

        return transaction.npc.findUniqueOrThrow({
          where: { id: createdNpc.id },
          select: npcWithFactsSelect,
        });
      });

      reply.code(201);
      return ok(mapNpcWithFacts(npc));
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
    async (request, reply) => {
      const prisma = getPrismaClient();
      await moderatePayloadText(app.config, request.body);
      const { npcId } = request.params;
      await createCampaignAccess(prisma).requireResource(request.campaignScope, {
        kind: 'npc',
        id: npcId,
      });
      const { name, imageUrl, description, systemBlocks } = request.body;
      const data: Partial<{
        name: string;
        imageUrl: string;
        description: string;
        systemBlocks: Prisma.InputJsonValue;
      }> = {};

      if (name !== undefined) data.name = name;
      if (imageUrl !== undefined) data.imageUrl = imageUrl;
      if (description !== undefined) data.description = description;
      if (systemBlocks !== undefined) data.systemBlocks = toNpcSystemBlocksInput(systemBlocks);

      try {
        const npc = await prisma.npc.update({
          where: { id: npcId },
          data,
          select: npcBaseSelect,
        });
        return ok({
          ...npc,
          imageUrl: npc.imageUrl ?? undefined,
          systemBlocks: normalizeNpcSystemBlocks(npc.systemBlocks),
        });
      } catch (err) {
        if (isPrismaNotFoundError(err)) {
          return sendNotFound(reply, 'NPC not found');
        }
        throw err;
      }
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
      const prisma = getPrismaClient();
      await moderatePayloadText(app.config, request.body);
      const { npcId } = request.params;
      await createCampaignAccess(prisma).requireResource(request.campaignScope, {
        kind: 'npc',
        id: npcId,
      });
      const { content, sortOrder } = request.body;
      const fact = await prisma.npcFact.create({
        data: { npcId, content, sortOrder: sortOrder ?? 0 },
        select: npcFactSelect,
      });
      reply.code(201);
      return ok(fact);
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
          200: singleResponseSchema(npcWithKnowledgeSchema),
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      const { npcId } = request.params;
      const { npcFactIds, discordUserIds } = request.body;
      const campaignAccess = createCampaignAccess(prisma);
      await campaignAccess.requireResource(request.campaignScope, { kind: 'npc', id: npcId });
      await Promise.all(
        [...new Set(npcFactIds)].map((npcFactId) =>
          campaignAccess.requireResource(request.campaignScope, {
            kind: 'npc-fact',
            id: npcFactId,
            npcId,
          }),
        ),
      );

      const characters = await prisma.character.findMany({
        where: {
          campaignId: request.campaignScope.campaignId,
          discordUserId: { in: discordUserIds },
        },
        select: { id: true },
      });

      await prisma.npcKnowledge.createMany({
        data: characters.flatMap((character) =>
          npcFactIds.map((npcFactId) => ({ characterId: character.id, npcFactId })),
        ),
        skipDuplicates: true,
      });

      const npc = await prisma.npc.findUnique({
        where: { id: npcId },
        select: npcWithKnowledgeSelect,
      });

      if (npc === null) {
        return sendNotFound(reply, 'NPC not found');
      }

      return ok(mapNpcWithKnowledge(npc));
    },
  );

  app.delete<{ Params: NpcParams }>(
    '/:npcId',
    {
      schema: {
        tags: ['npcs'],
        summary: 'Delete an NPC',
        operationId: 'deleteNpc',
        params: npcParamsSchema,
        response: {
          200: deleteResponseSchema,
        },
      },
    },
    async (request) => {
      const prisma = getPrismaClient();
      const { npcId } = request.params;
      await createCampaignAccess(prisma).requireResource(request.campaignScope, {
        kind: 'npc',
        id: npcId,
      });
      try {
        await prisma.npc.delete({ where: { id: npcId } });
        return deleted(true);
      } catch (err) {
        if (isPrismaNotFoundError(err)) {
          return deleted(false);
        }
        throw err;
      }
    },
  );
};

export default npcRoutes;
