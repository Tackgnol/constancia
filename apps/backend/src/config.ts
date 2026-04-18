export interface BackendConfig {
  host: string;
  port: number;
  nodeEnv: string;
  apiPrefix: string;
  docsPrefix: string;
  openApiPath: string;
}

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_API_PREFIX = '/api/v1';
const DEFAULT_DOCS_PREFIX = '/documentation';
const DEFAULT_OPENAPI_PATH = '/openapi.json';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BackendConfig {
  return {
    host: env.BACKEND_HOST ?? DEFAULT_HOST,
    port: parsePort(env.PORT),
    nodeEnv: env.NODE_ENV ?? 'development',
    apiPrefix: env.API_PREFIX ?? DEFAULT_API_PREFIX,
    docsPrefix: env.DOCS_PREFIX ?? DEFAULT_DOCS_PREFIX,
    openApiPath: env.OPENAPI_PATH ?? DEFAULT_OPENAPI_PATH,
  };
}

function parsePort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PORT;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid PORT value: "${value}"`);
  }

  return parsed;
}
