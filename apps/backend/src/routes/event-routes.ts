import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@constancia/db';
import type { EventStatus } from '@constancia/contracts';
import { getPrismaClient } from '../auth/prisma.js';
import { deleted, isPrismaNotFoundError, ok, sendNotFound } from '../http-responses.js';
import { moderatePayloadText } from '../services/content-moderation.js';
import { createCampaignAccess } from '../services/campaign-access.js';
import {
  campaignParamsSchema,
  deleteResponseSchema,
  eventBodySchema,
  eventParamsSchema,
  eventPatchBodySchema,
  fireEventResultSchema,
  idempotencyKeyHeaderSchema,
  gameEventSchema,
  listResponseSchema,
  singleResponseSchema,
  testInstanceParamsSchema,
  testInstanceSchema,
  testSubmissionParamsSchema,
} from '../schemas.js';
import { listTestInstanceDetails } from '../services/test-instance-detail.js';
import {
  assertPipelineUploadAssetsAttachable,
  deleteEventUploadAssets,
  deleteUnlinkedEventUploadAssets,
  extractUploadAssetIdsFromPipeline,
  linkPipelineUploadAssets,
} from '../services/upload-assets.js';

interface CampaignParams {
  id: string;
}

interface EventParams {
  id: string;
  eventId: string;
}

interface TestInstanceParams extends EventParams {
  instanceId: string;
}

interface TestSubmissionParams extends TestInstanceParams {
  discordUserId: string;
}

interface IdempotencyHeaders {
  'idempotency-key': string;
}

interface EventBlockInput {
  blockType: string;
  config: Record<string, unknown>;
}

interface EventBody {
  name: string;
  type: string;
  channelId: string;
  shortCircuit?: boolean;
  pipeline: EventBlockInput[];
}

interface EventPatchBody {
  name?: string;
  type?: string;
  channelId?: string;
  status?: EventStatus;
  shortCircuit?: boolean;
  pipeline?: EventBlockInput[];
}

const eventSelect = {
  id: true,
  name: true,
  type: true,
  channelId: true,
  campaignId: true,
  status: true,
  shortCircuit: true,
  pipeline: true,
} as const;

const eventRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: CampaignParams }>(
    '/',
    {
      schema: {
        tags: ['events'],
        summary: 'List events',
        operationId: 'listEvents',
        params: campaignParamsSchema,
        response: {
          200: listResponseSchema(gameEventSchema),
        },
      },
    },
    async (request) => {
      const prisma = getPrismaClient();
      const events = await prisma.event.findMany({
        where: { campaignId: request.campaignScope.campaignId },
        select: eventSelect,
      });
      return ok(events);
    },
  );

  app.post<{ Params: CampaignParams; Body: EventBody }>(
    '/',
    {
      schema: {
        tags: ['events'],
        summary: 'Create an event',
        operationId: 'createEvent',
        params: campaignParamsSchema,
        body: eventBodySchema,
        response: {
          201: singleResponseSchema(gameEventSchema),
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      await moderatePayloadText(app.config, request.body);
      const { name, type, channelId, shortCircuit, pipeline } = request.body;
      await createCampaignAccess(prisma).requireResource(request.campaignScope, {
        kind: 'channel',
        id: channelId,
      });
      const userId = getSessionUserId(request.access);
      const assetIds = extractUploadAssetIdsFromPipeline(pipeline);
      await assertPipelineUploadAssetsAttachable(prisma, { assetIds, userId });
      const event = await prisma.event.create({
        data: {
          name,
          type,
          channelId,
          campaignId: request.campaignScope.campaignId,
          shortCircuit: shortCircuit ?? false,
          pipeline: pipeline as unknown as Prisma.InputJsonValue,
        },
        select: eventSelect,
      });
      await linkPipelineUploadAssets(prisma, { assetIds, userId, eventId: event.id });
      reply.code(201);
      return ok(event);
    },
  );

  app.get<{ Params: EventParams }>(
    '/:eventId',
    {
      schema: {
        tags: ['events'],
        summary: 'Get an event',
        operationId: 'getEvent',
        params: eventParamsSchema,
        response: {
          200: singleResponseSchema(gameEventSchema),
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      await moderatePayloadText(app.config, request.body);
      const { eventId } = request.params;
      await createCampaignAccess(prisma).requireResource(request.campaignScope, {
        kind: 'event',
        id: eventId,
      });
      const event = await prisma.event.findUnique({ where: { id: eventId }, select: eventSelect });
      if (event === null) {
        return sendNotFound(reply, 'Event not found');
      }
      return ok(event);
    },
  );

  app.patch<{ Params: EventParams; Body: EventPatchBody }>(
    '/:eventId',
    {
      schema: {
        tags: ['events'],
        summary: 'Update an event',
        operationId: 'updateEvent',
        params: eventParamsSchema,
        body: eventPatchBodySchema,
        response: {
          200: singleResponseSchema(gameEventSchema),
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      await moderatePayloadText(app.config, request.body);
      const { eventId } = request.params;
      const { name, type, channelId, status, shortCircuit, pipeline } = request.body;
      const campaignAccess = createCampaignAccess(prisma);
      await campaignAccess.requireResource(request.campaignScope, { kind: 'event', id: eventId });
      if (channelId !== undefined) {
        await campaignAccess.requireResource(request.campaignScope, {
          kind: 'channel',
          id: channelId,
        });
      }
      const userId = getSessionUserId(request.access);
      const assetIds =
        pipeline !== undefined ? extractUploadAssetIdsFromPipeline(pipeline) : undefined;
      if (assetIds !== undefined) {
        await assertPipelineUploadAssetsAttachable(prisma, { assetIds, userId, eventId });
      }
      const data: Prisma.EventUpdateInput = {};
      if (name !== undefined) data.name = name;
      if (type !== undefined) data.type = type;
      if (channelId !== undefined) data.channel = { connect: { id: channelId } };
      if (status !== undefined) data.status = status;
      if (shortCircuit !== undefined) data.shortCircuit = shortCircuit;
      if (pipeline !== undefined) data.pipeline = pipeline as unknown as Prisma.InputJsonValue;
      try {
        const event = await prisma.event.update({
          where: { id: eventId },
          data,
          select: eventSelect,
        });
        if (assetIds !== undefined) {
          await linkPipelineUploadAssets(prisma, { assetIds, userId, eventId });
          await deleteUnlinkedEventUploadAssets(app.config, prisma, {
            eventId,
            retainedAssetIds: assetIds,
          });
        }
        return ok(event);
      } catch (err) {
        if (isPrismaNotFoundError(err)) {
          return sendNotFound(reply, 'Event not found');
        }
        throw err;
      }
    },
  );

  app.delete<{ Params: EventParams }>(
    '/:eventId',
    {
      schema: {
        tags: ['events'],
        summary: 'Delete an event',
        operationId: 'deleteEvent',
        params: eventParamsSchema,
        response: {
          200: deleteResponseSchema,
        },
      },
    },
    async (request) => {
      const prisma = getPrismaClient();
      const { eventId } = request.params;
      await createCampaignAccess(prisma).requireResource(request.campaignScope, {
        kind: 'event',
        id: eventId,
      });

      await deleteEventUploadAssets(app.config, prisma, eventId);
      await prisma.event.delete({ where: { id: eventId } });
      return deleted(true);
    },
  );

  app.post<{ Params: EventParams; Headers: IdempotencyHeaders }>(
    '/:eventId/fire',
    {
      schema: {
        tags: ['events'],
        summary: 'Fire an event pipeline',
        operationId: 'fireEvent',
        params: eventParamsSchema,
        headers: idempotencyKeyHeaderSchema,
        response: {
          200: singleResponseSchema(fireEventResultSchema),
        },
      },
    },
    async (request) => {
      const prisma = getPrismaClient();
      const { eventId } = request.params;
      await createCampaignAccess(prisma).requireResource(request.campaignScope, {
        kind: 'event',
        id: eventId,
      });
      const receipt = await app.eventExecution.fire({
        idempotencyKey: request.headers['idempotency-key'],
        campaignId: request.campaignScope.campaignId,
        eventId,
      });
      return ok(receipt);
    },
  );

  app.get<{ Params: EventParams }>(
    '/:eventId/test-instances',
    {
      schema: {
        tags: ['events'],
        summary: 'List Test instances for an event, newest first',
        operationId: 'listTestInstances',
        params: eventParamsSchema,
        response: {
          200: listResponseSchema(testInstanceSchema),
        },
      },
    },
    async (request) => {
      const prisma = getPrismaClient();
      const { eventId } = request.params;
      await createCampaignAccess(prisma).requireResource(request.campaignScope, {
        kind: 'event',
        id: eventId,
      });
      return ok(
        await listTestInstanceDetails(prisma, {
          campaignId: request.campaignScope.campaignId,
          eventId,
        }),
      );
    },
  );

  const testInstanceAction = (
    action: 'close' | 'reopen',
    summary: string,
    data: Prisma.TestInstanceUpdateInput,
  ) =>
    app.post<{ Params: TestInstanceParams }>(
      `/:eventId/test-instances/:instanceId/${action}`,
      {
        schema: {
          tags: ['events'],
          summary,
          operationId: `${action}TestInstance`,
          params: testInstanceParamsSchema,
          response: {
            200: singleResponseSchema(testInstanceSchema),
          },
        },
      },
      async (request, reply) => {
        const prisma = getPrismaClient();
        const { eventId, instanceId } = request.params;
        await createCampaignAccess(prisma).requireResource(request.campaignScope, {
          kind: 'event',
          id: eventId,
        });
        const updated = await prisma.testInstance.updateMany({
          where: { id: instanceId, eventId },
          data,
        });
        if (updated.count !== 1) {
          return sendNotFound(reply, 'Test instance not found');
        }
        const [detail] = await listTestInstanceDetails(prisma, {
          campaignId: request.campaignScope.campaignId,
          eventId,
          instanceId,
        });
        return ok(detail);
      },
    );

  testInstanceAction('close', 'Close a Test instance to new results', {
    status: 'closed',
    closedAt: new Date(),
  });
  testInstanceAction('reopen', 'Reopen a closed Test instance', {
    status: 'open',
    closedAt: null,
  });

  // Reopening a player only frees their slot to resubmit; effects already applied stay.
  app.post<{ Params: TestSubmissionParams }>(
    '/:eventId/test-instances/:instanceId/submissions/:discordUserId/reopen',
    {
      schema: {
        tags: ['events'],
        summary: "Reopen one player's submission so they can resubmit",
        operationId: 'reopenTestSubmission',
        params: testSubmissionParamsSchema,
        response: {
          200: singleResponseSchema(testInstanceSchema),
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      const { eventId, instanceId, discordUserId } = request.params;
      await createCampaignAccess(prisma).requireResource(request.campaignScope, {
        kind: 'event',
        id: eventId,
      });
      const owned = await prisma.testInstance.findFirst({
        where: { id: instanceId, eventId },
        select: { id: true },
      });
      if (owned === null) {
        return sendNotFound(reply, 'Test instance not found');
      }
      await prisma.testSubmission.deleteMany({ where: { instanceId, discordUserId } });
      const [detail] = await listTestInstanceDetails(prisma, {
        campaignId: request.campaignScope.campaignId,
        eventId,
        instanceId,
      });
      return ok(detail);
    },
  );
};

export default eventRoutes;

function getSessionUserId(access: { kind: 'session'; userId: string } | { kind: 'bot' }): string {
  if (access.kind !== 'session') {
    throw new Error('Session access required for event uploads.');
  }

  return access.userId;
}
