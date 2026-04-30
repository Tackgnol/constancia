import { useEffect, useState } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { authClient } from '@/lib/auth-client';

interface AuthLoaderData {
  mode: 'idle' | 'error' | 'verifying';
  message: string;
  token?: string;
  next?: string;
}

function normalizeNext(next: string | null) {
  return next && next.startsWith('/') ? next : '/';
}

function formatAuthError(error: string) {
  return `Magic link verification failed: ${error}.`;
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

  return {
    mode: 'verifying',
    message: 'Verifying magic link...',
    token,
    next,
  };
}

export default function AuthRoute() {
  const loaderData = useLoaderData<typeof loader>() as AuthLoaderData;
  const discordOauthEnabled = import.meta.env.VITE_DISCORD_AUTH_ENABLED === 'true';
  const [mode, setMode] = useState<'idle' | 'error' | 'verifying'>(loaderData.mode);
  const [message, setMessage] = useState(loaderData.message);
  const [discordAuthPending, setDiscordAuthPending] = useState(false);

  useEffect(() => {
    if (loaderData.mode !== 'verifying') return;
    fetch(
      `/api/v1/auth/verify?token=${encodeURIComponent(loaderData.token!)}&next=${encodeURIComponent(loaderData.next!)}`,
      { method: 'GET', credentials: 'include' },
    )
      .then((res) => {
        if (res.ok) {
          window.location.href = loaderData.next!;
        } else {
          return res.json().then((data: { message?: string }) => {
            setMode('error');
            setMessage(data?.message || 'Magic link verification failed.');
          });
        }
      })
      .catch(() => {
        setMode('error');
        setMessage('Magic link verification failed.');
      });
  }, []);

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
