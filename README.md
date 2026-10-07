# JuryRoll v1

Open `index.html` in a browser. Load the juror file and the voter roll. Check the column mapping and the reasons. Click "Run the match".
All processing occurs in the browser. The page makes no network requests.

Sample data (fictional): `sample_juror_disqualifications.csv`, `sample_voter_roll.csv`.
Expected result with the samples: Strong 3, Probable 4, Weak 2.

Tests (need Node 18+ and Chrome at /usr/bin/google-chrome for the UI test):

    cd test && npm install && node core.test.js && node ui.test.js

`core.test.js` loads the `<script id="juryroll-core">` block from index.html and runs the match on the samples.
`ui.test.js` drives the page in headless Chrome, checks the counts and the export, and writes `screenshot.png`.
