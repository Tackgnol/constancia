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
import { PrismaClient } from '@prisma/client';

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

const {
  SUPERUSER_EMAIL,
  SUPERUSER_NAME = 'Constancia Superuser',
  SUPERUSER_DISCORD_ID,
  SUPERUSER_UPLOADS_ENABLED = 'true',
  SUPERUSER_UPLOAD_ALLOWANCE_BYTES,
} = process.env;

function parseBoolean(value, label) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${label} must be "true" or "false" when set`);
}

function parseOptionalPositiveInt(value, label) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer when set`);
  }
  return parsed;
}

async function bootstrapSuperuser() {
  if (!SUPERUSER_EMAIL) {
    console.log('SUPERUSER_EMAIL not set; skipping superuser bootstrap');
    return;
  }

  const prisma = new PrismaClient();
  try {
    const uploadAllowanceBytes = parseOptionalPositiveInt(
      SUPERUSER_UPLOAD_ALLOWANCE_BYTES,
      'SUPERUSER_UPLOAD_ALLOWANCE_BYTES',
    );
    const uploadsEnabled = parseBoolean(SUPERUSER_UPLOADS_ENABLED, 'SUPERUSER_UPLOADS_ENABLED');

    const user = await prisma.user.upsert({
      where: { email: SUPERUSER_EMAIL },
      create: {
        email: SUPERUSER_EMAIL,
        name: SUPERUSER_NAME,
        emailVerified: true,
        isSuperUser: true,
        uploadsEnabled,
        ...(uploadAllowanceBytes === undefined ? {} : { uploadAllowanceBytes }),
      },
      update: {
        name: SUPERUSER_NAME,
        emailVerified: true,
        isSuperUser: true,
        uploadsEnabled,
        ...(uploadAllowanceBytes === undefined ? {} : { uploadAllowanceBytes }),
      },
      select: { id: true, email: true },
    });

    if (SUPERUSER_DISCORD_ID) {
      await prisma.account.upsert({
        where: {
          providerId_accountId: {
            providerId: 'discord',
            accountId: SUPERUSER_DISCORD_ID,
          },
        },
        create: {
          providerId: 'discord',
          accountId: SUPERUSER_DISCORD_ID,
          userId: user.id,
        },
        update: {
          userId: user.id,
        },
      });
    }

    console.log(`Superuser bootstrapped for ${user.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

await bootstrapSuperuser();
