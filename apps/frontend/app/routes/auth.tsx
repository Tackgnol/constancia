import { useEffect, useState } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { authClient } from '@/lib/auth-client';

interface AuthLoaderData {
  mode: 'idle' | 'error' | 'verifying';
  message: string;
  reason: 'default' | 'session-required' | 'discord-required';
  token?: string;
  next?: string;
}

function normalizeNext(next: string | null) {
  return next && next.startsWith('/') ? next : '/';
}

function formatAuthError(error: string) {
  return `This table pass could not be opened: ${error}.`;
}

function resolveReason(reason: string | null): AuthLoaderData['reason'] {
  return reason === 'session-required' || reason === 'discord-required' ? reason : 'default';
}

function getIdleMessage(reason: AuthLoaderData['reason']) {
  if (reason === 'session-required') {
    return 'Your session is missing or expired. Continue with Discord, or ask your GM for a fresh table pass.';
  }

  if (reason === 'discord-required') {
    return 'You are signed in, but Constancia could not confirm your Discord seat at the table.';
  }

  return 'Open a Discord-delivered table pass, or continue with Discord if you already have table access.';
}

export async function loader({ request }: LoaderFunctionArgs): Promise<AuthLoaderData | Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const error = url.searchParams.get('error');
  const reason = resolveReason(url.searchParams.get('reason'));
  const next = normalizeNext(url.searchParams.get('next'));

  if (error) {
    return {
      mode: 'error',
      message: formatAuthError(error),
      reason,
      next,
    };
  }

  if (!token) {
    return {
      mode: 'idle',
      message: getIdleMessage(reason),
      reason,
      next,
    };
  }

  return {
    mode: 'verifying',
    message: 'Checking your table pass...',
    reason,
    token,
    next,
  };
}

export default function AuthRoute() {
  const loaderData = useLoaderData<typeof loader>() as AuthLoaderData;
  const logtoEnabled = import.meta.env.VITE_LOGTO_ENABLED === 'true';
  const [mode, setMode] = useState<'idle' | 'error' | 'verifying'>(loaderData.mode);
  const [message, setMessage] = useState(loaderData.message);
  const [logtoAuthPending, setLogtoAuthPending] = useState(false);

  useEffect(() => {
    if (loaderData.mode !== 'verifying') return;
    fetch(
      `/api/v1/auth/verify?token=${encodeURIComponent(loaderData.token!)}&next=${encodeURIComponent(loaderData.next!)}`,
      { method: 'GET', credentials: 'include' },
    )
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as {
          status?: string;
          data?: { error?: string };
          message?: string;
        } | null;
        const verified = res.ok && payload?.status === 'ok';
        if (verified) {
          window.location.href = loaderData.next!;
          return;
        }
        setMode('error');
        setMessage(payload?.data?.error || payload?.message || 'Magic link verification failed.');
      })
      .catch(() => {
        setMode('error');
        setMessage('Magic link verification failed.');
      });
  }, []);

  async function handleLogtoSignIn() {
    setLogtoAuthPending(true);
    setMode('idle');
    setMessage('Sending you to Discord...');

    try {
      await authClient.signIn.oauth2({
        providerId: 'logto',
        callbackURL: loaderData.next ?? '/',
        requestSignUp: true,
      });
    } catch (error) {
      setMode('error');
      setMessage(error instanceof Error ? error.message : 'Discord sign-in could not be started.');
      setLogtoAuthPending(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">Constancia Access</p>
        <h1>Your seat is Discord</h1>
        <p className="hero-copy">
          Constancia uses Discord to find your campaigns, sheets, and table permissions. A GM's
          table pass opens the first door; Discord keeps that access stable after the link expires.
        </p>

        {logtoEnabled ? (
          <div className="auth-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleLogtoSignIn()}
              disabled={logtoAuthPending}
            >
              {logtoAuthPending ? 'Opening Discord...' : 'Continue with Discord'}
            </button>
          </div>
        ) : (
          <p className="form-hint">
            Discord sign-in will appear here once Logto is configured for this environment.
          </p>
        )}

        <div className={`auth-status auth-status-${mode}`}>
          <strong>
            {loaderData.reason === 'discord-required'
              ? 'Discord required'
              : loaderData.reason === 'session-required'
                ? 'Session required'
                : 'Access status'}
          </strong>
          <p>{message}</p>
        </div>

        <div className="detail-grid">
          <article className="detail-card">
            <p className="detail-label">Table pass</p>
            <ol className="detail-list auth-list">
              <li>A GM or bot sends the first link through Discord.</li>
              <li>Opening it creates a session for that table seat.</li>
              <li>If it expired, ask your GM for a fresh pass.</li>
            </ol>
          </article>

          <article className="detail-card">
            <p className="detail-label">Durable access</p>
            <div className="detail-stack">
              <p>Continue with Discord to keep access after a table pass is consumed.</p>
              <p>Constancia will only open game material when the session resolves to Discord.</p>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
