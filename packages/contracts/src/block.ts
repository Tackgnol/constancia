import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { GameSystemId } from './game-system-id.js';

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
  instanceId: z.string().min(1),
  eventId: z.string().min(1),
  campaignId: z.string().min(1),
  discordChannelId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  /** The one test detail the card shows, e.g. "🎲 Roll with advantage". */
  rollModifierLine: z.string().optional(),
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

/** How a roll-modifier block changes the next roll; only Game Systems with a roll-modifier use it. */
export enum RollMode {
  Advantage = 'advantage',
  Disadvantage = 'disadvantage',
}

/** What earlier roll-modifier blocks hand to the test-resolver through the pipeline context. */
export interface RollModifiers {
  mode?: RollMode;
}

export interface BlockContext {
  campaignId: string;
  channelId: string;
  playerId: string;
  playerScore?: number;
  characterData: Record<string, unknown>;
  rollModifiers?: RollModifiers;
}

/** Context a block hands to the blocks after it; the runner merges it before the next block runs. */
export interface BlockContextPatch {
  rollModifiers?: RollModifiers;
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
    }
  | {
      kind: 'grant-lore-entry';
      loreEntryId: string;
      discordUserId: string;
    }
  | {
      kind: 'grant-npc-fact';
      npcFactId: string;
      discordUserId: string;
    };

export interface BlockResult {
  output: unknown;
  /** Set by resolver blocks; the runner carries it to later blocks as `ctx.playerScore`. */
  playerScore?: number;
  contextPatch?: BlockContextPatch;
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
  gameSystemId: GameSystemId;
  blocks: BlockInstance[];
  shortCircuit: boolean;
}
