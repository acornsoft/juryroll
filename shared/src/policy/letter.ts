import type { RulesFile, Target } from './gates.ts';
import { stateCopy } from './stateCopy/index.ts';

export type AuditInputs = {
  periodFrom: string;
  periodTo: string;
  juryCount: string;
  jurySource: string;
  removals: string;
  removalSource: string;
  county: string;
  fips?: string;
};

/** A pipeline to quote. Null, blank, and "None..." mean no process is in force. */
export function quotedPipeline(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text.length === 0 || text.startsWith('None')) return null;
  return value;
}

export function auditLetter(rules: RulesFile, targets: Target[], input: AuditInputs): string {
  const countyBoard = rules.referral_targets.county_board;
  const office = targets.map((target) => {
    const isCountyBoard = Boolean(
      input.county
      && countyBoard
      && target.name === countyBoard.name
      && target.url === countyBoard.url,
    );
    return isCountyBoard ? `${input.county} board of elections` : target.name;
  }).join('; ') || 'the state election office and the county board';
  const copy = stateCopy(rules.state);
  const pipeline = quotedPipeline(rules.jury_list.official_pipeline);
  const lines = [
    'JuryRoll audit letter',
    `To: ${office}`,
    `State: ${rules.name} (${rules.state})`,
    '',
    'This letter has counts only. It has no names.',
    '',
  ];
  if (pipeline) {
    const lead = copy.pipelineLead ?? 'The law already describes an official path: ';
    lines.push(`${lead}${pipeline}`, '');
  }
  lines.push(`County: ${input.county || '—'}${input.fips ? ` (${input.fips})` : ''}`);
  if (copy.replaceRunningQuestion && copy.runningQuestion) {
    lines.push(copy.runningQuestion);
  } else if (pipeline && !copy.replaceRunningQuestion) {
    lines.push(`Is this process running in ${input.county || 'this county'}? How many records were received, reviewed, confirmed, and removed in the period?`);
  }
  lines.push('', `Period: ${input.periodFrom || '—'} to ${input.periodTo || '—'}`);
  if (!copy.suppressJuryCount) {
    const juryLabel = copy.juryCountLabel ?? 'Jurors disqualified or excused for non-citizenship';
    lines.push(`${juryLabel}: ${input.juryCount || '—'}`);
    lines.push(`Source of that number: ${input.jurySource || '—'}`);
  }
  lines.push(
    `Voter registrations cancelled for non-citizenship: ${input.removals || '—'}`,
    `Source of that number: ${input.removalSource || '—'}`,
  );
  const audit = rules.audit_path;
  if (audit && audit.counts_only) {
    lines.push('', `You can ask for counts of list-maintenance outcomes under ${audit.statute}.`, audit.what_you_can_request);
    if (audit.note) lines.push(audit.note);
  }
  for (const line of copy.letterLines) lines.push(line);
  lines.push(
    '',
    'A match is not proof. Only election officials can verify citizenship.',
    'Do not publish names. Do not contact voters. This tool never contacts voters.',
    '',
  );
  return lines.join('\n');
}
