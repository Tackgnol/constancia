export type AdminRole = 'owner' | 'gm';

export interface CampaignAdmin {
  id: string;
  discordUserId: string;
  campaignId: string;
  role: AdminRole;
}

export interface CampaignMembership {
  campaignId: string;
  role: AdminRole;
}

export interface AuthContext {
  userId: string;
  discordUserId: string;
  campaigns: CampaignMembership[];
}
