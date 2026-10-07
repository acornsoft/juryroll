import assert from 'node:assert';
import fs from 'node:fs';
import { refusalBlock } from '../../shared/src/policy/refusal.ts';
import { auditLetter } from '../../shared/src/policy/letter.ts';
import type { RulesFile } from '../../shared/src/policy/gates.ts';

const rules = JSON.parse(fs.readFileSync(new URL('../../shared/rules/AR.json', import.meta.url), 'utf8')) as RulesFile;
const sentence = 'Disclosure of juror information is restricted by law (Ark. Code 16-32-111).';
assert.strictEqual(rules.jury_list.use_restriction, sentence);
const block = refusalBlock(rules, '2026-10-07');
assert.strictEqual(block.useRestriction, sentence);
const shown = [block.carryOver, block.lawLine, block.useRestriction, ...(block.extras)].join('\n');
assert.ok(!shown.includes('is an offense'));
const letter = auditLetter(rules, [], { periodFrom: '', periodTo: '', juryCount: '', jurySource: '', removals: '', removalSource: '', county: 'Pulaski' });
assert.ok(letter.includes('The Arkansas FOIA covers Arkansas citizens only'));
assert.ok(!letter.includes('is an offense'));
console.log('AR refusal PASS');
