// G.1 voter-file use attestation. The panel is required exactly when
// voter_file.use_restriction is a string. null or a missing key shows nothing.

export const VOTER_USE_HEADING = 'Your state limits how its voter list may be used';
export const VOTER_USE_ONLY_LINE = 'JuryRoll supports one use only: counting matches and referring them to election officials.';
export const VOTER_USE_DECIDE_LINE = 'JuryRoll does not decide whether your use is allowed. Read the law. If you are not sure, do not load the file.';
export const VOTER_USE_CHECK_LABEL = 'I have read this law. My use of this voter file is allowed under it.';
export const VOTER_USE_REFUSE = 'Check the voter-file use box before JuryRoll loads the voter file.';

export type VoterUseRules = {
  voter_file?: {
    use_restriction?: string | null;
    source_url?: string | null;
  };
};

/** Statutory text the panel shows. The audit entry stores only its SHA-256. */
export function voterUseShownText(restriction: string): string {
  return restriction;
}

export function voterUseRestriction(rules: VoterUseRules | null | undefined): string | null {
  const value = rules?.voter_file?.use_restriction;
  return typeof value === 'string' ? value : null;
}

export function voterUsePanelRequired(rules: VoterUseRules | null | undefined): boolean {
  return voterUseRestriction(rules) !== null;
}
