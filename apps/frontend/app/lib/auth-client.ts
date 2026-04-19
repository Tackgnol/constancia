import { createAuthClient } from 'better-auth/react';
import { magicLinkClient } from 'better-auth/client/plugins';

const authBaseUrl = import.meta.env.SSR
  ? (process.env.BACKEND_URL ?? 'http://backend:3000')
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3001');

const authClientOptions = {
  baseURL: authBaseUrl,
  basePath: '/api/auth',
  fetchOptions: {
    credentials: 'include' as const,
  },
  plugins: [magicLinkClient()],
};

const authClientInstance: ReturnType<typeof createAuthClient<typeof authClientOptions>> =
  createAuthClient(authClientOptions);

export const authClient: typeof authClientInstance = authClientInstance;
