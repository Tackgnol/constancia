export type ChannelType = 'main' | 'scene' | 'temp';

export interface Campaign {
  id: string;
  name: string;
  discordGuildId: string;
  gameSystemId: string;
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
