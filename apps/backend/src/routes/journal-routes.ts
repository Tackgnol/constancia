import type { FastifyPluginAsync } from 'fastify';
import {
  campaignParamsSchema,
  deleteResponseSchema,
  discordTargetParamsSchema,
  questBodySchema,
  questEntryBodySchema,
  questEntryParamsSchema,
  questParamsSchema,
  questPatchBodySchema,
  standardResponseSchema,
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
  status: 'active',
  visible: true,
};

const sampleSummary = {
  id: 'summary-1',
  title: 'Session One',
  content: 'The coterie entered Chicago.',
  sessionDate: '2026-04-17T19:00:00.000Z',
  visible: true,
};

const journalRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/quests',
    {
      schema: {
        tags: ['journal'],
        summary: 'List quests',
        operationId: 'listQuests',
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
        data: [{ ...sampleQuest, campaignId: params.id }],
      };
    },
  );

  app.post(
    '/quests',
    {
      schema: {
        tags: ['journal'],
        summary: 'Create a quest',
        operationId: 'createQuest',
        params: campaignParamsSchema,
        body: questBodySchema,
        response: {
          201: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as CampaignParams;
      const body = request.body as QuestBody;
      reply.code(201);
      return {
        status: 'stub',
        data: {
          id: 'quest-new',
          campaignId: params.id,
          status: 'active',
          ...body,
        },
      };
    },
  );

  app.patch(
    '/quests/:questId',
    {
      schema: {
        tags: ['journal'],
        summary: 'Update a quest',
        operationId: 'updateQuest',
        params: questParamsSchema,
        body: questPatchBodySchema,
        response: {
          200: standardResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as QuestParams;
      const body = request.body as QuestPatchBody;
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

  app.post(
    '/quests/:questId/entries',
    {
      schema: {
        tags: ['journal'],
        summary: 'Create a quest entry',
        operationId: 'createQuestEntry',
        params: questParamsSchema,
        body: questEntryBodySchema,
        response: {
          201: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as QuestParams;
      const body = request.body as QuestEntryBody;
      reply.code(201);
      return {
        status: 'stub',
        data: {
          id: 'entry-new',
          questId: params.questId,
          ...body,
        },
      };
    },
  );

  app.patch(
    '/quests/:questId/entries/:entryId',
    {
      schema: {
        tags: ['journal'],
        summary: 'Update a quest entry',
        operationId: 'updateQuestEntry',
        params: questEntryParamsSchema,
        body: questEntryBodySchema,
        response: {
          200: standardResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as QuestEntryParams;
      const body = request.body as QuestEntryBody;
      return {
        status: 'stub',
        data: {
          id: params.entryId,
          questId: params.questId,
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

  app.get(
    '/summaries',
    {
      schema: {
        tags: ['journal'],
        summary: 'List session summaries',
        operationId: 'listSessionSummaries',
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
        data: [{ ...sampleSummary, campaignId: params.id }],
      };
    },
  );

  app.post(
    '/summaries',
    {
      schema: {
        tags: ['journal'],
        summary: 'Create a session summary',
        operationId: 'createSessionSummary',
        params: campaignParamsSchema,
        body: summaryBodySchema,
        response: {
          201: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as CampaignParams;
      const body = request.body as SummaryBody;
      reply.code(201);
      return {
        status: 'stub',
        data: {
          id: 'summary-new',
          campaignId: params.id,
          ...body,
        },
      };
    },
  );

  app.patch(
    '/summaries/:sumId',
    {
      schema: {
        tags: ['journal'],
        summary: 'Update a session summary',
        operationId: 'updateSessionSummary',
        params: summaryParamsSchema,
        body: summaryBodySchema,
        response: {
          200: standardResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as SummaryParams;
      const body = request.body as SummaryBody;
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

  app.get(
    '/journal/for/:discordId',
    {
      schema: {
        tags: ['journal'],
        summary: 'Get player journal view',
        operationId: 'getJournalForPlayer',
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
        data: {
          campaignId: params.id,
          discordId: params.discordId,
          quests: [sampleQuest],
          summaries: [sampleSummary],
        },
      };
    },
  );
};

export default journalRoutes;
