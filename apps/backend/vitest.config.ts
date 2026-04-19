import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://constancia:constancia@localhost:5433/constancia?schema=public',
    },
  },
});
