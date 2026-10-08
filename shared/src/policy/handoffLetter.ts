import type { RulesFile } from './gates.ts';
import {
  COUNTS_ONLY_FRAMING,
  handoffKind,
  type HandoffKind,
} from './handoffRoutes.ts';

export type HandoffInput = {
  county: string;
  fips: string;
  periodFrom: string;
  periodTo: string;
  forwarded: string;
  noticesReceived: string;
  actionsTaken: string;
  juryCount: string;
  jurySource: string;
  removals: string;
  removalSource: string;
  reportsReceived: string;
  recordsReceived: string;
};

function filled(value: string): string {
  const text = value.trim();
  return text || '—';
}

export function electionOfficeAddressee(rules: RulesFile, county: string): string {
  const countyBoard = rules.referral_targets.county_board;
  const stateOffice = rules.referral_targets.state_election_office;
  const sameOffice = Boolean(
    countyBoard
    && stateOffice
    && countyBoard.name === stateOffice.name
    && countyBoard.url === stateOffice.url,
  );
  if (sameOffice && countyBoard) return county ? `${county} board of elections` : countyBoard.name;
  const parts: string[] = [];
  if (countyBoard) parts.push(county ? `${county} board of elections` : countyBoard.name);
  if (stateOffice) parts.push(stateOffice.name);
  return parts.join('; ') || 'the county board of elections or the chief state election official';
}

function periodLine(input: HandoffInput): string {
  return `Period: ${filled(input.periodFrom)} to ${filled(input.periodTo)}`;
}

function pipelineText(rules: RulesFile): string {
  return rules.jury_list.official_pipeline || 'the official jury-to-election process described in state law';
}

function bodyFor(kind: HandoffKind, rules: RulesFile, input: HandoffInput): string[] {
  switch (kind) {
    case 'pipeline':
      return [
        `The law already describes an official path: ${pipelineText(rules)}`,
        '',
        'Are non-citizen juror excusals forwarded to election officials? How many?',
        'Please provide the counts of notices received and the resulting actions.',
        '',
        periodLine(input),
        `Non-citizen juror excusals forwarded: ${filled(input.forwarded)}`,
        `Notices received: ${filled(input.noticesReceived)}`,
        `Resulting actions: ${filled(input.actionsTaken)}`,
      ];
    case 'audit-counts':
      return [
        'Are non-citizen juror excusals forwarded to election officials? How many?',
        '',
        periodLine(input),
        `Jurors disqualified or excused for non-citizenship: ${filled(input.juryCount)}`,
        `Source of that number: ${filled(input.jurySource)}`,
        `Voter registrations cancelled for non-citizenship: ${filled(input.removals)}`,
        `Source of that number: ${filled(input.removalSource)}`,
      ];
    case 'disqualified-reports':
      return [
        'This letter asks only about disqualified-juror reports.',
        '',
        periodLine(input),
        `Disqualified-juror reports received: ${filled(input.reportsReceived)}`,
        `Resulting actions: ${filled(input.actionsTaken)}`,
      ];
    case 'counts-only':
      return countsOnlyBody(rules, input);
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

function countsOnlyBody(rules: RulesFile, input: HandoffInput): string[] {
  const framing = COUNTS_ONLY_FRAMING[rules.state];
  if (framing) {
    return [
      framing,
      '',
      'This letter stays counts only.',
      '',
      periodLine(input),
      `Records the election office received: ${filled(input.recordsReceived)}`,
      `Actions taken: ${filled(input.actionsTaken)}`,
    ];
  }
  return [
    'This letter stays counts only.',
    '',
    `The law already describes an official path: ${pipelineText(rules)}`,
    '',
    `Is this process running in ${input.county || 'this county'}? How many records were received, reviewed, confirmed, and removed in the period?`,
    '',
    periodLine(input),
    `Jurors disqualified or excused for non-citizenship: ${filled(input.juryCount)}`,
    `Source of that number: ${filled(input.jurySource)}`,
    `Voter registrations cancelled for non-citizenship: ${filled(input.removals)}`,
    `Source of that number: ${filled(input.removalSource)}`,
  ];
}

export function juryHandoffLetter(rules: RulesFile, input: HandoffInput): string {
  const kind = handoffKind(rules.state);
  const countyLine = `${input.county || '—'}${input.fips ? ` (${input.fips})` : ''}`;
  const close = kind === 'counts-only' && COUNTS_ONLY_FRAMING[rules.state]
    ? [
      'Do not publish names. Do not contact voters. This tool never contacts voters.',
    ]
    : [
      'A match is not proof. Only election officials can verify citizenship.',
      'Do not publish names. Do not contact voters. This tool never contacts voters.',
    ];
  return [
    'Jury handoff counts letter',
    `To: ${electionOfficeAddressee(rules, input.county)}`,
    `State: ${rules.name} (${rules.state})`,
    `County: ${countyLine}`,
    '',
    'This letter has counts only. It has no names.',
    '',
    ...bodyFor(kind, rules, input),
    '',
    ...close,
    '',
  ].join('\n');
}
