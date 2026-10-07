import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mapDir = path.join(root, 'shared', 'map');
const destDir = path.join(root, 'app', 'dist', 'assets');
const payload = {
  counties: JSON.parse(fs.readFileSync(path.join(mapDir, 'counties.json'), 'utf8')),
  states: JSON.parse(fs.readFileSync(path.join(mapDir, 'states.json'), 'utf8')),
  population: JSON.parse(fs.readFileSync(path.join(mapDir, 'population.json'), 'utf8')),
};
fs.mkdirSync(destDir, { recursive: true });
const body = `globalThis.JURYROLL_MAP_DATA=${JSON.stringify(payload)};\n`;
fs.writeFileSync(path.join(destDir, 'us-map-global.js'), body);
console.log(`us-map-global.js ${(Buffer.byteLength(body) / 1024).toFixed(0)} KB`);
