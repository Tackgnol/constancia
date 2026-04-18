export interface Npc {
  id: string;
  name: string;
  imageUrl?: string;
  description: string;
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
