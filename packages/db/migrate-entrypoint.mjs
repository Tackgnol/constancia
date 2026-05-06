/**
 * Migrate entrypoint — constructs DATABASE_URL from raw component env vars so
 * the deploy pipeline never has to URL-encode the password in shell.
 *
 * Required env vars: POSTGRES_PASSWORD
 * Optional: POSTGRES_USER (default: constancia), PGHOST, POSTGRES_DB
 */

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const {
  POSTGRES_USER = 'constancia',
  POSTGRES_PASSWORD,
  PGHOST = 'constancia_postgres',
  POSTGRES_DB = 'constancia',
} = process.env;

if (!POSTGRES_PASSWORD) {
  console.error('POSTGRES_PASSWORD env var is required');
  process.exit(1);
}

const url =
  'postgresql://' +
  encodeURIComponent(POSTGRES_USER) +
  ':' +
  encodeURIComponent(POSTGRES_PASSWORD) +
  '@' +
  PGHOST +
  ':5432/' +
  POSTGRES_DB +
  '?schema=public';

process.env.DATABASE_URL = url;

const cwd = dirname(fileURLToPath(import.meta.url));
execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd });
