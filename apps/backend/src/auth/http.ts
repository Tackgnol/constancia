import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { auth } from '../auth.js';

function readForwardedHeader(value: string | string[] | undefined): string | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue?.split(',')[0]?.trim() || undefined;
}

export function resolveOrigin(request: FastifyRequest) {
  const host = readForwardedHeader(request.headers['x-forwarded-host']) ?? request.headers.host;
  const protocol = readForwardedHeader(request.headers['x-forwarded-proto']) ?? 'http';

  if (host) {
    return `${protocol}://${host}`;
  }

  return process.env.BETTER_AUTH_URL ?? 'http://localhost:3001';
}

function buildRequestBody(body: unknown) {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (typeof body === 'string') {
    return body;
  }

  return JSON.stringify(body);
}

function getSetCookieHeaders(headers: Headers) {
  const maybeHeaders = headers as Headers & { getSetCookie?: () => string[] };
  const setCookieHeaders = maybeHeaders.getSetCookie?.();

  if (setCookieHeaders && setCookieHeaders.length > 0) {
    return setCookieHeaders;
  }

  const setCookie = headers.get('set-cookie');
  return setCookie ? [setCookie] : [];
}

export interface SetCookieSummary {
  name: string;
  domain?: string;
  path?: string;
  sameSite?: string;
  secure: boolean;
  httpOnly: boolean;
}

export function summarizeSetCookieHeaders(headers: Headers): SetCookieSummary[] {
  return getSetCookieHeaders(headers).map((setCookie) => {
    const [nameValue = '', ...attributes] = setCookie.split(';').map((part) => part.trim());
    const [name = ''] = nameValue.split('=');
    const summary: SetCookieSummary = {
      name,
      secure: false,
      httpOnly: false,
    };

    for (const attribute of attributes) {
      const [rawKey = '', ...rawValueParts] = attribute.split('=');
      const key = rawKey.toLowerCase();
      const value = rawValueParts.join('=');

      if (key === 'domain' && value) {
        summary.domain = value;
      } else if (key === 'path' && value) {
        summary.path = value;
      } else if (key === 'samesite' && value) {
        summary.sameSite = value;
      } else if (key === 'secure') {
        summary.secure = true;
      } else if (key === 'httponly') {
        summary.httpOnly = true;
      }
    }

    return summary;
  });
}

function shouldSkipForwardedHeader(key: string) {
  const lowerKey = key.toLowerCase();

  return (
    lowerKey === 'connection' ||
    lowerKey === 'content-encoding' ||
    lowerKey === 'content-length' ||
    lowerKey === 'keep-alive' ||
    lowerKey === 'set-cookie' ||
    lowerKey === 'transfer-encoding'
  );
}

function applyResponseHeaders(response: Response, reply: FastifyReply) {
  response.headers.forEach((value, key) => {
    if (!shouldSkipForwardedHeader(key)) {
      reply.header(key, value);
    }
  });

  const setCookieHeaders = getSetCookieHeaders(response.headers);
  if (setCookieHeaders.length > 0) {
    reply.header('set-cookie', setCookieHeaders);
  }
}

export async function forwardToBetterAuth(
  request: FastifyRequest,
  path: string,
  init: {
    method: 'GET' | 'POST';
    body?: unknown;
  },
) {
  const headers = fromNodeHeaders(request.headers);
  const url = new URL(path, resolveOrigin(request));
  const body = buildRequestBody(init.body);

  if (body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return auth.handler(
    new Request(url, {
      method: init.method,
      headers,
      body,
    }),
  );
}

export async function applyBetterAuthResponse(response: Response, reply: FastifyReply) {
  reply.status(response.status);
  applyResponseHeaders(response, reply);

  if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
    return reply.send();
  }

  const body = await response.text();
  reply.send(body.length > 0 ? body : null);
}
