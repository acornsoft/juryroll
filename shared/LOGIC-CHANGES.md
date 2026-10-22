# JuryRoll logic changes: spec for Kyle

Version 1.3.7, 2026-10-09 (L added: NC header variants and "Result Date/Time" never mapped to `decl_date` (REQ-NOTE 67); name-only notice and no match-rate display (REQ-NOTE 68); AT-56 to AT-59. No gate loosens. 1.3.6, 2026-10-08: K updated per Optimus ruling: practice mode shows invented names on screen in every state; counts-only states keep counts-only downloads; David chose yes. 1.3.5: K, planned learn-by-doing sandbox, a note for a later build, not for this change; AT-48 to AT-55 parked in K. 1.3.4, 2026-10-07: G.1 and AT-45 to AT-47: voter-file use attestation where `voter_file.use_restriction` is non-null, per Optimus; REQ-NOTE 65. 1.3.3: AT-42 to AT-44: canceled-voter rows skipped before matching in every state, per Optimus; REQ-NOTE 27. 1.3.2: PA referral only per Optimus: show_challenge_guidance false, AT-41 expects no challenge panel. 1.3.1: PA re-check: PA jury list open for inspection under 42 Pa.C.S. 4523(a), so PA gates now match NC; AT-41 added. 1.3.0: B.4 decided by Optimus: named output excludes missing or equal dates; counts get a "cannot compare: no registration date" bucket. Earlier: B changed to EXCLUDE; hostname added; H.5-H.7 and AT-03 updated after all 51 rules files were delivered). Owner of code and Azure deploy: Kyle. Rules content: JuryRoll.
Source of the requirements: `LEGAL-REVIEW.md` (Optimus, 2026-10-07), "Required changes (ranked)".
Rules data: `rules/schema.json`, `rules/default.json`, `rules/<XX>.json`. Validator: `rules/validate.py`.

The current code is `index.html` (`<script id="juryroll-core">` = pure functions, `<script id="juryroll-ui">` = DOM).
Line references below are to the v1 file.

Invariant that must not change: the page makes **no network requests**. All data stays in the browser.

---

## A. State rules: loading and gating

### A.1 Loading

1. **Bundle, do not fetch.** `fetch()` from `file://` fails, and a fetch would break the no-network rule.
   Add a build step (`tools/bundle-rules.(js|py)`) that inlines every `rules/*.json` except `schema.json` into
   `<script type="application/json" id="juryroll-rules">{"NY":{...},"NC":{...},"DEFAULT":{...}}</script>`.
2. CI runs `python3 rules/validate.py` before the bundle step. A failure blocks the Azure deploy.
3. New **Step 0: "Your state"** above Step 1. A required `<select id="stateSel">` lists the 50 states and DC.
   Steps 1 to 4 stay disabled until a state is chosen.
4. Runtime load: `rules = BUNDLE[code] || BUNDLE.DEFAULT`. Fallback to DEFAULT also when:
   - `schema_version !== "1.0.0"`, or
   - a required top-level key is missing (light runtime check of the keys in `schema.json` `required`).
   Show "No verified rules for <State>. Strictest rules apply." when DEFAULT is used.
5. Show the rules header: state name, `verified_on`, and a link list of every `source_url` in the file.
6. Log `rules_loaded` (section D) with the SHA-256 of the rules JSON text.

### A.2 Null semantics (single rule)

`null` anywhere means the strict value. Implement one helper, `strict(value, strictValue)`, and use it for every read.

| Field | Strict value used when null |
|---|---|
| `jury_list.public` | `false` (jury file refused) |
| `voter_file.no_online_posting` | `true` |
| `voter_file.dob_in_public_file` | `false` (cap at Probable, A.4) |
| `voter_file.registration_date_in_public_file` | `false` (B shows "cannot compare") |
| `private_challenge.allowed` | `false` |
| `private_challenge.juryroll_lead_sufficient` | `false` |
| `private_challenge.one_per_affidavit` | `true` |
| `blackout.state_extra_days` | `0`, plus banner "State time limits not verified" |
| `gates.allow_jury_list` / `allow_named_export` / `show_challenge_guidance` | `false` |
| `gates.aggregate_only` | `true` |
| `referral_targets.*` | not shown; show `default.json` `other` (EAC directory) |

### A.3 Effective gates

Effective gate = the stricter of the declared gate and the derived gate. Same algorithm as `effective()` in `rules/validate.py`:

```
jl  = jury_list.public === true
pc  = private_challenge.allowed === true
derived = { allow_jury_list: jl, aggregate_only: !jl, allow_named_export: jl, show_challenge_guidance: jl && pc }
eff.allow_jury_list         = strict(g.allow_jury_list,false)         && derived.allow_jury_list
eff.aggregate_only          = strict(g.aggregate_only,true)           || derived.aggregate_only
eff.allow_named_export      = strict(g.allow_named_export,false)      && derived.allow_named_export && !eff.aggregate_only
eff.show_challenge_guidance = strict(g.show_challenge_guidance,false) && derived.show_challenge_guidance
```

Current effective gates (from the validator run on 2026-10-07):

| File | allow_jury_list | aggregate_only | allow_named_export | show_challenge_guidance |
|---|---|---|---|---|
| default | false | true | false | false |
| NY | false | true | false | false |
| NC | **true** | false | **true** | false |
| GA | false | true | false | false |
| TX | false | true | false | false |
| PA | **true** | false | **true** | false |

