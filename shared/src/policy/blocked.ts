// Refuse DMV, data-broker, and SSN files. LOGIC-CHANGES section F.
// Header normalization matches v1 normHeader: lowercase, drop non-alphanumerics.

export function normHeader(header: string): string {
  return String(header).toLowerCase().replace(/[^a-z0-9]/g, '');
}

const SSN_HEADERS = ['ssn', 'socialsecurity', 'socsec', 'ssn4', 'last4ssn', 'ssnlast4', 'taxid', 'itin', 'tin'];
const DMV_HEADERS = ['driverslicense', 'driverlicense', 'dlnumber', 'dlnum', 'dlno', 'licensenumber', 'dmv', 'mvr', 'stateidnumber', 'idcardnumber', 'permitnumber', 'driverslic'];
const BROKER_CONTAINS = ['experian', 'acxiom', 'equifax', 'transunion', 'infutor', 'lexisnexis', 'accurint', 'tlo', 'targetsmart', 'catalist', 'creditscore', 'householdincome', 'networth', 'modeled', 'consumerid', 'phoneappend', 'emailappend'];

const SSN_VALUE = /^\d{3}-?\d{2}-?\d{4}$/;
const FLAG_VALUE = /^(y|n|t|f|0|1)$/i;

export type BlockResult =
  | { ok: true; dropColumns: number[]; note: string | null }
  | { ok: false; headers: string[]; reason: 'blocked_header' };

function headerClass(normalized: string): 'ssn' | 'dmv' | 'broker' | null {
  if (SSN_HEADERS.includes(normalized)) return 'ssn';
  if (DMV_HEADERS.includes(normalized)) return 'dmv';
  if (normalized === 'l2') return 'broker';
  if (BROKER_CONTAINS.some((pat) => normalized.includes(pat))) return 'broker';
  return null;
}

export function screenColumns(headers: string[], rows: string[][]): BlockResult {
  const dropColumns: number[] = [];
  const refused: string[] = [];
  let note: string | null = null;

  headers.forEach((header, index) => {
    const kind = headerClass(normHeader(header));
    if (!kind) return;
    const values = rows.slice(0, 500).map((row) => (row[index] ?? '').trim());
    if (kind === 'dmv') {
      const nonBlank = values.filter((value) => value !== '');
      const flagsOnly = nonBlank.every((value) => FLAG_VALUE.test(value));
      if (flagsOnly) {
        dropColumns.push(index);
        note = `The column "${header}" looks like an official yes/no flag. JuryRoll dropped that column and kept the rest of the file.`;
        return;
      }
      refused.push(header);
      return;
    }
    refused.push(header);
  });

  if (refused.length) return { ok: false, headers: refused, reason: 'blocked_header' };

  headers.forEach((header, index) => {
    if (dropColumns.includes(index)) return;
    const values = rows.slice(0, 500).map((row) => (row[index] ?? '').trim()).filter((value) => value !== '');
    if (!values.length) return;
    const hits = values.filter((value) => SSN_VALUE.test(value)).length;
    if (hits / values.length > 0.01) refused.push(header);
  });

  if (refused.length) return { ok: false, headers: refused, reason: 'blocked_header' };
  return { ok: true, dropColumns, note };
}
