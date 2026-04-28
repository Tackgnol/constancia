import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { getPrismaClient } from '../auth/prisma.js';

const appsToClose: Array<Awaited<ReturnType<typeof buildApp>>> = [];
const runDatabaseIntegrationTests =
  process.env.CONSTANCIA_ENABLE_DB_TESTS === 'true' && typeof process.env.DATABASE_URL === 'string';
const describeDatabase = runDatabaseIntegrationTests ? describe : describe.skip;

function createTestConfig() {
  return {
    host: '127.0.0.1',
    port: 3000,
    nodeEnv: 'test',
    apiPrefix: '/api/v1',
    docsPrefix: '/documentation',
    openApiPath: '/openapi.json',
    frontendUrl: 'http://localhost:3000',
    betterAuthSecret: 'constancia-test-secret-12345678901234567890',
    betterAuthUrl: 'http://localhost:3001',
    betterAuthPath: '/api/auth',
    discordClientId: undefined,
    discordClientSecret: undefined,
    magicLinkFrontendPath: '/auth',
    botApiKey: 'constancia-bot-dev-key',
    botInternalUrl: 'http://localhost:3002',
  };
}

afterEach(async () => {
  await Promise.all(appsToClose.splice(0).map((app) => app.close()));
});

describeDatabase('backend app database integration', () => {
  beforeEach(async () => {
    const prisma = getPrismaClient();
    await prisma.channel.deleteMany({
      where: { discordChannelId: { in: ['dc-setup-1', 'dc-idem-1'] } },
    });
    await prisma.campaign.deleteMany({
      where: { discordGuildId: { in: ['test-guild-setup', 'test-guild-idem'] } },
    });
  });

  it('POST /bot/setup-channel returns 200 with campaign and channel when authenticated', async () => {
    const app = await buildApp({ config: createTestConfig() });
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/bot/setup-channel',
      headers: { 'x-bot-key': 'constancia-bot-dev-key' },
      payload: {
        guildId: 'test-guild-setup',
        guildName: 'Test Guild',
        discordChannelId: 'dc-setup-1',
        channelName: 'general',
        campaignName: 'Setup Campaign',
        gameSystemId: 'vtm-v5',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.data.campaign.discordGuildId).toBe('test-guild-setup');
    expect(body.data.campaign.name).toBe('Setup Campaign');
    expect(body.data.channel.discordChannelId).toBe('dc-setup-1');
    expect(body.data.channel.name).toBe('general');
    expect(body.data.created.campaign).toBe(true);
    expect(body.data.created.channel).toBe(true);
  });

  it('POST /bot/setup-channel is idempotent — second call returns created: false', async () => {
    const app = await buildApp({ config: createTestConfig() });
    appsToClose.push(app);

    const payload = {
      guildId: 'test-guild-idem',
      guildName: 'Test Guild',
      discordChannelId: 'dc-idem-1',
      channelName: 'general',
      campaignName: 'Idem Campaign',
      gameSystemId: 'vtm-v5',
    };

    await app.inject({
      method: 'POST',
      url: '/api/v1/bot/setup-channel',
      headers: { 'x-bot-key': 'constancia-bot-dev-key' },
      payload,
    });

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/bot/setup-channel',
      headers: { 'x-bot-key': 'constancia-bot-dev-key' },
      payload,
    });

    expect(second.statusCode).toBe(200);
    expect(second.json().data.created.campaign).toBe(false);
    expect(second.json().data.created.channel).toBe(false);
  });
});
