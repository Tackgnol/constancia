import { describe, expect, it, vi } from 'vitest';
import type { SessionAccessContext } from '../auth/access-context.js';
import {
  CampaignAdminRequiredError,
  CampaignAuthenticationError,
  CampaignAuthorizationError,
  CampaignNotFoundError,
  CampaignResourceNotFoundError,
  createCampaignAccess,
  ensureMagicLinkCampaignAdmin,
  requireBotCampaignAdmin,
  type CampaignAccessPrisma,
  type MagicLinkCampaignAdminPrisma,
} from '../services/campaign-access.js';

const campaign = {
  id: 'campaign-1',
  discordGuildId: 'guild-1',
  gameSystemId: 'vtm-v5',
  disabledAt: null as Date | null,
  disabledPublicReason: null as string | null,
};

function session(overrides: Partial<SessionAccessContext> = {}): SessionAccessContext {
  return {
    kind: 'session',
    userId: 'user-1',
    email: 'gm@example.com',
    discordUserId: 'discord-gm',
    isSuperUser: false,
    ...overrides,
  };
}

function createPrismaMock(
  overrides: {
    campaign?: typeof campaign | null;
    admin?: { role: 'owner' | 'gm' } | null;
    event?: { id: string } | null;
    channel?: { id: string } | null;
    character?: { id: string } | null;
    npc?: { id: string } | null;
    npcFact?: { id: string } | null;
    quest?: { id: string } | null;
    questEntry?: { id: string } | null;
    sessionSummary?: { id: string } | null;
    loreEntry?: { id: string } | null;
    scene?: { id: string } | null;
    scenePeg?: { id: string } | null;
    ban?: { reasonShownToUser: string | null } | null;
  } = {},
): CampaignAccessPrisma {
  return {
    campaign: {
      findUnique: vi
        .fn()
        .mockResolvedValue('campaign' in overrides ? overrides.campaign : campaign),
    },
    campaignAdmin: {
      findUnique: vi
        .fn()
        .mockResolvedValue('admin' in overrides ? overrides.admin : { role: 'gm' }),
    },
    discordUserBan: {
      findUnique: vi.fn().mockResolvedValue('ban' in overrides ? overrides.ban : null),
    },
    event: {
      findFirst: vi
        .fn()
        .mockResolvedValue('event' in overrides ? overrides.event : { id: 'event-1' }),
    },
    channel: {
      findFirst: vi
        .fn()
        .mockResolvedValue('channel' in overrides ? overrides.channel : { id: 'channel-1' }),
    },
    character: {
      findFirst: vi
        .fn()
        .mockResolvedValue('character' in overrides ? overrides.character : { id: 'character-1' }),
    },
    npc: {
      findFirst: vi.fn().mockResolvedValue('npc' in overrides ? overrides.npc : { id: 'npc-1' }),
    },
    npcFact: {
      findFirst: vi
        .fn()
        .mockResolvedValue('npcFact' in overrides ? overrides.npcFact : { id: 'fact-1' }),
    },
    quest: {
      findFirst: vi
        .fn()
        .mockResolvedValue('quest' in overrides ? overrides.quest : { id: 'quest-1' }),
    },
    questEntry: {
      findFirst: vi
        .fn()
        .mockResolvedValue('questEntry' in overrides ? overrides.questEntry : { id: 'entry-1' }),
    },
    sessionSummary: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          'sessionSummary' in overrides ? overrides.sessionSummary : { id: 'summary-1' },
        ),
    },
    loreEntry: {
      findFirst: vi
        .fn()
        .mockResolvedValue('loreEntry' in overrides ? overrides.loreEntry : { id: 'lore-1' }),
    },
    scene: {
      findFirst: vi
        .fn()
        .mockResolvedValue('scene' in overrides ? overrides.scene : { id: 'scene-1' }),
    },
    scenePeg: {
      findFirst: vi
        .fn()
        .mockResolvedValue('scenePeg' in overrides ? overrides.scenePeg : { id: 'peg-1' }),
    },
  };
}

