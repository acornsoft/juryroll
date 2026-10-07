# Developing JuryRoll

The app is a static Vite build in `app/`. The matcher, the policy layer, the samples, the templates, and the guide live in `shared/`. The browser imports that code. It does not fetch it.

## Commands

```bash
npm ci
python3 -m pip install -r shared/rules/requirements.txt
python3 shared/rules/validate.py
npm test
npm run build
```

`npm run build` writes `app/dist`. Open `app/dist/index.html` from disk or host that folder. Paths are relative. `staticwebapp.config.json` is copied into the output and the build fills in the Content-Security-Policy header. The footer build id is the first 7 characters of `GITHUB_SHA` in CI, or of `git rev-parse HEAD` on a local build. It is injected with Vite `define`. The page does not look it up.

## What not to edit

- `shared/src/core.js` is the version 1 matcher. Do not change its tier rules. Tests in `test/core.test.mjs` keep the original assertions.
- `shared/rules/*.json` and `shared/rules/validate.py` are legal data. Do not edit them to make a test pass. If a file fails `validate.py`, report that and stop.
- `shared/GUIDE.md` is the guidance source. The build renders `guide.html` from it.

## Policy

`shared/src/policy/apply.ts` runs after `match()`. `applyDateRule` does not read the state code. A full registration date after a full jury declaration date is not a lead. The screen shows `N matches excluded: registered after declaration`.

A missing, unparseable, or equal registration date, or a missing jury declaration date, is excluded from named lists and named exports and counted as `N matches cannot compare: no registration date`. Both lines are shown even when the count is 0. A registration before the declaration keeps its tier. Leads plus the two counts equal the number of matched pairs.

The UI uses the strict setting. Tests also cover a lenient setting, which is not offered in the UI. The wrongful-removal flag can still use a registration-after-declaration fact for a removed or inactive voter. An excluded person is counted, not named.

North Carolina and Pennsylvania are the states whose effective gates allow a named referral. No current state file turns on challenge guidance. Connecticut and the District of Columbia stay counts only, with a banner that the counts are not evidence of unlawful registration. North Dakota has no voter registration, so a last-voted date is not treated as a registration date.

## Tests

`npm test` runs the matcher, the policy tests (AT-01 through the date, status, column, and log checks), the Excel sample, the content and gitignore checks, the type check, the production build, and the browser test. The browser test opens `app/dist/index.html` with `file://` and records network requests.
