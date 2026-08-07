import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { sendError } from '../http-responses.js';

const superUserScopePlugin: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', async (request, reply) => {
    if (request.access.kind !== 'session' || !request.access.isSuperUser) {
      return sendError(reply, 403, 'Superuser access required');
    }
  });
};

export default fp(superUserScopePlugin, { name: 'super-user-scope-plugin' });
