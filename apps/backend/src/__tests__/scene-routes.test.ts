import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessContext } from '../auth/access-context.js';
import configPlugin from '../plugins/config-plugin.js';
import campaignAdminScopePlugin from '../plugins/campaign-admin-scope-plugin.js';
import requestErrorPlugin from '../plugins/request-error-plugin.js';
import { createTestBackendConfig } from './test-config.js';

const CAMPAIGN_ID = 'campaign-1';
const SCENE_ID = 'scene-1';
const CREATED_AT = new Date('2026-07-01T10:00:00.000Z');
const UPDATED_AT = new Date('2026-07-02T10:00:00.000Z');

const sceneDetail = {
  id: SCENE_ID,
  name: 'Elysium',
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  mapAsset: null,
  pegs: [],
};

const npcPegRow = {
  id: 'peg-1',
  x: 0.25,
  y: 0.75,
  event: null,
  npc: { id: 'npc-1', name: 'Marcel', imageUrl: null },
  loreEntry: null,
};

const prismaMock = vi.hoisted(() => ({
  campaign: { findUnique: vi.fn() },
  campaignAdmin: { findUnique: vi.fn() },
  event: { findFirst: vi.fn() },
  channel: { findFirst: vi.fn() },
  character: { findFirst: vi.fn() },
  npc: { findFirst: vi.fn() },
  npcFact: { findFirst: vi.fn() },
  quest: { findFirst: vi.fn() },
  questEntry: { findFirst: vi.fn() },
  sessionSummary: { findFirst: vi.fn() },
  loreEntry: { findFirst: vi.fn() },
  scene: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  scenePeg: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  uploadAsset: { findFirst: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(async (operations: unknown[]) =>
    Promise.all(operations as Promise<unknown>[]),
  ),
}));

vi.mock('../auth/prisma.js', () => ({ getPrismaClient: () => prismaMock }));

const { default: sceneRoutes } = await import('../routes/scene-routes.js');

async function buildTestApp(access: AccessContext) {
  const app = Fastify({ logger: false });
  await app.register(configPlugin, { config: createTestBackendConfig() });
  await app.register(requestErrorPlugin);
  app.addHook('onRequest', async (request) => {
    request.access = access;
  });
  await app.register(campaignAdminScopePlugin);
  await app.register(sceneRoutes, { prefix: '/campaigns/:id/scenes' });

  return app;
}

const gmSession: AccessContext = {
  kind: 'session',
  userId: 'user-1',
  email: 'gm@example.com',
  discordUserId: 'discord-gm',
  isSuperUser: false,
};

let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeEach(async () => {
  vi.clearAllMocks();
  prismaMock.campaign.findUnique.mockResolvedValue({
    id: CAMPAIGN_ID,
    discordGuildId: 'guild-1',
    gameSystemId: 'vtm-v5',
  });
  prismaMock.campaignAdmin.findUnique.mockResolvedValue({ role: 'gm' });
  prismaMock.scene.findFirst.mockResolvedValue(sceneDetail);
  prismaMock.scene.findMany.mockResolvedValue([
    { ...sceneDetail, mapAsset: { id: 'asset-1' }, _count: { pegs: 2 } },
  ]);
  prismaMock.scene.create.mockResolvedValue(sceneDetail);
  prismaMock.scene.update.mockResolvedValue(sceneDetail);
  prismaMock.scene.delete.mockResolvedValue({ id: SCENE_ID });
  prismaMock.npc.findFirst.mockResolvedValue({ id: 'npc-1' });
  prismaMock.scenePeg.findFirst.mockResolvedValue({ id: 'peg-1' });
  prismaMock.scenePeg.create.mockResolvedValue(npcPegRow);
  prismaMock.scenePeg.update.mockResolvedValue(npcPegRow);
  prismaMock.scenePeg.delete.mockResolvedValue({ id: 'peg-1' });
  prismaMock.uploadAsset.findFirst.mockResolvedValue(null);
  app = await buildTestApp(gmSession);
});

afterEach(async () => {
  await app.close();
});

const url = (suffix = '') => `/campaigns/${CAMPAIGN_ID}/scenes${suffix}`;

describe('scene route schemas', () => {
  it.each([
    ['a coordinate above one', { kind: 'npc', targetId: 'npc-1', x: 1.5, y: 0.5 }],
    ['a negative coordinate', { kind: 'npc', targetId: 'npc-1', x: -0.1, y: 0.5 }],
    ['an unknown peg kind', { kind: 'treasure', targetId: 't-1', x: 0.5, y: 0.5 }],
    ['a missing target', { kind: 'npc', x: 0.5, y: 0.5 }],
  ])('rejects %s before the handler runs', async (_label, payload) => {
    const response = await app.inject({ method: 'POST', url: url(`/${SCENE_ID}/pegs`), payload });

    expect(response.statusCode).toBe(400);
    expect(prismaMock.scenePeg.create).not.toHaveBeenCalled();
  });

  it('strips an unexpected property rather than passing it to Prisma', async () => {
    // Fastify's ajv defaults remove additional properties instead of failing the request.
    const response = await app.inject({
      method: 'POST',
      url: url(`/${SCENE_ID}/pegs`),
      payload: { kind: 'npc', targetId: 'npc-1', x: 0.5, y: 0.5, campaignId: 'other-campaign' },
    });

    expect(response.statusCode).toBe(201);
    expect(prismaMock.scenePeg.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { sceneId: SCENE_ID, npcId: 'npc-1', x: 0.5, y: 0.5 },
      }),
    );
  });

  it('rejects an empty scene name before the handler runs', async () => {
    const response = await app.inject({ method: 'POST', url: url('/'), payload: { name: '' } });

    expect(response.statusCode).toBe(400);
    expect(prismaMock.scene.create).not.toHaveBeenCalled();
  });

  it('rejects a map body without an asset id', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: url(`/${SCENE_ID}/map`),
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(prismaMock.uploadAsset.update).not.toHaveBeenCalled();
  });
});

