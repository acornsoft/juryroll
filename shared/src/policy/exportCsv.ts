import { SAVE_EXPORT_LINE, type PolicyResult, exportableRows } from './apply.ts';
import { collectSourceUrls, type RulesFile, type Target } from './gates.ts';

function csvCell(value: unknown): string {
  let text = value === undefined || value === null ? '' : String(value);
  if (/^[=+@\t\r]/.test(text) || (/^-/.test(text) && !/^-?\d/.test(text))) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const COLS: [string, string][] = [
  ['tier', 'Tier'],
  ['voterId', 'Voter ID'],
  ['voterName', 'Voter name'],
  ['voterDob', 'Voter DOB'],
  ['voterAddress', 'Voter address'],
  ['voterStatus', 'Voter status'],
  ['regDate', 'Registration date'],
  ['declDate', 'Jury declaration date'],
  ['jurorId', 'Juror record ID'],
  ['reason', 'Disqualification reason'],
  ['matched', 'Matched fields'],
  ['jurorName', 'Juror name (as recorded)'],
  ['jurorDob', 'Juror DOB (as recorded)'],
  ['flags', 'Flags'],
  ['notes', 'Notes'],
];

export function toCSV(input: {
  allowNamedExport: boolean;
  result: PolicyResult;
  rules: RulesFile;
  targets: Target[];
  county: string;
  dateStr: string;
}): string {
  if (!input.allowNamedExport) {
    throw new Error('Named export is not allowed for this state.');
  }
  const { main, removed } = exportableRows(input.result);
  const cites = collectSourceUrls(input.rules).join(' ');
  const targetLine = input.targets.map((target) => `${target.name} ${target.url}`).join(' | ');
  const lines = [
    csvCell('Referral for official verification'),
    csvCell(`State: ${input.rules.state}. Rules verified on ${input.rules.verified_on}.`),
    csvCell(`Cites: ${cites}`),
    csvCell(`Referral targets: ${targetLine}`),
    csvCell(SAVE_EXPORT_LINE),
    csvCell(`County: ${input.county}. Date: ${input.dateStr}.`),
    '',
    COLS.map((col) => csvCell(col[1])).join(','),
  ];
  const pushRow = (row: ReturnType<typeof exportableRows>['main'][number]) => {
    const record: Record<string, string> = {
      tier: row.tier,
      voterId: row.voterId,
      voterName: row.voterName,
      voterDob: row.voterDob,
      voterAddress: row.voterAddress,
      voterStatus: row.voterStatus,
      regDate: row.regDate,
      declDate: row.declDate,
      jurorId: row.jurorId,
      reason: row.reason,
      matched: row.matched,
      jurorName: row.jurorName,
      jurorDob: row.jurorDob,
      flags: row.flags.join('|'),
      notes: row.notes.join(' '),
    };
    lines.push(COLS.map((col) => csvCell(record[col[0]] ?? '')).join(','));
  };
  main.forEach(pushRow);
  lines.push('');
  lines.push(csvCell('Already removed: confirm the removal was correct'));
  removed.forEach(pushRow);
  return `${lines.join('\r\n')}\r\n`;
}

export function referralFileName(state: string, county: string, dateStr: string): string {
  const safeCounty = (county || 'county').replace(/[^A-Za-z0-9]+/g, '');
  return `JuryRoll-referral-${state}-${safeCounty || 'county'}-${dateStr}.csv`;
}
