import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'shared', 'rules');
const names = fs.readdirSync(dir).filter((name) => name.endsWith('.json') && name !== 'schema.json').sort();
const bundle = {};
for (const name of names) {
  const code = name === 'default.json' ? 'DEFAULT' : name.replace(/\.json$/, '');
  const raw = fs.readFileSync(path.join(dir, name), 'utf8');
  bundle[code] = { raw, rules: JSON.parse(raw) };
}
const out = path.join(root, 'shared', 'src', 'rulesBundle.json');
fs.writeFileSync(out, JSON.stringify(bundle));
console.log('rules bundle', Object.keys(bundle).join(', '));
