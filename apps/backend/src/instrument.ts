import * as Sentry from '@sentry/node';

// Strips everything Sentry's Node integrations might auto-capture from the raw
// request (body, headers, cookies) and any ad-hoc `extra` context a call site
// might attach. Correlation ids (discordUserId, campaignId, eventId, ...) are
// carried as explicit tags, set at each captureException call, never here.
export function scrubGlitchTipEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const { request: _request, extra: _extra, ...rest } = event;
  return rest as Sentry.ErrorEvent;
}

const dsn = process.env.GLITCHTIP_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    sendDefaultPii: false,
    beforeSend: (event) => scrubGlitchTipEvent(event),
  });
  Sentry.getGlobalScope().setTag('service', 'backend');
}

export { Sentry };
