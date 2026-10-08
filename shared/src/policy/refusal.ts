import { uiGates, type RulesFile } from './gates.ts';
import { stateCopy } from './stateCopy/index.ts';

export const PA_CARRY_LEAD = 'Pennsylvania opens its list of disqualified jurors for public inspection (42 Pa.C.S. 4523(a)). That does not carry over to';

export const REFUSAL_ASK = 'JuryRoll does not load jury records for this state. Ask officials for counts only.';

export const PUBLIC_LIST_TAIL = "public jury lists name people picked for jury service. They do not show who was excused or why.";

const PUBLIC_LIST_STATES = new Set(['CO', 'MA', 'MS', 'DC', 'MT', 'MO', 'VT', 'ND', 'DE', 'ID']);

const NO_OPENING_LAW = new Set(['TN', 'CA', 'GA', 'KY', 'LA', 'KS', 'IN', 'AR', 'NV', 'IL']);

/** Line 2, byte for byte from REQ-39. States with no row use the ask line. */
const LAW_LINE: Record<string, string> = {
  TX: "Texas law says the jury list sent to voter registrars may not be used for any purpose other than those the law names (Gov't Code 62.113(c)). A violation is a Class C misdemeanor (62.113(d)).",
  OH: 'No Ohio statute creates a list of jurors excused as non-citizens.',
  FL: "Florida's jury source list holds only citizens of the United States (Fla. Stat. 40.011(2)). No Florida statute creates a list of jurors excused as non-citizens.",
  AZ: 'Arizona law says the juror list and juror information shall not be released unless specifically required by law or ordered by the court (A.R.S. 21-312).',
  WA: 'Washington law says information given to the court to decide juror qualification may only be used for the term the person is summoned and may not be used for any other purpose (RCW 2.36.072(4)).',
  OK: 'Oklahoma law says names and personal information of prospective and sitting jurors shall not be disclosed to the public outside open court, except upon order of the court (38 O.S. 36(B)).',
  MI: 'Michigan law says the answers to juror qualification questionnaires shall not be disclosed, except that the chief circuit judge may order access (MCL 600.1315).',
  WI: 'Wisconsin law says completed juror qualification forms are confidential and released only upon order of the court upon a showing of good cause (Wis. Stat. 756.04(11)(a)).',
  IA: 'Iowa law makes only the year of birth and the city and zip code of prospective jurors public. Other details named in the law are confidential without a court order (Iowa Code 607A.48(1)).',
  CT: 'Connecticut law says completed juror questionnaires shall not constitute a public record (Conn. Gen. Stat. 51-232(c)(1)). Lawful permanent residents may serve on Connecticut juries (51-217(a)).',
  WV: "No court or Attorney General ruling settles whether West Virginia's lists of drawn names, where the clerk records disqualifications, are open (W. Va. Code 52-1-8(a)).",
  CO: 'Colorado law says completed juror questionnaires are not public records (C.R.S. 13-71-115). No Colorado statute found makes a list of jurors excused as non-citizens public.',
  MA: 'Massachusetts law says completed juror questionnaires shall not constitute a public record (M.G.L. c. 234A, s. 23). No Massachusetts statute found makes a list of jurors disqualified as non-citizens public.',
  MS: 'Mississippi makes public the names of jurors drawn for service (Miss. Code 13-5-32). That list does not show who was excused or why. No Mississippi statute found makes a list of jurors excused as non-citizens public.',
  DC: 'Non-citizens may lawfully vote in D.C. local elections (D.C. Code 1-1001.02(2)(B)). No D.C. Code section found makes a list of jurors found not qualified as non-citizens public.',
  RI: 'Rhode Island law says the jury commissioner\'s record of the investigation of persons drawn shall not be disclosed to any person except by order of a justice of the superior court or the family court (R.I. Gen. Laws 9-9-23).',
  SD: 'South Dakota law says jury selection records are available for inspection upon court order, for the purpose of determining the validity of the selection of any jury (SDCL 16-13-31.1). The jury selection list may not be distributed, sold, or duplicated for any other purpose (16-13-4.1).',
  UT: 'Utah court rules make the name of a prospective juror summoned to court private, and the identity information of prospective jurors on the master and qualified jury lists safeguarded (Utah CJA Rule 4-202.02(4)(Y), (8)(D)).',
  SC: "South Carolina law says the clerk of court keeps a list of jurors excused or disqualified, with the judge's reasons (S.C. Code 14-7-1530). No South Carolina statute found makes that list public.",
  MT: 'Montana makes public an excerpt of the jury list with the name, address, and birth year of all jurors (MCA 3-15-403(2)). That list does not show who was excused or why. No Montana statute found makes a list of jurors excused as non-citizens public.',
  VA: 'Virginia gives a copy of the jury panel only to counsel of record in the case (Va. Code 8.01-353(A)). No Virginia statute found makes a list of jurors excused as non-citizens public.',
  NJ: 'New Jersey court rules say juror source lists, jury qualification questionnaires, and individual juror information shall remain confidential unless the Administrative Director of the Courts orders otherwise (N.J. Court Rule 1:38-5(g)).',
  MD: 'Maryland court rules say a custodian shall deny inspection of a record used by a jury commissioner in the jury selection process, except as the rules or a trial judge allow (Md. Rule 16-913(a)).',
  NE: 'Nebraska law makes it unlawful to disclose the names of persons drawn as jurors, or to let anyone examine that record, except under order of the court (Neb. Rev. Stat. 25-1673).',
  NM: 'New Mexico court rules say completed juror qualification and questionnaire forms shall be kept confidential unless ordered unsealed (Rule 1-047(C) NMRA).',
  AK: 'Alaska court rules say jury lists and qualification questionnaires are for internal court use only (Alaska Administrative Rule 15(j)).',
  MO: 'Missouri makes public the names on the master jury list (RSMo 494.410.4). Names of persons found not qualified are deleted from that list (494.415). No Missouri statute found makes a list of jurors excused as non-citizens public.',
  VT: 'Vermont court rules make public only the names and towns of potential jurors (Vermont Jury Rule 10(a)). Other questionnaire answers are excepted from public access (Rule 4(c)). No Vermont rule found makes a list of jurors excused as non-citizens public.',
  WY: 'No Wyoming statute or court rule found makes a list of jurors excused as non-citizens public. Names of persons not qualified are struck from the jury list (W.S. 1-11-109(c)).',
  ND: 'North Dakota law makes public the names and forms of qualified jurors, unless the court limits them (N.D.C.C. 27-09.1-09(3)). Other jury selection records are not disclosed until the jurors are discharged (27-09.1-12(4)). No North Dakota statute found makes a list of jurors excused as non-citizens public.',
  AL: 'Alabama law says neither the names drawn for jury service nor any list of them shall be disclosed except under the law or a court order (Ala. Code 12-16-59(a)).',
  NY: 'New York law says the record of persons found not qualified or excused, and the reasons, is confidential and shall not be disclosed except to the county jury board or as the appellate division permits (Judiciary Law 509(a)).',
  DE: 'Delaware law says records used in jury selection shall not be disclosed except under the jury plan or for a jury-selection motion (10 Del. C. 4513(b)). Only the names of persons summoned are public (4513(a)).',
  ID: 'Idaho law says jury selection records not made public shall not be disclosed except for a jury-selection motion (Idaho Code 2-213(4)).',
  ME: 'Maine law says the names of prospective jurors and the contents of juror qualification forms are confidential (14 M.R.S. 1254-A(7)).',
  NH: 'New Hampshire law says information in the master jury list is private and confidential (RSA 500-A:1, IV).',
  OR: 'Oregon law says courts may not disclose source lists or jury lists containing names selected from them (ORS 10.215(1)).',
  MN: 'Minnesota court rules say records regarding prospective jurors and the contents of juror qualification questionnaires shall not be disclosed except as the rule provides (Minn. Gen. R. Prac. 814).',
  HI: 'Hawaii law says juror qualification forms shall not be deemed a public record (HRS 612-13(d)).',
};

