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

// A rolling deploy/restart sends SIGTERM before killing the process. Without
// this, in-flight requests get dropped mid-response instead of finishing —
// app.close() already waits for Fastify's in-flight requests to drain.
function registerGracefulShutdown(app: Awaited<ReturnType<typeof buildApp>>): void {
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`Received ${signal}, draining in-flight requests before shutdown.`);
    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      app.log.error(error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (entryUrl === import.meta.url) {
  const app = await startServer();
  registerGracefulShutdown(app);
}
