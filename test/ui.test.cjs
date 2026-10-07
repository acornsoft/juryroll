const { chromium } = require('playwright-core');
const http = require('http');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'app', 'dist', 'index.html');
const shots = '/opt/cursor/artifacts/screenshots';
fs.mkdirSync(shots, { recursive: true });

const chromeCandidates = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const chrome = chromeCandidates.find((item) => fs.existsSync(item));
if (!chrome) {
  console.error('Chrome not found');
  process.exit(1);
}

const sampleJ = path.join(root, 'shared/samples/sample_juror_disqualifications.csv');
const sampleV = path.join(root, 'shared/samples/sample_voter_roll.csv');
const sampleJx = path.join(root, 'shared/samples/sample_juror_disqualifications.xlsx');
const sampleVx = path.join(root, 'shared/samples/sample_voter_roll.xlsx');

function pass(id) {
  console.log(`${id} PASS`);
}

async function openPage(browser, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith('file:') && !url.startsWith('blob:') && !url.startsWith('data:')) requests.push(url);
  });
  page.on('dialog', (dialog) => dialog.accept());
  if (options.time) await page.clock.install({ time: new Date(options.time) });
  await page.goto('file://' + dist);
  return { context, page, errors, requests };
}

async function attest(page) {
  for (let i = 1; i <= 5; i += 1) await page.check(`#attest${i}`);
  await page.fill('#initials', 'AB');
}

function startPreview() {
  const distDir = path.join(root, 'app', 'dist');
  const config = JSON.parse(fs.readFileSync(path.join(distDir, 'staticwebapp.config.json'), 'utf8'));
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    ...config.mimeTypes,
  };
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const rel = pathname === '/' ? '/index.html' : pathname;
    const excluded = (config.navigationFallback.exclude || []).some((pattern) => {
      if (pattern.endsWith('/*')) return rel.startsWith(pattern.slice(0, -1));
      if (pattern.startsWith('*.')) return rel.endsWith(pattern.slice(1));
      return rel === pattern;
    });
    let file = path.normalize(path.join(distDir, rel));
    const escaped = path.relative(distDir, file).startsWith('..') || path.isAbsolute(path.relative(distDir, file));
    if (escaped) {
      res.writeHead(400);
      res.end();
      return;
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      if (excluded) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('not found');
        return;
      }
      file = path.join(distDir, 'index.html');
    }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function requestHeaders(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      res.resume();
      const headers = {};
      Object.entries(res.headers).forEach(([key, value]) => { headers[key] = String(value); });
      resolve({ status: res.statusCode, ...headers });
    }).on('error', reject);
  });
}

async function pickCounty(page, fips = '37183') {
  await page.selectOption('#county', fips);
}

