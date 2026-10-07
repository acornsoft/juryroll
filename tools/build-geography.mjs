// Builds the committed map data from U.S. Census Bureau public-domain files.
//
// Geometry: 2024 cartographic boundaries, 1:5,000,000, simplified to TopoJSON.
//   https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_county_5m.zip
//   https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_state_5m.zip
// Population: the newest County Population Estimates "alldata" vintage that
//   includes Connecticut planning regions (co-est2024-alldata or newer).
//
// Raw downloads stay in tools/.cache and are not committed.
// Run: npm run geography

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, 'tools', '.cache');
const outDir = path.join(root, 'shared', 'map');
const mapshaper = path.join(root, 'node_modules', '.bin', 'mapshaper');
if (!fs.existsSync(mapshaper)) {
  throw new Error('mapshaper is not installed. Regenerate the map with: npm install -D mapshaper && npm run geography');
}
const gazetteerPath = path.join(root, 'shared', 'src', 'counties.json');

const COUNTY_ZIP = 'https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_county_5m.zip';
const STATE_ZIP = 'https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_state_5m.zip';
const COUNTY_KEEP = '70%';
const STATE_KEEP = '50%';
const GZIP_LIMIT = 400 * 1024;
const DROP_STATE_FIPS = new Set(['60', '66', '69', '72', '78']);
const AEA = '+proj=aea +lat_1=29.5 +lat_2=45.5 +lat_0=37.5 +lon_0=-96 +datum=WGS84';
const KEEP_STATES = `STATEFP != "60" && STATEFP != "66" && STATEFP != "69" && STATEFP != "72" && STATEFP != "78"`;

const CT_REGIONS = ['09110', '09120', '09130', '09140', '09150', '09160', '09170', '09180', '09190'];

async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
}

async function latestPopulation() {
  for (const year of [2026, 2025, 2024]) {
    const url = `https://www2.census.gov/programs-surveys/popest/datasets/2020-${year}/counties/totals/co-est${year}-alldata.csv`;
    const dest = path.join(cache, `co-est${year}-alldata.csv`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) return { year, url, dest };
    const response = await fetch(url);
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
    return { year, url, dest };
  }
  throw new Error('No county population estimates vintage from 2024 through 2026 was published');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function digits(value, width) {
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) throw new Error(`Expected digits, got ${value}`);
  return text.padStart(width, '0');
}

function readPopulation(file, year) {
  const rows = parseCsv(fs.readFileSync(file, 'latin1'));
  const header = rows[0];
  const column = `POPESTIMATE${year}`;
  const index = Object.fromEntries(header.map((name, i) => [name, i]));
  for (const name of ['SUMLEV', 'STATE', 'COUNTY', column]) {
    if (index[name] === undefined) throw new Error(`Population file is missing ${name}`);
  }
  const counties = new Map();
  const states = new Map();
  for (const row of rows.slice(1)) {
    if (row.length < header.length) continue;
    const sumlev = row[index.SUMLEV];
    const state = digits(row[index.STATE], 2);
    if (DROP_STATE_FIPS.has(state)) continue;
    const pop = Number(row[index[column]]);
    if (!Number.isInteger(pop) || pop < 0) throw new Error(`Bad population for ${state}: ${row[index[column]]}`);
    if (sumlev === '040') states.set(state, pop);
    if (sumlev === '050') counties.set(state + digits(row[index.COUNTY], 3), pop);
  }
  return { counties, states, column };
}

function simplify(shp, layerName, keep, fields, idField, dest) {
  execFileSync(mapshaper, [
    shp,
    '-filter', KEEP_STATES,
    '-filter-fields', fields,
    '-rename-layers', layerName,
    '-proj', AEA,
    '-simplify', 'weighted', 'visvalingam', keep, 'keep-shapes',
    '-proj', 'wgs84',
    '-o', 'format=topojson', 'quantization=1e5', `id-field=${idField}`, dest,
    'force',
  ], { stdio: 'inherit' });
}

function loadTopology(file) {
  const topo = JSON.parse(fs.readFileSync(file, 'utf8'));
  const names = Object.keys(topo.objects);
  if (names.length !== 1) throw new Error(`${file} has objects ${names.join(', ')}`);
  return topo;
}

function geometries(topo) {
  return topo.objects[Object.keys(topo.objects)[0]].geometries;
}