describe('CampaignAccess', () => {
  it('returns an immutable scope for a campaign admin', async () => {
    const scope = await createCampaignAccess(createPrismaMock()).requireAdmin(
      session(),
      'campaign-1',
    );

    expect(scope).toMatchObject({ campaignId: 'campaign-1', role: 'gm' });
    expect(Object.isFrozen(scope)).toBe(true);
  });

  it('allows a superuser without requiring a CampaignAdmin row', async () => {
    const prisma = createPrismaMock({ admin: null });
    const scope = await createCampaignAccess(prisma).requireAdmin(
      session({ isSuperUser: true, discordUserId: null }),
      'campaign-1',
    );

    expect(scope.role).toBe('superuser');
    expect(prisma.campaignAdmin.findUnique).not.toHaveBeenCalled();
  });

  it('rejects bot credentials and unlinked sessions', async () => {
    const prisma = createPrismaMock();
    const access = createCampaignAccess(prisma);

    await expect(access.requireAdmin({ kind: 'bot' }, 'campaign-1')).rejects.toBeInstanceOf(
      CampaignAuthenticationError,
    );
    await expect(
      access.requireAdmin(session({ discordUserId: null }), 'campaign-1'),
    ).rejects.toBeInstanceOf(CampaignAuthorizationError);
    expect(prisma.campaign.findUnique).not.toHaveBeenCalled();
  });

  it('distinguishes a missing campaign from denied administration', async () => {
    await expect(
      createCampaignAccess(createPrismaMock({ campaign: null })).requireAdmin(session(), 'missing'),
    ).rejects.toBeInstanceOf(CampaignNotFoundError);
    await expect(
      createCampaignAccess(createPrismaMock({ admin: null })).requireAdmin(session(), 'campaign-1'),
    ).rejects.toBeInstanceOf(CampaignAuthorizationError);
  });

  it('maps missing and cross-campaign child identifiers to the same not-found error', async () => {
    const access = createCampaignAccess(createPrismaMock({ event: null }));
    const scope = await access.requireAdmin(session(), 'campaign-1');

    await expect(
      access.requireResource(scope, { kind: 'event', id: 'event-from-another-campaign' }),
    ).rejects.toBeInstanceOf(CampaignResourceNotFoundError);
  });

  it('checks directly owned Campaign resources with campaignId in the query', async () => {
    const prisma = createPrismaMock();
    const access = createCampaignAccess(prisma);
    const scope = await access.requireAdmin(session(), 'campaign-1');

    await access.requireResource(scope, { kind: 'channel', id: 'channel-1' });
    await access.requireResource(scope, { kind: 'character', id: 'character-1' });
    await access.requireResource(scope, { kind: 'npc', id: 'npc-1' });
    await access.requireResource(scope, { kind: 'quest', id: 'quest-1' });
    await access.requireResource(scope, { kind: 'session-summary', id: 'summary-1' });
    await access.requireResource(scope, { kind: 'lore', id: 'lore-1' });
    await access.requireResource(scope, { kind: 'scene', id: 'scene-1' });

    const expectedQuery = (id: string) => ({
      where: { id, campaignId: 'campaign-1' },
      select: { id: true },
    });
    expect(prisma.channel.findFirst).toHaveBeenCalledWith(expectedQuery('channel-1'));
    expect(prisma.character.findFirst).toHaveBeenCalledWith(expectedQuery('character-1'));
    expect(prisma.npc.findFirst).toHaveBeenCalledWith(expectedQuery('npc-1'));
    expect(prisma.quest.findFirst).toHaveBeenCalledWith(expectedQuery('quest-1'));
    expect(prisma.sessionSummary.findFirst).toHaveBeenCalledWith(expectedQuery('summary-1'));
    expect(prisma.loreEntry.findFirst).toHaveBeenCalledWith(expectedQuery('lore-1'));
    expect(prisma.scene.findFirst).toHaveBeenCalledWith(expectedQuery('scene-1'));
  });

  it('checks a Scene Peg through both its Scene and Campaign', async () => {
    const prisma = createPrismaMock();
    const access = createCampaignAccess(prisma);
    const scope = await access.requireAdmin(session(), 'campaign-1');

    await access.requireResource(scope, { kind: 'scene-peg', id: 'peg-1', sceneId: 'scene-1' });

    expect(prisma.scenePeg.findFirst).toHaveBeenCalledWith({
      where: { id: 'peg-1', sceneId: 'scene-1', scene: { campaignId: 'campaign-1' } },
      select: { id: true },
    });
  });

  it('hides a scene, peg, or lore entry from another campaign behind the same not-found error', async () => {
    const access = createCampaignAccess(
      createPrismaMock({ scene: null, scenePeg: null, loreEntry: null }),
    );
    const scope = await access.requireAdmin(session(), 'campaign-1');

    await expect(
      access.requireResource(scope, { kind: 'scene', id: 'rival-scene' }),
    ).rejects.toBeInstanceOf(CampaignResourceNotFoundError);
    await expect(
      access.requireResource(scope, { kind: 'scene-peg', id: 'rival-peg', sceneId: 'rival-scene' }),
    ).rejects.toBeInstanceOf(CampaignResourceNotFoundError);
    await expect(
      access.requireResource(scope, { kind: 'lore', id: 'rival-lore' }),
    ).rejects.toBeInstanceOf(CampaignResourceNotFoundError);
  });

  it('checks an NPC Fact through both its NPC and Campaign', async () => {
    const prisma = createPrismaMock();
    const access = createCampaignAccess(prisma);
    const scope = await access.requireAdmin(session(), 'campaign-1');

    await access.requireResource(scope, { kind: 'npc-fact', id: 'fact-1', npcId: 'npc-1' });

    expect(prisma.npcFact.findFirst).toHaveBeenCalledWith({
      where: { id: 'fact-1', npcId: 'npc-1', npc: { campaignId: 'campaign-1' } },
      select: { id: true },
    });
  });

  it('checks a Quest Entry through both its Quest and Campaign', async () => {
    const prisma = createPrismaMock();
    const access = createCampaignAccess(prisma);
    const scope = await access.requireAdmin(session(), 'campaign-1');

    await access.requireResource(scope, {
      kind: 'quest-entry',
      id: 'entry-1',
      questId: 'quest-1',
    });

    expect(prisma.questEntry.findFirst).toHaveBeenCalledWith({
      where: { id: 'entry-1', questId: 'quest-1', quest: { campaignId: 'campaign-1' } },
      select: { id: true },
    });
  });
});

