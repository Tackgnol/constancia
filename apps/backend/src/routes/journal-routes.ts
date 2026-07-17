import type { FastifyPluginAsync } from 'fastify';
import type { GameDate } from '@constancia/contracts';
import { Prisma, type QuestEntryStatus } from '@constancia/db';
import { parseGameDate } from '@constancia/systems';
import {
  campaignParamsSchema,
  deleteResponseSchema,
  discordTargetParamsSchema,
  journalForPlayerSchema,
  questBodySchema,
  questEntryBodySchema,
  questEntryParamsSchema,
  questEntrySchema,
  questParamsSchema,
  questPatchBodySchema,
  questSchema,
  sessionSummarySchema,
  singleResponseSchema,
  listResponseSchema,
  summaryBodySchema,
  summaryPatchBodySchema,
  summaryParamsSchema,
} from '../schemas.js';
import { getPrismaClient } from '../auth/prisma.js';
import { deleted, isPrismaNotFoundError, ok, sendError, sendNotFound } from '../http-responses.js';
import { moderatePayloadText } from '../services/content-moderation.js';
import { createCampaignAccess } from '../services/campaign-access.js';
import {
  getPlayerJournal,
  questEntrySelect,
  questSelect,
  summarySelect,
} from '../services/player-journal.js';
import { getGameDateValidationError, toGameDateJson } from '../services/game-date.js';

interface CampaignParams {
  id: string;
}

interface QuestParams {
  id: string;
  questId: string;
}

interface QuestEntryParams {
  id: string;
  questId: string;
  entryId: string;
}

interface SummaryParams {
  id: string;
  sumId: string;
}

interface DiscordTargetParams {
  id: string;
  discordId: string;
}

interface QuestBody {
  name: string;
  description?: string;
  visible?: boolean;
}

interface QuestPatchBody {
  name?: string;
  description?: string;
  status?: string;
  visible?: boolean;
}

interface QuestEntryBody {
  content: string;
  status?: string;
  sortOrder?: number;
}

interface SummaryBody {
  title: string;
  content: string;
  sessionDate: string;
  gameDate?: GameDate | null;
  visible?: boolean;
  channelId?: string;
}

interface SummaryPatchBody {
  title?: string;
  content?: string;
  sessionDate?: string;
  gameDate?: GameDate | null;
  visible?: boolean;
  channelId?: string;
}

const journalRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: CampaignParams }>(
    '/quests',
    {
      schema: {
        tags: ['journal'],
        summary: 'List quests',
        operationId: 'listQuests',
        params: campaignParamsSchema,
        response: {
          200: listResponseSchema(questSchema),
        },
      },
    },
    async (request) => {
      const prisma = getPrismaClient();
      const quests = await prisma.quest.findMany({
        where: { campaignId: request.campaignScope.campaignId },
        select: { ...questSelect, entries: { select: questEntrySelect } },
        orderBy: { sortOrder: 'asc' },
      });
      return ok(quests);
    },
  );

  app.post<{ Params: CampaignParams; Body: QuestBody }>(
    '/quests',
    {
      schema: {
        tags: ['journal'],
        summary: 'Create a quest',
        operationId: 'createQuest',
        params: campaignParamsSchema,
        body: questBodySchema,
        response: {
          201: singleResponseSchema(questSchema),
        },
      },
    },
    async (request, reply) => {
      await moderatePayloadText(app.config, request.body);
      const { name, description, visible } = request.body;
      const prisma = getPrismaClient();
      reply.code(201);
      const quest = await prisma.quest.create({
        data: {
          name,
          description: description ?? '',
          campaignId: request.campaignScope.campaignId,
          visible: visible ?? false,
        },
        select: questSelect,
      });
      return ok({ ...quest, entries: [] });
    },
  );

  app.patch<{ Params: QuestParams; Body: QuestPatchBody }>(
    '/quests/:questId',
    {
      schema: {
        tags: ['journal'],
        summary: 'Update a quest',
        operationId: 'updateQuest',
        params: questParamsSchema,
        body: questPatchBodySchema,
        response: {
          200: singleResponseSchema(questSchema),
        },
      },
    },
    async (request, reply) => {
      await moderatePayloadText(app.config, request.body);
      const { questId } = request.params;
      const { name, description, status, visible } = request.body;
      const prisma = getPrismaClient();
      await createCampaignAccess(prisma).requireResource(request.campaignScope, {
        kind: 'quest',
        id: questId,
      });
      const data: Record<string, unknown> = {};
      if (name !== undefined) data['name'] = name;
      if (description !== undefined) data['description'] = description;
      if (status !== undefined) data['status'] = status;
      if (visible !== undefined) data['visible'] = visible;
      try {
        const quest = await prisma.quest.update({
          where: { id: questId },
          data,
          select: { ...questSelect, entries: { select: questEntrySelect } },
        });
        return ok(quest);
      } catch (err) {
        if (isPrismaNotFoundError(err)) {
          return sendNotFound(reply, 'Not found');
        }
        throw err;
      }
    },
  );

  app.post<{ Params: QuestParams; Body: QuestEntryBody }>(
    '/quests/:questId/entries',
    {
      schema: {
        tags: ['journal'],
        summary: 'Create a quest entry',
        operationId: 'createQuestEntry',
        params: questParamsSchema,
        body: questEntryBodySchema,
        response: {
          201: singleResponseSchema(questEntrySchema),
        },
      },
    },
    async (request, reply) => {
      await moderatePayloadText(app.config, request.body);
      const { questId } = request.params;
      const { content, status, sortOrder } = request.body;
      const prisma = getPrismaClient();
      await createCampaignAccess(prisma).requireResource(request.campaignScope, {
        kind: 'quest',
        id: questId,
      });
      reply.code(201);
      const entry = await prisma.questEntry.create({
        data: {
          questId,
          content,
          status: (status ?? 'pending') as QuestEntryStatus,
          sortOrder: sortOrder ?? 0,
        },
        select: questEntrySelect,
      });
      return ok(entry);
    },
  );

  app.patch<{ Params: QuestEntryParams; Body: QuestEntryBody }>(
    '/quests/:questId/entries/:entryId',
    {
      schema: {
        tags: ['journal'],
        summary: 'Update a quest entry',
        operationId: 'updateQuestEntry',
        params: questEntryParamsSchema,
        body: questEntryBodySchema,
        response: {
          200: singleResponseSchema(questEntrySchema),
        },
      },
    },
    async (request, reply) => {
      await moderatePayloadText(app.config, request.body);
      const { questId, entryId } = request.params;
      const { content, status, sortOrder } = request.body;
      const prisma = getPrismaClient();
      await createCampaignAccess(prisma).requireResource(request.campaignScope, {
        kind: 'quest-entry',
        id: entryId,
        questId,
      });
      const data: Record<string, unknown> = {};
      if (content !== undefined) data['content'] = content;
      if (status !== undefined) data['status'] = status as QuestEntryStatus;
      if (sortOrder !== undefined) data['sortOrder'] = sortOrder;
      try {
        const entry = await prisma.questEntry.update({
          where: { id: entryId },
          data,
          select: questEntrySelect,
        });
        return ok(entry);
      } catch (err) {
        if (isPrismaNotFoundError(err)) {
          return sendNotFound(reply, 'Not found');
        }
        throw err;
      }
    },
  );

  app.delete(
    '/quests/:questId/entries/:entryId',
    {
      schema: {
        tags: ['journal'],
        summary: 'Delete a quest entry',
        operationId: 'deleteQuestEntry',
        params: questEntryParamsSchema,
        response: {
          200: deleteResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as QuestEntryParams;
      const prisma = getPrismaClient();
      await createCampaignAccess(prisma).requireResource(request.campaignScope, {
        kind: 'quest-entry',
        id: params.entryId,
        questId: params.questId,
      });
      try {
        await prisma.questEntry.delete({ where: { id: params.entryId } });
        return deleted(true);
      } catch (err) {
        if (isPrismaNotFoundError(err)) {
          return deleted(false);
        }
        throw err;
      }
    },
  );

  app.delete<{ Params: QuestParams }>(
    '/quests/:questId',
    {
      schema: {
        tags: ['journal'],
        summary: 'Delete a quest',
        operationId: 'deleteQuest',
        params: questParamsSchema,
        response: {
          200: deleteResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as QuestParams;
      const prisma = getPrismaClient();
      await createCampaignAccess(prisma).requireResource(request.campaignScope, {
        kind: 'quest',
        id: params.questId,
      });
      try {
        await prisma.quest.delete({ where: { id: params.questId } });
        return deleted(true);
      } catch (err) {
        if (isPrismaNotFoundError(err)) {
          return deleted(false);
        }
        throw err;
      }
    },
  );

  app.get<{ Params: CampaignParams }>(
    '/summaries',
    {
      schema: {
        tags: ['journal'],
        summary: 'List session summaries',
        operationId: 'listSessionSummaries',
        params: campaignParamsSchema,
        response: {
          200: listResponseSchema(sessionSummarySchema),
        },
      },
    },
    async (request) => {
      const prisma = getPrismaClient();
      const summaries = await prisma.sessionSummary.findMany({
        where: { campaignId: request.campaignScope.campaignId },
        select: summarySelect,
        orderBy: { sessionDate: 'desc' },
      });
      return ok(summaries);
    },
  );

  app.post<{ Params: CampaignParams; Body: SummaryBody }>(
    '/summaries',
    {
      schema: {
        tags: ['journal'],
        summary: 'Create a session summary',
        operationId: 'createSessionSummary',
        params: campaignParamsSchema,
        body: summaryBodySchema,
        response: {
          201: singleResponseSchema(sessionSummarySchema),
        },
      },
    },
    async (request, reply) => {
      await moderatePayloadText(app.config, request.body);
      const { title, content, sessionDate, gameDate, visible, channelId } = request.body;
      const prisma = getPrismaClient();
      if (channelId !== undefined) {
        await createCampaignAccess(prisma).requireResource(request.campaignScope, {
          kind: 'channel',
          id: channelId,
        });
      }
      const campaign = await prisma.campaign.findUniqueOrThrow({
        where: { id: request.campaignScope.campaignId },
        select: { gameSystemId: true, gameDate: true },
      });
      const resolvedGameDate = gameDate === undefined ? parseGameDate(campaign.gameDate) : gameDate;
      if (resolvedGameDate !== null) {
        const validationError = getGameDateValidationError(campaign.gameSystemId, resolvedGameDate);
        if (validationError !== null) {
          return sendError(reply, 400, validationError);
        }
      }
      reply.code(201);
      const summary = await prisma.sessionSummary.create({
        data: {
          title,
          content,
          campaignId: request.campaignScope.campaignId,
          sessionDate: new Date(sessionDate),
          ...(resolvedGameDate === null ? {} : { gameDate: toGameDateJson(resolvedGameDate) }),
          visible: visible ?? false,
          channelId,
        },
        select: summarySelect,
      });
      return ok(summary);
    },
  );

  app.patch<{ Params: SummaryParams; Body: SummaryPatchBody }>(
    '/summaries/:sumId',
    {
      schema: {
        tags: ['journal'],
        summary: 'Update a session summary',
        operationId: 'updateSessionSummary',
        params: summaryParamsSchema,
        body: summaryPatchBodySchema,
        response: {
          200: singleResponseSchema(sessionSummarySchema),
        },
      },
    },
    async (request, reply) => {
      await moderatePayloadText(app.config, request.body);
      const { sumId } = request.params;
      const { title, content, sessionDate, gameDate, visible, channelId } = request.body;
      const prisma = getPrismaClient();
      const campaignAccess = createCampaignAccess(prisma);
      await campaignAccess.requireResource(request.campaignScope, {
        kind: 'session-summary',
        id: sumId,
      });
      if (channelId !== undefined) {
        await campaignAccess.requireResource(request.campaignScope, {
          kind: 'channel',
          id: channelId,
        });
      }
      if (gameDate !== undefined && gameDate !== null) {
        const campaign = await prisma.campaign.findUniqueOrThrow({
          where: { id: request.campaignScope.campaignId },
          select: { gameSystemId: true },
        });
        const validationError = getGameDateValidationError(campaign.gameSystemId, gameDate);
        if (validationError !== null) {
          return sendError(reply, 400, validationError);
        }
      }
      const data: Prisma.SessionSummaryUpdateInput = {};
      if (title !== undefined) data.title = title;
      if (content !== undefined) data.content = content;
      if (sessionDate !== undefined) data.sessionDate = new Date(sessionDate);
      if (gameDate !== undefined) {
        data.gameDate = gameDate === null ? Prisma.DbNull : toGameDateJson(gameDate);
      }
      if (visible !== undefined) data.visible = visible;
      if (channelId !== undefined) data.channel = { connect: { id: channelId } };
      try {
        const summary = await prisma.sessionSummary.update({
          where: { id: sumId },
          data,
          select: summarySelect,
        });
        return ok(summary);
      } catch (err) {
        if (isPrismaNotFoundError(err)) {
          return sendNotFound(reply, 'Not found');
        }
        throw err;
      }
    },
  );

  app.get<{ Params: DiscordTargetParams }>(
    '/journal/for/:discordId',
    {
      schema: {
        tags: ['journal'],
        summary: 'Get player journal view',
        operationId: 'getJournalForPlayer',
        params: discordTargetParamsSchema,
        response: {
          200: singleResponseSchema(journalForPlayerSchema),
        },
      },
    },
    async (request) => {
      const { discordId } = request.params;
      const prisma = getPrismaClient();
      return ok(await getPlayerJournal(prisma, request.campaignScope.campaignId, discordId));
    },
  );

  app.get<{ Params: CampaignParams }>(
    '/journal/me',
    {
      schema: {
        tags: ['journal'],
        summary: 'Get current player journal view',
        operationId: 'getJournalForCurrentPlayer',
        params: campaignParamsSchema,
        response: {
          200: singleResponseSchema(journalForPlayerSchema),
        },
      },
    },
    async (request, reply) => {
      const discordUserId = request.access.kind === 'session' ? request.access.discordUserId : null;
      if (!discordUserId) {
        return sendError(reply, 403, 'Discord identity required');
      }

      const prisma = getPrismaClient();
      return ok(await getPlayerJournal(prisma, request.campaignScope.campaignId, discordUserId));
    },
  );
};

export default journalRoutes;
