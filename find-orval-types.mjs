import fs from 'fs';
const dts = fs.readFileSync('node_modules/orval/dist/index.d.ts', 'utf8');
const lines = dts.split('\n');
const start = lines.findIndex((l) => l.includes('interface BaseUrl'));
const types = lines.slice(Math.max(0, start - 20), start + 50).join('\n');
fs.writeFileSync('orval-types.txt', types);