export function noStrongMatchSentence(stateName: string): string {
  return `${stateName}'s voter file has date of birth, but JuryRoll does not match a ${stateName} jury list. No matches are made.`;
}

export function refusesJuryButHasDob(rules: RulesFile): boolean {
  return !uiGates(rules).allow_jury_list && rules.voter_file.dob_in_public_file === true;
}

export function lawLineFor(state: string, stateName: string): string {
  if (NO_OPENING_LAW.has(state)) return `No ${stateName} statute or court rule found makes a list of jurors excused as non-citizens public.`;
  return LAW_LINE[state] ?? REFUSAL_ASK;
}

export type RefusalBlock = {
  carryOver: string | null;
  lawLine: string | null;
  publicList: string | null;
  useRestriction: string | null;
  extras: readonly string[];
  banners: readonly string[];
  noStrong: string | null;
};

export function refusalBlock(rules: RulesFile, today: string): RefusalBlock {
  const copy = stateCopy(rules.state);
  const banners = copy.banners.filter((banner) => !banner.hideOn || today < banner.hideOn).map((banner) => banner.text);
  const useRestriction = typeof rules.jury_list.use_restriction === 'string' && rules.jury_list.use_restriction.trim()
    ? rules.jury_list.use_restriction
    : null;
  if (uiGates(rules).allow_jury_list) {
    return {
      carryOver: null,
      lawLine: null,
      publicList: null,
      useRestriction: null,
      extras: [],
      banners,
      noStrong: null,
    };
  }
  return {
    carryOver: `${PA_CARRY_LEAD} ${rules.name}.`,
    lawLine: lawLineFor(rules.state, rules.name),
    publicList: PUBLIC_LIST_STATES.has(rules.state) ? `${rules.name}'s ${PUBLIC_LIST_TAIL}` : null,
    useRestriction,
    extras: copy.refusalExtras,
    banners,
    noStrong: refusesJuryButHasDob(rules) ? noStrongMatchSentence(rules.name) : null,
  };
}

