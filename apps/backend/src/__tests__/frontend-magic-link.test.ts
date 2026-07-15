import { describe, expect, it } from 'vitest';
import { createFrontendMagicLink } from '../auth/frontend-magic-link.js';

const frontendUrl = 'https://constancia.example.com';

function createLink(callbackURL?: string) {
  return new URL(
    createFrontendMagicLink({
      token: 'magic-token',
      callbackURL,
      frontendUrl,
      frontendPath: '/auth',
    }),
  );
}

describe('createFrontendMagicLink', () => {
  it.each(['/player/campaigns/campaign-1/sheet', '/player/campaigns/campaign-1/journal'])(
    'keeps the player destination as an internal path: %s',
    (callbackURL) => {
      const link = createLink(callbackURL);

      expect(link.origin).toBe(frontendUrl);
      expect(link.pathname).toBe('/auth');
      expect(link.searchParams.get('token')).toBe('magic-token');
      expect(link.searchParams.get('next')).toBe(callbackURL);
    },
  );

  it('reduces a same-origin absolute callback URL to its internal path', () => {
    const link = createLink(`${frontendUrl}/player/campaigns/campaign-1/sheet?tab=stats#health`);

    expect(link.searchParams.get('next')).toBe(
      '/player/campaigns/campaign-1/sheet?tab=stats#health',
    );
  });

  it.each(['https://attacker.example/sheet', '//attacker.example/sheet'])(
    'falls back to the root for an external callback URL: %s',
    (callbackURL) => {
      const link = createLink(callbackURL);

      expect(link.searchParams.get('next')).toBe('/');
    },
  );
});
