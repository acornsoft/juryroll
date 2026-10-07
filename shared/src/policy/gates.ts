// Effective gates. Same algorithm as shared/rules/validate.py effective().

export type GateKey = 'allow_jury_list' | 'aggregate_only' | 'allow_named_export' | 'show_challenge_guidance';

export type Gates = Record<GateKey, boolean>;

export type RulesFile = {
  state: string;
  name: string;
  schema_version: string;
  verified_on: string;
  jury_list: { public: boolean | null; statute: string | null; official_pipeline?: string | null; source_url?: string | null; verified_on?: string | null };
  voter_file: {
    permitted_uses?: string | null;
    no_online_posting?: boolean | null;
    dob_in_public_file?: boolean | null;
    registration_date_in_public_file?: boolean | null;
    source_url?: string | null;
  };
  private_challenge: {
    allowed: boolean | null;
    who?: string | null;
    form_or_statute?: string | null;
    form_url?: string | null;
    one_per_affidavit?: boolean | null;
    deadlines?: string | null;
    deadline_days_before_election?: number | null;
    evidence_standard?: string | null;
    juryroll_lead_sufficient?: boolean | null;
    false_statement_penalty?: string | null;
    source_url?: string | null;
  };
  blackout: {
    federal_90_day: true;
    federal_source_url: string;
    state_extra_days: number | null;
    state_windows?: StateWindow[];
    source_url?: string | null;
    verified_on?: string;
  };
  referral_targets: {
    county_board: Target | null;
    state_election_office: Target | null;
    ag: Target | null;
    other?: Target[];
  };
  gates: {
    allow_jury_list: boolean | null;
    aggregate_only: boolean | null;
    allow_named_export: boolean | null;
    show_challenge_guidance: boolean | null;
    basis: string;
  };
  notes: string[];
  [key: string]: unknown;
};

export type StateWindow = {
  days_before_election: number;
  applies_to: string;
  effect: string;
  statute: string;
  source_url: string;
  verified_on: string;
};

export type Target = { name: string; url: string; verified_on: string; note?: string };

const REQUIRED = ['state', 'name', 'schema_version', 'verified_on', 'jury_list', 'voter_file', 'private_challenge', 'blackout', 'referral_targets', 'gates', 'notes'];

/** null or undefined means the strict value. Use this for every rules read. */
export function strict<T>(value: T | null | undefined, strictValue: T): T {
  return value === null || value === undefined ? strictValue : value;
}

export function effective(rules: RulesFile): Gates {
  const jl = rules.jury_list.public === true;
  const pc = rules.private_challenge.allowed === true;
  const derived = {
    allow_jury_list: jl,
    aggregate_only: !jl,
    allow_named_export: jl,
    show_challenge_guidance: jl && pc,
  };
  const g = rules.gates;
  const out: Gates = {
    allow_jury_list: strict(g.allow_jury_list, false) && derived.allow_jury_list,
    aggregate_only: strict(g.aggregate_only, true) || derived.aggregate_only,
    allow_named_export: false,
    show_challenge_guidance: strict(g.show_challenge_guidance, false) && derived.show_challenge_guidance,
  };
  out.allow_named_export = strict(g.allow_named_export, false) && derived.allow_named_export && !out.aggregate_only;
  return out;
}

export function lightRulesError(rules: unknown): string | null {
  if (!rules || typeof rules !== 'object') return 'rules are not an object';
  const rec = rules as Record<string, unknown>;
  if (rec.schema_version !== '1.0.0') return `schema_version is ${String(rec.schema_version)}, not 1.0.0`;
  for (const key of REQUIRED) {
    if (!(key in rec)) return `missing ${key}`;
  }
  return null;
}

export type ResolvedRules = {
  rules: RulesFile;
  fallback: boolean;
  reason: string | null;
  requested: string;
};

export function resolveRules(code: string, bundle: Record<string, { rules: RulesFile }>): ResolvedRules {
  const requested = code || 'DEFAULT';
  const direct = bundle[requested];
  const fallbackRules = bundle.DEFAULT.rules;
  if (!direct) {
    return {
      rules: fallbackRules,
      fallback: true,
      reason: `No verified rules for ${requested}. Strictest rules apply.`,
      requested,
    };
  }
  const problem = lightRulesError(direct.rules);
  if (problem) {
    return {
      rules: fallbackRules,
      fallback: true,
      reason: `The rules file for ${requested} failed validation (${problem}). No verified rules for ${requested}. Strictest rules apply.`,
      requested,
    };
  }
  return { rules: direct.rules, fallback: requested === 'DEFAULT' || direct.rules.state === 'DEFAULT', reason: direct.rules.state === 'DEFAULT' && requested !== 'DEFAULT' ? `No verified rules for ${requested}. Strictest rules apply.` : null, requested };
}

export function collectSourceUrls(value: unknown, out: string[] = []): string[] {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    value.forEach((item) => collectSourceUrls(item, out));
    return out;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'source_url' && typeof child === 'string' && child && !out.includes(child)) out.push(child);
    else collectSourceUrls(child, out);
  }
  return out;
}

export function referralTargets(rules: RulesFile, defaults: RulesFile): Target[] {
  const targets = [rules.referral_targets.county_board, rules.referral_targets.state_election_office, rules.referral_targets.ag];
  const present = targets.filter((item): item is Target => item !== null && item !== undefined);
  if (present.length === 0) return (defaults.referral_targets.other ?? []).slice();
  return present;
}
