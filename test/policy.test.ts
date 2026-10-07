import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import core from '../shared/src/core.js';
import { ATTEST_LINES } from '../shared/src/content/copy.ts';
import { CANNOT_COMPARE_PHRASE, EXCLUDE_PHRASE, SAVE_EXPORT_LINE, SAVE_LINE, UI_DATE_STRICTNESS, applyDateRule, type PolicyResult } from '../shared/src/policy/apply.ts';
import { appendEntry, canonicalJson, verifyChain } from '../shared/src/policy/audit.ts';
import { screenColumns } from '../shared/src/policy/blocked.ts';
import { guessExtra } from '../shared/src/policy/columns.ts';
import { toCSV } from '../shared/src/policy/exportCsv.ts';
import { ND_REGISTRATION_NOTE, NON_SIGNAL, effective, referralTargets, resolveRules, strict, uiGates, useLimitApplies, type RulesFile } from '../shared/src/policy/gates.ts';
import { auditLetter } from '../shared/src/policy/letter.ts';
import { runMatch, type LoadedTable } from '../shared/src/policy/runMatch.ts';
import { sha256HexSync } from '../shared/src/policy/sha256.ts';
import { addDays, federalWindow, inRange, stateWindowDates } from '../shared/src/policy/windows.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rulesDir = path.join(root, 'shared/rules');

function loadRules(name: string): RulesFile {
  return JSON.parse(fs.readFileSync(path.join(rulesDir, name), 'utf8')) as RulesFile;
}

const shipped = {
  DEFAULT: loadRules('default.json'),
  NY: loadRules('NY.json'),
  NC: loadRules('NC.json'),
  GA: loadRules('GA.json'),
  TX: loadRules('TX.json'),
  PA: loadRules('PA.json'),
};

function pass(id: string) {
  console.log(`${id} PASS`);
}

function table(kind: 'juror' | 'voter', text: string): LoadedTable {
  const head = core.readHead(text, true);
  const fields = kind === 'juror' ? core.JUROR_FIELDS : core.VOTER_FIELDS;
  const map = core.guessMapping(head.headers, fields);
  const reasons = kind === 'juror' && map.reason >= 0 ? core.reasonValues(text, head.delim, true, map.reason) : [];
  return {
    text,
    delim: head.delim,
    hasHeader: true,
    headers: head.headers,
    map,
    extra: guessExtra(kind, head.headers),
    order: 'MDY',
    reasonFilter: kind === 'juror' ? Object.fromEntries(reasons.map((reason) => [reason.value, reason.auto])) : null,
  };
}

function assertBuckets(policy: PolicyResult, pairs: number) {
  const leads = policy.counts.Strong + policy.counts.Probable + policy.counts.Weak;
  assert.strictEqual(leads + policy.excludedAfterCount + policy.cannotCompareCount, pairs);
  assert.strictEqual(policy.excludedCount, policy.excludedAfterCount + policy.cannotCompareCount);
  assert.strictEqual(policy.rows.length, pairs);
}

function comparableRules(): RulesFile {
  return {
    ...shipped.NC,
    voter_file: { ...shipped.NC.voter_file, dob_in_public_file: true, registration_date_in_public_file: true },
  };
}

const jurorDates = `Juror Number,Last,First,Birth Date,Address,Zip,Disqualification Reason,Disqualification Date
J1,Afterson,Ann,03/14/1980,1 Main St,00001,Not a U.S. citizen,2020-01-15
J2,Keepson,Bob,04/02/1981,2 Main St,00001,Not a U.S. citizen,2020-06-01
J3,Missingson,Cam,05/03/1982,3 Main St,00001,Not a U.S. citizen,
J4,Removedson,Dee,06/04/1983,4 Main St,00001,Not a U.S. citizen,2019-01-01
J5,Wrongson,Eve,07/05/1984,5 Main St,00001,Not a U.S. citizen,2018-01-01
J6,Probson,Pat,08/08/1970,6 Main St,00001,Not a U.S. citizen,2015-01-01
J7,Inactson,Fay,09/09/1971,7 Main St,00001,Not a U.S. citizen,2010-01-01
J8,Backson,Gia,10/10/1972,8 Main St,00001,Not a U.S. citizen,2020-01-01
J10,Lowson,Hugh,11/11/1973,10 Main St,00001,Not a U.S. citizen,2020-01-01
J11,Equalson,Quin,12/12/1974,11 Main St,00001,Not a U.S. citizen,2020-03-03
J12,Blankdecl,Rae,01/02/1975,12 Main St,00001,Not a U.S. citizen,
`;

