import core from '../core.js';
import { normHeader } from './blocked.ts';

export const DIFFERENT_COUNTY_PHRASE = 'same-name matches in a different county: excluded';
export const COUNTY_UNCHECKED_BANNER = 'The county could not be checked.';

const STATE_HEADERS = new Set([
  'state',
  'statecode',
  'stateabbr',
  'residencestate',
  'resstate',
  'voterstate',
  'regstate',
  'mailstate',
  'statepostal',
]);

const COUNTY_SUFFIX_RE = / (county|parish|borough|census area|municipality|city|municipio)$/i;

function isCountyHeader(normalized: string): boolean {
  if (normalized === 'county') return true;
  if (normalized.startsWith('county')) return true;
  return normalized.endsWith('county') && normalized !== 'country';
}

function headerIndex(headers: string[], kind: 'state' | 'county'): number {
  for (let index = 0; index < headers.length; index += 1) {
    const normalized = normHeader(headers[index] ?? '');
    if (kind === 'state' && STATE_HEADERS.has(normalized)) return index;
    if (kind === 'county' && isCountyHeader(normalized)) return index;
  }
  return -1;
}

function foldPlace(value: string): string {
  return value.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
}

function bareCounty(value: string): string {
  return foldPlace(value).replace(COUNTY_SUFFIX_RE, '');
}

export function sameState(cell: string, stateCode: string, stateName: string): boolean {
  const raw = cell.trim();
  if (raw === '') return true;
  const letters = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (letters === stateCode.toLowerCase()) return true;
  return letters === stateName.toLowerCase().replace(/[^a-z]/g, '');
}

export function sameCounty(cell: string, countyName: string, countyFips: string): boolean {
  const raw = cell.trim();
  if (raw === '') return true;
  if (bareCounty(raw) === bareCounty(countyName)) return true;
  const compact = raw.replace(/[\s-]/g, '');
  const fips = countyFips.replace(/\D/g, '');
  return /^\d+$/.test(compact) && fips !== '' && compact === fips;
}

function quoteCell(value: string, delim: string): string {
  if (value.includes('"') || value.includes(delim) || /[\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function toCsv(rows: string[][], delim: string): string {
  if (rows.length === 0) return '';
  return `${rows.map((row) => row.map((cell) => quoteCell(cell, delim)).join(delim)).join('\n')}\n`;
}

export type VoterPlaceSplit = {
  keptCsv: string;
  outCountyCsv: string;
  stateDropped: number;
  countyChecked: boolean;
};

export function splitVoterByPlace(input: {
  text: string;
  delim: string;
  hasHeader: boolean;
  headers: string[];
  stateCode: string;
  stateName: string;
  countyName: string;
  countyFips: string;
  checkCounty: boolean;
}): VoterPlaceSplit {
  const stateIndex = input.hasHeader ? headerIndex(input.headers, 'state') : -1;
  const countyIndex = input.hasHeader && input.checkCounty ? headerIndex(input.headers, 'county') : -1;
  const countyChecked = countyIndex >= 0;
  const kept: string[][] = [];
  const outCounty: string[][] = [];
  let stateDropped = 0;
  let first = true;
  core.iterCSV(input.text, input.delim, (row: string[]) => {
    if (first && input.hasHeader) {
      first = false;
      kept.push(row);
      outCounty.push(row);
      return;
    }
    first = false;
    if (row.every((cell) => cell.trim() === '')) return;
    if (stateIndex >= 0 && !sameState(row[stateIndex] ?? '', input.stateCode, input.stateName)) {
      stateDropped += 1;
      return;
    }
    if (countyChecked && !sameCounty(row[countyIndex] ?? '', input.countyName, input.countyFips)) {
      outCounty.push(row);
      return;
    }
    kept.push(row);
  });
  return {
    keptCsv: toCsv(kept, input.delim),
    outCountyCsv: toCsv(outCounty, input.delim),
    stateDropped,
    countyChecked,
  };
}
