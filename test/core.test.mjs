import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import core from '../shared/src/core.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plain = (value) => JSON.parse(JSON.stringify(value));
const jt = fs.readFileSync(path.join(root, 'shared/samples/sample_juror_disqualifications.csv'), 'utf8');
const vt = fs.readFileSync(path.join(root, 'shared/samples/sample_voter_roll.csv'), 'utf8');
const jh = core.readHead(jt, true);
const vh = core.readHead(vt, true);
const jm = core.guessMapping(jh.headers, core.JUROR_FIELDS);
const vmap = core.guessMapping(vh.headers, core.VOTER_FIELDS);
const named = (headers, map) => Object.fromEntries(Object.entries(map).map(([key, index]) => [key, index >= 0 ? headers[index] : null]));
console.log('Juror mapping guess:', named(jh.headers, jm));
console.log('Voter mapping guess:', named(vh.headers, vmap));
assert.deepStrictEqual(named(jh.headers, jm), { juror_id: 'Juror Number', last: 'Last', first: 'First', middle: 'MI', suffix: 'Sfx', fullname: null, dob: 'Birth Date', house_no: null, street: 'Address', zip: 'Zip', reason: 'Disqualification Reason' });
assert.deepStrictEqual(named(vh.headers, vmap), { voter_id: 'voter_id', last: 'name_last', first: 'name_first', middle: 'name_middle', suffix: 'name_suffix', fullname: null, dob: 'date_of_birth', house_no: null, street: 'res_street', zip: 'res_zip' });

const reasons = core.reasonValues(jt, jh.delim, true, jm.reason);
console.log('Reason values:', reasons.map((reason) => `${reason.auto ? '[x]' : '[ ]'} ${reason.value} (${reason.count})`).join(' | '));
const rf = Object.fromEntries(reasons.map((reason) => [reason.value, reason.auto]));
assert.deepStrictEqual(plain(reasons).filter((reason) => reason.auto).map((reason) => reason.value).sort(), ['NON-CITIZEN', 'Not a U.S. citizen']);

const jr = core.buildRecords(jt, jh.delim, true, jm, { order: 'MDY', reasonFilter: rf });
const vr = core.buildRecords(vt, vh.delim, true, vmap, { order: 'MDY' });
assert.strictEqual(jr.total, 12);
assert.strictEqual(jr.kept, 9);
assert.strictEqual(vr.total, 40);
const res = plain(core.match(jr.records, vr.records));
console.log('\nTier counts (pairs):', JSON.parse(JSON.stringify(res.counts)), ' juror rows matched:', res.jurorsMatched);
for (const pair of res.pairs) console.log(`  ${pair.tier.padEnd(8)} ${pair.jurorId} -> ${pair.voterId}  ${pair.matched}`);

const expected = [
  ['Strong', 'J-0001', 'V0001'], ['Strong', 'J-0002', 'V0002'], ['Strong', 'J-0003', 'V0003'],
  ['Probable', 'J-0004', 'V0005'], ['Probable', 'J-0005', 'V0007'], ['Probable', 'J-0006', 'V0008'], ['Probable', 'J-0011', 'V0011'],
  ['Weak', 'J-0003', 'V0004'], ['Weak', 'J-0007', 'V0010'],
];
const got = res.pairs.map((pair) => [pair.tier, pair.jurorId, pair.voterId]).sort().map(String);
assert.deepStrictEqual(got, expected.slice().sort().map(String), 'planted pairs differ');
assert.deepStrictEqual(JSON.parse(JSON.stringify(res.counts)), { Strong: 3, Probable: 4, Weak: 2 });
assert.ok(!Object.values(jm).includes(jh.headers.indexOf('Note')), 'juror marker column is not a match field');
assert.ok(!Object.values(vmap).includes(vh.headers.indexOf('data_note')), 'voter marker column is not a match field');
const byPair = Object.fromEntries(res.pairs.map((pair) => [`${pair.jurorId}>${pair.voterId}`, pair]));
assert.ok(byPair['J-0002>V0002'].jurorName.includes('Voter-Juror'));
assert.ok(byPair['J-0002>V0002'].matched.includes('suffix'));
assert.ok(byPair['J-0003>V0003'].jurorName.includes('Example'));
assert.ok(byPair['J-0003>V0004'].matched.includes('suffix conflict'));
assert.ok(byPair['J-0007>V0010'].matched.includes('DOB missing'));
assert.ok(byPair['J-0011>V0011'].matched.includes('middle initial conflict'));
for (const pair of res.pairs) {
  assert.ok(!pair.voterName.includes('FICTIONAL'), pair.voterId);
  assert.ok(!pair.jurorName.includes('FICTIONAL'), pair.jurorId);
  assert.ok(!pair.matched.includes('FICTIONAL'), pair.voterId);
}

const declDates = {
  'J-0001': '06/15/2004', 'J-0002': '07/20/2004', 'J-0003': '08/08/2005', 'J-0004': '01/15/2002',
  'J-0005': '03/03/2002', 'J-0006': '04/04/2003', 'J-0007': '09/09/2003', 'J-0008': '01/01/2003',
  'J-0009': '02/02/2003', 'J-0010': '03/03/2003', 'J-0011': '04/04/2004', 'J-0012': '05/05/2003',
};
const regDates = {
  V0001: '2001-02-02', V0002: '2002-03-03', V0003: '2001-04-04', V0004: '2002-05-05', V0005: '2005-06-06',
  V0006: '2003-01-15', V0007: '2005-09-09', V0008: '', V0009: '2003-02-15', V0010: '2001-01-01', V0011: '2004-04-04',
};
const jurorRows = [];
const voterRows = [];
core.iterCSV(jt, jh.delim, (row) => jurorRows.push(row));
core.iterCSV(vt, vh.delim, (row) => voterRows.push(row));
for (const row of jurorRows.slice(1)) assert.strictEqual(row[10], declDates[row[0]], row[0]);
for (const row of voterRows.slice(1)) {
  if (regDates[row[0]] !== undefined) assert.strictEqual(row[10], regDates[row[0]], row[0]);
  else assert.strictEqual(row[10], '2003-06-15', row[0]);
}

