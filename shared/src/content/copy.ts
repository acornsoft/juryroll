export const PRIVACY_LEAD = 'All processing occurs in this browser. No data leaves this computer.';
export const PRIVACY_BODY = 'This page has no network connections. It uses no external scripts and sends no data. The page security policy blocks all network requests. You can disconnect from the internet before you load your files.';

export type Caveat = { html: string };

export const CAVEATS: Caveat[] = [
  { html: '<b>A match is a lead. It is not proof</b> that a person is not a citizen.' },
  { html: 'Some people state that they are not citizens to avoid jury duty. Their jury record is then false.' },
  { html: 'Some people become citizens after they complete the jury questionnaire. The jury record can be old.' },
  { html: 'Different people can have the same name and the same date of birth (DOB).' },
  { html: 'Only election officials can verify citizenship. For example, they can use the federal SAVE system (USCIS).' },
  { html: 'Federal law sets a deadline. Under the National Voter Registration Act, 52 U.S.C. 20507(c)(2)(A), a state must complete a <i>systematic</i> removal program not later than 90 days before a federal primary or general election. For the general election on Nov 3, 2026, that date was Aug 5, 2026.' },
  { html: 'A federal court applied this rule to a program that matched records to find non-citizens: <i>Arcia v. Florida Secretary of State</i>, 772 F.3d 1335 (11th Cir. 2014). The court also said that the rule does not stop removals based on individual information.' },
  { html: 'State laws about the use of voter-file data are different in each state. Some states permit use only for election or political purposes. Jury records can also be confidential. Read your state law before you use these files.' },
  { html: '<b>Send referrals to your county board of elections. Do not publish names.</b>' },
];

export const TIER_RULES: { name: string; text: string }[] = [
  { name: 'Strong', text: 'Last name, first name, and full DOB agree.' },
  { name: 'Probable', text: 'Last name, first initial, and full DOB agree. Or: last name, first name, birth year, and street address agree (used only when one file has no full DOB).' },
  { name: 'Weak', text: 'Only last name and first name agree. The DOB is missing or different. Weak matches stay inside Details until you open them. They are never exported.' },
  { name: 'Lower tier', text: 'If both files show a middle initial or a suffix (Jr, Sr, III) and the values are different, the tool moves the match down one tier.' },
  { name: 'Normalization', text: 'The tool ignores case, accents, punctuation, spaces, and hyphens in names. It removes suffixes from name fields. It reads many DOB formats. It does not match nicknames (Bill / William) or spelling errors.' },
];

export const WEAK_CAUTION = 'Caution: weak matches. Only the name agrees. Most weak matches are different people with the same name. Do not refer a weak match without more evidence.';

export const ATTEST_LINES = [
  'I got each file from an official source, and I obey its use rules.',
  'I will send leads only to the offices in the referral list.',
  'I will not publish any name or contact any voter.',
  'I understand a match is not proof. Only officials can verify citizenship.',
  'I will purge the data after I send the referral.',
];

export const APP_VERSION = '2.0.0';
