import core from '../core.js';
import { guessExtra, type ExtraColumns } from './columns.ts';
import { applyPolicy, UI_DATE_STRICTNESS, type DateStrictness, type PolicyResult } from './apply.ts';
import type { RulesFile } from './gates.ts';
import type { MatchResult } from '../core.js';

export type LoadedTable = {
  text: string;
  delim: string;
  hasHeader: boolean;
  headers: string[];
  map: Record<string, number>;
  extra: ExtraColumns;
  order: string;
  reasonFilter: Record<string, boolean> | null;
};

export function runMatch(
  juror: LoadedTable,
  voter: LoadedTable,
  rules: RulesFile,
  options?: { dateStrictness?: DateStrictness },
): { coreResult: MatchResult; policy: PolicyResult } {
  const builtJ = core.buildRecords(juror.text, juror.delim, juror.hasHeader, juror.map, {
    order: juror.order,
    reasonFilter: juror.reasonFilter,
  });
  const builtV = core.buildRecords(voter.text, voter.delim, voter.hasHeader, voter.map, { order: voter.order });
  const coreResult = core.match(builtJ.records, builtV.records);
  const policy = applyPolicy({
    pairs: coreResult.pairs,
    jurorText: juror.text,
    jurorDelim: juror.delim,
    jurorHeader: juror.hasHeader,
    jurorIdCol: juror.map.juror_id ?? -1,
    jurorDobCol: juror.map.dob ?? -1,
    voterText: voter.text,
    voterDelim: voter.delim,
    voterHeader: voter.hasHeader,
    voterIdCol: voter.map.voter_id ?? -1,
    extraJuror: juror.extra,
    extraVoter: voter.extra,
    jurorOrder: juror.order,
    voterOrder: voter.order,
    rules,
    dateStrictness: options?.dateStrictness ?? UI_DATE_STRICTNESS,
  });
  return { coreResult, policy };
}

export function extrasFor(kind: 'juror' | 'voter', headers: string[]): ExtraColumns {
  return guessExtra(kind, headers);
}
