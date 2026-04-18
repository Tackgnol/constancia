export interface BackendConfig {
  host: string;
  port: number;
  nodeEnv: string;
  apiPrefix: string;
  docsPrefix: string;
  openApiPath: string;
  frontendUrl: string;
  betterAuthSecret: string;
  betterAuthUrl: string;
  betterAuthPath: string;
  magicLinkFrontendPath: string;
}

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_API_PREFIX = '/api/v1';
const DEFAULT_DOCS_PREFIX = '/documentation';
const DEFAULT_OPENAPI_PATH = '/openapi.json';
const DEFAULT_FRONTEND_URL = 'http://localhost:3000';
const DEFAULT_BETTER_AUTH_URL = 'http://localhost:3001';
const DEFAULT_BETTER_AUTH_PATH = '/api/auth';
const DEFAULT_MAGIC_LINK_FRONTEND_PATH = '/auth';
const DEFAULT_BETTER_AUTH_SECRET = 'constancia-development-secret-change-me-12345';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BackendConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';

  if (isProduction && !env.BETTER_AUTH_SECRET) {
    throw new Error('BETTER_AUTH_SECRET must be set in production');
  }

  return {
    host: env.BACKEND_HOST ?? DEFAULT_HOST,
    port: parsePort(env.PORT),
    nodeEnv,
    apiPrefix: env.API_PREFIX ?? DEFAULT_API_PREFIX,
    docsPrefix: env.DOCS_PREFIX ?? DEFAULT_DOCS_PREFIX,
    openApiPath: env.OPENAPI_PATH ?? DEFAULT_OPENAPI_PATH,
    frontendUrl: env.FRONTEND_URL ?? DEFAULT_FRONTEND_URL,
    betterAuthSecret: env.BETTER_AUTH_SECRET ?? DEFAULT_BETTER_AUTH_SECRET,
    betterAuthUrl: env.BETTER_AUTH_URL ?? DEFAULT_BETTER_AUTH_URL,
    betterAuthPath: env.BETTER_AUTH_PATH ?? DEFAULT_BETTER_AUTH_PATH,
    magicLinkFrontendPath: env.MAGIC_LINK_FRONTEND_PATH ?? DEFAULT_MAGIC_LINK_FRONTEND_PATH,
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
