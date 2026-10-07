# JuryRoll rules - research progress

One section per batch. Verified on 2026-10-07. Primary sources only; null means unknown and the strict default applies.

Batch 1 (NY, NC, GA, TX, PA) was delivered before this file existed. Effective gates: NC named referral; NY, GA, TX, PA counts only.

## Batch 2 - AZ, FL, MI, WI, VA, OH (validated: ALL PASS)

| State | Jury list public | Private challenge | Extra blackout | Effective mode |
|---|---|---|---|---|
| AZ | false (A.R.S. 21-312) | null (polls only, 16-591) | 0 | counts only |
| FL | null | true (101.111, one election, not before day 30) | 0 | counts only |
| MI | false (MCL 600.1315) | true (MCL 168.512) | 0 | counts only |
| WI | false (Wis. Stat. 756.04(11)(a)) | true (6.48) | 0 | counts only |
| VA | null | true (24.2-431, 3 voters, circuit court) | 0 | counts only |
| OH | null | true (3503.24, cutoff day 30) | 0 (30-day window recorded) | counts only |

Key points:
- AZ has a statutory jury-to-recorder pipeline (21-314(F), 16-165(A)(10)). Posting voter data online is a class 6 felony (16-168(F)).
- VA voter lists cannot be given to a private person (24.2-405). Acts 2026 c. 1064 repealed 24.2-432 and 24.2-651.
- FL and OH public voter files include full DOB and registration date. MI and WI do not include DOB.
- Main nulls: jury_list.public for FL, VA, OH; official_pipeline for MI, WI, VA (jury), OH (jury); registration_date for MI, WI, VA.
- Steering items applied in this batch window: naturalization EXCLUDE rule, GA sources, NC consent judgment removed, hostname juryroll.doge.reviews.

## Batch 3 - IN, IA, KS, KY, LA, TN (validated: ALL PASS)

| State | Jury list public | Private challenge | Extra blackout | Effective mode |
|---|---|---|---|---|
| IN | null (IC 33-28-5-13(d): only master-list names public) | null (polls only) | 0 | counts only |
| IA | false (607A.48) | true (48A.14; 70-day hold) | 0 (70-day window recorded) | counts only |
| KS | null | null (none found) | 0 | counts only |
| KY | null | null (polls only) | 0 | counts only |
| LA | null | null (polls only; 18:193(B) repealed 2024) | 0 | counts only |
| TN | null | null (polls only) | 0 | counts only |

Key points:
- Official jury-to-election pipelines exist in KS (43-174), KY (30A.145, monthly, removal in 5 days), LA (18:178, monthly), TN (2-2-113, federal courts), IN (3-7-38.2-16, federal courts).
- IN gives private requesters a list without DOB or registration date; the EXCLUDE rule then excludes every IN match ("dates not comparable").
- KY voter lists go to candidates/parties/committees; others only at the Board's discretion.
- TN text read from the Justia copy of the 2025 code (official code is on a commercial host).
- Main nulls: jury_list.public for IN, KS, KY, LA, TN; DOB/registration-date fields for IA, KS, KY, TN.

## Batch 4 - AR, CT, OK, SD, UT, CO (validated: ALL PASS)

| State | Jury list public | Private challenge | Extra blackout | Effective mode |
|---|---|---|---|---|
| AR | null | null (poll watchers only) | 0 | counts only |
| CT | false (51-232(c)(1)); LPRs may serve (51-217) | null (polls; no citizenship ground) | 0 | counts only |
| OK | null | null (none found) | 0 | counts only |
| SD | null | true (12-4-59 citizenship ground since 2026; day-90 cutoff) | 0 (90-day window recorded) | counts only |
| UT | null | true (20A-3a-804; day-45 cutoff; perjury affidavit) | 0 (45-day window recorded) | counts only |
| CO | null | true (1-9-101; day-60 cutoff) | 0 (60-day window recorded) | counts only |

Key points:
- Official jury pipelines: AR (amend. 51 sec. 11(e), Act 290 of 2019), OK (26 O.S. 4-120.5, monthly, referral to DA and U.S. attorney).
- CT jurors can be lawful permanent residents: CT jury data is not a non-citizen signal.
- UT (2026) limits voter-list use to political or expressly permitted purposes; posting is a class A misdemeanor.
- SD and UT challenge laws demand personal verification and documents; a JuryRoll match alone does not meet them.
- Source notes: AR code and TN code via Justia 2025; CO via OLLS 2025 CRS HTML; CT and UT official sites read without TLS validation (certificate errors).

