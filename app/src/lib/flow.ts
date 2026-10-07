// One typed description of the run. The stepper, the walkthrough guide,
// and the tests all read this. Do not scatter unlock rules through the UI.

export const STEP_ORDER = ['where', 'sign', 'files', 'run', 'triage', 'export'] as const;

export type StepId = (typeof STEP_ORDER)[number];

export type RailStatus = 'done' | 'active' | 'locked' | 'blocked';

export type FlowMode = 'run' | 'guide';

export type FlowFacts = {
  stateCode: string;
  stateName: string;
  countyName: string;
  countyFips: string;
  attested: boolean;
  allowJuryList: boolean;
  blockReason: string;
  jurorLoaded: boolean;
  voterLoaded: boolean;
  hasResult: boolean;
  namedExport: boolean;
};

export type StepDef = {
  id: StepId;
  kicker: string;
  title: string;
  job: string;
  question: string;
  unlockHint: string;
  /** Next is the primary action. Otherwise the panel owns the one red button. */
  advance: 'next' | 'none';
  guideSummary: string;
  unlock: (facts: FlowFacts) => boolean;
  complete: (facts: FlowFacts) => boolean;
  summary: (facts: FlowFacts) => string;
  /** Why this step cannot be done. Null means it is not blocked. */
  blocked: (facts: FlowFacts) => string | null;
};

export const RUN_STEPS: readonly StepDef[] = [
  {
    id: 'where',
    kicker: 'Step 1',
    title: 'Where',
    job: 'Choose the state and the county.',
    question: 'Where is this check?',
    unlockHint: 'This step is always open.',
    advance: 'next',
    guideSummary: 'Choose this state and one county.',
    unlock: () => true,
    complete: (facts) => facts.stateCode !== '' && facts.countyFips !== '',
    summary: (facts) => `${facts.stateCode} · ${facts.countyName} (${facts.countyFips})`,
    blocked: () => null,
  },
  {
    id: 'sign',
    kicker: 'Step 2',
    title: 'Sign',
    job: 'Sign the use statement.',
    question: 'Do you accept the use statement?',
    unlockHint: 'Choose a state first.',
    advance: 'next',
    guideSummary: 'Sign the use statement and enter your initials.',
    unlock: (facts) => facts.stateCode !== '',
    complete: (facts) => facts.attested,
    summary: () => 'Use statement signed.',
    blocked: () => null,
  },
  {
    id: 'files',
    kicker: 'Step 3',
    title: 'Add files',
    job: 'Add the jury list and the voter roll, or type a printed list.',
    question: 'Which files should be checked?',
    unlockHint: 'Sign the use statement first.',
    advance: 'next',
    guideSummary: 'Add the jury list and the voter roll, type a printed list, or use the fictional samples.',
    unlock: (facts) => facts.stateCode !== '' && facts.attested && facts.allowJuryList,
    complete: (facts) => facts.jurorLoaded && facts.voterLoaded,
    summary: () => 'Jury list and voter roll loaded.',
    blocked: (facts) => (facts.stateCode !== '' && !facts.allowJuryList ? facts.blockReason : null),
  },
  {
    id: 'run',
    kicker: 'Step 4',
    title: 'Run',
    job: 'Run the match on this computer.',
    question: 'Run the match with these columns and reasons?',
    unlockHint: 'Load both files and choose a county.',
    advance: 'none',
    guideSummary: 'Run the match. It stays on this computer.',
    unlock: (facts) => facts.allowJuryList && facts.attested && facts.countyFips !== '' && facts.jurorLoaded && facts.voterLoaded,
    complete: (facts) => facts.hasResult,
    summary: () => 'Match finished.',
    blocked: () => null,
  },
  {
    id: 'triage',
    kicker: 'Step 5',
    title: 'Triage',
    job: 'Sort the to-explore pile.',
    question: 'Which leads go on the to-explore pile?',
    unlockHint: 'Run the match first.',
    advance: 'next',
    guideSummary: 'Review Strong, Probable, and Weak leads. Counts-only states show counts, not names.',
    unlock: (facts) => facts.hasResult,
    complete: (facts) => facts.hasResult,
    summary: () => 'To-explore pile reviewed.',
    blocked: () => null,
  },
  {
    id: 'export',
    kicker: 'Step 6',
    title: 'Export',
    job: 'Export the referral.',
    question: 'Export the referral for official verification?',
    unlockHint: 'Finish triage and choose a county.',
    advance: 'none',
    guideSummary: 'Export the referral to the county board, the state election office, or the attorney general.',
    unlock: (facts) => facts.hasResult && facts.countyFips !== '' && facts.namedExport,
    complete: () => false,
    summary: () => 'Referral exported.',
    blocked: () => null,
  },
];

