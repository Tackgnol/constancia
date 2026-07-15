import {
  resolveMessageRecipients,
  type BlockMessage,
  type SendMessagesPayload,
} from '@constancia/contracts';
import type { Client } from 'discord.js';
import { createHash } from 'node:crypto';
import { buildMessageReportRow } from './discord/message-reports.js';

function formatMessageContent(message: Pick<BlockMessage, 'content' | 'imageUrl'>): string {
  return [message.content.trim(), message.imageUrl?.trim()].filter(Boolean).join('\n');
}

export async function deliverMessage(
  client: Client,
  discordChannelId: string,
  message: BlockMessage,
  eventId: string,
  deliveryId?: string,
  messageIndex = 0,
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

    await channel.send({
      content,
      components: [buildMessageReportRow(eventId)],
      ...nonceOptions(deliveryId, messageIndex, resolvedRecipients.channelId),
    });
    return { delivered: 1, skipped: 0 };
  }

  if (resolvedRecipients.target === 'player') {
    try {
      const user = await client.users.fetch(resolvedRecipients.userIds[0]);
      await user.send({
        content,
        components: [buildMessageReportRow(eventId)],
        ...nonceOptions(deliveryId, messageIndex, resolvedRecipients.userIds[0]),
      });
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
        await user.send({
          content,
          components: [buildMessageReportRow(eventId)],
          ...nonceOptions(deliveryId, messageIndex, targetId),
        });
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
  deliveryId?: string,
): Promise<{ delivered: number; skipped: number }> {
  let delivered = 0;
  let skipped = 0;

  for (const [messageIndex, message] of body.messages.entries()) {
    const result = await deliverMessage(
      client,
      body.discordChannelId,
      message,
      body.eventId,
      deliveryId,
      messageIndex,
    );
    delivered += result.delivered;
    skipped += result.skipped;
  }

  return { delivered, skipped };
}

function nonceOptions(
  deliveryId: string | undefined,
  messageIndex: number,
  targetId: string,
): { nonce: string; enforceNonce: true } | Record<string, never> {
  if (!deliveryId) return {};

  return {
    nonce: createHash('sha256')
      .update(`${deliveryId}:${messageIndex}:${targetId}`)
      .digest('base64url')
      .slice(0, 25),
    enforceNonce: true,
  };
}
