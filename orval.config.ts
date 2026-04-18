import { defineConfig } from 'orval';

const openApiTarget = './apps/backend/openapi/openapi.json';

export default defineConfig({
  frontendApi: {
    input: {
      target: openApiTarget,
    },
    output: {
      target: './apps/frontend/src/api/generated/endpoints',
      schemas: './apps/frontend/src/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      mode: 'tags-split',
      clean: true,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        query: {
          useSuspenseQuery: false,
        },
        useNamedParameters: true,
      },
      urlEncodeParameters: true,
      baseUrl: {
        getBaseUrlFromSpecification: false,
        runtime: "import.meta.env.VITE_API_URL ?? 'http://localhost:3000'",
      },
    },
  },
  frontendZod: {
    input: {
      target: openApiTarget,
    },
    output: {
      target: './apps/frontend/src/api/generated/endpoints',
      client: 'zod',
      mode: 'tags-split',
      clean: false,
      fileExtension: '.zod.ts',
    },
  },
  botApi: {
    input: {
      target: openApiTarget,
    },
    output: {
      target: './apps/bot/src/api/generated/endpoints',
      schemas: './apps/bot/src/api/generated/model',
      client: 'fetch',
      mode: 'tags-split',
      clean: true,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        useNamedParameters: true,
      },
      urlEncodeParameters: true,
      baseUrl: {
        getBaseUrlFromSpecification: false,
        runtime: "process.env.BACKEND_URL ?? 'http://localhost:3000'",
      },
    },
  },
});
