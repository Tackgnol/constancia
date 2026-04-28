import type { FastifyPluginAsync } from 'fastify';
import { getPrismaClient } from '../auth/prisma.js';
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
        return reply.code(403).send({ status: 'error', data: { message: 'Session required' } });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { uploadsEnabled: true },
      });

      if (user === null) {
        return reply.code(404).send({ status: 'error', data: { message: 'User not found' } });
      }

      const quota = await getUserUploadQuota(prisma, userId, app.config.uploadQuotaWarningPercent);

      return { status: 'ok', data: { ...user, quota } };
    },
  );
};

export default userSettingsRoutes;
