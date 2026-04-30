import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { getApiBaseUrl, getPublicApiBaseUrl } from '@/lib/api-url';

const SESSION_COOKIE_NAME = 'better-auth.session_token';

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

function logAuthProxyResponse(response: Response) {
  if (response.status !== 302) {
    return;
  }

  const setCookieHeaders = getSetCookieHeaders(response.headers);
  console.info('auth proxy redirect', {
    location: response.headers.get('location'),
    setCookieCount: setCookieHeaders.length,
    hasSessionCookie: setCookieHeaders.some((header) => header.includes(SESSION_COOKIE_NAME)),
  });
}

function makeBackendHeaders(request: Request) {
  const requestHeaders = new Headers(request.headers);
  const publicApiUrl = new URL(getPublicApiBaseUrl());
  const frontendUrl = new URL(request.url);

  requestHeaders.delete('host');
  requestHeaders.delete('content-length');
  requestHeaders.set('origin', frontendUrl.origin);
  requestHeaders.set('x-forwarded-host', publicApiUrl.host);
  requestHeaders.set('x-forwarded-proto', publicApiUrl.protocol.replace(':', ''));

  return requestHeaders;
}

function makeFrontendResponse(response: Response) {
  logAuthProxyResponse(response);

  const headers = new Headers(response.headers);
  headers.delete('set-cookie');

  for (const setCookie of getSetCookieHeaders(response.headers)) {
    headers.append('Set-Cookie', makeFrontendCookie(setCookie));
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function proxyBetterAuth(request: Request) {
  const requestUrl = new URL(request.url);
  const backendUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, getApiBaseUrl());
  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.text();

  const response = await fetch(backendUrl, {
    method,
    headers: makeBackendHeaders(request),
    body,
    redirect: 'manual',
  });

  return makeFrontendResponse(response);
}

export async function loader({ request }: LoaderFunctionArgs) {
  return proxyBetterAuth(request);
}

export async function action({ request }: ActionFunctionArgs) {
  return proxyBetterAuth(request);
}
