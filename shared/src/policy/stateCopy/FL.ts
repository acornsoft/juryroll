import core from '../../core.js';
import { EMPTY_STATE_COPY, type PreparedVoter, type StateCopy } from './types.ts';

const FL_WIDTH = 29;
const FL_LAST = 2;
const FL_FIRST = 4;
const FL_MIDDLE = 5;
const FL_EXEMPT = 6;
const FL_DOB = 21;
const FL_REG = 22;
const FL_STATUS = 28;

function csvCell(value: string): string {
  const text = value.trim();
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function prepareFloridaVoter(text: string, hasHeader: boolean): PreparedVoter | null {
  if (!text.includes('\t')) return null;
  const rows: string[][] = [];
  core.iterCSV(text, '\t', (row: string[]) => { rows.push(row.slice()); });
  if (rows.length === 0) return null;
  const data = hasHeader ? rows.slice(1) : rows;
  if (!data.some((row) => row.length >= FL_WIDTH)) return null;
  let protectedCount = 0;
  const lines = ['Last,First,Middle,DOB,Registration Date,Status'];
  data.forEach((row) => {
    if (row.length < FL_WIDTH) return;
    if ((row[FL_EXEMPT] ?? '').trim().toUpperCase() === 'Y') {
      protectedCount += 1;
      return;
    }
    lines.push([
      row[FL_LAST] ?? '',
      row[FL_FIRST] ?? '',
      row[FL_MIDDLE] ?? '',
      row[FL_DOB] ?? '',
      row[FL_REG] ?? '',
      row[FL_STATUS] ?? '',
    ].map(csvCell).join(','));
  });
  return { csv: `${lines.join('\n')}\n`, protectedCount };
}

export const copy: StateCopy = {
  ...EMPTY_STATE_COPY,
  banners: [{
    text: 'Dated note: Fla. Stat. 98.093(9) and the 98.075(6)(a) step take effect January 1, 2027. They are not current law.',
    hideOn: '2027-01-01',
  }],
  prepareVoter: prepareFloridaVoter,
};
