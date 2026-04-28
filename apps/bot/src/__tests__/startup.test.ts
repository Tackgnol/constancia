import { describe, expect, it, vi } from 'vitest';
import {
  getDiscordLoginRetryDelayMs,
  isRetryableDiscordLoginError,
  loginToDiscordWithRetry,
} from '../startup.js';

describe('discord startup retry helpers', () => {
  it('treats transient DNS failures as retryable', () => {
    expect(
      isRetryableDiscordLoginError({
        code: 'EAI_AGAIN',
        hostname: 'discord.com',
        syscall: 'getaddrinfo',
      }),
    ).toBe(true);
  });

  it('does not treat invalid-token style failures as retryable', () => {
    expect(isRetryableDiscordLoginError(new Error('An invalid token was provided.'))).toBe(false);
  });

  it('backs off exponentially and caps the retry delay', () => {
    expect(getDiscordLoginRetryDelayMs(1)).toBe(1_000);
    expect(getDiscordLoginRetryDelayMs(2)).toBe(2_000);
    expect(getDiscordLoginRetryDelayMs(6)).toBe(30_000);
    expect(getDiscordLoginRetryDelayMs(8)).toBe(30_000);
  });

  it('retries retryable login failures until the client connects', async () => {
    const login = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('DNS lookup failed'), { code: 'EAI_AGAIN' }))
      .mockResolvedValueOnce('discord-token');
    const destroy = vi.fn().mockResolvedValue(undefined);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const logger = {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    };

    await expect(
      loginToDiscordWithRetry({ destroy, login }, 'discord-token', {
        logger,
        sleep,
        initialDelayMs: 25,
        maxDelayMs: 100,
      }),
    ).resolves.toBeUndefined();

    expect(login).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(25);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('rethrows non-retryable login failures immediately', async () => {
    const login = vi.fn().mockRejectedValue(new Error('An invalid token was provided.'));
    const destroy = vi.fn().mockResolvedValue(undefined);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const logger = {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    };

    await expect(
      loginToDiscordWithRetry({ destroy, login }, 'discord-token', {
        logger,
        sleep,
        maxAttempts: 3,
      }),
    ).rejects.toThrow('An invalid token was provided.');

    expect(login).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