### A.4 What each gate controls

| Gate | When false / true |
|---|---|
| `allow_jury_list = false` | `#fileJuror` is disabled and hidden. Drag-and-drop of a file onto the juror slot is refused **before** `FileReader` reads it. Message: "The jury list is confidential in <State> (<jury_list.statute>). JuryRoll does not load it." The app switches to **Audit mode** (A.5). |
| `aggregate_only = true` | No results table, no per-person rows in the DOM, no row export. Only counts and the audit referral letter. |
| `allow_named_export = false` | `#exportBtn` is not rendered (not just disabled). `toCSV()` throws if called. |
| `allow_named_export = true` | Named export allowed **only** as the referral file (A.6). The Weak tier is never exported (remove `#exportWeak`; LEGAL-REVIEW: no action on name-only matches). |
| `show_challenge_guidance = true` | Show the Challenge panel (A.7). When false, show only: "A private challenge is not an available JuryRoll path in <State>. Refer the lead to officials." |

**Tier cap from data.** If `strict(voter_file.dob_in_public_file,false)` is false, or fewer than 50% of loaded juror rows have a full DOB,
cap every pair at **Probable** and show the badge "Full date of birth is not in the public files for <State>. Highest tier: Probable."
(NC today: public jury list has DOB withheld by G.S. 163-82.10(a1); voter file has birth year only.)

### A.5 Audit mode (aggregate-only states)

LEGAL-REVIEW item 4: "audit the official system (aggregate counts), not individuals."
Inputs are numbers the user types or copies from official publications. No file of persons is loaded.

| Field id | Label |
|---|---|
| `auditPeriod` | Period (from, to) |
| `auditJuryCount` | Jurors disqualified or excused for non-citizenship (from an official report or answer) |
| `auditJurySource` | Source of that number (URL or document name) |
| `auditRemovals` | Voter registrations cancelled for non-citizenship (official report) |
| `auditRemovalSource` | Source of that number |

