import { botDeliveryPayloadSchema, type SendMessagesPayload } from '@constancia/contracts';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Client } from 'discord.js';
import { loadBotConfig, type BotConfig } from './config.js';
import { deliverMessages } from './delivery.js';
import { DeliveryDeduplicator, DeliveryIdConflictError } from './delivery-deduplicator.js';
import { deliverTestInstance } from './discord/test-instances.js';

export { deliverMessages } from './delivery.js';

export function buildBotHttpApp(
  client: Client,
  config: BotConfig = loadBotConfig(),
): FastifyInstance {
  const app = Fastify({
    logger: config.httpLoggerEnabled ? { level: 'info' } : false,
  });
  const deliveries = new DeliveryDeduplicator<{ delivered: number; skipped: number }>();

  app.addHook('onRequest', async (request, reply) => {
    const key = request.headers['x-bot-key'];
    const normalizedKey = Array.isArray(key) ? key[0] : key;

    if (normalizedKey !== config.botApiKey) {
      return reply.code(401).send({ status: 'error', data: { message: 'Unauthorized' } });
    }
  });

  app.post('/send-messages', async (request, reply) => {
    const parsedBody = botDeliveryPayloadSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.code(400).send({ status: 'error', data: { message: 'Invalid payload' } });
    }

    const rawDeliveryId = request.headers['x-delivery-id'];
    const deliveryId = Array.isArray(rawDeliveryId) ? rawDeliveryId[0] : rawDeliveryId;
    app.log.info(
      { eventId: parsedBody.data.eventId, kind: parsedBody.data.kind, deliveryId },
      'Received bot delivery request',
    );
    const deliver = () =>
      parsedBody.data.kind === 'messages'
        ? deliverMessages(client, parsedBody.data as SendMessagesPayload, deliveryId)
        : deliverTestInstance(client, parsedBody.data, deliveryId);
    let result: { delivered: number; skipped: number };
    let deduplicated = false;
    try {
      if (typeof deliveryId === 'string' && deliveryId.trim().length > 0) {
        const delivery = await deliveries.execute(
          deliveryId,
          JSON.stringify(parsedBody.data),
          deliver,
        );
        result = delivery.value;
        deduplicated = delivery.replayed;
      } else {
        result = await deliver();
      }
    } catch (error) {
      if (error instanceof DeliveryIdConflictError) {
        return reply.code(409).send({
          status: 'error',
          data: { message: error.message, code: 'DELIVERY_ID_CONFLICT' },
        });
      }
      throw error;
    }
    app.log.info(
      {
        eventId: parsedBody.data.eventId,
        kind: parsedBody.data.kind,
        delivered: result.delivered,
        skipped: result.skipped,
        deliveryId,
        deduplicated,
      },
      'Completed bot delivery request',
    );
    return reply.code(200).send({
      status: 'ok',
      data: {
        eventId: parsedBody.data.eventId,
        ...result,
        ...(deliveryId ? { deliveryId, deduplicated } : {}),
      },
    });
  });

  return app;
}

export async function startBotHttpServer(
  client: Client,
  config: BotConfig = loadBotConfig(),
): Promise<FastifyInstance> {
  const app = buildBotHttpApp(client, config);
  const port = config.botHttpPort;
  const host = config.botHttpHost;

  await app.listen({ port, host });
  console.log(`[bot-http] listening on http://${host}:${port}`);
  return app;
}
