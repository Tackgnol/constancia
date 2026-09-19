import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { clientIp } from '../auth/client-ip.js';

function req(peer: string | undefined, header?: string, ip = '172.18.0.1') {
  return {
    ip,
    headers: header === undefined ? {} : { 'cf-connecting-ip': header },
    socket: { remoteAddress: peer },
  } as Parameters<typeof clientIp>[0];
}

describe('clientIp', () => {
  it('honours CF-Connecting-IP from a private peer', () => {
    expect(clientIp(req('172.18.0.1', '203.0.113.7'))).toBe('203.0.113.7');
    expect(clientIp(req('::ffff:172.18.0.1', '203.0.113.7'))).toBe('203.0.113.7');
  });

  it('ignores the header from a public peer', () => {
    expect(clientIp(req('198.51.100.9', '203.0.113.7', '198.51.100.9'))).toBe('198.51.100.9');
  });

  it('falls back on a malformed or missing header', () => {
    expect(clientIp(req('172.18.0.1', 'not-an-ip'))).toBe('172.18.0.1');
    expect(clientIp(req('172.18.0.1'))).toBe('172.18.0.1');
  });

  it('gives two visitors behind the same proxy different keys', async () => {
    const app = Fastify();
    app.get('/', (r) => clientIp(r));
    const [a, b] = await Promise.all(
      ['203.0.113.1', '203.0.113.2'].map((h) =>
        app.inject({ url: '/', headers: { 'cf-connecting-ip': h }, remoteAddress: '172.18.0.1' }),
      ),
    );
    expect([a.body, b.body]).toEqual(['203.0.113.1', '203.0.113.2']);
  });
});
