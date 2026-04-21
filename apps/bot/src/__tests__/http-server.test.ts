import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client } from 'discord.js';
import { buildBotHttpApp, deliverMessages } from '../http-server.js';

afterEach(() => {
  delete process.env.BOT_API_KEY;
  vi.restoreAllMocks();
});

function createClientMock() {
  const send = vi.fn().mockResolvedValue(undefined);
  const client = {
    channels: {
      fetch: vi.fn().mockResolvedValue({
        isSendable: () => true,
        isTextBased: () => true,
        isDMBased: () => false,
        send,
      }),
    },
    users: {
      fetch: vi.fn().mockResolvedValue({ send }),
    },
  } as unknown as Client;

  return { client, send };
}

describe('bot HTTP server', () => {
  it('rejects requests without the expected bot key', async () => {
    process.env.BOT_API_KEY = 'test-key';
    const { client } = createClientMock();
    const app = buildBotHttpApp(client);

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/send-messages',
        payload: { eventId: 'event-1', discordChannelId: 'channel-1', messages: [] },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ status: 'error', data: { message: 'Unauthorized' } });
    } finally {
      await app.close();
    }
  });

  it('delivers channel messages for authorized requests', async () => {
    process.env.BOT_API_KEY = 'test-key';
    const { client, send } = createClientMock();
    const app = buildBotHttpApp(client);

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/send-messages',
        headers: { 'x-bot-key': 'test-key' },
        payload: {
          eventId: 'event-1',
          discordChannelId: 'channel-1',
          messages: [{ target: 'channel', content: 'The coterie hears the door unlock.' }],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        status: 'ok',
        data: { eventId: 'event-1', delivered: 1, skipped: 0 },
      });
      expect(send).toHaveBeenCalledWith('The coterie hears the door unlock.');
    } finally {
      await app.close();
    }
  });

  it('delivers player and group messages using target IDs', async () => {
    const { client, send } = createClientMock();

    await expect(
      deliverMessages(
        client,
        {
          eventId: 'event-1',
          discordChannelId: 'channel-1',
          messages: [
            { target: 'player', targetId: 'user-1', content: 'You notice the blood stain.' },
            {
              target: 'group',
              targetIds: ['user-2', 'user-3'],
              content: 'Only the scouts hear this.',
            },
          ],
        } as unknown as Parameters<typeof deliverMessages>[1],
      ),
    ).resolves.toEqual({ delivered: 3, skipped: 0 });

    expect(send).toHaveBeenCalledTimes(3);
  });

  it('treats player DM failures as skipped instead of failing the whole request', async () => {
    const client = {
      channels: {
        fetch: vi.fn(),
      },
      users: {
        fetch: vi.fn().mockResolvedValue({
          send: vi.fn().mockRejectedValue(new Error('Cannot message user')),
        }),
      },
    } as unknown as Client;

    await expect(
      deliverMessages(client, {
        eventId: 'event-1',
        discordChannelId: 'channel-1',
        messages: [{ target: 'player', targetId: 'user-1', content: 'Private clue' }],
      }),
    ).resolves.toEqual({ delivered: 0, skipped: 1 });
  });

  it('counts partial group DM failures correctly', async () => {
    const sendByUser = new Map<string, ReturnType<typeof vi.fn>>([
      ['user-1', vi.fn().mockResolvedValue(undefined)],
      ['user-2', vi.fn().mockRejectedValue(new Error('DM closed'))],
    ]);

    const client = {
      channels: {
        fetch: vi.fn(),
      },
      users: {
        fetch: vi.fn().mockImplementation(async (userId: string) => ({
          send: sendByUser.get(userId),
        })),
      },
    } as unknown as Client;

    await expect(
      deliverMessages(
        client,
        {
          eventId: 'event-1',
          discordChannelId: 'channel-1',
          messages: [{ target: 'group', targetIds: ['user-1', 'user-2'], content: 'Scout update' }],
        } as unknown as Parameters<typeof deliverMessages>[1],
      ),
    ).resolves.toEqual({ delivered: 1, skipped: 1 });
  });
});
