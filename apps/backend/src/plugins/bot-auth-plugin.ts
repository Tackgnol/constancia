import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { createBotAccessContext } from '../auth/access-context.js';

function keysMatch(expected: string, provided: string): boolean {
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);

  // timingSafeEqual throws on length mismatch; compare to a same-length buffer
  // so callers can't distinguish "wrong length" from "wrong value" via timing.
  if (providedBuf.length !== expectedBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }

  return timingSafeEqual(expectedBuf, providedBuf);
}

const botAuthPlugin: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS') {
      return;
    }

    const expectedKey = app.config.botApiKey;
    const header = request.headers['x-bot-key'];
    const provided = typeof header === 'string' ? header : '';

    if (!keysMatch(expectedKey, provided)) {
      await reply.code(401).send({ status: 'error', data: { message: 'Unauthorized' } });
      return;
    }

    request.access = createBotAccessContext();
  });
};

export default fp(botAuthPlugin, {
  name: 'bot-auth-plugin',
});
