import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { DEFAULT_BOT_API_KEY } from '../config.js';

const botAuthPlugin: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS') {
      return;
    }

    const expectedKey = app.config.botApiKey ?? DEFAULT_BOT_API_KEY;
    const key = request.headers['x-bot-key'];

    if (key !== expectedKey) {
      await reply.code(401).send({ status: 'error', data: { message: 'Unauthorized' } });
      return;
    }
  });
};

export default fp(botAuthPlugin, {
  name: 'bot-auth-plugin',
});
