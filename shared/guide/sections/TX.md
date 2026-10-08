### 6.1 Texas

In Texas, don't request the non-citizen jury list from the clerk or registrar. It's confidential, and misusing it is an offense under Government Code 62.113(d).
You can ask the county voter registrar for records of its non-citizen list-maintenance program under federal law (52 U.S.C. 20507(i)).
Ask for counts and outcomes only. Do not ask for names. The scope of this law for these records is contested.
A challenge under Election Code 16.092 needs personal knowledge. A JuryRoll match is not personal knowledge.
A false statement in a sworn challenge can carry criminal exposure.

#### Converting the Texas voter file to CSV

The Texas Secretary of State sends the voter list as fixed-width text, not CSV. JuryRoll reads CSV only. Convert the file first.
The positions below come from the "Public Information Voter Data File Record Layout" in the SOS request form (https://www.sos.state.tx.us/elections/forms/pi.pdf, checked 2026-10-07). Each record is 685 characters.

JuryRoll needs these columns:

| Column | Starts at | Length |
|---|---|---|
| LAST NAME | 23 | 50 |
| FIRST NAME | 73 | 50 |
| MIDDLE NAME | 123 | 50 |
| SUFFIX | 223 | 4 |
| DOB | 228 | 8 |
| PERM HOUSE NUMBER | 236 | 9 |
| PERM STREET NAME | 259 | 50 |
| PERM CITY | 347 | 50 |
| PERM ZIPCODE | 397 | 9 |
| EDR (effective date of registration) | 656 | 8 |
| STATUS CODE | 664 | 1 |

The layout does not state the date format for DOB and EDR. Look at a few rows before you start.

Keep the file on your own computer. Do not use an online converter. Do not email or upload the file.

**Excel**

1. Unzip the file from the SOS.
2. In Excel, select File > Open. Select the .txt file. If Excel does not show the Text Import Wizard, turn on "From Text (Legacy)" in File > Options > Data, then use Data > Get Data > Legacy Wizards > From Text (Legacy).
3. In step 1, select "Fixed width". Click Next.
4. In step 2, set a break line at the start of each column in the table. The ruler counts from 0, so put each break at the "Starts at" number minus 1. Example: LAST NAME starts at 23, so put the break at 22.
5. In step 3, select each date column (DOB, EDR) and set "Text". This keeps the dates as they are. You can set columns you do not need to "Do not import column (skip)".
6. Click Finish.
7. Insert a first row. Type these headers: Last Name, First Name, Middle Name, Suffix, DOB, House Number, Street Name, City, Zip, Registration Date, Status.
8. Select File > Save As > "CSV UTF-8 (Comma delimited)".

**LibreOffice Calc**

1. Unzip the file from the SOS.
2. In Calc, select File > Open. Select the .txt file. The Text Import dialog opens.
3. Under "Separator Options", select "Fixed width".
4. Click the ruler to set a break at the start of each column in the table. The ruler counts from 0, as in Excel.
5. Click each date column. Set "Column type" to "Text". Set columns you do not need to "Hide".
6. Click OK.
7. Add the header row from Excel step 7.
8. Select File > Save As. Select "Text CSV (.csv)". Keep the format when Calc asks.

Excel and Calc open at most 1,048,576 rows. A large county file can have more. If the program warns that the file did not load completely, do not use the result. Ask the SOS for a smaller file, for example one county or one precinct range.