## Batch 5 - ID, MT, NE, NH, WA, WV (validated: ALL PASS)

| State | Jury list public | Private challenge | Extra blackout | Effective mode |
|---|---|---|---|---|
| ID | false (2-213(4), 2-208(1),(7)) | null (election-day register entry only, 34-431) | 0 | counts only |
| MT | null (3-15-403 public excerpt lists jurors, not disqualifications) | true (13-13-301; any time; affidavit + evidence) | 0 | counts only |
| NE | null | null (polls only, 32-926/32-928) | 0 | counts only |
| NH | false (500-A:1 IV, 500-A:2) | null (polls only, 659:27-a) | 0 | counts only |
| WA | false (2.36.072(4)) | true (29A.08.810; day-45 cutoff; firsthand knowledge) | 0 (45-day window recorded) | counts only |
| WV | false (52-1-5a(e)) | true (3-2-28; in person; 30-day notice then cancel) | 0 | counts only |

Key points:
- No jury-to-registrar non-citizen pipeline found in any batch 5 state. NH 500-A:2 (2025) reports voter-list data errors to the SoS; scope unclear, left null.
- Voter-list use limits: NE oath (Class IV felony for false oath; election/political/registration/law-enforcement/jury uses only; no internet posting); WA and ID no commercial solicitation; MT and WV noncommercial only; NH no commercial use.
- WA challenge law bars third-party allegations and requires firsthand knowledge: juryroll_lead_sufficient = false.
- WV cancels on non-appearance within 30 days: high harm risk from wrong challenges.
- Source notes: NH SoS/DOJ pages checked in a browser (plain HTTP clients refused).

## Batch 6 - AL, DE, MA, NJ, NM, RI, VT, WY (validated: ALL PASS)

| State | Jury list public | Private challenge | Extra blackout | Effective mode |
|---|---|---|---|---|
| AL | false (12-16-59(a)) | null (none; inspector at polls only) | 0 | counts only |
| DE | false (10 Del. C. 4513(b)) | null (State Board removal 1702; appeal 2101) | 0 | counts only |
| MA | null (questionnaire confidential but has no citizenship item) | true (c. 51 sec. 48; 14 days city / 4 days town) | 0 (14-day window recorded) | counts only |
| NJ | null (R. 1:38-5(g) official text not retrieved) | null (polls only) | 0 | counts only |
| NM | null | null (only SoS may petition, 1-4-22) | 30 (120-day window on SoS petitions) | counts only |
| RI | null | true (17-9.1-28; 20-day filing; personal knowledge; misdemeanor for malicious challenge) | 0 (90 and 20-day windows recorded) | counts only |
| VT | null | null (polls only; identity or double voting) | 0 (90-day systematic window recorded) | counts only |
| WY | null | null (clerk investigates, 22-3-105) | 0 | counts only |

Key points:
- First state with extra blackout days: NM (state_extra_days = 30).
- Duplication: AL AVID checks the voter list against USCIS data (17-4-39(b)).
- Use limits: NM affidavit + fourth degree felony (incl. internet posting); MA statewide registry not public; NJ no commercial or charitable solicitation (disorderly person).
- Source notes: AL, NM, WY read from Justia 2025 copies (official sites script-only or PDF); NJ election law from nj.gov Division of Elections statute pages; MA AG page checked in a browser.
- voter_file left all null for RI and WY (not researched this batch).

## Batch 7 - AK, CA, DC, HI, IL, ME, MD (validated: ALL PASS)

| State | Jury list public | Private challenge | Extra blackout | Effective mode |
|---|---|---|---|---|
| AK | null | null (polls only, AS 15.15.210) | 0 | counts only |
| CA | null | false (Elec. Code 14240(b) bars private challenges) | 0 | counts only |
| DC | null | true (1-1001.07; closes day 45) but lead never sufficient | 0 (45-day window recorded) | counts only |
| HI | false (HRS 612-13(a)) | true (HRS 11-25; written, to county clerk) | 0 | counts only |
| IL | null | true (10 ILCS 5/4-12; two filing days ~14 days out; personal knowledge) | 0 (window recorded) | counts only |
| ME | false (14 M.R.S. 1254-A(1)) | null (polls only, 21-A 673) | 0 | counts only |
| MD | null | null (administrative complaint by aggrieved person only, 3-602) | 0 | counts only |

