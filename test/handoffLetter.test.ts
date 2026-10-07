import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRoute } from '../app/src/route.ts';
import { uiGates, type RulesFile } from '../shared/src/policy/gates.ts';
import { juryHandoffLetter, type HandoffInput } from '../shared/src/policy/handoffLetter.ts';
import { DC_FRAMING, handoffAvailable, handoffKind } from '../shared/src/policy/handoffRoutes.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadRules(code: string): RulesFile {
  return JSON.parse(fs.readFileSync(path.join(root, 'shared/rules', `${code}.json`), 'utf8')) as RulesFile;
}

type County = { name: string; fips: string };
const counties = JSON.parse(fs.readFileSync(path.join(root, 'shared/src/counties.json'), 'utf8')) as Record<string, County[]>;

function countyNamed(code: string, name: string): County {
  const county = counties[code]?.find((item) => item.name === name);
  assert.ok(county, `${name} in ${code}`);
  return county;
}

function blank(over: Partial<HandoffInput> = {}): HandoffInput {
  return {
    county: '',
    fips: '',
    periodFrom: '2025-01-01',
    periodTo: '2025-12-31',
    forwarded: '',
    noticesReceived: '',
    actionsTaken: '',
    juryCount: '',
    jurySource: '',
    removals: '',
    removalSource: '',
    reportsReceived: '',
    recordsReceived: '',
    ...over,
  };
}

function pass(id: string) {
  console.log(`${id} PASS`);
}

assert.strictEqual(DC_FRAMING, 'In DC, non-citizens may vote in local elections, so the non-citizen framing doesn\'t fit.');
pass('JH-wording');

assert.strictEqual(handoffKind('GA'), 'pipeline');
assert.strictEqual(handoffKind('TX'), 'pipeline');
assert.strictEqual(handoffKind('OH'), 'audit-counts');
assert.strictEqual(handoffKind('NY'), 'audit-counts');
assert.strictEqual(handoffKind('VA'), 'audit-counts');
assert.strictEqual(handoffKind('ID'), 'audit-counts');
assert.strictEqual(handoffKind('IL'), 'disqualified-reports');
assert.strictEqual(handoffKind('CT'), 'counts-only');
assert.strictEqual(handoffKind('DC'), 'counts-only');
assert.strictEqual(handoffAvailable(uiGates(loadRules('GA')).allow_jury_list), true);
assert.strictEqual(handoffAvailable(uiGates(loadRules('PA')).allow_jury_list), false);
assert.strictEqual(handoffAvailable(uiGates(loadRules('NC')).allow_jury_list), false);
assert.strictEqual(handoffAvailable(uiGates(loadRules('DC')).allow_jury_list), true);
pass('JH-routes');

const fulton = countyNamed('GA', 'Fulton County');
const ga = juryHandoffLetter(loadRules('GA'), blank({
  county: fulton.name,
  fips: fulton.fips,
  forwarded: '3',
  noticesReceived: '8',
  actionsTaken: '2',
}));
const gaTo = ga.split('\n').find((line) => line.startsWith('To: '));
assert.ok(gaTo);
assert.ok(gaTo.includes('Fulton County board of elections'));
assert.ok(gaTo.includes('Georgia Secretary of State - Elections Division'));
assert.ok(!/attorney general/i.test(gaTo));
assert.ok(!/jury clerk/i.test(gaTo));
assert.ok(ga.includes('Are non-citizen juror excusals forwarded to election officials? How many?'));
assert.ok(ga.includes('Please provide the counts of notices received and the resulting actions.'));
assert.ok(ga.includes('21-2-231'));
assert.ok(ga.includes('Non-citizen juror excusals forwarded: 3'));
assert.ok(ga.includes('Notices received: 8'));
assert.ok(ga.includes('Resulting actions: 2'));
assert.ok(ga.includes('This letter has counts only. It has no names.'));
assert.ok(!/challenger|poll-watch/i.test(ga));
pass('JH-pipeline-georgia');

