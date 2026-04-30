import { decode } from 'turbo-stream';

export type RouteActionResult<T = undefined> =
  | {
      status: 'success';
      message?: string;
      data?: T;
    }
  | {
      status: 'error';
      message: string;
    };

function isRouteActionResult<T>(value: unknown): value is RouteActionResult<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    (((value as { status?: unknown }).status === 'success' &&
      (!('message' in value) || typeof (value as { message?: unknown }).message === 'string')) ||
      ((value as { status?: unknown }).status === 'error' &&
        typeof (value as { message?: unknown }).message === 'string'))
  );
}

function toDataUrl(actionUrl: string): string {
  const [path, search = ''] = actionUrl.split('?');
  return `${path}.data${search ? `?${search}` : ''}`;
}

async function decodeActionResponse(response: Response): Promise<unknown> {
  if (!response.body) {
    return null;
  }

  const decoded = await decode(response.body);
  try {
    const value = decoded.value as unknown;
    if (
      typeof value === 'object' &&
      value !== null &&
      'data' in value &&
      (value as { data?: unknown }).data !== undefined
    ) {
      return (value as { data: unknown }).data;
    }
    return value;
  } finally {
    await decoded.done.catch(() => undefined);
  }
}

export async function postRouteAction<T>(
  actionUrl: string,
  values: Record<string, FormDataEntryValue | null | undefined>,
): Promise<RouteActionResult<T>> {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined) {
      formData.append(key, value);
    }
  }

  const dataUrl = toDataUrl(actionUrl);
  const response = await fetch(dataUrl, {
    method: 'post',
    body: formData,
    credentials: 'same-origin',
  });

  const payload = await decodeActionResponse(response).catch(() => null);

  if (isRouteActionResult<T>(payload)) {
    return payload;
  }

  if (!response.ok) {
    return {
      status: 'error',
      message: `Request failed with status ${response.status}.`,
    };
  }

  return {
    status: 'error',
    message: 'The frontend action returned an unexpected payload.',
  };
}
