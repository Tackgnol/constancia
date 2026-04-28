import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { createSessionAccessContext } from '../auth/access-context.js';
import { auth } from '../auth.js';

const sessionGuardPlugin: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (request, reply) => {
    // OPTIONS requests are used for CORS preflight and don't carry cookies.
    // Let @fastify/cors handle them.
    if (request.method === 'OPTIONS') {
      return;
    }

    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });

    if (session === null) {
      await reply.code(401).send({ status: 'error', data: { message: 'Unauthorized' } });
      return;
    }

    request.session = session;
    request.access = await createSessionAccessContext(session);
  });
};

export default fp(sessionGuardPlugin, {
  name: 'session-guard-plugin',
});
