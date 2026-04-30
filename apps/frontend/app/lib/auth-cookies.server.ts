const SESSION_COOKIE_NAME = 'better-auth.session_token';
const SECURE_SESSION_COOKIE_NAME = `__Secure-${SESSION_COOKIE_NAME}`;
const HOST_SESSION_COOKIE_NAME = `__Host-${SESSION_COOKIE_NAME}`;

function splitCombinedSetCookieHeader(header: string): string[] {
  const cookies: string[] = [];
  let start = 0;
  let inExpiresAttribute = false;

  for (let index = 0; index < header.length; index += 1) {
    const current = header[index];
    const upcoming = header.slice(index).toLowerCase();

    if (!inExpiresAttribute && upcoming.startsWith('expires=')) {
      inExpiresAttribute = true;
      index += 'expires='.length - 1;
      continue;
    }

    if (inExpiresAttribute && current === ';') {
      inExpiresAttribute = false;
      continue;
    }

    if (current === ',' && !inExpiresAttribute) {
      const nextChunk = header.slice(index + 1);
      if (/^\s*[^=;,\s]+=/u.test(nextChunk)) {
        cookies.push(header.slice(start, index).trim());
        start = index + 1;
      }
    }
  }

  const tail = header.slice(start).trim();
  if (tail.length > 0) {
    cookies.push(tail);
  }

  return cookies;
}

export function getSetCookieHeaders(headers: Headers): string[] {
  const maybeHeaders = headers as Headers & { getSetCookie?: () => string[] };
  const setCookieHeaders = maybeHeaders.getSetCookie?.();

  if (setCookieHeaders && setCookieHeaders.length > 0) {
    return setCookieHeaders;
  }

  const setCookie = headers.get('set-cookie');
  return setCookie ? splitCombinedSetCookieHeader(setCookie) : [];
}

function isSessionCookieName(name: string): boolean {
  return (
    name === SESSION_COOKIE_NAME ||
    name === SECURE_SESSION_COOKIE_NAME ||
    name === HOST_SESSION_COOKIE_NAME
  );
}

function parseSetCookie(setCookie: string) {
  const [nameValue = '', ...attributes] = setCookie.split(';').map((part) => part.trim());
  const separatorIndex = nameValue.indexOf('=');
  const name = separatorIndex >= 0 ? nameValue.slice(0, separatorIndex) : nameValue;
  const value = separatorIndex >= 0 ? nameValue.slice(separatorIndex + 1) : '';

  return {
    name,
    value,
    attributes,
  };
}

function isDeletionCookie(value: string, attributes: string[]): boolean {
  return attributes.some((attribute) => {
    const lowerAttribute = attribute.toLowerCase();
    return (
      value.length === 0 ||
      lowerAttribute === 'max-age=0' ||
      lowerAttribute.startsWith('expires=thu, 01 jan 1970')
    );
  });
}

function stripDomainAttribute(attributes: string[]): string[] {
  return attributes.filter((attribute) => !attribute.toLowerCase().startsWith('domain='));
}

function buildInsecureFrontendSessionCookie(value: string, attributes: string[]): string {
  const preservedAttributes = stripDomainAttribute(attributes).filter((attribute) => {
    const lowerAttribute = attribute.toLowerCase();
    return (
      lowerAttribute === 'httponly' ||
      lowerAttribute.startsWith('max-age=') ||
      lowerAttribute.startsWith('expires=')
    );
  });

  return [`${SESSION_COOKIE_NAME}=${value}`, ...preservedAttributes, 'Path=/', 'SameSite=Lax'].join(
    '; ',
  );
}

export function rewriteAuthSetCookie(setCookie: string, requestUrl: string): string {
  const { name, value, attributes } = parseSetCookie(setCookie);
  const isSecureOrigin = new URL(requestUrl).protocol === 'https:';

  if (!isSecureOrigin && isSessionCookieName(name)) {
    return buildInsecureFrontendSessionCookie(value, attributes);
  }

  return [`${name}=${value}`, ...stripDomainAttribute(attributes)].join('; ');
}

export function rewriteAuthSetCookieHeaders(headers: Headers, requestUrl: string): string[] {
  const rewrittenCookies: string[] = [];
  const isSecureOrigin = new URL(requestUrl).protocol === 'https:';

  let latestSessionCookie: string | null = null;
  let latestSessionDeletionCookie: string | null = null;

  for (const setCookie of getSetCookieHeaders(headers)) {
    const { name, value, attributes } = parseSetCookie(setCookie);
    const rewrittenCookie = rewriteAuthSetCookie(setCookie, requestUrl);

    if (!isSecureOrigin && isSessionCookieName(name)) {
      if (isDeletionCookie(value, attributes)) {
        latestSessionDeletionCookie = rewrittenCookie;
      } else {
        latestSessionCookie = rewrittenCookie;
      }
      continue;
    }

    rewrittenCookies.push(rewrittenCookie);
  }

  if (!isSecureOrigin) {
    if (latestSessionCookie) {
      rewrittenCookies.push(latestSessionCookie);
    } else if (latestSessionDeletionCookie) {
      rewrittenCookies.push(latestSessionDeletionCookie);
    }
  }

  return rewrittenCookies;
}
