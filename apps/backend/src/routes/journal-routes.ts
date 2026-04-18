import type { FastifyPluginAsync } from 'fastify';
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
  summaryParamsSchema,
} from '../schemas.js';

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
  visible?: boolean;
  channelId?: string;
}

const sampleQuest = {
  id: 'quest-1',
  name: 'Find The Chantry',
  description: 'Locate the hidden chantry.',
  campaignId: 'campaign-1',
  status: 'active',
  sortOrder: 0,
  visible: true,
};

const sampleSummary = {
  id: 'summary-1',
  title: 'Session One',
  content: 'The coterie entered Chicago.',
  campaignId: 'campaign-1',
  sessionDate: '2026-04-17T19:00:00.000Z',
  visible: true,
};

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
      const params = request.params;
      return {
        status: 'stub',
        data: [{ ...sampleQuest, campaignId: params.id }],
      };
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
      const params = request.params;
      const body = request.body;
      reply.code(201);
      return {
        status: 'stub',
        data: {
          id: 'quest-new',
          campaignId: params.id,
          status: 'active',
          sortOrder: 0,
          description: '',
          visible: body.visible ?? false,
          ...body,
        },
      };
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
    async (request) => {
      const params = request.params;
      const body = request.body;
      return {
        status: 'stub',
        data: {
          ...sampleQuest,
          id: params.questId,
          campaignId: params.id,
          ...body,
        },
      };
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
      const params = request.params;
      const body = request.body;
      reply.code(201);
      return {
        status: 'stub',
        data: {
          id: 'entry-new',
          questId: params.questId,
          status: body.status ?? 'active',
          sortOrder: body.sortOrder ?? 0,
          ...body,
        },
      };
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
    async (request) => {
      const params = request.params;
      const body = request.body;
      return {
        status: 'stub',
        data: {
          id: params.entryId,
          questId: params.questId,
          status: body.status ?? 'active',
          sortOrder: body.sortOrder ?? 0,
          ...body,
        },
      };
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
    async () => ({
      status: 'stub',
      deleted: true,
    }),
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
      const params = request.params;
      return {
        status: 'stub',
        data: [{ ...sampleSummary, campaignId: params.id }],
      };
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
      const params = request.params;
      const body = request.body;
      reply.code(201);
      return {
        status: 'stub',
        data: {
          id: 'summary-new',
          campaignId: params.id,
          visible: body.visible ?? false,
          ...body,
        },
      };
    },
  );

  app.patch<{ Params: SummaryParams; Body: SummaryBody }>(
    '/summaries/:sumId',
    {
      schema: {
        tags: ['journal'],
        summary: 'Update a session summary',
        operationId: 'updateSessionSummary',
        params: summaryParamsSchema,
        body: summaryBodySchema,
        response: {
          200: singleResponseSchema(sessionSummarySchema),
        },
      },
    },
    async (request) => {
      const params = request.params;
      const body = request.body;
      return {
        status: 'stub',
        data: {
          ...sampleSummary,
          id: params.sumId,
          campaignId: params.id,
          ...body,
        },
      };
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
      const params = request.params;
      return {
        status: 'stub',
        data: {
          quests: [{ ...sampleQuest, campaignId: params.id }],
          summaries: [{ ...sampleSummary, campaignId: params.id }],
        },
      };
    },
  );
};

export default journalRoutes;