Output: a one-page letter to `referral_targets.state_election_office` and the county board.
The letter quotes `jury_list.official_pipeline` (for example TX Gov't Code 62.113(b), GA O.C.G.A. 21-2-231(a.1)) and asks:
"Is this process running in <county>? How many records were received, reviewed, confirmed, and removed in the period?"
No names. Export as `.txt` or print. Log `audit_letter_exported` with the counts only.

### A.6 Referral export (named, only where allowed)

Changes to `toCSV()` (v1 lines 405-416) and `EXPORT_COLS` (lines 398-399):

1. Header lines add: state, rules `verified_on`, the rule cites used, the referral targets with URLs, and the two B counts ("N matches excluded: registered after declaration", "N matches cannot compare: no registration date").
2. Fixed text line: "Official SAVE or naturalization check required before any action. A match is not proof. Do not publish. Do not contact the voter."
3. New columns: `Voter status` (C), `Registration date`, `Jury declaration date`, `Flags` (B, C). Every exported row has `REGISTERED_BEFORE_DECLARATION`; excluded pairs (B.2) are never exported.
4. Rows: Strong and Probable only. Rows flagged `REMOVED` go to a separate section titled "Already removed: confirm the removal was correct" (C).
5. File name: `JuryRoll-referral-<XX>-<county>-<YYYY-MM-DD>.csv`.
6. Export triggers the purge prompt (E.2) and the log entry `export` (D).

### A.7 Challenge panel

Visible only when `eff.show_challenge_guidance` is true. Content comes from `private_challenge`:
`who`, `form_or_statute`, `form_url`, `one_per_affidavit`, `deadlines`, `evidence_standard`, `false_statement_penalty`.

Banners, in this order of priority:

1. `juryroll_lead_sufficient !== true`: "A JuryRoll match alone does not meet this standard. Referral is the recommended path."
2. Inside the federal 90-day window (A.8): "Federal 90-day window. Do not file bulk challenges. Refer leads instead."
3. Past the state deadline (`deadline_days_before_election`): "The state deadline for this election has passed (<date>)." Hide the form link.
4. One voter per affidavit: "One affidavit per voter. State the true source: a jury record and a software match."

The panel never pre-fills a challenge form, never generates one affidavit per row, and has no "bulk" feature.

### A.8 Election date and windows

Add `<input type="date" id="electionDate">`, default = next federal general election (2026-11-03, 2028-11-07, 2030-11-05).
Compute and show: federal window start = election date − 90 days; each `blackout.state_windows[*]` date; `deadline_days_before_election` date.
For 2026-11-03: federal window from 2026-08-05; NC challenge cutoff 2026-10-09; GA 45-day postponement from 2026-09-19; PA 1509 cutoff 2026-10-24.

### A.9 Referral targets

Render `referral_targets` as a list with `name`, `url`, `note`. Links use `target="_blank" rel="noopener noreferrer"`.
If all three are null, show `default.json` `referral_targets.other`.

---

## B. Registration date vs jury declaration date

### B.1 New fields (core `FIELDS`, v1 lines 156-169)

| Key | Label | File | Header patterns (normalized) |
|---|---|---|---|
| `decl_date` | Jury declaration / disqualification date | juror | `disqualificationdate`, `disqualdate`, `excusedate`, `dateofexcusal`, `responsedate`, `questionnairedate`, `qualificationdate`, `datedisqualified`, `decldate` |
| `reg_date` | Registration date | voter | `registrationdate`, `regdate`, `registrdt`, `dateregistered`, `effectivedate`, `origregdate`, `registrationdt` |

Add `decl_date` to `JUROR_FIELDS` and `reg_date` to `VOTER_FIELDS`. Parse with the `parseDOB()` logic (rename it `parseDate()`). Keep the check that the year is not in the future.

### B.2 Rule: EXCLUDE (decision by Optimus, 2026-10-07)

After `match()` assigns a tier, compare the voter's `reg_date` with the juror's `decl_date`:

| Case | Named output (table, print view, referral export) | Counts |
|---|---|---|
| `reg_date < decl_date` (registered **before** the non-citizen declaration) | Lead keeps its tier. Flag `REGISTERED_BEFORE_DECLARATION`. | Counted as a lead in its tier. |
| `reg_date > decl_date` (registered **after**) | **Not a lead at any tier.** Never shown or exported. | Bucket **"excluded: registered after declaration"**. |
| `reg_date == decl_date` | **Excluded.** Never shown or exported (B.4). | Bucket **"cannot compare: no registration date"** (B.4). |
| `reg_date` missing or unparseable (includes files with no registration column) | **Excluded.** Never shown or exported (B.4). | Bucket **"cannot compare: no registration date"** (B.4). |
| `decl_date` missing or unparseable | **Excluded.** Never shown or exported. | Bucket **"cannot compare: no registration date"** (spec extension; see B.4). |

Every pair that `match()` returns lands in exactly one of three places: a lead, the "registered after" bucket, or the "cannot compare" bucket.
No pair is dropped silently. Invariant (tested): leads + registered_after + cannot_compare = all pairs.

The two buckets are shown side by side, each time a match runs, in every mode, also when N = 0:

- "N matches excluded: registered after declaration"
- "N matches cannot compare: no registration date"

The buckets are counts only. They never list names, IDs, or dates. `match_run` in the audit log records the two counts only.
Where a named export is allowed (A.6), its header lines repeat both counts, so a reader can see that rows were withheld.

Apply B.2 **before** the tier cap (A.4), the Weak filter, and the removed-voter split (C), so excluded pairs never reach those steps.
A juror whose only matches are excluded counts as "not matched" in `jurorsByBest`.

### B.3 Basis

- Texas 2019 settlement, *Texas LULAC v. Whitley*, No. 5:19-cv-00074 (W.D. Tex.): the Secretary of State "will send to county voter registrars only the matching records of individuals who registered to vote before identifying themselves as non-U.S. citizens." Official source: Texas Secretary of State news release, 2019-04-26, https://www.sos.texas.gov/about/newsreleases/2019/042619.shtml (verified 2026-10-07).
- Texas later codified the same rule for DPS data: Tex. Elec. Code 16.0332(a-1) ("may not consider information derived from documents presented by the voter to the department before the person's current voter registration became effective").
- NC G.S. 163-82.14(c1)(1)b: the State Board drops persons who "became a citizen of the United States after the date of that person's jury disqualification."
- LEGAL-REVIEW item 3.

### B.4 Missing or equal dates: DECIDED (Optimus, 2026-10-07)

Source: decision by Optimus, 2026-10-07. It replaces the open point in v1.2.0.

1. **Named referral (only where `eff.allow_named_export` is true; NC today).** A missing, unparseable, or equal registration date makes the pair **excluded**. It never appears in the results table, the print view, or the referral export.
2. **Counts (every state; the same code path for every rules file).** These pairs are **not dropped silently**. They are counted in a separate bucket labeled **"cannot compare: no registration date"**, shown next to "excluded: registered after declaration".

Implementation notes for Kyle:

- One pure function, `applyDateRule(pairs) -> { leads, registeredAfter, cannotCompare }`, used by every mode. It does not read the state code. State gates act only after it returns.
- In aggregate-only states the jury file is refused (A.4), so no match runs and the buckets have nothing to count. The buckets appear in the live UI wherever a match runs (NC today). The function and its tests still cover every state code (AT-38).
- A voter file with no registration column sends every pair to the "cannot compare" bucket, and the named export then has zero data rows. Examples: the Indiana public file has no registration date (`rules/IN.json`); for Michigan the field is not confirmed (`rules/MI.json` leaves it null).
- North Dakota files never have a registration date (H.7).

Two points kept for Optimus to confirm (the spec applies the strict reading until then):

- **Equal dates** go to the bucket labeled "no registration date", as decided, although a date is present. A clearer label would be "cannot compare: no registration date or same date". The spec keeps the decided label.
- **Missing `decl_date`** (jury side) is not named in the decision. The spec puts these pairs in the same "cannot compare" bucket, so they are excluded from named output and still counted.

Known limit to state in the UI: some files show the date of the latest registration change, not the first registration. That excludes more matches, which is the safe direction.

---

## C. Wrongly-removed-voter check (symmetric check, LEGAL-REVIEW item 5)

### C.1 New voter fields

| Key | Patterns |
|---|---|
| `status` | `status`, `voterstatus`, `statuscd`, `voterstatusdesc`, `registrationstatus` |
| `status_reason` | `statusreason`, `reasoncd`, `voterstatusreasondesc`, `cancelreason`, `removalreason` |
| `status_date` | `statusdate`, `datestatuslastchanged`, `statuschangedate`, `canceldate` |

Note: `status` is currently a pattern of the juror `reason` field (v1 line 168). Keep it there for jurors; add it separately for voters.

### C.2 Rules

- `status` matches `/remov|cancel|purg|denied|deceased/i`: flag `REMOVED`. The row leaves the main list and goes to "Already removed: confirm the removal was correct".
- `status` or `status_reason` matches `/reinstat|restor|re-?activ/i`: flag `REINSTATED`. Keep the row, add the note "Voter was reinstated. Officials may already have confirmed eligibility."
- `status` matches `/inactive|suspense/i`: flag `INACTIVE`. Note only.
- `REMOVED` plus tier below Strong: flag `POSSIBLE_WRONGFUL_REMOVAL`. (Pairs registered after the declaration are already excluded by B.2; they add to the symmetric count below as "removed, registered after declaration".)
- Symmetric count: number of voters whose `status_reason` matches `/non-?citizen|citizenship/i`, and how many of them have **no** Strong jury match. Shown as counts in every mode.
  Named rows of this group appear only when `eff.allow_named_export` is true, and only in the referral file.

### C.3 Referral note (added to every exported row with any C flag)

"Before any action, confirm citizenship through official records. If this voter was removed or flagged, confirm that notice was sent and that the removal was correct. Reinstate if it was not."

---

## D. Append-only audit log (local)

### D.1 Storage and format

- IndexedDB database `juryroll-audit`, object store `log`, key = sequence number. If IndexedDB is not available (some browsers on `file://`), keep the log in memory and warn "The log will be lost when you close the page. Download it."
- One JSON object per entry. "Download log" saves JSON Lines (`juryroll-audit-<date>.jsonl`). The first line is a file header, not a hashed entry. It always has `county_name` and `county_fips`. Both are JSON `null` when no county is selected, and that header is `"No county selected"`. The download stays available without a county: the log is the user's own accountability record and has to be saved before a purge. A referral file and an audit letter still require a county.
- Hash chain: `entry.hash = SHA-256(prev_hash + canonical_json(entry_without_hash))` with `crypto.subtle.digest`. The first entry has `prev_hash = "0"*64`.
- On page load, verify the chain. On a break, show "Audit log integrity check failed at entry N" and log `log_chain_break`.
- The only write API is `audit.append(type, data)`. No update. No delete. The purge (E) does not touch the log.

### D.2 Entry fields

`seq`, `ts` (ISO 8601 with offset), `app_version`, `type`, `data`, `prev_hash`, `hash`.

| `type` | `data` (no names, no DOBs, no addresses) |
|---|---|
| `session_start` | user agent family, rules state code |
| `rules_loaded` | `state`, `schema_version`, `verified_on`, `sha256`, `fallback_to_default` |
| `attestation_signed` | `sha256` of the attestation text, typed initials hashed (G) |
| `file_loaded` | `kind` (juror/voter), `sha256` of file bytes, `bytes`, `rows`, header names |
| `file_refused` | `kind`, reason (`jury_gate`, `blocked_header`), matched header names |
| `mapping_set` | field → column header |
| `match_run` | counts by tier, flag counts, cap applied, `excluded_registered_after`, `cannot_compare_no_reg_date` |
| `export` | `rows`, tiers included, `sha256` of the export text, voter IDs only if the user ticks "Include IDs in log" (default off) |
| `audit_letter_exported` | the counts and sources typed in A.5 |
| `purge` | trigger (`button`, `after_export`, `timeout`, `pagehide`) |
| `log_chain_break` | `seq` |

File names are not logged by default; a file name can contain a person's name.

---

## E. Purge after referral

### E.1 Purge function

`purgeAll(trigger)`:
1. Set every data reference in the UI state `S` to null (`S.juror`, `S.voter`, records, pairs, result).
2. Reset `#fileJuror` and `#fileVoter` (`value = ""`), clear `#results`, `#cards`, `#summary`, mapping tables, reason box.
3. `URL.revokeObjectURL()` for every export blob URL created.
4. Return to Step 0 with the state still selected.
5. `audit.append("purge", {trigger})`.

The app must never write loaded data or results to `localStorage`, `sessionStorage`, IndexedDB, or cookies. Only the audit log is stored.

### E.2 Triggers

- **Button** `#purgeBtn` "Purge all loaded data", always visible after a file loads. Confirm dialog.
- **After export**: modal "Referral saved. Purge the data now?" Buttons: "Purge now" (default focus) and "Keep for 10 minutes". After 10 minutes, purge without asking.
- **Inactivity**: 30 minutes without input. Warning at 28 minutes.
- **Close**: `pagehide` and `beforeunload` call `purgeAll("pagehide")`. Data is in memory only, so a closed tab holds nothing.

---

## F. Refuse DMV, data broker, and SSN data

Reason: DPPA 18 U.S.C. 2721-2724 (no DMV-derived data); LEGAL-REVIEW item 6.

### F.1 Detection (run in `analyze()` before mapping, both files)

Normalized header (`normHeader`, v1 line 223) matched against:

| Class | Patterns |
|---|---|
| SSN | `ssn`, `socialsecurity`, `socsec`, `ssn4`, `last4ssn`, `ssnlast4`, `taxid`, `itin`, `tin` (exact) |
| DMV | `driverslicense`, `driverlicense`, `dlnumber`, `dlnum`, `dlno`, `licensenumber`, `dmv`, `mvr`, `stateidnumber`, `idcardnumber`, `permitnumber` |
| Broker | `experian`, `acxiom`, `equifax`, `transunion`, `infutor`, `lexisnexis`, `accurint`, `tlo`, `targetsmart`, `catalist`, `l2`, (exact) `creditscore`, `householdincome`, `networth`, `modeled`, `consumerid`, `phoneappend`, `emailappend` |

Value check on the first 500 rows of each column (any header):
- `^\d{3}-?\d{2}-?\d{4}$` in more than 1% of non-blank values: class SSN.

### F.2 Behavior

- Any SSN or broker match, or a DMV match whose values contain digits: refuse the **whole file**. Show the matched headers. Do not keep the file text in memory. Log `file_refused` with header names only.
- DMV-named column whose values are only `Y`, `N`, `T`, `F`, `0`, `1`, or blank (an official flag, for example NC `drivers_lic`): allow the file, drop the column, show a note.
- No override switch. The user must remove the column from an official file or get the file from the official source.

---

## G. Use attestation (LEGAL-REVIEW item 6; not in the original brief)

Before Step 1, a modal with checkboxes. All must be ticked, plus typed initials:

1. I got each file from an official source, and I obey its use rules (`voter_file.permitted_uses`).
2. I will send leads only to the offices in the referral list.
3. I will not publish any name or contact any voter.
4. I understand a match is not proof. Only officials can verify citizenship.
5. I will purge the data after I send the referral.

Log `attestation_signed` with hashes only.

### G.1 Voter-file use attestation (REQ-NOTE 65; Optimus 2026-10-07)

Applies when the selected state's `voter_file.use_restriction` is non-null. Today 18 files: AZ, CA, HI, IA, IL, IN, MD, ME, MN, ND, NE, NM, NY, PA, TN, UT, VA, WY.

1. JuryRoll never decides for the user whether their use qualifies.
2. Before the voter file slot accepts a file, show a panel with:
   - the heading "Your state limits how its voter list may be used";
   - the full `voter_file.use_restriction` text, verbatim (no shortening, no paraphrase), and a link to `voter_file.source_url`;
   - the line "JuryRoll supports one use only: counting matches and referring them to election officials.";
   - the line "JuryRoll does not decide whether your use is allowed. Read the law. If you are not sure, do not load the file.";
   - one checkbox: "I have read this law. My use of this voter file is allowed under it."
3. The voter file input stays disabled until the box is checked. A file dropped before that is refused before it is read.
4. Log `voter_use_attested` with the state code and a hash of the shown text only.
5. Changing the state, or a purge, unchecks the box.
6. Where `use_restriction` is null or absent, show no panel and no extra checkbox. The G attestation and the H.5 banner still apply.

---

## H. Other UI changes

1. Link `GUIDE.md` (rendered as a static `guide.html` at build time) from the header and from every banner.
2. Caveats box (v1 line 65): add the state `notes[]` list.
3. Remove "Show weak matches" from the default view; keep it only in a collapsed "Details" area. Weak rows never export.
4. Print view: same content as the export. No print in aggregate-only mode except the audit letter.
5. **Use-limit banner.** If `voter_file.permitted_uses` or `voter_file.attestation_required` is non-null, or `voter_file.no_online_posting` is true, for the selected state, show above Step 1: "Your state limits how its voter list may be used. Read the rule before you load a file." Quote `permitted_uses` and link `voter_file.source_url`. Files with such limits today: AL, AR, AZ, CA, CO, CT, DE, FL, GA, HI, IA, ID, IL, IN, KS, KY, LA, MD, ME, MI, MN, MO, MT, NC, ND, NE, NH, NJ, NM, NY, OH, OK, OR, PA, SD, TN, TX, UT, VA, WA, WI, WV.
6. **Non-signal jurisdictions.** Add a core constant `NON_SIGNAL = { CT: "Connecticut lets lawful permanent residents serve on juries.", DC: "D.C. lets non-citizens vote in local elections (D.C. Code 1-1001.02(2)(B))." }`. For these codes: force `aggregate_only`, hide the challenge panel even if `private_challenge.allowed` is true, and show the reason in a banner. The match counts must carry the label "not evidence of unlawful registration in this jurisdiction". The reasons are also in each file's `notes[]`.
7. **North Dakota.** North Dakota has no voter registration (N.D.C.C. 16.1-01-05.1, 16.1-02-05). Files have no registration date, so every pair goes to the B.4 "cannot compare: no registration date" bucket. Show: "North Dakota has no voter registration. Matches cannot be compared with a registration date." Do not map a file-entry or last-voted date to `reg_date`.

---

## I. Acceptance tests

Add to `test/core.test.js` (pure) and `test/ui.test.js` (headless Chrome). Fixtures under `test/fixtures/` (fictional data only).

| ID | Test | Expected |
|---|---|---|
| AT-01 | `rules/validate.py` | Exit 0; all files PASS; 6 negative tests rejected |
| AT-02 | Bundle contains every `rules/*.json` except schema | Keys = state codes + `DEFAULT` |
| AT-03 | Test bundle with the WY entry removed; select WY | DEFAULT loaded; banner "No verified rules"; jury input absent |
| AT-04 | Bundle entry with `schema_version: "0.9"` | Falls back to DEFAULT |
| AT-05 | Select TX, drop a juror CSV on the juror slot | Refused before read (spy on `FileReader.readAsText` = 0 calls); message cites Gov't Code 62.0132 |
| AT-06 | Select NY | Audit mode; no `#results` rows; no `#exportBtn` in DOM |
| AT-07 | Call `toCSV()` while `allow_named_export` is false | Throws |
| AT-08 | Select NC, load samples | Match runs; no Strong tier (cap); badge shown; export has no Weak rows |
| AT-09 | NC with sample voter file containing full DOB | Still capped at Probable (rules `dob_in_public_file=false`) |
| AT-10 | `reg_date` after `decl_date` on a Strong pair | Pair absent from `pairs`, table, print view and export; counter "1 matches excluded: registered after declaration" shown |
| AT-11 | `reg_date` before `decl_date` on a Strong pair | Tier stays Strong; flag `REGISTERED_BEFORE_DECLARATION`; row in export |
| AT-12 | NC; one Strong pair with missing `reg_date`, and separately one with `reg_date == decl_date` | Both absent from table, print view and export; "N matches cannot compare: no registration date" = 1 for each case; "registered after declaration" unchanged; no names, IDs or dates in counters or log |
| AT-13 | Voter status `REMOVED` | Row in "Already removed" section; C.3 note in export |
| AT-14 | Voter status `REMOVED`, registered before declaration, tier Probable | Flag `POSSIBLE_WRONGFUL_REMOVAL` |
| AT-15 | Voter status reason "REINSTATED" | Flag `REINSTATED`; note present |
| AT-16 | Symmetric count | Count of non-citizenship removals without a Strong match is shown in all modes |
| AT-17 | Juror file header `SSN` | Whole file refused; `file_refused` log entry lists `SSN`; no values in log |
| AT-18 | Header `Notes` with values like `123-45-6789` in 5% of rows | Refused (value check) |
| AT-19 | Header `drivers_lic` with values Y/N | File accepted; column dropped; note shown |
| AT-20 | Header `dl_number` with digits | File refused |
| AT-21 | Header `experian_id` | File refused |
| AT-22 | Audit log after load, match, export, purge | Entries in order: session_start, rules_loaded, attestation_signed, file_loaded x2, mapping_set, match_run, export, purge; chain verifies |
| AT-23 | Edit one stored log entry, reload | "Audit log integrity check failed at entry N"; `log_chain_break` appended |
| AT-24 | Grep all log entries for any juror/voter name or DOB from the fixtures | Zero hits |
| AT-25 | Export, then click "Purge now" | `S` data fields null; tables empty; file inputs empty; blob URL revoked |
| AT-26 | Export, then wait (fake timers) 10 minutes | Auto purge; log trigger `after_export` |
| AT-27 | `pagehide` event | `purgeAll("pagehide")` called |
| AT-28 | After any session | `localStorage`, `sessionStorage` empty; IndexedDB holds only `juryroll-audit` |
| AT-29 | Network | Playwright request log has zero requests other than the page itself (keep the v1 check) |
| AT-30 | Election date 2026-11-03, state NC, today 2026-10-07 | Federal window active; NC blackout date 2026-10-09 is computed; challenge panel is hidden |
| AT-31 | Same with today 2026-10-10 | NC blackout date is passed; challenge panel, deadline banner, and form link stay hidden |
| AT-32 | Attestation | Steps 1-4 disabled until all boxes and initials are given |
| AT-33 | Export header | Contains "Official SAVE or naturalization check required", state code, rules `verified_on`, referral target URLs |
| AT-34 | Select DC with a fixture that has a Strong pair | Aggregate only; challenge panel absent although `private_challenge.allowed` is true; NON_SIGNAL banner shown |
| AT-35 | Core: ND rules, voter fixture with a `last_voted` column and no registration column. UI: select ND | `reg_date` not auto-mapped from `last_voted`; `applyDateRule` puts every pair in `cannotCompare`. UI shows the ND banner (H.7) |
| AT-36 | Select CA | Use-limit banner quotes Elec. Code 2194 uses; challenge panel absent (`allowed` is false) |
| AT-37 | NC; IN/MI-style voter fixture `test/fixtures/voter_no_regdate.csv` (no registration column) that yields 3 Strong or Probable pairs | Summary shows "3 matches cannot compare: no registration date" next to "0 matches excluded: registered after declaration"; results table empty; export has header lines (with both counts) and **zero data rows**; `match_run` logs `cannot_compare_no_reg_date: 3` |
| AT-38 | Core, run for every code in the bundle (51 states + `DEFAULT`): `applyDateRule` on one fixture with before, after, equal, missing-reg and missing-decl pairs | Same buckets for every code: 1 lead, 1 registered-after, 3 cannot-compare; leads + registeredAfter + cannotCompare = pairs (nothing dropped) |
| AT-39 | NC; all pairs registered before declaration | Both counters visible with value 0 ("0 matches excluded: registered after declaration", "0 matches cannot compare: no registration date") |
| AT-40 | NC; juror fixture with an empty `decl_date` on a Strong pair | Pair absent from named output; counted in "cannot compare: no registration date" |
| AT-42 | Any state (run for OK, NC, and MI); voter fixture `test/fixtures/voter_mixed_cancelled.csv`: 10 active rows, 4 rows with `Status` = D, of which 2 have `Deletion_Reason` = JD and 2 = IN; juror fixture with a Strong pair against one JD row and one active row | Canceled rows dropped before matching; only the active-row pair is formed; summary shows "4 cancelled records skipped; 2 with a jury-related reason"; no pair references a dropped row (REQ-NOTE 27) |
| AT-43 | Voter fixture `test/fixtures/voter_all_cancelled_ok.csv` (OK Deleted Voters layout, every row deleted, 3 with JD) | File refused; zero pairs; refusal message shows "N cancelled records skipped; 3 with a jury-related reason" |
| AT-44 | Run AT-42, AT-43, and a status-only cancellation file (REQ-63: MI and the states with no jury reason code) | No last or first name from any canceled row appears in the match result, the filtered CSV, or the refusal text; counters are the only trace |
| AT-45 | Select MN (non-null `voter_file.use_restriction`) | G.1 panel shown before the voter slot; the panel text equals `rules/MN.json` `voter_file.use_restriction` character for character; link to `voter_file.source_url`; the line "JuryRoll supports one use only: counting matches and referring them to election officials." shown; checkbox unchecked by default |
| AT-46 | MN; drop a voter CSV before the G.1 box is checked; then check it and drop the file again; then switch to NE and back to MN | First drop refused before read (spy on `FileReader.readAsText` = 0 calls; voter input disabled). After the box is checked the file loads; `voter_use_attested` logged with state code and text hash only. After the state switch the box is unchecked and the input disabled again |
| AT-47 | Core, run for every code in the bundle; UI: select GA (`use_restriction` null) | Core: the G.1 panel is required for exactly the 18 codes with non-null `use_restriction` and for no other code (DEFAULT included). UI GA: no G.1 panel or checkbox; the voter input is enabled once the G attestation is done |

---

## J. Out of scope for this change

- Nickname and fuzzy-name matching (v1 gap). Do not add it before the tier caps and B are in place; it raises false positives.
- Hostname: **juryroll.doge.reviews** (decision 2026-10-07). Product name stays **JuryRoll**. Use this hostname in the Azure Static Web Apps custom-domain config, the README, the export header ("Made with JuryRoll, juryroll.doge.reviews"), and the print footer. Do not use juryroll.com (LEGAL-REVIEW item 8: conspiracy-forum history).
- Rules content: all 50 states plus DC are delivered (`rules/<XX>.json`, 51 files) and pass `rules/validate.py`. Re-verify each file before every federal election; `verified_on` is 2026-10-07.

---

---

## K. Planned: practice sandbox for every state (NOT for this build)

Status: requirement note only. Do not build it yet. Requested by the caller on 2026-10-08. REQ-NOTE 66.
Decision: David chose to show invented names in practice mode in every state. The conditions below are Optimus's ruling (2026-10-08) and are the basis.

### K.1 Problem

49 jurisdictions show only the "Coming later" card today. A user there cannot see how JuryRoll works.
They cannot learn the steps before their state is supported.

### K.2 Users

- A volunteer in a counts-only state who wants to learn the tool.
- A volunteer in PA or NC who wants to practice before using real files.
- A trainer who teaches a group with one shared walkthrough.

### K.3 Behavior

1. The home page shows all 51 jurisdictions. No state is hidden.
2. **PA and NC** (gate `allow_jury_list` true): starting templates plus the real-data path. The real-data path works as it does today.
   Each template's column headers follow the source list described in `rules/PA.json` or `rules/NC.json` `jury_list`.
3. **The other 49** (gate `allow_jury_list` false or null): blank templates plus the practice samples.
   A "Practice with fictional samples" action runs the full flow on the bundled practice files only.
4. The "Coming later" card stays. It gains the practice action. It still quotes `gates.basis`.

### K.4 State gate it depends on (fixed app rule, no schema field)

- `gates.allow_jury_list` and `gates.allow_named_export` govern real lists and real output only. Invented rows hold no one's personal data.
- `allow_jury_list` decides the path. True means real data. False or null means practice only.
- Practice mode loosens no gate. Real juror and voter file inputs stay disabled in the 49.
- The only files that load in practice mode are the bundled practice files, identified by SHA-256.
- Practice mode shows sample names on screen in every state.
- When `allow_jury_list` or `allow_named_export` is false or null:
  1. Show this header on every practice screen: "FICTIONAL PRACTICE RUN. Not a referral. These names are invented to teach the steps. In <State>, real data stays counts only: <gates.basis>."
  2. Show names on screen only. Disable every named practice download. Practice downloads stay counts only.
- One app rule, not 51 per-state flags. Flags can drift.

### K.5 Must not change

- No network requests. All data stays in the browser.
- Practice output is never a referral. No referral CSV, no audit letter, no county name on any practice output.
- The watermark "FICTIONAL PRACTICE RUN. Not a referral." appears in the screen header, on every result row, and in the header of every practice file.
- Practice runs write no `match_run` entry to the audit log. They may log `practice_run` with the state code only.

### K.6 Teaching text at the challenge step

In states where `allow_jury_list` or `allow_named_export` is false or null, the practice challenge step says:
"In <State>, real use stops at counts. A challenge needs your own knowledge of the voter, not this tool. <gates.basis>"
It shows no challenge form and no steps for filing a challenge.

### K.7 Practice sample files

- Names are obviously fake, in a reserved style: "Sample Juror 01", "Sample Voter 01", "Pat Example". No realistic first and last name pairs.
- Addresses are obviously fake: "000 Sample Road", zip 00000. No real street that could exist.
- Dates of birth come from a reserved range that is plainly not real: 1901-01-01 to 1901-12-31.
- Every row carries "FICTIONAL SAMPLE DATA".
- The SHA-256 list in the app locks these files. Any change to a file needs a new hash in the same PR.
- The current samples do not meet this rule. They use name pairs like "Alpha Example" and "Bravo O'Sampleton-Jones", DOBs like 1980-03-14, and addresses like "100 Example St". Replace them before practice mode ships. Keep the existing samples for the PA and NC tests until then.

### K.8 Acceptance tests (parked; move to section I when the build is approved)

| ID | Test | Expected |
|---|---|---|
| AT-48 | Load the home page | All 51 jurisdictions are listed in the state picker, on the map, and on the Every jurisdiction page; none hidden |
| AT-49 | Select PA, then NC | Starting templates and the real-data file inputs are shown; behavior otherwise equals today's PA and NC tests (AT-40, AT-41) |
| AT-50 | Select TX (`allow_jury_list` false) | "Coming later" card shows `gates.basis` and a "Practice with fictional samples" action; blank templates and practice samples are offered; real juror and voter inputs are disabled |
| AT-51 | TX practice mode; drop a non-sample CSV on either slot | File refused before read (spy on `FileReader.readAsText` = 0 calls); message says only the practice samples load in this state |
| AT-52 | TX practice mode; run the bundled samples | Match runs; sample names show on screen; header equals "FICTIONAL PRACTICE RUN. Not a referral. These names are invented to teach the steps. In Texas, real data stays counts only: " followed by TX `gates.basis` character for character; every result row carries "FICTIONAL PRACTICE RUN. Not a referral." |
| AT-53 | TX practice mode; try every export and print control | No referral CSV, no audit letter, no county name; any download is counts only (no name from the samples appears in the file) and its header carries "FICTIONAL PRACTICE RUN. Not a referral." |
| AT-54 | TX practice mode; open the challenge step; then read the audit log | Challenge step shows the K.6 text with TX `gates.basis`, no challenge form; audit log has no `match_run` entry and at most one `practice_run` entry with the state code only |
| AT-55 | Core, run for every code in the bundle; plus a sample-file lint | Practice mode is offered for exactly the codes where `allow_jury_list` is not true, the real-data path for exactly PA and NC, and DEFAULT gets practice mode. The K.4 header and download block apply exactly where `allow_jury_list` or `allow_named_export` is not true. Every practice sample row matches the K.7 reserved name, address and DOB patterns, and every practice file's SHA-256 is in the app's list |

---

## L. File headers and name-only counts (1.3.7, 2026-10-09)

Source: review/NC.reverify-2026-10-09.md and review/VOLUNTEER-ACTIVITY-2026-10-09.md. REQ-NOTES 67 and 68. Nothing here loosens a gate.

### L.1 Header normalization and "Result Date/Time" (REQ-NOTE 67)

**Problem.** NC State Board files use several headers. Two Mecklenburg files use "DOB" and "Result Date/Time" and put Middle Name before Last Name. No source defines "Result Date/Time".
**User.** A volunteer loading NC State Board files.
**State gate.** None new. NC `allow_jury_list` and `allow_named_export` are true today. The rule is core and runs for every state.
**Behavior.**
1. Headers are normalized before matching (main 9c79c0b: `normHeader` folds case and strips non-alphanumerics). Keep this.
2. Juror aliases: `dateofexcusal` (in main), `dob` and `address1` (in main). Add `adrress1` to the street patterns.
3. Never map `resultdatetime` to `decl_date`, automatically or by manual choice (Optimus ruled 2026-10-09: treat "Result Date/Time" as unknown; never use it as the excusal date.) If it is the only date-like column, show: "This file's date column is 'Result Date/Time'. The State Board does not say what it means. JuryRoll will not use it as the excusal date."
4. Rows with no `decl_date` go to the B.4 bucket "cannot compare: no registration date". Nothing is dropped silently.
5. Map columns by header name, never by position.

### L.2 Name-only notice and no match rate (REQ-NOTE 68)

**Problem.** Volunteers report name-only matches as a rate ("1 in 4"). A same-name count is not evidence. The app never exports Weak pairs, but it does not say why.
**User.** A volunteer with a names-only juror list (PA 4523 lists; hand-transcribed copies).
**State gate.** Every state. In PA and NC it sits beside `allow_named_export` true. In counts-only states it applies to the counts screen.
**Behavior.**
1. If the juror file has no DOB, birth-year or address column, show before the run: "This list has names only. Many people share a name. A name-only match is not a lead and is never exported. If you copied the list by hand, check it against the original."
2. The counts screen labels the Weak count "Same-name pairs (not leads)".
3. No screen, download or audit letter shows a ratio or percent of pairs to juror rows.
4. Weak rows stay out of every export (A.4).

### L.3 Acceptance tests

| ID | Test | Expected |
|---|---|---|
| AT-56 | NC; juror fixture with header "First Name ,Last Name,Middle Name ,Adrress 1,Address 2,City ,Date of Birth ,Date of Excusal" | Headers map to first, last, middle, address, DOB and `decl_date`; no manual mapping needed |
| AT-57 | NC; juror fixture with header "First Name,Middle Name,Last Name,Address,City,DOB,Result Date/Time" and filled Result Date/Time | `decl_date` is unmapped; the L.1 message shows; every pair is in "cannot compare: no registration date"; named export has zero rows; last and middle names are not swapped |
| AT-58 | PA; juror fixture with name and reason columns only | The L.2 notice shows before the run; the counts screen shows "Same-name pairs (not leads)"; zero exported rows |
| AT-59 | Run AT-58 and a TX counts-only run; inspect DOM text, every download and the audit letter | No "%" or "1 in N" ratio of pairs to juror rows appears anywhere |
