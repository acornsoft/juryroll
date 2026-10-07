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
