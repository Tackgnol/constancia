import type { FastifyPluginAsync } from 'fastify';
import { getPrismaClient } from '../auth/prisma.js';
import { ok, sendError, sendNotFound } from '../http-responses.js';
import {
  standardResponseSchema,
  singleResponseSchema,
  userUploadSettingsSchema,
} from '../schemas.js';
import { getUserUploadQuota } from '../services/upload-assets.js';

const userSettingsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/me/upload-settings',
    {
      schema: {
        tags: ['auth'],
        summary: 'Get the current user upload setting',
        operationId: 'getUserUploadSettings',
        response: {
          200: singleResponseSchema(userUploadSettingsSchema),
          403: standardResponseSchema,
          404: standardResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();
      const userId = request.access.kind === 'session' ? request.access.userId : null;
      if (!userId) {
        return sendError(reply, 403, 'Session required');
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { uploadsEnabled: true },
      });

      if (user === null) {
        return sendNotFound(reply, 'User not found');
      }

      const quota = await getUserUploadQuota(prisma, userId, app.config.uploadQuotaWarningPercent);

      return ok({ ...user, quota });
    },
  );
};

export default userSettingsRoutes;
