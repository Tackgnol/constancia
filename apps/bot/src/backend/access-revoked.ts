const ACCESS_REVOKED_CODE = 'ACCESS_REVOKED';
const CAMPAIGN_ADMIN_REQUIRED_CODE = 'CAMPAIGN_ADMIN_REQUIRED';
const GENERIC_ERROR_CONTENT = 'Something went wrong.';

export class BotAccessRevokedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BotAccessRevokedError';
  }
}

export class BotCampaignAdminRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BotCampaignAdminRequiredError';
  }
}

export class BotTestSubmissionRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BotTestSubmissionRejectedError';
  }
}

const TEST_SUBMISSION_REJECTED_CODES = ['TEST_CLOSED', 'ALREADY_SUBMITTED'];

export interface ApiEnvelope<T> {
  status: string;
  data: T;
}

function structuredErrorMessage(response: unknown, code: string): string | null {
  if (typeof response !== 'object' || response === null) {
    return null;
  }

  const envelope = response as { status?: unknown; data?: unknown };
  if (envelope.status === 'ok' || typeof envelope.data !== 'object' || envelope.data === null) {
    return null;
  }

  const data = envelope.data as { message?: unknown; code?: unknown };
  return data.code === code && typeof data.message === 'string' ? data.message : null;
}

export function accessRevokedMessage(response: unknown): string | null {
  return structuredErrorMessage(response, ACCESS_REVOKED_CODE);
}

export function campaignAdminRequiredMessage(response: unknown): string | null {
  return structuredErrorMessage(response, CAMPAIGN_ADMIN_REQUIRED_CODE);
}

export function testSubmissionRejectedMessage(response: unknown): string | null {
  return (
    TEST_SUBMISSION_REJECTED_CODES.map((code) => structuredErrorMessage(response, code)).find(
      (message) => message !== null,
    ) ?? null
  );
}

// Routine, expected outcomes (banned user, non-GM, closed/duplicate Test) skip GlitchTip capture.
export function isRoutineBotError(error: unknown): boolean {
  return (
    error instanceof BotAccessRevokedError ||
    error instanceof BotCampaignAdminRequiredError ||
    error instanceof BotTestSubmissionRejectedError
  );
}

export function errorReplyContent(error: unknown): string {
  return error instanceof Error && isRoutineBotError(error) ? error.message : GENERIC_ERROR_CONTENT;
}

export function requireApiData<T>(response: ApiEnvelope<T>, operation: string): T {
  if (response.status !== 'ok') {
    const revoked = accessRevokedMessage(response);
    if (revoked !== null) throw new BotAccessRevokedError(revoked);
    const adminRequired = campaignAdminRequiredMessage(response);
    if (adminRequired !== null) throw new BotCampaignAdminRequiredError(adminRequired);
    const rejected = testSubmissionRejectedMessage(response);
    if (rejected !== null) throw new BotTestSubmissionRejectedError(rejected);
    throw new Error(`Backend failed to ${operation}`);
  }
  return response.data;
}
