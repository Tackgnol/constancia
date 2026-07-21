import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionAccessContext } from '../auth/access-context.js';
import {
  CampaignResourceNotFoundError,
  createCampaignAccess,
  type CampaignAccessPrisma,
  type CampaignScope,
} from '../services/campaign-access.js';
import type { SceneMapAssetLogger } from '../services/scene-map-assets.js';
import {
  createSceneService,
  normalizeSceneName,
  ScenePegConflictError,
  SceneValidationError,
  type SceneServicePrisma,
  type ScenePegKind,
} from '../services/scene-service.js';
import { deleteUploadObjects } from '../services/upload-storage.js';
import type * as UploadStorageModule from '../services/upload-storage.js';
import { createTestBackendConfig } from './test-config.js';

vi.mock('../services/upload-storage.js', async (importOriginal) => {
  const actual = await importOriginal<typeof UploadStorageModule>();
  return { ...actual, deleteUploadObjects: vi.fn(async () => {}) };
});

const deleteUploadObjectsMock = vi.mocked(deleteUploadObjects);

const config = createTestBackendConfig();
const CAMPAIGN_ID = 'campaign-1';
const SCENE_ID = 'scene-1';
const CREATED_AT = new Date('2026-07-01T10:00:00.000Z');
const UPDATED_AT = new Date('2026-07-02T10:00:00.000Z');

type MissingResource = 'scene' | 'scenePeg' | 'event' | 'npc' | 'loreEntry';

/** Campaign access is exercised for real because CampaignScope cannot be forged from outside. */
function createAccessPrisma(missing: MissingResource[] = []): CampaignAccessPrisma {
  const resource = (name: MissingResource | 'other') => ({
    findFirst: vi.fn(async () =>
      name !== 'other' && missing.includes(name) ? null : { id: 'found' },
    ),
  });

  return {
    campaign: {
      findUnique: vi.fn(async () => ({
        id: CAMPAIGN_ID,
        discordGuildId: 'guild-1',
        gameSystemId: 'vtm-v5',
      })),
    },
    campaignAdmin: { findUnique: vi.fn(async () => ({ role: 'gm' as const })) },
    event: resource('event'),
    channel: resource('other'),
    character: resource('other'),
    npc: resource('npc'),
    npcFact: resource('other'),
    quest: resource('other'),
    questEntry: resource('other'),
    sessionSummary: resource('other'),
    loreEntry: resource('loreEntry'),
    scene: resource('scene'),
    scenePeg: resource('scenePeg'),
  };
}

function session(): SessionAccessContext {
  return {
    kind: 'session',
    userId: 'user-1',
    email: 'gm@example.com',
    discordUserId: 'discord-gm',
    isSuperUser: false,
  };
}

const eventTarget = { id: 'event-1', name: 'Ambush', status: 'ready' as const };
const npcTarget = { id: 'npc-1', name: 'Marcel', imageUrl: null };
const loreTarget = { id: 'lore-1', title: 'The Camarilla' };

function pegRow(overrides: Partial<Parameters<typeof buildPegRow>[0]> = {}) {
  return buildPegRow({ id: 'peg-1', x: 0.25, y: 0.75, ...overrides });
}

function buildPegRow(input: {
  id: string;
  x: number;
  y: number;
  event?: typeof eventTarget | null;
  npc?: typeof npcTarget | null;
  loreEntry?: typeof loreTarget | null;
}) {
  return {
    id: input.id,
    x: input.x,
    y: input.y,
    event: input.event ?? null,
    npc: input.npc ?? null,
    loreEntry: input.loreEntry ?? null,
  };
}

function detailRow(
  overrides: { mapAssetId?: string | null; pegs?: ReturnType<typeof pegRow>[] } = {},
) {
  return {
    id: SCENE_ID,
    name: 'Elysium',
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    mapAsset: overrides.mapAssetId === undefined ? null : { id: overrides.mapAssetId ?? '' },
    pegs: overrides.pegs ?? [],
  };
}

const mapStorageOf = (id: string) => ({
  id,
  storageProvider: 'local',
  storageKey: `uploads/${id}.webp`,
  bucket: null,
});

