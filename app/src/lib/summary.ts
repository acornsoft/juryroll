export const SUMMARY_DISCLAIMER = 'Matches are leads for official verification. They are not proof.';

export type CountyRun = {
  stateCode: string;
  stateName: string;
  countyName: string;
  countyFips: string;
  entered: number;
  nonCitizen: number;
  language: number;
  nonResident: number;
  strong: number;
  probable: number;
  weak: number;
  excluded: number;
  cannotCompare: number;
};

export function summaryLine(row: CountyRun): string {
  const matches = row.strong + row.probable + row.weak;
  return `${row.countyName}, ${row.stateName}: ${row.entered} non-juror records entered, ${row.nonCitizen} coded non-citizen, ${matches} potential matches on the voter roll (Strong ${row.strong} / Probable ${row.probable} / Weak ${row.weak}), ${row.excluded} excluded, ${row.cannotCompare} cannot compare. Language ${row.language} excluded. Non-resident ${row.nonResident} excluded.`;
}

export function summaryCopy(rows: readonly CountyRun[]): string {
  return [...rows.map((row) => summaryLine(row)), SUMMARY_DISCLAIMER].join('\n');
}

/** One row per county. A later run for the same county replaces that row. */
export function upsertCountyRun(rows: readonly CountyRun[], next: CountyRun): CountyRun[] {
  const index = rows.findIndex((row) => row.stateCode === next.stateCode && row.countyFips === next.countyFips);
  if (index < 0) return [...rows, next];
  const copy = rows.slice();
  copy[index] = next;
  return copy;
}