const ohioCounty = counties.OH[0];
const oh = juryHandoffLetter(loadRules('OH'), blank({
  county: ohioCounty.name,
  fips: ohioCounty.fips,
  juryCount: '4',
  jurySource: 'Fictional office summary',
  removals: '1',
  removalSource: 'Fictional county report',
}));
assert.ok(oh.includes('Are non-citizen juror excusals forwarded to election officials? How many?'));
assert.ok(oh.includes('Jurors disqualified or excused for non-citizenship: 4'));
assert.ok(oh.includes('Voter registrations cancelled for non-citizenship: 1'));
assert.ok(!oh.includes('Please provide the counts of notices received and the resulting actions.'));
assert.ok(!oh.split('\n').find((line) => line.startsWith('To: '))!.toLowerCase().includes('attorney general'));
pass('JH-audit-counts');

const ilCounty = counties.IL[0];
const il = juryHandoffLetter(loadRules('IL'), blank({
  county: ilCounty.name,
  fips: ilCounty.fips,
  reportsReceived: '6',
  actionsTaken: '2',
}));
assert.ok(il.includes('This letter asks only about disqualified-juror reports.'));
assert.ok(il.includes('Disqualified-juror reports received: 6'));
assert.ok(!il.includes('Are non-citizen juror excusals forwarded to election officials? How many?'));
assert.ok(!il.includes('Please provide the counts of notices received and the resulting actions.'));
pass('JH-illinois');

const ctCounty = counties.CT[0];
const ct = juryHandoffLetter(loadRules('CT'), blank({
  county: ctCounty.name,
  fips: ctCounty.fips,
  juryCount: '4',
  removals: '1',
}));
assert.ok(ct.includes('This letter stays counts only.'));
assert.ok(ct.includes(`Is this process running in ${ctCounty.name}? How many records were received, reviewed, confirmed, and removed in the period?`));
assert.ok(ct.includes('Jurors disqualified or excused for non-citizenship: 4'));
assert.ok(!ct.includes('Are non-citizen juror excusals forwarded to election officials? How many?'));
assert.ok(!ct.includes(DC_FRAMING));
assert.ok(!ct.split('\n').find((line) => line.startsWith('To: '))!.toLowerCase().includes('attorney general'));
pass('JH-connecticut');

const dcCounty = counties.DC[0];
const dc = juryHandoffLetter(loadRules('DC'), blank({
  county: dcCounty.name,
  fips: dcCounty.fips,
  recordsReceived: '7',
  actionsTaken: '2',
}));
assert.ok(dc.includes(DC_FRAMING));
assert.ok(dc.includes('This letter stays counts only.'));
assert.ok(dc.includes('Records the election office received: 7'));
assert.ok(dc.includes('Actions taken: 2'));
assert.ok(!dc.includes('Are non-citizen juror excusals forwarded to election officials? How many?'));
assert.ok(!dc.includes('Jurors disqualified or excused for non-citizenship'));
assert.ok(!dc.split('\n').find((line) => line.startsWith('To: '))!.includes('Attorney General'));
assert.ok(!/jury clerk/i.test(dc.split('\n')[1]));
pass('JH-dc');

assert.deepStrictEqual(parseRoute('#jury-handoff-letter'), { name: 'jury-handoff', code: null });
assert.deepStrictEqual(parseRoute('#/jury-handoff-letter'), { name: 'jury-handoff', code: null });
assert.deepStrictEqual(parseRoute('#/jury-handoff-letter/ga'), { name: 'jury-handoff', code: 'GA' });
pass('JH-route');

for (const rel of [
  'shared/src/policy/handoffRoutes.ts',
  'shared/src/policy/handoffLetter.ts',
  'app/src/pages/JuryHandoff.tsx',
]) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  assert.ok(!/\bfetch\s*\(/.test(text), rel);
  assert.ok(!/XMLHttpRequest|sendBeacon|google-analytics|azure/i.test(text), rel);
}
const csp = fs.readFileSync(path.join(root, 'app/public/staticwebapp.config.json'), 'utf8');
assert.ok(csp.includes("connect-src 'none'"));
pass('JH-no-network');
