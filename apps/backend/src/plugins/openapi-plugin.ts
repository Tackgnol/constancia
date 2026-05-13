import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyPluginAsync } from 'fastify';

const openApiPlugin: FastifyPluginAsync = async (app) => {
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Constancia Backend API',
        description: 'Backend API contract for the Constancia frontend and Discord bot.',
        version: '0.1.0',
      },
      tags: [
        { name: 'meta', description: 'Service metadata and health checks' },
        { name: 'auth', description: 'Authentication and session endpoints' },
        { name: 'admin', description: 'Superuser-only review endpoints' },
        { name: 'campaigns', description: 'Campaign management endpoints' },
        { name: 'characters', description: 'Character management endpoints' },
        { name: 'npcs', description: 'NPC and knowledge endpoints' },
        { name: 'events', description: 'Event pipeline endpoints' },
        { name: 'journal', description: 'Quest and session summary endpoints' },
        { name: 'bot', description: 'Discord bot integration endpoints' },
        { name: 'systems', description: 'Registered game systems' },
        { name: 'uploads', description: 'Moderated image upload and asset delivery endpoints' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: app.config.docsPrefix,
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  app.get(
    app.config.openApiPath,
    {
      schema: {
        tags: ['meta'],
        summary: 'Get OpenAPI document',
        operationId: 'getOpenApiDocument',
        response: {
          200: {
            description: 'OpenAPI document',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async () => app.swagger(),
  );
};

export default fp(openApiPlugin, {
  name: 'openapi-plugin',
});
