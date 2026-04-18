export interface Character {
  id: string;
  name: string;
  backstory: string;
  notes: string;
  discordUserId: string;
  campaignId: string;
  systemData: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
