import { createAuthClient } from 'better-auth/react';
import { magicLinkClient } from 'better-auth/client/plugins';
import { getApiBaseUrl } from './api-url';

const authClientOptions = {
  baseURL: getApiBaseUrl(),
  basePath: '/api/auth',
  fetchOptions: {
    credentials: 'include' as const,
  },
  plugins: [magicLinkClient()],
};

const authClientInstance: ReturnType<typeof createAuthClient<typeof authClientOptions>> =
  createAuthClient(authClientOptions);

export const authClient: typeof authClientInstance = authClientInstance;
