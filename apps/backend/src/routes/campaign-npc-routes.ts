import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@constancia/db';
import {
  campaignParamsSchema,
  discordTargetParamsSchema,
  listResponseSchema,
  npcBodySchema,
  npcFactBodySchema,
  npcFactSchema,
  npcParamsSchema,
  npcPlayerParamsSchema,
  npcPatchBodySchema,
  npcRevealBodySchema,
  npcSchema,
  npcWithFactsSchema,
  npcWithKnowledgeSchema,
  playerVisibleNpcSchema,
  singleResponseSchema,
} from '../schemas.js';
import { getPrismaClient } from '../auth/prisma.js';

type PrismaClient = ReturnType<typeof getPrismaClient>;

interface NpcRoutesOptions {
  publicMode?: boolean;
}

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

interface NpcPlayerParams {
  id: string;
  npcId: string;
  discordId: string;
}

type NpcSystemBlockInput = {
  systemId?: string;
  blockType: string;
  label: string;
  value: Prisma.InputJsonValue;
};

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

type NpcSystemBlockRecord = {
  systemId?: string;
  blockType: string;
  label: string;
  value: Prisma.JsonValue;
};

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

type PlayerVisibleNpcRecord = {
  id: string;
  name: string;
  imageUrl: string | null;
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

function isRecord(value: Prisma.JsonValue): value is Record<string, Prisma.JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeNpcSystemBlocks(input: Prisma.JsonValue): NpcSystemBlockRecord[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const blockType = typeof entry.blockType === 'string' ? entry.blockType : null;
    const label = typeof entry.label === 'string' ? entry.label : null;

    if (blockType === null || label === null || !('value' in entry)) {
      return [];
    }

    const systemId = typeof entry.systemId === 'string' ? entry.systemId : undefined;

    return [
      {
        systemId,
        blockType,
        label,
        value: entry.value,
      },
    ];
  });
}

function toNpcSystemBlocksInput(systemBlocks: NpcSystemBlockInput[] | undefined): Prisma.InputJsonValue {
  return (systemBlocks ?? []).map((block) => ({
    systemId: block.systemId,
    blockType: block.blockType,
    label: block.label,
    value: block.value,
  })) as Prisma.InputJsonValue;
}

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

function mapPlayerVisibleNpc(npc: PlayerVisibleNpcRecord) {
  return {
    id: npc.id,
    name: npc.name,
    imageUrl: npc.imageUrl ?? undefined,
    campaignId: npc.campaignId,
    facts: [...npc.facts].sort((left, right) => left.sortOrder - right.sortOrder),
  };
}

async function listVisibleNpcRecordsForPlayer(
  prisma: PrismaClient,
  campaignId: string,
  discordId: string,
): Promise<PlayerVisibleNpcRecord[]> {
  const character = await prisma.character.findUnique({
    where: { discordUserId_campaignId: { discordUserId: discordId, campaignId } },
    select: { id: true },
  });
  if (character === null) {
    return [];
  }

  const knowledge = await prisma.npcKnowledge.findMany({
    where: { characterId: character.id },
    select: {
      npcFact: {
        select: {
          ...npcFactSelect,
          npc: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              campaignId: true,
            },
          },
        },
      },
    },
  });

  const npcMap = new Map<string, PlayerVisibleNpcRecord>();
  for (const { npcFact } of knowledge) {
    const npc = npcFact.npc;
    const existing = npcMap.get(npc.id);

    if (existing === undefined) {
      npcMap.set(npc.id, {
        id: npc.id,
        name: npc.name,
        imageUrl: npc.imageUrl,
        campaignId: npc.campaignId,
        facts: [npcFact],
      });
      continue;
    }

    existing.facts.push(npcFact);
  }

  return [...npcMap.values()].sort((left, right) => left.name.localeCompare(right.name));
}