describe('scene route campaign scoping', () => {
  it.each([
    ['GET', ''],
    ['GET', `/${SCENE_ID}`],
    ['DELETE', `/${SCENE_ID}`],
    ['DELETE', `/${SCENE_ID}/map`],
    ['DELETE', `/${SCENE_ID}/pegs/peg-1`],
  ] as const)('resolves a campaign scope for %s %s', async (method, suffix) => {
    await app.inject({ method, url: url(suffix) });

    expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
      where: { id: CAMPAIGN_ID },
      select: { id: true, discordGuildId: true, gameSystemId: true },
    });
  });

  it('refuses a caller who is not a campaign admin', async () => {
    prismaMock.campaignAdmin.findUnique.mockResolvedValue(null);

    const response = await app.inject({ method: 'GET', url: url('') });

    expect(response.statusCode).toBe(403);
    expect(prismaMock.scene.findMany).not.toHaveBeenCalled();
  });

  it('reports a scene from another campaign as not found', async () => {
    prismaMock.scene.findFirst.mockResolvedValue(null);

    const response = await app.inject({ method: 'GET', url: url('/rival-scene') });

    expect(response.statusCode).toBe(404);
    expect(response.json().data.code).toBe('CAMPAIGN_RESOURCE_NOT_FOUND');
  });

  it('reports a target from another campaign as not found', async () => {
    prismaMock.npc.findFirst.mockResolvedValue(null);

    const response = await app.inject({
      method: 'POST',
      url: url(`/${SCENE_ID}/pegs`),
      payload: { kind: 'npc', targetId: 'rival-npc', x: 0.5, y: 0.5 },
    });

    expect(response.statusCode).toBe(404);
    expect(prismaMock.scenePeg.create).not.toHaveBeenCalled();
  });
});

