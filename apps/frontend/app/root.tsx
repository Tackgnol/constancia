import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from 'react-router';

import './app.css';

const googleFontsHref =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap';

export function links() {
  return [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
    { rel: 'stylesheet', href: googleFontsHref },
  ];
}

export function meta() {
  return [
    { title: 'Constancia War Room' },
    {
      name: 'description',
      content: 'GM control surface for live sessions, cues, and player orchestration.',
    },
    { name: 'theme-color', content: '#0a0c0f' },
  ];
}

export function HydrateFallback() {
  return (
    <html lang="en">
      <head title="Constancia">
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="war-room-shell">
          <header className="topbar">
            <div className="topbar-group">
              <span className="campaign-name">Loading War Room...</span>
            </div>
          </header>
          <div className="war-room-grid">
            <main className="route-panel">
              <div className="loading-state">
                <p>Initializing systems and fetching session data...</p>
              </div>
            </main>
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <html lang="en">
      <head title="Constancia">
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const title = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'Interface failure';
  const detail =
    error instanceof Error
      ? error.message
      : 'The war room shell hit an unexpected problem while rendering.';

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <title>{title}</title>
        <Meta />
        <Links />
      </head>
      <body>
        <main className="error-shell">
          <p className="eyebrow">Constancia</p>
          <h1>{title}</h1>
          <p>{detail}</p>
        </main>
        <Scripts />
      </body>
    </html>
  );
}
