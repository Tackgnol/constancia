import type { FastifyPluginAsync } from 'fastify';
import { getPrismaClient } from '../auth/prisma.js';
import { deleted, ok } from '../http-responses.js';
import {
  campaignParamsSchema,
  deleteResponseSchema,
  listResponseSchema,
  sceneBodySchema,
  sceneMapBodySchema,
  sceneMapSchema,
  sceneParamsSchema,
  scenePatchBodySchema,
  scenePegBodySchema,
  scenePegParamsSchema,
  scenePegPatchBodySchema,
  scenePegSchema,
  sceneSchema,
  sceneSummarySchema,
  singleResponseSchema,
  standardResponseSchema,
} from '../schemas.js';
import { createCampaignAccess } from '../services/campaign-access.js';
import { clearSceneMap, requireSessionUserId, setSceneMap } from '../services/scene-map-assets.js';
import { createSceneService, type ScenePegKind } from '../services/scene-service.js';

interface CampaignParams {
  id: string;
}

interface SceneParams extends CampaignParams {
  sceneId: string;
}

interface ScenePegParams extends SceneParams {
  pegId: string;
}

interface SceneBody {
  name: string;
}

interface SceneMapBody {
  assetId: string;
}

interface ScenePegBody {
  kind: ScenePegKind;
  targetId: string;
  x: number;
  y: number;
}

interface ScenePegPatchBody {
  x: number;
  y: number;
}

const sceneErrorResponses = {
  400: standardResponseSchema,
  401: standardResponseSchema,
  403: standardResponseSchema,
  404: standardResponseSchema,
} as const;

