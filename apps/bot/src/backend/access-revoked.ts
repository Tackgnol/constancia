const ACCESS_REVOKED_CODE = 'ACCESS_REVOKED';
const GENERIC_ERROR_CONTENT = 'Something went wrong.';

export class BotAccessRevokedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BotAccessRevokedError';
  }
}

export interface ApiEnvelope<T> {
  status: string;
  data: T;
}

export function accessRevokedMessage(response: unknown): string | null {
  if (typeof response !== 'object' || response === null) {
    return null;
  }

  const envelope = response as { status?: unknown; data?: unknown };
  if (envelope.status === 'ok' || typeof envelope.data !== 'object' || envelope.data === null) {
    return null;
  }

  const data = envelope.data as { message?: unknown; code?: unknown };
  return data.code === ACCESS_REVOKED_CODE && typeof data.message === 'string'
    ? data.message
    : null;
}

export function errorReplyContent(error: unknown): string {
  return error instanceof BotAccessRevokedError ? error.message : GENERIC_ERROR_CONTENT;
}

export function requireApiData<T>(response: ApiEnvelope<T>, operation: string): T {
  if (response.status !== 'ok') {
    const revoked = accessRevokedMessage(response);
    if (revoked !== null) throw new BotAccessRevokedError(revoked);
    throw new Error(`Backend failed to ${operation}`);
  }
  return response.data;
}
