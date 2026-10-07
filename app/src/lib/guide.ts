import { CANNOT_COMPARE_PHRASE, EXCLUDE_PHRASE } from '../../../shared/src/policy/apply.ts';
import type { Gates, RulesFile } from '../../../shared/src/policy/gates.ts';
import { RUN_STEPS, type FlowFacts, emptyFacts } from './flow.ts';

export const GUIDE_SECTIONS = ['Walk through it', 'At a glance', 'Federal layer', 'State layer', 'Local layer'] as const;

export type GuideSection = { title: (typeof GUIDE_SECTIONS)[number]; lines: string[] };

function shown(value: unknown): string {
  if (value === null || value === undefined) return 'Not stated in the rules file.';
  if (typeof value === 'string') return value.length > 0 ? value : 'Not stated in the rules file.';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return 'Not stated in the rules file.';
}

function targetLine(label: string, target: unknown): string {
  if (!target || typeof target !== 'object') return `The ${label} is not stated in the rules file.`;
  const rec = target as Record<string, unknown>;
  const url = typeof rec.url === 'string' && rec.url.length > 0 ? ` ${rec.url}` : '';
  return `Send a referral to the ${label}: ${shown(rec.name)}.${url}`;
}

function juryPublicSentence(value: unknown): string {
  if (value === true) return 'The jury list is public in this state.';
  if (value === false) return 'The jury list is not public in this state.';
  return 'Not confirmed, so treated as not public.';
}

function registrationSentence(value: unknown): string {
  if (value === true) return 'The public voter file includes a registration date.';
  if (value === false) return 'The public voter file does not include a registration date.';
  return 'Not confirmed, so the registration date is treated as not in the public file.';
}

function sourceLines(sources: unknown): string[] {
  if (!Array.isArray(sources) || sources.length === 0) return ['Sources: Not stated in the rules file.'];
  return sources.map((item) => {
    if (!item || typeof item !== 'object') return 'Source: Not stated in the rules file.';
    const rec = item as Record<string, unknown>;
    return `Source: ${shown(rec.cite)} ${shown(rec.url)} (${shown(rec.verified_on)})`;
  });
}

function stringFields(record: unknown, labels: [string, string][]): string[] {
  if (!record || typeof record !== 'object') return labels.map(([label]) => `${label}: Not stated in the rules file.`);
  const rec = record as Record<string, unknown>;
  return labels.map(([key, label]) => `${label}: ${shown(rec[key])}`);
}

export function guideFacts(rules: RulesFile, gates: Gates): FlowFacts {
  return {
    ...emptyFacts(),
    stateCode: rules.state,
    stateName: rules.name,
    allowJuryList: gates.allow_jury_list,
    blockReason: rules.gates.basis,
    namedExport: gates.allow_named_export,
  };
}

