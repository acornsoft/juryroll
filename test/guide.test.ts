import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GUIDE_SECTIONS, buildGuide, guideText } from '../app/src/lib/guide.ts';
import { uiGates, type RulesFile } from '../shared/src/policy/gates.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rulesDir = path.join(root, 'shared/rules');
const files = fs.readdirSync(rulesDir).filter((name) => /^[A-Z]{2}\.json$/.test(name)).sort();
assert.equal(files.length, 51);

const federal = { election: '2026-11-03', start: '2026-08-05', end: '2026-11-03' };

for (const file of files) {
  const raw = JSON.parse(fs.readFileSync(path.join(rulesDir, file), 'utf8')) as Record<string, unknown>;
  const gates = uiGates(raw as unknown as RulesFile);
  const sections = buildGuide(raw, gates, federal, 'Wake County');
  assert.deepEqual(sections.map((section) => section.title), [...GUIDE_SECTIONS], file);
  for (const section of sections) {
    assert.ok(section.lines.length > 0, `${file} ${section.title} is empty`);
    for (const line of section.lines) {
      assert.equal(typeof line, 'string', file);
      assert.ok(line.length > 0, `${file} ${section.title} has an empty line`);
    }
  }
  const text = guideText(sections);
  assert.ok(!text.includes('undefined'), `${file} rendered undefined`);
  assert.ok(text.includes('At a glance'), file);
  assert.ok(text.includes('Federal layer'), file);
  assert.ok(text.includes('State layer'), file);
  assert.ok(text.includes('Local layer'), file);
  assert.ok(text.includes('Walk through it'), file);
  assert.ok(text.includes('Wake County board of elections'), file);
  const basis = raw.gates && typeof raw.gates === 'object' ? (raw.gates as { basis?: unknown }).basis : null;
  if (typeof basis === 'string' && basis.length > 0) assert.ok(text.includes(basis), `${file} dropped gates.basis`);
}

const nyRaw = JSON.parse(fs.readFileSync(path.join(rulesDir, 'NY.json'), 'utf8')) as Record<string, unknown>;
const nyGlance = buildGuide(nyRaw, uiGates(nyRaw as unknown as RulesFile), federal, null).find((section) => section.title === 'At a glance');
assert.ok(nyGlance);
assert.ok(nyGlance.lines.includes('The jury list is not public in this state.'));
assert.ok(!nyGlance.lines.some((line) => /public:\s*(true|false|null)/.test(line)));
const wyRaw = JSON.parse(fs.readFileSync(path.join(rulesDir, 'WY.json'), 'utf8')) as Record<string, unknown>;
const wyGlance = buildGuide(wyRaw, uiGates(wyRaw as unknown as RulesFile), federal, null).find((section) => section.title === 'At a glance');
assert.ok(wyGlance);
assert.ok(wyGlance.lines.includes('Not confirmed, so treated as not public.'));

console.log(`guide tests passed (${files.length} states)`);
