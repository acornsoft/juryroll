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
In North Carolina, the law requires "affirmative proof". A match alone does not give that proof.

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

## 6. State summary (first five states)

Read the full file for each state. This table is a summary only.

| State | Jury list available to you | Private challenge in law | App mode |
|---|---|---|---|
| NY | No (Judiciary Law 509(a)) | Yes, one voter per affidavit (Election Law 5-220) | Counts only |
| NC | Yes, the State Board list (G.S. 9-6.2(b)) | Yes, one voter per challenge (G.S. 163-85) | Named referral |
| GA | Not known, so the app treats it as no | Yes (O.C.G.A. 21-2-229, 21-2-230) | Counts only |
| TX | No (Gov't Code 62.0132, 62.113) | Yes, but personal knowledge is necessary (Elec. Code 16.092) | Counts only |
| PA | No (Pa.R.Crim.P. 625) | Yes (25 Pa.C.S. 1329) | Counts only |

## 7. When a field is null

A null value means "not known". The app then uses the strictest rule.
Do not guess the rule. Ask your county board of elections.
