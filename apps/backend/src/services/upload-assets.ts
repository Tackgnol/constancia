import type { PrismaClient } from '@constancia/db';
import type { BackendConfig } from '../config.js';
import { UploadQuotaExceededError, UploadValidationError } from './request-errors.js';
import {
  deleteUploadObjects,
  extractUploadAssetIdFromUrl,
  type UploadAssetStorageRecord,
} from './upload-storage.js';

/** The resource an upload asset can belong to. An asset never belongs to more than one. */
export type UploadAssetOwnerRef =
  | { kind: 'event'; eventId: string }
  | { kind: 'scene'; sceneId: string };

export interface OwnedUploadAsset {
  id: string;
  /** True when the asset is already attached to this exact owner, making attachment idempotent. */
  alreadyAttached: boolean;
}

/** Structural slice of Prisma used by the ownership helpers so services stay unit-testable. */
export interface UploadAssetOwnershipPrisma {
  uploadAsset: {
    findFirst(args: {
      where: { id: string; userId: string };
      select: { id: true; eventId: true; sceneId: true };
    }): Promise<{ id: string; eventId: string | null; sceneId: string | null } | null>;
  };
}

/**
 * An asset is attachable only when the session user owns it and it is either unlinked or already
 * attached to this same owner. Anything else — a foreign user, or an asset owned by another
 * resource — is reported as a validation failure without disclosing which case applied.
 */
export async function requireAttachableUploadAsset(
  prisma: UploadAssetOwnershipPrisma,
  params: { assetId: string; userId: string; owner: UploadAssetOwnerRef },
): Promise<OwnedUploadAsset> {
  const asset = await prisma.uploadAsset.findFirst({
    where: { id: params.assetId, userId: params.userId },
    select: { id: true, eventId: true, sceneId: true },
  });
  if (asset === null) {
    throw new UploadValidationError('Image asset is not available.');
  }

  const ownerId = params.owner.kind === 'event' ? params.owner.eventId : params.owner.sceneId;
  const attachedTo = params.owner.kind === 'event' ? asset.eventId : asset.sceneId;
  const attachedElsewhere = params.owner.kind === 'event' ? asset.sceneId : asset.eventId;

  if (attachedElsewhere !== null || (attachedTo !== null && attachedTo !== ownerId)) {
    throw new UploadValidationError('Image asset is not available.');
  }

  return { id: asset.id, alreadyAttached: attachedTo === ownerId };
}

export interface UploadAssetDeletionPrisma {
  uploadAsset: {
    deleteMany(args: { where: { id: { in: string[] } } }): Promise<{ count: number }>;
  };
}

export interface UploadAssetCleanupPrisma extends UploadAssetDeletionPrisma {
  uploadAsset: UploadAssetDeletionPrisma['uploadAsset'] & {
    findFirst(args: {
      where: { id: string; userId: string; eventId: null; sceneId: null };
      select: typeof uploadAssetStorageSelect;
    }): Promise<({ id: string } & UploadAssetStorageRecord) | null>;
  };
}

/** Deletes an asset the session user owns and nothing has claimed yet. */
export async function deleteOwnedUnlinkedUploadAsset(
  config: BackendConfig,
  prisma: UploadAssetCleanupPrisma,
  params: { assetId: string; userId: string },
): Promise<void> {
  const asset = await prisma.uploadAsset.findFirst({
    where: { id: params.assetId, userId: params.userId, eventId: null, sceneId: null },
    select: uploadAssetStorageSelect,
  });
  if (asset === null) {
    throw new UploadValidationError('Image asset is not available.');
  }

  await deleteUploadAssetRecords(config, prisma, [asset]);
}

export interface UploadQuotaSnapshot {
  uploadAllowanceBytes: number;
  uploadUsedBytes: number;
  uploadRemainingBytes: number;
  uploadUsagePercent: number;
  uploadNearLimit: boolean;
}

export async function getUserUploadQuota(
  prisma: PrismaClient,
  userId: string,
  warningPercent: number,
): Promise<UploadQuotaSnapshot> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { uploadAllowanceBytes: true },
  });
  if (user === null) {
    throw new UploadValidationError('User not found.');
  }

  const used = await getUserUploadUsedBytes(prisma, userId);
  return buildUploadQuotaSnapshot(user.uploadAllowanceBytes, used, warningPercent);
}

