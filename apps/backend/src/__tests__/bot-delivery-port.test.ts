import type { BotDeliveryPayload } from '@constancia/contracts';
import { describe, expect, it, vi } from 'vitest';
import { createHttpBotDeliveryPort } from '../services/bot-delivery-port.js';

const payload: BotDeliveryPayload = {
  kind: 'messages',
  eventId: 'event-1',
  discordChannelId: 'discord-channel-1',
  messages: [{ target: 'channel', content: 'The door opens.' }],
};

describe('HTTP bot delivery port', () => {
  it('sends the durable delivery id and reports the bot acknowledgement', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          data: { delivered: 1, skipped: 0 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const port = createHttpBotDeliveryPort({
      botInternalUrl: 'http://bot.internal',
      botApiKey: 'secret',
      fetch: request,
    });

    await expect(port.deliver({ deliveryId: 'delivery-1', payload })).resolves.toEqual({
      status: 'delivered',
      delivered: 1,
      skipped: 0,
    });
    expect(request).toHaveBeenCalledWith(
      'http://bot.internal/send-messages',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-bot-key': 'secret',
          'x-delivery-id': 'delivery-1',
        }),
      }),
    );
  });

  it('turns transport failures into retryable delivery results', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('Unavailable', { status: 503 }));
    const port = createHttpBotDeliveryPort({
      botInternalUrl: 'http://bot.internal',
      botApiKey: 'secret',
      fetch: request,
    });

    await expect(port.deliver({ deliveryId: 'delivery-2', payload })).resolves.toEqual({
      status: 'failed',
      error: 'Bot returned HTTP 503',
    });
  });
});
