import * as Sentry from '@sentry/react-router';

// Strips everything Sentry's Node integrations might auto-capture from the raw
// request (loader/action data, headers, cookies) and any ad-hoc `extra`
// context. Correlation ids (discordUserId, campaignId, ...) are carried as
// explicit tags, set at each captureException call, never here.
function scrubGlitchTipEvent(event) {
  const { request: _request, extra: _extra, ...rest } = event;
  return rest;
}

const dsn = process.env.GLITCHTIP_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    sendDefaultPii: false,
    beforeSend: (event) => scrubGlitchTipEvent(event),
  });
  Sentry.getGlobalScope().setTag('service', 'frontend');
}
