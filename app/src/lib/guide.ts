import { CANNOT_COMPARE_PHRASE, EXCLUDE_PHRASE } from '../../../shared/src/policy/apply.ts';
import type { Gates, RulesFile } from '../../../shared/src/policy/gates.ts';
import { RUN_STEPS, type FlowFacts, emptyFacts } from './flow.ts';

export const GUIDE_SECTIONS = ['At a glance', 'Federal layer', 'State layer', 'Local layer', 'Walk through it'] as const;

export type GuideSection = { title: (typeof GUIDE_SECTIONS)[number]; lines: string[] };

function shown(value: unknown): string {
  if (value === null || value === undefined) return 'Not stated in the rules file.';
  if (typeof value === 'string') return value.length > 0 ? value : 'Not stated in the rules file.';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return 'Not stated in the rules file.';
}

function targetLine(label: string, target: unknown): string {
  if (!target || typeof target !== 'object') return `${label}: Not stated in the rules file.`;
  const rec = target as Record<string, unknown>;
  return `${label}: ${shown(rec.name)} ${shown(rec.url)}`;
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

  const glance: GuideSection = {
    title: 'At a glance',
    lines: [
      `State: ${shown(raw.name)} (${shown(raw.state)})`,
      `Jury list public: ${shown(jury && typeof jury === 'object' ? (jury as { public?: unknown }).public : null)}`,
      `Jury list allowed in JuryRoll: ${gates.allow_jury_list ? 'yes' : 'no'}`,
      `Named export allowed: ${gates.allow_named_export ? 'yes' : 'no'}`,
      `Badge: ${gates.allow_named_export ? 'Named leads allowed' : 'Counts-only'}`,
      `Date rule: ${EXCLUDE_PHRASE}. ${CANNOT_COMPARE_PHRASE}.`,
      `Registration date in the public voter file: ${shown(voter && typeof voter === 'object' ? (voter as { registration_date_in_public_file?: unknown }).registration_date_in_public_file : null)}`,
      targetLine('County board', targets && typeof targets === 'object' ? (targets as { county_board?: unknown }).county_board : null),
      targetLine('Chief state election official', targets && typeof targets === 'object' ? (targets as { state_election_office?: unknown }).state_election_office : null),
      targetLine('State attorney general', targets && typeof targets === 'object' ? (targets as { ag?: unknown }).ag : null),
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
    ...RUN_STEPS.map((step) => {
      const reason = step.blocked(guideFacts(rules, gates));
      return reason ? `${step.title}: blocked. ${reason}` : `${step.title}: ${step.job} ${step.question}`;
    }),
    `Start a check in ${shown(raw.name)}`,
  ];

  return [
    glance,
    { title: 'Federal layer', lines: federalLines },
    { title: 'State layer', lines: stateLines },
    { title: 'Local layer', lines: localLines },
    { title: 'Walk through it', lines: walkLines },
  ];
}

export function guideText(sections: readonly GuideSection[]): string {
  return sections.map((section) => [section.title, ...section.lines].join('\n')).join('\n\n');
}
