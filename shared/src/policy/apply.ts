// Policy after the unchanged matcher.
// A voter who registered AFTER the jury non-citizen declaration is not a lead
// at any tier. The row is excluded from every named list. Missing dates keep
// the tier, with a date-missing note. Earlier registration keeps the tier.

import core from '../core.js';
import { strict, type RulesFile } from './gates.ts';
import type { ExtraColumns } from './columns.ts';

export const SAVE_LINE = 'Official SAVE / naturalization check required';
export const SAVE_EXPORT_LINE = 'Official SAVE or naturalization check required before any action. A match is not proof. Do not publish. Do not contact the voter.';
export const AFTER_NOTE = 'Registered after the jury declaration: likely naturalized. Official naturalization check required.';
export const REMOVAL_NOTE = 'Before any action, confirm citizenship through official records. If this voter was removed or flagged, confirm that notice was sent and that the removal was correct. Reinstate if it was not.';
export const REINSTATE_NOTE = 'Voter was reinstated. Officials may already have confirmed eligibility.';
export const EXCLUDE_PHRASE = 'matches excluded: registered after declaration';

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
  excludedLine: string;
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

    if (!canCompareReg) {
      flags.push('DATES_NOT_COMPARABLE');
      notes.push('cannot compare');
    } else if (reg && decl && reg > decl) {
      excluded = true;
      flags.push('REGISTERED_AFTER_DECLARATION');
      notes.push(AFTER_NOTE);
    } else if (reg && decl && reg <= decl) {
      flags.push('REGISTERED_BEFORE_DECLARATION');
    } else {
      flags.push('DATES_NOT_COMPARABLE');
      notes.push('date missing');
    }

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
  const excludedCount = rows.filter((row) => row.excluded).length;

  return {
    rows,
    capApplied,
    capBadge,
    excludedCount,
    excludedLine: `${excludedCount} ${EXCLUDE_PHRASE}`,
    counts,
    flagCounts,
    symmetric: { noncitizenRemovals, withoutStrongMatch },
    wrongfulCount: flagCounts.POSSIBLE_WRONGFUL_REMOVAL,
  };
}

export function exportableRows(result: PolicyResult): { main: PolicyRow[]; removed: PolicyRow[] } {
  return {
    main: result.rows.filter((row) => row.section === 'main'),
    removed: result.rows.filter((row) => row.section === 'already-removed'),
  };
}
