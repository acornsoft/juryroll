// Append-only audit log while a session is open. A manual purge, the purge
// after export, and the inactivity purge clear the stored entries. Closing
// the page purges voter data and leaves the log in place.

import { sha256HexSync } from './sha256.ts';

export const APP_VERSION = '2.0.0';
export const ZERO_HASH = '0'.repeat(64);

export type AuditType =
  | 'session_start'
  | 'rules_loaded'
  | 'attestation_signed'
  | 'file_loaded'
  | 'file_refused'
  | 'mapping_set'
  | 'match_run'
  | 'export'
  | 'audit_letter_exported'
  | 'purge'
  | 'log_chain_break';

export type AuditEntry = {
  seq: number;
  ts: string;
  app_version: string;
  type: AuditType;
  data: Record<string, unknown>;
  prev_hash: string;
  hash: string;
};

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
}

export function sealEntry(prevHash: string, draft: Omit<AuditEntry, 'hash' | 'prev_hash'> & { prev_hash?: string }): AuditEntry {
  const prev = prevHash || ZERO_HASH;
  const body = {
    seq: draft.seq,
    ts: draft.ts,
    app_version: draft.app_version,
    type: draft.type,
    data: draft.data,
    prev_hash: prev,
  };
  const hash = sha256HexSync(prev + canonicalJson(body));
  return { ...body, hash };
}

export function verifyChain(entries: readonly AuditEntry[]): { ok: true } | { ok: false; seq: number } {
  let prev = ZERO_HASH;
  for (const entry of entries) {
    const expected = sealEntry(prev, entry);
    if (expected.hash !== entry.hash || entry.prev_hash !== prev) return { ok: false, seq: entry.seq };
    prev = entry.hash;
  }
  return { ok: true };
}

export function appendEntry(log: readonly AuditEntry[], type: AuditType, data: Record<string, unknown>, now = new Date()): AuditEntry[] {
  const prev = log.length ? log[log.length - 1].hash : ZERO_HASH;
  const entry = sealEntry(prev, {
    seq: log.length + 1,
    ts: now.toISOString(),
    app_version: APP_VERSION,
    type,
    data,
  });
  return Object.freeze([...log, Object.freeze(entry)]) as AuditEntry[];
}

export function userAgentFamily(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
}
