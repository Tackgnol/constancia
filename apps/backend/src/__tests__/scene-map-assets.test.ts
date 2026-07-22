import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionAccessContext } from '../auth/access-context.js';
import { CampaignAuthenticationError } from '../services/campaign-access.js';
import { UploadValidationError } from '../services/request-errors.js';
import {
  clearSceneMap,
  finishSceneMapCleanup,
  prepareSceneMapCleanup,
  requireSessionUserId,
  setSceneMap,
  type SceneMapAssetLogger,
  type SceneMapAssetPrisma,
} from '../services/scene-map-assets.js';
import { deleteUploadObjects } from '../services/upload-storage.js';
import type * as UploadStorageModule from '../services/upload-storage.js';
import { createTestBackendConfig } from './test-config.js';

vi.mock('../services/upload-storage.js', async (importOriginal) => {
  const actual = await importOriginal<typeof UploadStorageModule>();
  return { ...actual, deleteUploadObjects: vi.fn(async () => {}) };
});

const deleteUploadObjectsMock = vi.mocked(deleteUploadObjects);

const config = createTestBackendConfig();
const SCENE_ID = 'scene-1';
const USER_ID = 'better-auth-user-1';
const DISCORD_USER_ID = 'discord-99999';

interface AssetRow {
  id: string;
  userId: string;
  eventId: string | null;
  sceneId: string | null;
}

const storageOf = (id: string) => ({
  id,
  storageProvider: 'local',
  storageKey: `uploads/${id}.webp`,
  bucket: null,
});

/** Records every write in order so tests can prove detach-before-cleanup rather than just counts. */
function createPrismaMock(assets: AssetRow[]) {
  const calls: string[] = [];
  const rows = new Map(assets.map((asset) => [asset.id, { ...asset }]));

  const prisma: SceneMapAssetPrisma = {
    uploadAsset: {
      findFirst: vi.fn(
        async (args: { where: { id?: string; userId?: string; sceneId?: string } }) => {
          if (typeof args.where.id === 'string') {
            const row = rows.get(args.where.id);
            return row && row.userId === args.where.userId ? { ...row } : null;
          }

          const attached = [...rows.values()].find((row) => row.sceneId === args.where.sceneId);
          return attached ? storageOf(attached.id) : null;
        },
      ) as SceneMapAssetPrisma['uploadAsset']['findFirst'],
      update: vi.fn(async (args: { where: { id: string }; data: { sceneId: string | null } }) => {
        calls.push(`update:${args.where.id}:${args.data.sceneId ?? 'null'}`);
        const row = rows.get(args.where.id);
        if (row) row.sceneId = args.data.sceneId;
        return { id: args.where.id };
      }),
      deleteMany: vi.fn(async (args: { where: { id: { in: string[] } } }) => {
        calls.push(`deleteRow:${args.where.id.in.join(',')}`);
        for (const id of args.where.id.in) rows.delete(id);
        return { count: args.where.id.in.length };
      }),
    },
    $transaction: vi.fn(async (operations: unknown[]) => {
      calls.push('transaction');
      return Promise.all(operations as Array<Promise<unknown>>);
    }),
  };

  return { prisma, calls, rows };
}

function createLogger(): SceneMapAssetLogger & { entries: Array<Record<string, unknown>> } {
  const entries: Array<Record<string, unknown>> = [];
  return { entries, error: (details) => void entries.push(details) };
}

function session(overrides: Partial<SessionAccessContext> = {}): SessionAccessContext {
  return {
    kind: 'session',
    userId: USER_ID,
    email: 'gm@example.com',
    discordUserId: DISCORD_USER_ID,
    isSuperUser: false,
    ...overrides,
  };
}

beforeEach(() => {
  deleteUploadObjectsMock.mockClear();
  deleteUploadObjectsMock.mockImplementation(async () => {});
});

describe('scene map session ownership', () => {
  it('uses the Better Auth user id and never the Discord identifier', () => {
    expect(requireSessionUserId(session())).toBe(USER_ID);
    expect(requireSessionUserId(session())).not.toBe(DISCORD_USER_ID);
  });

  it('refuses bot credentials, which own no upload assets', () => {
    expect(() => requireSessionUserId({ kind: 'bot' })).toThrow(CampaignAuthenticationError);
  });
});

