interface ApiErrorDetail {
  path: string;
  categories: string[];
  inputTypes: string[];
}

interface ApiErrorData {
  message: string;
  code?: string;
  details?: ApiErrorDetail[];
}

interface ApiErrorResponse {
  status: 'error';
  data: ApiErrorData;
}

export class ApiResponseError extends Error {
  readonly code?: string;
  readonly details: ApiErrorDetail[];

  constructor(message: string, options: { code?: string; details?: ApiErrorDetail[] } = {}) {
    super(message);
    this.name = 'ApiResponseError';
    this.code = options.code;
    this.details = options.details ?? [];
  }
}

export function assertApiOk(response: unknown, fallbackMessage: string): void {
  if (isApiErrorResponse(response)) {
    throw new ApiResponseError(formatApiErrorMessage(response.data), {
      code: response.data.code,
      details: response.data.details,
    });
  }

  if (!isRecord(response) || response.status !== 'ok') {
    throw new ApiResponseError(fallbackMessage);
  }
}

export function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiResponseError) {
    return error.message;
  }

  return fallbackMessage;
}

function formatApiErrorMessage(data: ApiErrorData): string {
  if (!data.details || data.details.length === 0) {
    return data.message;
  }

  const detailText = data.details
    .map((detail) => {
      const categories = detail.categories.length > 0 ? detail.categories.join(', ') : 'flagged';
      return `${stripBodyPrefix(detail.path)} (${categories})`;
    })
    .join('; ');

  return `${data.message} Flagged fields: ${detailText}.`;
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!isRecord(value) || value.status !== 'error' || !isRecord(value.data)) {
    return false;
  }

  const { data } = value;
  return (
    typeof data.message === 'string' &&
    (data.code === undefined || typeof data.code === 'string') &&
    (data.details === undefined || isApiErrorDetails(data.details))
  );
}

function isApiErrorDetails(value: unknown): value is ApiErrorDetail[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.path === 'string' &&
        isStringArray(entry.categories) &&
        isStringArray(entry.inputTypes),
    )
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stripBodyPrefix(path: string): string {
  return path.startsWith('body.') ? path.slice('body.'.length) : path;
}
