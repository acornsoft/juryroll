import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import core from '../shared/src/core.js';
import { guessExtra } from '../shared/src/policy/columns.ts';
import { runMatch, type LoadedTable } from '../shared/src/policy/runMatch.ts';
import type { RulesFile } from '../shared/src/policy/gates.ts';
import {
  applyPaPreset,
  countsAsNonCitizen,
  defaultChoice,
  filterFromMap,
  tallyReasons,
  type ReasonMap,
} from '../app/src/lib/reasons.ts';
import { SUMMARY_DISCLAIMER, summaryCopy, summaryLine, upsertCountyRun, type CountyRun } from '../app/src/lib/summary.ts';
import { applyPaste, blankGrid, gridToCsv, parsePaste, rowAfterEnter } from '../app/src/lib/transcribe.ts';
import { HISTORY_LABEL, historyByVoterId, historyColumnIndex } from '../app/src/lib/voterContext.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nc = JSON.parse(fs.readFileSync(path.join(root, 'shared/rules/NC.json'), 'utf8')) as RulesFile;

function table(kind: 'juror' | 'voter', text: string, reasonMap?: ReasonMap): LoadedTable {
  const head = core.readHead(text, true);
  const fields = kind === 'juror' ? core.JUROR_FIELDS : core.VOTER_FIELDS;
  const map = core.guessMapping(head.headers, fields);
  return {
    text,
    delim: head.delim,
    hasHeader: true,
    headers: head.headers,
    map,
    extra: guessExtra(kind, head.headers),
    order: 'MDY',
    reasonFilter: kind === 'juror' && reasonMap ? filterFromMap(reasonMap) : null,
  };
}

const juror = `Juror Number,Last,First,Birth Date,Address,Zip,Disqualification Reason,Disqualification Date,Age
J1,Keepson,Bob,04/02/1981,2 Main St,00001,47,2019-01-01,44
J2,Langson,Ann,03/14/1980,1 Main St,00001,12,2019-01-01,45
J3,Homeson,Cam,05/03/1982,3 Main St,00001,9,2019-01-01,43
`;
const voter = `voter_id,name_last,name_first,date_of_birth,res_street,res_zip,status,registration_date
V1,Keepson,Bob,1981-04-02,2 Main St,00001,ACTIVE,2018-01-01
V2,Langson,Ann,1980-03-14,1 Main St,00001,ACTIVE,2018-01-01
V3,Homeson,Cam,1982-05-03,3 Main St,00001,ACTIVE,2018-01-01
`;
const voterWithHistory = `voter_id,name_last,name_first,date_of_birth,res_street,res_zip,status,registration_date,Voted
V1,Keepson,Bob,1981-04-02,2 Main St,00001,ACTIVE,2018-01-01,2024 General
V2,Langson,Ann,1980-03-14,1 Main St,00001,ACTIVE,2018-01-01,2022 Primary
V3,Homeson,Cam,1982-05-03,3 Main St,00001,ACTIVE,2018-01-01,2020 General
`;

assert.equal(defaultChoice('Not a U.S. citizen'), 'Non-citizen');
assert.equal(defaultChoice('47'), '');
assert.equal(defaultChoice('language barrier'), '');
assert.equal(defaultChoice("can't read English"), '');
assert.equal(defaultChoice('non-resident'), '');
assert.equal(countsAsNonCitizen('Language'), false);
assert.equal(countsAsNonCitizen('Non-resident'), false);
assert.equal(countsAsNonCitizen('Other'), false);
assert.equal(countsAsNonCitizen(''), false);
assert.equal(countsAsNonCitizen('Non-citizen'), true);

const mapped: ReasonMap = { '47': 'Non-citizen', '12': 'Language', '9': 'Non-resident', 'Not a U.S. citizen': 'Language' };
const tallies = tallyReasons(['47', '12', '9', 'Not a U.S. citizen', '99'], mapped);
assert.equal(tallies.entered, 5);
assert.equal(tallies.nonCitizen, 1);
assert.equal(tallies.language, 2);
assert.equal(tallies.nonResident, 1);
assert.equal(tallies.unmapped, 1);
assert.equal(tallies.nonCitizen + tallies.language + tallies.nonResident + tallies.other + tallies.unmapped, tallies.entered);
assert.equal(filterFromMap(mapped)['12'], false);
assert.equal(filterFromMap(mapped)['9'], false);
assert.equal(filterFromMap(mapped)['Not a U.S. citizen'], false);
assert.equal(filterFromMap(mapped)['47'], true);
assert.equal(applyPaPreset({ '12': 'Language' })['47'], 'Non-citizen');
assert.equal(applyPaPreset({ '12': 'Language' })['12'], 'Language');

