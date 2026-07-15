import { rewriteAuthSetCookieHeaders } from '@/lib/auth-cookies.server';
import { getApiBaseUrl, getPublicApiBaseUrl } from '@/lib/api-url';

interface VerifyMagicLinkPayload {
  status?: string;
  data?: {
    verified?: boolean;
    error?: string | null;
  };
  message?: string;
}

export interface MagicLinkVerificationResult {
  verified: boolean;
  error: string | null;
  headers: Headers;
}

function buildVerificationHeaders(request: Request) {
  const headers = new Headers({ accept: 'application/json' });
  const cookie = request.headers.get('cookie');
  const publicApiUrl = new URL(getPublicApiBaseUrl());
  const frontendUrl = new URL(request.url);

  if (cookie) {
    headers.set('cookie', cookie);
  }

  headers.set('origin', frontendUrl.origin);
  headers.set('x-forwarded-host', publicApiUrl.host);
  headers.set('x-forwarded-proto', publicApiUrl.protocol.replace(':', ''));

  return headers;
}

function buildFrontendHeaders(response: Response, requestUrl: string) {
  const headers = new Headers({ 'Cache-Control': 'no-store' });

  for (const setCookie of rewriteAuthSetCookieHeaders(response.headers, requestUrl)) {
    headers.append('Set-Cookie', setCookie);
  }

  return headers;
}

async function readVerificationPayload(response: Response): Promise<VerifyMagicLinkPayload | null> {
  const rawPayload = await response.text();

  if (rawPayload.length === 0) {
    return null;
  }

  try {
    return JSON.parse(rawPayload) as VerifyMagicLinkPayload;
  } catch {
    return null;
  }
}

export async function verifyMagicLinkForFrontend(
  request: Request,
  token: string,
): Promise<MagicLinkVerificationResult> {
  const backendUrl = new URL('/api/v1/auth/verify', getApiBaseUrl());
  backendUrl.searchParams.set('token', token);

  const response = await fetch(backendUrl, {
    method: 'GET',
    headers: buildVerificationHeaders(request),
    redirect: 'manual',
  });
  const payload = await readVerificationPayload(response);
  const verified = response.ok && payload?.status === 'ok' && payload.data?.verified === true;

  return {
    verified,
    error:
      payload?.data?.error ??
      payload?.message ??
      (verified ? null : 'The magic link is invalid or has expired.'),
    headers: buildFrontendHeaders(response, request.url),
  };
}
