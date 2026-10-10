import core from '../core.js';
import { guessExtra, sanitizeExtra, type ExtraColumns } from './columns.ts';
import { applyPolicy, UI_DATE_STRICTNESS, type DateStrictness, type PolicyResult } from './apply.ts';
import { allCancelledRefusal, filterCancelledVoters, type CancelledCounts } from './cancelled.ts';
import type { RulesFile } from './gates.ts';
import type { MatchResult } from '../core.js';
import { COUNTY_UNCHECKED_BANNER, DIFFERENT_COUNTY_PHRASE, splitVoterByPlace } from './place.ts';
import { classifyReason, countReasonRows, reasonValues } from './reasons.ts';

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

export type RunPlace = {
  countyName: string;
  countyFips: string;
};

export type RunNotes = {
  differentCountyCount: number;
  differentCountyLine: string;
  countyChecked: boolean;
  countyBanner: string | null;
  stateDropped: number;
  formulaReasonCount: number;
  formulaReasonLine: string;
  unrecognizedReasonCount: number;
  unrecognizedReasonLine: string;
};

export function namedExportAllowed(gate: boolean, countyChecked: boolean): boolean {
  return gate && countyChecked;
}

function keepReason(raw: string, rules: RulesFile, filter: Record<string, boolean> | null): boolean {
  const kind = classifyReason(raw, rules.state);
  if (kind.formula) return false;
  if (!filter) return true;
  if (Object.prototype.hasOwnProperty.call(filter, kind.key)) return Boolean(filter[kind.key]);
  if (Object.prototype.hasOwnProperty.call(filter, raw.trim())) return Boolean(filter[raw.trim()]);
  return kind.autoNonCitizen;
}

function emptyMatch(): MatchResult {
  return {
    pairs: [],
    counts: { Strong: 0, Probable: 0, Weak: 0 },
    jurorsByBest: { Strong: 0, Probable: 0, Weak: 0 },
    jurorsMatched: 0,
  };
}

function reasonNotes(juror: LoadedTable, rules: RulesFile): Pick<RunNotes, 'formulaReasonCount' | 'formulaReasonLine' | 'unrecognizedReasonCount' | 'unrecognizedReasonLine'> {
  const reasonIndex = juror.map.reason ?? -1;
  const counted = countReasonRows(reasonValues(juror.text, juror.delim, juror.hasHeader, reasonIndex), rules.state);
  return {
    formulaReasonCount: counted.formula,
    formulaReasonLine: counted.formulaLine,
    unrecognizedReasonCount: counted.unrecognized,
    unrecognizedReasonLine: counted.unrecognizedLine,
  };
}

export function runMatch(
  juror: LoadedTable,
  voter: LoadedTable,
  rules: RulesFile,
  options?: { dateStrictness?: DateStrictness; place?: RunPlace },
): { coreResult: MatchResult; policy: PolicyResult; cancelled: CancelledCounts; warning: string | null; notes: RunNotes } {
  juror = { ...juror, extra: sanitizeExtra('juror', juror.headers, juror.extra) };
  const filtered = filterCancelledVoters(voter.text, voter.hasHeader);
  const voterText = filtered.skipped > 0 ? filtered.csv : voter.text;
  const dateStrictness = options?.dateStrictness ?? UI_DATE_STRICTNESS;
  const place = options?.place;
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
    const notes: RunNotes = {
      differentCountyCount: 0,
      differentCountyLine: `0 ${DIFFERENT_COUNTY_PHRASE}`,
      countyChecked: true,
      countyBanner: null,
      stateDropped: 0,
      ...reasonNotes(juror, rules),
    };
    return {
      coreResult,
      policy,
      cancelled: filtered,
      warning: allCancelledRefusal(filtered.skipped, filtered.juryRelated),
      notes,
    };
  }
  const split = splitVoterByPlace({
    text: voterText,
    delim: voter.delim,
    hasHeader: voter.hasHeader,
    headers: voter.headers,
    stateCode: rules.state,
    stateName: rules.name,
    countyName: place?.countyName ?? '',
    countyFips: place?.countyFips ?? '',
    checkCounty: Boolean(place),
  });
  const builtJ = core.buildRecords(juror.text, juror.delim, juror.hasHeader, juror.map, {
    order: juror.order,
    reasonFilter: (raw: string) => keepReason(raw, rules, juror.reasonFilter),
  });
  const builtV = core.buildRecords(split.keptCsv, voter.delim, voter.hasHeader, voter.map, { order: voter.order });
  const coreResult = core.match(builtJ.records, builtV.records);
  let differentCountyCount = 0;
  if (split.countyChecked) {
    const outCounty = core.buildRecords(split.outCountyCsv, voter.delim, voter.hasHeader, voter.map, { order: voter.order });
    differentCountyCount = core.match(builtJ.records, outCounty.records).pairs.length;
  }
  const policy = applyPolicy({
    pairs: coreResult.pairs,
    jurorText: juror.text,
    jurorDelim: juror.delim,
    jurorHeader: juror.hasHeader,
    jurorIdCol: juror.map.juror_id ?? -1,
    jurorDobCol: juror.map.dob ?? -1,
    voterText: split.keptCsv,
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
  const countyChecked = place ? split.countyChecked : true;
  const notes: RunNotes = {
    differentCountyCount,
    differentCountyLine: `${differentCountyCount} ${DIFFERENT_COUNTY_PHRASE}`,
    countyChecked,
    countyBanner: countyChecked ? null : COUNTY_UNCHECKED_BANNER,
    stateDropped: split.stateDropped,
    ...reasonNotes(juror, rules),
  };
  return { coreResult, policy, cancelled: filtered, warning: null, notes };
}

export function extrasFor(kind: 'juror' | 'voter', headers: string[]): ExtraColumns {
  return guessExtra(kind, headers);
}
