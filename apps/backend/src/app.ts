import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';
import { loadConfig, type BackendConfig } from './config.js';
import betterAuthPlugin from './plugins/better-auth-plugin.js';
import configPlugin from './plugins/config-plugin.js';
import openApiPlugin from './plugins/openapi-plugin.js';
import requestErrorPlugin from './plugins/request-error-plugin.js';
import rootRoutes from './routes/root-routes.js';
import healthRoutes from './routes/health-routes.js';
import apiRoutes from './routes/api-routes.js';

export interface BuildAppOptions {
  config?: BackendConfig;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const app = Fastify({
    logger: {
      level: config.nodeEnv === 'test' ? 'silent' : 'info',
    },
  });

  await app.register(configPlugin, { config });
  await app.register(requestErrorPlugin);
  await app.register(multipart, {
    limits: {
      fileSize: config.uploadMaxBytes,
      files: 1,
    },
  });
  await app.register(cors, {
    origin: config.nodeEnv === 'development' ? true : [config.frontendUrl],
    credentials: true,
  });
  await app.register(betterAuthPlugin);
  await app.register(openApiPlugin);
  await app.register(rootRoutes);
  await app.register(healthRoutes);
  await app.register(apiRoutes, { prefix: app.config.apiPrefix });

  return app;
}
