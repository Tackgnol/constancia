import type { JSONSchema7 } from 'json-schema';

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

export type BlockMessage =
  | { target: 'player'; targetId?: string; content: string; imageUrl?: string }
  | { target: 'channel'; content: string; imageUrl?: string }
  | { target: 'group'; targetId: string; content: string; imageUrl?: string };

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
