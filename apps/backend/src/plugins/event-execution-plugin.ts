import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { getPrismaClient } from '../auth/prisma.js';
import {
  createAppEventExecution,
  createLazyAppEventExecution,
} from '../services/app-event-execution.js';
import type { EventExecution } from '../services/event-execution.js';

export interface EventExecutionPluginOptions {
  eventExecution?: EventExecution;
}

const eventExecutionPlugin: FastifyPluginAsync<EventExecutionPluginOptions> = async (
  app,
  options,
) => {
  app.decorate(
    'eventExecution',
    options.eventExecution ??
      createLazyAppEventExecution(() => createAppEventExecution(getPrismaClient(), app.config)),
  );
};

export default fp(eventExecutionPlugin, {
  name: 'event-execution-plugin',
  dependencies: ['config-plugin'],
});
