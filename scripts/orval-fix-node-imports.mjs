import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const generatedRoot = join(process.cwd(), 'packages', 'api-client', 'src', 'generated');
const endpointsRoot = join(generatedRoot, 'endpoints');

await walk(generatedRoot);
await rewriteRuntimeBase(endpointsRoot);
await ensureModelBridge();

async function walk(directory) {
  let entries;

  try {
    entries = await readdir(directory);
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    const entryStat = await stat(fullPath);

    if (entryStat.isDirectory()) {
      await walk(fullPath);
      continue;
    }

    if (extname(fullPath) !== '.ts') {
      continue;
    }

    const original = await readFile(fullPath, 'utf8');
    const updated = original.replaceAll(
      /from\s+(['"])(\.\.?\/[^'"]+?)(?<!\.js|\.ts|\.mjs|\.cjs)\1/g,
      (_match, quote, importPath) => `from ${quote}${importPath}.js${quote}`,
    );

    if (updated !== original) {
      await writeFile(fullPath, updated, 'utf8');
    }
  }
}

async function rewriteRuntimeBase(directory) {
  let entries;

  try {
    entries = await readdir(directory);
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    const entryStat = await stat(fullPath);

    if (entryStat.isDirectory()) {
      await rewriteRuntimeBase(fullPath);
      continue;
    }

    if (extname(fullPath) !== '.ts') {
      continue;
    }

    const original = await readFile(fullPath, 'utf8');
    let updated = original
      .replaceAll(
        /`\/([^`]+)`/g,
        (_match, urlPath) => `\`\${getConstanciaApiBaseUrl()}/${urlPath}\``,
      )
      .replace(/return\s+`\/`\s*;?/g, 'return `${getConstanciaApiBaseUrl()}/`;');

    if (updated !== original && !updated.includes("from '../../../runtime/api-base-url.js'")) {
      updated = updated.replace(
        /(\*\/\r?\n)/,
        "$1import { getConstanciaApiBaseUrl } from '../../../runtime/api-base-url.js';\n",
      );
    }

    if (updated !== original) {
      await writeFile(fullPath, updated, 'utf8');
    }
  }
}

async function ensureModelBridge() {
  await mkdir(generatedRoot, { recursive: true });
  await writeFile(join(generatedRoot, 'model.ts'), "export * from './model/index.js';\n", 'utf8');
}
