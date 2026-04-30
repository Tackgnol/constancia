const DEFAULT_INTERNAL_API_URL = 'http://backend:3000';
const DEFAULT_LOCAL_API_URL = 'http://localhost:3001';

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function getBrowserApiBaseUrl() {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCAL_API_URL;
  }

  if (isLocalHostname(window.location.hostname)) {
    return DEFAULT_LOCAL_API_URL;
  }

  if (window.location.hostname.startsWith('api.')) {
    return window.location.origin;
  }

  return `${window.location.protocol}//api.${window.location.hostname}`;
}

export function getApiBaseUrl() {
  return import.meta.env.SSR
    ? (process.env.BACKEND_URL ?? DEFAULT_INTERNAL_API_URL)
    : getBrowserApiBaseUrl();
}

export function getPublicApiBaseUrl() {
  return import.meta.env.SSR
    ? (process.env.BACKEND_PUBLIC_URL ?? process.env.BACKEND_URL ?? DEFAULT_INTERNAL_API_URL)
    : getBrowserApiBaseUrl();
}
