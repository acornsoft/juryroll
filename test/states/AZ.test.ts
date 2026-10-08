import assert from 'node:assert';
import fs from 'node:fs';
import { auditLetter } from '../../shared/src/policy/letter.ts';
import { refusalBlock } from '../../shared/src/policy/refusal.ts';
import { stateCopy } from '../../shared/src/policy/stateCopy/index.ts';
import type { RulesFile } from '../../shared/src/policy/gates.ts';

const rules = JSON.parse(fs.readFileSync(new URL('../../shared/rules/AZ.json', import.meta.url), 'utf8')) as RulesFile;
const copy = stateCopy('AZ');
const letter = auditLetter(rules, [], { periodFrom: '', periodTo: '', juryCount: '1', jurySource: 'office', removals: '1', removalSource: 'office', county: 'Sample' });
for (const line of copy.letterLines) assert.ok(letter.includes(line), line);
if (copy.juryCountLabel) assert.ok(letter.includes(copy.juryCountLabel));
if (copy.runningQuestion) assert.ok(letter.includes(copy.runningQuestion));
if (copy.pipelineLead) assert.ok(letter.includes(copy.pipelineLead.trim()));
const block = refusalBlock(rules, '2026-10-07');
for (const line of copy.refusalExtras) assert.ok(block.extras.includes(line));
for (const banner of copy.banners) assert.ok(block.banners.includes(banner.text));
if (copy.csvGuideHref) assert.strictEqual(copy.csvGuideHref, '#/state/tx/converting-the-texas-voter-file-to-csv');
console.log('AZ copy PASS');
