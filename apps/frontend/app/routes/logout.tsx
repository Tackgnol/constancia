import type { ActionFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { getApiBaseUrl } from '@/lib/api-url';

function getSetCookieHeaders(headers: Headers) {
  const maybeHeaders = headers as Headers & { getSetCookie?: () => string[] };
  const setCookieHeaders = maybeHeaders.getSetCookie?.();

  if (setCookieHeaders && setCookieHeaders.length > 0) {
    return setCookieHeaders;
  }

  const setCookie = headers.get('set-cookie');
  return setCookie ? [setCookie] : [];
}

function makeFrontendCookie(setCookie: string) {
  return setCookie
    .split(';')
    .map((part) => part.trim())
    .filter((part) => !part.toLowerCase().startsWith('domain='))
    .join('; ');
}

export async function loader() {
  return redirect('/auth');
}

export async function action({ request }: ActionFunctionArgs) {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/logout`, {
    method: 'POST',
    headers: {
      cookie: request.headers.get('Cookie') || '',
    },
  });
  const headers = new Headers();

  for (const setCookie of getSetCookieHeaders(response.headers)) {
    headers.append('Set-Cookie', makeFrontendCookie(setCookie));
  }

  return redirect('/auth', { headers });
}
