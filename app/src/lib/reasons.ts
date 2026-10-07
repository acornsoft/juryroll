import core from '../../../shared/src/core.js';

export const REASON_CATEGORIES = ['Non-citizen', 'Language', 'Non-resident', 'Other'] as const;

export type ReasonCategory = (typeof REASON_CATEGORIES)[number];

export type ReasonChoice = ReasonCategory | '';

export type ReasonMap = Record<string, ReasonChoice>;

export type ReasonTallies = {
  entered: number;
  nonCitizen: number;
  language: number;
  nonResident: number;
  other: number;
  unmapped: number;
};

export const PA_PRESET_CODE = '47';

export const PA_PRESET_LABEL = 'PA preset: code 47 = Non-citizen';

export const PA_PRESET_NOTE = 'Reported by volunteers for Bucks County. Confirm this code for the county before you rely on it.';

export function parseChoice(value: string): ReasonChoice {
  switch (value) {
    case 'Non-citizen':
    case 'Language':
    case 'Non-resident':
    case 'Other':
    case '':
      return value;
    default:
      return '';
  }
}

export function defaultChoice(value: string, autoNonCitizen = core.NONCITIZEN_RE.test(value)): ReasonChoice {
  return autoNonCitizen ? 'Non-citizen' : '';
}

export function mapFromReasons(reasons: readonly { value: string; auto: boolean }[]): ReasonMap {
  const map: ReasonMap = {};
  for (const reason of reasons) map[reason.value] = defaultChoice(reason.value, reason.auto);
  return map;
}

export function applyPaPreset(map: ReasonMap): ReasonMap {
  return { ...map, [PA_PRESET_CODE]: 'Non-citizen' };
}

export function countsAsNonCitizen(choice: ReasonChoice): boolean {
  switch (choice) {
    case 'Non-citizen':
      return true;
    case 'Language':
    case 'Non-resident':
    case 'Other':
    case '':
      return false;
    default: {
      const neverChoice: never = choice;
      return neverChoice;
    }
  }
}

export function filterFromMap(map: ReasonMap): Record<string, boolean> {
  const filter: Record<string, boolean> = {};
  for (const [code, choice] of Object.entries(map)) filter[code] = countsAsNonCitizen(choice);
  return filter;
}

export function tallyReasons(values: readonly string[], map: ReasonMap): ReasonTallies {
  const tallies: ReasonTallies = { entered: 0, nonCitizen: 0, language: 0, nonResident: 0, other: 0, unmapped: 0 };
  for (const raw of values) {
    tallies.entered += 1;
    const choice = map[raw.trim()] ?? '';
    switch (choice) {
      case 'Non-citizen':
        tallies.nonCitizen += 1;
        break;
      case 'Language':
        tallies.language += 1;
        break;
      case 'Non-resident':
        tallies.nonResident += 1;
        break;
      case 'Other':
        tallies.other += 1;
        break;
      case '':
        tallies.unmapped += 1;
        break;
      default: {
        const neverChoice: never = choice;
        throw new Error(`Unknown reason choice ${String(neverChoice)}`);
      }
    }
  }
  return tallies;
}

export function reasonCells(text: string, delim: string, hasHeader: boolean, reasonIndex: number, rowCount: number): string[] {
  if (reasonIndex < 0) return Array.from({ length: rowCount }, () => '');
  const values: string[] = [];
  let first = true;
  core.iterCSV(text, delim, (row) => {
    if (first && hasHeader) {
      first = false;
      return;
    }
    first = false;
    values.push((row[reasonIndex] ?? '').trim());
  });
  return values;
}
