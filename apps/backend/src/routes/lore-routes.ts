import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@constancia/db';
import {
  campaignParamsSchema,
  deleteResponseSchema,
  listResponseSchema,
  loreBodySchema,
  loreEntrySchema,
  loreEntryWithKnowledgeSchema,
  loreParamsSchema,
  lorePatchBodySchema,
  loreRevealBodySchema,
  singleResponseSchema,
} from '../schemas.js';
import { getPrismaClient } from '../auth/prisma.js';
import { deleted, ok, sendNotFound } from '../http-responses.js';
import { moderatePayloadText } from '../services/content-moderation.js';
import { loreEntrySelect } from '../services/player-journal.js';

interface CampaignParams {
  id: string;
}

interface LoreParams {
  id: string;
  loreId: string;
}

interface LoreBody {
  title: string;
  content: string;
  sortOrder?: number;
}

interface LorePatchBody {
  title?: string;
  content?: string;
  sortOrder?: number;
}

interface LoreRevealBody {
  discordUserIds: string[];
}

type KnownCharacterRecord = {
  id: string;
  discordUserId: string;
  discordName: string;
  gameName: string;
  name: string;
};

type LoreEntryWithKnowledgeRecord = {
  id: string;
  title: string;
  content: string;
  campaignId: string;
  sortOrder: number;
  knowledge: Array<{ character: KnownCharacterRecord }>;
};

const knownCharacterSelect = {
  id: true,
  discordUserId: true,
  discordName: true,
  gameName: true,
  name: true,
} satisfies Prisma.CharacterSelect;

const loreEntryWithKnowledgeSelect = {
  ...loreEntrySelect,
  knowledge: {
    select: {
      character: {
        select: knownCharacterSelect,
      },
    },
  },
} satisfies Prisma.LoreEntrySelect;

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

function mapLoreEntryWithKnowledge(loreEntry: LoreEntryWithKnowledgeRecord) {
  return {
    id: loreEntry.id,
    title: loreEntry.title,
    content: loreEntry.content,
    campaignId: loreEntry.campaignId,
    sortOrder: loreEntry.sortOrder,
    knownTo: loreEntry.knowledge.map(({ character }) => mapKnownPlayer(character)),
  };
}

const loreRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: CampaignParams }>(
    '/',
    {
      schema: {
        tags: ['lore'],
        summary: 'List campaign lore entries',
        operationId: 'listLoreEntries',
        params: campaignParamsSchema,
        response: {
          200: listResponseSchema(loreEntryWithKnowledgeSchema),
        },
      },
    },
    async (request) => {
      const prisma = getPrismaClient();
      const { id } = request.params;
      const loreEntries = await prisma.loreEntry.findMany({
        where: { campaignId: id },
        select: loreEntryWithKnowledgeSelect,
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      });

      return ok(loreEntries.map(mapLoreEntryWithKnowledge));
    },
  );

  app.post<{ Params: CampaignParams; Body: LoreBody }>(
    '/',
    {
      schema: {
        tags: ['lore'],
        summary: 'Create a lore entry',
        operationId: 'createLoreEntry',
        params: campaignParamsSchema,
        body: loreBodySchema,
        response: {
          201: singleResponseSchema(loreEntrySchema),
        },
      },
    },
    async (request, reply) => {
      await moderatePayloadText(app.config, request.body);
      const prisma = getPrismaClient();
      const { id } = request.params;
      const { title, content, sortOrder } = request.body;
      const loreEntry = await prisma.loreEntry.create({
        data: {
          campaignId: id,
          title,
          content,
          sortOrder: sortOrder ?? 0,
        },
        select: loreEntrySelect,
      });

      reply.code(201);
      return ok(loreEntry);
    },
  );

  app.patch<{ Params: LoreParams; Body: LorePatchBody }>(
    '/:loreId',
    {
      schema: {
        tags: ['lore'],
        summary: 'Update a lore entry',
        operationId: 'updateLoreEntry',
        params: loreParamsSchema,
        body: lorePatchBodySchema,
        response: {
          200: singleResponseSchema(loreEntrySchema),
        },
      },
    },
    async (request, reply) => {
      await moderatePayloadText(app.config, request.body);
      const prisma = getPrismaClient();
      const { id, loreId } = request.params;
      const { title, content, sortOrder } = request.body;
      const existing = await prisma.loreEntry.findFirst({
        where: { id: loreId, campaignId: id },
        select: { id: true },
      });

      if (existing === null) {
        return sendNotFound(reply, 'Lore entry not found');
      }

      const data: Prisma.LoreEntryUpdateInput = {};
      if (title !== undefined) data.title = title;
      if (content !== undefined) data.content = content;
      if (sortOrder !== undefined) data.sortOrder = sortOrder;

      const loreEntry = await prisma.loreEntry.update({
        where: { id: loreId },
        data,
        select: loreEntrySelect,
      });

      return ok(loreEntry);
    },
  );

  app.post<{ Params: LoreParams; Body: LoreRevealBody }>(
    '/:loreId/reveal',
    {
      schema: {
        tags: ['lore'],
        summary: 'Reveal lore to players',
        operationId: 'revealLoreEntry',
        params: loreParamsSchema,
        body: loreRevealBodySchema,
        response: {
          200: singleResponseSchema(loreEntryWithKnowledgeSchema),
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      const { id, loreId } = request.params;
      const { discordUserIds } = request.body;

      const existing = await prisma.loreEntry.findFirst({
        where: { id: loreId, campaignId: id },
        select: { id: true },
      });

      if (existing === null) {
        return sendNotFound(reply, 'Lore entry not found');
      }

      const characters = await prisma.character.findMany({
        where: { campaignId: id, discordUserId: { in: discordUserIds } },
        select: { id: true },
      });

      await prisma.loreKnowledge.createMany({
        data: characters.map((character) => ({
          characterId: character.id,
          loreEntryId: loreId,
        })),
        skipDuplicates: true,
      });

      const loreEntry = await prisma.loreEntry.findUnique({
        where: { id: loreId },
        select: loreEntryWithKnowledgeSelect,
      });

      if (loreEntry === null) {
        return sendNotFound(reply, 'Lore entry not found');
      }

      return ok(mapLoreEntryWithKnowledge(loreEntry));
    },
  );

  app.delete<{ Params: LoreParams }>(
    '/:loreId',
    {
      schema: {
        tags: ['lore'],
        summary: 'Delete a lore entry',
        operationId: 'deleteLoreEntry',
        params: loreParamsSchema,
        response: {
          200: deleteResponseSchema,
        },
      },
    },
    async (request) => {
      const prisma = getPrismaClient();
      const { id, loreId } = request.params;
      const result = await prisma.loreEntry.deleteMany({
        where: { id: loreId, campaignId: id },
      });

      return deleted(result.count > 0);
    },
  );
};

export default loreRoutes;
