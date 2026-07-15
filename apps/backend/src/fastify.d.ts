import 'fastify';
import '@fastify/multipart';
import type { BackendConfig } from './config.js';
import type { AccessContext } from './auth/access-context.js';
import type { auth } from './auth.js';
import type { CampaignScope } from './services/campaign-access.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: BackendConfig;
  }

  interface FastifyRequest {
    session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
    access: AccessContext;
    campaignScope: CampaignScope;
  }
}
