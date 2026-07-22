import type { AccessContext } from '../auth/access-context.js';
import type { BackendConfig } from '../config.js';
import { CampaignAuthenticationError } from './campaign-access.js';
import {
  deleteUploadAssetRecords,
  requireAttachableUploadAsset,
  uploadAssetStorageSelect,
  type UploadAssetDeletionPrisma,
  type UploadAssetOwnershipPrisma,
} from './upload-assets.js';
import {
  buildUploadAssetUrl,
  deleteUploadObjects,
  type UploadAssetStorageRecord,
} from './upload-storage.js';

export type StoredMapAsset = { id: string } & UploadAssetStorageRecord;

export interface SceneMapAssetLogger {
  error(details: Record<string, unknown>, message: string): void;
}

export interface SceneMapView {
  assetId: string;
  url: string;
}

/**
 * The minimal Prisma slice {@link prepareSceneMapCleanup} needs: read a scene's map storage
 * metadata by scene id. Kept separate from {@link SceneMapAssetPrisma} so callers that only need
 * to read this (such as `SceneService`) don't have to carry attach/detach shapes they never use.
 */
export interface SceneMapCleanupReadPrisma {
  uploadAsset: {
    findFirst(args: {
      where: { sceneId: string };
      select: typeof uploadAssetStorageSelect;
    }): Promise<StoredMapAsset | null>;
  };
}

export interface SceneMapAssetPrisma
  extends UploadAssetDeletionPrisma, UploadAssetOwnershipPrisma, SceneMapCleanupReadPrisma {
  uploadAsset: UploadAssetDeletionPrisma['uploadAsset'] &
    UploadAssetOwnershipPrisma['uploadAsset'] &
    SceneMapCleanupReadPrisma['uploadAsset'] & {
      update(args: {
        where: { id: string };
        data: { sceneId: string | null };
      }): Promise<{ id: string }>;
    };
  $transaction(operations: unknown[]): Promise<unknown[]>;
}

/**
 * Upload ownership is a Better Auth user concern, so map mutations refuse bot credentials rather
 * than falling back to a Discord identifier that would not match any UploadAsset row.
 */
export function requireSessionUserId(access: AccessContext): string {
  if (access.kind !== 'session') {
    throw new CampaignAuthenticationError('Session access is required to manage scene maps.');
  }

  return access.userId;
}

/**
 * Attaches an asset as the scene's map. The unique `sceneId` column means a replacement must
 * detach the previous asset in the same transaction, so no request can observe two maps or none.
 * Storage cleanup of the replaced asset runs afterwards and never rolls the new map back.
 */
export async function setSceneMap(
  config: BackendConfig,
  prisma: SceneMapAssetPrisma,
  params: {
    sceneId: string;
    assetId: string;
    userId: string;
    logger: SceneMapAssetLogger;
  },
): Promise<SceneMapView> {
  const attachable = await requireAttachableUploadAsset(prisma, {
    assetId: params.assetId,
    userId: params.userId,
    owner: { kind: 'scene', sceneId: params.sceneId },
  });

  if (attachable.alreadyAttached) {
    return { assetId: attachable.id, url: buildUploadAssetUrl(config, attachable.id) };
  }

  const previous = await prisma.uploadAsset.findFirst({
    where: { sceneId: params.sceneId },
    select: uploadAssetStorageSelect,
  });

  await prisma.$transaction([
    ...(previous
      ? [prisma.uploadAsset.update({ where: { id: previous.id }, data: { sceneId: null } })]
      : []),
    prisma.uploadAsset.update({ where: { id: attachable.id }, data: { sceneId: params.sceneId } }),
  ]);

  if (previous !== null) {
    await cleanupDetachedMapAsset(config, prisma, previous, params.sceneId, params.logger);
  }

  return { assetId: attachable.id, url: buildUploadAssetUrl(config, attachable.id) };
}

/** Detaches the scene's map and removes the asset. Pegs and their coordinates are untouched. */
export async function clearSceneMap(
  config: BackendConfig,
  prisma: SceneMapAssetPrisma,
  params: { sceneId: string; logger: SceneMapAssetLogger },
): Promise<void> {
  const current = await prisma.uploadAsset.findFirst({
    where: { sceneId: params.sceneId },
    select: uploadAssetStorageSelect,
  });
  if (current === null) {
    return;
  }

  await prisma.uploadAsset.update({ where: { id: current.id }, data: { sceneId: null } });
  await cleanupDetachedMapAsset(config, prisma, current, params.sceneId, params.logger);
}

/**
 * Deleting a Scene cascades its map row away, so the storage metadata has to be read beforehand.
 * Pair with {@link finishSceneMapCleanup} once the scene is gone.
 */
export async function prepareSceneMapCleanup(
  prisma: SceneMapCleanupReadPrisma,
  sceneId: string,
): Promise<StoredMapAsset | null> {
  return prisma.uploadAsset.findFirst({
    where: { sceneId },
    select: uploadAssetStorageSelect,
  });
}

export async function finishSceneMapCleanup(
  config: BackendConfig,
  asset: StoredMapAsset | null,
  params: { sceneId: string; logger: SceneMapAssetLogger },
): Promise<void> {
  if (asset === null) {
    return;
  }

  try {
    await deleteUploadObjects(config, [asset]);
  } catch (error) {
    logCleanupFailure(params.logger, {
      sceneId: params.sceneId,
      assetId: asset.id,
      storageKey: asset.storageKey,
      operation: 'delete-scene-map-storage',
      error,
    });
  }
}

async function cleanupDetachedMapAsset(
  config: BackendConfig,
  prisma: SceneMapAssetPrisma,
  asset: StoredMapAsset,
  sceneId: string,
  logger: SceneMapAssetLogger,
): Promise<void> {
  try {
    await deleteUploadAssetRecords(config, prisma, [asset]);
  } catch (error) {
    // The asset is already detached, so the visible map is correct. Leave the unlinked row behind
    // with enough context to reconcile it rather than reporting the old map as still attached.
    logCleanupFailure(logger, {
      sceneId,
      assetId: asset.id,
      storageKey: asset.storageKey,
      operation: 'delete-detached-scene-map',
      error,
    });
  }
}

function logCleanupFailure(
  logger: SceneMapAssetLogger,
  details: {
    sceneId: string;
    assetId: string;
    storageKey: string;
    operation: string;
    error: unknown;
  },
): void {
  const { error, ...context } = details;
  logger.error(
    { ...context, reason: error instanceof Error ? error.message : String(error) },
    'Scene map asset cleanup failed; the asset row is unlinked and needs reconciliation.',
  );
}
