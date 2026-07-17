import type { GameDate } from './game-date.js';

export type QuestStatus = 'active' | 'completed' | 'failed';
export type QuestEntryStatus = 'pending' | 'done';

export interface Quest {
  id: string;
  name: string;
  description: string;
  campaignId: string;
  status: QuestStatus;
  sortOrder: number;
  visible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestEntry {
  id: string;
  content: string;
  questId: string;
  status: QuestEntryStatus;
  sortOrder: number;
  createdAt: Date;
}

export interface SessionSummary {
  id: string;
  title: string;
  content: string;
  campaignId: string;
  sessionDate: Date;
  gameDate: GameDate | null;
  visible: boolean;
  channelId?: string;
  createdAt: Date;
  updatedAt: Date;
}
