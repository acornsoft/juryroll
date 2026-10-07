const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;
const PLAIN_NUMBER_RE = /^-?\d+(\.\d+)?$/;

export function isPlainNumber(value: string): boolean {
  return PLAIN_NUMBER_RE.test(value);
}

export function hasFormulaPrefix(value: string): boolean {
  return FORMULA_PREFIX_RE.test(value);
}

/** Prefix a formula cell so a spreadsheet treats it as text. A plain number stays as written. */
export function neutralizeFormulaCell(value: string): string {
  if (isPlainNumber(value)) return value;
  if (hasFormulaPrefix(value)) return `'${value}`;
  return value;
}
