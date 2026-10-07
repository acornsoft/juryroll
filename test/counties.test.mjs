import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'shared/data/2025_Gaz_counties_national.txt');
const bundled = JSON.parse(fs.readFileSync(path.join(root, 'shared/src/counties.json'), 'utf8'));
const lines = fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/).filter((line) => line.length > 0);
const header = lines[0].split('|');
assert.deepStrictEqual(header.slice(0, 5), ['USPS', 'GEOID', 'GEOIDFQ', 'ANSICODE', 'NAME']);

const fromSource = {};
for (const line of lines.slice(1)) {
  const [usps, geoid, , , name] = line.split('|');
  if (usps === 'PR') continue;
  assert.match(geoid, /^\d{5}$/, geoid);
  if (!fromSource[usps]) fromSource[usps] = [];
  fromSource[usps].push({ fips: geoid, name });
}

assert.strictEqual(Object.keys(fromSource).length, 51);
assert.deepStrictEqual(Object.keys(bundled).sort(), Object.keys(fromSource).sort());

let total = 0;
for (const code of Object.keys(fromSource)) {
  const sourceRows = fromSource[code];
  const packed = bundled[code];
  assert.strictEqual(packed.length, sourceRows.length, `${code} count`);
  total += sourceRows.length;
  const sourceFips = new Set(sourceRows.map((row) => row.fips));
  const names = packed.map((row) => row.name);
  const sorted = names.slice().sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  assert.deepStrictEqual(names, sorted, `${code} sort`);
  for (const row of packed) {
    assert.match(row.fips, /^\d{5}$/);
    assert.ok(sourceFips.has(row.fips), `${code} ${row.fips}`);
    const sourceName = sourceRows.find((item) => item.fips === row.fips).name;
    assert.strictEqual(row.name, sourceName);
  }
}
assert.strictEqual(total, 3144);

assert.strictEqual(bundled.DC.length, 1);
assert.strictEqual(bundled.DC[0].name, 'District of Columbia');
assert.strictEqual(bundled.DC[0].fips, '11001');
assert.ok(bundled.LA.every((row) => row.name.endsWith('Parish')));
assert.strictEqual(bundled.LA.length, 64);
assert.ok(bundled.AK.every((row) => /Borough|Census Area|Municipality/.test(row.name)));
assert.strictEqual(bundled.AK.length, 30);
assert.ok(bundled.VA.some((row) => row.name.endsWith(' city')));
assert.strictEqual(bundled.VA.length, 133);
assert.ok(bundled.CT.every((row) => row.name.endsWith('Planning Region')));
assert.strictEqual(bundled.CT.length, 9);
assert.strictEqual(bundled.NC.length, 100);
assert.ok(bundled.NC.some((row) => row.fips === '37183' && row.name === 'Wake County'));

const rulesDir = path.join(root, 'shared/rules');
const stateFiles = fs.readdirSync(rulesDir).filter((file) => /^[A-Z]{2}\.json$/.test(file));
assert.strictEqual(stateFiles.length, 51);
for (const file of stateFiles) {
  const code = file.slice(0, -5);
  assert.ok(bundled[code] && bundled[code].length > 0, `${code} has no county list`);
}

console.log(`COUNTIES TEST PASSED (${total})`);
