import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessContext } from '../auth/access-context.js';
import configPlugin from '../plugins/config-plugin.js';
import requestErrorPlugin from '../plugins/request-error-plugin.js';
import { createTestBackendConfig } from './test-config.js';

const prismaMock = vi.hoisted(() => ({
  campaign: { findUnique: vi.fn(), create: vi.fn(), findUniqueOrThrow: vi.fn() },
  channel: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn() },
  discordUserBan: { findUnique: vi.fn() },
  event: { findUnique: vi.fn() },
  messageReport: { create: vi.fn() },
  campaignAdmin: { findUnique: vi.fn(), count: vi.fn(), upsert: vi.fn(), create: vi.fn() },
  character: { upsert: vi.fn(), delete: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('../auth/prisma.js', () => ({ getPrismaClient: () => prismaMock }));
const { default: botRoutes } = await import('../routes/bot-routes.js');

async function buildTestApp(access: AccessContext) {
  const app = Fastify({ logger: false });
  await app.register(configPlugin, { config: createTestBackendConfig() });
  await app.register(requestErrorPlugin);
  app.addHook('onRequest', async (request) => {
    request.access = access;
  });
  await app.register(botRoutes, { prefix: '/bot' });
  return app;
}

let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.discordUserBan.findUnique.mockResolvedValue(null);
  prismaMock.$transaction.mockImplementation((jobs: Promise<unknown>[]) => Promise.all(jobs));
});
afterEach(async () => app.close());

describe('bot setup moderation', () => {
  it('refuses to attach a channel to a disabled campaign', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({
      id: 'campaign-1',
      disabledAt: new Date('2026-08-06T00:00:00.000Z'),
      disabledPublicReason: 'Suspended pending review.',
    });
    app = await buildTestApp({ kind: 'bot' });

    const response = await app.inject({
      method: 'POST',
      url: '/bot/setup-channel',
      payload: {
        guildId: 'guild-1',
        guildName: 'Test Guild',
        discordChannelId: 'discord-channel-9',
        channelName: 'general',
        campaignName: 'Midnight Chronicle',
        gameSystemId: 'vtm-v5',
        discordUserId: 'discord-caller',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().data).toMatchObject({
      code: 'ACCESS_REVOKED',
      message: 'Suspended pending review.',
    });
    expect(prismaMock.campaign.create).not.toHaveBeenCalled();
  });

  it('checks a ban before a campaign suspension for every Discord interaction', async () => {
    prismaMock.discordUserBan.findUnique.mockResolvedValue({
      reasonShownToUser: 'Repeated harassment.',
    });
    prismaMock.campaign.findUnique.mockResolvedValue({
      disabledAt: new Date('2026-08-06T00:00:00.000Z'),
      disabledPublicReason: 'Suspended pending review.',
    });
    app = await buildTestApp({ kind: 'bot' });

    const response = await app.inject({
      method: 'POST',
      url: '/bot/access',
      payload: { discordUserId: 'discord-gm', guildId: 'guild-1' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().data.message).toBe('Repeated harassment.');
    expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled();
  });

  it('stores campaign attribution resolved from the reported event', async () => {
    prismaMock.event.findUnique.mockResolvedValue({ campaignId: 'campaign-1' });
    prismaMock.messageReport.create.mockResolvedValue({
      id: 'report-1',
      eventId: 'event-1',
      campaignId: 'campaign-1',
      discordGuildId: 'guild-1',
      discordChannelId: 'channel-1',
      discordMessageId: 'message-1',
      discordUserId: 'discord-player',
      messageTarget: 'channel',
      messageContent: 'Reported output',
      imageUrl: null,
      status: 'pending',
      createdAt: new Date('2026-08-06T00:00:00.000Z'),
    });
    app = await buildTestApp({ kind: 'bot' });

    const response = await app.inject({
      method: 'POST',
      url: '/bot/message-reports',
      payload: {
        eventId: 'event-1',
        discordGuildId: 'guild-1',
        discordUserId: 'discord-player',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(prismaMock.messageReport.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ campaignId: 'campaign-1' }) }),
    );
  });
});

describe('bot GM authorization', () => {
  const setupPayload = {
    guildId: 'guild-1',
    guildName: 'Test Guild',
    discordChannelId: 'discord-channel-9',
    channelName: 'general',
    campaignName: 'Midnight Chronicle',
    gameSystemId: 'vtm-v5',
    discordUserId: 'discord-caller',
  };

  it('bootstraps the caller as owner on a brand-new campaign', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(null);
    prismaMock.campaign.create.mockResolvedValue({
      id: 'campaign-1',
      name: 'Midnight Chronicle',
      discordGuildId: 'guild-1',
      gameSystemId: 'vtm-v5',
      gameDate: null,
    });
    prismaMock.channel.findUnique.mockResolvedValue(null);
    prismaMock.channel.upsert.mockResolvedValue({
      id: 'channel-1',
      name: 'general',
      discordChannelId: 'discord-channel-9',
      campaignId: 'campaign-1',
      type: 'main',
    });
    app = await buildTestApp({ kind: 'bot' });

    const response = await app.inject({
      method: 'POST',
      url: '/bot/setup-channel',
      payload: setupPayload,
    });

    expect(response.statusCode).toBe(200);
    expect(prismaMock.campaignAdmin.upsert).toHaveBeenCalledWith({
      where: {
        discordUserId_campaignId: { discordUserId: 'discord-caller', campaignId: 'campaign-1' },
      },
      create: { discordUserId: 'discord-caller', campaignId: 'campaign-1', role: 'owner' },
      update: {},
    });
  });

  it('rejects a non-admin re-running /setup on an existing campaign', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({
      id: 'campaign-1',
      disabledAt: null,
      disabledPublicReason: null,
    });
    prismaMock.campaignAdmin.count.mockResolvedValue(1);
    prismaMock.campaignAdmin.findUnique.mockResolvedValue(null);
    app = await buildTestApp({ kind: 'bot' });

    const response = await app.inject({
      method: 'POST',
      url: '/bot/setup-channel',
      payload: setupPayload,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().data.code).toBe('CAMPAIGN_ADMIN_REQUIRED');
    expect(prismaMock.campaignAdmin.upsert).not.toHaveBeenCalled();
    expect(prismaMock.channel.upsert).not.toHaveBeenCalled();
  });

  it('allows an existing admin to re-run /setup without re-creating the admin row', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({
      id: 'campaign-1',
      disabledAt: null,
      disabledPublicReason: null,
    });
    prismaMock.campaign.findUniqueOrThrow.mockResolvedValue({
      id: 'campaign-1',
      name: 'Midnight Chronicle',
      discordGuildId: 'guild-1',
      gameSystemId: 'vtm-v5',
      gameDate: null,
    });
    prismaMock.campaignAdmin.count.mockResolvedValue(1);
    prismaMock.campaignAdmin.findUnique.mockResolvedValue({ role: 'owner' });
    prismaMock.channel.findUnique.mockResolvedValue({ id: 'channel-1' });
    prismaMock.channel.upsert.mockResolvedValue({
      id: 'channel-1',
      name: 'general',
      discordChannelId: 'discord-channel-9',
      campaignId: 'campaign-1',
      type: 'main',
    });
    app = await buildTestApp({ kind: 'bot' });

    const response = await app.inject({
      method: 'POST',
      url: '/bot/setup-channel',
      payload: setupPayload,
    });

    expect(response.statusCode).toBe(200);
    expect(prismaMock.campaignAdmin.upsert).not.toHaveBeenCalled();
  });

  it('rejects a non-admin trying to sync participants', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({ id: 'campaign-1' });
    prismaMock.campaignAdmin.findUnique.mockResolvedValue(null);
    app = await buildTestApp({ kind: 'bot' });

    const response = await app.inject({
      method: 'POST',
      url: '/bot/sync-participants',
      payload: {
        guildId: 'guild-1',
        participants: [{ discordUserId: 'discord-player', discordName: 'Player' }],
        callerDiscordUserId: 'discord-outsider',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().data.code).toBe('CAMPAIGN_ADMIN_REQUIRED');
    expect(prismaMock.character.upsert).not.toHaveBeenCalled();
  });

  it('rejects a non-admin trying to remove a participant', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({ id: 'campaign-1' });
    prismaMock.campaignAdmin.findUnique.mockResolvedValue(null);
    app = await buildTestApp({ kind: 'bot' });

    const response = await app.inject({
      method: 'DELETE',
      url: '/bot/participant/guild-1/discord-player?callerDiscordUserId=discord-outsider',
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().data.code).toBe('CAMPAIGN_ADMIN_REQUIRED');
    expect(prismaMock.character.delete).not.toHaveBeenCalled();
  });
});
