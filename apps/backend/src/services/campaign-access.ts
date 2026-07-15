import type { AccessContext } from '../auth/access-context.js';
import { getPrismaClient } from '../auth/prisma.js';

const campaignScopeBrand: unique symbol = Symbol('CampaignScope');

export interface CampaignScope {
  readonly [campaignScopeBrand]: true;
  readonly campaignId: string;
  readonly discordGuildId: string;
  readonly gameSystemId: string;
  readonly role: 'owner' | 'gm' | 'superuser';
}

interface CampaignRecord {
  id: string;
  discordGuildId: string;
  gameSystemId: string;
}

interface CampaignAdminRecord {
  role: 'owner' | 'gm';
}

export interface CampaignAccessPrisma {
  campaign: {
    findUnique(args: {
      where: { id: string };
      select: { id: true; discordGuildId: true; gameSystemId: true };
    }): Promise<CampaignRecord | null>;
  };
  campaignAdmin: {
    findUnique(args: {
      where: { discordUserId_campaignId: { discordUserId: string; campaignId: string } };
      select: { role: true };
    }): Promise<CampaignAdminRecord | null>;
  };
  event: {
    findFirst(args: {
      where: { id: string; campaignId: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  channel: {
    findFirst(args: {
      where: { id: string; campaignId: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  character: {
    findFirst(args: {
      where: { id: string; campaignId: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  npc: {
    findFirst(args: {
      where: { id: string; campaignId: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  npcFact: {
    findFirst(args: {
      where: { id: string; npcId: string; npc: { campaignId: string } };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  quest: {
    findFirst(args: {
      where: { id: string; campaignId: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  questEntry: {
    findFirst(args: {
      where: { id: string; questId: string; quest: { campaignId: string } };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  sessionSummary: {
    findFirst(args: {
      where: { id: string; campaignId: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
}

export type CampaignResourceRef =
  | {
      kind: 'event' | 'channel' | 'character' | 'npc' | 'quest' | 'session-summary';
      id: string;
    }
  | { kind: 'npc-fact'; id: string; npcId: string }
  | { kind: 'quest-entry'; id: string; questId: string };

export interface CampaignAccess {
  requireAdmin(access: AccessContext, campaignId: string): Promise<CampaignScope>;
  requireResource(scope: CampaignScope, resource: CampaignResourceRef): Promise<void>;
}

export class CampaignAuthenticationError extends Error {
  readonly statusCode = 401;
  readonly code = 'CAMPAIGN_AUTHENTICATION_REQUIRED';

  constructor(message = 'Session access is required.') {
    super(message);
    this.name = 'CampaignAuthenticationError';
  }
}

export class CampaignAuthorizationError extends Error {
  readonly statusCode = 403;
  readonly code = 'CAMPAIGN_ACCESS_DENIED';

  constructor(message = 'Campaign access is denied.') {
    super(message);
    this.name = 'CampaignAuthorizationError';
  }
}

export class CampaignNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'CAMPAIGN_NOT_FOUND';

  constructor(message = 'Campaign not found.') {
    super(message);
    this.name = 'CampaignNotFoundError';
  }
}

export class CampaignResourceNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'CAMPAIGN_RESOURCE_NOT_FOUND';

  constructor(message = 'Campaign resource not found.') {
    super(message);
    this.name = 'CampaignResourceNotFoundError';
  }
}

class PrismaCampaignAccess implements CampaignAccess {
  constructor(private readonly prisma: CampaignAccessPrisma) {}

  async requireAdmin(access: AccessContext, campaignId: string): Promise<CampaignScope> {
    if (access.kind !== 'session') {
      throw new CampaignAuthenticationError();
    }

    const { discordUserId, isSuperUser } = access;
    if (!isSuperUser && discordUserId === null) {
      throw new CampaignAuthorizationError('A linked Discord account is required.');
    }

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, discordGuildId: true, gameSystemId: true },
    });
    if (campaign === null) {
      throw new CampaignNotFoundError();
    }

    if (isSuperUser) {
      return createCampaignScope(campaign, 'superuser');
    }

    if (discordUserId === null) {
      throw new CampaignAuthorizationError('A linked Discord account is required.');
    }

    const admin = await this.prisma.campaignAdmin.findUnique({
      where: {
        discordUserId_campaignId: {
          discordUserId,
          campaignId: campaign.id,
        },
      },
      select: { role: true },
    });
    if (admin === null) {
      throw new CampaignAuthorizationError();
    }

    return createCampaignScope(campaign, admin.role);
  }

  async requireResource(scope: CampaignScope, resource: CampaignResourceRef): Promise<void> {
    const directResourceArgs = {
      where: { id: resource.id, campaignId: scope.campaignId },
      select: { id: true } as const,
    };
    let record: { id: string } | null;

    switch (resource.kind) {
      case 'event':
        record = await this.prisma.event.findFirst(directResourceArgs);
        break;
      case 'channel':
        record = await this.prisma.channel.findFirst(directResourceArgs);
        break;
      case 'character':
        record = await this.prisma.character.findFirst(directResourceArgs);
        break;
      case 'npc':
        record = await this.prisma.npc.findFirst(directResourceArgs);
        break;
      case 'quest':
        record = await this.prisma.quest.findFirst(directResourceArgs);
        break;
      case 'session-summary':
        record = await this.prisma.sessionSummary.findFirst(directResourceArgs);
        break;
      case 'npc-fact':
        record = await this.prisma.npcFact.findFirst({
          where: {
            id: resource.id,
            npcId: resource.npcId,
            npc: { campaignId: scope.campaignId },
          },
          select: { id: true },
        });
        break;
      case 'quest-entry':
        record = await this.prisma.questEntry.findFirst({
          where: {
            id: resource.id,
            questId: resource.questId,
            quest: { campaignId: scope.campaignId },
          },
          select: { id: true },
        });
        break;
    }

    if (record === null) {
      throw new CampaignResourceNotFoundError();
    }
  }
}

export function createCampaignAccess(
  prisma: CampaignAccessPrisma = getPrismaClient(),
): CampaignAccess {
  return new PrismaCampaignAccess(prisma);
}

function createCampaignScope(campaign: CampaignRecord, role: CampaignScope['role']): CampaignScope {
  return Object.freeze({
    [campaignScopeBrand]: true as const,
    campaignId: campaign.id,
    discordGuildId: campaign.discordGuildId,
    gameSystemId: campaign.gameSystemId,
    role,
  });
}
