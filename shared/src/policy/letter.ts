import type { RulesFile, Target } from './gates.ts';

export type AuditInputs = {
  periodFrom: string;
  periodTo: string;
  juryCount: string;
  jurySource: string;
  removals: string;
  removalSource: string;
  county: string;
};

export function auditLetter(rules: RulesFile, targets: Target[], input: AuditInputs): string {
  const office = targets.map((target) => target.name).join('; ') || 'the state election office and the county board';
  const pipeline = rules.jury_list.official_pipeline || 'the official jury-to-election process described in state law';
  return [
    'JuryRoll audit letter',
    `To: ${office}`,
    `State: ${rules.name} (${rules.state})`,
    '',
    'This letter has counts only. It has no names.',
    '',
    `The law already describes an official path: ${pipeline}`,
    '',
    `Is this process running in ${input.county || 'this county'}? How many records were received, reviewed, confirmed, and removed in the period?`,
    '',
    `Period: ${input.periodFrom || '—'} to ${input.periodTo || '—'}`,
    `Jurors disqualified or excused for non-citizenship: ${input.juryCount || '—'}`,
    `Source of that number: ${input.jurySource || '—'}`,
    `Voter registrations cancelled for non-citizenship: ${input.removals || '—'}`,
    `Source of that number: ${input.removalSource || '—'}`,
    '',
    'A match is not proof. Only election officials can verify citizenship.',
    'Do not publish names. Do not contact voters. This tool never contacts voters.',
    '',
  ].join('\n');
}