const voterDates = `voter_id,name_last,name_first,date_of_birth,res_street,res_zip,status,status_reason,registration_date
V1,Afterson,Ann,1980-03-14,1 Main St,00001,ACTIVE,,2021-05-01
V2,Keepson,Bob,1981-04-02,2 Main St,00001,ACTIVE,,2019-01-01
V3,Missingson,Cam,1982-05-03,3 Main St,00001,ACTIVE,,
V4,Removedson,Dee,1983-06-04,4 Main St,00001,REMOVED,non-citizen,2018-01-01
V5,Wrongson,Eve,1984-07-05,5 Main St,00001,REMOVED,moved,2022-01-01
V6,Probson,Paul,1970-08-08,6 Main St,00001,ACTIVE,,2016-01-01
V7,Inactson,Fay,1971-09-09,7 Main St,00001,INACTIVE,,2011-01-01
V8,Backson,Gia,1972-10-10,8 Main St,00001,ACTIVE,reinstated,2010-01-01
V9,Nobody,Zoe,1999-01-01,99 Other St,00009,CANCELLED,citizenship,2000-01-01
V10,Lowson,Hank,1973-11-11,10 Main St,00001,REMOVED,moved,2010-01-01
V11,Equalson,Quin,1974-12-12,11 Main St,00001,ACTIVE,,2020-03-03
V12,Blankdecl,Rae,1975-01-02,12 Main St,00001,ACTIVE,,2010-01-01
`;

assert.deepStrictEqual(effective(shipped.DEFAULT), { allow_jury_list: false, aggregate_only: true, allow_named_export: false, show_challenge_guidance: false });
assert.deepStrictEqual(effective(shipped.NY), { allow_jury_list: false, aggregate_only: true, allow_named_export: false, show_challenge_guidance: false });
assert.deepStrictEqual(effective(shipped.GA), { allow_jury_list: false, aggregate_only: true, allow_named_export: false, show_challenge_guidance: false });
assert.deepStrictEqual(effective(shipped.TX), { allow_jury_list: false, aggregate_only: true, allow_named_export: false, show_challenge_guidance: false });
assert.deepStrictEqual(effective(shipped.PA), { allow_jury_list: true, aggregate_only: false, allow_named_export: true, show_challenge_guidance: false });
pass('AT-01');

assert.deepStrictEqual(effective(shipped.NC), { allow_jury_list: true, aggregate_only: false, allow_named_export: true, show_challenge_guidance: true });
pass('AT-02');

assert.strictEqual(strict(null, false), false);
assert.strictEqual(strict(undefined, true), true);
assert.strictEqual(strict(false, true), false);
assert.strictEqual(strict(0, 5), 0);
assert.strictEqual(strict(shipped.DEFAULT.voter_file.no_online_posting, true), true);
assert.strictEqual(strict(shipped.DEFAULT.voter_file.dob_in_public_file, false), false);
assert.strictEqual(strict(shipped.DEFAULT.blackout.state_extra_days, 0), 0);
pass('AT-03-strict');

const bundle = {
  DEFAULT: { rules: shipped.DEFAULT },
  NC: { rules: shipped.NC },
  NY: { rules: shipped.NY },
};
const missing = resolveRules('WY', bundle);
assert.strictEqual(missing.fallback, true);
assert.strictEqual(missing.rules.state, 'DEFAULT');
assert.ok(missing.reason && missing.reason.includes('No verified rules for WY. Strictest rules apply.'));
pass('AT-03');

const broken = resolveRules('NC', { ...bundle, NC: { rules: { ...shipped.NC, schema_version: '0.9' } } });
assert.strictEqual(broken.fallback, true);
assert.strictEqual(broken.rules.state, 'DEFAULT');
assert.ok(broken.reason && broken.reason.includes('No verified rules for NC'));
pass('AT-04');

assert.ok(String(shipped.TX.jury_list.statute).includes("Gov't Code 62.0132"));
assert.strictEqual(effective(shipped.TX).allow_jury_list, false);
pass('AT-05');

assert.throws(() => toCSV({
  allowNamedExport: false,
  result: { rows: [], capApplied: false, capBadge: null, excludedCount: 0, excludedAfterCount: 0, cannotCompareCount: 0, excludedLine: `0 ${EXCLUDE_PHRASE}`, cannotCompareLine: `0 ${CANNOT_COMPARE_PHRASE}`, counts: { Strong: 0, Probable: 0, Weak: 0 }, flagCounts: { REGISTERED_AFTER_DECLARATION: 0, REGISTERED_BEFORE_DECLARATION: 0, DATES_NOT_COMPARABLE: 0, REMOVED: 0, REINSTATED: 0, INACTIVE: 0, POSSIBLE_WRONGFUL_REMOVAL: 0 }, symmetric: { noncitizenRemovals: 0, withoutStrongMatch: 0 }, wrongfulCount: 0 },
  rules: shipped.NY,
  targets: [],
  county: 'Kings',
  dateStr: '2026-10-07',
}), /Named export is not allowed for this state/);
assert.strictEqual(effective(shipped.NY).allow_named_export, false);
pass('AT-06');

assert.deepStrictEqual(federalWindow('2026-11-03'), { start: '2026-08-05', end: '2026-11-03' });
assert.strictEqual(inRange('2026-08-05', '2026-08-05', '2026-11-03'), true);
assert.strictEqual(inRange('2026-11-03', '2026-08-05', '2026-11-03'), true);
assert.strictEqual(inRange('2026-08-04', '2026-08-05', '2026-11-03'), false);
assert.strictEqual(inRange('2026-10-07', '2026-08-05', '2026-11-03'), true);
pass('AT-07');

