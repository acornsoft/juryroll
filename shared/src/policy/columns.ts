import { normHeader } from './blocked.ts';

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

/**
 * LOGIC-CHANGES L.2: a juror file is names-only when no column maps to a date of birth (or birth year)
 * or to an address (street or house number). A ZIP code alone cannot lift a pair above Weak.
 */
export function namesOnly(map: Record<string, number>): boolean {
  const has = (field: string) => (map[field] ?? -1) >= 0;
  return !has('dob') && !has('street') && !has('house_no');
}
