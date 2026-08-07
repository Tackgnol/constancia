import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessContext } from '../auth/access-context.js';
import configPlugin from '../plugins/config-plugin.js';
import requestErrorPlugin from '../plugins/request-error-plugin.js';
import superUserScopePlugin from '../plugins/super-user-scope-plugin.js';
import { createTestBackendConfig } from './test-config.js';

const prismaMock = vi.hoisted(() => ({
  messageReport: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  campaign: { findMany: vi.fn() },
  event: { findMany: vi.fn() },
}));

vi.mock('../auth/prisma.js', () => ({ getPrismaClient: () => prismaMock }));
const { default: adminRoutes } = await import('../routes/admin-routes.js');

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
  await app.register(adminRoutes, { prefix: '/admin' });
  return app;
}

const reportRow = {
  id: 'report-1',
  eventId: 'event-1',
  campaignId: 'campaign-1',
  discordGuildId: 'guild-1',
  discordChannelId: 'discord-channel-1',
  discordMessageId: 'discord-message-1',
  discordUserId: 'discord-player',
  messageTarget: 'channel',
  messageContent: 'Something objectionable',
  imageUrl: null,
  status: 'pending',
  createdAt: new Date('2026-08-06T00:00:00.000Z'),
};

let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.messageReport.findMany.mockResolvedValue([reportRow]);
  prismaMock.messageReport.findUnique.mockResolvedValue({ id: 'report-1' });
  prismaMock.messageReport.update.mockResolvedValue({ ...reportRow, status: 'reviewed' });
  prismaMock.event.findMany.mockResolvedValue([]);
  prismaMock.campaign.findMany.mockResolvedValue([
    {
      id: 'campaign-1',
      name: 'Midnight Chronicle',
      disabledAt: null,
      admins: [{ discordUserId: 'discord-gm' }],
    },
  ]);
});

afterEach(async () => app.close());

describe('admin message reports', () => {
  it('rejects non-superusers', async () => {
    app = await buildTestApp(plainUser);
    expect((await app.inject({ method: 'GET', url: '/admin/message-reports' })).statusCode).toBe(
      403,
    );
  });

  it('filters reports and joins campaign context', async () => {
    app = await buildTestApp(superUser);
    const response = await app.inject({
      method: 'GET',
      url: '/admin/message-reports?status=dismissed',
    });

    expect(prismaMock.messageReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'dismissed' } }),
    );
    expect(response.json().data[0].campaign).toEqual({
      id: 'campaign-1',
      name: 'Midnight Chronicle',
      admins: ['discord-gm'],
    });
  });

  it('keeps reports whose campaign was deleted', async () => {
    prismaMock.campaign.findMany.mockResolvedValue([]);
    app = await buildTestApp(superUser);
    const response = await app.inject({ method: 'GET', url: '/admin/message-reports' });
    expect(response.json().data[0].campaign).toBeUndefined();
  });

  it('resolves legacy reports through their event when campaignId was not stored', async () => {
    prismaMock.messageReport.findMany.mockResolvedValue([{ ...reportRow, campaignId: null }]);
    prismaMock.event.findMany.mockResolvedValue([{ id: 'event-1', campaignId: 'campaign-1' }]);
    app = await buildTestApp(superUser);

    const response = await app.inject({ method: 'GET', url: '/admin/message-reports' });

    expect(response.json().data[0].campaign).toMatchObject({
      id: 'campaign-1',
      admins: ['discord-gm'],
    });
  });

  it('stamps the reviewer when triaging a report', async () => {
    app = await buildTestApp(superUser);
    const response = await app.inject({
      method: 'PATCH',
      url: '/admin/message-reports/report-1',
      payload: { status: 'reviewed' },
    });

    expect(response.statusCode).toBe(200);
    expect(prismaMock.messageReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'reviewed', reviewedByUserId: 'user-super' }),
      }),
    );
  });

  it('rejects unknown statuses and missing reports', async () => {
    app = await buildTestApp(superUser);
    expect(
      (await app.inject({ method: 'GET', url: '/admin/message-reports?status=nonsense' }))
        .statusCode,
    ).toBe(400);

    prismaMock.messageReport.findUnique.mockResolvedValue(null);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: '/admin/message-reports/missing',
          payload: { status: 'dismissed' },
        })
      ).statusCode,
    ).toBe(404);
  });
});
