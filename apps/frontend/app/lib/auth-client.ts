import { createAuthClient } from 'better-auth/react';
import { genericOAuthClient, magicLinkClient } from 'better-auth/client/plugins';

const authClientOptions = {
  basePath: '/api/auth',
  fetchOptions: {
    credentials: 'include' as const,
  },
  plugins: [magicLinkClient(), genericOAuthClient()],
};

const authClientInstance: ReturnType<typeof createAuthClient<typeof authClientOptions>> =
  createAuthClient(authClientOptions);

export const authClient: typeof authClientInstance = authClientInstance;
