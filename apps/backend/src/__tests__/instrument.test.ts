import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/node';
import { scrubGlitchTipEvent } from '../instrument.js';

describe('scrubGlitchTipEvent', () => {
  it('strips the raw request and any ad-hoc extra context', () => {
    const event = {
      message: 'Something broke',
      tags: { discordUserId: 'discord-1', campaignId: 'campaign-1' },
      request: { data: { content: 'a player message with prepared secrets in it' } },
      extra: { characterSheet: { clan: 'Ventrue' } },
    } as unknown as ErrorEvent;

    const scrubbed = scrubGlitchTipEvent(event);

    expect(scrubbed).not.toHaveProperty('request');
    expect(scrubbed).not.toHaveProperty('extra');
    expect(scrubbed.tags).toEqual({ discordUserId: 'discord-1', campaignId: 'campaign-1' });
    expect(scrubbed.message).toBe('Something broke');
  });

  it('is a no-op when there is nothing to strip', () => {
    const event = { message: 'ok', tags: { route: '/health' } } as unknown as ErrorEvent;
    expect(scrubGlitchTipEvent(event)).toEqual(event);
  });
});