describe('requireAdmin moderation guards', () => {
  it('blocks a banned GM with the ban reason', async () => {
    const access = createCampaignAccess(
      createPrismaMock({ ban: { reasonShownToUser: 'Repeated harassment.' } }),
    );

    await expect(access.requireAdmin(session(), 'campaign-1')).rejects.toThrow(
      'Repeated harassment.',
    );
  });

  it('blocks an admin of a disabled campaign with the public reason', async () => {
    const access = createCampaignAccess(
      createPrismaMock({
        campaign: {
          ...campaign,
          disabledAt: new Date('2026-08-06T00:00:00.000Z'),
          disabledPublicReason: 'Suspended pending review.',
        },
      }),
    );

    await expect(access.requireAdmin(session(), 'campaign-1')).rejects.toThrow(
      'Suspended pending review.',
    );
  });

  it('prefers the ban reason when both guards apply', async () => {
    const access = createCampaignAccess(
      createPrismaMock({
        ban: { reasonShownToUser: 'Repeated harassment.' },
        campaign: {
          ...campaign,
          disabledAt: new Date('2026-08-06T00:00:00.000Z'),
          disabledPublicReason: 'Suspended pending review.',
        },
      }),
    );

    await expect(access.requireAdmin(session(), 'campaign-1')).rejects.toThrow(
      'Repeated harassment.',
    );
  });

  it('lets a superuser reverse either action', async () => {
    const access = createCampaignAccess(
      createPrismaMock({
        ban: { reasonShownToUser: 'Repeated harassment.' },
        campaign: {
          ...campaign,
          disabledAt: new Date('2026-08-06T00:00:00.000Z'),
          disabledPublicReason: 'Suspended pending review.',
        },
      }),
    );

    const scope = await access.requireAdmin(
      session({ isSuperUser: true, discordUserId: 'discord-gm' }),
      'campaign-1',
    );

    expect(scope.role).toBe('superuser');
  });
});

describe('requireBotCampaignAdmin', () => {
  function adminPrismaMock(admin: { role: 'owner' | 'gm' } | null) {
    return { campaignAdmin: { findUnique: vi.fn().mockResolvedValue(admin) } };
  }

  it('resolves when the caller already holds a CampaignAdmin row', async () => {
    const prisma = adminPrismaMock({ role: 'gm' });

    await expect(
      requireBotCampaignAdmin(prisma, 'discord-gm', 'campaign-1'),
    ).resolves.toBeUndefined();
  });

  it('throws CampaignAdminRequiredError when the caller has no CampaignAdmin row', async () => {
    const prisma = adminPrismaMock(null);

    await expect(requireBotCampaignAdmin(prisma, 'discord-outsider', 'campaign-1')).rejects.toThrow(
      CampaignAdminRequiredError,
    );
  });
});

describe('ensureMagicLinkCampaignAdmin', () => {
  function magicLinkPrismaMock(overrides: {
    admin?: { role: 'owner' | 'gm' } | null;
    existingAdminCount?: number;
  }): MagicLinkCampaignAdminPrisma {
    return {
      campaignAdmin: {
        findUnique: vi.fn().mockResolvedValue(overrides.admin ?? null),
        count: vi.fn().mockResolvedValue(overrides.existingAdminCount ?? 0),
        create: vi.fn().mockResolvedValue(undefined),
      },
    };
  }

  it('bootstraps the caller as owner when the campaign has no admin yet', async () => {
    const prisma = magicLinkPrismaMock({ admin: null, existingAdminCount: 0 });

    await ensureMagicLinkCampaignAdmin(prisma, 'discord-first-gm', 'campaign-1');

    expect(prisma.campaignAdmin.create).toHaveBeenCalledWith({
      data: { discordUserId: 'discord-first-gm', campaignId: 'campaign-1', role: 'owner' },
    });
  });

  it('resolves without creating a row when the caller is already an admin', async () => {
    const prisma = magicLinkPrismaMock({ admin: { role: 'gm' }, existingAdminCount: 1 });

    await ensureMagicLinkCampaignAdmin(prisma, 'discord-gm', 'campaign-1');

    expect(prisma.campaignAdmin.create).not.toHaveBeenCalled();
  });

  it('rejects an ordinary member when the campaign already has an admin', async () => {
    const prisma = magicLinkPrismaMock({ admin: null, existingAdminCount: 1 });

    await expect(
      ensureMagicLinkCampaignAdmin(prisma, 'discord-outsider', 'campaign-1'),
    ).rejects.toThrow(CampaignAdminRequiredError);
    expect(prisma.campaignAdmin.create).not.toHaveBeenCalled();
  });
});
