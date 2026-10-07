import { normHeader } from './blocked.ts';

const DECL = ['disqualificationdate', 'disqualdate', 'excusedate', 'responsedate', 'questionnairedate', 'qualificationdate', 'datedisqualified', 'decldate'];
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
