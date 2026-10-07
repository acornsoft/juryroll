import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'app', 'dist');
const indexPath = path.join(dist, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
const failures = [];

const urls = new Set();
const urlRe = /new URL\(\s*(['"])([^'"]+)\1\s*,\s*import\.meta\.url\s*\)/g;
for (const match of html.matchAll(urlRe)) urls.add(match[2]);

const attrRe = /(?:href|src)=(['"])([^'"]+\.(?:xlsx|csv))\1/g;
for (const match of html.matchAll(attrRe)) {
  const value = match[2];
  if (value.startsWith('data:')) continue;
  urls.add(value.replace(/^\.\//, '').replace(/^\//, ''));
}

if (!urls.size) failures.push('dist/index.html references no asset URLs');

for (const rel of urls) {
  if (/\.(?:xlsx|csv)$/.test(rel) && !rel.startsWith('assets/')) {
    failures.push(`asset URL is not under assets/: ${rel}`);
  }
  const file = path.join(dist, rel);
  if (!fs.existsSync(file)) {
    failures.push(`missing ${rel}`);
    continue;
  }
  if (rel.endsWith('.xlsx')) {
    const buf = fs.readFileSync(file);
    if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
      failures.push(`${rel} is not an xlsx zip`);
    }
  }
}

const configPath = path.join(dist, 'staticwebapp.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const exclude = config.navigationFallback?.exclude ?? [];
for (const needed of ['*.xlsx', '*.csv', '/assets/*']) {
  if (!exclude.includes(needed)) failures.push(`navigationFallback.exclude missing ${needed}`);
}
const xlsxType = config.mimeTypes?.['.xlsx'];
if (xlsxType !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
  failures.push(`xlsx mime type is ${xlsxType}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`dist assets ok (${urls.size})`);