describe('scene route responses', () => {
  it('lists scenes in the standard envelope', async () => {
    const response = await app.inject({ method: 'GET', url: url('') });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      data: [
        {
          id: SCENE_ID,
          name: 'Elysium',
          hasMap: true,
          pegCount: 2,
          createdAt: CREATED_AT.toISOString(),
          updatedAt: UPDATED_AT.toISOString(),
        },
      ],
    });
  });

  it('creates a scene with 201 and a normalized name', async () => {
    const response = await app.inject({
      method: 'POST',
      url: url('/'),
      payload: { name: '  The   Docks  ' },
    });

    expect(response.statusCode).toBe(201);
    expect(prismaMock.scene.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'The Docks', campaignId: CAMPAIGN_ID } }),
    );
  });

  it('creates a peg with 201 and a discriminated body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: url(`/${SCENE_ID}/pegs`),
      payload: { kind: 'npc', targetId: 'npc-1', x: 0.25, y: 0.75 },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      status: 'ok',
      data: {
        id: 'peg-1',
        kind: 'npc',
        x: 0.25,
        y: 0.75,
        target: { id: 'npc-1', name: 'Marcel', imageUrl: null },
      },
    });
  });

  it('returns 409 when the target already has a peg in this scene', async () => {
    prismaMock.scenePeg.create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { modelName: 'ScenePeg' },
      }),
    );

    const response = await app.inject({
      method: 'POST',
      url: url(`/${SCENE_ID}/pegs`),
      payload: { kind: 'npc', targetId: 'npc-1', x: 0.25, y: 0.75 },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().data.code).toBe('SCENE_PEG_TARGET_ALREADY_PLACED');
  });

  it('deletes a scene through the standard delete envelope, cleaning up its map storage', async () => {
    prismaMock.uploadAsset.findFirst.mockResolvedValueOnce({
      id: 'asset-old',
      storageProvider: 'local',
      storageKey: 'uploads/asset-old.webp',
      bucket: null,
    });

    const response = await app.inject({ method: 'DELETE', url: url(`/${SCENE_ID}`) });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', deleted: true });
    // The service now owns prepare/finish map-asset cleanup as part of `remove`, so the route
    // itself only has to call `scenes.remove` and the storage read still has to precede the delete.
    expect(prismaMock.uploadAsset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sceneId: SCENE_ID } }),
    );
    expect(prismaMock.scene.delete).toHaveBeenCalledWith({ where: { id: SCENE_ID } });
  });

  it('attaches a map and returns the backend asset URL', async () => {
    prismaMock.uploadAsset.findFirst.mockImplementation(async (args: { where: { id?: string } }) =>
      args.where.id === 'asset-7' ? { id: 'asset-7', eventId: null, sceneId: null } : null,
    );

    const response = await app.inject({
      method: 'PUT',
      url: url(`/${SCENE_ID}/map`),
      payload: { assetId: 'asset-7' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      data: { assetId: 'asset-7', url: 'http://localhost:3001/api/v1/uploads/asset-7' },
    });
  });

  it('checks scene existence with a minimal select before attaching a map', async () => {
    prismaMock.uploadAsset.findFirst.mockImplementation(async (args: { where: { id?: string } }) =>
      args.where.id === 'asset-7' ? { id: 'asset-7', eventId: null, sceneId: null } : null,
    );

    await app.inject({
      method: 'PUT',
      url: url(`/${SCENE_ID}/map`),
      payload: { assetId: 'asset-7' },
    });

    // `scenes.exists` now backs this check instead of the full-detail `scenes.get`, so the scene
    // lookup should be a bare `SELECT id` rather than the peg-joining detail select.
    expect(prismaMock.scene.findFirst).toHaveBeenCalledWith({
      where: { id: SCENE_ID, campaignId: CAMPAIGN_ID },
      select: { id: true },
    });
  });

  it('checks scene existence with a minimal select before detaching a map', async () => {
    await app.inject({ method: 'DELETE', url: url(`/${SCENE_ID}/map`) });

    expect(prismaMock.scene.findFirst).toHaveBeenCalledWith({
      where: { id: SCENE_ID, campaignId: CAMPAIGN_ID },
      select: { id: true },
    });
  });
});

describe('scene map session requirement', () => {
  it('refuses bot credentials before touching upload ownership', async () => {
    await app.close();
    app = await buildTestApp({ kind: 'bot' });

    const response = await app.inject({
      method: 'PUT',
      url: url(`/${SCENE_ID}/map`),
      payload: { assetId: 'asset-7' },
    });

    expect(response.statusCode).toBe(401);
    expect(prismaMock.uploadAsset.update).not.toHaveBeenCalled();
  });
});
