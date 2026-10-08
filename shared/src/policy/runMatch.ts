import core from '../core.js';
import { guessExtra, type ExtraColumns } from './columns.ts';
import { applyPolicy, UI_DATE_STRICTNESS, type DateStrictness, type PolicyResult } from './apply.ts';
import { allCancelledRefusal, filterCancelledVoters, type CancelledCounts } from './cancelled.ts';
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

function emptyMatch(): MatchResult {
  return {
    pairs: [],
    counts: { Strong: 0, Probable: 0, Weak: 0 },
    jurorsByBest: { Strong: 0, Probable: 0, Weak: 0 },
    jurorsMatched: 0,
  };
}

export function runMatch(
  juror: LoadedTable,
  voter: LoadedTable,
  rules: RulesFile,
  options?: { dateStrictness?: DateStrictness },
): { coreResult: MatchResult; policy: PolicyResult; cancelled: CancelledCounts; warning: string | null } {
  const filtered = filterCancelledVoters(voter.text, voter.hasHeader);
  const voterText = filtered.skipped > 0 ? filtered.csv : voter.text;
  const dateStrictness = options?.dateStrictness ?? UI_DATE_STRICTNESS;
  if (filtered.allCancelled) {
    const coreResult = emptyMatch();
    const policy = applyPolicy({
      pairs: [],
      jurorText: juror.text,
      jurorDelim: juror.delim,
      jurorHeader: juror.hasHeader,
      jurorIdCol: juror.map.juror_id ?? -1,
      jurorDobCol: juror.map.dob ?? -1,
      voterText: '',
      voterDelim: voter.delim,
      voterHeader: voter.hasHeader,
      voterIdCol: voter.map.voter_id ?? -1,
      extraJuror: juror.extra,
      extraVoter: voter.extra,
      jurorOrder: juror.order,
      voterOrder: voter.order,
      rules,
      dateStrictness,
    });
    return {
      coreResult,
      policy,
      cancelled: filtered,
      warning: allCancelledRefusal(filtered.skipped, filtered.juryRelated),
    };
  }
  const builtJ = core.buildRecords(juror.text, juror.delim, juror.hasHeader, juror.map, {
    order: juror.order,
    reasonFilter: juror.reasonFilter,
  });
  const builtV = core.buildRecords(voterText, voter.delim, voter.hasHeader, voter.map, { order: voter.order });
  const coreResult = core.match(builtJ.records, builtV.records);
  const policy = applyPolicy({
    pairs: coreResult.pairs,
    jurorText: juror.text,
    jurorDelim: juror.delim,
    jurorHeader: juror.hasHeader,
    jurorIdCol: juror.map.juror_id ?? -1,
    jurorDobCol: juror.map.dob ?? -1,
    voterText,
    voterDelim: voter.delim,
    voterHeader: voter.hasHeader,
    voterIdCol: voter.map.voter_id ?? -1,
    extraJuror: juror.extra,
    extraVoter: voter.extra,
    jurorOrder: juror.order,
    voterOrder: voter.order,
    rules,
    dateStrictness,
  });
  return { coreResult, policy, cancelled: filtered, warning: null };
}

export function extrasFor(kind: 'juror' | 'voter', headers: string[]): ExtraColumns {
  return guessExtra(kind, headers);
}
