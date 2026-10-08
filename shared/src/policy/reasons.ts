import core from '../core.js';
import { hasFormulaPrefix } from './formula.ts';

export const FORMULA_REASON_PHRASE = 'reason cells had a formula prefix: not counted';
export const UNRECOGNIZED_REASON_PHRASE = 'rows with a blank or unrecognized reason: not counted';

const ALL_DIGITS_RE = /^\d+$/;

export type ClassifiedReason = {
  raw: string;
  key: string;
  display: string;
  formula: boolean;
  autoNonCitizen: boolean;
  blankOrUnrecognized: boolean;
};

export type ReasonSummary = {
  value: string;
  display: string;
  count: number;
  auto: boolean;
  formula: boolean;
};

export type ReasonCounts = {
  formula: number;
  unrecognized: number;
  formulaLine: string;
  unrecognizedLine: string;
};

function stripLeadingZeros(value: string): string {
  const stripped = value.replace(/^0+/, '');
  return stripped.length === 0 ? '0' : stripped;
}

export function classifyReason(raw: string, stateCode: string): ClassifiedReason {
  const trimmed = raw.trim();
  if (hasFormulaPrefix(trimmed)) {
    return {
      raw: trimmed,
      key: trimmed,
      display: trimmed.slice(1).trim(),
      formula: true,
      autoNonCitizen: false,
      blankOrUnrecognized: false,
    };
  }
  if (trimmed === '') {
    return {
      raw: '',
      key: '',
      display: '',
      formula: false,
      autoNonCitizen: false,
      blankOrUnrecognized: stateCode === 'PA',
    };
  }
  const key = ALL_DIGITS_RE.test(trimmed) ? stripLeadingZeros(trimmed) : trimmed;
  if (stateCode === 'PA' && key === '47') {
    return { raw: trimmed, key, display: key, formula: false, autoNonCitizen: true, blankOrUnrecognized: false };
  }
  if (core.NONCITIZEN_RE.test(trimmed)) {
    return { raw: trimmed, key: trimmed, display: trimmed, formula: false, autoNonCitizen: true, blankOrUnrecognized: false };
  }
  if (stateCode === 'PA') {
    return { raw: trimmed, key, display: key, formula: false, autoNonCitizen: false, blankOrUnrecognized: true };
  }
  return { raw: trimmed, key: trimmed, display: trimmed, formula: false, autoNonCitizen: false, blankOrUnrecognized: false };
}

export function countReasonRows(values: readonly string[], stateCode: string): ReasonCounts {
  let formula = 0;
  let unrecognized = 0;
  for (const value of values) {
    const kind = classifyReason(value, stateCode);
    if (kind.formula) formula += 1;
    else if (kind.blankOrUnrecognized) unrecognized += 1;
  }
  return {
    formula,
    unrecognized,
    formulaLine: `${formula} ${FORMULA_REASON_PHRASE}`,
    unrecognizedLine: `${unrecognized} ${UNRECOGNIZED_REASON_PHRASE}`,
  };
}

export function summarizeReasons(
  text: string,
  delim: string,
  hasHeader: boolean,
  reasonIndex: number,
  stateCode: string,
): ReasonSummary[] {
  if (reasonIndex < 0) return [];
  const grouped = new Map<string, ReasonSummary>();
  let first = true;
  core.iterCSV(text, delim, (row: string[]) => {
    if (first && hasHeader) {
      first = false;
      return;
    }
    first = false;
    const kind = classifyReason(row[reasonIndex] ?? '', stateCode);
    const existing = grouped.get(kind.key);
    if (existing) {
      existing.count += 1;
      return;
    }
    grouped.set(kind.key, {
      value: kind.key,
      display: kind.display,
      count: 1,
      auto: kind.autoNonCitizen && !kind.formula,
      formula: kind.formula,
    });
  });
  return [...grouped.values()].sort((a, b) => a.value.localeCompare(b.value));
}

export function reasonValues(text: string, delim: string, hasHeader: boolean, reasonIndex: number): string[] {
  if (reasonIndex < 0) return [];
  const values: string[] = [];
  let first = true;
  core.iterCSV(text, delim, (row: string[]) => {
    if (first && hasHeader) {
      first = false;
      return;
    }
    first = false;
    values.push(row[reasonIndex] ?? '');
  });
  return values;
}
