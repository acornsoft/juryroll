import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootCsv = path.join(root, 'tmp-root-check.csv');
const appCsv = path.join(root, 'app', 'tmp-app-check.csv');
fs.writeFileSync(rootCsv, 'a,b\n');
fs.writeFileSync(appCsv, 'a,b\n');

function ignored(rel) {
  try {
    execFileSync('git', ['check-ignore', '-q', rel], { cwd: root });
    return true;
  } catch {
    return false;
  }
}

try {
  if (!ignored('tmp-root-check.csv')) throw new Error('a CSV at the repo root must be ignored');
  if (!ignored('app/tmp-app-check.csv')) throw new Error('a CSV under app/ must be ignored');
  if (ignored('shared/samples/sample_juror_disqualifications.csv')) throw new Error('shared/samples CSV must stay trackable');
  if (ignored('shared/samples/sample_voter_roll.csv')) throw new Error('shared/samples voter CSV must stay trackable');
  if (ignored('shared/templates/juror-template.csv')) throw new Error('shared/templates CSV must stay trackable');
  if (ignored('test/fixtures/voter_no_regdate.csv')) throw new Error('test/fixtures CSV must stay trackable');
  if (!ignored('node_modules')) throw new Error('node_modules must be ignored');
  if (!ignored('.env.local')) throw new Error('.env.local must be ignored');
  if (!ignored('.envfoo.local')) throw new Error('.env*.local must be ignored');
  console.log('GITIGNORE CHECK PASSED');
} finally {
  fs.unlinkSync(rootCsv);
  fs.unlinkSync(appCsv);
}
