import { describe, expect, it } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { resolveOrigin } from '../auth/http.js';

function createRequest(headers: Record<string, string | string[] | undefined>): FastifyRequest {
  return {
    headers,
  } as FastifyRequest;
}

describe('resolveOrigin', () => {
  it('prefers forwarded proto and host when available', () => {
    const request = createRequest({
      host: 'backend:3000',
      'x-forwarded-host': 'api.constancia.example.com',
      'x-forwarded-proto': 'https',
    });

    expect(resolveOrigin(request)).toBe('https://api.constancia.example.com');
  });

  it('falls back to the direct host header for internal requests', () => {
    const request = createRequest({
      host: 'backend:3000',
    });

    expect(resolveOrigin(request)).toBe('http://backend:3000');
  });
});
