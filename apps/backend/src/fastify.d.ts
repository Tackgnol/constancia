import 'fastify';
import type { BackendConfig } from './config.js';
import type { auth } from './auth.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: BackendConfig;
  }

  interface FastifyRequest {
    session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
  }
}