export function stepById(id: StepId): StepDef {
  switch (id) {
    case 'where':
    case 'sign':
    case 'files':
    case 'run':
    case 'triage':
    case 'export': {
      const found = RUN_STEPS.find((step) => step.id === id);
      if (!found) throw new Error(`Unknown step ${id}`);
      return found;
    }
    default: {
      const missing: never = id;
      throw new Error(`Unknown step ${String(missing)}`);
    }
  }
}

export function stepIndex(id: StepId): number {
  return STEP_ORDER.indexOf(id);
}

export function railStatus(step: StepDef, facts: FlowFacts, activeId: StepId, mode: FlowMode = 'run'): RailStatus {
  if (mode === 'guide') {
    if (step.blocked(facts)) return 'blocked';
    if (step.id === activeId) return 'active';
    if (stepIndex(step.id) < stepIndex(activeId)) return 'done';
    return 'locked';
  }
  if (step.blocked(facts)) return 'blocked';
  if (step.id === activeId) return 'active';
  if (!step.unlock(facts)) return 'locked';
  if (step.complete(facts)) return 'done';
  return 'locked';
}

export function canActivate(step: StepDef, facts: FlowFacts, mode: FlowMode = 'run'): boolean {
  if (mode === 'guide') return true;
  if (step.blocked(facts)) return true;
  return step.unlock(facts) || step.complete(facts);
}

export function previousStepId(current: StepId): StepId | null {
  const index = stepIndex(current);
  if (index <= 0) return null;
  return STEP_ORDER[index - 1];
}

export function nextStepId(current: StepId, facts: FlowFacts, mode: FlowMode = 'run'): StepId | null {
  const later = STEP_ORDER.slice(stepIndex(current) + 1);
  if (mode === 'guide') return later[0] ?? null;
  for (const id of later) {
    const step = stepById(id);
    if (step.blocked(facts) || step.unlock(facts)) return id;
  }
  return null;
}

export function stepOutput(step: StepDef, facts: FlowFacts): string | null {
  if (step.blocked(facts) || !step.complete(facts)) return null;
  return step.summary(facts);
}

/** Later steps whose saved work must be dropped after an edit. */
export function clearedSteps(edited: StepId, facts: Pick<FlowFacts, 'allowJuryList'>): StepId[] {
  const later = STEP_ORDER.slice(stepIndex(edited) + 1);
  if (edited === 'where') {
    return later.filter((id) => id !== 'sign' && (facts.allowJuryList ? id !== 'files' : true));
  }
  if (edited === 'sign') return later.filter((id) => id !== 'files');
  return [...later];
}

export function blockedBranch(facts: FlowFacts): 'counts-only' | null {
  return stepById('files').blocked(facts) ? 'counts-only' : null;
}

export function emptyFacts(): FlowFacts {
  return {
    stateCode: '',
    stateName: '',
    countyName: '',
    countyFips: '',
    attested: false,
    allowJuryList: false,
    blockReason: '',
    jurorLoaded: false,
    voterLoaded: false,
    hasResult: false,
    namedExport: false,
  };
}
