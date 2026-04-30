import { useState } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { redirect, useLoaderData } from 'react-router';
import { authClient } from '@/lib/auth-client';
import { getApiBaseUrl, getPublicApiBaseUrl } from '@/lib/api-url';

interface VerifyMagicLinkData {
  verified?: boolean;
  error?: string | null;
}

interface VerifyMagicLinkResponse {
  status?: 'ok' | 'error';
  message?: string;
  data?: VerifyMagicLinkData;
}

interface AuthLoaderData {
  mode: 'idle' | 'error';
  message: string;
}

function normalizeNext(next: string | null) {
  return next && next.startsWith('/') ? next : '/';
}

function formatAuthError(error: string) {
  return `Magic link verification failed: ${error}.`;
}

function getSetCookieHeaders(headers: Headers) {
  const maybeHeaders = headers as Headers & { getSetCookie?: () => string[] };
  const setCookieHeaders = maybeHeaders.getSetCookie?.();

  if (setCookieHeaders && setCookieHeaders.length > 0) {
    return setCookieHeaders;
  }

  const setCookie = headers.get('set-cookie');
  return setCookie ? [setCookie] : [];
}

function makeFrontendCookie(setCookie: string) {
  return setCookie
    .split(';')
    .map((part) => part.trim())
    .filter((part) => !part.toLowerCase().startsWith('domain='))
    .join('; ');
}

function getPublicRequestHeaders(request: Request) {
  const publicApiUrl = new URL(getPublicApiBaseUrl());
  const frontendUrl = new URL(request.url);

  return {
    cookie: request.headers.get('Cookie') || '',
    origin: frontendUrl.origin,
    'x-forwarded-host': publicApiUrl.host,
    'x-forwarded-proto': publicApiUrl.protocol.replace(':', ''),
  };
}

async function verifyMagicLink(request: Request, token: string) {
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/auth/verify?token=${encodeURIComponent(token)}`,
    {
      method: 'GET',
      headers: getPublicRequestHeaders(request),
    },
  );

  const payload = (await response.json()) as VerifyMagicLinkResponse;

  if (!response.ok || payload.status !== 'ok' || payload.data?.verified !== true) {
    throw new Error(
      payload.data?.error ||
        payload.message ||
        `Magic link verification failed (${response.status}).`,
    );
  }

  return response;
}

export async function loader({ request }: LoaderFunctionArgs): Promise<AuthLoaderData | Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const error = url.searchParams.get('error');
  const next = normalizeNext(url.searchParams.get('next'));

  if (error) {
    return {
      mode: 'error',
      message: formatAuthError(error),
    };
  }

  if (!token) {
    return {
      mode: 'idle',
      message: 'Waiting for a Discord-delivered magic link.',
    };
  }

  try {
    const response = await verifyMagicLink(request, token);
    const headers = new Headers();

    for (const setCookie of getSetCookieHeaders(response.headers)) {
      headers.append('Set-Cookie', makeFrontendCookie(setCookie));
    }

    return redirect(next, { headers });
  } catch (error) {
    return {
      mode: 'error',
      message: error instanceof Error ? error.message : 'Magic link verification failed.',
    };
  }
}

export default function AuthRoute() {
  const loaderData = useLoaderData<typeof loader>() as AuthLoaderData;
  const discordOauthEnabled = import.meta.env.VITE_DISCORD_AUTH_ENABLED === 'true';
  const [mode, setMode] = useState<'idle' | 'error'>(loaderData.mode);
  const [message, setMessage] = useState(loaderData.message);
  const [discordAuthPending, setDiscordAuthPending] = useState(false);

  async function handleDiscordSignIn() {
    setDiscordAuthPending(true);
    setMode('idle');
    setMessage('Handing off to Discord sign-in...');

    try {
      await authClient.signIn.social({
        provider: 'discord',
      });
    } catch (error) {
      setMode('error');
      setMessage(error instanceof Error ? error.message : 'Discord sign-in could not be started.');
      setDiscordAuthPending(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">Constancia Access</p>
        <h1>Discord access for GMs and players</h1>
        <p className="hero-copy">
          Authentication stays Discord-native. Use the direct Discord sign-in when the OAuth
          provider is configured, or fall back to the bot-delivered magic link while that rollout is
          still in progress.
        </p>

        {discordOauthEnabled ? (
          <button
            type="button"
            className="primary-button"
            onClick={() => void handleDiscordSignIn()}
            disabled={discordAuthPending}
          >
            {discordAuthPending ? 'Redirecting to Discord…' : 'Continue with Discord'}
          </button>
        ) : (
          <p className="form-hint">
            Discord OAuth will appear here once the backend provider credentials are configured.
          </p>
        )}

        <div className={`auth-status auth-status-${mode}`}>
          <strong>Auth status</strong>
          <p>{message}</p>
        </div>

        <div className="detail-grid">
          <article className="detail-card">
            <p className="detail-label">Primary flow</p>
            <ol className="detail-list auth-list">
              <li>Use direct Discord sign-in when it is available for this environment.</li>
              <li>Otherwise run the bot admin login command in Discord.</li>
              <li>Open the DM-delivered link to establish the backend session.</li>
            </ol>
          </article>

          <article className="detail-card">
            <p className="detail-label">Current scope</p>
            <div className="detail-stack">
              <p>All access still resolves back to a Discord identity on the backend.</p>
              <p>
                That lets the player-safe dossier routes stop trusting a raw Discord id in the URL
                and use the authenticated session instead.
              </p>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
