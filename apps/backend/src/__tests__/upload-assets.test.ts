import { describe, expect, it } from 'vitest';
import {
  extractUploadAssetIdsFromPipeline,
  type UploadQuotaSnapshot,
} from '../services/upload-assets.js';

const assetId = '123e4567-e89b-12d3-a456-426614174000';

describe('upload asset helpers', () => {
  it('extracts uploaded asset ids from nested pipeline image URLs', () => {
    expect(
      extractUploadAssetIdsFromPipeline([
        {
          blockType: 'message-channel',
          config: {
            imageUrl: `https://assets.constancia.test/uploads/${assetId}.webp`,
            nested: {
              ignored: 'https://assets.constancia.test/uploads/not-an-id.webp',
            },
          },
        },
        {
          blockType: 'display-image',
          config: {
            imageUrl: `http://localhost:3000/api/v1/uploads/${assetId}`,
          },
        },
      ]),
    ).toEqual([assetId]);
  });

  it('keeps quota snapshots explicit enough for upload forms', () => {
    const quota: UploadQuotaSnapshot = {
      uploadAllowanceBytes: 50 * 1024 * 1024,
      uploadUsedBytes: 42 * 1024 * 1024,
      uploadRemainingBytes: 8 * 1024 * 1024,
      uploadUsagePercent: 84,
      uploadNearLimit: true,
    };

    expect(quota.uploadNearLimit).toBe(true);
  });
});
