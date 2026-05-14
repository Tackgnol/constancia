import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import type { BackendConfig } from '../config.js';
import { processImageUpload } from '../services/image-upload.js';
import { readUploadObject } from '../services/upload-storage.js';

const uploadStorageDir = resolve(process.cwd(), 'data', 'test-image-uploads');

const config: BackendConfig = {
  host: '127.0.0.1',
  port: 3000,
  nodeEnv: 'test',
  apiPrefix: '/api/v1',
  docsPrefix: '/documentation',
  openApiPath: '/openapi.json',
  frontendUrl: 'http://localhost:3000',
  betterAuthSecret: 'constancia-test-secret-12345678901234567890',
  betterAuthUrl: 'http://localhost:3001',
  betterAuthPath: '/api/auth',
  discordClientId: undefined,
  discordClientSecret: undefined,
  logtoEnabled: false,
  logtoEndpoint: undefined,
  logtoAppId: undefined,
  logtoAppSecret: undefined,
  logtoRedirectUri: undefined,
  logtoScopes: 'openid email profile identities',
  magicLinkFrontendPath: '/auth',
  botApiKey: 'constancia-bot-dev-key',
  botInternalUrl: 'http://localhost:3002',
  backendPublicUrl: 'http://localhost:3001',
  openAiApiKey: undefined,
  contentModerationEnabled: false,
  contentModerationModel: 'omni-moderation-latest',
  contentModerationFailClosed: true,
  uploadStorageDriver: 'local',
  uploadStorageDir,
  uploadMaxBytes: 5 * 1024 * 1024,
  uploadImageMaxDimension: 64,
  uploadWebpQuality: 80,
  uploadDefaultEnabled: false,
  uploadDefaultAllowanceBytes: 50 * 1024 * 1024,
  uploadQuotaWarningPercent: 80,
  uploadPublicBaseUrl: undefined,
  r2Endpoint: undefined,
  r2AccessKeyId: undefined,
  r2SecretAccessKey: undefined,
  r2Bucket: undefined,
};

afterEach(async () => {
  await rm(uploadStorageDir, { recursive: true, force: true });
});

describe('image upload service', () => {
  it('validates, compresses, and stores supported images as WebP', async () => {
    const png = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: '#58a6ff',
      },
    })
      .png()
      .toBuffer();

    const stored = await processImageUpload(config, {
      assetId: randomUUID(),
      buffer: png,
      mimeType: 'image/png',
      caption: '',
    });

    expect(stored.mimeType).toBe('image/webp');
    expect(stored.url).toContain('/api/v1/uploads/');
    expect(await readUploadObject(config, stored.storage)).toHaveLength(stored.sizeBytes);
  });

  it('rejects files whose declared MIME type does not match the bytes', async () => {
    const png = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: '#58a6ff',
      },
    })
      .png()
      .toBuffer();

    await expect(
      processImageUpload(config, {
        assetId: randomUUID(),
        buffer: png,
        mimeType: 'image/jpeg',
        caption: '',
      }),
    ).rejects.toThrow('Uploaded image content does not match its declared MIME type.');
  });
});