function createServicePrisma(
  overrides: Partial<{
    detail: ReturnType<typeof detailRow> | null;
    createdPeg: ReturnType<typeof pegRow>;
    pegCreateError: unknown;
    mapStorage: ReturnType<typeof mapStorageOf> | null;
  }> = {},
) {
  const detail = 'detail' in overrides ? overrides.detail : detailRow();

  const prisma: SceneServicePrisma = {
    uploadAsset: {
      findFirst: vi.fn(async () => overrides.mapStorage ?? null),
    },
    scene: {
      findMany: vi.fn(async () => [
        {
          id: SCENE_ID,
          name: 'Elysium',
          createdAt: CREATED_AT,
          updatedAt: UPDATED_AT,
          mapAsset: { id: 'asset-1' },
          _count: { pegs: 3 },
        },
      ]),
      findFirst: vi.fn(async () => detail ?? null),
      create: vi.fn(async () => detailRow()),
      update: vi.fn(async () => detailRow()),
      delete: vi.fn(async () => ({ id: SCENE_ID })),
    },
    scenePeg: {
      create: vi.fn(async () => {
        if ('pegCreateError' in overrides) throw overrides.pegCreateError;
        return overrides.createdPeg ?? pegRow({ event: eventTarget });
      }),
      update: vi.fn(async () => pegRow({ event: eventTarget, x: 0.5, y: 0.5 })),
      delete: vi.fn(async () => ({ id: 'peg-1' })),
    },
  };

  return prisma;
}

async function createScopedService(
  missing: MissingResource[] = [],
  prisma = createServicePrisma(),
): Promise<{
  service: ReturnType<typeof createSceneService>;
  scope: CampaignScope;
  prisma: SceneServicePrisma;
}> {
  const access = createCampaignAccess(createAccessPrisma(missing));
  const scope = await access.requireAdmin(session(), CAMPAIGN_ID);

  return { service: createSceneService(config, prisma, access), scope, prisma };
}

function prismaUniqueViolation(modelName: string): Error {
  return Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
    meta: { modelName },
  });
}

describe('scene name normalization', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeSceneName('  The   Docks \n')).toBe('The Docks');
  });

  it('rejects a name that is only whitespace', () => {
    expect(() => normalizeSceneName('   ')).toThrow(SceneValidationError);
  });
});

describe('scene queries', () => {
  it('summarizes scenes with map presence and peg counts', async () => {
    const { service, scope } = await createScopedService();

    expect(await service.list(scope)).toEqual([
      {
        id: SCENE_ID,
        name: 'Elysium',
        hasMap: true,
        pegCount: 3,
        createdAt: CREATED_AT.toISOString(),
        updatedAt: UPDATED_AT.toISOString(),
      },
    ]);
  });

  it('scopes the list query to the campaign', async () => {
    const { service, scope, prisma } = await createScopedService();

    await service.list(scope);

    expect(prisma.scene.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campaignId: CAMPAIGN_ID } }),
    );
  });

  it('builds a backend map URL from the attached asset', async () => {
    const prisma = createServicePrisma({ detail: detailRow({ mapAssetId: 'asset-9' }) });
    const { service, scope } = await createScopedService([], prisma);

    const scene = await service.get(scope, SCENE_ID);

    expect(scene.mapAssetId).toBe('asset-9');
    expect(scene.mapUrl).toBe('http://localhost:3001/api/v1/uploads/asset-9');
  });

  it('reports no map rather than an empty URL', async () => {
    const { service, scope } = await createScopedService();
    const scene = await service.get(scope, SCENE_ID);

    expect(scene.mapAssetId).toBeNull();
    expect(scene.mapUrl).toBeNull();
  });

  it('hides a scene from another campaign behind a not-found error', async () => {
    const prisma = createServicePrisma({ detail: null });
    const { service, scope } = await createScopedService([], prisma);

    await expect(service.get(scope, 'rival-scene')).rejects.toBeInstanceOf(
      CampaignResourceNotFoundError,
    );
  });
});

