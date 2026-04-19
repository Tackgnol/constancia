import { startTransition, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { authClient } from '@/lib/auth-client';

function normalizeNext(next: string | null) {
  return next && next.startsWith('/') ? next : '/';
}

export default function AuthRoute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const next = normalizeNext(searchParams.get('next'));
  const session = authClient.useSession();
  const [mode, setMode] = useState<'idle' | 'verifying' | 'error'>(token ? 'verifying' : 'idle');
  const [message, setMessage] = useState('Waiting for a Discord-delivered magic link.');

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

    void authClient.magicLink.verify(
      {
        query: {
          token,
        },
      },
      {
        onSuccess: async () => {
          await session.refetch();

          if (!active) {
            return;
          }

          startTransition(() => {
            navigate(next, { replace: true });
          });
        },
        onError: (context) => {
          if (!active) {
            return;
          }

          setMode('error');
          setMessage(context.error.message || 'Magic link verification failed.');
        },
      },
    );

    return () => {
      active = false;
    };
  }, [navigate, next, session, session.data, token]);

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">Constancia Access</p>
        <h1>GM login via Discord magic link</h1>
        <p className="hero-copy">
          The primary login flow starts in Discord: use the bot-triggered admin flow, then open the
          link from your DM to land back here with a live Better Auth session.
        </p>

        <div className={`auth-status auth-status-${mode}`}>
          <strong>{mode === 'verifying' ? 'Verifying link' : 'Auth status'}</strong>
          <p>{message}</p>
        </div>

        <div className="detail-grid">
          <article className="detail-card">
            <p className="detail-label">Primary flow</p>
            <ol className="detail-list auth-list">
              <li>Run the bot admin login command in Discord.</li>
              <li>Receive a magic link in your DM.</li>
              <li>Open the link to establish a backend session.</li>
            </ol>
          </article>

          <article className="detail-card">
            <p className="detail-label">Current scope</p>
            <div className="detail-stack">
              <p>The first auth capability is intentionally Discord-first.</p>
              <p>
                The bot asks the backend for a Better Auth magic link, then DMs the frontend URL
                that lands here and completes verification.
              </p>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
