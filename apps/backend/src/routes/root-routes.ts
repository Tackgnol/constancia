import type { FastifyPluginAsync } from 'fastify';

const rootRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      schema: {
        tags: ['meta'],
        summary: 'Get service metadata',
        operationId: 'getServiceMetadata',
        response: {
          200: {
            description: 'Service metadata',
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string' },
              status: { type: 'string' },
              apiPrefix: { type: 'string' },
              docsPrefix: { type: 'string' },
              openApiPath: { type: 'string' },
            },
            required: ['name', 'status', 'apiPrefix', 'docsPrefix', 'openApiPath'],
          },
        },
      },
    },
    async () => ({
      name: 'constancia-backend',
      status: 'ready',
      apiPrefix: app.config.apiPrefix,
      docsPrefix: app.config.docsPrefix,
      openApiPath: app.config.openApiPath,
    }),
  );
};

export default rootRoutes;
