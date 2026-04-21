import type { PlayerUserRef } from './player-user-ref.js';

export type NpcSystemBlockValue =
  | string
  | number
  | boolean
  | null
  | NpcSystemBlockValue[]
  | { [key: string]: NpcSystemBlockValue };

export interface NpcSystemBlock {
  systemId?: string;
  blockType: string;
  label: string;
  value: NpcSystemBlockValue;
}

export interface Npc {
  id: string;
  name: string;
  imageUrl?: string;
  description: string;
  systemBlocks: NpcSystemBlock[];
  campaignId: string;
  createdAt: Date;
}

export interface NpcFact {
  id: string;
  content: string;
  sortOrder: number;
  npcId: string;
}

export interface NpcKnowledge {
  characterId: string;
  npcFactId: string;
  revealedAt: Date;
}

export interface NpcFactWithKnowledge extends NpcFact {
  knownTo: PlayerUserRef[];
}

