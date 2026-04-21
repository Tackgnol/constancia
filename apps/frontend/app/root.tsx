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