export function buildGuide(
  raw: Record<string, unknown>,
  gates: Gates,
  federal: { election: string; start: string; end: string },
  countyName: string | null,
): GuideSection[] {
  const rules = raw as unknown as RulesFile;
  const jury = raw.jury_list;
  const voter = raw.voter_file;
  const challenge = raw.private_challenge;
  const blackout = raw.blackout;
  const targets = raw.referral_targets;
  const notes = Array.isArray(raw.notes) ? raw.notes : [];
  const windows = blackout && typeof blackout === 'object' && Array.isArray((blackout as { state_windows?: unknown }).state_windows)
    ? (blackout as { state_windows: unknown[] }).state_windows
    : [];

  const juryPublic = jury && typeof jury === 'object' ? (jury as { public?: unknown }).public : null;
  const regPublic = voter && typeof voter === 'object' ? (voter as { registration_date_in_public_file?: unknown }).registration_date_in_public_file : null;
  const glance: GuideSection = {
    title: 'At a glance',
    lines: [
      `${shown(raw.name)} is the state for this check.`,
      juryPublicSentence(juryPublic),
      gates.allow_jury_list
        ? 'JuryRoll can load the jury list and run a match.'
        : 'JuryRoll does not load the jury list. This check shows counts only.',
      gates.allow_named_export
        ? 'Named leads are allowed. A referral can include names.'
        : 'Named leads are not exported.',
      `A later registration is excluded (${EXCLUDE_PHRASE}). A missing date cannot be compared (${CANNOT_COMPARE_PHRASE}).`,
      registrationSentence(regPublic),
      targetLine('county board', targets && typeof targets === 'object' ? (targets as { county_board?: unknown }).county_board : null),
      targetLine('chief state election official', targets && typeof targets === 'object' ? (targets as { state_election_office?: unknown }).state_election_office : null),
      targetLine('state attorney general', targets && typeof targets === 'object' ? (targets as { ag?: unknown }).ag : null),
    ],
  };

  const federalLines = [
    `NVRA 90-day blackout: ${shown(blackout && typeof blackout === 'object' ? (blackout as { federal_90_day?: unknown }).federal_90_day : null)}`,
    `Federal source: ${shown(blackout && typeof blackout === 'object' ? (blackout as { federal_source_url?: unknown }).federal_source_url : null)}`,
    `Election: ${federal.election}`,
    `Current window: ${federal.start} through ${federal.end}.`,
  ];

  const stateLines = [
    ...stringFields(jury, [
      ['statute', 'Jury list statute'],
      ['holder', 'Holder'],
      ['official_pipeline', 'Official pipeline'],
      ['use_restriction', 'Use restriction'],
      ['source_url', 'Jury list source'],
      ['verified_on', 'Jury list verified on'],
    ]),
    ...sourceLines(jury && typeof jury === 'object' ? (jury as { sources?: unknown }).sources : null),
    ...stringFields(voter, [
      ['who_may_get', 'Who may get the voter file'],
      ['permitted_uses', 'Permitted uses'],
      ['penalty', 'Penalty'],
      ['attestation_required', 'Attestation required'],
      ['source_url', 'Voter file source'],
    ]),
    ...sourceLines(voter && typeof voter === 'object' ? (voter as { sources?: unknown }).sources : null),
    ...stringFields(challenge, [
      ['who', 'Who may challenge'],
      ['form_or_statute', 'Challenge form or statute'],
      ['deadlines', 'Challenge deadlines'],
      ['evidence_standard', 'Evidence standard'],
      ['false_statement_penalty', 'False statement penalty'],
      ['source_url', 'Challenge source'],
    ]),
    ...sourceLines(challenge && typeof challenge === 'object' ? (challenge as { sources?: unknown }).sources : null),
    `Gates basis: ${shown(rules.gates?.basis)}`,
    ...(notes.length > 0 ? notes.map((note) => `Note: ${shown(note)}`) : ['Notes: Not stated in the rules file.']),
    ...(windows.length > 0
      ? windows.map((item) => {
        if (!item || typeof item !== 'object') return 'State window: Not stated in the rules file.';
        const rec = item as Record<string, unknown>;
        return `State window: ${shown(rec.applies_to)}. ${shown(rec.effect)} (${shown(rec.statute)}) ${shown(rec.source_url)}`;
      })
      : ['State windows: Not stated in the rules file.']),
  ];

  const localLines = [
    countyName
      ? `Local addressee: ${countyName} board of elections`
      : 'Local addressee: Pick a county. The letter names that county board of elections.',
    targetLine('County board in the rules file', targets && typeof targets === 'object' ? (targets as { county_board?: unknown }).county_board : null),
  ];

  const walkLines = [
    gates.allow_jury_list
      ? 'Walk through the named-lead path.'
      : 'Walk through the counts-only path.',
    ...RUN_STEPS.map((step, index) => {
      const reason = step.blocked(guideFacts(rules, gates));
      const detail = reason ? `Blocked. ${reason}` : `${step.job} ${step.question}`;
      return `${index + 1}. ${step.title}. ${detail}`;
    }),
    `Start a check in ${shown(raw.name)}`,
  ];

  return [
    { title: 'Walk through it', lines: walkLines },
    glance,
    { title: 'Federal layer', lines: federalLines },
    { title: 'State layer', lines: stateLines },
    { title: 'Local layer', lines: localLines },
  ];
}

export function guideText(sections: readonly GuideSection[]): string {
  return sections.map((section) => [section.title, ...section.lines].join('\n')).join('\n\n');
}