export async function assertUserUploadAllowance(
  prisma: PrismaClient,
  params: {
    userId: string;
    incomingBytes: number;
    warningPercent: number;
  },
): Promise<UploadQuotaSnapshot> {
  const quota = await getUserUploadQuota(prisma, params.userId, params.warningPercent);
  if (quota.uploadUsedBytes + params.incomingBytes > quota.uploadAllowanceBytes) {
    throw new UploadQuotaExceededError(
      `Upload allowance exceeded. ${quota.uploadRemainingBytes} bytes remaining.`,
    );
  }

  return buildUploadQuotaSnapshot(
    quota.uploadAllowanceBytes,
    quota.uploadUsedBytes + params.incomingBytes,
    params.warningPercent,
  );
}

export function extractUploadAssetIdsFromPipeline(pipeline: unknown): string[] {
  return [...new Set(extractUploadAssetIds(pipeline))];
}

export async function assertPipelineUploadAssetsAttachable(
  prisma: PrismaClient,
  params: {
    assetIds: string[];
    userId: string;
    eventId?: string;
  },
): Promise<void> {
  if (params.assetIds.length === 0) {
    return;
  }

  const assets = await prisma.uploadAsset.findMany({
    where: {
      id: { in: params.assetIds },
      userId: params.userId,
      OR: [{ eventId: null }, ...(params.eventId ? [{ eventId: params.eventId }] : [])],
    },
    select: { id: true },
  });

  if (assets.length !== params.assetIds.length) {
    throw new UploadValidationError('One or more image assets are not available for this event.');
  }
}

export async function linkPipelineUploadAssets(
  prisma: PrismaClient,
  params: {
    assetIds: string[];
    userId: string;
    eventId: string;
  },
): Promise<void> {
  if (params.assetIds.length === 0) {
    return;
  }

  await prisma.uploadAsset.updateMany({
    where: {
      id: { in: params.assetIds },
      userId: params.userId,
      OR: [{ eventId: null }, { eventId: params.eventId }],
    },
    data: { eventId: params.eventId },
  });
}

export async function deleteUnlinkedEventUploadAssets(
  config: BackendConfig,
  prisma: PrismaClient,
  params: {
    eventId: string;
    retainedAssetIds: string[];
  },
): Promise<void> {
  const assets = await prisma.uploadAsset.findMany({
    where: {
      eventId: params.eventId,
      ...(params.retainedAssetIds.length > 0 ? { id: { notIn: params.retainedAssetIds } } : {}),
    },
    select: uploadAssetStorageSelect,
  });

  await deleteUploadAssetRecords(config, prisma, assets);
}

export async function deleteEventUploadAssets(
  config: BackendConfig,
  prisma: PrismaClient,
  eventId: string,
): Promise<void> {
  const assets = await prisma.uploadAsset.findMany({
    where: { eventId },
    select: uploadAssetStorageSelect,
  });

  await deleteUploadAssetRecords(config, prisma, assets);
}

function extractUploadAssetIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractUploadAssetIds(item));
  }

  if (!isPlainObject(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    if (key === 'imageUrl' && typeof nestedValue === 'string') {
      const assetId = extractUploadAssetIdFromUrl(nestedValue);
      return assetId ? [assetId] : [];
    }

    return extractUploadAssetIds(nestedValue);
  });
}

function buildUploadQuotaSnapshot(
  uploadAllowanceBytes: number,
  uploadUsedBytes: number,
  warningPercent: number,
): UploadQuotaSnapshot {
  const uploadRemainingBytes = Math.max(uploadAllowanceBytes - uploadUsedBytes, 0);
  const uploadUsagePercent =
    uploadAllowanceBytes > 0 ? Math.round((uploadUsedBytes / uploadAllowanceBytes) * 100) : 100;

  return {
    uploadAllowanceBytes,
    uploadUsedBytes,
    uploadRemainingBytes,
    uploadUsagePercent,
    uploadNearLimit: uploadUsagePercent >= warningPercent,
  };
}

async function getUserUploadUsedBytes(prisma: PrismaClient, userId: string): Promise<number> {
  const aggregate = await prisma.uploadAsset.aggregate({
    where: { userId },
    _sum: { sizeBytes: true },
  });

  return aggregate._sum.sizeBytes ?? 0;
}

/**
 * Removes storage objects first, then their rows, from explicit metadata the caller already read.
 * Callers that must survive a storage failure should catch and leave the row unlinked for repair.
 */
export async function deleteUploadAssetRecords(
  config: BackendConfig,
  prisma: UploadAssetDeletionPrisma,
  assets: Array<{ id: string } & UploadAssetStorageRecord>,
): Promise<void> {
  if (assets.length === 0) {
    return;
  }

  await deleteUploadObjects(config, assets);
  await prisma.uploadAsset.deleteMany({
    where: { id: { in: assets.map((asset) => asset.id) } },
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const uploadAssetStorageSelect = {
  id: true,
  storageProvider: true,
  storageKey: true,
  bucket: true,
} as const;
