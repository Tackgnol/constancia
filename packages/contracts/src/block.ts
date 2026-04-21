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
  eventId: z.string().min(1),
  discordChannelId: z.string().min(1),
  messages: z.array(blockMessageSchema),
});

export type BlockMessage = z.infer<typeof blockMessageSchema>;
export type SendMessagesPayload = z.infer<typeof sendMessagesPayloadSchema>;

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
    const userIds = typeof message.targetId === 'string' ? [message.targetId.trim()].filter(Boolean) : [];
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

export interface BlockResult {
  output: unknown;
  messages?: BlockMessage[];
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
