export interface BotConfig {
  nodeEnv: string;
  backendUrl: string;
  frontendUrl: string;
  botApiKey: string;
  botHttpHost: string;
  botHttpPort: number;
  httpLoggerEnabled: boolean;
  discordToken?: string;
  clientId?: string;
  guildId?: string;
}

const DEFAULT_BACKEND_URL = 'http://localhost:3000';
const DEFAULT_FRONTEND_URL = 'http://localhost:3000';
const DEFAULT_BOT_HTTP_PORT = 3002;
const DEFAULT_BOT_HTTP_HOST = '0.0.0.0';
const DEFAULT_DEV_BOT_API_KEY = 'constancia-bot-dev-key';

export function loadBotConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';

  const botApiKey = env.BOT_API_KEY ?? (isProduction ? undefined : DEFAULT_DEV_BOT_API_KEY);
  if (!botApiKey) {
    throw new Error('BOT_API_KEY must be set in production');
  }

  return {
    nodeEnv,
    backendUrl: env.BACKEND_URL ?? DEFAULT_BACKEND_URL,
    frontendUrl: env.FRONTEND_URL ?? DEFAULT_FRONTEND_URL,
    botApiKey,
    botHttpHost: env.BOT_HTTP_HOST ?? DEFAULT_BOT_HTTP_HOST,
    botHttpPort: parsePort(env.BOT_HTTP_PORT, DEFAULT_BOT_HTTP_PORT, 'BOT_HTTP_PORT'),
    httpLoggerEnabled: nodeEnv !== 'test',
    ...(env.DISCORD_TOKEN ? { discordToken: env.DISCORD_TOKEN } : {}),
    ...(env.CLIENT_ID ? { clientId: env.CLIENT_ID } : {}),
    ...(env.GUILD_ID ? { guildId: env.GUILD_ID } : {}),
  };
}

export function createBotAuthHeaders(config: BotConfig = loadBotConfig()): Record<string, string> {
  return { 'x-bot-key': config.botApiKey };
}

export function botRequestOptions(config: BotConfig = loadBotConfig()): RequestInit {
  return {
    headers: createBotAuthHeaders(config),
  };
}

function parsePort(value: string | undefined, fallback: number, label: string): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label} value: "${value}"`);
  }

  return parsed;
}
