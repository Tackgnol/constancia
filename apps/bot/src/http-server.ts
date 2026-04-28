import { botDeliveryPayloadSchema, type SendMessagesPayload } from '@constancia/contracts';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Client } from 'discord.js';
import { loadBotConfig, type BotConfig } from './config.js';
import { deliverMessages } from './delivery.js';
import { deliverTestInstance } from './discord/test-instances.js';

export { deliverMessages } from './delivery.js';

export function buildBotHttpApp(
  client: Client,
  config: BotConfig = loadBotConfig(),
): FastifyInstance {
  const app = Fastify({
    logger: config.httpLoggerEnabled ? { level: 'info' } : false,
  });

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

    app.log.info(
      { eventId: parsedBody.data.eventId, kind: parsedBody.data.kind },
      'Received bot delivery request',
    );
    const result =
      parsedBody.data.kind === 'messages'
        ? await deliverMessages(client, parsedBody.data as SendMessagesPayload)
        : await deliverTestInstance(client, parsedBody.data);
    app.log.info(
      {
        eventId: parsedBody.data.eventId,
        kind: parsedBody.data.kind,
        delivered: result.delivered,
        skipped: result.skipped,
      },
      'Completed bot delivery request',
    );
    return reply
      .code(200)
      .send({ status: 'ok', data: { eventId: parsedBody.data.eventId, ...result } });
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
