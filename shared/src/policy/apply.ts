// Policy after the unchanged matcher.
// Strict (the UI default): applyDateRule ignores the state code. A later
// registration is "N matches excluded: registered after declaration". A missing,
// unparseable, or equal registration date, or a missing declaration date, is
// "N matches cannot compare: no registration date". An earlier registration
// keeps its tier. Every pair is in exactly one of those three places.
// Lenient (tests only): only a later registration is excluded. Equal dates
// keep the tier. Missing dates keep the tier with a note.

import core from '../core.js';
import { strict, type RulesFile } from './gates.ts';
import type { ExtraColumns } from './columns.ts';

export const SAVE_LINE = 'Official SAVE / naturalization check required';
export const SAVE_EXPORT_LINE = 'Official SAVE or naturalization check required before any action. A match is not proof. Do not publish. Do not contact the voter.';
export const AFTER_NOTE = 'Registered after the jury declaration: likely naturalized. Official naturalization check required.';
export const REMOVAL_NOTE = 'Before any action, confirm citizenship through official records. If this voter was removed or flagged, confirm that notice was sent and that the removal was correct. Reinstate if it was not.';
export const REINSTATE_NOTE = 'Voter was reinstated. Officials may already have confirmed eligibility.';
export const EXCLUDE_PHRASE = 'matches excluded: registered after declaration';
export const CANNOT_COMPARE_PHRASE = 'matches cannot compare: no registration date';

export type DateStrictness = 'strict' | 'lenient';
export const UI_DATE_STRICTNESS: DateStrictness = 'strict';

const REMOVED_RE = /remov|cancel|purg|denied|deceased/i;
const REINSTATED_RE = /reinstat|restor|re-?activ/i;
const INACTIVE_RE = /inactive|suspense/i;
const NONCITIZEN_REASON_RE = /non-?citizen|citizenship/i;

export type Flag =
  | 'REGISTERED_AFTER_DECLARATION'
  | 'REGISTERED_BEFORE_DECLARATION'
  | 'DATES_NOT_COMPARABLE'
  | 'REMOVED'
  | 'REINSTATED'
  | 'INACTIVE'
  | 'POSSIBLE_WRONGFUL_REMOVAL';

export function flagLabel(flag: Flag): string {
  switch (flag) {
    case 'REGISTERED_AFTER_DECLARATION':
      return 'Registered after the declaration';
    case 'REGISTERED_BEFORE_DECLARATION':
      return 'Registered before the declaration';
    case 'DATES_NOT_COMPARABLE':
      return 'Dates cannot be compared';
    case 'REMOVED':
      return 'Removed';
    case 'REINSTATED':
      return 'Reinstated';
    case 'INACTIVE':
      return 'Inactive';
    case 'POSSIBLE_WRONGFUL_REMOVAL':
      return 'Possible wrongful removal';
    default: {
      const neverFlag: never = flag;
      return neverFlag;
    }
  }
}

export type Tier = 'Strong' | 'Probable' | 'Weak';

export type PolicyRow = {
  tier: Tier;
  coreTier: Tier;
  flags: Flag[];
  notes: string[];
  excluded: boolean;
  voterId: string;
  voterName: string;
  voterDob: string;
  voterAddress: string;
  voterStatus: string;
  regDate: string;
  declDate: string;
  jurorId: string;
  reason: string;
  matched: string;
  jurorName: string;
  jurorDob: string;
  section: 'main' | 'already-removed' | 'weak' | 'excluded';
};

type CorePair = {
  tier: Tier;
  voterId: string;
  voterName: string;
  voterDob: string;
  voterAddress: string;
  jurorId: string;
  reason: string;
  matched: string;
  jurorName: string;
  jurorDob: string;
};

export type PolicyResult = {
  rows: PolicyRow[];
  capApplied: boolean;
  capBadge: string | null;
  excludedCount: number;
  excludedAfterCount: number;
  cannotCompareCount: number;
  excludedLine: string;
  cannotCompareLine: string;
  counts: Record<Tier, number>;
  flagCounts: Record<Flag, number>;
  symmetric: { noncitizenRemovals: number; withoutStrongMatch: number };
  wrongfulCount: number;
};

function cell(row: string[], index: number): string {
  if (index < 0 || row[index] === undefined) return '';
  return String(row[index]).trim();
}

function dataRows(text: string, delim: string, hasHeader: boolean): string[][] {
  const rows: string[][] = [];
  let first = true;
  core.iterCSV(text, delim, (row: string[]) => {
    if (first && hasHeader) {
      first = false;
      return;
    }
    first = false;
    rows.push(row);
  });
  return rows;
}

function fullDate(raw: string, order: string): string | null {
  if (!raw) return null;
  const parsed = core.parseDOB(raw, order);
  return parsed && parsed.full ? parsed.full : null;
}

