// Jury-handoff letter routing.
// Wording and limits are from OTHER-PATHS item 2 (Optimus-approved 2026-10-07).

export const DC_FRAMING = 'In DC, non-citizens may vote in local elections, so the non-citizen framing doesn\'t fit.';

/**
 * States whose rules file describes a statute that sends jury citizenship
 * information to election officials. Ohio and Virginia are omitted: their
 * official_pipeline text says no jury-to-election pipeline was found.
 */
export const PIPELINE_STATES: readonly string[] = [
  'AZ', 'AR', 'FL', 'GA', 'IN', 'KS', 'KY', 'LA', 'NC', 'OK', 'TN', 'TX',
];

/** CT and DC stay counts only (H.6). */
export const COUNTS_ONLY_STATES: readonly string[] = ['CT', 'DC'];

export const COUNTS_ONLY_FRAMING: Readonly<Record<string, string>> = {
  DC: DC_FRAMING,
};

export type HandoffKind = 'pipeline' | 'audit-counts' | 'disqualified-reports' | 'counts-only';

export function handoffKind(state: string): HandoffKind {
  if (COUNTS_ONLY_STATES.includes(state)) return 'counts-only';
  if (state === 'IL') return 'disqualified-reports';
  if (PIPELINE_STATES.includes(state)) return 'pipeline';
  return 'audit-counts';
}

/** The letter is for states where the app does not load a jury list. */
export function handoffAvailable(allowJuryList: boolean): boolean {
  return !allowJuryList;
}
