import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { getPrismaClient } from '../auth/prisma.js';
import { ok, sendNotFound } from '../http-responses.js';
import {
  standardResponseSchema,
  singleResponseSchema,
  uploadAssetParamsSchema,
  uploadAssetSchema,
  uploadImageBodySchema,
} from '../schemas.js';
import { processImageUpload } from '../services/image-upload.js';
import { UploadPermissionError, UploadValidationError } from '../services/request-errors.js';
import { assertUserUploadAllowance, type UploadQuotaSnapshot } from '../services/upload-assets.js';
import {
  deleteUploadObjects,
  isValidUploadAssetId,
  readUploadObject,
} from '../services/upload-storage.js';

const uploadPublicRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { assetId: string } }>(
    '/:assetId',
    {
      schema: {
        tags: ['uploads'],
        summary: 'Get a previously uploaded image asset',
        operationId: 'getUploadedImage',
        params: uploadAssetParamsSchema,
        response: {
          200: { type: 'string', format: 'binary' },
          404: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { assetId } = request.params;
      if (!isValidUploadAssetId(assetId)) {
        return sendNotFound(reply, 'Upload not found');
      }

      const prisma = getPrismaClient();
      const asset = await prisma.uploadAsset.findUnique({
        where: { id: assetId },
        select: { storageProvider: true, storageKey: true, bucket: true },
      });
      if (asset === null) {
        return sendNotFound(reply, 'Upload not found');
      }

      try {
        const payload = await readUploadObject(app.config, asset);
        reply.type('image/webp');
        reply.header('cache-control', 'public, max-age=31536000, immutable');
        return reply.send(payload);
      } catch {
        return sendNotFound(reply, 'Upload not found');
      }
    },
  );
};

const uploadProtectedRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/image',
    {
      schema: {
        tags: ['uploads'],
        summary: 'Upload, moderate, and compress an image',
        operationId: 'uploadImage',
        consumes: ['multipart/form-data'],
        body: uploadImageBodySchema,
        response: {
          201: singleResponseSchema(uploadAssetSchema),
          400: standardResponseSchema,
          403: standardResponseSchema,
          404: standardResponseSchema,
          413: standardResponseSchema,
          503: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = request.access.kind === 'session' ? request.access.userId : null;
      if (!userId) {
        throw new UploadPermissionError('Session required to upload files.');
      }

      const prisma = getPrismaClient();
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { uploadsEnabled: true },
      });
      if (user === null) {
        return sendNotFound(reply, 'User not found');
      }
      if (!user.uploadsEnabled) {
        throw new UploadPermissionError();
      }

      let caption = '';
      let fileBuffer: Buffer | null = null;
      let mimeType: string | null = null;

      for await (const part of request.parts({
        limits: {
          files: 1,
          fileSize: app.config.uploadMaxBytes,
          fields: 10,
        },
      })) {
        if (part.type === 'file') {
          if (fileBuffer !== null) {
            throw new UploadValidationError('Submit only one image per upload.');
          }

          try {
            fileBuffer = await part.toBuffer();
          } catch {
            throw new UploadValidationError(
              `Uploads must be ${app.config.uploadMaxBytes} bytes or smaller.`,
            );
          }
          mimeType = part.mimetype;
          continue;
        }

        if (part.fieldname === 'caption' && typeof part.value === 'string') {
          caption = part.value;
        }
      }

      if (fileBuffer === null || mimeType === null) {
        throw new UploadValidationError('Choose an image file before uploading.');
      }

      const assetId = randomUUID();
      const stored = await processImageUpload(app.config, {
        assetId,
        buffer: fileBuffer,
        mimeType,
        caption,
      });
      let quota: UploadQuotaSnapshot;
      try {
        quota = await assertUserUploadAllowance(prisma, {
          userId,
          incomingBytes: stored.sizeBytes,
          warningPercent: app.config.uploadQuotaWarningPercent,
        });
      } catch (error) {
        await deleteUploadObjects(app.config, [stored.storage]);
        throw error;
      }

      const asset = await prisma.uploadAsset.create({
        data: {
          id: stored.assetId,
          userId,
          storageKey: stored.storage.storageKey,
          storageProvider: stored.storage.storageProvider,
          bucket: stored.storage.bucket,
          publicUrl: stored.storage.publicUrl,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          originalMimeType: mimeType,
        },
        select: {
          id: true,
          mimeType: true,
          sizeBytes: true,
        },
      });

      reply.code(201);
      return ok({
        assetId: asset.id,
        url: stored.url,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        quota,
      });
    },
  );
};

export { uploadProtectedRoutes, uploadPublicRoutes };