const sampleJ = fs.readFileSync(path.join(root, 'shared/samples/sample_juror_disqualifications.csv'), 'utf8');
const sampleV = fs.readFileSync(path.join(root, 'shared/samples/sample_voter_roll.csv'), 'utf8');
const sampleRun = runMatch(table('juror', sampleJ), table('voter', sampleV), shipped.NC);
assert.deepStrictEqual(sampleRun.coreResult.counts, { Strong: 3, Probable: 4, Weak: 2 });
const sampleCsv = toCSV({
  allowNamedExport: true,
  result: sampleRun.policy,
  rules: shipped.NC,
  targets: referralTargets(shipped.NC, shipped.DEFAULT),
  county: 'Wake',
  dateStr: '2026-10-07',
});
assert.ok(!/^Weak,/m.test(sampleCsv));
assert.ok(sampleCsv.includes('Alpha'));
assert.ok(!sampleCsv.includes('Foxtrot'));
assert.ok(!sampleCsv.includes('V0011'));
assert.ok(!sampleCsv.includes('V0005'));
assert.ok(!sampleCsv.includes('V0007'));
assert.ok(sampleCsv.includes(`2 ${EXCLUDE_PHRASE}`));
assert.ok(sampleCsv.includes(`2 ${CANNOT_COMPARE_PHRASE}`));
assert.ok(sampleRun.policy.rows.filter((row) => row.coreTier === 'Weak').every((row) => row.section === 'weak'));
assertBuckets(sampleRun.policy, sampleRun.coreResult.pairs.length);
pass('AT-08');

assert.strictEqual(sampleRun.policy.capApplied, true);
assert.deepStrictEqual(sampleRun.policy.counts, { Strong: 0, Probable: 3, Weak: 2 });
assert.strictEqual(sampleRun.policy.cannotCompareCount, 2);
assert.strictEqual(sampleRun.policy.excludedAfterCount, 2);
assert.ok(sampleRun.policy.capBadge && sampleRun.policy.capBadge.includes('North Carolina'));
assert.ok(sampleRun.policy.capBadge.includes('Highest tier: Probable.'));
pass('AT-09');

const dated = runMatch(table('juror', jurorDates), table('voter', voterDates), comparableRules());
const byVoter = (id: string) => {
  const row = dated.policy.rows.find((item) => item.voterId === id);
  if (!row) throw new Error(`missing ${id}`);
  return row;
};

const after = byVoter('V1');
assert.strictEqual(after.coreTier, 'Strong');
assert.strictEqual(after.excluded, true);
assert.strictEqual(after.section, 'excluded');
assert.ok(after.flags.includes('REGISTERED_AFTER_DECLARATION'));
assert.strictEqual(dated.policy.excludedLine, `4 ${EXCLUDE_PHRASE}`);
assert.strictEqual(dated.policy.cannotCompareLine, `3 ${CANNOT_COMPARE_PHRASE}`);
assertBuckets(dated.policy, dated.coreResult.pairs.length);
pass('AT-10');

const probableAfter = byVoter('V6');
assert.strictEqual(probableAfter.coreTier, 'Probable');
assert.strictEqual(probableAfter.excluded, true);
assert.strictEqual(probableAfter.section, 'excluded');
const datedCsv = toCSV({
  allowNamedExport: true,
  result: dated.policy,
  rules: comparableRules(),
  targets: referralTargets(shipped.NC, shipped.DEFAULT),
  county: 'Wake',
  dateStr: '2026-10-07',
});
assert.ok(!datedCsv.includes('Afterson'));
assert.ok(!datedCsv.includes('Probson'));
assert.ok(!datedCsv.includes('Wrongson'));
assert.ok(!datedCsv.includes('Inactson'));
assert.ok(!datedCsv.includes('Missingson'));
assert.ok(!datedCsv.includes('Equalson'));
assert.ok(!datedCsv.includes('Blankdecl'));
assert.ok(datedCsv.includes(`4 ${EXCLUDE_PHRASE}`));
assert.ok(datedCsv.includes(`3 ${CANNOT_COMPARE_PHRASE}`));
pass('AT-11');

const kept = byVoter('V2');
assert.strictEqual(kept.excluded, false);
assert.strictEqual(kept.tier, 'Strong');
assert.strictEqual(kept.section, 'main');
assert.ok(kept.flags.includes('REGISTERED_BEFORE_DECLARATION'));
assert.ok(datedCsv.includes('Keepson'));

