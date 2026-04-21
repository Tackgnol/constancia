import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@constancia/db';

const globalForPrisma = globalThis as typeof globalThis & {
  __constanciaPrisma?: PrismaClient;
};

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to create the Prisma client.');
  }

  return new PrismaClient({
    adapter: new PrismaPg(databaseUrl),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export function getPrismaClient() {
  if (!globalForPrisma.__constanciaPrisma) {
    globalForPrisma.__constanciaPrisma = createPrismaClient();
  }

  return globalForPrisma.__constanciaPrisma;
}
