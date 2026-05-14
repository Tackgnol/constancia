import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

export function buildAuthPath(next: string, reason: 'session-required' | 'discord-required') {
  const params = new URLSearchParams({ reason, next });
  return `/auth?${params.toString()}`;
}

export function throwPlayerAccessError(
  status: number,
  next: string,
  fallbackMessage: string,
): never {
  if (status === 401) {
    throw new Response(buildAuthPath(next, 'session-required'), { status });
  }

  if (status === 403) {
    throw new Response(buildAuthPath(next, 'discord-required'), { status });
  }

  throw new Response(fallbackMessage, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getPlayerAccessStatusFromPayload(payload: unknown): 401 | 403 | null {
  if (!isRecord(payload) || payload.status !== 'error' || !isRecord(payload.data)) {
    return null;
  }

  if (payload.data.message === 'Unauthorized') {
    return 401;
  }

  if (payload.data.message === 'Discord identity required') {
    return 403;
  }

  return null;
}

function getResponseLocation(error: unknown) {
  if (!isRouteErrorResponse(error)) return '/auth';
  return typeof error.data === 'string' && error.data.startsWith('/auth') ? error.data : null;
}

export function PlayerAccessErrorBoundary() {
  const error = useRouteError();
  const isRouteError = isRouteErrorResponse(error);
  const status = isRouteError ? error.status : 500;
  const authPath = getResponseLocation(error) ?? '/auth';
  const isSessionMissing = status === 401;
  const isDiscordMissing = status === 403;
  const title = isSessionMissing
    ? 'This table pass is closed'
    : isDiscordMissing
      ? 'Discord required'
      : 'Dossier unavailable';
  const copy = isSessionMissing
    ? 'Your session is missing or expired. Continue with Discord, or ask your GM for a fresh table pass.'
    : isDiscordMissing
      ? 'You are signed in, but this account is not connected to a Discord user. Constancia uses Discord to match you to campaigns and character sheets.'
      : 'Constancia could not open this player view.';

  return (
    <main className="player-dossier-shell">
      <article className="player-dossier-sheet player-access-panel">
        <div className="player-dossier-strip">
          <span>ACCESS</span>
          <span>{status}</span>
        </div>
        <section className="player-dossier-copy sheet-intro">
          <p className="eyebrow">Constancia</p>
          <h1>{title}</h1>
          <p>{copy}</p>
        </section>
        {(isSessionMissing || isDiscordMissing) && (
          <div className="auth-actions">
            <Link className="primary-button auth-link-button" to={authPath}>
              {isDiscordMissing ? 'Connect Discord' : 'Continue with Discord'}
            </Link>
            <p className="form-hint">A GM can also send a fresh table pass through Discord.</p>
          </div>
        )}
      </article>
    </main>
  );
}
