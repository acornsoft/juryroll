export type DobOrder = string;

export type ParsedDob = { y: number; full: string | null; m?: number; d?: number };

export type FieldDef = { label: string; pats: string[]; req?: boolean; exact?: boolean };

export type Head = { delim: string; headers: string[]; preview: string[][]; rows: number };

export type MatchPair = {
  tier: 'Strong' | 'Probable' | 'Weak';
  tierRank: number;
  voterId: string;
  voterName: string;
  voterDob: string;
  voterAddress: string;
  jurorId: string;
  reason: string;
  matched: string;
  jurorName: string;
  jurorDob: string;
};

export type MatchResult = {
  pairs: MatchPair[];
  counts: { Strong: number; Probable: number; Weak: number };
  jurorsByBest: { Strong: number; Probable: number; Weak: number };
  jurorsMatched: number;
};

declare const JuryRollCore: {
  FIELDS: Record<string, FieldDef>;
  JUROR_FIELDS: string[];
  VOTER_FIELDS: string[];
  NONCITIZEN_RE: RegExp;
  EXPORT_COLS: [string, string][];
  detectDelimiter: (text: string) => string;
  iterCSV: (text: string, delim: string, cb: (row: string[]) => boolean | void) => void;
  readHead: (text: string, hasHeader: boolean, previewRows?: number) => Head;
  guessMapping: (headers: string[], fieldKeys: string[]) => Record<string, number>;
  parseDOB: (raw: string, order?: DobOrder) => ParsedDob | null;
  normAddress: (house: string, street: string) => string;
  reasonValues: (text: string, delim: string, hasHeader: boolean, idx: number) => { value: string; count: number; auto: boolean }[];
  buildRecords: (
    text: string,
    delim: string,
    hasHeader: boolean,
    map: Record<string, number>,
    opts?: { order?: string; reasonFilter?: Record<string, boolean> | null },
  ) => { records: unknown[]; total: number; kept: number; skipped: number };
  match: (jurors: unknown[], voters: unknown[]) => MatchResult;
  toCSV: (pairs: MatchPair[], includeWeak: boolean, dateStr: string) => string;
};

export default JuryRollCore;
