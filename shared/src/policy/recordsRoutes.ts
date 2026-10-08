// Per-state list-maintenance records route.
// Legal wording is copied from OTHER-PATHS (Optimus-approved 2026-10-07).

/** 52 U.S.C. 20503(b), quoted in OTHER-PATHS. */
export const USC_20503_B = 'This chapter does not apply to a State described in either or both of the following paragraphs: (1) A State in which, under law that is in effect continuously on and after August 1, 1994, there is no voter registration requirement for any voter in the State with respect to an election for Federal office. (2) A State in which, under law that is in effect continuously on and after August 1, 1994, or that was enacted on or prior to August 1, 1994, and by its terms is to come into effect upon the enactment of this chapter, so long as that law remains in effect, all voters in the State may register to vote at the polling place at the time of voting in a general election for Federal office.';

export const USC_20503_B_CITE = '52 U.S.C. 20503(b) (https://www.law.cornell.edu/uscode/text/52/20503, verified 2026-10-07)';

export const USC_20507_I = '52 U.S.C. 20507(i) requires states to keep records of list-maintenance programs for 2 years and make them available for public inspection.';

export const NVRA_EXEMPT_SENTENCE = 'ID, MN, NH, ND, WI and WY are exempt from the NVRA, so 20507(i) doesn\'t apply there.';

export const EXEMPT_APPLICATION = 'The statute does not name states. The six-state list (ND under paragraph (1); ID, MN, NH, WI and WY under paragraph (2)) is the accepted application.';

export const COUNTS_ONLY_LIMIT = 'Ask for counts and outcomes only.';

export const FEDERAL_REQUIREMENT = 'federal law requires a "reasonable effort" program to remove voters for death and change of residence (20507(a)(4)), plus removal of inactive voters only after a notice and two federal general elections with no response or vote (20507(d)). The NCOA (Postal Service change-of-address) process is an optional safe harbor (20507(c)(1)), not a requirement. The audit should ask whether the program runs and for its counts, not whether NCOA is used.';

export const RESIDENTS_ONLY_NOTE = 'some state records laws cover state residents only (TN 10-7-503, AR, KY 61.872(1)). The federal 20507(i) request has no residency limit where the NVRA applies.';

export const STATE_RECORDS_ROUTE = 'Use the state records route instead.';

/** ND under 20503(b)(1). ID, MN, NH, WI, and WY under 20503(b)(2). */
export const NVRA_EXEMPT_PARAGRAPH: Readonly<Record<string, '1' | '2'>> = {
  ND: '1',
  ID: '2',
  MN: '2',
  NH: '2',
  WI: '2',
  WY: '2',
};

/** State records laws that cover residents only. Cites are the OTHER-PATHS text. */
export const RESIDENTS_ONLY_CITE: Readonly<Record<string, string>> = {
  TN: 'TN 10-7-503',
  AR: 'AR',
  KY: 'KY 61.872(1)',
};

export type RecordsRouteKind = 'nvra' | 'state-public-records';

export type RecordsRoute = {
  state: string;
  kind: RecordsRouteKind;
  exemptParagraph: '1' | '2' | null;
  residentsOnlyCite: string | null;
};

export function recordsRouteFor(state: string): RecordsRoute {
  const exemptParagraph = NVRA_EXEMPT_PARAGRAPH[state] ?? null;
  return {
    state,
    kind: exemptParagraph ? 'state-public-records' : 'nvra',
    exemptParagraph,
    residentsOnlyCite: RESIDENTS_ONLY_CITE[state] ?? null,
  };
}
