import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe('Better Auth cookie domain', () => {
  it('sets the configured auth cookie domain on magic-link session cookies', async () => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      AUTH_COOKIE_DOMAIN: 'constancia.example.com',
      BETTER_AUTH_URL: 'https://api.constancia.example.com',
      FRONTEND_URL: 'https://gm.constancia.example.com',
      BETTER_AUTH_SECRET: 'constancia-test-secret-12345678901234567890',
      BOT_API_KEY: 'constancia-bot-dev-key',
    };

    const { buildApp } = await import('../app.js');
    const { loadConfig } = await import('../config.js');
    const app = await buildApp({ config: loadConfig(process.env) });

    try {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/magic-link',
        headers: { 'x-bot-key': 'constancia-bot-dev-key' },
        payload: { discordUserId: 'discord-user-1', guildId: 'guild-1' },
      });
      const token = createResponse.json().data.token as string;

      const verifyResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/auth/verify?token=${token}`,
      });
      const setCookie = verifyResponse.headers['set-cookie'];
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ''];

      expect(cookies.some((cookie) => cookie.includes('Domain=constancia.example.com'))).toBe(true);
    } finally {
      await app.close();
    }
  }, 10_000);
});