(async () => {
  const built = fs.readFileSync(dist, 'utf8');
  assert.ok(built.includes("connect-src 'none'"), 'CSP connect-src');
  assert.ok(!/<script[^>]+src=/.test(built), 'scripts must be inlined');
  const config = fs.readFileSync(path.join(root, 'app/dist/staticwebapp.config.json'), 'utf8');
  assert.ok(config.includes("connect-src 'none'"));
  pass('AT-29-csp');

  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  const first = await openPage(browser);
  await first.page.screenshot({ path: path.join(shots, '01-state-picker.png'), fullPage: true });
  await first.page.setViewportSize({ width: 390, height: 844 });
  await first.page.screenshot({ path: path.join(shots, '01b-state-picker-mobile.png'), fullPage: true });
  await first.page.setViewportSize({ width: 1360, height: 900 });
  assert.ok(await first.page.isVisible('#federalBanner'));
  assert.strictEqual(await first.page.locator('#exportBtn').count(), 0);
  pass('AT-07-banner');

  for (const name of [
    'juror-template.csv',
    'voter-template.csv',
    'juror-template.xlsx',
    'voter-template.xlsx',
    'sample_juror_disqualifications.csv',
    'sample_juror_disqualifications.xlsx',
    'sample_voter_roll.csv',
    'sample_voter_roll.xlsx',
  ]) {
    assert.strictEqual(await first.page.locator(`a[download="${name}"]`).count(), 1, name);
  }
  const templateHref = await first.page.locator('a[download="juror-template.xlsx"]').getAttribute('href');
  assert.ok(templateHref && templateHref.includes('/assets/') && templateHref.endsWith('.xlsx'), templateHref);
  const [csvDownload] = await Promise.all([
    first.page.waitForEvent('download'),
    first.page.click('a[download="juror-template.csv"]'),
  ]);
  assert.strictEqual(csvDownload.suggestedFilename(), 'juror-template.csv');
  const [xlsxDownload] = await Promise.all([
    first.page.waitForEvent('download'),
    first.page.click('a[download="juror-template.xlsx"]'),
  ]);
  assert.strictEqual(await first.page.locator('a[download="juror-template.xlsx"]').getAttribute('download'), 'juror-template.xlsx');
  assert.match(xlsxDownload.suggestedFilename(), /\.xlsx$/);
  const xlsxSaved = path.join(shots, 'juror-template-download.xlsx');
  await xlsxDownload.saveAs(xlsxSaved);
  const xlsxBytes = fs.readFileSync(xlsxSaved);
  assert.strictEqual(xlsxBytes[0], 0x50);
  assert.strictEqual(xlsxBytes[1], 0x4b);
  pass('AT-41-downloads');

  await first.page.selectOption('#stateSel', 'NY');
  await first.page.screenshot({ path: path.join(shots, '07-blackout-aggregate.png'), fullPage: true });
  assert.strictEqual(await first.page.locator('#fileJuror').count(), 0);
  assert.strictEqual(await first.page.locator('#fileVoter').count(), 0);
  assert.strictEqual(await first.page.locator('#sampleBtn').count(), 0);
  assert.strictEqual(await first.page.locator('#runBtn').count(), 0);
  assert.strictEqual(await first.page.locator('#exportBtn').count(), 0);
  assert.strictEqual(await first.page.locator('#results tr').count(), 0);
  assert.ok(await first.page.isVisible('#auditMode'));
  assert.ok(await first.page.isVisible('#auditLetter'));
  const nyRules = JSON.parse(fs.readFileSync(path.join(root, 'shared/rules/NY.json'), 'utf8'));
  const nyRefuse = await first.page.locator('#juryRefuse').innerText();
  assert.ok(nyRefuse.includes(nyRules.gates.basis), nyRefuse);
  assert.ok((await first.page.locator('#federalBanner').innerText()).includes('Federal 90-day window'));
  pass('AT-06');

  await first.page.selectOption('#stateSel', 'WY');
  assert.strictEqual(await first.page.locator('#rulesFallback').count(), 0);
  assert.strictEqual(await first.page.locator('#fileJuror').count(), 0);
  assert.ok(await first.page.isVisible('#auditMode'));
  pass('AT-03-live-wy');

  await first.page.selectOption('#stateSel', 'TX');
  const blocked = await first.page.locator('#juryBlocked').innerText();
  assert.ok(blocked.includes('confidential'));
  assert.ok(blocked.includes("Gov't Code 62.0132"));
  await first.page.evaluate(() => {
    const proto = FileReader.prototype;
    const original = proto.readAsText;
    window.__reads = 0;
    proto.readAsText = function readAsTextSpy(...args) {
      window.__reads += 1;
      return original.apply(this, args);
    };
    const slot = document.getElementById('jurorSlot');
    const transfer = new DataTransfer();
    transfer.items.add(new File(['Juror Number,Last\n1,Smith'], 'people.csv', { type: 'text/csv' }));
    slot.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  assert.strictEqual(await first.page.evaluate(() => window.__reads), 0);
  assert.strictEqual(await first.page.locator('#infoJuror').count(), 0);
  pass('AT-05');
  assert.deepStrictEqual(first.requests, [], 'network requests: ' + first.requests.join('; '));
  await first.context.close();

  const main = await openPage(browser);
  await main.page.selectOption('#stateSel', 'NC');
  assert.strictEqual(await main.page.locator('#fileJuror').count(), 1);
  assert.strictEqual(await main.page.locator('#runBtn').isDisabled(), true);
  await attest(main.page);
  assert.strictEqual(await main.page.locator('#challengeFormLink').count(), 1);
  assert.strictEqual(await main.page.locator('#deadlineBanner').count(), 0);
  assert.ok((await main.page.locator('#leadBanner').innerText()).includes('A JuryRoll match alone does not meet this standard'));
  assert.ok((await main.page.locator('#oneAffidavit').innerText()).includes('Use one affidavit for one voter.'));
  pass('AT-31');
  pass('AT-32');
  await pickCounty(main.page);
  await main.page.screenshot({ path: path.join(shots, '02-step-files.png'), fullPage: true });
  await main.page.setInputFiles('#fileJuror', sampleJ);
  await main.page.waitForSelector('#infoJuror');
  await main.page.setInputFiles('#fileVoter', sampleV);
  await main.page.waitForSelector('#infoVoter');
  assert.strictEqual(await main.page.locator('#mapJuror-declDate').count(), 1);
  assert.strictEqual(await main.page.locator('#mapJuror-regDate').count(), 1);
  assert.strictEqual(await main.page.locator('#mapVoter-declDate').count(), 1);
  assert.strictEqual(await main.page.locator('#mapVoter-regDate').count(), 1);
  const jurorDecl = await main.page.locator('#mapJuror-declDate').inputValue();
  const voterReg = await main.page.locator('#mapVoter-regDate').inputValue();
  assert.notStrictEqual(jurorDecl, '-1');
  assert.match(await main.page.locator('#mapJuror-declDate option:checked').innerText(), /disqualification/i);
  assert.match(await main.page.locator('#mapVoter-regDate option:checked').innerText(), /registration/i);
  await main.page.selectOption('#mapJuror-declDate', '-1');
  assert.strictEqual(await main.page.locator('#mapJuror-declDate').inputValue(), '-1');
  await main.page.selectOption('#mapJuror-declDate', jurorDecl);
  await main.page.selectOption('#mapVoter-regDate', '-1');
  assert.strictEqual(await main.page.locator('#mapVoter-regDate').inputValue(), '-1');
  await main.page.selectOption('#mapVoter-regDate', voterReg);
  await main.page.screenshot({ path: path.join(shots, '03-step-mapping.png'), fullPage: true });
  await main.page.screenshot({ path: path.join(shots, '04-step-reasons.png'), fullPage: true });
  await main.page.waitForFunction(() => !document.getElementById('runBtn').disabled);
  await main.page.click('#runBtn');
  await main.page.waitForSelector('#countStrong');
  const counts = await main.page.evaluate(() => ['Strong', 'Probable', 'Weak'].map((tier) => Number(document.querySelector(`#count${tier} .n`).textContent)));
  console.log('UI tier counts [Strong, Probable, Weak]:', counts);
  assert.deepStrictEqual(counts, [0, 3, 2]);
  assert.ok((await main.page.locator('#matcherCounts').innerText()).includes('Strong 3, Probable 4, Weak 2'));
  assert.ok((await main.page.locator('#tierCapBadge').innerText()).includes('North Carolina'));
  assert.ok((await main.page.locator('#excludedLine').innerText()).includes('2 matches excluded: registered after declaration'));
  assert.ok((await main.page.locator('#cannotCompareLine').innerText()).includes('2 matches cannot compare: no registration date'));
  assert.ok((await main.page.locator('#regDateNote').innerText()).includes('latest registration change'));
  assert.ok((await main.page.locator('#templateDateNote').innerText()).includes('The registration date is needed for a named referral.'));
  assert.match(await main.page.locator('#referralHeader').innerText(), /Wake County \(37183\)/);
  const rowsDefault = await main.page.locator('#results tr').count() - 1;
  assert.strictEqual(rowsDefault, 3, 'named leads are the pairs registered before the declaration');
  const namedText = await main.page.locator('#results').innerText();
  assert.ok(namedText.includes('Alpha'));
  assert.ok(!namedText.includes('Foxtrot'));
  assert.ok(!namedText.includes('Lima'));
  assert.ok(!namedText.includes('Fictitious'));
  assert.ok(!namedText.includes('Echo'));
  assert.strictEqual(await main.page.locator('#exportWeak').count(), 0);
  pass('AT-08');
  pass('AT-09');
  await main.page.screenshot({ path: path.join(shots, '05-confidential-referral.png'), fullPage: true });
  await main.page.emulateMedia({ media: 'print' });
  assert.strictEqual(await main.page.locator('#runBtn').isVisible(), false);
  assert.strictEqual(await main.page.locator('#fileJuror').isVisible(), false);
  assert.strictEqual(await main.page.locator('#caveats').isVisible(), true);
  assert.strictEqual(await main.page.locator('#tierRules').isVisible(), true);
  await main.page.screenshot({ path: path.join(shots, '06-print.png'), fullPage: true });
  await main.page.emulateMedia({ media: 'screen' });

  const [download] = await Promise.all([
    main.page.waitForEvent('download'),
    main.page.click('#exportBtn'),
  ]);
  const exportPath = path.join(shots, 'export.csv');
  await download.saveAs(exportPath);
  const csv = fs.readFileSync(exportPath, 'utf8').replace(/^\uFEFF/, '');
  console.log('Export file name:', download.suggestedFilename());
  assert.ok(download.suggestedFilename().startsWith('JuryRoll-referral-NC-WakeCounty-'));
  assert.ok(csv.includes('County: Wake County (37183).'));
  assert.ok(csv.startsWith('Referral for official verification'));
  assert.ok(csv.includes('2 matches excluded: registered after declaration'));
  assert.ok(csv.includes('2 matches cannot compare: no registration date'));
  assert.ok(csv.includes('Official SAVE or naturalization check required before any action. A match is not proof. Do not publish. Do not contact the voter.'));
  assert.ok(!/^Weak,/m.test(csv));
  assert.ok(csv.includes('Alpha'));
  assert.ok(!csv.includes('Foxtrot'));
  assert.ok(!csv.includes('V0011'));
  assert.ok(!csv.includes('V0005'));
  assert.ok(!csv.includes('V0007'));
  await main.page.waitForSelector('#purgeNow');
  assert.ok((await main.page.locator('#purgeTitle').innerText()).includes('Referral saved. Purge the data now?'));
  await main.page.screenshot({ path: path.join(shots, '05b-purge-prompt.png'), fullPage: true });
  await main.page.click('#keepData');

  await main.page.locator('#weakDetails').evaluate((el) => { el.open = true; });
  await main.page.check('#showWeak');
  assert.ok(await main.page.isVisible('#weakWarn'));
  const storage = await main.page.evaluate(async () => {
    const databases = indexedDB.databases ? (await indexedDB.databases()).map((item) => item.name) : [];
    return { local: Object.keys(localStorage), session: Object.keys(sessionStorage), cookies: document.cookie, databases };
  });
  assert.deepStrictEqual(storage.local, []);
  assert.deepStrictEqual(storage.session, []);
  assert.strictEqual(storage.cookies, '');
  assert.ok(storage.databases.includes('juryroll-audit'), 'databases: ' + storage.databases.join(','));
  assert.strictEqual(storage.databases.every((name) => name === 'juryroll-audit'), true);
  pass('AT-28');

  const [logDownload] = await Promise.all([
    main.page.waitForEvent('download'),
    main.page.click('#downloadLog'),
  ]);
  const logPath = path.join(shots, 'audit.jsonl');
  await logDownload.saveAs(logPath);
  const entries = fs.readFileSync(logPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  const types = entries.map((entry) => entry.type);
  console.log('Audit types:', types.join(', '));
  assert.deepStrictEqual(types, ['session_start', 'rules_loaded', 'attestation_signed', 'file_loaded', 'file_loaded', 'mapping_set', 'match_run', 'export']);
  const matchRun = entries.find((entry) => entry.type === 'match_run');
  assert.strictEqual(matchRun.data.excluded_registered_after, 2);
  assert.strictEqual(matchRun.data.cannot_compare_no_reg_date, 2);
  assert.strictEqual(matchRun.data.county_name, 'Wake County');
  assert.strictEqual(matchRun.data.county_fips, '37183');
  assert.strictEqual(entries.find((entry) => entry.type === 'export').data.county_fips, '37183');
  const logText = fs.readFileSync(logPath, 'utf8');
  assert.ok(!logText.includes('Alpha'));
  assert.ok(!logText.includes('J-0001'));
  assert.ok(!logText.includes('sample_juror'));
  assert.ok(!logText.includes('100 Example'));
  pass('AT-22');

  await main.page.click('#purgeBtn');
  await main.page.waitForFunction(() => document.body.dataset.purged === '1' && !document.body.dataset.hasFiles && document.body.dataset.logCleared === '1');
  assert.strictEqual(await main.page.locator('#results tr').count(), 0);
  assert.strictEqual(await main.page.locator('#fileJuror').inputValue(), '');
  assert.strictEqual(await main.page.locator('#fileVoter').inputValue(), '');
  const cleared = await main.page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('juryroll-audit');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('log', 'readonly').objectStore('log').getAll();
      request.onsuccess = () => {
        db.close();
        resolve(request.result.length);
      };
      request.onerror = () => reject(request.error);
    };
  }));
  assert.strictEqual(cleared, 0);
  pass('AT-25');
  pass('AT-28-after-purge');
  assert.deepStrictEqual(main.errors, [], 'page errors: ' + main.errors.join('; '));
  assert.deepStrictEqual(main.requests, [], 'network requests: ' + main.requests.join('; '));
  pass('AT-29');
  await main.context.close();

  const datesDir = path.join(shots, 'fixtures');
  fs.mkdirSync(datesDir, { recursive: true });
  fs.writeFileSync(path.join(datesDir, 'juror.csv'), 'Juror Number,Last,First,Birth Date,Address,Zip,Disqualification Reason,Disqualification Date\nJ1,Afterson,Ann,03/14/1980,1 Main St,00001,Not a U.S. citizen,2020-01-15\nJ2,Keepson,Bob,04/02/1981,2 Main St,00001,Not a U.S. citizen,2020-06-01\nJ3,Missingson,Cam,05/03/1982,3 Main St,00001,Not a U.S. citizen,\n');
  fs.writeFileSync(path.join(datesDir, 'voter.csv'), 'voter_id,name_last,name_first,date_of_birth,res_street,res_zip,status,registration_date\nV1,Afterson,Ann,1980-03-14,1 Main St,00001,ACTIVE,2021-05-01\nV2,Keepson,Bob,1981-04-02,2 Main St,00001,ACTIVE,2019-01-01\nV3,Missingson,Cam,1982-05-03,3 Main St,00001,ACTIVE,\n');
  const dates = await openPage(browser);
  await dates.page.selectOption('#stateSel', 'NC');
  await attest(dates.page);
  await pickCounty(dates.page);
  await dates.page.setInputFiles('#fileJuror', path.join(datesDir, 'juror.csv'));
  await dates.page.waitForSelector('#infoJuror');
  await dates.page.setInputFiles('#fileVoter', path.join(datesDir, 'voter.csv'));
  await dates.page.waitForFunction(() => !document.getElementById('runBtn').disabled);
  await dates.page.click('#runBtn');
  await dates.page.waitForSelector('#excludedLine');
  const excluded = await dates.page.locator('#excludedLine').innerText();
  const cannot = await dates.page.locator('#cannotCompareLine').innerText();
  assert.ok(excluded.includes('1 matches excluded: registered after declaration'));
  assert.ok(cannot.includes('1 matches cannot compare: no registration date'));
  const bodyText = await dates.page.locator('body').innerText();
  assert.ok(!bodyText.includes('Afterson'));
  assert.ok(bodyText.includes('Keepson'));
  assert.ok(!bodyText.includes('Missingson'));
  assert.ok(bodyText.includes('Official SAVE / naturalization check required'));
  const [dateDownload] = await Promise.all([
    dates.page.waitForEvent('download'),
    dates.page.click('#exportBtn'),
  ]);
  const dateCsvPath = path.join(datesDir, 'out.csv');
  await dateDownload.saveAs(dateCsvPath);
  const dateCsv = fs.readFileSync(dateCsvPath, 'utf8');
  assert.ok(!dateCsv.includes('Afterson'));
  assert.ok(dateCsv.includes('Keepson'));
  assert.ok(!dateCsv.includes('Missingson'));
  assert.ok(dateCsv.includes('1 matches excluded: registered after declaration'));
  assert.ok(dateCsv.includes('1 matches cannot compare: no registration date'));
  pass('AT-10');
  pass('AT-11');
  pass('AT-13-dates');
  await dates.context.close();

  const refused = await openPage(browser);
  await refused.page.selectOption('#stateSel', 'NC');
  await attest(refused.page);
  const ssnPath = path.join(datesDir, 'ssn.csv');
  fs.writeFileSync(ssnPath, 'voter_id,name_last,name_first,ssn\n1,Ada,Bee,123-45-6789\n');
  await refused.page.setInputFiles('#fileVoter', ssnPath);
  await refused.page.waitForSelector('#fileError');
  assert.ok((await refused.page.locator('#fileError').innerText()).toLowerCase().includes('ssn'));
  assert.strictEqual(await refused.page.locator('#infoVoter').count(), 0);
  pass('AT-20');
  await refused.context.close();

  const xlsx = await openPage(browser);
  await xlsx.page.selectOption('#stateSel', 'NC');
  await attest(xlsx.page);
  await pickCounty(xlsx.page);
  await xlsx.page.setInputFiles('#fileJuror', sampleJx);
  await xlsx.page.waitForSelector('#infoJuror');
  await xlsx.page.setInputFiles('#fileVoter', sampleVx);
  await xlsx.page.waitForFunction(() => !document.getElementById('runBtn').disabled);
  await xlsx.page.click('#runBtn');
  await xlsx.page.waitForSelector('#matcherCounts');
  const xlsxCounts = await xlsx.page.evaluate(() => ['Strong', 'Probable', 'Weak'].map((tier) => Number(document.querySelector(`#count${tier} .n`).textContent)));
  assert.deepStrictEqual(xlsxCounts, [0, 3, 2]);
  assert.ok((await xlsx.page.locator('#matcherCounts').innerText()).includes('Strong 3, Probable 4, Weak 2'));
  assert.deepStrictEqual(xlsx.errors, [], 'xlsx page errors: ' + xlsx.errors.join('; '));
  console.log('XLSX UI counts [Strong, Probable, Weak]:', xlsxCounts);
  pass('AT-XLSX');
  await xlsx.context.close();

  const later = await openPage(browser, { time: '2026-10-10T15:00:00Z' });
  await later.page.selectOption('#stateSel', 'NC');
  await attest(later.page);
  assert.ok((await later.page.locator('#deadlineBanner').innerText()).includes('The state deadline for this election has passed (2026-10-09).'));
  assert.strictEqual(await later.page.locator('#challengeFormLink').count(), 0);
  pass('AT-31-passed');
  await later.context.close();

  const timed = await openPage(browser, { time: '2026-10-07T15:00:00Z' });
  await timed.page.selectOption('#stateSel', 'NC');
  await attest(timed.page);
  await pickCounty(timed.page);
  await timed.page.setInputFiles('#fileJuror', sampleJ);
  await timed.page.waitForSelector('#infoJuror');
  await timed.page.setInputFiles('#fileVoter', sampleV);
  await timed.page.waitForFunction(() => !document.getElementById('runBtn').disabled);
  await timed.page.click('#runBtn');
  await timed.page.waitForSelector('#exportBtn');
  const [timedDownload] = await Promise.all([
    timed.page.waitForEvent('download'),
    timed.page.click('#exportBtn'),
  ]);
  await timedDownload.saveAs(path.join(shots, 'timed-export.csv'));
  await timed.page.waitForSelector('#purgeNow');
  await timed.page.clock.fastForward(10 * 60 * 1000);
  await timed.page.waitForFunction(() => document.body.dataset.purged === '1' && document.body.dataset.logCleared === '1');
  pass('AT-26');
  await timed.context.close();

  const idle = await openPage(browser, { time: '2026-10-07T15:00:00Z' });
  await idle.page.selectOption('#stateSel', 'NC');
  await attest(idle.page);
  await idle.page.setInputFiles('#fileJuror', sampleJ);
  await idle.page.waitForSelector('#infoJuror');
  await idle.page.clock.fastForward(28 * 60 * 1000);
  await idle.page.waitForSelector('#idleWarn');
  await idle.page.clock.fastForward(2 * 60 * 1000);
  await idle.page.waitForFunction(() => document.body.dataset.purged === '1' && document.body.dataset.logCleared === '1');
  pass('AT-27');
  assert.deepStrictEqual(idle.errors, [], 'idle page errors: ' + idle.errors.join('; '));
  await idle.context.close();

  const fixtures = path.join(root, 'test/fixtures');
  async function runPair(page, jurorName, voterName) {
    await page.selectOption('#stateSel', 'NC');
    await attest(page);
    await pickCounty(page);
    await page.setInputFiles('#fileJuror', path.join(fixtures, jurorName));
    await page.waitForSelector('#infoJuror');
    await page.setInputFiles('#fileVoter', path.join(fixtures, voterName));
    await page.waitForFunction(() => !document.getElementById('runBtn').disabled);
    await page.click('#runBtn');
    await page.waitForSelector('#cannotCompareLine');
  }

  const missing = await openPage(browser);
  await runPair(missing.page, 'juror_missing_reg.csv', 'voter_missing_reg.csv');
  assert.ok((await missing.page.locator('#cannotCompareLine').innerText()).includes('1 matches cannot compare: no registration date'));
  assert.ok((await missing.page.locator('#excludedLine').innerText()).includes('0 matches excluded: registered after declaration'));
  assert.ok(!(await missing.page.locator('body').innerText()).includes('Missingson'));
  const [missingDownload] = await Promise.all([
    missing.page.waitForEvent('download'),
    missing.page.click('#exportBtn'),
  ]);
  const missingPath = path.join(shots, 'missing-reg.csv');
  await missingDownload.saveAs(missingPath);
  const missingCsv = fs.readFileSync(missingPath, 'utf8');
  assert.ok(!missingCsv.includes('Missingson'));
  assert.ok(missingCsv.includes('1 matches cannot compare: no registration date'));
  pass('AT-12-missing');
  await missing.context.close();

  const equal = await openPage(browser);
  await runPair(equal.page, 'juror_equal.csv', 'voter_equal.csv');
  assert.ok((await equal.page.locator('#cannotCompareLine').innerText()).includes('1 matches cannot compare: no registration date'));
  assert.ok((await equal.page.locator('#excludedLine').innerText()).includes('0 matches excluded: registered after declaration'));
  assert.ok(!(await equal.page.locator('body').innerText()).includes('Equalson'));
  const [equalDownload] = await Promise.all([
    equal.page.waitForEvent('download'),
    equal.page.click('#exportBtn'),
  ]);
  const equalPath = path.join(shots, 'equal-date.csv');
  await equalDownload.saveAs(equalPath);
  assert.ok(!fs.readFileSync(equalPath, 'utf8').includes('Equalson'));
  pass('AT-12');
  await equal.context.close();

  const before = await openPage(browser);
  await runPair(before.page, 'juror_before_only.csv', 'voter_before_only.csv');
  assert.ok((await before.page.locator('#excludedLine').innerText()).includes('0 matches excluded: registered after declaration'));
  assert.ok((await before.page.locator('#cannotCompareLine').innerText()).includes('0 matches cannot compare: no registration date'));
  assert.ok((await before.page.locator('#results').innerText()).includes('Keepson'));
  pass('AT-39');
  await before.context.close();

  const noReg = await openPage(browser);
  await runPair(noReg.page, 'juror_three.csv', 'voter_no_regdate.csv');
  assert.ok((await noReg.page.locator('#cannotCompareLine').innerText()).includes('3 matches cannot compare: no registration date'));
  assert.ok((await noReg.page.locator('#excludedLine').innerText()).includes('0 matches excluded: registered after declaration'));
  assert.strictEqual(await noReg.page.locator('#results tbody tr').count(), 0);
  const [noRegDownload] = await Promise.all([
    noReg.page.waitForEvent('download'),
    noReg.page.click('#exportBtn'),
  ]);
  const noRegPath = path.join(shots, 'no-reg.csv');
  await noRegDownload.saveAs(noRegPath);
  const noRegCsv = fs.readFileSync(noRegPath, 'utf8');
  assert.ok(noRegCsv.includes('3 matches cannot compare: no registration date'));
  assert.ok(noRegCsv.includes('0 matches excluded: registered after declaration'));
  assert.ok(!noRegCsv.includes('Pellson'));
  assert.ok(!/^Strong,|^Probable,|^Weak,/m.test(noRegCsv));
  await noReg.page.waitForSelector('#keepData');
  await noReg.page.click('#keepData');
  const [noRegLog] = await Promise.all([
    noReg.page.waitForEvent('download'),
    noReg.page.click('#downloadLog'),
  ]);
  const noRegLogPath = path.join(shots, 'no-reg-audit.jsonl');
  await noRegLog.saveAs(noRegLogPath);
  const noRegEntries = fs.readFileSync(noRegLogPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  const noRegMatch = noRegEntries.find((entry) => entry.type === 'match_run');
  assert.strictEqual(noRegMatch.data.cannot_compare_no_reg_date, 3);
  assert.strictEqual(noRegMatch.data.excluded_registered_after, 0);
  pass('AT-37');
  await noReg.context.close();

  const blankDecl = await openPage(browser);
  await runPair(blankDecl.page, 'juror_missing_decl.csv', 'voter_missing_decl.csv');
  assert.ok((await blankDecl.page.locator('#cannotCompareLine').innerText()).includes('1 matches cannot compare: no registration date'));
  assert.ok(!(await blankDecl.page.locator('#results').innerText()).includes('Blankdecl'));
  pass('AT-40');
  await blankDecl.context.close();

  const dc = await openPage(browser);
  await dc.page.selectOption('#stateSel', 'DC');
  const dcBanner = await dc.page.locator('#nonSignalBanner').innerText();
  assert.ok(dcBanner.includes('D.C. lets non-citizens vote'));
  assert.ok(dcBanner.includes('not evidence of unlawful registration in this jurisdiction'));
  assert.strictEqual(await dc.page.locator('#challengePanel').count(), 0);
  assert.strictEqual(await dc.page.locator('#fileJuror').count(), 0);
  assert.strictEqual(await dc.page.locator('#exportBtn').count(), 0);
  pass('AT-34');
  await dc.context.close();

  const nd = await openPage(browser);
  await nd.page.selectOption('#stateSel', 'ND');
  assert.ok((await nd.page.locator('#ndBanner').innerText()).includes('North Dakota has no voter registration'));
  assert.strictEqual(await nd.page.locator('#challengePanel').count(), 0);
  assert.strictEqual(await nd.page.locator('#fileJuror').count(), 0);
  pass('AT-35');
  await nd.context.close();

  const ca = await openPage(browser);
  await ca.page.selectOption('#stateSel', 'CA');
  const limit = await ca.page.locator('#useLimitBanner').innerText();
  assert.ok(limit.includes('Your state limits how its voter list may be used'));
  assert.ok(limit.includes('Election, scholarly, journalistic, political, or governmental purposes'));
  assert.ok(limit.includes('2194'));
  assert.strictEqual(await ca.page.locator('#challengePanel').count(), 0);
  pass('AT-36');
  await ca.context.close();

  const gate = await openPage(browser);
  await gate.page.selectOption('#stateSel', 'NC');
  await gate.page.waitForSelector('#sampleBtn');
  async function enableMatch() {
    await gate.page.evaluate(() => {
      for (const id of ['step1', 'step2', 'step3', 'sampleBtn', 'runBtn', 'fileJuror', 'fileVoter']) {
        const node = document.getElementById(id);
        if (node) node.disabled = false;
      }
    });
  }
  await enableMatch();
  await gate.page.click('#sampleBtn');
  await gate.page.waitForSelector('#fileError');
  assert.match(await gate.page.locator('#fileError').innerText(), /initials/);
  assert.strictEqual(await gate.page.locator('#infoJuror').count(), 0);
  assert.strictEqual(await gate.page.locator('#infoVoter').count(), 0);
  await enableMatch();
  await gate.page.setInputFiles('#fileJuror', sampleJ);
  await enableMatch();
  await gate.page.setInputFiles('#fileVoter', sampleV);
  await gate.page.waitForFunction(() => document.getElementById('fileJuror').files.length === 1);
  assert.strictEqual(await gate.page.locator('#infoJuror').count(), 0);
  assert.strictEqual(await gate.page.locator('#infoVoter').count(), 0);
  await gate.page.evaluate(() => {
    document.getElementById('step3').disabled = false;
    document.getElementById('runBtn').disabled = false;
  });
  await gate.page.click('#runBtn');
  assert.strictEqual(await gate.page.locator('#countStrong').count(), 0);
  assert.match(await gate.page.locator('#fileError').innerText(), /initials/);
  pass('AT-42-attest');
  await gate.context.close();

  const switched = await openPage(browser);
  await switched.page.selectOption('#stateSel', 'NC');
  await attest(switched.page);
  await switched.page.click('#sampleBtn');
  await switched.page.waitForSelector('#infoJuror');
  const entriesBefore = await switched.page.locator('#logPanel').innerText();
  await switched.page.evaluate(() => {
    document.getElementById('stateSel').dispatchEvent(new Event('change', { bubbles: true }));
  });
  await switched.page.waitForFunction((prev) => document.getElementById('logPanel').innerText !== prev, entriesBefore);
  assert.strictEqual(await switched.page.locator('#infoJuror').count(), 1);
  assert.strictEqual(await switched.page.locator('#jurorCleared').count(), 0);
  await switched.page.selectOption('#stateSel', 'NY');
  await switched.page.waitForSelector('#jurorCleared');
  assert.strictEqual(await switched.page.locator('#infoJuror').count(), 0);
  assert.strictEqual(await switched.page.locator('#sampleBtn').count(), 0);
  assert.strictEqual(await switched.page.locator('#runBtn').count(), 0);
  assert.strictEqual(await switched.page.locator('#fileVoter').count(), 0);
  const switchedBasis = JSON.parse(fs.readFileSync(path.join(root, 'shared/rules/NY.json'), 'utf8')).gates.basis;
  assert.ok((await switched.page.locator('#juryRefuse').innerText()).includes(switchedBasis));
  assert.ok((await switched.page.locator('#jurorCleared').innerText()).includes(switchedBasis));
  assert.match(await switched.page.locator('#jurorCleared').innerText(), /cleared/i);
  assert.ok(await switched.page.isVisible('#auditLetter'));
  await switched.page.selectOption('#stateSel', 'NC');
  await switched.page.waitForSelector('#fileJuror');
  assert.strictEqual(await switched.page.locator('#jurorCleared').count(), 0);
  assert.strictEqual(await switched.page.locator('#juryRefuse').count(), 0);
  assert.strictEqual(await switched.page.locator('#infoJuror').count(), 0);
  pass('AT-43-state-switch');
  await switched.context.close();

  const walk = await openPage(browser);
  await attest(walk.page);
  const codes = await walk.page.$$eval('#stateSel option', (opts) => opts.map((opt) => opt.value).filter(Boolean));
  assert.strictEqual(codes.length, 51);
  const ran = [];
  let loaded = false;
  for (const code of codes) {
    await walk.page.selectOption('#stateSel', code);
    await walk.page.waitForFunction((expected) => {
      const sel = document.querySelector('#stateSel');
      if (!sel || sel.value !== expected) return false;
      return Boolean(document.querySelector('#sampleBtn') || document.querySelector('#juryRefuse'));
    }, code);
    const sampleCount = await walk.page.locator('#sampleBtn').count();
    if (sampleCount > 0) {
      assert.strictEqual(await walk.page.locator('#sampleBtn').isEnabled(), true, `${code} sample button disabled`);
      assert.strictEqual(await walk.page.locator('#juryRefuse').count(), 0, code);
      if (!loaded) {
        await walk.page.click('#sampleBtn');
        await walk.page.waitForSelector('#infoJuror');
        await walk.page.waitForSelector('#infoVoter');
      } else {
        assert.strictEqual(await walk.page.locator('#infoJuror').count(), 1, `${code} kept the juror file`);
        assert.strictEqual(await walk.page.locator('#jurorCleared').count(), 0, code);
      }
      await walk.page.selectOption('#county', { index: 1 });
      await walk.page.waitForFunction(() => {
        const button = document.getElementById('runBtn');
        return button && !button.disabled;
      });
      await walk.page.click('#runBtn');
      await walk.page.waitForSelector('#countStrong');
      const strong = Number(await walk.page.locator('#countStrong .n').innerText());
      assert.ok(Number.isFinite(strong), code);
      loaded = true;
      ran.push(code);
    } else {
      assert.strictEqual(await walk.page.locator('#runBtn').count(), 0, `${code} run button still present`);
      assert.strictEqual(await walk.page.locator('#fileJuror').count(), 0, code);
      assert.strictEqual(await walk.page.locator('#fileVoter').count(), 0, code);
      const basis = JSON.parse(fs.readFileSync(path.join(root, 'shared/rules', `${code}.json`), 'utf8')).gates.basis;
      const refuse = (await walk.page.locator('#juryRefuse').innerText()).trim();
      assert.ok(refuse.includes(basis), `${code} missing explanation`);
      assert.ok(await walk.page.locator('#auditLetterBtn').isVisible(), code);
      if (loaded) {
        const cleared = await walk.page.locator('#jurorCleared').innerText();
        assert.match(cleared, /cleared/i, code);
        assert.ok(cleared.includes(basis), `${code} did not explain the cleared jury file`);
        loaded = false;
      }
    }
  }
  assert.deepStrictEqual(ran, ['NC']);
  pass('AT-44-all-states');
  await walk.context.close();

  const counties = await openPage(browser);
  assert.strictEqual(await counties.page.locator('#county').isDisabled(), true);
  assert.strictEqual(await counties.page.locator('#countyFilter').isDisabled(), true);
  await counties.page.selectOption('#stateSel', 'NC');
  await counties.page.waitForSelector('#county:not([disabled])');
  assert.strictEqual(await counties.page.locator('#county option').count(), 101);
  assert.strictEqual(await counties.page.locator('#county option').nth(1).innerText(), 'Alamance County (37001)');
  assert.ok(await counties.page.locator('#countyRequired').isVisible());
  await counties.page.evaluate(() => { document.getElementById('county').size = 12; });
  await counties.page.locator('#placePicker').screenshot({ path: path.join(shots, 'county-picker-nc.png') });
  await counties.page.evaluate(() => { document.getElementById('county').removeAttribute('size'); });
  await counties.page.fill('#countyFilter', 'wake');
  assert.strictEqual(await counties.page.locator('#county option').count(), 2);
  assert.strictEqual(await counties.page.locator('#county option').nth(1).getAttribute('value'), '37183');
  await counties.page.fill('#countyFilter', '');
  await pickCounty(counties.page);
  assert.strictEqual(await counties.page.locator('#countyRequired').count(), 0);
  await counties.page.selectOption('#stateSel', 'NY');
  assert.strictEqual(await counties.page.locator('#county').inputValue(), '');
  assert.ok(await counties.page.locator('#countyRequired').isVisible());
  assert.match(await counties.page.locator('#auditLetter').innerText(), /Choose a county/);
  assert.strictEqual(await counties.page.locator('#auditLetterBtn').isDisabled(), true);
  await counties.page.evaluate(() => { document.getElementById('auditLetterBtn').disabled = false; });
  await counties.page.click('#auditLetterBtn');
  assert.match(await counties.page.locator('#auditLetter').innerText(), /Choose a county/);
  await counties.page.selectOption('#county', '36047');
  const nyLetter = await counties.page.locator('#auditLetter').innerText();
  assert.ok(nyLetter.includes('Kings County (36047)'));
  assert.ok(nyLetter.includes('Kings County board of elections'));
  assert.ok(nyLetter.includes('New York State Board of Elections'));
  const [nyDownload] = await Promise.all([
    counties.page.waitForEvent('download'),
    counties.page.click('#auditLetterBtn'),
  ]);
  const nyPath = path.join(shots, 'ny-audit.txt');
  await nyDownload.saveAs(nyPath);
  const nyText = fs.readFileSync(nyPath, 'utf8');
  assert.ok(nyText.includes('Kings County (36047)'));
  assert.ok(nyText.includes('Kings County board of elections'));
  await counties.page.selectOption('#stateSel', 'NC');
  await counties.page.waitForSelector('#sampleBtn');
  await attest(counties.page);
  await counties.page.click('#sampleBtn');
  await counties.page.waitForSelector('#infoJuror');
  await counties.page.evaluate(() => {
    document.getElementById('step3').disabled = false;
    document.getElementById('runBtn').disabled = false;
  });
  await counties.page.click('#runBtn');
  assert.strictEqual(await counties.page.locator('#countStrong').count(), 0);
  assert.ok(await counties.page.locator('#countyRequired').isVisible());
  await pickCounty(counties.page);
  await counties.page.waitForFunction(() => !document.getElementById('runBtn').disabled);
  await counties.page.click('#runBtn');
  await counties.page.waitForSelector('#countStrong');
  assert.match(await counties.page.locator('#referralHeader').innerText(), /Wake County \(37183\)/);
  pass('AT-47-counties');
  assert.deepStrictEqual(counties.requests, [], 'county page network: ' + counties.requests.join('; '));
  await counties.context.close();

  const preview = await startPreview();
  const origin = `http://127.0.0.1:${preview.address().port}`;
  const assetName = fs.readdirSync(path.join(root, 'app/dist/assets')).find((name) => name.startsWith('juror-template-') && name.endsWith('.xlsx'));
  const assetUrl = `${origin}/assets/${assetName}`;
  const headers = await requestHeaders(assetUrl);
  assert.strictEqual(headers.status, 200);
  assert.strictEqual(headers['content-type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const rootHeaders = await requestHeaders(`${origin}/${assetName}`);
  assert.strictEqual(rootHeaders.status, 404);
  assert.notStrictEqual(rootHeaders['content-type'], 'text/html');
  console.log('template xlsx', assetUrl, headers.status, headers['content-type']);
  const sameOrigin = await openPage(browser);
  await sameOrigin.page.goto(origin + '/');
  const [namedXlsx] = await Promise.all([
    sameOrigin.page.waitForEvent('download'),
    sameOrigin.page.click('a[download="juror-template.xlsx"]'),
  ]);
  assert.strictEqual(namedXlsx.suggestedFilename(), 'juror-template.xlsx');
  const [namedCsv] = await Promise.all([
    sameOrigin.page.waitForEvent('download'),
    sameOrigin.page.click('a[download="voter-template.csv"]'),
  ]);
  assert.strictEqual(namedCsv.suggestedFilename(), 'voter-template.csv');
  pass('AT-45-same-origin-downloads');
  await sameOrigin.context.close();
  await new Promise((resolve) => preview.close(resolve));

  await browser.close();
  console.log('ALL UI TESTS PASSED');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
