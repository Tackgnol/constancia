import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { getPrismaClient } from '../auth/prisma.js';
import { createAppEventExecution } from '../services/app-event-execution.js';

const DISPATCH_INTERVAL_MS = 5_000;

const eventDeliveryDispatcherPlugin: FastifyPluginAsync = async (app) => {
  if (app.config.nodeEnv === 'test') return;

  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;

    void createAppEventExecution(getPrismaClient(), app.config)
      .retryDeliveries({ limit: 25 })
      .catch((error: unknown) => {
        app.log.error({ error }, 'Event delivery dispatcher pass failed');
      })
      .finally(() => {
        running = false;
      });
  }, DISPATCH_INTERVAL_MS);
  timer.unref();

  app.addHook('onClose', async () => {
    clearInterval(timer);
  });
};

export default fp(eventDeliveryDispatcherPlugin, {
  name: 'event-delivery-dispatcher-plugin',
  dependencies: ['config-plugin'],
});
