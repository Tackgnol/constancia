import type { PrismaClient } from '@constancia/db';
import type { BackendConfig } from '../config.js';
import { createHttpBotDeliveryPort } from './bot-delivery-port.js';
import { createEventExecution, type EventExecution } from './event-execution.js';
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

export function createLazyAppEventExecution(factory: () => EventExecution): EventExecution {
  let eventExecution: EventExecution | undefined;
  const current = () => {
    eventExecution ??= factory();
    return eventExecution;
  };

  return {
    fire: (command) => current().fire(command),
    submitTestResult: (command) => current().submitTestResult(command),
    retryDeliveries: (input) => current().retryDeliveries(input),
  };
}
