import { useState } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { data, redirect, useLoaderData } from 'react-router';
import { authClient } from '@/lib/auth-client';
import { verifyMagicLinkForFrontend } from '@/lib/magic-link-verification.server';

interface AuthLoaderData {
  mode: 'idle' | 'error';
  message: string;
}

function normalizeNext(next: string | null) {
  if (!next) {
    return '/';
  }

  const frontendOrigin = 'https://constancia.invalid';

  try {
    const target = new URL(next, frontendOrigin);
    return target.origin === frontendOrigin
      ? `${target.pathname}${target.search}${target.hash}`
      : '/';
  } catch {
    return '/';
  }
}

function formatAuthError(error: string) {
  const explanation =
    error === 'INVALID_TOKEN'
      ? 'The magic link is invalid or has already been used'
      : error.replace(/[.]+$/u, '');

  return `Magic link verification failed: ${explanation}.`;
}

export async function loader({ request }: LoaderFunctionArgs) {
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
    const verification = await verifyMagicLinkForFrontend(request, token);

    if (verification.verified) {
      // react-doctor-disable-next-line react-doctor/clickjacking-redirect-risk
      return redirect(next, { headers: verification.headers });
    }

    return data(
      {
        mode: 'error',
        message: formatAuthError(verification.error ?? 'The magic link is invalid or has expired'),
      } satisfies AuthLoaderData,
      { headers: verification.headers },
    );
  } catch {
    return {
      mode: 'error',
      message: 'Magic link verification failed. Please request a fresh link from Discord.',
    };
  }
}

export default function AuthRoute() {
  const loaderData = useLoaderData<typeof loader>() as AuthLoaderData;
  const discordOauthEnabled = import.meta.env.VITE_DISCORD_AUTH_ENABLED === 'true';
  const [mode, setMode] = useState<AuthLoaderData['mode']>(loaderData.mode);
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
