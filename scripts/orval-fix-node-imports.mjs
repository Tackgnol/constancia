import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const targetRoot = join(process.cwd(), 'apps', 'bot', 'src', 'api', 'generated');
const frontendEndpointsRoot = join(
  process.cwd(),
  'apps',
  'frontend',
  'src',
  'api',
  'generated',
  'endpoints',
);
const botEndpointsRoot = join(process.cwd(), 'apps', 'bot', 'src', 'api', 'generated', 'endpoints');

await walk(targetRoot);
await rewriteRuntimeBase(
  frontendEndpointsRoot,
  "import.meta.env.VITE_API_URL ?? 'http://localhost:3000'",
);
await rewriteRuntimeBase(botEndpointsRoot, "process.env.BACKEND_URL ?? 'http://localhost:3000'");
await ensureBotModelBridge();

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

async function rewriteRuntimeBase(directory, runtimeExpression) {
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
      await rewriteRuntimeBase(fullPath, runtimeExpression);
      continue;
    }

    if (extname(fullPath) !== '.ts') {
      continue;
    }

    const original = await readFile(fullPath, 'utf8');
    const updated = original.replaceAll(
      /`\/([^`]+)`/g,
      (_match, urlPath) => `\`\${${runtimeExpression}}/${urlPath}\``,
    );

    if (updated !== original) {
      await writeFile(fullPath, updated, 'utf8');
    }
  }
}

async function ensureBotModelBridge() {
  const generatedRoot = join(process.cwd(), 'apps', 'bot', 'src', 'api', 'generated');
  await mkdir(generatedRoot, { recursive: true });
  await writeFile(join(generatedRoot, 'model.ts'), "export * from './model/index.js';\n", 'utf8');
}