export const CSV_CONVERT_MESSAGE = 'Convert it to CSV first. See the guide for your state.';

export function looksFixedWidth(text: string): boolean {
  const line = text.split(/\r?\n/).find((row) => row.trim().length > 0) ?? '';
  return line.length > 200 && !line.includes(',') && !line.includes('\t') && !line.includes('|');
}

export type ShownLine = { id: string; text: string };

function repeats(prior: string, text: string): boolean {
  if (!prior || !text) return false;
  return prior === text || prior.includes(text) || text.includes(prior);
}

/** Verbatim audit-path sentences for the Coming later card. A note already inside the request is kept once. */
export function auditPathCopy(audit: RulesFile['audit_path']): string[] {
  if (!audit) return [];
  const request = audit.what_you_can_request.trim();
  const note = typeof audit.note === 'string' ? audit.note.trim() : '';
  const lines: string[] = [];
  if (request) lines.push(request);
  if (note && !lines.some((line) => repeats(line, note))) lines.push(note);
  return lines;
}

/** REQ-39, REQ-42, and REQ-59 lines for the single Why? disclosure. Lines already in the basis stay out. */
export function checkPageRefusalLines(rules: RulesFile, basis: string, today: string): ShownLine[] {
  if (uiGates(rules).allow_jury_list) return [];
  const block = refusalBlock(rules, today);
  const candidates: ShownLine[] = [];
  if (block.carryOver) candidates.push({ id: 'paCarry', text: block.carryOver });
  if (block.lawLine) candidates.push({ id: 'refusalLaw', text: block.lawLine });
  if (block.publicList) candidates.push({ id: 'publicListHint', text: block.publicList });
  const shown = [basis.trim()];
  const out: ShownLine[] = [];
  for (const item of candidates) {
    const text = item.text.trim();
    if (!text || shown.some((prior) => repeats(prior, text))) continue;
    shown.push(text);
    out.push({ id: item.id, text });
  }
  return out;
}
