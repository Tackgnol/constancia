import { createHash } from 'node:crypto';
import type { BlockMessage } from '@constancia/contracts';
import type { BotDeliveryPort, BotDeliveryResult } from './event-execution.js';

export interface AdHocChannelMessageCommand {
  campaignId: string;
  channelId: string;
  discordChannelId: string;
  content: string;
  idempotencyKey: string;
  imageUrl?: string;
}

export interface AdHocChannelMessageResult {
  campaignId: string;
  channelId: string;
  deliveryId: string;
  delivery: BotDeliveryResult;
}

export async function deliverAdHocChannelMessage(
  port: BotDeliveryPort,
  command: AdHocChannelMessageCommand,
): Promise<AdHocChannelMessageResult> {
  const deliveryId = createHash('sha256')
    .update(`ad-hoc-channel:${command.campaignId}:${command.idempotencyKey}`)
    .digest('base64url')
    .slice(0, 25);
  const message: BlockMessage = {
    target: 'channel',
    content: command.content,
    ...(command.imageUrl ? { imageUrl: command.imageUrl } : {}),
  };
  const delivery = await port.deliver({
    deliveryId,
    payload: {
      kind: 'messages',
      eventId: `ad-hoc-channel-${deliveryId}`,
      discordChannelId: command.discordChannelId,
      messages: [message],
    },
  });

  return {
    campaignId: command.campaignId,
    channelId: command.channelId,
    deliveryId,
    delivery,
  };
}
