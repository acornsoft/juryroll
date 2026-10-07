// Federal general elections named in LOGIC-CHANGES A.8, and the state windows
// carried on the rules file.

export const FEDERAL_ELECTIONS = ['2026-11-03', '2028-11-07', '2030-11-05'] as const;

export function localISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function nextFederalElection(today: Date): string {
  const iso = localISO(today);
  for (const day of FEDERAL_ELECTIONS) if (day >= iso) return day;
  return FEDERAL_ELECTIONS[FEDERAL_ELECTIONS.length - 1];
}

export function federalWindow(election: string): { start: string; end: string } {
  return { start: addDays(election, -90), end: election };
}

export function inRange(today: string, start: string, end: string): boolean {
  return today >= start && today <= end;
}

export type ShownWindow = { label: string; date: string; effect: string; statute: string; passed: boolean };

export function stateWindowDates(election: string, windows: { days_before_election: number; applies_to: string; effect: string; statute: string }[] | undefined, today: string): ShownWindow[] {
  return (windows ?? []).map((item) => {
    const date = addDays(election, -item.days_before_election);
    return {
      label: item.applies_to,
      date,
      effect: item.effect,
      statute: item.statute,
      passed: today > date,
    };
  });
}
