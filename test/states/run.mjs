import { readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((name) => name.endsWith('.test.ts')).sort();
for (const file of files) {
  await import(pathToFileURL(path.join(dir, file)).href);
}
console.log(`state file tests passed (${files.length})`);