const missingOnly = runMatch(table('juror', `Juror Number,Last,First,Birth Date,Address,Zip,Disqualification Reason,Disqualification Date
J1,Missingson,Cam,05/03/1982,3 Main St,00001,Not a U.S. citizen,2020-04-04
`), table('voter', `voter_id,name_last,name_first,date_of_birth,res_street,res_zip,status,registration_date
V1,Missingson,Cam,1982-05-03,3 Main St,00001,ACTIVE,
`), shipped.NC);
assert.strictEqual(missingOnly.policy.cannotCompareCount, 1);
assert.strictEqual(missingOnly.policy.excludedAfterCount, 0);
assert.strictEqual(missingOnly.policy.cannotCompareLine, `1 ${CANNOT_COMPARE_PHRASE}`);
assert.strictEqual(missingOnly.policy.counts.Strong + missingOnly.policy.counts.Probable + missingOnly.policy.counts.Weak, 0);
const missingCsv = toCSV({ allowNamedExport: true, result: missingOnly.policy, rules: shipped.NC, targets: [], county: 'Wake', dateStr: '2026-10-07' });
assert.ok(!missingCsv.includes('Missingson'));
assert.ok(!missingCsv.includes('V1'));
assert.ok(!/2020-04-04|1982-05-03/.test(missingOnly.policy.cannotCompareLine + missingOnly.policy.excludedLine));
assertBuckets(missingOnly.policy, 1);

const equalOnly = runMatch(table('juror', `Juror Number,Last,First,Birth Date,Address,Zip,Disqualification Reason,Disqualification Date
J1,Equalson,Quin,12/12/1974,11 Main St,00001,Not a U.S. citizen,2020-03-03
`), table('voter', `voter_id,name_last,name_first,date_of_birth,res_street,res_zip,status,registration_date
V1,Equalson,Quin,1974-12-12,11 Main St,00001,ACTIVE,2020-03-03
`), shipped.NC);
assert.strictEqual(equalOnly.policy.cannotCompareCount, 1);
assert.strictEqual(equalOnly.policy.excludedAfterCount, 0);
assert.strictEqual(equalOnly.policy.excludedLine, `0 ${EXCLUDE_PHRASE}`);
const equalCsv = toCSV({ allowNamedExport: true, result: equalOnly.policy, rules: shipped.NC, targets: [], county: 'Wake', dateStr: '2026-10-07' });
assert.ok(!equalCsv.includes('Equalson'));
assert.ok(!equalCsv.includes('V1'));
assert.ok(equalOnly.policy.rows[0].excluded);
assert.ok(equalOnly.policy.rows[0].flags.includes('DATES_NOT_COMPARABLE'));
assert.ok(!equalOnly.policy.rows[0].flags.includes('REGISTERED_AFTER_DECLARATION'));
assertBuckets(equalOnly.policy, 1);
pass('AT-12');

const missingDate = byVoter('V3');
assert.strictEqual(missingDate.excluded, true);
assert.strictEqual(missingDate.section, 'excluded');
assert.ok(missingDate.flags.includes('DATES_NOT_COMPARABLE'));
assert.ok(missingDate.notes.includes(SAVE_LINE));
assert.ok(!datedCsv.includes('Missingson'));
pass('AT-13-dates');

const removed = byVoter('V4');
assert.strictEqual(removed.section, 'already-removed');
assert.strictEqual(removed.excluded, false);
assert.ok(!removed.flags.includes('POSSIBLE_WRONGFUL_REMOVAL'));
assert.ok(datedCsv.includes('Already removed: confirm the removal was correct'));
assert.ok(datedCsv.includes('Removedson'));
pass('AT-13');

const wrongfulProbable = byVoter('V10');
assert.ok(wrongfulProbable.flags.includes('POSSIBLE_WRONGFUL_REMOVAL'));
assert.strictEqual(wrongfulProbable.excluded, false);
assert.strictEqual(wrongfulProbable.section, 'already-removed');
assert.ok(wrongfulProbable.flags.includes('REGISTERED_BEFORE_DECLARATION'));
assert.ok(datedCsv.includes('Lowson'));
pass('AT-14');

const reinstated = byVoter('V8');
assert.ok(reinstated.flags.includes('REINSTATED'));
assert.ok(reinstated.notes.some((note) => note.includes('Voter was reinstated')));
assert.strictEqual(reinstated.section, 'main');
pass('AT-16');

const inactive = byVoter('V7');
assert.ok(inactive.flags.includes('INACTIVE'));
assert.strictEqual(inactive.excluded, true);
assert.ok(inactive.flags.includes('POSSIBLE_WRONGFUL_REMOVAL'));
pass('AT-17');

const wrongfulRemoved = byVoter('V5');
assert.ok(wrongfulRemoved.flags.includes('POSSIBLE_WRONGFUL_REMOVAL'));
assert.strictEqual(wrongfulRemoved.excluded, true);
assert.strictEqual(wrongfulRemoved.section, 'excluded');
assert.ok(wrongfulProbable.flags.includes('POSSIBLE_WRONGFUL_REMOVAL'));
assert.strictEqual(wrongfulProbable.section, 'already-removed');
assert.ok(datedCsv.includes('Lowson'));
assert.ok(dated.policy.rows.filter((row) => row.excluded).every((row) => row.section === 'excluded'));
pass('AT-18-wrongful');