const sceneRoutes: FastifyPluginAsync = async (app) => {
  const services = () => {
    const prisma = getPrismaClient();
    return {
      prisma,
      scenes: createSceneService(app.config, prisma, createCampaignAccess(prisma)),
    };
  };

  app.get<{ Params: CampaignParams }>(
    '/',
    {
      schema: {
        tags: ['scenes'],
        summary: 'List campaign scenes',
        operationId: 'listScenes',
        params: campaignParamsSchema,
        response: {
          ...sceneErrorResponses,
          200: listResponseSchema(sceneSummarySchema),
        },
      },
    },
    async (request) => ok(await services().scenes.list(request.campaignScope)),
  );

  app.post<{ Params: CampaignParams; Body: SceneBody }>(
    '/',
    {
      schema: {
        tags: ['scenes'],
        summary: 'Create a scene',
        operationId: 'createScene',
        params: campaignParamsSchema,
        body: sceneBodySchema,
        response: {
          ...sceneErrorResponses,
          201: singleResponseSchema(sceneSchema),
        },
      },
    },
    async (request, reply) => {
      const scene = await services().scenes.create(request.campaignScope, request.body);
      reply.code(201);
      return ok(scene);
    },
  );

  app.get<{ Params: SceneParams }>(
    '/:sceneId',
    {
      schema: {
        tags: ['scenes'],
        summary: 'Get a scene with its map and pegs',
        operationId: 'getScene',
        params: sceneParamsSchema,
        response: {
          ...sceneErrorResponses,
          200: singleResponseSchema(sceneSchema),
        },
      },
    },
    async (request) =>
      ok(await services().scenes.get(request.campaignScope, request.params.sceneId)),
  );

  app.patch<{ Params: SceneParams; Body: SceneBody }>(
    '/:sceneId',
    {
      schema: {
        tags: ['scenes'],
        summary: 'Rename a scene',
        operationId: 'updateScene',
        params: sceneParamsSchema,
        body: scenePatchBodySchema,
        response: {
          ...sceneErrorResponses,
          200: singleResponseSchema(sceneSchema),
        },
      },
    },
    async (request) =>
      ok(
        await services().scenes.rename(request.campaignScope, request.params.sceneId, request.body),
      ),
  );

  app.delete<{ Params: SceneParams }>(
    '/:sceneId',
    {
      schema: {
        tags: ['scenes'],
        summary: 'Delete a scene and its pegs',
        operationId: 'deleteScene',
        params: sceneParamsSchema,
        response: {
          ...sceneErrorResponses,
          200: deleteResponseSchema,
        },
      },
    },
    async (request) => {
      const { scenes } = services();
      await scenes.remove(request.campaignScope, request.params.sceneId, {
        logger: request.log,
      });

      return deleted(true);
    },
  );

  app.put<{ Params: SceneParams; Body: SceneMapBody }>(
    '/:sceneId/map',
    {
      schema: {
        tags: ['scenes'],
        summary: 'Attach or replace the scene map image',
        operationId: 'setSceneMap',
        params: sceneParamsSchema,
        body: sceneMapBodySchema,
        response: {
          ...sceneErrorResponses,
          200: singleResponseSchema(sceneMapSchema),
        },
      },
    },
    async (request) => {
      const { prisma, scenes } = services();
      const { sceneId } = request.params;
      const userId = requireSessionUserId(request.access);
      await scenes.exists(request.campaignScope, sceneId);

      return ok(
        await setSceneMap(app.config, prisma, {
          sceneId,
          assetId: request.body.assetId,
          userId,
          logger: request.log,
        }),
      );
    },
  );

  app.delete<{ Params: SceneParams }>(
    '/:sceneId/map',
    {
      schema: {
        tags: ['scenes'],
        summary: 'Remove the scene map image, keeping peg positions',
        operationId: 'deleteSceneMap',
        params: sceneParamsSchema,
        response: {
          ...sceneErrorResponses,
          200: deleteResponseSchema,
        },
      },
    },
    async (request) => {
      const { prisma, scenes } = services();
      const { sceneId } = request.params;
      requireSessionUserId(request.access);
      await scenes.exists(request.campaignScope, sceneId);
      await clearSceneMap(app.config, prisma, { sceneId, logger: request.log });

      return deleted(true);
    },
  );

  app.post<{ Params: SceneParams; Body: ScenePegBody }>(
    '/:sceneId/pegs',
    {
      schema: {
        tags: ['scenes'],
        summary: 'Place an event, NPC, or lore peg on a scene',
        operationId: 'createScenePeg',
        params: sceneParamsSchema,
        body: scenePegBodySchema,
        response: {
          ...sceneErrorResponses,
          201: singleResponseSchema(scenePegSchema),
          409: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const peg = await services().scenes.createPeg(
        request.campaignScope,
        request.params.sceneId,
        request.body,
      );
      reply.code(201);
      return ok(peg);
    },
  );

  app.patch<{ Params: ScenePegParams; Body: ScenePegPatchBody }>(
    '/:sceneId/pegs/:pegId',
    {
      schema: {
        tags: ['scenes'],
        summary: 'Move a scene peg',
        operationId: 'updateScenePeg',
        params: scenePegParamsSchema,
        body: scenePegPatchBodySchema,
        response: {
          ...sceneErrorResponses,
          200: singleResponseSchema(scenePegSchema),
        },
      },
    },
    async (request) =>
      ok(
        await services().scenes.movePeg(
          request.campaignScope,
          request.params.sceneId,
          request.params.pegId,
          request.body,
        ),
      ),
  );

  app.delete<{ Params: ScenePegParams }>(
    '/:sceneId/pegs/:pegId',
    {
      schema: {
        tags: ['scenes'],
        summary: 'Remove a scene peg',
        operationId: 'deleteScenePeg',
        params: scenePegParamsSchema,
        response: {
          ...sceneErrorResponses,
          200: deleteResponseSchema,
        },
      },
    },
    async (request) => {
      await services().scenes.removePeg(
        request.campaignScope,
        request.params.sceneId,
        request.params.pegId,
      );

      return deleted(true);
    },
  );
};

export default sceneRoutes;
