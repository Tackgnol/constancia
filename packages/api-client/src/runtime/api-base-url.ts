type ViteEnv = {
  readonly SSR?: boolean | string;
};

type ImportMetaWithEnv = ImportMeta & {
  readonly env?: ViteEnv;
};

type ProcessEnv = {
  readonly BACKEND_URL?: string;
};

type GlobalWithProcess = typeof globalThis & {
  readonly process?: {
    readonly env?: ProcessEnv;
  };
};

const BOT_DEFAULT_API_URL = 'http://localhost:3000';
const SSR_DEFAULT_API_URL = 'http://backend:3000';

const getProcessEnv = (): ProcessEnv | undefined => {
  return (globalThis as GlobalWithProcess).process?.env;
};

const getViteEnv = (): ViteEnv | undefined => {
  return (import.meta as ImportMetaWithEnv).env;
};

export const getConstanciaApiBaseUrl = (): string => {
  const viteEnv = getViteEnv();
  const processEnv = getProcessEnv();

  if (!viteEnv) {
    return processEnv?.BACKEND_URL ?? BOT_DEFAULT_API_URL;
  }

  if (viteEnv.SSR === true || viteEnv.SSR === 'true') {
    return processEnv?.BACKEND_URL ?? SSR_DEFAULT_API_URL;
  }

  throw new Error(
    '@constancia/api-client cannot be used from browser code. Route API calls through React Router loaders/actions so they run from the frontend server.',
  );
};
