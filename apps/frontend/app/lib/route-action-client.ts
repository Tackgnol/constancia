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

  const response = await fetch(actionUrl, {
    method: 'post',
    body: formData,
    credentials: 'same-origin',
  });

  const payload = await response.json().catch(() => null);

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
