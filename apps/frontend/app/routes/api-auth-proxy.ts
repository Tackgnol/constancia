import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { rewriteAuthSetCookieHeaders } from '@/lib/auth-cookies.server';
import { getApiBaseUrl, getPublicApiBaseUrl } from '@/lib/api-url';

function makeRedirectHeaders(response: Response, requestUrl: string) {
  const headers = new Headers();
  const location = response.headers.get('location');

  if (location) {
    headers.set('Location', location);
  }

  headers.set('Cache-Control', 'no-store');

  for (const setCookie of rewriteAuthSetCookieHeaders(response.headers, requestUrl)) {
    headers.append('Set-Cookie', setCookie);
  }

  return headers;
}

function makeBodyHeaders(response: Response, requestUrl: string) {
  const headers = new Headers(response.headers);
  headers.delete('connection');
  headers.delete('content-encoding');
  headers.delete('content-length');
  headers.delete('keep-alive');
  headers.delete('set-cookie');
  headers.delete('transfer-encoding');

  for (const setCookie of rewriteAuthSetCookieHeaders(response.headers, requestUrl)) {
    headers.append('Set-Cookie', setCookie);
  }

  return headers;
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

function makeFrontendResponse(response: Response, requestUrl: string) {
  const location = response.headers.get('location');
  if (response.status >= 300 && response.status < 400 && location) {
    return redirect(location, {
      status: response.status,
      headers: makeRedirectHeaders(response, requestUrl),
    });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: makeBodyHeaders(response, requestUrl),
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

  return makeFrontendResponse(response, request.url);
}

export async function loader({ request }: LoaderFunctionArgs) {
  return proxyBetterAuth(request);
}

export async function action({ request }: ActionFunctionArgs) {
  return proxyBetterAuth(request);
}
