import type { AccessContext } from '../auth/access-context.js';
import { getPrismaClient } from '../auth/prisma.js';
import {
  assertCampaignActive,
  assertNotBanned,
  type BanLookupPrisma,
} from './moderation-enforcement.js';

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
  disabledAt: Date | null;
  disabledPublicReason: string | null;
}

interface CampaignAdminRecord {
  role: 'owner' | 'gm';
}

export interface CampaignAccessPrisma {
  campaign: {
    findUnique(args: {
      where: { id: string };
      select: {
        id: true;
        discordGuildId: true;
        gameSystemId: true;
        disabledAt: true;
        disabledPublicReason: true;
      };
    }): Promise<CampaignRecord | null>;
  };
  campaignAdmin: {
    findUnique(args: {
      where: { discordUserId_campaignId: { discordUserId: string; campaignId: string } };
      select: { role: true };
    }): Promise<CampaignAdminRecord | null>;
  };
  discordUserBan: BanLookupPrisma['discordUserBan'];
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
  loreEntry: {
    findFirst(args: {
      where: { id: string; campaignId: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  scene: {
    findFirst(args: {
      where: { id: string; campaignId: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  scenePeg: {
    findFirst(args: {
      where: { id: string; sceneId: string; scene: { campaignId: string } };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
}

export type CampaignResourceRef =
  | {
      kind:
        | 'event'
        | 'channel'
        | 'character'
        | 'npc'
        | 'quest'
        | 'session-summary'
        | 'lore'
        | 'scene';
      id: string;
    }
  | { kind: 'npc-fact'; id: string; npcId: string }
  | { kind: 'quest-entry'; id: string; questId: string }
  | { kind: 'scene-peg'; id: string; sceneId: string };

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

export class CampaignAdminRequiredError extends Error {
  readonly statusCode = 403;
  readonly code = 'CAMPAIGN_ADMIN_REQUIRED';

  constructor(
    message = "You're not a GM for this campaign. Ask the GM who ran /setup to add you.",
  ) {
    super(message);
    this.name = 'CampaignAdminRequiredError';
  }
}

export interface BotCampaignAdminPrisma {
  campaignAdmin: {
    findUnique(args: {
      where: { discordUserId_campaignId: { discordUserId: string; campaignId: string } };
      select: { role: true };
    }): Promise<{ role: 'owner' | 'gm' } | null>;
  };
}

// Bot-side authorization boundary: gates /setup, /login, and /participants
// against an existing CampaignAdmin row for the calling Discord user. Unlike
// requireAdmin above, this has no web session — the caller's identity comes
// straight from the verified Discord interaction relayed by the bot.
export async function requireBotCampaignAdmin(
  prisma: BotCampaignAdminPrisma,
  discordUserId: string,
  campaignId: string,
): Promise<void> {
  const admin = await prisma.campaignAdmin.findUnique({
    where: { discordUserId_campaignId: { discordUserId, campaignId } },
    select: { role: true },
  });

  if (admin === null) {
    throw new CampaignAdminRequiredError();
  }
}

export interface MagicLinkCampaignAdminPrisma extends BotCampaignAdminPrisma {
  campaignAdmin: BotCampaignAdminPrisma['campaignAdmin'] & {
    count(args: { where: { campaignId: string } }): Promise<number>;
    create(args: {
      data: { discordUserId: string; campaignId: string; role: 'owner' };
    }): Promise<unknown>;
  };
}

// The sole GM-granting moment: a campaign with no admin yet bootstraps
// whoever logs in first as owner. A campaign that already has an admin never
// auto-grants — the caller must already hold a CampaignAdmin row.
export async function ensureMagicLinkCampaignAdmin(
  prisma: MagicLinkCampaignAdminPrisma,
  discordUserId: string,
  campaignId: string,
): Promise<void> {
  const admin = await prisma.campaignAdmin.findUnique({
    where: { discordUserId_campaignId: { discordUserId, campaignId } },
    select: { role: true },
  });

  if (admin !== null) {
    return;
  }

  const existingAdminCount = await prisma.campaignAdmin.count({ where: { campaignId } });

  if (existingAdminCount > 0) {
    throw new CampaignAdminRequiredError();
  }

  await prisma.campaignAdmin.create({
    data: { discordUserId, campaignId, role: 'owner' },
  });
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
      select: {
        id: true,
        discordGuildId: true,
        gameSystemId: true,
        disabledAt: true,
        disabledPublicReason: true,
      },
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

    await assertNotBanned(this.prisma, discordUserId);

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

    assertCampaignActive(campaign);

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
      case 'lore':
        record = await this.prisma.loreEntry.findFirst(directResourceArgs);
        break;
      case 'scene':
        record = await this.prisma.scene.findFirst(directResourceArgs);
        break;
      case 'scene-peg':
        record = await this.prisma.scenePeg.findFirst({
          where: {
            id: resource.id,
            sceneId: resource.sceneId,
            scene: { campaignId: scope.campaignId },
          },
          select: { id: true },
        });
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