Key points:
- DC: citizenship is not required for local elections (D.C. Code 1-1001.02(2)(B)). Non-citizen jury records are not evidence of unlawful registration. Treat like CT: not a signal.
- CA: first state where private challenges are expressly prohibited (allowed = false).
- Voter-data access is closed or tightly limited for private users in HI (name/precinct/status only), IL (view-only in Springfield), ME (campaign uses only), CA (stated purposes under perjury), MD (electoral uses, MD voters only), AK (no DOB).
- Source notes: CA leginfo and AK Department of Law checked in a browser (bot checks); HI read from data.capitol.hawaii.gov.

## Batch 8 - MN, MS, MO, NV, ND, OR, SC (validated: ALL PASS)

| State | Jury list public | Private challenge | Extra blackout | Effective mode |
|---|---|---|---|---|
| MN | false (Minn. Gen. R. Prac. 814) | true (201.195; day 45; personal knowledge + clear and convincing) | 0 (45-day window recorded) | counts only |
| MS | null (13-5-32 names drawn public; master list = voter list) | true (23-15-63 appeal by county elector) | 0 | counts only |
| MO | null | null (115.191 election authority investigates) | 0 | counts only |
| NV | null | true (293.535 citizenship affidavit, day 30, personal knowledge; 293.547 day 30-25) | 0 (30 and 25 windows recorded) | counts only |
| ND | null | null (16.1-05-06 repealed 2013; none found) | 0 | counts only |
| OR | false (ORS 10.215) | null (247.195 clerk inquiry) | 0 | counts only |
| SC | null | true (7-5-230 written challenge; hearing within 10 days) | 0 | counts only |

Key points:
- ND has no voter registration; voters enter the central voter file after voting (16.1-02-05). The EXCLUDE rule's registration-date comparison has no direct equivalent there.
- NV 293.535 is the only statute found that names non-citizenship as the ground for a private affidavit, but it requires personal knowledge, so juryroll_lead_sufficient = false.
- MN challenges need personal knowledge, due diligence, and clear and convincing proof.
- Use limits: MN (elections/political/law enforcement, signed statement, no online posting), ND (candidates and parties only), OR (no commercial use).
- Source notes: MS read on Justia (2025) because the official code is vendor-hosted; MN court rule read on revisor.mn.gov; ND read from official PDFs on ndlegis.gov.

## All batches complete

51 jurisdictions (50 states + DC) have rules files that validate against rules/schema.json. North Carolina and Pennsylvania allow the jury list and a named export. No jurisdiction shows challenge guidance. Only New Mexico adds extra blackout days (30).

## Post-batch fixes (2026-10-07)

1. **B.4 decided (Optimus).** LOGIC-CHANGES.md is now v1.3.0.
   - Named referral (NC only): a missing, unparseable, or equal registration date excludes the pair.
   - Counts (every state): those pairs go into the bucket "cannot compare: no registration date", shown next to "excluded: registered after declaration". Nothing is dropped silently.
   - Missing jury dates go into the same bucket (extension, for Optimus to confirm).
   - Tests: AT-12 and AT-35 rewritten; AT-37 to AT-40 added. GUIDE.md section 1 updated.
   - The old counter "dates not comparable" (batch 1 to 3 notes) is renamed "cannot compare: no registration date".
2. **Unverified rules.**
   - NJ: Court Rule 1:38-5(g) is marked UNVERIFIED. The jury_list values stay null (strict default).
   - GA: 21-2-231(a.1), 21-2-225(c) and 21-2-601 were re-read from the Justia 2025 code. Justia is the source the GA steering allows. Values are unchanged and now cite the statute text.
   - GA HB 397 and the two PA items from secondary sources are marked UNVERIFIED. No rule value uses them.
3. **TLS.** CT (cga.ct.gov, chapters 884, 143, 146) and UT (le.utah.gov: 20A-2-607, 20A-3a-803, 20A-3a-804, 78B-1-106) were re-fetched with TLS verification on.
   - Both servers omit their intermediate certificate. The chain was completed with the issuer's intermediate and verified to a system root.
   - The text matches every value. The CT voter_file.who_may_get text was narrowed to the change lists that 9-50a makes public.
4. validate.py: RESULT: ALL PASS (51 jurisdictions plus default).
