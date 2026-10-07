import core from '../../../shared/src/core.js';
import { normHeader } from '../../../shared/src/policy/blocked.ts';

const HISTORY_HEADERS = new Set(['voted', 'votehistory', 'voterhistory', 'votinghistory', 'history']);

export const HISTORY_LABEL = 'Context only, not evidence.';

export function historyColumnIndex(headers: readonly string[]): number {
  return headers.findIndex((header) => HISTORY_HEADERS.has(normHeader(header)));
}

export function historyByVoterId(
  text: string,
  delim: string,
  hasHeader: boolean,
  headers: readonly string[],
  idColumn: number,
): Record<string, string> {
  const historyColumn = historyColumnIndex(headers);
  if (historyColumn < 0 || idColumn < 0) return {};
  const found: Record<string, string> = {};
  let first = true;
  core.iterCSV(text, delim, (row) => {
    if (first && hasHeader) {
      first = false;
      return;
    }
    first = false;
    const id = (row[idColumn] ?? '').trim();
    const value = (row[historyColumn] ?? '').trim();
    if (id && value) found[id] = value;
  });
  return found;
}