fs.mkdirSync(cache, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const countyZip = path.join(cache, 'cb_2024_us_county_5m.zip');
const stateZip = path.join(cache, 'cb_2024_us_state_5m.zip');
await download(COUNTY_ZIP, countyZip);
await download(STATE_ZIP, stateZip);
execFileSync('unzip', ['-qo', countyZip, '-d', cache], { stdio: 'inherit' });
execFileSync('unzip', ['-qo', stateZip, '-d', cache], { stdio: 'inherit' });

const populationSource = await latestPopulation();
console.log(`population vintage ${populationSource.year}`);
const population = readPopulation(populationSource.dest, populationSource.year);

const countyTopoPath = path.join(cache, 'counties.topojson');
const stateTopoPath = path.join(cache, 'states.topojson');
simplify(
  path.join(cache, 'cb_2024_us_county_5m.shp'),
  'counties',
  COUNTY_KEEP,
  'GEOID',
  'GEOID',
  countyTopoPath,
);
simplify(
  path.join(cache, 'cb_2024_us_state_5m.shp'),
  'states',
  STATE_KEEP,
  'STATEFP,STUSPS,NAME',
  'STATEFP',
  stateTopoPath,
);

const countyTopo = loadTopology(countyTopoPath);
const stateTopo = loadTopology(stateTopoPath);
for (const geom of geometries(countyTopo)) {
  geom.id = digits(geom.id, 5);
  delete geom.properties;
}
geometries(countyTopo).sort((a, b) => a.id.localeCompare(b.id));
for (const geom of geometries(stateTopo)) {
  geom.id = digits(geom.id, 2);
  const usps = geom.properties?.STUSPS;
  if (!usps) throw new Error(`State ${geom.id} has no STUSPS`);
  geom.properties = { usps };
}
geometries(stateTopo).sort((a, b) => a.id.localeCompare(b.id));

const gazetteer = JSON.parse(fs.readFileSync(gazetteerPath, 'utf8'));
const expected = new Set();
const expectedByState = new Map();
for (const [usps, rows] of Object.entries(gazetteer)) {
  expectedByState.set(usps, rows.map((row) => row.fips));
  for (const row of rows) expected.add(row.fips);
}

const shapeIds = geometries(countyTopo).map((geom) => geom.id);
const shapeSet = new Set(shapeIds);
if (shapeSet.size !== shapeIds.length) throw new Error('Duplicate county shape ids');
const popIds = [...population.counties.keys()];
const missingShape = [...expected].filter((fips) => !shapeSet.has(fips));
const orphanShape = shapeIds.filter((fips) => !expected.has(fips));
const missingPop = [...expected].filter((fips) => !population.counties.has(fips));
const orphanPop = popIds.filter((fips) => !expected.has(fips));
if (missingShape.length || orphanShape.length || missingPop.length || orphanPop.length) {
  throw new Error([
    `missing shapes ${missingShape.slice(0, 8).join(',')}`,
    `orphan shapes ${orphanShape.slice(0, 8).join(',')}`,
    `missing population ${missingPop.slice(0, 8).join(',')}`,
    `orphan population ${orphanPop.slice(0, 8).join(',')}`,
  ].join('; '));
}

const stateByUsps = new Map(geometries(stateTopo).map((geom) => [geom.properties.usps, geom.id]));
if (stateByUsps.size !== 51) throw new Error(`Expected 51 state shapes, found ${stateByUsps.size}`);
for (const [usps, fipsList] of expectedByState) {
  const stateFips = stateByUsps.get(usps);
  if (!stateFips) throw new Error(`No state shape for ${usps}`);
  let sum = 0;
  for (const fips of fipsList) {
    if (!fips.startsWith(stateFips)) throw new Error(`${fips} is not in state ${stateFips}`);
    sum += population.counties.get(fips);
  }
  const total = population.states.get(stateFips);
  if (total === undefined) throw new Error(`No state population for ${usps}`);
  if (sum !== total) throw new Error(`${usps} population ${total} does not equal county sum ${sum}`);
}
for (const fips of CT_REGIONS) {
  if (!shapeSet.has(fips) || !population.counties.has(fips)) throw new Error(`Missing Connecticut region ${fips}`);
}
if (shapeSet.has('09001')) throw new Error('Old Connecticut county 09001 is still present');

const packedCounties = {};
const packedStates = {};
for (const fips of [...population.counties.keys()].sort()) packedCounties[fips] = population.counties.get(fips);
for (const fips of [...population.states.keys()].sort()) packedStates[fips] = population.states.get(fips);

const populationFile = {
  vintage: populationSource.year,
  product: `co-est${populationSource.year}-alldata`,
  column: population.column,
  label: `Approximate. U.S. Census Bureau population estimates, Vintage ${populationSource.year}.`,
  populationUrl: populationSource.url,
  countyBoundary: 'cb_2024_us_county_5m',
  stateBoundary: 'cb_2024_us_state_5m',
  counties: packedCounties,
  states: packedStates,
};

const countyOut = path.join(outDir, 'counties.json');
const stateOut = path.join(outDir, 'states.json');
const populationOut = path.join(outDir, 'population.json');
fs.writeFileSync(countyOut, JSON.stringify(countyTopo));
fs.writeFileSync(stateOut, JSON.stringify(stateTopo));
fs.writeFileSync(populationOut, `${JSON.stringify(populationFile, null, 2)}\n`);

const countyGzip = gzipSync(fs.readFileSync(countyOut)).length;
console.log(`counties ${shapeIds.length} gzip ${(countyGzip / 1024).toFixed(1)} KB`);
console.log(`states ${geometries(stateTopo).length}`);
if (countyGzip > GZIP_LIMIT) {
  throw new Error(`County TopoJSON is ${countyGzip} bytes gzipped; limit is ${GZIP_LIMIT}`);
}
console.log('geography written');
