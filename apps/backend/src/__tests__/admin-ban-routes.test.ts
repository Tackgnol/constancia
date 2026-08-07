import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessContext } from '../auth/access-context.js';
import configPlugin from '../plugins/config-plugin.js';
import requestErrorPlugin from '../plugins/request-error-plugin.js';
import superUserScopePlugin from '../plugins/super-user-scope-plugin.js';
import { createTestBackendConfig } from './test-config.js';

const prismaMock = vi.hoisted(() => ({
  discordUserBan: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  campaign: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  eventDelivery: { updateMany: vi.fn() },
  $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
}));

vi.mock('../auth/prisma.js', () => ({ getPrismaClient: () => prismaMock }));
const { default: adminBanRoutes } = await import('../routes/admin-ban-routes.js');

const superUser: AccessContext = {
  kind: 'session',
  userId: 'user-super',
  email: 'operator@example.com',
  discordUserId: 'discord-operator',
  isSuperUser: true,
};
const plainUser: AccessContext = { ...superUser, userId: 'user-1', isSuperUser: false };

async function buildTestApp(access: AccessContext) {
  const app = Fastify({ logger: false });
  await app.register(configPlugin, { config: createTestBackendConfig() });
  await app.register(requestErrorPlugin);
  app.addHook('onRequest', async (request) => {
    request.access = access;
  });
  await app.register(superUserScopePlugin);
  await app.register(adminBanRoutes, { prefix: '/admin' });
  return app;
}

const banRow = {
  id: 'ban-1',
  discordUserId: 'discord-gm',
  internalNote: 'Third strike.',
  reasonShownToUser: null,
  bannedByUserId: 'user-super',
  createdAt: new Date('2026-08-06T00:00:00.000Z'),
};
let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.discordUserBan.upsert.mockResolvedValue(banRow);
  prismaMock.discordUserBan.findMany.mockResolvedValue([banRow]);
  prismaMock.discordUserBan.deleteMany.mockResolvedValue({ count: 1 });
  prismaMock.campaign.findUnique.mockResolvedValue({ id: 'campaign-1' });
  prismaMock.campaign.findMany.mockResolvedValue([]);
  prismaMock.campaign.update.mockResolvedValue({});
  prismaMock.eventDelivery.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(async () => app.close());

describe('admin bans and suspensions', () => {
  it('rejects non-superusers', async () => {
    app = await buildTestApp(plainUser);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/admin/bans',
          payload: { discordUserId: 'discord-gm', internalNote: 'Third strike.' },
        })
      ).statusCode,
    ).toBe(403);
  });

  it('upserts a ban with its issuer', async () => {
    app = await buildTestApp(superUser);
    const response = await app.inject({
      method: 'POST',
      url: '/admin/bans',
      payload: { discordUserId: 'discord-gm', internalNote: 'Third strike.' },
    });

    expect(response.statusCode).toBe(201);
    expect(prismaMock.discordUserBan.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ bannedByUserId: 'user-super' }),
        update: expect.objectContaining({ internalNote: 'Third strike.' }),
      }),
    );
  });

  it('requires an internal note and lifts idempotently', async () => {
    app = await buildTestApp(superUser);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/admin/bans',
          payload: { discordUserId: 'discord-gm' },
        })
      ).statusCode,
    ).toBe(400);
    expect((await app.inject({ method: 'DELETE', url: '/admin/bans/discord-gm' })).json()).toEqual({
      status: 'ok',
      deleted: true,
    });
  });

  it('disables a campaign and cancels queued deliveries atomically', async () => {
    app = await buildTestApp(superUser);
    const response = await app.inject({
      method: 'POST',
      url: '/admin/campaigns/campaign-1/disable',
      payload: {
        internalNote: 'Gore in a public channel.',
        publicReason: 'Suspended pending review.',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prismaMock.eventDelivery.updateMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['pending', 'failed'] },
        execution: { campaignId: 'campaign-1' },
      },
      data: { status: 'cancelled' },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it('404s a missing campaign and never replays cancelled deliveries', async () => {
    app = await buildTestApp(superUser);
    prismaMock.campaign.findUnique.mockResolvedValueOnce(null);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/admin/campaigns/missing/disable',
          payload: { internalNote: 'Missing.' },
        })
      ).statusCode,
    ).toBe(404);

    await app.inject({ method: 'POST', url: '/admin/campaigns/campaign-1/enable' });
    expect(prismaMock.eventDelivery.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.campaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ disabledAt: null }) }),
    );
  });
});
