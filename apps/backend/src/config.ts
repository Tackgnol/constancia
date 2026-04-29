import { resolve } from 'node:path';

export interface BackendConfig {
  host: string;
  port: number;
  nodeEnv: string;
  apiPrefix: string;
  docsPrefix: string;
  openApiPath: string;
  frontendUrl: string;
  authCookieDomain?: string;
  betterAuthSecret: string;
  betterAuthUrl: string;
  betterAuthPath: string;
  discordClientId?: string;
  discordClientSecret?: string;
  magicLinkFrontendPath: string;
  botApiKey: string;
  botInternalUrl: string;
  backendPublicUrl: string;
  openAiApiKey?: string;
  contentModerationEnabled: boolean;
  contentModerationModel: string;
  contentModerationFailClosed: boolean;
  uploadStorageDriver: 'local' | 'r2';
  uploadStorageDir: string;
  uploadMaxBytes: number;
  uploadImageMaxDimension: number;
  uploadWebpQuality: number;
  uploadDefaultEnabled: boolean;
  uploadDefaultAllowanceBytes: number;
  uploadQuotaWarningPercent: number;
  uploadPublicBaseUrl?: string;
  r2Endpoint?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2Bucket?: string;
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
const DEFAULT_DEV_BOT_API_KEY = 'constancia-bot-dev-key';
const DEFAULT_BOT_INTERNAL_URL = 'http://localhost:3002';
const DEFAULT_CONTENT_MODERATION_MODEL = 'omni-moderation-latest';
const DEFAULT_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_UPLOAD_IMAGE_MAX_DIMENSION = 1024;
const DEFAULT_UPLOAD_WEBP_QUALITY = 80;
const DEFAULT_UPLOAD_STORAGE_DIR = resolve(process.cwd(), 'data', 'uploads');
const DEFAULT_UPLOAD_DEFAULT_ALLOWANCE_BYTES = 50 * 1024 * 1024;
const DEFAULT_UPLOAD_QUOTA_WARNING_PERCENT = 80;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BackendConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const port = parsePort(env.PORT);
  const contentModerationEnabled = parseBoolean(env.CONTENT_MODERATION_ENABLED, false);
  const frontendUrl = env.FRONTEND_URL ?? DEFAULT_FRONTEND_URL;
  const betterAuthUrl = env.BETTER_AUTH_URL ?? DEFAULT_BETTER_AUTH_URL;

  if (isProduction && !env.BETTER_AUTH_SECRET) {
    throw new Error('BETTER_AUTH_SECRET must be set in production');
  }

  if (contentModerationEnabled && !env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY must be set when CONTENT_MODERATION_ENABLED=true');
  }

  const uploadStorageDriver = parseUploadStorageDriver(env.UPLOAD_STORAGE_DRIVER);
  if (uploadStorageDriver === 'r2') {
    assertRequiredEnv(env.R2_ENDPOINT, 'R2_ENDPOINT');
    assertRequiredEnv(env.R2_ACCESS_KEY_ID, 'R2_ACCESS_KEY_ID');
    assertRequiredEnv(env.R2_SECRET_ACCESS_KEY, 'R2_SECRET_ACCESS_KEY');
    assertRequiredEnv(env.R2_BUCKET, 'R2_BUCKET');
  }

  const botApiKey = env.BOT_API_KEY ?? (isProduction ? undefined : DEFAULT_DEV_BOT_API_KEY);
  if (!botApiKey) {
    throw new Error('BOT_API_KEY must be set in production');
  }

  if (isProduction && !env.BOT_INTERNAL_URL) {
    throw new Error('BOT_INTERNAL_URL must be set in production');
  }

