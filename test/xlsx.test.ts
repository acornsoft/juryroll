import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import core from '../shared/src/core.js';
import { readWorkbook } from '../shared/src/ingest.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function matchText(text: string, kind: 'juror' | 'voter') {
  const head = core.readHead(text, true);
  const fields = kind === 'juror' ? core.JUROR_FIELDS : core.VOTER_FIELDS;
  const map = core.guessMapping(head.headers, fields);
  const reasons = kind === 'juror' ? core.reasonValues(text, head.delim, true, map.reason) : [];
  const filter = kind === 'juror' ? Object.fromEntries(reasons.map((reason) => [reason.value, reason.auto])) : null;
  return core.buildRecords(text, head.delim, true, map, { order: 'MDY', reasonFilter: filter });
}

const jurorBook = readWorkbook(fs.readFileSync(path.join(root, 'shared/samples/sample_juror_disqualifications.xlsx')));
const voterBook = readWorkbook(fs.readFileSync(path.join(root, 'shared/samples/sample_voter_roll.xlsx')));
assert.deepStrictEqual(jurorBook.sheetNames, ['Jurors']);
assert.deepStrictEqual(voterBook.sheetNames, ['Voters']);
const jurorCsv = jurorBook.csvBySheet.Jurors;
const voterCsv = voterBook.csvBySheet.Voters;
assert.ok(voterCsv.includes('00000'), 'leading zeros in ZIP must survive Excel');
assert.ok(jurorCsv.includes('1901-03-14'), 'Excel date cells must become ISO dates');
assert.ok(voterCsv.includes(',1901,'), 'a year-only value stays a year');

const jurorRecords = matchText(jurorCsv, 'juror');
const voterRecords = matchText(voterCsv, 'voter');
const result = core.match(jurorRecords.records, voterRecords.records);
assert.deepStrictEqual(result.counts, { Strong: 3, Probable: 4, Weak: 2 });
console.log('XLSX core counts [Strong, Probable, Weak]:', [result.counts.Strong, result.counts.Probable, result.counts.Weak]);

const wb = XLSX.utils.book_new();
const first = XLSX.utils.aoa_to_sheet([['Only'], ['one']]);
const second = XLSX.utils.aoa_to_sheet([['Other'], ['two']]);
XLSX.utils.book_append_sheet(wb, first, 'Alpha');
XLSX.utils.book_append_sheet(wb, second, 'Beta');
const bytes = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array;
const many = readWorkbook(bytes);
assert.deepStrictEqual(many.sheetNames, ['Alpha', 'Beta']);
assert.ok(many.csvBySheet.Beta.includes('two'));
console.log('XLSX TEST PASSED');
