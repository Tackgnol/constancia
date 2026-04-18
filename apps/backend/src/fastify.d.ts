import 'fastify';
import type { BackendConfig } from './config.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: BackendConfig;
  }
}
