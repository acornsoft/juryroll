import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readme = read('README.md');
const copy = read('shared/src/content/copy.ts');
const htmls = [...copy.matchAll(/html: '([^']*)'/g)].map((match) => match[1]);
if (htmls.length < 9) throw new Error(`expected the v1 caveats, found ${htmls.length}`);
for (const html of htmls) {
  const text = html.replace(/<[^>]+>/g, '');
  if (!readme.includes(text)) throw new Error(`README is missing a caveat: ${text}`);
}
if (!readme.includes('shared/GUIDE.md')) throw new Error('README must link to shared/GUIDE.md');
if (!readme.includes('matches excluded: registered after declaration')) throw new Error('README must describe the exclude rule');
const guide = read('app/public/guide.html');
for (const phrase of ['What a lead is', 'What you CAN do', 'What you CANNOT do']) {
  if (!guide.includes(phrase)) throw new Error(`guide.html is missing ${phrase}`);
}
const pkg = JSON.parse(read('package.json'));
const version = read('VERSION').trim();
if (pkg.version !== '2.0.0' || version !== '2.0.0') throw new Error('version must be 2.0.0');
if (!read('CHANGELOG.md').includes('## 2.0.0')) throw new Error('CHANGELOG is missing 2.0.0');
const core = read('shared/src/core.js');
if (/\bdocument\b|\bfetch\s*\(/.test(core)) throw new Error('core.js must stay free of DOM and network calls');
console.log('CONTENT CHECK PASSED');