assert.strictEqual(dated.policy.symmetric.noncitizenRemovals, 2);
assert.strictEqual(dated.policy.symmetric.withoutStrongMatch, 1);
pass('AT-15');

const ssnHeader = screenColumns(['voter_id', 'SSN'], [['1', '']]);
assert.strictEqual(ssnHeader.ok, false);
pass('AT-20');

const notes = Array.from({ length: 20 }, (_, index) => ['V' + index, index === 0 ? '123-45-6789' : 'ok']);
const ssnValues = screenColumns(['voter_id', 'Notes'], notes);
assert.strictEqual(ssnValues.ok, false);
if (!ssnValues.ok) assert.deepStrictEqual(ssnValues.headers, ['Notes']);
const onePercent = screenColumns(['voter_id', 'Notes'], Array.from({ length: 100 }, (_, index) => ['V' + index, index === 0 ? '123-45-6789' : 'ok']));
assert.strictEqual(onePercent.ok, true);
pass('AT-21');

const flag = screenColumns(['name_last', 'drivers_lic'], [['Ada', 'Y'], ['Bea', 'N'], ['Cy', '']]);
assert.strictEqual(flag.ok, true);
if (flag.ok) {
  assert.deepStrictEqual(flag.dropColumns, [1]);
  assert.ok(flag.note && flag.note.includes('drivers_lic'));
}
const license = screenColumns(['name_last', 'drivers_lic'], [['Ada', 'D1234567']]);
assert.strictEqual(license.ok, false);
pass('AT-19');

const broker = screenColumns(['Experian ID', 'name_last'], [['1', 'Ada']]);
assert.strictEqual(broker.ok, false);
const l2 = screenColumns(['L2', 'name_last'], [['1', 'Ada']]);
assert.strictEqual(l2.ok, false);
const l2score = screenColumns(['l2score', 'name_last'], [['1', 'Ada']]);
assert.strictEqual(l2score.ok, true);
pass('AT-23');

