export interface ModerationBlockDetail {
  path: string;
  categories: string[];
  inputTypes: string[];
}

export interface ErrorResponseData {
  message: string;
  code: string;
  details?: ModerationBlockDetail[];
}

export interface ErrorResponseBody {
  status: 'error';
  data: ErrorResponseData;
}

interface HandledRequestError extends Error {
  statusCode: number;
  code: string;
  details?: ModerationBlockDetail[];
}

export class ModerationBlockedError extends Error {
  readonly statusCode = 403;
  readonly code = 'CONTENT_MODERATION_BLOCKED';
  readonly details: ModerationBlockDetail[];

  constructor(
    message = 'Submission rejected by safety filters.',
    details: ModerationBlockDetail[] = [],
  ) {
    super(message);
    this.name = 'ModerationBlockedError';
    this.details = details;
  }
}

export class ModerationUnavailableError extends Error {
  readonly statusCode = 503;
  readonly code = 'CONTENT_MODERATION_UNAVAILABLE';

  constructor(message = 'Safety checks are temporarily unavailable. Please try again later.') {
    super(message);
    this.name = 'ModerationUnavailableError';
  }
}

export class UploadPermissionError extends Error {
  readonly statusCode = 403;
  readonly code = 'UPLOADS_DISABLED';

  constructor(message = 'Uploads are disabled for this account.') {
    super(message);
    this.name = 'UploadPermissionError';
  }
}

export class UploadValidationError extends Error {
  readonly statusCode = 400;
  readonly code = 'UPLOAD_VALIDATION_FAILED';

  constructor(message: string) {
    super(message);
    this.name = 'UploadValidationError';
  }
}

export class UploadQuotaExceededError extends Error {
  readonly statusCode = 413;
  readonly code = 'UPLOAD_QUOTA_EXCEEDED';

  constructor(message = 'Upload allowance exceeded.') {
    super(message);
    this.name = 'UploadQuotaExceededError';
  }
}

function isServiceRequestError(error: unknown): error is HandledRequestError {
  if (!(error instanceof Error) || !('code' in error) || !('statusCode' in error)) {
    return false;
  }

  return typeof error.code === 'string' && typeof error.statusCode === 'number';
}

export function isHandledRequestError(error: unknown): error is HandledRequestError {
  return (
    error instanceof ModerationBlockedError ||
    error instanceof ModerationUnavailableError ||
    error instanceof UploadPermissionError ||
    error instanceof UploadQuotaExceededError ||
    error instanceof UploadValidationError ||
    isServiceRequestError(error)
  );
}

export function serializeHandledRequestError(error: HandledRequestError): ErrorResponseBody {
  return {
    status: 'error',
    data: {
      message: error.message,
      code: error.code,
      ...(error.details && error.details.length > 0 ? { details: error.details } : {}),
    },
  };
}
