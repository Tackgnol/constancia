import { startTransition, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { authClient } from '@/lib/auth-client';
import { getApiBaseUrl } from '@/lib/api-url';

interface VerifyMagicLinkData {
  verified?: boolean;
  error?: string | null;
}

interface VerifyMagicLinkResponse {
  status?: 'ok' | 'error';
  data?: VerifyMagicLinkData;
}

function normalizeNext(next: string | null) {
  return next && next.startsWith('/') ? next : '/';
}

async function verifyMagicLink(token: string) {
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/auth/verify?token=${encodeURIComponent(token)}`,
    {
      method: 'GET',
      credentials: 'include',
    },
  );

  const payload = (await response.json()) as VerifyMagicLinkResponse;

  if (!response.ok || payload.status !== 'ok' || payload.data?.verified !== true) {
    throw new Error(payload.data?.error || `Magic link verification failed (${response.status}).`);
  }
}

export default function AuthRoute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const next = normalizeNext(searchParams.get('next'));
  const discordOauthEnabled = import.meta.env.VITE_DISCORD_AUTH_ENABLED === 'true';
  const session = authClient.useSession();
  const [mode, setMode] = useState<'idle' | 'verifying' | 'error'>(token ? 'verifying' : 'idle');
  const [message, setMessage] = useState('Waiting for a Discord-delivered magic link.');
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

  useEffect(() => {
    if (session.data) {
      navigate(next, { replace: true });
    }
  }, [navigate, next, session.data]);

  useEffect(() => {
    if (!token || session.data) {
      return;
    }

    let active = true;

    setMode('verifying');
    setMessage('Verifying your magic link and establishing the GM session...');

    void verifyMagicLink(token)
      .then(async () => {
        await session.refetch();

        if (!active) {
          return;
        }

        startTransition(() => {
          navigate(next, { replace: true });
        });
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setMode('error');
        setMessage(error instanceof Error ? error.message : 'Magic link verification failed.');
      });

    return () => {
      active = false;
    };
  }, [navigate, next, session, session.data, token]);

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
            disabled={discordAuthPending || mode === 'verifying'}
          >
            {discordAuthPending ? 'Redirecting to Discord…' : 'Continue with Discord'}
          </button>
        ) : (
          <p className="form-hint">
            Discord OAuth will appear here once the backend provider credentials are configured.
          </p>
        )}

        <div className={`auth-status auth-status-${mode}`}>
          <strong>{mode === 'verifying' ? 'Verifying link' : 'Auth status'}</strong>
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