describe('scene peg mapping', () => {
  it.each([
    ['event', eventTarget, 'eventId', { event: eventTarget }],
    ['npc', npcTarget, 'npcId', { npc: npcTarget }],
    ['lore', loreTarget, 'loreEntryId', { loreEntry: loreTarget }],
  ] as const)(
    'writes a %s peg to its own target column and returns that discriminator',
    async (kind, target, column, row) => {
      const prisma = createServicePrisma({ createdPeg: pegRow(row) });
      const { service, scope } = await createScopedService([], prisma);

      const peg = await service.createPeg(scope, SCENE_ID, {
        kind: kind as ScenePegKind,
        targetId: target.id,
        x: 0.25,
        y: 0.75,
      });

      expect(prisma.scenePeg.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { sceneId: SCENE_ID, [column]: target.id, x: 0.25, y: 0.75 },
        }),
      );
      expect(peg).toEqual({ id: 'peg-1', kind, x: 0.25, y: 0.75, target });
    },
  );

  it('never emits nullable target fields alongside the discriminated target', async () => {
    const prisma = createServicePrisma({
      detail: detailRow({
        pegs: [
          pegRow({ id: 'peg-event', event: eventTarget }),
          pegRow({ id: 'peg-npc', npc: npcTarget }),
          pegRow({ id: 'peg-lore', loreEntry: loreTarget }),
        ],
      }),
    });
    const { service, scope } = await createScopedService([], prisma);

    const scene = await service.get(scope, SCENE_ID);

    expect(scene.pegs.map((peg) => peg.kind)).toEqual(['event', 'npc', 'lore']);
    for (const peg of scene.pegs) {
      expect(Object.keys(peg).sort()).toEqual(['id', 'kind', 'target', 'x', 'y']);
    }
  });

  it('fails loudly if a row somehow carries no target', async () => {
    const prisma = createServicePrisma({ detail: detailRow({ pegs: [pegRow({ id: 'orphan' })] }) });
    const { service, scope } = await createScopedService([], prisma);

    await expect(service.get(scope, SCENE_ID)).rejects.toThrow(/no target/);
  });
});

describe('scene peg placement rules', () => {
  it('translates a duplicate-target unique violation into a 409-capable error', async () => {
    const prisma = createServicePrisma({ pegCreateError: prismaUniqueViolation('ScenePeg') });
    const { service, scope } = await createScopedService([], prisma);

    const error = await service
      .createPeg(scope, SCENE_ID, { kind: 'npc', targetId: 'npc-1', x: 0.1, y: 0.1 })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ScenePegConflictError);
    expect((error as ScenePegConflictError).statusCode).toBe(409);
  });

  it('rethrows unique violations from other models untouched', async () => {
    const prisma = createServicePrisma({ pegCreateError: prismaUniqueViolation('UploadAsset') });
    const { service, scope } = await createScopedService([], prisma);

    await expect(
      service.createPeg(scope, SCENE_ID, { kind: 'npc', targetId: 'npc-1', x: 0.1, y: 0.1 }),
    ).rejects.not.toBeInstanceOf(ScenePegConflictError);
  });

  it('rejects a target that belongs to another campaign as not found', async () => {
    const { service, scope } = await createScopedService(['npc']);

    await expect(
      service.createPeg(scope, SCENE_ID, { kind: 'npc', targetId: 'rival-npc', x: 0.1, y: 0.1 }),
    ).rejects.toBeInstanceOf(CampaignResourceNotFoundError);
  });

  it('checks a lore target through the lore resource', async () => {
    const { service, scope } = await createScopedService(['loreEntry']);

    await expect(
      service.createPeg(scope, SCENE_ID, { kind: 'lore', targetId: 'rival-lore', x: 0.1, y: 0.1 }),
    ).rejects.toBeInstanceOf(CampaignResourceNotFoundError);
  });

  it.each([
    ['x below zero', { x: -0.01, y: 0.5 }],
    ['y above one', { x: 0.5, y: 1.01 }],
    ['a non-finite coordinate', { x: Number.NaN, y: 0.5 }],
  ])('rejects %s before touching the database', async (_label, coords) => {
    const prisma = createServicePrisma();
    const { service, scope } = await createScopedService([], prisma);

    await expect(
      service.createPeg(scope, SCENE_ID, { kind: 'npc', targetId: 'npc-1', ...coords }),
    ).rejects.toBeInstanceOf(SceneValidationError);
    expect(prisma.scenePeg.create).not.toHaveBeenCalled();
  });

  it('rejects a peg from another campaign before moving it', async () => {
    const prisma = createServicePrisma();
    const { service, scope } = await createScopedService(['scenePeg'], prisma);

    await expect(
      service.movePeg(scope, SCENE_ID, 'rival-peg', { x: 0.5, y: 0.5 }),
    ).rejects.toBeInstanceOf(CampaignResourceNotFoundError);
    expect(prisma.scenePeg.update).not.toHaveBeenCalled();
  });

  it('rejects a peg from another campaign before deleting it', async () => {
    const prisma = createServicePrisma();
    const { service, scope } = await createScopedService(['scenePeg'], prisma);

    await expect(service.removePeg(scope, SCENE_ID, 'rival-peg')).rejects.toBeInstanceOf(
      CampaignResourceNotFoundError,
    );
    expect(prisma.scenePeg.delete).not.toHaveBeenCalled();
  });
});

