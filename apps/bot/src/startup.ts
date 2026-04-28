import type { Client } from 'discord.js';

const RETRYABLE_DISCORD_LOGIN_ERROR_CODES = new Set([
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'ETIMEDOUT',
]);

type StartupLogger = Pick<Console, 'error' | 'info' | 'warn'>;
type SleepFn = (ms: number) => Promise<void>;
type LoginClient = Pick<Client, 'destroy' | 'login'>;

export interface DiscordLoginRetryOptions {
  initialDelayMs?: number;
  logger?: StartupLogger;
  maxAttempts?: number;
  maxDelayMs?: number;
  sleep?: SleepFn;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  const { code } = error;
  return typeof code === 'string' ? code : undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function destroyClientQuietly(client: LoginClient, logger: StartupLogger): Promise<void> {
  try {
    await client.destroy();
  } catch (error) {
    logger.warn('[discord] Failed to clean up client before retrying login.', error);
  }
}

export function isRetryableDiscordLoginError(error: unknown): boolean {
  const directCode = getErrorCode(error);
  if (directCode && RETRYABLE_DISCORD_LOGIN_ERROR_CODES.has(directCode)) {
    return true;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'cause' in error &&
    error.cause !== undefined
  ) {
    return isRetryableDiscordLoginError(error.cause);
  }

  return false;
}

export function getDiscordLoginRetryDelayMs(
  attempt: number,
  initialDelayMs = 1_000,
  maxDelayMs = 30_000,
): number {
  const normalizedAttempt = Math.max(1, attempt);
  return Math.min(maxDelayMs, initialDelayMs * 2 ** (normalizedAttempt - 1));
}

export async function loginToDiscordWithRetry(
  client: LoginClient,
  token: string,
  options: DiscordLoginRetryOptions = {},
): Promise<void> {
  const logger = options.logger ?? console;
  const sleep = options.sleep ?? defaultSleep;
  const initialDelayMs = options.initialDelayMs ?? 1_000;
  const maxDelayMs = options.maxDelayMs ?? 30_000;
  const maxAttempts = options.maxAttempts;

  let attempt = 0;

  while (true) {
    attempt += 1;

    try {
      if (attempt > 1) {
        logger.info(`[discord] Retrying login (attempt ${attempt}).`);
      }

      await client.login(token);
      return;
    } catch (error) {
      const retryable = isRetryableDiscordLoginError(error);
      const attemptLimitReached = maxAttempts !== undefined && attempt >= maxAttempts;

      if (!retryable || attemptLimitReached) {
        logger.error(
          `[discord] Login failed on attempt ${attempt}: ${getErrorMessage(error)}`,
          error,
        );
        throw error;
      }

      const delayMs = getDiscordLoginRetryDelayMs(attempt, initialDelayMs, maxDelayMs);
      logger.warn(
        `[discord] Login failed with a retryable network error (${getErrorCode(error) ?? 'unknown'}). Retrying in ${delayMs}ms.`,
      );
      await destroyClientQuietly(client, logger);
      await sleep(delayMs);
    }
  }
}