  return {
    host: env.BACKEND_HOST ?? DEFAULT_HOST,
    port,
    nodeEnv,
    apiPrefix: env.API_PREFIX ?? DEFAULT_API_PREFIX,
    docsPrefix: env.DOCS_PREFIX ?? DEFAULT_DOCS_PREFIX,
    openApiPath: env.OPENAPI_PATH ?? DEFAULT_OPENAPI_PATH,
    frontendUrl,
    authCookieDomain: resolveAuthCookieDomain(env.AUTH_COOKIE_DOMAIN, frontendUrl, betterAuthUrl),
    betterAuthSecret: env.BETTER_AUTH_SECRET ?? DEFAULT_BETTER_AUTH_SECRET,
    betterAuthUrl,
    betterAuthPath: env.BETTER_AUTH_PATH ?? DEFAULT_BETTER_AUTH_PATH,
    discordClientId: env.DISCORD_CLIENT_ID,
    discordClientSecret: env.DISCORD_CLIENT_SECRET,
    magicLinkFrontendPath: env.MAGIC_LINK_FRONTEND_PATH ?? DEFAULT_MAGIC_LINK_FRONTEND_PATH,
    botApiKey,
    botInternalUrl: env.BOT_INTERNAL_URL ?? DEFAULT_BOT_INTERNAL_URL,
    backendPublicUrl: env.BACKEND_PUBLIC_URL ?? `http://localhost:${port}`,
    openAiApiKey: env.OPENAI_API_KEY,
    contentModerationEnabled,
    contentModerationModel: env.CONTENT_MODERATION_MODEL ?? DEFAULT_CONTENT_MODERATION_MODEL,
    contentModerationFailClosed: parseBoolean(env.CONTENT_MODERATION_FAIL_CLOSED, true),
    uploadStorageDriver,
    uploadStorageDir: resolve(env.UPLOAD_STORAGE_DIR ?? DEFAULT_UPLOAD_STORAGE_DIR),
    uploadMaxBytes: parsePositiveInt(
      env.UPLOAD_MAX_BYTES,
      DEFAULT_UPLOAD_MAX_BYTES,
      'UPLOAD_MAX_BYTES',
    ),
    uploadImageMaxDimension: parsePositiveInt(
      env.UPLOAD_IMAGE_MAX_DIMENSION,
      DEFAULT_UPLOAD_IMAGE_MAX_DIMENSION,
      'UPLOAD_IMAGE_MAX_DIMENSION',
    ),
    uploadWebpQuality: parseBoundedInt(
      env.UPLOAD_WEBP_QUALITY,
      DEFAULT_UPLOAD_WEBP_QUALITY,
      1,
      100,
      'UPLOAD_WEBP_QUALITY',
    ),
    uploadDefaultEnabled: parseBoolean(env.UPLOAD_DEFAULT_ENABLED, false),
    uploadDefaultAllowanceBytes: parsePositiveInt(
      env.UPLOAD_DEFAULT_ALLOWANCE_BYTES,
      DEFAULT_UPLOAD_DEFAULT_ALLOWANCE_BYTES,
      'UPLOAD_DEFAULT_ALLOWANCE_BYTES',
    ),
    uploadQuotaWarningPercent: parseBoundedInt(
      env.UPLOAD_QUOTA_WARNING_PERCENT,
      DEFAULT_UPLOAD_QUOTA_WARNING_PERCENT,
      1,
      100,
      'UPLOAD_QUOTA_WARNING_PERCENT',
    ),
    uploadPublicBaseUrl: env.UPLOAD_PUBLIC_BASE_URL,
    r2Endpoint: env.R2_ENDPOINT,
    r2AccessKeyId: env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: env.R2_SECRET_ACCESS_KEY,
    r2Bucket: env.R2_BUCKET,
  };
}

function resolveAuthCookieDomain(
  configuredDomain: string | undefined,
  frontendUrl: string,
  betterAuthUrl: string,
): string | undefined {
  if (configuredDomain && configuredDomain.trim().length > 0) {
    return configuredDomain.trim();
  }

  const frontendHost = extractHostname(frontendUrl);
  const betterAuthHost = extractHostname(betterAuthUrl);

  if (!frontendHost || !betterAuthHost || frontendHost === betterAuthHost) {
    return undefined;
  }

  if (isLocalOnlyHost(frontendHost) || isLocalOnlyHost(betterAuthHost)) {
    return undefined;
  }

  const sharedSuffix = getSharedHostnameSuffix(frontendHost, betterAuthHost);
  if (!sharedSuffix) {
    return undefined;
  }

  return sharedSuffix;
}

function extractHostname(value: string): string | undefined {
  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

function isLocalOnlyHost(hostname: string): boolean {
  if (hostname === 'localhost') {
    return true;
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    return true;
  }

  return hostname.includes(':');
}

function getSharedHostnameSuffix(leftHostname: string, rightHostname: string): string | undefined {
  const leftLabels = leftHostname.split('.');
  const rightLabels = rightHostname.split('.');
  const shared: string[] = [];

  while (leftLabels.length > 0 && rightLabels.length > 0) {
    const leftLabel = leftLabels[leftLabels.length - 1];
    const rightLabel = rightLabels[rightLabels.length - 1];

    if (leftLabel !== rightLabel) {
      break;
    }

    shared.unshift(leftLabel);
    leftLabels.pop();
    rightLabels.pop();
  }

  if (shared.length < 2) {
    return undefined;
  }

  return shared.join('.');
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

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new Error(`Invalid boolean value: "${value}"`);
}

function parseUploadStorageDriver(value: string | undefined): 'local' | 'r2' {
  if (value === undefined || value === 'local') {
    return 'local';
  }

  if (value === 'r2') {
    return 'r2';
  }

  throw new Error(`Invalid UPLOAD_STORAGE_DRIVER value: "${value}"`);
}

function assertRequiredEnv(value: string | undefined, label: string): void {
  if (!value) {
    throw new Error(`${label} must be set when UPLOAD_STORAGE_DRIVER=r2`);
  }
}

function parsePositiveInt(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label} value: "${value}"`);
  }

  return parsed;
}

function parseBoundedInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
  label: string,
): number {
  const parsed = parsePositiveInt(value, fallback, label);
  if (parsed < min || parsed > max) {
    throw new Error(`Invalid ${label} value: "${value}"`);
  }

  return parsed;
}
