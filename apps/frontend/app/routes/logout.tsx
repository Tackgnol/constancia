import type { ActionFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { rewriteAuthSetCookieHeaders } from '@/lib/auth-cookies.server';
import { getApiBaseUrl } from '@/lib/api-url';

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

  for (const setCookie of rewriteAuthSetCookieHeaders(response.headers, request.url)) {
    headers.append('Set-Cookie', setCookie);
  }

  return redirect('/auth', { headers });
}
