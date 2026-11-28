import type { GameDate } from './game-date.js';
import type { GameSystemId } from './game-system-id.js';

export type ChannelType = 'main' | 'scene' | 'temp';

export interface Campaign {
  id: string;
  name: string;
  discordGuildId: string;
  gameSystemId: GameSystemId;
  gameDate: GameDate | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Channel {
  id: string;
  name: string;
  discordChannelId: string;
  campaignId: string;
  type: ChannelType;
  createdAt: Date;
}
