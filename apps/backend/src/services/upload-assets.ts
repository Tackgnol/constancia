import type { PrismaClient } from '@constancia/db';
import type { BackendConfig } from '../config.js';
import { UploadQuotaExceededError, UploadValidationError } from './request-errors.js';
import {
  deleteUploadObjects,
  extractUploadAssetIdFromUrl,
  type UploadAssetStorageRecord,
} from './upload-storage.js';

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

async function deleteUploadAssetRecords(
  config: BackendConfig,
  prisma: PrismaClient,
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

const uploadAssetStorageSelect = {
  id: true,
  storageProvider: true,
  storageKey: true,
  bucket: true,
} as const;
