import core from '../core.js';
import { normHeader } from './blocked.ts';

const STATUS_HEADERS = ['status', 'voterstatus', 'statuscd', 'voterstatusdesc', 'registrationstatus'];
const REASON_HEADERS = ['deletionreason', 'cancelreason', 'statusreason', 'reasoncd', 'voterstatusreasondesc', 'removalreason'];
const DELETION_HEADERS = ['deletionreason', 'deletiondate', 'cancelreason', 'canceldate'];
const CANCELLED_STATUS = new Set(['d', 'cancelled', 'canceled', 'deleted']);

export type CancelledCounts = {
  skipped: number;
  juryRelated: number;
  allCancelled: boolean;
  summary: string;
};

export type CancelledFilter = CancelledCounts & {
  csv: string;
};

export function cancelledSummary(skipped: number, juryRelated: number): string {
  return `${skipped} cancelled records skipped; ${juryRelated} with a jury-related reason`;
}

export const ALL_CANCELLED_LEAD = 'This file lists cancelled registrations. JuryRoll does not match it.';

export function allCancelledRefusal(skipped: number, juryRelated: number): string {
  return `${ALL_CANCELLED_LEAD} ${cancelledSummary(skipped, juryRelated)}`;
}

export function noCancelledRows(): CancelledCounts {
  return { skipped: 0, juryRelated: 0, allCancelled: false, summary: cancelledSummary(0, 0) };
}

function indexes(headers: string[], names: readonly string[], alsoIncludes: string | null): number[] {
  const found: number[] = [];
  headers.forEach((header, index) => {
    const norm = normHeader(header);
    if (names.includes(norm) || (alsoIncludes !== null && norm.includes(alsoIncludes))) found.push(index);
  });
  return found;
}

function quoteCell(value: string, delim: string): string {
  if (value.includes('"') || value.includes(delim) || /[\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function juryRelated(value: string): boolean {
  const text = value.trim();
  if (text.length === 0) return false;
  if (text.toLowerCase() === 'jd') return true;
  return /jury/i.test(text);
}

/** Drop cancelled voter rows before matching. The returned CSV has no dropped field. */
export function filterCancelledVoters(csv: string, hasHeader: boolean): CancelledFilter {
  const delim = core.detectDelimiter(csv);
  const parsed: string[][] = [];
  core.iterCSV(csv, delim, (row: string[]) => {
    parsed.push(row);
  });
  const header = hasHeader && parsed.length > 0 ? parsed[0] : null;
  const data = header ? parsed.slice(1) : parsed;
  const statusAt = header ? indexes(header, STATUS_HEADERS, null) : [];
  const reasonAt = header ? indexes(header, REASON_HEADERS, null) : [];
  const deletionAt = header ? indexes(header, DELETION_HEADERS, 'deletion') : [];
  const kept: string[][] = [];
  if (header) kept.push(header);
  let skipped = 0;
  let juryRelatedCount = 0;
  let dataRows = 0;
  for (const row of data) {
    if (row.every((cell) => cell.trim() === '')) continue;
    dataRows += 1;
    const cancelledStatus = statusAt.some((index) => CANCELLED_STATUS.has((row[index] ?? '').trim().toLowerCase()));
    const deletionFilled = deletionAt.some((index) => (row[index] ?? '').trim() !== '');
    if (!cancelledStatus && !deletionFilled) {
      kept.push(row);
      continue;
    }
    skipped += 1;
    if (reasonAt.some((index) => juryRelated(row[index] ?? ''))) juryRelatedCount += 1;
  }
  const body = kept.map((row) => row.map((cell) => quoteCell(cell, delim)).join(delim)).join('\n');
  const keptData = header ? kept.length - 1 : kept.length;
  return {
    csv: body.length > 0 ? `${body}\n` : '',
    skipped,
    juryRelated: juryRelatedCount,
    allCancelled: dataRows > 0 && keptData === 0,
    summary: cancelledSummary(skipped, juryRelatedCount),
  };
}
