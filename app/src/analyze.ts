import core from '../../shared/src/core.js';
import { guessExtra, type ExtraColumns } from '../../shared/src/policy/columns.ts';
import { screenColumns } from '../../shared/src/policy/blocked.ts';
import { dropColumns, readWorkbook, rowsToCsv } from '../../shared/src/ingest.ts';
import { sha256Hex } from '../../shared/src/policy/sha256.ts';

export type AnalyzedFile = {
  text: string;
  bytes: number;
  sha256: string;
  headers: string[];
  preview: string[][];
  rows: number;
  delim: string;
  map: Record<string, number>;
  extra: ExtraColumns;
  note: string | null;
  sheetNames: string[];
  sheetName: string | null;
  csvBySheet: Record<string, string> | null;
};

export type AnalyzeResult =
  | { ok: false; headers: string[]; sha256: string; bytes: number }
  | { ok: true; file: AnalyzedFile };

function split(text: string, hasHeader: boolean): { delim: string; headers: string[]; data: string[][] } {
  const delim = core.detectDelimiter(text);
  const all: string[][] = [];
  core.iterCSV(text, delim, (row) => { all.push(row.slice()); });
  if (hasHeader && all.length) {
    return { delim, headers: all[0].map((cell) => cell.trim()), data: all.slice(1) };
  }
  const width = all.reduce((max, row) => Math.max(max, row.length), 0);
  const headers = Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
  return { delim, headers, data: all };
}

export function analyzeText(text: string, hasHeader: boolean, kind: 'juror' | 'voter', bytes: number, sha256: string, sheets?: { names: string[]; csvBySheet: Record<string, string>; sheetName: string }): AnalyzeResult {
  const splitRows = split(text, hasHeader);
  const screened = screenColumns(splitRows.headers, splitRows.data);
  if (!screened.ok) return { ok: false, headers: screened.headers, sha256, bytes };
  let headers = splitRows.headers;
  let data = splitRows.data;
  let nextText = text;
  let delim = splitRows.delim;
  if (screened.dropColumns.length) {
    headers = headers.filter((_, index) => !screened.dropColumns.includes(index));
    data = dropColumns(data, screened.dropColumns);
    nextText = rowsToCsv(hasHeader ? [headers, ...data] : data);
    delim = ',';
  }
  const head = core.readHead(nextText, hasHeader, 5);
  const map = core.guessMapping(head.headers, kind === 'juror' ? core.JUROR_FIELDS : core.VOTER_FIELDS);
  return {
    ok: true,
    file: {
      text: nextText,
      bytes,
      sha256,
      headers: head.headers,
      preview: head.preview,
      rows: head.rows,
      delim,
      map,
      extra: guessExtra(kind, head.headers),
      note: screened.note,
      sheetNames: sheets?.names ?? [],
      sheetName: sheets?.sheetName ?? null,
      csvBySheet: sheets?.csvBySheet ?? null,
    },
  };
}

export async function readUpload(file: File): Promise<{ bytes: number; sha256: string; text: string | null; book: { names: string[]; csvBySheet: Record<string, string> } | null }> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const sha256 = await sha256Hex(bytes);
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const book = readWorkbook(bytes);
    const only = book.sheetNames.length === 1 ? book.sheetNames[0] : null;
    return {
      bytes: bytes.byteLength,
      sha256,
      text: only ? book.csvBySheet[only] : null,
      book: { names: book.sheetNames, csvBySheet: book.csvBySheet },
    };
  }
  return { bytes: bytes.byteLength, sha256, text: new TextDecoder('utf-8').decode(bytes), book: null };
}