describe('setSceneMap', () => {
  it('attaches an unlinked asset the session user owns', async () => {
    const { prisma, calls } = createPrismaMock([
      { id: 'asset-new', userId: USER_ID, eventId: null, sceneId: null },
    ]);

    const view = await setSceneMap(config, prisma, {
      sceneId: SCENE_ID,
      assetId: 'asset-new',
      userId: USER_ID,
      logger: createLogger(),
    });

    expect(view.assetId).toBe('asset-new');
    expect(view.url).toBe('http://localhost:3001/api/v1/uploads/asset-new');
    expect(calls).toEqual(['update:asset-new:scene-1', 'transaction']);
    expect(deleteUploadObjectsMock).not.toHaveBeenCalled();
  });

  it('rejects an asset owned by another Better Auth user', async () => {
    const { prisma } = createPrismaMock([
      { id: 'asset-foreign', userId: 'someone-else', eventId: null, sceneId: null },
    ]);

    await expect(
      setSceneMap(config, prisma, {
        sceneId: SCENE_ID,
        assetId: 'asset-foreign',
        userId: USER_ID,
        logger: createLogger(),
      }),
    ).rejects.toBeInstanceOf(UploadValidationError);
  });

  it('rejects an event-owned asset becoming a scene map', async () => {
    const { prisma } = createPrismaMock([
      { id: 'asset-event', userId: USER_ID, eventId: 'event-1', sceneId: null },
    ]);

    await expect(
      setSceneMap(config, prisma, {
        sceneId: SCENE_ID,
        assetId: 'asset-event',
        userId: USER_ID,
        logger: createLogger(),
      }),
    ).rejects.toBeInstanceOf(UploadValidationError);
  });

  it('rejects an asset already attached to a different scene', async () => {
    const { prisma } = createPrismaMock([
      { id: 'asset-other-scene', userId: USER_ID, eventId: null, sceneId: 'scene-2' },
    ]);

    await expect(
      setSceneMap(config, prisma, {
        sceneId: SCENE_ID,
        assetId: 'asset-other-scene',
        userId: USER_ID,
        logger: createLogger(),
      }),
    ).rejects.toBeInstanceOf(UploadValidationError);
  });

  it('is idempotent when the asset is already this scene s map', async () => {
    const { prisma, calls } = createPrismaMock([
      { id: 'asset-current', userId: USER_ID, eventId: null, sceneId: SCENE_ID },
    ]);

    const view = await setSceneMap(config, prisma, {
      sceneId: SCENE_ID,
      assetId: 'asset-current',
      userId: USER_ID,
      logger: createLogger(),
    });

    expect(view.assetId).toBe('asset-current');
    expect(calls).toEqual([]);
    expect(deleteUploadObjectsMock).not.toHaveBeenCalled();
  });

  it('detaches the previous map inside the swap transaction before any cleanup runs', async () => {
    const { prisma, calls } = createPrismaMock([
      { id: 'asset-old', userId: USER_ID, eventId: null, sceneId: SCENE_ID },
      { id: 'asset-new', userId: USER_ID, eventId: null, sceneId: null },
    ]);

    await setSceneMap(config, prisma, {
      sceneId: SCENE_ID,
      assetId: 'asset-new',
      userId: USER_ID,
      logger: createLogger(),
    });

    expect(calls).toEqual([
      'update:asset-old:null',
      'update:asset-new:scene-1',
      'transaction',
      'deleteRow:asset-old',
    ]);
    expect(deleteUploadObjectsMock).toHaveBeenCalledWith(config, [storageOf('asset-old')]);
  });

  it('keeps the new map attached and logs the old asset when cleanup fails', async () => {
    const { prisma, rows } = createPrismaMock([
      { id: 'asset-old', userId: USER_ID, eventId: null, sceneId: SCENE_ID },
      { id: 'asset-new', userId: USER_ID, eventId: null, sceneId: null },
    ]);
    const logger = createLogger();
    deleteUploadObjectsMock.mockRejectedValueOnce(new Error('R2 unreachable'));

    const view = await setSceneMap(config, prisma, {
      sceneId: SCENE_ID,
      assetId: 'asset-new',
      userId: USER_ID,
      logger,
    });

    expect(view.assetId).toBe('asset-new');
    expect(rows.get('asset-new')?.sceneId).toBe(SCENE_ID);
    expect(rows.get('asset-old')?.sceneId).toBeNull();
    expect(logger.entries).toEqual([
      {
        sceneId: SCENE_ID,
        assetId: 'asset-old',
        storageKey: 'uploads/asset-old.webp',
        operation: 'delete-detached-scene-map',
        reason: 'R2 unreachable',
      },
    ]);
  });
});

describe('clearSceneMap', () => {
  it('detaches and deletes the current map', async () => {
    const { prisma, calls, rows } = createPrismaMock([
      { id: 'asset-old', userId: USER_ID, eventId: null, sceneId: SCENE_ID },
    ]);

    await clearSceneMap(config, prisma, { sceneId: SCENE_ID, logger: createLogger() });

    expect(calls).toEqual(['update:asset-old:null', 'deleteRow:asset-old']);
    expect(rows.has('asset-old')).toBe(false);
  });

  it('does nothing when the scene has no map', async () => {
    const { prisma, calls } = createPrismaMock([]);

    await clearSceneMap(config, prisma, { sceneId: SCENE_ID, logger: createLogger() });

    expect(calls).toEqual([]);
    expect(deleteUploadObjectsMock).not.toHaveBeenCalled();
  });
});

describe('scene deletion cleanup', () => {
  it('reads storage metadata before the cascade removes the row, then deletes the object', async () => {
    const { prisma } = createPrismaMock([
      { id: 'asset-old', userId: USER_ID, eventId: null, sceneId: SCENE_ID },
    ]);

    const prepared = await prepareSceneMapCleanup(prisma, SCENE_ID);
    await finishSceneMapCleanup(config, prepared, { sceneId: SCENE_ID, logger: createLogger() });

    expect(prepared).toEqual(storageOf('asset-old'));
    expect(deleteUploadObjectsMock).toHaveBeenCalledWith(config, [storageOf('asset-old')]);
  });

  it('logs rather than throwing when the storage object cannot be removed', async () => {
    const logger = createLogger();
    deleteUploadObjectsMock.mockRejectedValueOnce(new Error('bucket offline'));

    await finishSceneMapCleanup(config, storageOf('asset-old'), { sceneId: SCENE_ID, logger });

    expect(logger.entries[0]).toMatchObject({
      assetId: 'asset-old',
      operation: 'delete-scene-map-storage',
      reason: 'bucket offline',
    });
  });
});
