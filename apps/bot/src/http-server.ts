import {
  resolveMessageRecipients,
  sendMessagesPayloadSchema,
  type BlockMessage,
  type SendMessagesPayload,
} from '@constancia/contracts';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Client } from 'discord.js';
import { loadBotConfig, type BotConfig } from './config.js';

function formatMessageContent(message: Pick<BlockMessage, 'content' | 'imageUrl'>): string {
  return [message.content.trim(), message.imageUrl?.trim()].filter(Boolean).join('\n');
}

async function deliverMessage(
  client: Client,
  discordChannelId: string,
  message: BlockMessage,
): Promise<{ delivered: number; skipped: number }> {
  const content = formatMessageContent(message);
  if (!content) {
    return { delivered: 0, skipped: 1 };
  }

  const resolvedRecipients = resolveMessageRecipients(discordChannelId, message);
  if (!resolvedRecipients) {
    console.warn('[bot-http] Skipping message without valid recipients', {
      target: message.target,
    });
    return { delivered: 0, skipped: 1 };
  }

  if (resolvedRecipients.target === 'channel') {
    const channel = await client.channels.fetch(resolvedRecipients.channelId);
    if (!channel || !channel.isSendable() || channel.isDMBased()) {
      console.warn('[bot-http] Unable to deliver channel message:', {
        discordChannelId: resolvedRecipients.channelId,
      });
      return { delivered: 0, skipped: 1 };
    }

    await channel.send(content);
    return { delivered: 1, skipped: 0 };
  }

  if (resolvedRecipients.target === 'player') {
    try {
      const user = await client.users.fetch(resolvedRecipients.userIds[0]);
      await user.send(content);
      return { delivered: 1, skipped: 0 };
    } catch (error) {
      console.warn('[bot-http] Failed to deliver player DM:', {
        targetId: resolvedRecipients.userIds[0],
        error,
      });
      return { delivered: 0, skipped: 1 };
    }
  }

  const results = await Promise.all(
    resolvedRecipients.userIds.map(async (targetId: string) => {
      try {
        const user = await client.users.fetch(targetId);
        await user.send(content);
        return true;
      } catch (error) {
        console.warn('[bot-http] Failed to deliver group DM:', { targetId, error });
        return false;
      }
    }),
  );

  const delivered = results.filter(Boolean).length;
  return { delivered, skipped: resolvedRecipients.userIds.length - delivered };
}

export async function deliverMessages(
  client: Client,
  body: SendMessagesPayload,
): Promise<{ delivered: number; skipped: number }> {
  let delivered = 0;
  let skipped = 0;

  for (const message of body.messages) {
    const result = await deliverMessage(client, body.discordChannelId, message);
    delivered += result.delivered;
    skipped += result.skipped;
  }

  return { delivered, skipped };
}

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
    const parsedBody = sendMessagesPayloadSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.code(400).send({ status: 'error', data: { message: 'Invalid payload' } });
    }

    app.log.info({ eventId: parsedBody.data.eventId }, 'Received bot delivery request');
    const result = await deliverMessages(client, parsedBody.data);
    app.log.info(
      { eventId: parsedBody.data.eventId, delivered: result.delivered, skipped: result.skipped },
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

