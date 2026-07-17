import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';

export const blockMessageSchema = z.union([
  z.object({
    target: z.literal('player'),
    targetId: z.string().optional(),
    content: z.string(),
    imageUrl: z.string().optional(),
  }),
  z.object({
    target: z.literal('channel'),
    content: z.string(),
    imageUrl: z.string().optional(),
  }),
  z.object({
    target: z.literal('group'),
    targetIds: z.array(z.string()),
    content: z.string(),
    imageUrl: z.string().optional(),
  }),
]);

export const sendMessagesPayloadSchema = z.object({
  kind: z.literal('messages').default('messages'),
  eventId: z.string().min(1),
  discordChannelId: z.string().min(1),
  messages: z.array(blockMessageSchema),
});

export const testThresholdSchema = z.object({
  threshold: z.number(),
  text: z.string(),
});

export const sendTestInstancePayloadSchema = z.object({
  kind: z.literal('test-instance'),
  eventId: z.string().min(1),
  campaignId: z.string().min(1),
  discordChannelId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  thresholds: z.array(testThresholdSchema).min(1),
});

export const botDeliveryPayloadSchema = z.union([
  sendMessagesPayloadSchema,
  sendTestInstancePayloadSchema,
]);

export type BlockMessage = z.infer<typeof blockMessageSchema>;
export type SendMessagesPayload = z.infer<typeof sendMessagesPayloadSchema>;
export type TestThreshold = z.infer<typeof testThresholdSchema>;
export type SendTestInstancePayload = z.infer<typeof sendTestInstancePayloadSchema>;
export type BotDeliveryPayload = z.infer<typeof botDeliveryPayloadSchema>;

export type ResolvedMessageRecipients =
  | { target: 'channel'; channelId: string }
  | { target: 'player'; userIds: string[] }
  | { target: 'group'; userIds: string[] };

export function resolveMessageRecipients(
  discordChannelId: string,
  message: BlockMessage,
): ResolvedMessageRecipients | null {
  if (message.target === 'channel') {
    return { target: 'channel', channelId: discordChannelId };
  }

  if (message.target === 'player') {
    const userIds =
      typeof message.targetId === 'string' ? [message.targetId.trim()].filter(Boolean) : [];
    return userIds.length > 0 ? { target: 'player', userIds } : null;
  }

  const userIds = message.targetIds.map((id) => id.trim()).filter(Boolean);
  return userIds.length > 0 ? { target: 'group', userIds } : null;
}

export interface BlockContext {
  campaignId: string;
  channelId: string;
  playerId: string;
  playerScore?: number;
  characterData: Record<string, unknown>;
}

export interface BlockDefinition<TConfig = unknown> {
  type: string;
  label: string;
  configSchema: JSONSchema7;
  execute: (config: TConfig, ctx: BlockContext) => Promise<BlockResult>;
}

export type BlockEffect =
  | {
      kind: 'add-journal-entry';
      title: string;
      content: string;
      visible: boolean;
      channelId: string;
    }
  | {
      kind: 'add-quest';
      name: string;
      description: string;
      visible: boolean;
    };

export interface BlockResult {
  output: unknown;
  messages?: BlockMessage[];
  effects?: BlockEffect[];
  halt?: boolean;
}

export interface BlockInstance {
  blockType: string;
  config: Record<string, unknown>;
}

export interface EventPipeline {
  id: string;
  name: string;
  gameSystemId: string;
  blocks: BlockInstance[];
  shortCircuit: boolean;
}