function createLogger(): SceneMapAssetLogger & { entries: Array<Record<string, unknown>> } {
  const entries: Array<Record<string, unknown>> = [];
  return { entries, error: (details) => void entries.push(details) };
}

describe('scene existence check', () => {
  it('resolves without pulling the full scene detail select', async () => {
    const prisma = createServicePrisma();
    const { service, scope } = await createScopedService([], prisma);

    await expect(service.exists(scope, SCENE_ID)).resolves.toBeUndefined();
    expect(prisma.scene.findFirst).not.toHaveBeenCalled();
  });

  it('reports a scene from another campaign as not found', async () => {
    const { service, scope } = await createScopedService(['scene']);

    await expect(service.exists(scope, 'rival-scene')).rejects.toBeInstanceOf(
      CampaignResourceNotFoundError,
    );
  });
});

describe('scene deletion', () => {
  beforeEach(() => {
    deleteUploadObjectsMock.mockClear();
    deleteUploadObjectsMock.mockImplementation(async () => {});
  });

  it('rejects deleting a scene from another campaign before touching storage or the row', async () => {
    const prisma = createServicePrisma();
    const { service, scope } = await createScopedService(['scene'], prisma);

    await expect(
      service.remove(scope, 'rival-scene', { logger: createLogger() }),
    ).rejects.toBeInstanceOf(CampaignResourceNotFoundError);
    expect(prisma.uploadAsset.findFirst).not.toHaveBeenCalled();
    expect(prisma.scene.delete).not.toHaveBeenCalled();
  });

  it('reads the map storage metadata before deleting, then cleans it up after', async () => {
    const prisma = createServicePrisma({ mapStorage: mapStorageOf('asset-old') });
    const { service, scope } = await createScopedService([], prisma);
    const calls: string[] = [];
    vi.mocked(prisma.uploadAsset.findFirst).mockImplementation(async () => {
      calls.push('read-map-storage');
      return mapStorageOf('asset-old');
    });
    vi.mocked(prisma.scene.delete).mockImplementation(async () => {
      calls.push('delete-scene');
      return { id: SCENE_ID };
    });
    deleteUploadObjectsMock.mockImplementation(async () => {
      calls.push('delete-storage-object');
    });

    await service.remove(scope, SCENE_ID, { logger: createLogger() });

    expect(calls).toEqual(['read-map-storage', 'delete-scene', 'delete-storage-object']);
    expect(prisma.scene.delete).toHaveBeenCalledWith({ where: { id: SCENE_ID } });
    expect(deleteUploadObjectsMock).toHaveBeenCalledWith(config, [mapStorageOf('asset-old')]);
  });

  it('deletes the scene even when it never had a map', async () => {
    const prisma = createServicePrisma({ mapStorage: null });
    const { service, scope } = await createScopedService([], prisma);

    await service.remove(scope, SCENE_ID, { logger: createLogger() });

    expect(prisma.scene.delete).toHaveBeenCalledWith({ where: { id: SCENE_ID } });
    expect(deleteUploadObjectsMock).not.toHaveBeenCalled();
  });

  it('still deletes the scene and logs when storage cleanup fails', async () => {
    const prisma = createServicePrisma({ mapStorage: mapStorageOf('asset-old') });
    const { service, scope } = await createScopedService([], prisma);
    const logger = createLogger();
    deleteUploadObjectsMock.mockRejectedValueOnce(new Error('bucket offline'));

    await expect(service.remove(scope, SCENE_ID, { logger })).resolves.toBeUndefined();

    expect(prisma.scene.delete).toHaveBeenCalledWith({ where: { id: SCENE_ID } });
    expect(logger.entries).toEqual([
      {
        sceneId: SCENE_ID,
        assetId: 'asset-old',
        storageKey: 'uploads/asset-old.webp',
        operation: 'delete-scene-map-storage',
        reason: 'bucket offline',
      },
    ]);
  });
});
