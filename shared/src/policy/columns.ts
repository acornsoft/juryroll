import { normHeader } from './blocked.ts';

// REQ-NOTE 67 / LOGIC-CHANGES L.1: "Result Date/Time" (NC State Board, Mecklenburg files) is
// undefined by any source. Optimus ruled 2026-10-09: never use it as the excusal date,
// automatically or by manual choice.
const NEVER_DECL = ['resultdatetime'];
const DECL = ['disqualificationdate', 'disqualdate', 'excusedate', 'dateofexcusal', 'responsedate', 'questionnairedate', 'qualificationdate', 'datedisqualified', 'decldate'];
const REG = ['registrationdate', 'regdate', 'registrdt', 'dateregistered', 'effectivedate', 'origregdate', 'registrationdt'];
const STATUS = ['status', 'voterstatus', 'statuscd', 'voterstatusdesc', 'registrationstatus'];
const STATUS_REASON = ['statusreason', 'reasoncd', 'voterstatusreasondesc', 'cancelreason', 'removalreason'];
const STATUS_DATE = ['statusdate', 'datestatuslastchanged', 'statuschangedate', 'canceldate'];

export type ExtraColumns = {
  declDate: number;
  regDate: number;
  status: number;
  statusReason: number;
  statusDate: number;
};

function guess(headers: string[], pats: string[]): number {
  const norms = headers.map(normHeader);
  for (let i = 0; i < norms.length; i++) {
    if (pats.includes(norms[i])) return i;
  }
  return -1;
}

export function guessExtra(kind: 'juror' | 'voter', headers: string[]): ExtraColumns {
  if (kind === 'juror') {
    return { declDate: guess(headers, DECL), regDate: -1, status: -1, statusReason: -1, statusDate: -1 };
  }
  return {
    declDate: -1,
    regDate: guess(headers, REG),
    status: guess(headers, STATUS),
    statusReason: guess(headers, STATUS_REASON),
    statusDate: guess(headers, STATUS_DATE),
  };
}

// Bundled samples mark every row with a note column (same list as core.js MARKER_HEADERS).
export const MARKER_HEADERS = ['note', 'datanote', 'samplenote', 'fictionalnote', 'fictionalsampledata', 'samplemarker'];

export function isNeverDecl(header: string | undefined): boolean {
  return NEVER_DECL.includes(normHeader(header ?? ''));
}

/** A declaration-date column index that is never a "Result Date/Time" column. */
export function safeDeclIndex(headers: string[], index: number): number {
  if (index < 0 || index >= headers.length) return -1;
  return isNeverDecl(headers[index]) ? -1 : index;
}

/** The juror extras with any "Result Date/Time" declaration mapping removed. Voter extras pass through. */
export function sanitizeExtra(kind: 'juror' | 'voter', headers: string[], extra: ExtraColumns): ExtraColumns {
  if (kind !== 'juror') return extra;
  const declDate = safeDeclIndex(headers, extra.declDate);
  return declDate === extra.declDate ? extra : { ...extra, declDate };
}

/** The "Result Date/Time" header when the juror file has it and no usable declaration-date column. */
export function resultDateOnly(headers: string[], extra: ExtraColumns): string | null {
  if (safeDeclIndex(headers, extra.declDate) >= 0) return null;
  const header = headers.find((item) => isNeverDecl(item));
  return header ?? null;
}

/** Headers no field and no date row uses, in file order. Blank headers and sample marker columns are left out. */
export function unusedColumns(headers: string[], map: Record<string, number>, extra: ExtraColumns, ignore: readonly string[] = []): string[] {
  const used = new Set<number>();
  for (const index of Object.values(map)) if (index >= 0) used.add(index);
  for (const index of [extra.declDate, extra.regDate, extra.status, extra.statusReason, extra.statusDate]) if (index >= 0) used.add(index);
  const skip = new Set(ignore);
  return headers.filter((header, index) => header.trim() && !used.has(index) && !skip.has(normHeader(header)));
}
