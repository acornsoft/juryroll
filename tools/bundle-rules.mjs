import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'shared', 'rules');
const files = {
  DEFAULT: 'default.json',
  NY: 'NY.json',
  NC: 'NC.json',
  GA: 'GA.json',
  TX: 'TX.json',
  PA: 'PA.json',
};
const bundle = {};
for (const [code, name] of Object.entries(files)) {
  const raw = fs.readFileSync(path.join(dir, name), 'utf8');
  bundle[code] = { raw, rules: JSON.parse(raw) };
}
const out = path.join(root, 'shared', 'src', 'rulesBundle.json');
fs.writeFileSync(out, JSON.stringify(bundle));
console.log('rules bundle', Object.keys(bundle).join(', '));
