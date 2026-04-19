import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const botGeneratedRoot = join(process.cwd(), 'apps', 'bot', 'src', 'api', 'generated');
const frontendGeneratedRoot = join(process.cwd(), 'apps', 'frontend', 'app', 'api', 'generated');
const frontendEndpointsRoot = join(frontendGeneratedRoot, 'endpoints');
const botEndpointsRoot = join(botGeneratedRoot, 'endpoints');

await walk(botGeneratedRoot);
await walk(frontendGeneratedRoot);
await rewriteRuntimeBase(
  frontendEndpointsRoot,
  "import.meta.env.SSR ? (process.env.BACKEND_URL ?? 'http://backend:3000') : (import.meta.env.VITE_API_URL ?? 'http://localhost:3001')",
);
await rewriteRuntimeBase(botEndpointsRoot, "process.env.BACKEND_URL ?? 'http://localhost:3000'");
await ensureBotModelBridge();
await ensureFrontendModelBridge();

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
    const updated = original
      .replaceAll(
        /import\.meta\.env\.VITE_API_URL\s\?\?\s'http:\/\/localhost:\d+'/g,
        runtimeExpression,
      )
      .replaceAll(/`\/([^`]+)`/g, (_match, urlPath) => `\${${runtimeExpression}}/${urlPath}`)
      .replace(/return\s+`\/`\s*;?/g, `return \`\${${runtimeExpression}}/\`;`);

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

async function ensureFrontendModelBridge() {
  const generatedRoot = join(process.cwd(), 'apps', 'frontend', 'app', 'api', 'generated');
  await mkdir(generatedRoot, { recursive: true });
  await writeFile(join(generatedRoot, 'model.ts'), "export * from './model/index.js';\n", 'utf8');
}
