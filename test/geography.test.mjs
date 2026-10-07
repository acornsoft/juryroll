import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { frameBox, MAP_HEIGHT, MAP_WIDTH } from '../app/src/map/frame.ts';
import { projectMap } from '../app/src/map/project.ts';
import { populationSentence, populationSourceLabel } from '../app/src/lib/populationCard.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mapDir = path.join(root, 'shared/map');
const gazetteer = JSON.parse(fs.readFileSync(path.join(root, 'shared/src/counties.json'), 'utf8'));
const population = JSON.parse(fs.readFileSync(path.join(mapDir, 'population.json'), 'utf8'));
const countiesTopo = JSON.parse(fs.readFileSync(path.join(mapDir, 'counties.json'), 'utf8'));
const statesTopo = JSON.parse(fs.readFileSync(path.join(mapDir, 'states.json'), 'utf8'));

assert.strictEqual(countiesTopo.type, 'Topology');
assert.strictEqual(statesTopo.type, 'Topology');
assert.ok(population.vintage >= 2024, `vintage ${population.vintage}`);
assert.strictEqual(population.label, populationSourceLabel(population.vintage));
assert.strictEqual(population.countyBoundary, 'cb_2024_us_county_5m');
assert.strictEqual(population.stateBoundary, 'cb_2024_us_state_5m');

const countyGzip = gzipSync(fs.readFileSync(path.join(mapDir, 'counties.json'))).length;
assert.ok(countyGzip < 400 * 1024, `county topojson gzip ${countyGzip}`);

const framed = frameBox([0, 0, 10, 20], MAP_WIDTH / MAP_HEIGHT, 0);
assert.ok(Math.abs(framed.w / framed.h - MAP_WIDTH / MAP_HEIGHT) < 1e-9);

const geo = projectMap({ counties: countiesTopo, states: statesTopo, population });
assert.strictEqual(geo.states.length, 51);
assert.strictEqual(geo.counties.length, 3144);
assert.strictEqual(geo.vintage, population.vintage);

const ak = geo.states.find((item) => item.code === 'AK');
const hi = geo.states.find((item) => item.code === 'HI');
const pa = geo.states.find((item) => item.code === 'PA');
assert.ok(ak && hi && pa);
assert.ok(ak.bounds[1] > MAP_HEIGHT * 0.55, 'Alaska is an inset');
assert.ok(hi.bounds[1] > MAP_HEIGHT * 0.55, 'Hawaii is an inset');
assert.ok(ak.bounds[2] < hi.bounds[0], 'Hawaii sits to the right of Alaska');
assert.ok(ak.bounds[2] - ak.bounds[0] < MAP_WIDTH * 0.4);
assert.ok(pa.bounds[0] > MAP_WIDTH * 0.6, 'Pennsylvania stays in the east');

const shapeIds = new Set(geo.counties.map((item) => item.fips));
const popIds = new Set(Object.keys(population.counties));
const expected = [];
for (const rows of Object.values(gazetteer)) {
  for (const row of rows) expected.push(row.fips);
}
assert.strictEqual(expected.length, 3144);
assert.strictEqual(shapeIds.size, 3144);
assert.strictEqual(popIds.size, 3144);
for (const fips of expected) {
  assert.ok(shapeIds.has(fips), `missing shape ${fips}`);
  assert.ok(popIds.has(fips), `missing population ${fips}`);
}
for (const fips of shapeIds) assert.ok(expected.includes(fips), `orphan shape ${fips}`);
for (const fips of popIds) assert.ok(expected.includes(fips), `orphan population ${fips}`);

const stateFipsByCode = new Map(geo.states.map((item) => [item.code, item.fips]));
for (const [code, rows] of Object.entries(gazetteer)) {
  const stateFips = stateFipsByCode.get(code);
  assert.ok(stateFips, code);
  let sum = 0;
  for (const row of rows) {
    assert.ok(row.fips.startsWith(stateFips), row.fips);
    sum += population.counties[row.fips];
  }
  const total = population.states[stateFips];
  assert.ok(Math.abs(sum - total) <= 1, `${code} state ${total} vs counties ${sum}`);
}

for (const fips of ['09110', '09120', '09130', '09140', '09150', '09160', '09170', '09180', '09190']) {
  assert.ok(shapeIds.has(fips), fips);
  assert.ok(population.counties[fips] > 0, fips);
}
assert.ok(!shapeIds.has('09001'));

const allegheny = population.counties['42003'];
const pennsylvania = population.states['42'];
assert.strictEqual(
  populationSentence('Allegheny County', 'Pennsylvania', allegheny, pennsylvania),
  `Allegheny County, Pennsylvania: population ${allegheny.toLocaleString('en-US')} of the state's ${pennsylvania.toLocaleString('en-US')} (${((allegheny / pennsylvania) * 100).toFixed(1)}%)`,
);
assert.match(
  populationSentence('Allegheny County', 'Pennsylvania', allegheny, pennsylvania),
  /^Allegheny County, Pennsylvania: population [\d,]+ of the state's [\d,]+ \(\d+\.\d%\)$/,
);

console.log(`GEOGRAPHY TEST PASSED (vintage ${population.vintage}, county gzip ${(countyGzip / 1024).toFixed(1)} KB)`);
