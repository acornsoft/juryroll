# JuryRoll: what you can do with a lead

Version 1.0.0. Verified on 2026-10-07. Written in simplified technical English (ASD-STE100 style).

This guide is for a private citizen. It is not legal advice. Each state has different rules.
Read the rules file for your state before you do anything. The files are in `rules/`.
If your state has no file, the app uses `rules/default.json`. That file has the strictest rules.

## 1. What a lead is

A lead is a possible match between two records.
One record is a jury disqualification for non-citizenship. The other record is a voter registration.
A lead is not proof. Only election officials can verify citizenship.
Officials use federal and state records, for example the SAVE system. You cannot use SAVE.

A lead can be wrong for these reasons:

- Two different persons can have the same name and date of birth.
- Some persons say "not a citizen" only to stop jury duty.
- Some persons become citizens after they fill in the jury form.
- A clerk can enter data incorrectly.

Real cases are rare. Georgia's 2024 audit found 20 non-citizens among 8.2 million registrants.
Thus, most leads are not real cases.

Some matches are not leads. The voter registered after the date of the jury form.
That person possibly became a citizen before registration. The app does not show these matches.
It shows only a count: "N matches excluded: registered after declaration".

Sometimes the app cannot compare the two dates. Some voter files have no registration date.
Some jury records have no date.
Sometimes the two dates are the same. The app never puts these matches in a named referral.
It does not hide them. It counts them next to the first count: "N matches cannot compare: no registration date".

## 2. Before you start

1. Find your state in `rules/`. Read the `gates` and `notes` fields.
2. Get each file only from an official source. Obey the use rules of that source.
3. Do not use DMV records, data broker files, or Social Security numbers. The app blocks them.
4. Sign the use statement in the app. The app records it in a log on your computer.

If the jury list is confidential in your state, do not try to get it.
In that state, the app does not load a jury list. It gives only counts.

## 3. What you CAN do

### 3.1 Refer the lead to officials

This is the recommended action in every state.

1. Export the referral file from the app.
2. Send it only to one or more of these offices:
   - the county board of elections or voter registrar,
   - the state election office,
   - the state attorney general.
3. Use the URLs in `referral_targets` in your state file.
4. Keep the message short. Say where each record came from. Ask the officials to verify.
5. After you send the referral, click "Purge". This deletes the data from the app.

Do not send the referral to any other person or group.

### 3.2 Refer a question about the process (all states)

In a "counts only" state, you can still help.
Send the counts to the state election office. Ask how the office uses jury records.
Do not include names.

### 3.3 File a sworn challenge for one voter (only some states)

Do this only if all of these conditions are true:

- Your state file has `private_challenge.allowed` set to `true`.
- Your state file has `gates.show_challenge_guidance` set to `true`.
- You are eligible to file. Read the `who` field.
- You file before the deadline. Read the `deadlines` field.
- You have evidence that meets the `evidence_standard` field.

A match from JuryRoll alone is usually not enough evidence.
In Texas, the law requires personal knowledge. A match is not personal knowledge.
In North Carolina, the law requires "affirmative proof". A match alone does not give that proof. JuryRoll does not show challenge steps for North Carolina. Refer the lead.

If you file, obey these rules:

- Use one affidavit for one voter.
- Use the official form of your state.
- Tell the truth about your source. Write that the lead came from a jury record and a software match.
- Do not write that you have personal knowledge if you do not have it.
- A false affidavit is a crime in many states. In North Carolina, it is a felony.

## 4. What you CANNOT do

- Do not contact a voter from a lead. Do not call, write, message, or visit.
- Do not publish names, addresses, or any part of a lead. This includes social media and websites.
- Do not give leads to the press, a campaign, or a group.
- Do not file bulk challenges in the 90 days before a federal election.
- Do not act on a "name only" match. The app does not export these matches.
- Do not misstate the source of your information on an affidavit.
- Do not keep the data after you send the referral.

### 4.1 Why these rules exist

- A group published names of alleged non-citizen voters. This caused a federal lawsuit (LULAC v. PILF, E.D. Va.).
- In the 2019 settlement, the group apologized. It acknowledged that named persons were citizens.
- Federal law forbids intimidation of voters. This law applies to private persons (52 U.S.C. 10307(b)).
- Federal law stops systematic removals in the 90 days before a federal election (52 U.S.C. 20507(c)(2)(A)).
- One federal court required an individual review of each voter for mass challenges in that window.
- Another federal court called a mass challenge list "utterly lacking reliability".

