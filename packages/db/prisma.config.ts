import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceEnvPath = resolve(currentDir, '../../.env');

if (existsSync(workspaceEnvPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(workspaceEnvPath);
}

export default defineConfig({
  engine: 'classic',
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