const ALLOWED_NAME = /^(SAMPLE|JUROR|JURORS|VOTER|PAT|EXAMPLE|P|S|Q|R|A|B|C|D|E|F|JR|SR|II|III|\d+)$/;
function nameTokens(value) {
  return String(value || '').toUpperCase().replace(/['’`]/g, '').split(/[^A-Z0-9]+/).filter(Boolean);
}
function assertFictionalFile(text, label) {
  const parsed = [];
  core.iterCSV(text, core.detectDelimiter(text), (row) => parsed.push(row.map((cell) => cell.trim())));
  const headers = parsed[0];
  const marker = headers.findIndex((header) => ['note', 'data_note', 'sample_note'].includes(header.toLowerCase()));
  assert.ok(marker >= 0, `${label} marker column`);
  const nameCols = [];
  const dobCols = [];
  const streetCols = [];
  const zipCols = [];
  headers.forEach((header, index) => {
    const key = header.toLowerCase();
    if (/^(last|first|mi|sfx|name_last|name_first|name_middle|name_suffix)$/.test(key)) nameCols.push(index);
    if (key === 'birth date' || key === 'date_of_birth') dobCols.push(index);
    if (key === 'address' || key === 'res_street') streetCols.push(index);
    if (key === 'zip' || key === 'res_zip') zipCols.push(index);
  });
  for (const row of parsed.slice(1)) {
    if (row.every((cell) => cell === '')) continue;
    assert.strictEqual(row[marker], 'FICTIONAL SAMPLE DATA', `${label} ${row[0]}`);
    for (const index of nameCols) {
      for (const token of nameTokens(row[index])) assert.ok(ALLOWED_NAME.test(token), `${label} ${row[0]} token ${token}`);
    }
    for (const index of dobCols) {
      if (!row[index]) continue;
      assert.match(row[index], /^(\d{1,2}\/\d{1,2}\/1901|1901-\d{2}-\d{2}|1901)$/, `${label} ${row[0]} dob`);
    }
    for (const index of streetCols) {
      if (!row[index]) continue;
      assert.match(row[index], /^(000 Sample (Road|Rd|Lane|Ln)( Apt 2|, Unit B)?|000 SAMPLE RD)$/, `${label} ${row[0]} address`);
    }
    for (const index of zipCols) {
      if (!row[index]) continue;
      assert.strictEqual(row[index], '00000', `${label} ${row[0]} zip`);
    }
  }
}
assertFictionalFile(jt, 'juror sample');
assertFictionalFile(vt, 'voter sample');
for (const name of fs.readdirSync(path.join(root, 'test/fixtures')).filter((name) => name.endsWith('.csv'))) {
  assertFictionalFile(fs.readFileSync(path.join(root, 'test/fixtures', name), 'utf8'), name);
}

const csvDefault = core.toCSV(res.pairs, false, '2026-10-07');
const csvWeak = core.toCSV(res.pairs, true, '2026-10-07');
assert.ok(csvDefault.startsWith('Referral for official verification'));
assert.ok(!/,Weak,|^Weak,/m.test(csvDefault));
assert.ok(/^Weak,/m.test(csvWeak));
assert.strictEqual(csvDefault.trim().split('\r\n').length, 5 + 7);

const d = (value, order) => {
  const parsed = core.parseDOB(value, order);
  return parsed ? (parsed.full || String(parsed.y)) : null;
};
assert.strictEqual(d('03/14/1980'), '1980-03-14');
assert.strictEqual(d('14/03/1980'), '1980-03-14');
assert.strictEqual(d('04/03/1980', 'DMY'), '1980-03-04');
assert.strictEqual(d('1/2/85'), '1985-01-02');
assert.strictEqual(d('19800314'), '1980-03-14');
assert.strictEqual(d('14-Mar-1980'), '1980-03-14');
assert.strictEqual(d('March 14, 1980'), '1980-03-14');
assert.strictEqual(d('1980-03-14 00:00:00'), '1980-03-14');
assert.strictEqual(d('1980'), '1980');
assert.strictEqual(d('02/30/1980'), null);
assert.strictEqual(d('garbage'), null);
assert.strictEqual(core.normAddress('', '12 Example Street Apt 2'), core.normAddress('', '12 EXAMPLE ST'));
assert.strictEqual(core.normAddress('12', 'North Main Avenue #4'), '12 N MAIN AVE');
const rows = [];
core.iterCSV('a,"b,1","c ""q"""\r\n"x\ny",2,3\n', ',', (row) => rows.push(row));
assert.deepStrictEqual(plain(rows), [['a', 'b,1', 'c "q"'], ['x\ny', '2', '3']]);
assert.strictEqual(core.detectDelimiter('a\tb\tc\n1\t2\t3'), '\t');
console.log('\nALL CORE TESTS PASSED');