function emptyFlags(): Record<Flag, number> {
  return {
    REGISTERED_AFTER_DECLARATION: 0,
    REGISTERED_BEFORE_DECLARATION: 0,
    DATES_NOT_COMPARABLE: 0,
    REMOVED: 0,
    REINSTATED: 0,
    INACTIVE: 0,
    POSSIBLE_WRONGFUL_REMOVAL: 0,
  };
}

export function applyPolicy(input: {
  pairs: CorePair[];
  jurorText: string;
  jurorDelim: string;
  jurorHeader: boolean;
  jurorIdCol: number;
  jurorDobCol: number;
  voterText: string;
  voterDelim: string;
  voterHeader: boolean;
  voterIdCol: number;
  extraJuror: ExtraColumns;
  extraVoter: ExtraColumns;
  jurorOrder: string;
  voterOrder: string;
  rules: RulesFile;
  dateStrictness?: DateStrictness;
}): PolicyResult {
  const jurorRows = dataRows(input.jurorText, input.jurorDelim, input.jurorHeader);
  const voterRows = dataRows(input.voterText, input.voterDelim, input.voterHeader);

  const declById = new Map<string, string>();
  let fullDob = 0;
  jurorRows.forEach((row, index) => {
    const id = cell(row, input.jurorIdCol) || `row ${index + 1}`;
    declById.set(id, cell(row, input.extraJuror.declDate));
    if (fullDate(cell(row, input.jurorDobCol), input.jurorOrder)) fullDob += 1;
  });

  const voterById = new Map<string, { reg: string; status: string; statusReason: string }>();
  voterRows.forEach((row, index) => {
    const id = cell(row, input.voterIdCol) || `row ${index + 1}`;
    voterById.set(id, {
      reg: cell(row, input.extraVoter.regDate),
      status: cell(row, input.extraVoter.status),
      statusReason: cell(row, input.extraVoter.statusReason),
    });
  });

  const dobRatio = jurorRows.length ? fullDob / jurorRows.length : 0;
  const dobPublic = strict(input.rules.voter_file.dob_in_public_file, false);
  const canCompareReg = strict(input.rules.voter_file.registration_date_in_public_file, false) === true;
  const dateStrictness = input.dateStrictness ?? UI_DATE_STRICTNESS;
  const capApplied = dobPublic === false || dobRatio < 0.5;
  const capBadge = !capApplied
    ? null
    : dobPublic === false
      ? `Full date of birth is not in the public files for ${input.rules.name}. Highest tier: Probable.`
      : 'Fewer than half of the juror rows have a full date of birth. Highest tier: Probable.';

  const rows: PolicyRow[] = input.pairs.map((pair) => {
    const declRaw = declById.get(pair.jurorId) ?? '';
    const voter = voterById.get(pair.voterId);
    const regRaw = voter?.reg ?? '';
    const status = voter?.status ?? '';
    const statusReason = voter?.statusReason ?? '';
    const decl = fullDate(declRaw, input.jurorOrder);
    const reg = fullDate(regRaw, input.voterOrder);
    const flags: Flag[] = [];
    const notes: string[] = [SAVE_LINE];
    let excluded = false;

    const dated = classifyDates(dateStrictness, canCompareReg, reg, decl);
    excluded = dated.excluded;
    flags.push(dated.flag);
    if (dated.note) notes.push(dated.note);

    if (REMOVED_RE.test(status)) flags.push('REMOVED');
    if (REINSTATED_RE.test(status) || REINSTATED_RE.test(statusReason)) {
      flags.push('REINSTATED');
      notes.push(REINSTATE_NOTE);
    }
    if (INACTIVE_RE.test(status)) {
      flags.push('INACTIVE');
      notes.push('Inactive or suspense status. This is a note only.');
    }

    let tier: Tier = pair.tier;
    if (!excluded && capApplied && tier === 'Strong') tier = 'Probable';

    const removed = flags.includes('REMOVED');
    const after = flags.includes('REGISTERED_AFTER_DECLARATION');
    const inactive = flags.includes('INACTIVE');
    if ((removed && (after || tier !== 'Strong')) || (inactive && after)) {
      flags.push('POSSIBLE_WRONGFUL_REMOVAL');
    }
    if (flags.some((flag) => flag === 'REMOVED' || flag === 'REINSTATED' || flag === 'INACTIVE' || flag === 'POSSIBLE_WRONGFUL_REMOVAL')) {
      notes.push(REMOVAL_NOTE);
    }

    let section: PolicyRow['section'] = 'main';
    if (excluded) section = 'excluded';
    else if (tier === 'Weak') section = 'weak';
    else if (removed) section = 'already-removed';

    return {
      tier,
      coreTier: pair.tier,
      flags,
      notes,
      excluded,
      voterId: pair.voterId,
      voterName: pair.voterName,
      voterDob: pair.voterDob,
      voterAddress: pair.voterAddress,
      voterStatus: status,
      regDate: regRaw,
      declDate: declRaw,
      jurorId: pair.jurorId,
      reason: pair.reason,
      matched: pair.matched,
      jurorName: pair.jurorName,
      jurorDob: pair.jurorDob,
      section,
    };
  });

  const strongIds = new Set(
    rows.filter((row) => !row.excluded && row.coreTier === 'Strong').map((row) => row.voterId),
  );
  let noncitizenRemovals = 0;
  let withoutStrongMatch = 0;
  voterRows.forEach((row, index) => {
    const reason = cell(row, input.extraVoter.statusReason);
    if (!NONCITIZEN_REASON_RE.test(reason)) return;
    noncitizenRemovals += 1;
    const id = cell(row, input.voterIdCol) || `row ${index + 1}`;
    if (!strongIds.has(id)) withoutStrongMatch += 1;
  });

  const counts: Record<Tier, number> = { Strong: 0, Probable: 0, Weak: 0 };
  const flagCounts = emptyFlags();
  rows.forEach((row) => {
    if (!row.excluded) counts[row.tier] += 1;
    row.flags.forEach((flag) => { flagCounts[flag] += 1; });
  });
  const excludedAfterCount = rows.filter((row) => row.excluded && row.flags.includes('REGISTERED_AFTER_DECLARATION')).length;
  const cannotCompareCount = rows.filter((row) => row.excluded && row.flags.includes('DATES_NOT_COMPARABLE')).length;
  const excludedCount = rows.filter((row) => row.excluded).length;
  const leadCount = counts.Strong + counts.Probable + counts.Weak;
  if (leadCount + excludedAfterCount + cannotCompareCount !== rows.length || excludedCount !== excludedAfterCount + cannotCompareCount) {
    throw new Error('Date buckets do not add up to the matched pairs');
  }

  return {
    rows,
    capApplied,
    capBadge,
    excludedCount,
    excludedAfterCount,
    cannotCompareCount,
    excludedLine: `${excludedAfterCount} ${EXCLUDE_PHRASE}`,
    cannotCompareLine: `${cannotCompareCount} ${CANNOT_COMPARE_PHRASE}`,
    counts,
    flagCounts,
    symmetric: { noncitizenRemovals, withoutStrongMatch },
    wrongfulCount: flagCounts.POSSIBLE_WRONGFUL_REMOVAL,
  };
}

