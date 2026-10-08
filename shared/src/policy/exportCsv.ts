import { SAVE_EXPORT_LINE, type PolicyResult, exportableRows } from './apply.ts';
import { neutralizeFormulaCell } from './formula.ts';
import { collectSourceUrls, type RulesFile, type Target } from './gates.ts';

export function exportCell(value: unknown): string {
  const text = neutralizeFormulaCell(value === undefined || value === null ? '' : String(value));
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
  fips?: string;
  dateStr: string;
}): string {
  if (!input.allowNamedExport) {
    throw new Error('Named export is not allowed for this state.');
  }
  const { main, removed } = exportableRows(input.result);
  const cites = collectSourceUrls(input.rules).join(' ');
  const targetLine = input.targets.map((target) => `${target.name} ${target.url}`).join(' | ');
  const lines = [
    exportCell('Referral for official verification'),
    exportCell(input.result.excludedLine),
    exportCell(input.result.cannotCompareLine),
    exportCell(`State: ${input.rules.state}. Rules verified on ${input.rules.verified_on}.`),
    exportCell(`Cites: ${cites}`),
    exportCell(`Referral targets: ${targetLine}`),
    exportCell(SAVE_EXPORT_LINE),
    exportCell(`County: ${input.county}${input.fips ? ` (${input.fips})` : ''}. Date: ${input.dateStr}.`),
    '',
    COLS.map((col) => exportCell(col[1])).join(','),
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
    lines.push(COLS.map((col) => exportCell(record[col[0]] ?? '')).join(','));
  };
  main.forEach(pushRow);
  lines.push('');
  lines.push(exportCell('Already removed: confirm the removal was correct'));
  removed.forEach(pushRow);
  return `${lines.join('\r\n')}\r\n`;
}

export function referralFileName(state: string, county: string, dateStr: string): string {
  const safeCounty = (county || 'county').replace(/[^A-Za-z0-9]+/g, '');
  return `JuryRoll-referral-${state}-${safeCounty || 'county'}-${dateStr}.csv`;
}
