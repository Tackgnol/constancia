import type { FastifyPluginAsync } from 'fastify';

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['meta'],
        summary: 'Get service health',
        operationId: 'getServiceHealth',
        response: {
          200: {
            description: 'Health status',
            type: 'object',
            additionalProperties: false,
            properties: {
              status: { type: 'string' },
              service: { type: 'string' },
              environment: { type: 'string' },
            },
            required: ['status', 'service', 'environment'],
          },
        },
      },
    },
    async () => ({
      status: 'ok',
      service: 'backend',
      environment: app.config.nodeEnv,
    }),
  );
};

export default healthRoutes;
