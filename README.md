# JuryRoll

JuryRoll helps a volunteer compare a jury disqualification list with a voter file. A match is a **lead for election officials**. It is not proof that a person is not a citizen.

The page works in the browser. Your files stay on your computer. The page does not upload them and it does not contact voters.

Read the full guide before you act: [shared/GUIDE.md](shared/GUIDE.md). The built page links to the same guide.

## What you do

0. Choose your state, then your county. The rules for that state decide what the page is allowed to do.
1. Sign the use statement, then load the jury file and the voter file. You can use CSV or Excel. You can also try the fictional sample.
2. Check that the columns landed in the right fields.
3. Keep the non-citizen reasons selected, then run the match.
4. Read the tiers. If your state allows it, export a referral and send it only to the offices on the page. Then purge the data.

If the jury list is confidential in your state, JuryRoll does not load it. You can still write an audit letter that contains counts only.

## Sample data

The files in `shared/samples` are fictional. They are safe to try. On the version 1 matcher they produce **Strong 3, Probable 4, Weak 2**. State rules can lower a Strong lead to Probable, and they can remove a lead from the list entirely.

Blank templates, in CSV and Excel, are in `shared/templates`. They include a jury declaration date and a registration date. The registration date is needed for a named referral.

## Tiers

- **Strong.** Last name, first name, and full date of birth agree.
- **Probable.** Last name, first initial, and full date of birth agree. Or last name, first name, birth year, and street address agree when one file has no full date of birth.
- **Weak.** Only last name and first name agree. Weak matches stay inside Details until you open them. They are never exported.

If your state's public voter file has no full date of birth, JuryRoll caps every remaining lead at Probable.

## Registration date

If the voter registered **after** the date they told the jury they were not a citizen, that pair is **not a lead**. It does not appear in any named list or any export. The page always shows two lines:

`N matches excluded: registered after declaration`

`N matches cannot compare: no registration date`

A registration **before** the declaration keeps its tier. A missing, unparseable, or equal registration date, or a missing jury declaration date, is counted in the second line and left out of every named list and every named export. Some voter files show the date of the latest registration change, not the first registration. That excludes more matches, which is the safe direction. Every matched pair is in exactly one place: a lead, the first count, or the second count.

## Read this before you use a result

- A match is a lead. It is not proof that a person is not a citizen.
- Some people state that they are not citizens to avoid jury duty. Their jury record is then false.
- Some people become citizens after they complete the jury questionnaire. The jury record can be old.
- Different people can have the same name and the same date of birth (DOB).
- Only election officials can verify citizenship. For example, they can use the federal SAVE system (USCIS).
- Federal law sets a deadline. Under the National Voter Registration Act, 52 U.S.C. 20507(c)(2)(A), a state must complete a systematic removal program not later than 90 days before a federal primary or general election. For the general election on Nov 3, 2026, that date was Aug 5, 2026.
- A federal court applied this rule to a program that matched records to find non-citizens: Arcia v. Florida Secretary of State, 772 F.3d 1335 (11th Cir. 2014). The court also said that the rule does not stop removals based on individual information.
- State laws about the use of voter-file data are different in each state. Some states permit use only for election or political purposes. Jury records can also be confidential. Read your state law before you use these files.
- Send referrals to your county board of elections. Do not publish names.

JuryRoll never contacts voters. Do not publish names.

County names and 5-digit FIPS codes come from the U.S. Census Bureau 2025 Gazetteer Files, National Counties Gazetteer File (`2025_Gaz_counties_national.txt`, dated 2025-09-08). That work is in the public domain. The file is stored at `shared/data/2025_Gaz_counties_national.txt`. Louisiana parishes, Alaska boroughs and census areas, Virginia independent cities, the District of Columbia, and Connecticut's nine planning regions are included as the Census Bureau publishes them.

Step 1 shows a map of the United States. Alaska and Hawaii are insets. Choosing a state or a county on the map does the same thing as the State and County lists. County shapes are a simplified TopoJSON of the Census Bureau 2024 cartographic boundary file `cb_2024_us_county_5m`, and state shapes come from `cb_2024_us_state_5m`. The county card uses Census Bureau population estimates, Vintage 2025 (`co-est2025-alldata`, column `POPESTIMATE2025`). Those Census products are public domain. `npm run geography` rebuilds `shared/map` from the Census files.

## For developers

Build and test notes are in [docs/DEVELOPING.md](docs/DEVELOPING.md). Version 2.0.0.