const filtered = runMatch(table('juror', juror, mapped), table('voter', voter), nc);
const names = filtered.coreResult.pairs.map((pair) => pair.voterName);
assert.deepEqual(names, ['Bob Keepson']);
assert.ok(!names.some((name) => name.includes('Langson') || name.includes('Homeson')));
assert.equal(filtered.policy.counts.Strong + filtered.policy.counts.Probable + filtered.policy.counts.Weak, filtered.coreResult.pairs.length);

const plain = `Juror Number,Last,First,Birth Date,Address,Zip,Disqualification Reason,Disqualification Date
J1,Keepson,Bob,04/02/1981,2 Main St,00001,47,2019-01-01
`;
const withAge = `Juror Number,Last,First,Birth Date,Address,Zip,Disqualification Reason,Disqualification Date,Age
J1,Keepson,Bob,04/02/1981,2 Main St,00001,47,2019-01-01,44
`;
const ageOff = runMatch(table('juror', plain, { '47': 'Non-citizen' }), table('voter', voter), nc);
const ageOn = runMatch(table('juror', withAge, { '47': 'Non-citizen' }), table('voter', voter), nc);
assert.deepEqual(ageOn.coreResult.pairs, ageOff.coreResult.pairs);
assert.deepEqual(ageOn.coreResult.counts, ageOff.coreResult.counts);
assert.deepEqual(ageOn.policy.counts, ageOff.policy.counts);

const historyOff = runMatch(table('juror', plain, { '47': 'Non-citizen' }), table('voter', voter), nc);
const historyOn = runMatch(table('juror', plain, { '47': 'Non-citizen' }), table('voter', voterWithHistory), nc);
assert.deepEqual(historyOn.coreResult.pairs, historyOff.coreResult.pairs);
assert.deepEqual(historyOn.coreResult.counts, historyOff.coreResult.counts);
assert.deepEqual(
  historyOn.policy.rows.map((row) => ({ tier: row.tier, voterId: row.voterId, notes: row.notes })),
  historyOff.policy.rows.map((row) => ({ tier: row.tier, voterId: row.voterId, notes: row.notes })),
);
const historyHeaders = core.readHead(voterWithHistory, true).headers;
assert.ok(historyColumnIndex(historyHeaders) >= 0);
const history = historyByVoterId(voterWithHistory, ',', true, historyHeaders, core.guessMapping(historyHeaders, core.VOTER_FIELDS).voter_id);
assert.equal(history.V1, '2024 General');
assert.equal(HISTORY_LABEL, 'Context only, not evidence.');
assert.ok(!historyOn.coreResult.pairs.some((pair) => pair.matched.includes('2024 General') || pair.matched.toLowerCase().includes('voted')));

const row: CountyRun = {
  stateCode: 'NC',
  stateName: 'North Carolina',
  countyName: 'Wake County',
  countyFips: '37183',
  entered: 3,
  nonCitizen: 1,
  language: 1,
  nonResident: 1,
  strong: 0,
  probable: 1,
  weak: 0,
  excluded: 0,
  cannotCompare: 0,
};
const line = summaryLine(row);
assert.match(line, /Wake County, North Carolina: 3 non-juror records entered, 1 coded non-citizen, 1 potential matches on the voter roll \(Strong 0 \/ Probable 1 \/ Weak 0\), 0 excluded, 0 cannot compare\. Language 1 excluded\. Non-resident 1 excluded\./);
assert.ok(!line.includes('Keepson'));
assert.ok(!line.includes('Langson'));
assert.equal(summaryCopy([row]).endsWith(SUMMARY_DISCLAIMER), true);
const second: CountyRun = { ...row, countyName: 'Durham County', countyFips: '37063', entered: 4 };
const again: CountyRun = { ...row, entered: 9 };
const rollup = upsertCountyRun(upsertCountyRun([row], second), again);
assert.deepEqual(rollup.map((item) => item.countyFips), ['37183', '37063']);
assert.equal(rollup[0].entered, 9);

const pasted = parsePaste('Last\tFirst\nAda\tBee\n');
assert.equal(pasted.length, 1);
assert.equal(pasted[0][1], 'Ada');
assert.equal(pasted[0][2], 'Bee');
const filled = applyPaste(blankGrid(), 0, 0, pasted);
assert.equal(filled[0][1], 'Ada');
assert.equal(rowAfterEnter(0, 1).rowCount, 2);
const csv = gridToCsv(filled);
assert.match(csv, /Ada/);
assert.doesNotMatch(csv, /localStorage/);
for (const file of [
  'app/src/lib/transcribe.ts',
  'app/src/lib/reasons.ts',
  'app/src/lib/summary.ts',
  'app/src/components/TypeGrid.tsx',
  'app/src/App.tsx',
]) {
  assert.equal(fs.readFileSync(path.join(root, file), 'utf8').includes('localStorage'), false, file);
}

console.log('session tests passed');
