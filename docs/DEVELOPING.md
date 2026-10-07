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

`npm run build` writes `app/dist`. Open `app/dist/index.html` from disk or host that folder. Paths are relative. `staticwebapp.config.json` is copied into the output and the build fills in the Content-Security-Policy header.

## What not to edit

- `shared/src/core.js` is the version 1 matcher. Do not change its tier rules. Tests in `test/core.test.mjs` keep the original assertions.
- `shared/rules/*.json` and `shared/rules/validate.py` are legal data. Do not edit them to make a test pass. If a file fails `validate.py`, report that and stop.
- `shared/GUIDE.md` is the guidance source. The build renders `guide.html` from it.

## Policy

`shared/src/policy/apply.ts` runs after `match()`. A full registration date after a full jury declaration date sets `excluded`. That row is not a lead at any tier. It is left out of every named list and every named export. The screen shows `N matches excluded: registered after declaration`.

A registration on or before the declaration keeps the tier. If either date is missing, the tier stays and the row notes `date missing` and `Official SAVE / naturalization check required`. If the rules file does not say the registration date is in the public file, the row notes `cannot compare` and is not excluded.

The wrongful-removal flag can still use a registration-after-declaration fact for a removed or inactive voter. An excluded person is counted, not named.

North Carolina is the only shipped state that loads a jury list and exports names. The other shipped states are counts only.

## Tests

`npm test` runs the matcher, the policy tests (AT-01 through the date, status, column, and log checks), the Excel sample, the content and gitignore checks, the type check, the production build, and the browser test. The browser test opens `app/dist/index.html` with `file://` and records network requests.
