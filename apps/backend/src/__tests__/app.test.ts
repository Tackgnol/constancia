import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';

const appsToClose: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(appsToClose.splice(0).map((app) => app.close()));
});

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
    backendPublicUrl: 'http://localhost:3001',
    openAiApiKey: undefined,
    contentModerationEnabled: false,
    contentModerationModel: 'omni-moderation-latest',
    contentModerationFailClosed: true,
    uploadStorageDriver: 'local' as const,
    uploadStorageDir: 'data/test-uploads',
    uploadMaxBytes: 5 * 1024 * 1024,
    uploadImageMaxDimension: 1024,
    uploadWebpQuality: 80,
    uploadDefaultEnabled: false,
    uploadDefaultAllowanceBytes: 50 * 1024 * 1024,
    uploadQuotaWarningPercent: 80,
    uploadPublicBaseUrl: undefined,
    r2Endpoint: undefined,
    r2AccessKeyId: undefined,
    r2SecretAccessKey: undefined,
    r2Bucket: undefined,
  };
}

describe('backend app', () => {
  it('serves service metadata and docs endpoints', async () => {
    const app = await buildApp({ config: createTestConfig() });
    appsToClose.push(app);

    const rootResponse = await app.inject({ method: 'GET', url: '/' });
    const openApiResponse = await app.inject({ method: 'GET', url: '/openapi.json' });
    const swaggerUiResponse = await app.inject({ method: 'GET', url: '/documentation/' });

    expect(rootResponse.statusCode).toBe(200);
    expect(rootResponse.json()).toEqual({
      name: 'constancia-backend',
      status: 'ready',
      apiPrefix: '/api/v1',
      docsPrefix: '/documentation',
      openApiPath: '/openapi.json',
    });

    expect(openApiResponse.statusCode).toBe(200);
    expect(openApiResponse.json().openapi).toBe('3.0.3');

    expect(swaggerUiResponse.statusCode).toBe(200);
    expect(swaggerUiResponse.headers['content-type']).toContain('text/html');
  });

  it('publishes an OpenAPI document with the design-doc paths', async () => {
    const app = await buildApp({ config: createTestConfig() });
    appsToClose.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/openapi.json',
    });

    const document = response.json();
    const paths = Object.keys(document.paths);

    expect(paths).toEqual(
      expect.arrayContaining([
        '/',
        '/health',
        '/openapi.json',
        '/api/v1/auth/magic-link',
        '/api/v1/auth/player-sheet-link',
        '/api/v1/auth/verify',
        '/api/v1/auth/logout',
        '/api/v1/users/me/upload-settings',
        '/api/v1/uploads/{assetId}',
        '/api/v1/uploads/image',
        '/api/v1/campaigns/',
        '/api/v1/campaigns/{id}',
        '/api/v1/campaigns/{id}/channels/',
        '/api/v1/campaigns/{id}/channels/{chanId}',
        '/api/v1/campaigns/{id}/characters/',
        '/api/v1/campaigns/{id}/characters/{charId}',
        '/api/v1/campaigns/{id}/characters/{charId}/sheet',
        '/api/v1/campaigns/{id}/npcs/',
        '/api/v1/campaigns/{id}/npcs/{npcId}',
        '/api/v1/campaigns/{id}/npcs/{npcId}/facts',
        '/api/v1/campaigns/{id}/npcs/{npcId}/reveal',
        '/api/v1/campaigns/{id}/player-character/sheet',
        '/api/v1/campaigns/{id}/player-npcs/',
        '/api/v1/campaigns/{id}/player-npcs/{npcId}',
        '/api/v1/campaigns/{id}/events/',
        '/api/v1/campaigns/{id}/events/{eventId}',
        '/api/v1/campaigns/{id}/events/{eventId}/fire',
        '/api/v1/campaigns/{id}/messages/players',
        '/api/v1/campaigns/{id}/quests',
        '/api/v1/campaigns/{id}/quests/{questId}',
        '/api/v1/campaigns/{id}/quests/{questId}/entries',
        '/api/v1/campaigns/{id}/quests/{questId}/entries/{entryId}',
        '/api/v1/campaigns/{id}/lore/',
        '/api/v1/campaigns/{id}/lore/{loreId}',
        '/api/v1/campaigns/{id}/lore/{loreId}/reveal',
        '/api/v1/campaigns/{id}/summaries',
        '/api/v1/campaigns/{id}/summaries/{sumId}',
        '/api/v1/campaigns/{id}/journal/for/{discordId}',
        '/api/v1/bot/test-result',
        '/api/v1/bot/campaign-by-guild/{guildId}',
        '/api/v1/bot/campaigns/{id}/visible-npcs/{discordUserId}',
        '/api/v1/bot/channel-events/{channelId}',
        '/api/v1/bot/setup-channel',
        '/api/v1/systems/',
        '/api/v1/systems/{id}',
      ]),
    );

    expect(document.paths['/api/v1/campaigns/{id}/events/{eventId}/fire'].post.operationId).toBe(
      'fireEvent',
    );
    expect(document.paths['/api/v1/systems/'].get.operationId).toBe('listGameSystems');
  });

  it('serves the design-doc endpoint surface with stable statuses', async () => {
    const app = await buildApp({ config: createTestConfig() });
    appsToClose.push(app);

    const cases = [
      { method: 'GET', url: '/health', statusCode: 200 },
      {
        method: 'POST',
        url: '/api/v1/auth/magic-link',
        statusCode: 401,
        payload: { discordUserId: 'user-1', guildId: 'guild-1' },
      },
      {
        method: 'POST',
        url: '/api/v1/auth/player-sheet-link',
        statusCode: 401,
        payload: { discordUserId: 'user-1', guildId: 'guild-1' },
      },
      { method: 'GET', url: '/api/v1/auth/verify?token=abc123', statusCode: 200 },
      { method: 'POST', url: '/api/v1/auth/logout', statusCode: 200 },
      { method: 'GET', url: '/api/v1/campaigns', statusCode: 401 },
      { method: 'GET', url: '/api/v1/users/me/upload-settings', statusCode: 401 },
      { method: 'GET', url: '/api/v1/uploads/not-a-real-asset', statusCode: 404 },
      { method: 'POST', url: '/api/v1/uploads/image', statusCode: 401 },
      {
        method: 'POST',
        url: '/api/v1/campaigns',
        statusCode: 401,
        payload: { name: 'New Campaign', discordGuildId: 'guild-2', gameSystemId: 'vtm-v5' },
      },
      { method: 'GET', url: '/api/v1/campaigns/campaign-1', statusCode: 401 },
      {
        method: 'PATCH',
        url: '/api/v1/campaigns/campaign-1',
        statusCode: 401,
        payload: { name: 'Updated Campaign' },
      },
      { method: 'GET', url: '/api/v1/campaigns/campaign-1/channels', statusCode: 401 },
      {
        method: 'POST',
        url: '/api/v1/campaigns/campaign-1/channels',
        statusCode: 401,
        payload: { name: 'session-room', discordChannelId: 'discord-channel-1' },
      },
      {
        method: 'PATCH',
        url: '/api/v1/campaigns/campaign-1/channels/channel-1',
        statusCode: 401,
        payload: { name: 'main-room' },
      },
      {
        method: 'DELETE',
        url: '/api/v1/campaigns/campaign-1/channels/channel-1',
        statusCode: 401,
      },
      { method: 'GET', url: '/api/v1/campaigns/campaign-1/characters', statusCode: 401 },
      {
        method: 'POST',
        url: '/api/v1/campaigns/campaign-1/characters',
        statusCode: 401,
        payload: { name: 'Annabelle', discordUserId: 'discord-user-1' },
      },
      { method: 'GET', url: '/api/v1/campaigns/campaign-1/characters/char-1', statusCode: 401 },
      {
        method: 'PATCH',
        url: '/api/v1/campaigns/campaign-1/characters/char-1',
        statusCode: 401,
        payload: { notes: 'Updated notes' },
      },
      {
        method: 'GET',
        url: '/api/v1/campaigns/campaign-1/characters/char-1/sheet',
        statusCode: 401,
      },
      {
        method: 'PATCH',
        url: '/api/v1/campaigns/campaign-1/characters/char-1/sheet',
        statusCode: 401,
        payload: { stats: { wits: 4 } },
      },
      {
        method: 'GET',
        url: '/api/v1/campaigns/campaign-1/player-character/sheet',
        statusCode: 401,
      },
      {
        method: 'PATCH',
        url: '/api/v1/campaigns/campaign-1/player-character/sheet',
        statusCode: 401,
        payload: { stats: { awareness: 3 } },
      },
      { method: 'GET', url: '/api/v1/campaigns/campaign-1/npcs', statusCode: 401 },
      {
        method: 'POST',
        url: '/api/v1/campaigns/campaign-1/npcs',
        statusCode: 401,
        payload: { name: 'Regent Hale' },
      },
      {
        method: 'PATCH',
        url: '/api/v1/campaigns/campaign-1/npcs/npc-1',
        statusCode: 401,
        payload: { description: 'Updated description' },
      },
      {
        method: 'POST',
        url: '/api/v1/campaigns/campaign-1/npcs/npc-1/facts',
        statusCode: 401,
        payload: { content: 'Knows the chantry sigil.' },
      },
      {
        method: 'POST',
        url: '/api/v1/campaigns/campaign-1/npcs/npc-1/reveal',
        statusCode: 401,
        payload: { npcFactIds: ['fact-1'], discordUserIds: ['discord-user-1'] },
      },
      { method: 'GET', url: '/api/v1/campaigns/campaign-1/player-npcs', statusCode: 401 },
      {
        method: 'GET',
        url: '/api/v1/campaigns/campaign-1/player-npcs/npc-1',
        statusCode: 401,
      },
      { method: 'GET', url: '/api/v1/campaigns/campaign-1/events', statusCode: 401 },
      {
        method: 'POST',
        url: '/api/v1/campaigns/campaign-1/events',
        statusCode: 401,
        payload: {
          name: 'Spot The Sigil',
          type: 'test',
          channelId: 'channel-1',
          pipeline: [{ blockType: 'vtm-pool-resolver', config: { attribute: 'wits' } }],
        },
      },
      {
        method: 'PATCH',
        url: '/api/v1/campaigns/campaign-1/events/event-1',
        statusCode: 401,
        payload: { status: 'ready' },
      },
      { method: 'POST', url: '/api/v1/campaigns/campaign-1/events/event-1/fire', statusCode: 401 },
      {
        method: 'DELETE',
        url: '/api/v1/campaigns/campaign-1/events/event-1',
        statusCode: 401,
      },
      {
        method: 'POST',
        url: '/api/v1/campaigns/campaign-1/messages/players',
        statusCode: 401,
        payload: {
          channelId: 'channel-1',
          discordUserIds: ['discord-user-1'],
          content: 'The prince watches you.',
        },
      },
      { method: 'GET', url: '/api/v1/campaigns/campaign-1/quests', statusCode: 401 },
      {
        method: 'POST',
        url: '/api/v1/campaigns/campaign-1/quests',
        statusCode: 401,
        payload: { name: 'Find The Chantry' },
      },
      {
        method: 'PATCH',
        url: '/api/v1/campaigns/campaign-1/quests/quest-1',
        statusCode: 401,
        payload: { visible: true },
      },
      {
        method: 'POST',
        url: '/api/v1/campaigns/campaign-1/quests/quest-1/entries',
        statusCode: 401,
        payload: { content: 'Found a clue.' },
      },
      {
        method: 'PATCH',
        url: '/api/v1/campaigns/campaign-1/quests/quest-1/entries/entry-1',
        statusCode: 401,
        payload: { status: 'done', content: 'Found the clue.' },
      },
      {
        method: 'DELETE',
        url: '/api/v1/campaigns/campaign-1/quests/quest-1/entries/entry-1',
        statusCode: 401,
      },
      { method: 'GET', url: '/api/v1/campaigns/campaign-1/lore', statusCode: 401 },
      {
        method: 'POST',
        url: '/api/v1/campaigns/campaign-1/lore',
        statusCode: 401,
        payload: { title: 'Elysium Bells', content: 'Three chimes mean a boon was called.' },
      },
      {
        method: 'PATCH',
        url: '/api/v1/campaigns/campaign-1/lore/lore-1',
        statusCode: 401,
        payload: { content: 'Four chimes mean protected ground was violated.' },
      },
      {
        method: 'POST',
        url: '/api/v1/campaigns/campaign-1/lore/lore-1/reveal',
        statusCode: 401,
        payload: { discordUserIds: ['discord-user-1'] },
      },
      {
        method: 'DELETE',
        url: '/api/v1/campaigns/campaign-1/lore/lore-1',
        statusCode: 401,
      },
      { method: 'GET', url: '/api/v1/campaigns/campaign-1/summaries', statusCode: 401 },
      {
        method: 'POST',
        url: '/api/v1/campaigns/campaign-1/summaries',
        statusCode: 401,
        payload: {
          title: 'Session One',
          content: 'The coterie entered Chicago.',
          sessionDate: '2026-04-17T19:00:00.000Z',
        },
      },
      {
        method: 'PATCH',
        url: '/api/v1/campaigns/campaign-1/summaries/summary-1',
        statusCode: 401,
        payload: {
          title: 'Updated Summary',
          content: 'Updated content',
          sessionDate: '2026-04-17T19:00:00.000Z',
        },
      },
      {
        method: 'GET',
        url: '/api/v1/campaigns/campaign-1/journal/for/discord-user-1',
        statusCode: 401,
      },
      {
        method: 'POST',
        url: '/api/v1/bot/test-result',
        statusCode: 401,
        payload: {
          eventId: 'event-1',
          campaignId: 'campaign-1',
          channelId: 'channel-1',
          discordUserId: 'discord-user-1',
          playerScore: 3,
        },
      },
      { method: 'GET', url: '/api/v1/bot/campaign-by-guild/guild-1', statusCode: 401 },
      {
        method: 'GET',
        url: '/api/v1/bot/campaigns/campaign-1/visible-npcs/discord-user-1',
        statusCode: 401,
      },
      { method: 'GET', url: '/api/v1/bot/channel-events/channel-1', statusCode: 401 },
      {
        method: 'POST',
        url: '/api/v1/bot/setup-channel',
        statusCode: 401,
        payload: {
          guildId: 'guild-1',
          guildName: 'Test Guild',
          discordChannelId: 'dc-1',
          channelName: 'general',
          campaignName: 'My Campaign',
          gameSystemId: 'vtm-v5',
        },
      },
      { method: 'GET', url: '/api/v1/systems', statusCode: 200 },
      { method: 'GET', url: '/api/v1/systems/vtm-v5', statusCode: 200 },
    ] as const;

    for (const testCase of cases) {
      const response = await app.inject({
        method: testCase.method,
        url: testCase.url,
        payload: 'payload' in testCase ? testCase.payload : undefined,
      });

      expect(response.statusCode, `${testCase.method} ${testCase.url}`).toBe(testCase.statusCode);
    }
  });

  it('returns 401 for unauthenticated requests to protected routes', async () => {
    const app = await buildApp({ config: createTestConfig() });
    appsToClose.push(app);

    const response = await app.inject({ method: 'GET', url: '/api/v1/campaigns' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ status: 'error', data: { message: 'Unauthorized' } });
  });

  it('loads config with repo defaults', () => {
    expect(loadConfig({})).toEqual({
      host: '0.0.0.0',
      port: 3000,
      nodeEnv: 'development',
      apiPrefix: '/api/v1',
      docsPrefix: '/documentation',
      openApiPath: '/openapi.json',
      frontendUrl: 'http://localhost:3000',
      authCookieDomain: undefined,
      betterAuthSecret: 'constancia-development-secret-change-me-12345',
      betterAuthUrl: 'http://localhost:3001',
      betterAuthPath: '/api/auth',
      discordClientId: undefined,
      discordClientSecret: undefined,
      magicLinkFrontendPath: '/auth',
      botApiKey: 'constancia-bot-dev-key',
      botInternalUrl: 'http://localhost:3002',
      backendPublicUrl: 'http://localhost:3000',
      openAiApiKey: undefined,
      contentModerationEnabled: false,
      contentModerationModel: 'omni-moderation-latest',
      contentModerationFailClosed: true,
      uploadStorageDriver: 'local',
      uploadStorageDir: expect.stringContaining('data'),
      uploadMaxBytes: 5 * 1024 * 1024,
      uploadImageMaxDimension: 1024,
      uploadWebpQuality: 80,
      uploadDefaultEnabled: false,
      uploadDefaultAllowanceBytes: 50 * 1024 * 1024,
      uploadQuotaWarningPercent: 80,
      uploadPublicBaseUrl: undefined,
      r2Endpoint: undefined,
      r2AccessKeyId: undefined,
      r2SecretAccessKey: undefined,
      r2Bucket: undefined,
    });
  });

  it('uses host-only auth cookies unless a cookie domain is explicitly configured', () => {
    const config = loadConfig({
      FRONTEND_URL: 'https://gm.constancia.example.com',
      BETTER_AUTH_URL: 'https://api.constancia.example.com',
    });

    expect(config.authCookieDomain).toBeUndefined();
  });

  it('uses an explicit auth cookie domain when configured', () => {
    const config = loadConfig({
      FRONTEND_URL: 'https://gm.constancia.example.com',
      BETTER_AUTH_URL: 'https://api.constancia.example.com',
      AUTH_COOKIE_DOMAIN: 'constancia.example.com',
    });

    expect(config.authCookieDomain).toBe('constancia.example.com');
  });

  it('creates and verifies a Better Auth magic link through the design-doc wrapper routes', async () => {
    const app = await buildApp({ config: createTestConfig() });
    appsToClose.push(app);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link',
      headers: { 'x-bot-key': 'constancia-bot-dev-key' },
      payload: { discordUserId: 'discord-user-2', guildId: 'guild-2' },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().status).toBe('ok');
    expect(createResponse.json().data.url).toContain('/auth?token=');
    expect(new URL(createResponse.json().data.url as string).searchParams.get('next')).toBe('/');

    const token = createResponse.json().data.token as string;
    const verifyResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/verify?token=${token}`,
    });

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.json().status).toBe('ok');
    expect(verifyResponse.json().data.verified).toBe(true);
    expect(verifyResponse.json().data.user.email).toBe('discord-user-2@discord.constancia.local');
    expect(verifyResponse.headers['set-cookie']).toBeDefined();
  });
});
