import { defineConfig } from 'orval';

const openApiTarget = './apps/backend/openapi/openapi.json';
const apiClientGeneratedRoot = './packages/api-client/src/generated';

const fetchClientConfig = {
  includeHttpResponseReturnType: false,
} as const;

export default defineConfig({
  apiClient: {
    input: {
      target: openApiTarget,
    },
    output: {
      target: `${apiClientGeneratedRoot}/endpoints`,
      schemas: `${apiClientGeneratedRoot}/model`,
      client: 'fetch',
      mode: 'tags-split',
      clean: true,
      override: {
        fetch: fetchClientConfig,
        useNamedParameters: true,
      },
      urlEncodeParameters: true,
    },
  },
  apiClientZod: {
    input: {
      target: openApiTarget,
    },
    output: {
      target: `${apiClientGeneratedRoot}/endpoints`,
      client: 'zod',
      mode: 'tags-split',
      clean: false,
      fileExtension: '.zod.ts',
    },
  },
});
