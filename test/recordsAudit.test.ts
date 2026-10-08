import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRoute } from '../app/src/route.ts';
import { recordsCountsSummary, recordsRequestLetter } from '../shared/src/policy/recordsAudit.ts';
import {
  EXEMPT_APPLICATION,
  FEDERAL_REQUIREMENT,
  NVRA_EXEMPT_PARAGRAPH,
  NVRA_EXEMPT_SENTENCE,
  RESIDENTS_ONLY_CITE,
  RESIDENTS_ONLY_NOTE,
  STATE_RECORDS_ROUTE,
  USC_20503_B,
  USC_20503_B_CITE,
  USC_20507_I,
  recordsRouteFor,
} from '../shared/src/policy/recordsRoutes.ts';
import type { RulesFile } from '../shared/src/policy/gates.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadRules(code: string): RulesFile {
  return JSON.parse(fs.readFileSync(path.join(root, 'shared/rules', `${code}.json`), 'utf8')) as RulesFile;
}

type County = { name: string; fips: string };
const counties = JSON.parse(fs.readFileSync(path.join(root, 'shared/src/counties.json'), 'utf8')) as Record<string, County[]>;

function countyName(code: string): County {
  const county = counties[code]?.[0];
  assert.ok(county, `${code} has a county`);
  return county;
}

function pass(id: string) {
  console.log(`${id} PASS`);
}

const QUOTE = 'This chapter does not apply to a State described in either or both of the following paragraphs: (1) A State in which, under law that is in effect continuously on and after August 1, 1994, there is no voter registration requirement for any voter in the State with respect to an election for Federal office. (2) A State in which, under law that is in effect continuously on and after August 1, 1994, or that was enacted on or prior to August 1, 1994, and by its terms is to come into effect upon the enactment of this chapter, so long as that law remains in effect, all voters in the State may register to vote at the polling place at the time of voting in a general election for Federal office.';

assert.strictEqual(USC_20503_B, QUOTE);
assert.strictEqual(USC_20507_I, '52 U.S.C. 20507(i) requires states to keep records of list-maintenance programs for 2 years and make them available for public inspection.');
assert.strictEqual(NVRA_EXEMPT_SENTENCE, 'ID, MN, NH, ND, WI and WY are exempt from the NVRA, so 20507(i) doesn\'t apply there.');
assert.strictEqual(RESIDENTS_ONLY_NOTE, 'some state records laws cover state residents only (TN 10-7-503, AR, KY 61.872(1)). The federal 20507(i) request has no residency limit where the NVRA applies.');
assert.strictEqual(FEDERAL_REQUIREMENT, 'federal law requires a "reasonable effort" program to remove voters for death and change of residence (20507(a)(4)), plus removal of inactive voters only after a notice and two federal general elections with no response or vote (20507(d)). The NCOA (Postal Service change-of-address) process is an optional safe harbor (20507(c)(1)), not a requirement. The audit should ask whether the program runs and for its counts, not whether NCOA is used.');
assert.strictEqual(STATE_RECORDS_ROUTE, 'Use the state records route instead.');
assert.strictEqual(EXEMPT_APPLICATION, 'The statute does not name states. The six-state list (ND under paragraph (1); ID, MN, NH, WI and WY under paragraph (2)) is the accepted application.');
assert.strictEqual(USC_20503_B_CITE, '52 U.S.C. 20503(b) (https://www.law.cornell.edu/uscode/text/52/20503, verified 2026-10-07)');
pass('RA-wording');

const states = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];
assert.strictEqual(states.length, 51);
for (const code of states) {
  const route = recordsRouteFor(code);
  const exempt = NVRA_EXEMPT_PARAGRAPH[code] ?? null;
  assert.strictEqual(route.kind, exempt ? 'state-public-records' : 'nvra', code);
  assert.strictEqual(route.exemptParagraph, exempt, code);
  assert.strictEqual(route.residentsOnlyCite, RESIDENTS_ONLY_CITE[code] ?? null, code);
}
assert.deepStrictEqual(Object.keys(NVRA_EXEMPT_PARAGRAPH).sort(), ['ID', 'MN', 'ND', 'NH', 'WI', 'WY']);
assert.strictEqual(NVRA_EXEMPT_PARAGRAPH.ND, '1');
assert.strictEqual(NVRA_EXEMPT_PARAGRAPH.WY, '2');
assert.deepStrictEqual(RESIDENTS_ONLY_CITE, { TN: 'TN 10-7-503', AR: 'AR', KY: 'KY 61.872(1)' });
pass('RA-routes');