## 5. The 90-day window

The federal window starts 90 days before each federal election.
For the November 3, 2026 election, the window started on August 5, 2026.
In the window, refer leads to officials. Do not file bulk challenges.
Officials decide when they can act.

Some states have more time limits. Examples from the rules files:

| State | Rule | Source field |
|---|---|---|
| NC | No challenge after the 25th day before an election | `blackout.state_windows` |
| GA | A challenge within 45 days of an election waits until certification | `blackout.state_windows` |
| PA | A petition to strike a name closes 10 days before an election | `blackout.state_windows` |
| TX | Residence challenges: no notice after day 75 before the November election | `blackout.state_windows` |
| NM | A 120-day window. The app adds 30 days before the federal window | `blackout.state_extra_days` |

New Mexico is the only state with a window longer than 90 days.

## 6. State summary (researched states)

Read the full file for each state. This table is a summary only.

| State | Jury list available to you | Private challenge in law | App mode |
|---|---|---|---|
| NY | No (Judiciary Law 509(a)) | Yes, one voter per affidavit (Election Law 5-220) | Counts only |
| NC | Yes, the State Board list (G.S. 9-6.2(b)). The posted list has no date of birth | Yes (G.S. 163-85). The app does not show challenge guidance | Named referral. Without a date of birth, matches stay Weak and are not exported |
| GA | Not known, so the app treats it as no | Yes (O.C.G.A. 21-2-229, 21-2-230) | Counts only |
| TX | No (Gov't Code 62.0132, 62.113) | Yes, but personal knowledge is necessary (Elec. Code 16.092) | Counts only |
| PA | Yes, the county list of disqualified jurors (42 Pa.C.S. 4523(a)) | Yes (25 Pa.C.S. 1329). The app does not show challenge guidance | Named referral. A names-only list stays Weak and is not exported |
| AZ | No (A.R.S. 21-312) | Only at the polls (A.R.S. 16-591); not supported | Counts only |
| FL | Not known, so the app treats it as no | Yes, at one election only (Fla. Stat. 101.111) | Counts only |
| MI | No (MCL 600.1315) | Yes (MCL 168.512) | Counts only |
| WI | No (Wis. Stat. 756.04(11)) | Yes (Wis. Stat. 6.48) | Counts only |
| VA | Not known, so the app treats it as no | Yes, three voters petition the court (Va. Code 24.2-431) | Counts only. You cannot get the voter list (24.2-405) |
| OH | Not known, so the app treats it as no | Yes, until day 30 (R.C. 3503.24) | Counts only |
| IN | Not known, so the app treats it as no | Only at the polls (IC 3-11-8); not supported | Counts only |
| IA | No (Iowa Code 607A.48) | Yes, one voter per challenge (Iowa Code 48A.14) | Counts only |
| KS | Not known, so the app treats it as no | No private challenge found | Counts only |
| KY | Not known, so the app treats it as no | Only at the polls (KRS 117.245); not supported | Counts only |
| LA | Not known, so the app treats it as no | Only at the polls (R.S. 18:565); not supported | Counts only |
| TN | Not known, so the app treats it as no | Only at the polls (T.C.A. 2-7-123); not supported | Counts only |
| AR | Not known, so the app treats it as no | Only at the polls (Ark. Code 7-5-312); not supported | Counts only |
| CT | No (Conn. Gen. Stat. 51-232(c)). Permanent residents can be jurors | Only at the polls; citizenship is not a ground (9-232) | Counts only |
| OK | Not known, so the app treats it as no | No private challenge found | Counts only |
| SD | Not known, so the app treats it as no | Yes, until day 90, with personal checks (SDCL 12-4-59, 12-4-60) | Counts only |
| UT | Not known, so the app treats it as no | Yes, until day 45, with personal checks (Utah Code 20A-3a-804) | Counts only. Voter list use is limited (20A-2-607) |
| CO | Not known, so the app treats it as no | Yes, until day 60 (C.R.S. 1-9-101) | Counts only |
| ID | No (Idaho Code 2-213(4), 2-208) | Only on election day (34-431); not supported | Counts only |
| MT | Not known, so the app treats it as no | Yes, at any time, with an affidavit and evidence (MCA 13-13-301) | Counts only |
| NE | Not known, so the app treats it as no | Only at the polls (Neb. Rev. Stat. 32-926); not supported | Counts only. Voter list use is limited under oath (32-330) |
| NH | No (RSA 500-A:1, 500-A:2) | Only at the polls (RSA 659:27-a); not supported | Counts only |
| WA | No (RCW 2.36.072(4)) | Yes, until day 45, with firsthand knowledge only (RCW 29A.08.810, 29A.08.820) | Counts only |
| WV | No (W. Va. Code 52-1-5a(e)) | Yes, in person at the county clerk (3-2-28) | Counts only |
| AL | No (Ala. Code 12-16-59(a)) | No private challenge found | Counts only |
| DE | No (10 Del. C. 4513(b)) | No direct private challenge found | Counts only |
| MA | Not known, so the app treats it as no | Yes, sworn complaint to registrars, 14 days ahead in cities (M.G.L. c. 51, sec. 48) | Counts only. Statewide voter registry is not public (c. 51, sec. 47C) |
| NJ | Not known, so the app treats it as no | Only at the polls (N.J.S.A. 19:15-20); not supported | Counts only |
| NM | Not known, so the app treats it as no | No private challenge (NMSA 1-12-20, 1-4-22) | Counts only. 30 extra blackout days. Voter data use is limited (1-4-5.5) |
| RI | Not known, so the app treats it as no | Yes, 20 days ahead, on personal knowledge (R.I. Gen. Laws 17-9.1-28) | Counts only |
| VT | Not known, so the app treats it as no | Only at the polls, and not on citizenship (17 V.S.A. 2564) | Counts only |
| WY | Not known, so the app treats it as no | No private challenge found (W.S. 22-3-105) | Counts only |
| AK | Not known, so the app treats it as no | Only at the polls (AS 15.15.210); not supported | Counts only. Birth dates are not public (AS 15.07.195) |
| CA | Not known, so the app treats it as no | No. Private challenges are banned (Elec. Code 14240(b)) | Counts only. Voter data use is limited (2188, 2194) |
| DC | Not known, so the app treats it as no | Yes, until day 45 (D.C. Code 1-1001.07), but see the note | Counts only. Non-citizens may vote in D.C. local elections (1-1001.02(2)(B)), so a match is not a lead |
| HI | No (HRS 612-13(a)) | Yes, in writing to the county clerk (HRS 11-25) | Counts only. Voter data is mostly confidential (HRS 11-97) |
| IL | Not known, so the app treats it as no | Yes, on two set days about 14 days ahead, on personal knowledge (10 ILCS 5/4-12) | Counts only. Private persons cannot get voter data (5/4-8) |
| ME | No (14 M.R.S. 1254-A(1)) | Only at the polls (21-A M.R.S. 673); not supported | Counts only. Voter data is confidential (196-A) |
| MD | Not known, so the app treats it as no | No direct private challenge found (Elec. Law 3-602) | Counts only. Voter lists are for electoral uses only (3-506) |
| MN | No (Minn. Gen. R. Prac. 814) | Yes, until day 45, on personal knowledge (Minn. Stat. 201.195) | Counts only. Voter list use is limited (201.091) |
| MS | Not known, so the app treats it as no | Yes, appeal to county commissioners (Miss. Code 23-15-63) | Counts only |
| MO | Not known, so the app treats it as no | No private challenge; tell the election authority (RSMo 115.191) | Counts only |
| NV | Not known, so the app treats it as no | Yes, citizenship affidavit until day 30, on personal knowledge (NRS 293.535) | Counts only |
| ND | Not known, so the app treats it as no | None found | Counts only. No voter registration; private users cannot get the file (16.1-02-15) |
| OR | No (ORS 10.215) | No; the county clerk inquires (ORS 247.195) | Counts only. No commercial use of voter lists (247.955) |
| SC | Not known, so the app treats it as no | Yes, written challenge to the county board (S.C. Code 7-5-230) | Counts only |

Pennsylvania county lists usually hold only names and reasons. Without a date of birth or address, matches stay Weak and are not exported, so you will mostly see counts. Leads go to the county board of elections, the Department of State, or the Attorney General.

The North Carolina State Board's posted list has no date of birth, so matches stay Weak and you will mostly see counts. Leads go to the county board of elections, the State Board of Elections, or the Attorney General.

## 7. When a field is null

A null value means "not known". The app then uses the strictest rule.
Do not guess the rule. Ask your county board of elections.