export type DateRulePair = { reg: string | null; decl: string | null };

export function applyDateRule<T extends DateRulePair>(pairs: readonly T[]): {
  leads: T[];
  registeredAfter: T[];
  cannotCompare: T[];
} {
  const leads: T[] = [];
  const registeredAfter: T[] = [];
  const cannotCompare: T[] = [];
  pairs.forEach((pair) => {
    const bucket = dateBucket(pair.reg, pair.decl);
    switch (bucket) {
      case 'lead':
        leads.push(pair);
        break;
      case 'registeredAfter':
        registeredAfter.push(pair);
        break;
      case 'cannotCompare':
        cannotCompare.push(pair);
        break;
      default: {
        const neverBucket: never = bucket;
        throw new Error(neverBucket);
      }
    }
  });
  return { leads, registeredAfter, cannotCompare };
}

function dateBucket(reg: string | null, decl: string | null): 'lead' | 'registeredAfter' | 'cannotCompare' {
  if (!reg || !decl || reg === decl) return 'cannotCompare';
  if (reg > decl) return 'registeredAfter';
  return 'lead';
}

function classifyDates(
  strictness: DateStrictness,
  canCompareReg: boolean,
  reg: string | null,
  decl: string | null,
): { excluded: boolean; flag: Flag; note: string | null } {
  switch (strictness) {
    case 'strict': {
      const ruled = applyDateRule([{ reg, decl }]);
      if (ruled.registeredAfter.length === 1) return { excluded: true, flag: 'REGISTERED_AFTER_DECLARATION', note: AFTER_NOTE };
      if (ruled.cannotCompare.length === 1) return { excluded: true, flag: 'DATES_NOT_COMPARABLE', note: 'no registration date' };
      return { excluded: false, flag: 'REGISTERED_BEFORE_DECLARATION', note: null };
    }
    case 'lenient':
      if (!canCompareReg) return { excluded: false, flag: 'DATES_NOT_COMPARABLE', note: 'cannot compare' };
      if (reg && decl && reg > decl) return { excluded: true, flag: 'REGISTERED_AFTER_DECLARATION', note: AFTER_NOTE };
      if (reg && decl) return { excluded: false, flag: 'REGISTERED_BEFORE_DECLARATION', note: null };
      return { excluded: false, flag: 'DATES_NOT_COMPARABLE', note: 'date missing' };
    default: {
      const neverSetting: never = strictness;
      return neverSetting;
    }
  }
}

export function exportableRows(result: PolicyResult): { main: PolicyRow[]; removed: PolicyRow[] } {
  return {
    main: result.rows.filter((row) => row.section === 'main'),
    removed: result.rows.filter((row) => row.section === 'already-removed'),
  };
}
