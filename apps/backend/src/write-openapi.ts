import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildApp } from './app.js';

async function main() {
  const app = await buildApp();

  try {
    await app.ready();
    const outputDirectory = resolve(process.cwd(), 'openapi');
    const outputPath = resolve(outputDirectory, 'openapi.json');

    await mkdir(outputDirectory, { recursive: true });
    await writeFile(outputPath, JSON.stringify(app.swagger(), null, 2) + '\n', 'utf8');

    app.log.info({ outputPath }, 'OpenAPI document written');
  } finally {
    await app.close();
  }
}

await main();