const npcRoutes: FastifyPluginAsync<NpcRoutesOptions> = async (app, options) => {
  if (options.publicMode) {
    app.get<{ Params: DiscordTargetParams }>(
      '/for/:discordId',
      {
        schema: {
          tags: ['npcs'],
          summary: 'List player-safe NPC dossiers',
          operationId: 'listPublicVisibleNpcsForPlayer',
          params: discordTargetParamsSchema,
          response: {
            200: listResponseSchema(playerVisibleNpcSchema),
          },
        },
      },
      async (request) => {
        const prisma = getPrismaClient();
        const { id, discordId } = request.params;
        const npcs = await listVisibleNpcRecordsForPlayer(prisma, id, discordId);

        return { status: 'ok', data: npcs.map(mapPlayerVisibleNpc) };
      },
    );

    app.get<{ Params: NpcPlayerParams }>(
      '/:npcId/for/:discordId',
      {
        schema: {
          tags: ['npcs'],
          summary: 'Get a player-safe NPC dossier',
          operationId: 'getPublicVisibleNpcForPlayer',
          params: npcPlayerParamsSchema,
          response: {
            200: singleResponseSchema(playerVisibleNpcSchema),
          },
        },
      },
      async (request, reply) => {
        const prisma = getPrismaClient();
        const { id, npcId, discordId } = request.params;
        const npcs = await listVisibleNpcRecordsForPlayer(prisma, id, discordId);
        const npc = npcs.find((entry) => entry.id === npcId);

        if (npc === undefined) {
          return reply
            .code(404)
            .send({ status: 'error', data: { message: 'NPC dossier not found' } });
        }

        return { status: 'ok', data: mapPlayerVisibleNpc(npc) };
      },
    );

    return;
  }

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
      const { id } = request.params;
      const npcs = await prisma.npc.findMany({
        where: { campaignId: id },
        orderBy: { name: 'asc' },
        select: npcWithKnowledgeSelect,
      });

      return { status: 'ok', data: npcs.map(mapNpcWithKnowledge) };
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
      const { id } = request.params;
      const { name, imageUrl, description, systemBlocks, facts } = request.body;

      const npc = await prisma.$transaction(async (transaction) => {
        const createdNpc = await transaction.npc.create({
          data: {
            campaignId: id,
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
      return { status: 'ok', data: mapNpcWithFacts(npc) };
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
      const { npcId } = request.params;
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
        return {
          status: 'ok',
          data: {
            ...npc,
            imageUrl: npc.imageUrl ?? undefined,
            systemBlocks: normalizeNpcSystemBlocks(npc.systemBlocks),
          },
        };
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
        select: npcFactSelect,
      });
      reply.code(201);
      return { status: 'ok', data: fact };
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
      const { id, npcId } = request.params;
      const { npcFactIds, discordUserIds } = request.body;

      const characters = await prisma.character.findMany({
        where: { campaignId: id, discordUserId: { in: discordUserIds } },
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
        return reply.code(404).send({ status: 'error', data: { message: 'NPC not found' } });
      }

      return { status: 'ok', data: mapNpcWithKnowledge(npc) };
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
      const prisma = getPrismaClient();
      const { id, discordId } = request.params;

      const character = await prisma.character.findUnique({
        where: { discordUserId_campaignId: { discordUserId: discordId, campaignId: id } },
        select: { id: true },
      });
      if (character === null) {
        return { status: 'ok', data: [] };
      }

      const knowledge = await prisma.npcKnowledge.findMany({
        where: { characterId: character.id },
        select: {
          npcFact: {
            select: {
              ...npcFactSelect,
              npc: {
                select: npcBaseSelect,
              },
            },
          },
        },
      });

      const npcMap = new Map<string, NpcWithFactsRecord>();
      for (const { npcFact } of knowledge) {
        const npc = npcFact.npc;
        const existing = npcMap.get(npc.id);

        if (existing === undefined) {
          npcMap.set(npc.id, {
            id: npc.id,
            name: npc.name,
            imageUrl: npc.imageUrl,
            description: npc.description,
            systemBlocks: npc.systemBlocks,
            campaignId: npc.campaignId,
            facts: [npcFact],
          });
          continue;
        }

        existing.facts.push(npcFact);
      }

      return { status: 'ok', data: [...npcMap.values()].map(mapNpcWithFacts) };
    },
  );
};

export default npcRoutes;

