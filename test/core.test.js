// Headless test of the JuryRoll matching core. Loads the <script id="juryroll-core"> block from index.html.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const src = html.match(/<script id="juryroll-core">([\s\S]*?)<\/script>/)[1];
const sandbox = { module: { exports: {} } }; vm.createContext(sandbox); vm.runInContext(src, sandbox);
const C = sandbox.module.exports;
const plain = x => JSON.parse(JSON.stringify(x));

const jt = fs.readFileSync(path.join(root, 'sample_juror_disqualifications.csv'), 'utf8');
const vt = fs.readFileSync(path.join(root, 'sample_voter_roll.csv'), 'utf8');
const jh = C.readHead(jt, true), vh = C.readHead(vt, true);
const jm = C.guessMapping(jh.headers, C.JUROR_FIELDS), vmap = C.guessMapping(vh.headers, C.VOTER_FIELDS);
const named = (h, m) => Object.fromEntries(Object.entries(m).map(([k, i]) => [k, i >= 0 ? h[i] : null]));
console.log('Juror mapping guess:', named(jh.headers, jm));
console.log('Voter mapping guess:', named(vh.headers, vmap));
assert.deepStrictEqual(named(jh.headers, jm), { juror_id:'Juror Number', last:'Last', first:'First', middle:'MI', suffix:'Sfx', fullname:null, dob:'Birth Date', house_no:null, street:'Address', zip:'Zip', reason:'Disqualification Reason' });
assert.deepStrictEqual(named(vh.headers, vmap), { voter_id:'voter_id', last:'name_last', first:'name_first', middle:'name_middle', suffix:'name_suffix', fullname:null, dob:'date_of_birth', house_no:null, street:'res_street', zip:'res_zip' });

const reasons = C.reasonValues(jt, jh.delim, true, jm.reason);
console.log('Reason values:', reasons.map(r => `${r.auto ? '[x]' : '[ ]'} ${r.value} (${r.count})`).join(' | '));
const rf = Object.fromEntries(reasons.map(r => [r.value, r.auto]));
assert.deepStrictEqual(plain(reasons).filter(r => r.auto).map(r => r.value).sort(), ['NON-CITIZEN', 'Not a U.S. citizen']);

const jr = C.buildRecords(jt, jh.delim, true, jm, { order: 'MDY', reasonFilter: rf });
const vr = C.buildRecords(vt, vh.delim, true, vmap, { order: 'MDY' });
assert.strictEqual(jr.total, 12); assert.strictEqual(jr.kept, 9); assert.strictEqual(vr.total, 40);
const res = plain(C.match(jr.records, vr.records));
console.log('\nTier counts (pairs):', JSON.parse(JSON.stringify(res.counts)), ' juror rows matched:', res.jurorsMatched);
for (const p of res.pairs) console.log(`  ${p.tier.padEnd(8)} ${p.jurorId} -> ${p.voterId}  ${p.matched}`);

const expected = [
  ['Strong', 'J-0001', 'V0001'], ['Strong', 'J-0002', 'V0002'], ['Strong', 'J-0003', 'V0003'],
  ['Probable', 'J-0004', 'V0005'], ['Probable', 'J-0005', 'V0007'], ['Probable', 'J-0006', 'V0008'], ['Probable', 'J-0011', 'V0011'],
  ['Weak', 'J-0003', 'V0004'], ['Weak', 'J-0007', 'V0010'],
];
const got = res.pairs.map(p => [p.tier, p.jurorId, p.voterId]).sort().map(String);
assert.deepStrictEqual(got, expected.slice().sort().map(String), 'planted pairs differ');
assert.deepStrictEqual(JSON.parse(JSON.stringify(res.counts)), { Strong: 3, Probable: 4, Weak: 2 });

// Export: weak excluded by default
const csvDefault = C.toCSV(res.pairs, false, '2026-10-07');
const csvWeak = C.toCSV(res.pairs, true, '2026-10-07');
assert.ok(csvDefault.startsWith('Referral for official verification'));
assert.ok(!/,Weak,|^Weak,/m.test(csvDefault)); assert.ok(/^Weak,/m.test(csvWeak));
assert.strictEqual(csvDefault.trim().split('\r\n').length, 5 + 7);

// DOB parser and normalization spot checks
const d = (s, o) => { const r = C.parseDOB(s, o); return r ? (r.full || String(r.y)) : null; };
assert.strictEqual(d('03/14/1980'), '1980-03-14'); assert.strictEqual(d('14/03/1980'), '1980-03-14');
assert.strictEqual(d('04/03/1980', 'DMY'), '1980-03-04'); assert.strictEqual(d('1/2/85'), '1985-01-02');
assert.strictEqual(d('19800314'), '1980-03-14'); assert.strictEqual(d('14-Mar-1980'), '1980-03-14');
assert.strictEqual(d('March 14, 1980'), '1980-03-14'); assert.strictEqual(d('1980-03-14 00:00:00'), '1980-03-14');
assert.strictEqual(d('1980'), '1980'); assert.strictEqual(d('02/30/1980'), null); assert.strictEqual(d('garbage'), null);
assert.strictEqual(C.normAddress('', '12 Example Street Apt 2'), C.normAddress('', '12 EXAMPLE ST'));
assert.strictEqual(C.normAddress('12', 'North Main Avenue #4'), '12 N MAIN AVE');
// CSV parser: quotes, embedded comma/newline, tabs
const rows = []; C.iterCSV('a,"b,1","c ""q"""\r\n"x\ny",2,3\n', ',', r => rows.push(r));
assert.deepStrictEqual(plain(rows), [['a', 'b,1', 'c "q"'], ['x\ny', '2', '3']]);
assert.strictEqual(C.detectDelimiter('a\tb\tc\n1\t2\t3'), '\t');
console.log('\nALL CORE TESTS PASSED');
