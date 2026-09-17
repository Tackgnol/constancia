// Must be the first import: Sentry's auto-instrumentation has to patch
// Node's http/fs modules before anything else (including Fastify) loads them.
import './instrument.js';
import { pathToFileURL } from 'node:url';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

export { buildApp } from './app.js';
export { loadConfig } from './config.js';
export type { BackendConfig } from './config.js';

export async function startServer() {
  const config = loadConfig();
  const app = await buildApp({ config });

  try {
    await app.listen({ host: config.host, port: config.port });
    return app;
  } catch (error) {
    app.log.error(error);
    await app.close();
    throw error;
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (entryUrl === import.meta.url) {
  await startServer();
}
