import { describe, expect, it } from 'vitest';
import { deliverAdHocChannelMessage } from '../services/ad-hoc-channel-message.js';
import { InMemoryBotDeliveryPort } from '../services/event-execution.js';

const command = {
  campaignId: 'campaign-1',
  channelId: 'channel-1',
  discordChannelId: 'discord-channel-1',
  content: 'The prince enters the chamber.',
  idempotencyKey: 'quick-narration-1',
};

describe('ad-hoc channel messages', () => {
  it('reuses the delivery identity when a failed narration is retried', async () => {
    const delivery = new InMemoryBotDeliveryPort();
    delivery.failNext('Discord unavailable');

    const failed = await deliverAdHocChannelMessage(delivery, command);
    const retried = await deliverAdHocChannelMessage(delivery, command);
    const replayed = await deliverAdHocChannelMessage(delivery, command);

    expect(failed.delivery).toEqual({ status: 'failed', error: 'Discord unavailable' });
    expect(retried.delivery).toMatchObject({ status: 'delivered', delivered: 1 });
    expect(replayed.delivery).toEqual(retried.delivery);
    expect(new Set(delivery.commands.map((entry) => entry.deliveryId))).toEqual(
      new Set([retried.deliveryId]),
    );
    expect(delivery.commands[0]?.payload).toMatchObject({
      discordChannelId: 'discord-channel-1',
      messages: [{ target: 'channel', content: 'The prince enters the chamber.' }],
    });
  });
});
