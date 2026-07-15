interface FrontendMagicLinkOptions {
  token: string;
  callbackURL?: string;
  frontendUrl: string;
  frontendPath: string;
}

function resolveFrontendCallbackPath(callbackURL: string | undefined, frontendUrl: string) {
  const frontend = new URL(frontendUrl);
  const callback = new URL(callbackURL ?? '/', frontend);

  if (callback.origin !== frontend.origin) {
    return '/';
  }

  return `${callback.pathname}${callback.search}${callback.hash}`;
}

export function createFrontendMagicLink({
  token,
  callbackURL,
  frontendUrl,
  frontendPath,
}: FrontendMagicLinkOptions) {
  const url = new URL(frontendPath, frontendUrl);
  url.searchParams.set('token', token);
  url.searchParams.set('next', resolveFrontendCallbackPath(callbackURL, frontendUrl));

  return url.toString();
}
