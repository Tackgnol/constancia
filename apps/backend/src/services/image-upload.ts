import sharp from 'sharp';
import type { BackendConfig } from '../config.js';
import { moderateUploadedImage } from './content-moderation.js';
import { UploadValidationError } from './request-errors.js';
import { putUploadObject, type StoredObject } from './upload-storage.js';

const supportedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface StoredImageUpload {
  assetId: string;
  url: string;
  mimeType: 'image/webp';
  sizeBytes: number;
  storage: StoredObject;
}

export async function processImageUpload(
  config: BackendConfig,
  params: {
    assetId: string;
    buffer: Buffer;
    mimeType: string;
    caption: string;
  },
): Promise<StoredImageUpload> {
  assertSupportedImage(params.mimeType);

  if (params.buffer.byteLength === 0) {
    throw new UploadValidationError('The uploaded file was empty.');
  }

  if (params.buffer.byteLength > config.uploadMaxBytes) {
    throw new UploadValidationError(`Uploads must be ${config.uploadMaxBytes} bytes or smaller.`);
  }

  const detectedMimeType = await detectImageMimeType(params.buffer);
  if (detectedMimeType !== params.mimeType) {
    throw new UploadValidationError(
      'Uploaded image content does not match its declared MIME type.',
    );
  }

  await moderateUploadedImage(config, params.caption, params.buffer, detectedMimeType);

  const optimizedBuffer = await sharp(params.buffer)
    .rotate()
    .resize({
      width: config.uploadImageMaxDimension,
      height: config.uploadImageMaxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: config.uploadWebpQuality })
    .toBuffer();

  const storage = await putUploadObject(config, {
    assetId: params.assetId,
    body: optimizedBuffer,
    contentType: 'image/webp',
  });

  return {
    assetId: params.assetId,
    url: storage.publicUrl,
    mimeType: 'image/webp',
    sizeBytes: optimizedBuffer.byteLength,
    storage,
  };
}

function assertSupportedImage(mimeType: string): void {
  if (!supportedImageMimeTypes.has(mimeType)) {
    throw new UploadValidationError('Only JPEG, PNG, and WebP images are supported.');
  }
}

async function detectImageMimeType(buffer: Buffer): Promise<string> {
  try {
    const metadata = await sharp(buffer).metadata();
    if (metadata.format === 'jpeg') {
      return 'image/jpeg';
    }

    if (metadata.format === 'png') {
      return 'image/png';
    }

    if (metadata.format === 'webp') {
      return 'image/webp';
    }
  } catch {
    throw new UploadValidationError('The uploaded file is not a valid image.');
  }

  throw new UploadValidationError('Only JPEG, PNG, and WebP images are supported.');
}
