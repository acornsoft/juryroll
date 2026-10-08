import type { RulesFile } from './gates.ts';
import {
  COUNTS_ONLY_LIMIT,
  EXEMPT_APPLICATION,
  FEDERAL_REQUIREMENT,
  NVRA_EXEMPT_SENTENCE,
  RESIDENTS_ONLY_NOTE,
  STATE_RECORDS_ROUTE,
  USC_20503_B,
  USC_20503_B_CITE,
  USC_20507_I,
  recordsRouteFor,
  type RecordsRoute,
} from './recordsRoutes.ts';

export type RecordsPeriod = {
  periodFrom: string;
  periodTo: string;
};

export type RecordsCounts = RecordsPeriod & {
  deathRemovals: string;
  addressRemovals: string;
  inactiveRemovals: string;
  noticesSent: string;
};

function filled(value: string): string {
  const text = value.trim();
  return text || '—';
}

export function electionOfficeAddressee(rules: RulesFile, county: string): string {
  const countyBoard = rules.referral_targets.county_board;
  const stateOffice = rules.referral_targets.state_election_office;
  const parts: string[] = [];
  if (countyBoard) parts.push(county ? `${county} board of elections` : countyBoard.name);
  if (stateOffice) parts.push(stateOffice.name);
  return parts.join('; ') || 'the county board of elections or the chief state election official';
}

function routeParagraphs(route: RecordsRoute): string[] {
  if (route.kind === 'state-public-records') {
    return [
      NVRA_EXEMPT_SENTENCE,
      STATE_RECORDS_ROUTE,
      `${USC_20503_B_CITE}: "${USC_20503_B}"`,
      EXEMPT_APPLICATION,
    ];
  }
  const lines = [USC_20507_I, COUNTS_ONLY_LIMIT];
  if (route.residentsOnlyCite) lines.push(RESIDENTS_ONLY_NOTE);
  return lines;
}

export function recordsRequestLetter(rules: RulesFile, county: string, fips: string, period: RecordsPeriod): string {
  const route = recordsRouteFor(rules.state);
  const countyLine = `${county || '—'}${fips ? ` (${fips})` : ''}`;
  return [
    'List-maintenance records request',
    `To: ${electionOfficeAddressee(rules, county)}`,
    `State: ${rules.name} (${rules.state})`,
    `County: ${countyLine}`,
    '',
    'This letter asks for counts only. It asks for no names.',
    '',
    ...routeParagraphs(route),
    '',
    FEDERAL_REQUIREMENT,
    '',
    `Period: ${filled(period.periodFrom)} to ${filled(period.periodTo)}`,
    'Please provide these counts for that period:',
    'Removals for death:',
    'Removals for change of address:',
    'Removals of inactive voters after a notice and two federal general elections with no response or vote:',
    'Notices sent:',
    '',
    'Do not publish names. Do not contact voters. This tool never contacts voters.',
    '',
  ].join('\n');
}

export function recordsCountsSummary(state: string, counts: RecordsCounts): string {
  const route = recordsRouteFor(state);
  const intro = route.kind === 'nvra'
    ? 'Where the NVRA applies, the federal requirement is worded as follows.'
    : 'In this state the NVRA does not apply. The wording below is the federal requirement. It is not applied here as a duty.';
  const lines = [
    'Counts only. No names.',
    '',
    intro,
    FEDERAL_REQUIREMENT,
    '',
    `Period: ${filled(counts.periodFrom)} to ${filled(counts.periodTo)}`,
    `Removals for death: ${filled(counts.deathRemovals)}`,
    `Removals for change of address: ${filled(counts.addressRemovals)}`,
    `Removals of inactive voters after a notice and two federal general elections with no response or vote: ${filled(counts.inactiveRemovals)}`,
    `Notices sent: ${filled(counts.noticesSent)}`,
    '',
    'This summary places those counts next to the federal requirement above.',
  ];
  if (route.residentsOnlyCite) lines.push('', RESIDENTS_ONLY_NOTE);
  if (route.kind === 'state-public-records') {
    lines.push('', NVRA_EXEMPT_SENTENCE, `${USC_20503_B_CITE}: "${USC_20503_B}"`);
  }
  return lines.join('\n');
}