const oh = loadRules('OH');
const franklin = counties.OH.find((item) => item.name === 'Franklin County');
assert.ok(franklin);
const ohLetter = recordsRequestLetter(oh, franklin.name, franklin.fips, { periodFrom: '2025-01-01', periodTo: '2025-12-31' });
assert.ok(ohLetter.includes(USC_20507_I));
assert.ok(ohLetter.includes(FEDERAL_REQUIREMENT));
assert.ok(ohLetter.includes('Franklin County board of elections'));
assert.ok(ohLetter.includes('Ohio Secretary of State - Elections'));
assert.ok(ohLetter.includes('County: Franklin County (39049)'));
assert.ok(ohLetter.includes('Removals for death:'));
assert.ok(ohLetter.includes('Removals for change of address:'));
assert.ok(ohLetter.includes('Removals of inactive voters after a notice and two federal general elections with no response or vote:'));
assert.ok(ohLetter.includes('Notices sent:'));
assert.ok(ohLetter.includes('This letter asks for counts only. It asks for no names.'));
assert.ok(!ohLetter.includes('20503(b)'));
assert.ok(!ohLetter.includes(RESIDENTS_ONLY_NOTE));
assert.ok(!ohLetter.includes('Ohio Attorney General'));
assert.ok(!/jury clerk/i.test(ohLetter));
assert.ok(!/challenger|poll-watch/i.test(ohLetter));
pass('RA-nvra-ohio');

const id = loadRules('ID');
const ada = countyName('ID');
const idLetter = recordsRequestLetter(id, ada.name, ada.fips, { periodFrom: '', periodTo: '' });
assert.strictEqual(recordsRouteFor('ID').kind, 'state-public-records');
assert.strictEqual(recordsRouteFor('ID').exemptParagraph, '2');
assert.ok(idLetter.includes(NVRA_EXEMPT_SENTENCE));
assert.ok(idLetter.includes(STATE_RECORDS_ROUTE));
assert.ok(idLetter.includes(USC_20503_B));
assert.ok(idLetter.includes(EXEMPT_APPLICATION));
assert.ok(!idLetter.includes(USC_20507_I));
assert.ok(!idLetter.includes('Idaho Attorney General'));
assert.ok(!/jury clerk/i.test(idLetter));
pass('RA-exempt-idaho');

for (const code of ['TN', 'AR', 'KY'] as const) {
  const rules = loadRules(code);
  const county = countyName(code);
  const letter = recordsRequestLetter(rules, county.name, county.fips, { periodFrom: '2025-01-01', periodTo: '2025-06-01' });
  assert.strictEqual(recordsRouteFor(code).kind, 'nvra', code);
  assert.ok(letter.includes(USC_20507_I), code);
  assert.ok(letter.includes(RESIDENTS_ONLY_NOTE), code);
  assert.ok(letter.includes(RESIDENTS_ONLY_CITE[code]), code);
  assert.ok(!letter.includes('20503(b)'), code);
}
pass('RA-residents-only');

const summary = recordsCountsSummary('OH', {
  periodFrom: '2025-01-01',
  periodTo: '2025-12-31',
  deathRemovals: '12',
  addressRemovals: '34',
  inactiveRemovals: '5',
  noticesSent: '40',
});
assert.ok(summary.includes(FEDERAL_REQUIREMENT));
assert.ok(summary.includes('optional safe harbor'));
assert.ok(summary.includes('Removals for death: 12'));
assert.ok(summary.includes('Removals for change of address: 34'));
assert.ok(summary.includes('Removals of inactive voters after a notice and two federal general elections with no response or vote: 5'));
assert.ok(summary.includes('Notices sent: 40'));
assert.ok(summary.startsWith('Counts only. No names.'));
assert.ok(!summary.includes(RESIDENTS_ONLY_NOTE));
assert.ok(!/Smith|Afterson|Keepson/.test(summary));
const tnSummary = recordsCountsSummary('TN', {
  periodFrom: '',
  periodTo: '',
  deathRemovals: '',
  addressRemovals: '',
  inactiveRemovals: '',
  noticesSent: '',
});
assert.ok(tnSummary.includes(RESIDENTS_ONLY_NOTE));
assert.ok(tnSummary.includes('Removals for death: —'));
const wySummary = recordsCountsSummary('WY', {
  periodFrom: '',
  periodTo: '',
  deathRemovals: '1',
  addressRemovals: '2',
  inactiveRemovals: '3',
  noticesSent: '4',
});
assert.ok(wySummary.includes(NVRA_EXEMPT_SENTENCE));
assert.ok(wySummary.includes(USC_20503_B));
assert.ok(wySummary.includes('In this state the NVRA does not apply.'));
pass('RA-summary');

assert.deepStrictEqual(parseRoute('#records-audit'), { name: 'records-audit', code: null });
assert.deepStrictEqual(parseRoute('#/records-audit'), { name: 'records-audit', code: null });
assert.deepStrictEqual(parseRoute('#/records-audit/oh'), { name: 'records-audit', code: 'OH' });
assert.deepStrictEqual(parseRoute('#records-audit/wy'), { name: 'records-audit', code: 'WY' });
pass('RA-route');

const sources = [
  'shared/src/policy/recordsRoutes.ts',
  'shared/src/policy/recordsAudit.ts',
  'app/src/pages/RecordsAudit.tsx',
];
for (const rel of sources) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  assert.ok(!/\bfetch\s*\(/.test(text), rel);
  assert.ok(!/XMLHttpRequest|sendBeacon|google-analytics|azure/i.test(text), rel);
}
const csp = fs.readFileSync(path.join(root, 'app/public/staticwebapp.config.json'), 'utf8');
assert.ok(csp.includes("connect-src 'none'"));
pass('RA-no-network');