assert.strictEqual(sha256HexSync('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
let log = appendEntry([], 'session_start', { state: 'NC' });
log = appendEntry(log, 'rules_loaded', { state: 'NC' });
assert.strictEqual(verifyChain(log).ok, true);
const tampered = log.map((entry) => ({ ...entry, data: { ...entry.data } }));
tampered[0].data.state = 'TX';
const brokenChain = verifyChain(tampered);
assert.strictEqual(brokenChain.ok, false);
if (!brokenChain.ok) assert.strictEqual(brokenChain.seq, 1);
assert.strictEqual(canonicalJson({ b: 1, a: 2 }), '{"a":2,"b":1}');
pass('AT-24');

const letter = auditLetter(shipped.TX, referralTargets(shipped.TX, shipped.DEFAULT), {
  periodFrom: '2026-01-01',
  periodTo: '2026-06-01',
  juryCount: '12',
  jurySource: 'clerk summary',
  removals: '3',
  removalSource: 'county report',
  county: 'Travis',
});
assert.ok(letter.includes('Is this process running in Travis? How many records were received, reviewed, confirmed, and removed in the period?'));
assert.ok(letter.includes('Travis board of elections'));
assert.ok(letter.includes('Texas Secretary of State - Elections Division'));
assert.ok(!/Afterson|Keepson|John Smith/.test(letter));
const wakeLetter = auditLetter(shipped.NC, referralTargets(shipped.NC, shipped.DEFAULT), {
  periodFrom: '',
  periodTo: '',
  juryCount: '',
  jurySource: '',
  removals: '',
  removalSource: '',
  county: 'Wake County',
  fips: '37183',
});
assert.ok(wakeLetter.includes('County: Wake County (37183)'));
assert.ok(wakeLetter.includes('Wake County board of elections'));
assert.ok(wakeLetter.includes('North Carolina State Board of Elections'));
assert.ok(!wakeLetter.includes('County boards of elections (NCSBE directory)'));
pass('AT-26-letter');

const eac = referralTargets(shipped.DEFAULT, shipped.DEFAULT);
assert.ok(eac.some((target) => target.url.includes('eac.gov')));
assert.ok(referralTargets(shipped.NC, shipped.DEFAULT).length >= 1);
pass('AT-27');

assert.deepStrictEqual(ATTEST_LINES, [
  'I got each file from an official source, and I obey its use rules.',
  'I will send leads only to the offices in the referral list.',
  'I will not publish any name or contact any voter.',
  'I understand a match is not proof. Only officials can verify citizenship.',
  'I will purge the data after I send the referral.',
]);
pass('AT-32');

assert.ok(datedCsv.startsWith('Referral for official verification'));
assert.ok(datedCsv.includes(SAVE_EXPORT_LINE));
assert.ok(datedCsv.includes('State: NC'));
assert.ok(sampleRun.policy.excludedLine === `2 ${EXCLUDE_PHRASE}`);
assert.ok(sampleRun.policy.cannotCompareLine === `2 ${CANNOT_COMPARE_PHRASE}`);
assert.ok(sampleRun.policy.rows.every((row) => row.notes.includes(SAVE_LINE)));
const sampleLeads = sampleRun.policy.counts.Strong + sampleRun.policy.counts.Probable + sampleRun.policy.counts.Weak;
assert.strictEqual(sampleLeads + sampleRun.policy.excludedAfterCount + sampleRun.policy.cannotCompareCount, sampleRun.coreResult.pairs.length);
const nySample = runMatch(table('juror', sampleJ), table('voter', sampleV), shipped.NY);
assert.strictEqual(effective(shipped.NY).allow_named_export, false);
assert.strictEqual(nySample.coreResult.counts.Strong, 3);
assert.deepStrictEqual(nySample.policy.counts, sampleRun.policy.counts);
assert.strictEqual(nySample.policy.excludedAfterCount, 2);
assert.strictEqual(nySample.policy.cannotCompareCount, 2);
pass('AT-30');

const ncDeadline = stateWindowDates('2026-11-03', shipped.NC.blackout.state_windows, '2026-10-07');
assert.strictEqual(addDays('2026-11-03', -25), '2026-10-09');
assert.strictEqual(ncDeadline[0].date, '2026-10-09');
assert.strictEqual(ncDeadline[0].passed, false);
assert.strictEqual(stateWindowDates('2026-11-03', shipped.NC.blackout.state_windows, '2026-10-09')[0].passed, false);
assert.strictEqual(stateWindowDates('2026-11-03', shipped.NC.blackout.state_windows, '2026-10-10')[0].passed, true);
assert.strictEqual(effective(shipped.NY).show_challenge_guidance, false);
assert.strictEqual(strict(shipped.NC.private_challenge.one_per_affidavit, true), true);
pass('AT-31');

assert.strictEqual(UI_DATE_STRICTNESS, 'strict');
const lenient = runMatch(table('juror', jurorDates), table('voter', voterDates), comparableRules(), { dateStrictness: 'lenient' });
const lenientMissing = lenient.policy.rows.find((row) => row.voterId === 'V3');
const lenientEqual = lenient.policy.rows.find((row) => row.voterId === 'V11');
assert.ok(lenientMissing && lenientEqual);
assert.strictEqual(lenientMissing.excluded, false);
assert.ok(lenientMissing.notes.includes('date missing'));
assert.strictEqual(lenientEqual.excluded, false);
assert.ok(lenientEqual.flags.includes('REGISTERED_BEFORE_DECLARATION'));
const lenientTx = runMatch(table('juror', jurorDates), table('voter', voterDates), shipped.TX, { dateStrictness: 'lenient' });
const lenientTxRow = lenientTx.policy.rows.find((row) => row.voterId === 'V1');
assert.ok(lenientTxRow);
assert.strictEqual(lenientTxRow.excluded, false);
assert.ok(lenientTxRow.notes.includes('cannot compare'));
pass('AT-lenient');

const ndVoter = `voter_id,name_last,name_first,date_of_birth,res_street,res_zip,status,last_voted
V1,Signal,Sam,1980-03-14,1 Main St,00001,ACTIVE,2019-01-01
`;
const ndJuror = `Juror Number,Last,First,Birth Date,Address,Zip,Disqualification Reason,Disqualification Date
J1,Signal,Sam,03/14/1980,1 Main St,00001,Not a U.S. citizen,2020-01-15
`;
const ndVoterTable = table('voter', ndVoter);
assert.strictEqual(ndVoterTable.extra.regDate, -1);
assert.strictEqual(guessExtra('voter', ['last_voted', 'file_entry_date']).regDate, -1);
const ndRun = runMatch(table('juror', ndJuror), ndVoterTable, loadRules('ND.json'));
assert.strictEqual(ndRun.coreResult.counts.Strong, 1);
assert.strictEqual(ndRun.policy.cannotCompareCount, 1);
assert.strictEqual(ndRun.policy.excludedAfterCount, 0);
assert.ok(ndRun.policy.rows.every((row) => row.excluded && row.section === 'excluded'));
assert.strictEqual(ndRun.policy.cannotCompareLine, `1 ${CANNOT_COMPARE_PHRASE}`);
const ndRuled = applyDateRule(ndRun.policy.rows.map((row) => ({ reg: null, decl: '2020-01-15' })));
assert.strictEqual(ndRuled.cannotCompare.length, 1);
assert.strictEqual(ndRuled.leads.length + ndRuled.registeredAfter.length, 0);
pass('AT-35');

const noRegJ = fs.readFileSync(path.join(root, 'test/fixtures/juror_three.csv'), 'utf8');
const noRegV = fs.readFileSync(path.join(root, 'test/fixtures/voter_no_regdate.csv'), 'utf8');
const noReg = runMatch(table('juror', noRegJ), table('voter', noRegV), shipped.NC);
assert.strictEqual(noReg.coreResult.counts.Strong + noReg.coreResult.counts.Probable, 3);
assert.strictEqual(noReg.policy.cannotCompareLine, `3 ${CANNOT_COMPARE_PHRASE}`);
assert.strictEqual(noReg.policy.excludedLine, `0 ${EXCLUDE_PHRASE}`);
assert.strictEqual(noReg.policy.counts.Strong + noReg.policy.counts.Probable + noReg.policy.counts.Weak, 0);
const noRegCsv = toCSV({ allowNamedExport: true, result: noReg.policy, rules: shipped.NC, targets: referralTargets(shipped.NC, shipped.DEFAULT), county: 'Wake', dateStr: '2026-10-07' });
assert.ok(noRegCsv.includes(`3 ${CANNOT_COMPARE_PHRASE}`));
assert.ok(noRegCsv.includes(`0 ${EXCLUDE_PHRASE}`));
assert.ok(!noRegCsv.includes('Pellson'));
assert.ok(!noRegCsv.includes('Quillson'));
assert.ok(!noRegCsv.includes('Rennson'));
assert.ok(!/^Strong,|^Probable,|^Weak,/m.test(noRegCsv));
assertBuckets(noReg.policy, 3);
pass('AT-37');

const bucketJ = `Juror Number,Last,First,Birth Date,Address,Zip,Disqualification Reason,Disqualification Date
J1,Before,Ann,03/14/1980,1 Main St,00001,Not a U.S. citizen,2020-06-01
J2,After,Bob,04/02/1981,2 Main St,00001,Not a U.S. citizen,2020-01-15
J3,Equal,Cam,05/03/1982,3 Main St,00001,Not a U.S. citizen,2020-03-03
J4,Noreg,Dee,06/04/1983,4 Main St,00001,Not a U.S. citizen,2020-04-04
J5,Nodecl,Eve,07/05/1984,5 Main St,00001,Not a U.S. citizen,
`;
const bucketV = `voter_id,name_last,name_first,date_of_birth,res_street,res_zip,status,registration_date
V1,Before,Ann,1980-03-14,1 Main St,00001,ACTIVE,2019-01-01
V2,After,Bob,1981-04-02,2 Main St,00001,ACTIVE,2021-05-01
V3,Equal,Cam,1982-05-03,3 Main St,00001,ACTIVE,2020-03-03
V4,Noreg,Dee,1983-06-04,4 Main St,00001,ACTIVE,
V5,Nodecl,Eve,1984-07-05,5 Main St,00001,ACTIVE,2010-01-01
`;
const ruleFiles = fs.readdirSync(rulesDir).filter((name) => name.endsWith('.json') && name !== 'schema.json');
assert.strictEqual(ruleFiles.length, 52);
for (const name of ruleFiles) {
  const rules = loadRules(name);
  const ran = runMatch(table('juror', bucketJ), table('voter', bucketV), rules);
  const leads = ran.policy.counts.Strong + ran.policy.counts.Probable + ran.policy.counts.Weak;
  assert.strictEqual(leads, 1, name);
  assert.strictEqual(ran.policy.excludedAfterCount, 1, name);
  assert.strictEqual(ran.policy.cannotCompareCount, 3, name);
  assert.strictEqual(leads + ran.policy.excludedAfterCount + ran.policy.cannotCompareCount, ran.coreResult.pairs.length, name);
  assert.strictEqual(ran.policy.rows.length, ran.coreResult.pairs.length, name);
}
const pure = applyDateRule([
  { reg: '2019-01-01', decl: '2020-06-01' },
  { reg: '2021-05-01', decl: '2020-01-15' },
  { reg: '2020-03-03', decl: '2020-03-03' },
  { reg: null, decl: '2020-04-04' },
  { reg: '2010-01-01', decl: null },
]);
assert.strictEqual(pure.leads.length, 1);
assert.strictEqual(pure.registeredAfter.length, 1);
assert.strictEqual(pure.cannotCompare.length, 3);
assert.strictEqual(pure.leads.length + pure.registeredAfter.length + pure.cannotCompare.length, 5);
pass('AT-38');

const beforeOnly = runMatch(table('juror', `Juror Number,Last,First,Birth Date,Address,Zip,Disqualification Reason,Disqualification Date
J1,Keepson,Bob,04/02/1981,2 Main St,00001,Not a U.S. citizen,2020-06-01
`), table('voter', `voter_id,name_last,name_first,date_of_birth,res_street,res_zip,status,registration_date
V1,Keepson,Bob,1981-04-02,2 Main St,00001,ACTIVE,2019-01-01
`), shipped.NC);
assert.strictEqual(beforeOnly.policy.excludedLine, `0 ${EXCLUDE_PHRASE}`);
assert.strictEqual(beforeOnly.policy.cannotCompareLine, `0 ${CANNOT_COMPARE_PHRASE}`);
assert.strictEqual(beforeOnly.policy.counts.Strong + beforeOnly.policy.counts.Probable + beforeOnly.policy.counts.Weak, 1);
assert.strictEqual(beforeOnly.policy.counts.Probable, 1);
pass('AT-39');

const blankDecl = byVoter('V12');
assert.strictEqual(blankDecl.excluded, true);
assert.strictEqual(blankDecl.section, 'excluded');
assert.ok(blankDecl.flags.includes('DATES_NOT_COMPARABLE'));
assert.ok(!datedCsv.includes('Blankdecl'));
pass('AT-40');

const dcRules = loadRules('DC.json');
assert.strictEqual(effective(dcRules).show_challenge_guidance, false);
assert.strictEqual(uiGates(dcRules).aggregate_only, true);
assert.strictEqual(uiGates(dcRules).allow_named_export, false);
assert.strictEqual(uiGates(dcRules).show_challenge_guidance, false);
assert.ok(NON_SIGNAL.DC.includes('1-1001.02(2)(B)'));
assert.ok(NON_SIGNAL.CT.includes('lawful permanent residents'));
const openedDc = {
  ...dcRules,
  jury_list: { ...dcRules.jury_list, public: true },
  gates: { ...dcRules.gates, allow_jury_list: true, aggregate_only: false, allow_named_export: true, show_challenge_guidance: true },
};
assert.strictEqual(effective(openedDc).show_challenge_guidance, true);
assert.strictEqual(uiGates(openedDc).show_challenge_guidance, false);
assert.strictEqual(uiGates(openedDc).allow_named_export, false);
const dcPair = runMatch(table('juror', ndJuror), table('voter', `voter_id,name_last,name_first,date_of_birth,res_street,res_zip,status,registration_date
V1,Signal,Sam,1980-03-14,1 Main St,00001,ACTIVE,2019-01-01
`), dcRules);
assert.strictEqual(dcPair.coreResult.counts.Strong, 1);
assert.strictEqual(uiGates(dcRules).allow_named_export, false);
pass('AT-34');

const caRules = loadRules('CA.json');
assert.strictEqual(useLimitApplies(caRules), true);
assert.ok(String(caRules.voter_file.permitted_uses).includes('2194'));
assert.strictEqual(effective(caRules).show_challenge_guidance, false);
pass('AT-36');

const nmRules = loadRules('NM.json');
assert.strictEqual(nmRules.blackout.state_extra_days, 30);
assert.strictEqual(stateWindowDates('2026-11-03', nmRules.blackout.state_windows, '2026-10-07')[0].date, addDays('2026-11-03', -120));
pass('AT-NM-window');

const namedStates: string[] = [];
const challengeStates: string[] = [];
for (const name of ruleFiles) {
  const rules = loadRules(name);
  if (rules.state === 'DEFAULT') continue;
  const gates = effective(rules);
  if (gates.allow_named_export) namedStates.push(rules.state);
  if (gates.show_challenge_guidance) challengeStates.push(rules.state);
}
namedStates.sort();
challengeStates.sort();
assert.deepStrictEqual(namedStates, ['NC', 'PA']);
assert.deepStrictEqual(challengeStates, ['NC']);
pass('AT-NC-only');

const paNames = runMatch(
  table('juror', 'Last,First,Reason\nNamesonly,Ada,Not a U.S. citizen\n'),
  table('voter', 'voter_id,name_last,name_first,date_of_birth,res_street,res_zip,status,registration_date\nV1,Namesonly,Ada,1980-01-02,1 Main St,00001,ACTIVE,2019-01-01\n'),
  shipped.PA,
);
assert.strictEqual(paNames.policy.counts.Strong, 0);
assert.strictEqual(paNames.policy.counts.Probable, 0);
assert.strictEqual(paNames.policy.counts.Weak + paNames.policy.cannotCompareCount, paNames.coreResult.pairs.length);
assert.ok(paNames.coreResult.pairs.length > 0);
assert.ok(paNames.policy.rows.every((row) => row.section === 'weak' || row.section === 'excluded'));
assert.ok(paNames.policy.rows.every((row) => row.section !== 'weak' || row.tier === 'Weak'));
assert.ok(paNames.policy.rows.filter((row) => row.section === 'excluded').every((row) => row.flags.includes('DATES_NOT_COMPARABLE')));
const paCsv = toCSV({
  allowNamedExport: true,
  result: paNames.policy,
  rules: shipped.PA,
  targets: referralTargets(shipped.PA, shipped.DEFAULT),
  county: 'Adams',
  dateStr: '2026-10-07',
});
assert.ok(!paCsv.includes('Namesonly'));
assert.ok(!/^Strong,|^Probable,|^Weak,/m.test(paCsv));
assert.strictEqual(effective(shipped.PA).show_challenge_guidance, false);
pass('AT-41');

const bundled = JSON.parse(fs.readFileSync(path.join(root, 'shared/src/rulesBundle.json'), 'utf8')) as Record<string, unknown>;
const expectedKeys = ruleFiles.map((name) => (name === 'default.json' ? 'DEFAULT' : name.replace(/\.json$/, ''))).sort();
assert.deepStrictEqual(Object.keys(bundled).sort(), expectedKeys);
pass('AT-02-bundle');

assert.ok(ND_REGISTRATION_NOTE.includes('North Dakota has no voter registration'));
pass('AT-35-copy');

console.log('ALL POLICY TESTS PASSED');
