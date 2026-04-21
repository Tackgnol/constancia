import type { BlockInstance } from './block.js';

export type EventStatus = 'draft' | 'ready' | 'fired' | 'archived';

export interface GameEvent {
  id: string;
  name: string;
  type: string;
  channelId: string;
  campaignId: string;
  pipeline: BlockInstance[];
  status: EventStatus;
  shortCircuit: boolean;
  createdAt: Date;
  updatedAt: Date;
}
