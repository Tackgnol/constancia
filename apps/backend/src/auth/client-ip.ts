import { BlockList, isIP } from 'node:net';
import type { FastifyRequest } from 'fastify';

const PRIVATE_PEERS = new BlockList();
PRIVATE_PEERS.addSubnet('127.0.0.0', 8, 'ipv4');
PRIVATE_PEERS.addSubnet('10.0.0.0', 8, 'ipv4');
PRIVATE_PEERS.addSubnet('172.16.0.0', 12, 'ipv4');
PRIVATE_PEERS.addSubnet('192.168.0.0', 16, 'ipv4');
PRIVATE_PEERS.addAddress('::1', 'ipv6');
PRIVATE_PEERS.addSubnet('fc00::', 7, 'ipv6');

const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

function isPrivatePeer(address: string | undefined): boolean {
  if (!address) return false;
  const ip = IPV4_MAPPED.exec(address)?.[1] ?? address;
  const family = isIP(ip);
  return family !== 0 && PRIVATE_PEERS.check(ip, family === 4 ? 'ipv4' : 'ipv6');
}

/**
 * Real visitor IP behind Cloudflare -> Caddy -> Docker (STD-001). `CF-Connecting-IP`
 * is honoured only when valid and the socket peer is private/loopback; otherwise `request.ip`.
 * Duplicate of `clientIp` in @tackgnol/rpgtools-shared-auth; replace with the import if constancia adopts it.
 */
export function clientIp(request: Pick<FastifyRequest, 'ip' | 'headers' | 'socket'>): string {
  const header = request.headers['cf-connecting-ip'];
  const candidate = typeof header === 'string' ? header.trim() : '';
  return isIP(candidate) !== 0 && isPrivatePeer(request.socket?.remoteAddress)
    ? candidate
    : request.ip;
}
