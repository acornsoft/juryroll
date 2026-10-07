import assert from 'node:assert';
import { prepareFloridaVoter } from '../../shared/src/policy/stateCopy/FL.ts';

const cells = Array.from({ length: 29 }, () => '');
cells[2] = 'Hidden';
cells[4] = 'Pat';
cells[6] = 'Y';
const open = Array.from({ length: 29 }, () => '');
open[2] = 'Shown';
open[4] = 'Pat';
open[6] = 'N';
open[21] = '01/02/1980';
const prepared = prepareFloridaVoter(`${cells.join('\t')}\n${open.join('\t')}\n`, false);
assert.ok(prepared);
assert.strictEqual(prepared.protectedCount, 1);
assert.ok(prepared.csv.includes('Shown'));
assert.ok(!prepared.csv.includes('Hidden'));
console.log('FL layout PASS');
