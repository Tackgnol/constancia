import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { BackendConfig } from '../config.js';
import { UploadValidationError } from './request-errors.js';

export interface StoredObject {
  storageProvider: 'local' | 'r2';
  storageKey: string;
  bucket: string | null;
  publicUrl: string;
}

export interface UploadAssetStorageRecord {
  storageProvider: string;
  storageKey: string;
  bucket: string | null;
}

let cachedR2Client: S3Client | null = null;
let cachedR2Signature = '';

export async function putUploadObject(
  config: BackendConfig,
  params: {
    assetId?: string;
    body: Buffer;
    contentType: 'image/webp';
  },
): Promise<StoredObject> {
  const assetId = params.assetId ?? randomUUID();
  const storageKey = buildUploadStorageKey(assetId);

  if (config.uploadStorageDriver === 'r2') {
    return putR2Object(config, storageKey, params.body, params.contentType);
  }

  await mkdir(dirname(getLocalUploadPath(config, storageKey)), { recursive: true });
  await writeFile(getLocalUploadPath(config, storageKey), params.body);

  return {
    storageProvider: 'local',
    storageKey,
    bucket: null,
    publicUrl: buildUploadAssetUrl(config, assetId),
  };
}

export async function readUploadObject(
  config: BackendConfig,
  record: UploadAssetStorageRecord,
): Promise<Buffer> {
  assertValidUploadStorageKey(record.storageKey);

  if (record.storageProvider === 'r2') {
    const bucket = record.bucket ?? config.r2Bucket;
    if (!bucket) {
      throw new UploadValidationError('Upload storage bucket is not configured.');
    }

    const response = await getR2Client(config).send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: record.storageKey,
      }),
    );
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) {
      throw new UploadValidationError('Upload object could not be read.');
    }

    return Buffer.from(bytes);
  }

  return readFile(getLocalUploadPath(config, record.storageKey));
}

export async function deleteUploadObjects(
  config: BackendConfig,
  records: UploadAssetStorageRecord[],
): Promise<void> {
  for (const record of records) {
    await deleteUploadObject(config, record);
  }
}

export function buildUploadAssetUrl(config: BackendConfig, assetId: string): string {
  return new URL(
    `${config.apiPrefix}/uploads/${assetId}`,
    ensureTrailingSlash(config.backendPublicUrl),
  ).toString();
}

export function isValidUploadAssetId(assetId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assetId);
}

export function extractUploadAssetIdFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const lastSegment = url.pathname.split('/').filter(Boolean).at(-1);
    if (!lastSegment) {
      return null;
    }

    const assetId = lastSegment.endsWith('.webp') ? lastSegment.slice(0, -5) : lastSegment;
    return isValidUploadAssetId(assetId) ? assetId : null;
  } catch {
    return null;
  }
}

function buildUploadStorageKey(assetId: string): string {
  if (!isValidUploadAssetId(assetId)) {
    throw new UploadValidationError('Invalid upload identifier.');
  }

  return `uploads/${assetId}.webp`;
}

async function putR2Object(
  config: BackendConfig,
  storageKey: string,
  body: Buffer,
  contentType: 'image/webp',
): Promise<StoredObject> {
  if (!config.r2Bucket) {
    throw new UploadValidationError('R2 bucket is not configured.');
  }

  await getR2Client(config).send(
    new PutObjectCommand({
      Bucket: config.r2Bucket,
      Key: storageKey,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  return {
    storageProvider: 'r2',
    storageKey,
    bucket: config.r2Bucket,
    publicUrl: buildStoragePublicUrl(config, storageKey),
  };
}

async function deleteUploadObject(
  config: BackendConfig,
  record: UploadAssetStorageRecord,
): Promise<void> {
  assertValidUploadStorageKey(record.storageKey);

  if (record.storageProvider === 'r2') {
    const bucket = record.bucket ?? config.r2Bucket;
    if (!bucket) {
      throw new UploadValidationError('Upload storage bucket is not configured.');
    }

    await getR2Client(config).send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: record.storageKey,
      }),
    );
    return;
  }

  await rm(getLocalUploadPath(config, record.storageKey), { force: true });
}

function getR2Client(config: BackendConfig): S3Client {
  if (!config.r2Endpoint || !config.r2AccessKeyId || !config.r2SecretAccessKey) {
    throw new UploadValidationError('R2 storage is not fully configured.');
  }

  const signature = `${config.r2Endpoint}:${config.r2AccessKeyId}`;
  if (cachedR2Client === null || cachedR2Signature !== signature) {
    cachedR2Signature = signature;
    cachedR2Client = new S3Client({
      region: 'auto',
      endpoint: config.r2Endpoint,
      credentials: {
        accessKeyId: config.r2AccessKeyId,
        secretAccessKey: config.r2SecretAccessKey,
      },
    });
  }

  return cachedR2Client;
}

function buildStoragePublicUrl(config: BackendConfig, storageKey: string): string {
  if (config.uploadPublicBaseUrl) {
    return new URL(storageKey, ensureTrailingSlash(config.uploadPublicBaseUrl)).toString();
  }

  return buildUploadAssetUrl(config, storageKeyToAssetId(storageKey));
}

function storageKeyToAssetId(storageKey: string): string {
  assertValidUploadStorageKey(storageKey);
  return storageKey.slice('uploads/'.length, -'.webp'.length);
}

function getLocalUploadPath(config: BackendConfig, storageKey: string): string {
  assertValidUploadStorageKey(storageKey);
  return join(config.uploadStorageDir, storageKey);
}

function assertValidUploadStorageKey(storageKey: string): void {
  if (
    !/^uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i.test(
      storageKey,
    )
  ) {
    throw new UploadValidationError('Invalid upload storage key.');
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
