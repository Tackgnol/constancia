import type { PrismaClient } from '@constancia/db';
import type { BackendConfig } from '../config.js';
import { createHttpBotDeliveryPort } from './bot-delivery-port.js';
import { createEventExecution } from './event-execution.js';
import { createPrismaEventExecutionPlanner } from './event-execution-planner.js';
import { createPrismaEventExecutionStore } from './event-execution-store.js';

export function createAppEventExecution(prisma: PrismaClient, config: BackendConfig) {
  return createEventExecution({
    store: createPrismaEventExecutionStore(prisma),
    planner: createPrismaEventExecutionPlanner(prisma),
    delivery: createHttpBotDeliveryPort({
      botInternalUrl: config.botInternalUrl,
      botApiKey: config.botApiKey,
    }),
  });
}
