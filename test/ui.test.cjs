const { chromium } = require('playwright-core');
const http = require('http');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const crypto = require('crypto');
const { execSync } = require('child_process');

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
  const context = await browser.newContext({
    viewport: options.viewport ?? { width: 1360, height: 900 },
    acceptDownloads: true,
    reducedMotion: options.reducedMotion,
  });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (text.startsWith('Failed to load resource:')) return;
    errors.push(text);
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.includes('/fonts/') || url.startsWith('blob:') || url.startsWith('data:')) return;
    errors.push(`failed ${url}`);
  });
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith('file:') && !url.startsWith('blob:') && !url.startsWith('data:')) requests.push(url);
  });
  page.on('dialog', (dialog) => dialog.accept());
  if (options.time) await page.clock.install({ time: new Date(options.time) });
  await page.goto('file://' + dist);
  return { context, page, errors, requests };
}

async function openStep(page, id) {
  await page.click(`#step-tab-${id}`);
  await page.waitForSelector(`#step-panel-${id}:not([hidden])`);
}

async function selectState(page, code) {
  if (!(await page.locator('#stateSel').isVisible())) await openStep(page, 'where');
  await page.selectOption('#stateSel', code);
}

async function openStateNotices(page) {
  const notices = page.locator('#stateNotices');
  if (await notices.count()) await notices.evaluate((node) => { node.open = true; });
}

async function assertComingLater(page, code, stateName) {
  const rules = JSON.parse(fs.readFileSync(path.join(root, 'shared/rules', `${code}.json`), 'utf8'));
  const basis = rules.gates.basis;
  assert.ok(await page.locator('#comingLater').isVisible(), `${code} coming later card`);
  assert.strictEqual((await page.locator('#comingLater h2').innerText()).trim(), stateName, code);
  assert.match(await page.locator('#comingLaterPlan').innerText(), /doesn't support this state yet/);
  assert.match(await page.locator('#comingLaterPlan').innerText(), /planned for a future release/);
  const reason = (await page.locator('#comingReason').innerText()).trim();
  assert.match(reason, /counts only/);
  assert.ok(!reason.includes(basis), `${code} short reason repeated the basis`);
  assert.strictEqual(await page.locator('#stepper').count(), 0, `${code} progress row`);
  assert.strictEqual(await page.locator('#stepNext').count(), 0, `${code} next button`);
  assert.strictEqual(await page.locator('#fileJuror').count(), 0, code);
  assert.strictEqual(await page.locator('#fileVoter').count(), 0, code);
  assert.strictEqual(await page.locator('#sampleBtn').count(), 0, code);
  assert.strictEqual(await page.locator('#runBtn').count(), 0, code);
  assert.strictEqual(await page.locator('#exportBtn').count(), 0, code);
  assert.strictEqual(await page.locator('#typePath').count(), 0, code);
  assert.strictEqual(await page.locator('#auditMode').count(), 0, code);
  assert.strictEqual(await page.locator('#auditLetter').count(), 0, code);
  assert.strictEqual(await page.locator('#juryRefuse').count(), 0, code);
  assert.strictEqual(await page.locator('#comingLater details').count(), 1, `${code} disclosures`);
  assert.strictEqual(await page.locator('input[type="file"]').count(), 0, `${code} file inputs`);
  const recordsLink = page.locator('#comingLater #recordsAuditRequest');
  const handoffLink = page.locator('#comingLater #juryHandoffRequest');
  assert.strictEqual(await recordsLink.count(), 1, `${code} records link`);
  assert.strictEqual((await recordsLink.innerText()).trim(), 'Request list-maintenance counts', code);
  assert.strictEqual(await recordsLink.getAttribute('href'), `#/records-audit/${code.toLowerCase()}`, code);
  assert.strictEqual(await handoffLink.count(), 1, `${code} handoff link`);
  assert.strictEqual((await handoffLink.innerText()).trim(), 'Ask about the jury handoff', code);
  assert.strictEqual(await handoffLink.getAttribute('href'), `#/jury-handoff-letter/${code.toLowerCase()}`, code);
  const whatNow = (await page.locator('#whatNow').innerText()).trim();
  assert.match(whatNow, /What you can do now/, code);
  const audit = rules.audit_path;
  if (audit && audit.what_you_can_request) {
    assert.ok(whatNow.includes(audit.what_you_can_request), `${code} audit request`);
    if (audit.note) assert.ok(whatNow.includes(audit.note), `${code} audit note`);
  }
  await page.locator('#comingLater details').evaluate((node) => { node.open = false; });
  const closed = await page.locator('#comingLater').innerText();
  assert.ok(!closed.includes(basis), `${code} basis visible before Why?`);
  await page.locator('#comingLater details').evaluate((node) => { node.open = true; });
  assert.strictEqual((await page.locator('#stepBasis').innerText()).trim(), basis, `${code} missing explanation`);
  const carry = (await page.locator('#comingLater #paCarry').innerText()).trim();
  const law = (await page.locator('#comingLater #refusalLaw').innerText()).trim();
  assert.ok(carry.startsWith('Pennsylvania opens its list of disqualified jurors'), `${code} carry-over`);
  assert.ok(carry.endsWith(stateName + '.'), `${code} carry-over state`);
  assert.ok(!closed.includes(carry), `${code} carry-over visible before Why?`);
  assert.ok(!closed.includes(law), `${code} law line visible before Why?`);
  assert.ok(law.length > 0, `${code} law line`);
  const publicList = new Set(['CO', 'MA', 'MS', 'DC', 'MT', 'MO', 'VT', 'ND', 'DE', 'ID']);
  if (publicList.has(code)) {
    const hint = (await page.locator('#comingLater #publicListHint').innerText()).trim();
    assert.strictEqual(hint, `${stateName}'s public jury lists name people picked for jury service. They do not show who was excused or why.`, code);
  } else {
    assert.strictEqual(await page.locator('#comingLater #publicListHint').count(), 0, code);
  }
  const opened = await page.locator('#comingLater').evaluate((node) => node.textContent || '');
  assert.strictEqual(opened.split(basis).length - 1, 1, `${code} basis shown more than once`);
  assert.strictEqual(opened.split(carry).length - 1, 1, `${code} carry-over shown more than once`);
  assert.strictEqual(opened.split(law).length - 1, 1, `${code} law line shown more than once`);
  if (audit && audit.what_you_can_request) {
    assert.strictEqual(opened.split(audit.what_you_can_request).length - 1, 1, `${code} audit request shown more than once`);
    if (audit.note) assert.strictEqual(opened.split(audit.note).length - 1, 1, `${code} audit note shown more than once`);
  }
}

async function assertFits(page, width, label) {
  const report = await page.evaluate((limit) => {
    const scrollWidth = document.documentElement.scrollWidth;
    if (scrollWidth <= limit) return null;
    let worst = null;
    for (const node of document.querySelectorAll('body *')) {
      const rect = node.getBoundingClientRect();
      if (rect.right <= limit + 1) continue;
      if (worst && rect.right <= worst.right) continue;
      worst = {
        right: Math.round(rect.right),
        tag: node.tagName,
        id: node.id,
        className: String(node.className).slice(0, 80),
      };
    }
    return { scrollWidth, worst };
  }, width);
  assert.strictEqual(report, null, `${label} wider than ${width}: ${JSON.stringify(report)}`);
}

async function attest(page) {
  if (!(await page.locator('#attest1').isVisible())) await openStep(page, 'sign');
  for (let i = 1; i <= 5; i += 1) await page.check(`#attest${i}`);
  await page.fill('#initials', 'AB');
}

async function chooseFileIfValueChanges(page, id, filePath) {
  const payload = fs.readFileSync(filePath).toString('base64');
  const name = path.basename(filePath);
  return page.evaluate(({ inputId, fileName, filePayload }) => {
    const input = document.getElementById(inputId);
    const binary = atob(filePayload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const file = new File([bytes], fileName, { type: 'text/csv' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const previous = input.value;
    input.files = transfer.files;
    const dispatched = input.value !== previous;
    if (dispatched) input.dispatchEvent(new Event('change', { bubbles: true }));
    return { dispatched, value: input.value };
  }, { inputId: id, fileName: name, filePayload: payload });
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
  if (!(await page.locator('#county').isVisible())) await openStep(page, 'where');
  await page.selectOption('#county', fips);
}

function expectedBuildId() {
  const script = "import { buildId } from './scripts/build-id.mjs'; process.stdout.write(buildId())";
  return execSync(`node --input-type=module -e ${JSON.stringify(script)}`, { cwd: root, encoding: 'utf8' });
}

function readAuditDownload(file) {
  const text = fs.readFileSync(file, 'utf8');
  const rows = text.trim().split('\n').map((line) => JSON.parse(line));
  const header = rows[0];
  assert.ok(header && !header.type && !header.seq, 'jsonl starts with a county header');
  assert.ok(Object.prototype.hasOwnProperty.call(header, 'county_name'));
  assert.ok(Object.prototype.hasOwnProperty.call(header, 'county_fips'));
  return { text, header, entries: rows.slice(1) };
}

(async () => {
  const built = fs.readFileSync(dist, 'utf8');
  assert.ok(built.includes("connect-src 'none'"), 'CSP connect-src');
  assert.ok(built.includes('/fonts/roboto-400.woff2'), 'fonts use an absolute /fonts/ URL');
  assert.ok(!/url\(\s*['"]?(?:\.\.\/)?fonts\//.test(built), 'font URLs must not be relative');
  assert.ok(built.includes("font-src 'self'"), 'CSP font-src');
  assert.ok(!/<script[^>]+src=/.test(built), 'scripts must be inlined');
  assert.ok(!built.includes('"type":"Topology"'), 'county geometry stays out of the inline page');
  assert.ok(fs.existsSync(path.join(root, 'app/dist/assets/us-map.js')), 'map chunk');
  assert.ok(fs.existsSync(path.join(root, 'app/dist/assets/us-map-global.js')), 'file map script');
  assert.ok(built.includes('./assets/us-map.js'), 'hosted page imports the map chunk');
  const config = fs.readFileSync(path.join(root, 'app/dist/staticwebapp.config.json'), 'utf8');
  assert.ok(config.includes("connect-src 'none'"));
  pass('AT-29-csp');

  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  const first = await openPage(browser);
  await first.page.waitForSelector('#usMap path');
  await first.page.screenshot({ path: path.join(shots, '01-state-picker.png'), fullPage: true });
  await first.page.setViewportSize({ width: 390, height: 844 });
  await first.page.screenshot({ path: path.join(shots, '01b-state-picker-mobile.png'), fullPage: true });
  await first.page.setViewportSize({ width: 1360, height: 900 });
  assert.ok(await first.page.isVisible('#federalBanner'));
  assert.strictEqual(await first.page.locator('#exportBtn').count(), 0);
  const buildId = expectedBuildId();
  assert.match(buildId, /^[0-9a-f]{7}$/);
  assert.strictEqual(
    await first.page.locator('#appFooter').innerText(),
    `JuryRoll 2.0.0 · build ${buildId}. A match is a lead for officials. It is not proof.`,
  );
  assert.ok(built.includes(buildId), 'build id is injected, not fetched');
  pass('AT-07-banner');
  pass('AT-49-build-id');

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

  await selectState(first.page, 'NY');
  await first.page.waitForSelector('#comingLater');
  await first.page.screenshot({ path: path.join(shots, '07-blackout-aggregate.png'), fullPage: true });
  await assertComingLater(first.page, 'NY', 'New York');
  assert.ok((await first.page.locator('#federalBanner').innerText()).includes('Federal 90-day window'));
  await selectState(first.page, 'PA');
  await first.page.waitForSelector('#stepper');
  await first.page.waitForSelector('#fileJuror', { state: 'attached' });
  assert.strictEqual(await first.page.locator('#comingLater').count(), 0);
  assert.strictEqual(await first.page.locator('#fileJuror').count(), 1);
  assert.strictEqual(await first.page.locator('#fileVoter').count(), 1);
  assert.strictEqual(await first.page.locator('#sampleBtn').count(), 1);
  await selectState(first.page, 'NC');
  await first.page.waitForSelector('#fileJuror', { state: 'attached' });
  assert.strictEqual(await first.page.locator('#comingLater').count(), 0);
  assert.strictEqual(await first.page.locator('#stepNext').count(), 1);
  pass('AT-06');

  await selectState(first.page, 'WY');
  await first.page.waitForSelector('#comingLater');
  assert.strictEqual(await first.page.locator('#rulesFallback').count(), 0);
  await assertComingLater(first.page, 'WY', 'Wyoming');
  pass('AT-03-live-wy');

  await selectState(first.page, 'TX');
  await first.page.waitForSelector('#comingLater');
  await assertComingLater(first.page, 'TX', 'Texas');
  assert.strictEqual(await first.page.locator('#jurorSlot').count(), 0);
  assert.strictEqual(await first.page.locator('#infoJuror').count(), 0);
  pass('AT-05');
  assert.deepStrictEqual(first.requests, [], 'network requests: ' + first.requests.join('; '));
  await first.context.close();

  const main = await openPage(browser);
  await selectState(main.page, 'NC');
  assert.strictEqual(await main.page.locator('#fileJuror').count(), 1);
  assert.strictEqual(await main.page.locator('#runBtn').isDisabled(), true);
  await attest(main.page);
  const ncNote = 'The North Carolina State Board\'s posted list has no date of birth, so matches stay Weak and you will mostly see counts. Leads go to the county board of elections, the State Board of Elections, or the Attorney General.';
  await openStateNotices(main.page);
  assert.strictEqual(await main.page.locator('#challengePanel').count(), 0);
  assert.strictEqual(await main.page.locator('#challengeFormLink').count(), 0);
  assert.strictEqual(await main.page.locator('#deadlineBanner').count(), 0);
  assert.strictEqual(await main.page.locator('#leadBanner').count(), 0);
  pass('AT-31');
  pass('AT-32');
  await pickCounty(main.page);
  await openStep(main.page, 'files');
  await main.page.screenshot({ path: path.join(shots, '02-step-files.png'), fullPage: true });
  assert.strictEqual(await main.page.locator('#typePath').count(), 1);
  await main.page.setInputFiles('#fileJuror', sampleJ);
  await main.page.waitForSelector('#infoJuror');
  await main.page.setInputFiles('#fileVoter', sampleV);
  await main.page.waitForSelector('#infoVoter');
  await openStep(main.page, 'run');
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
  assert.strictEqual(await main.page.locator('#ncNamesNote').innerText(), ncNote);
  const counts = await main.page.evaluate(() => ['Strong', 'Probable', 'Weak'].map((tier) => Number(document.querySelector(`#count${tier} .n`).textContent)));
  console.log('UI tier counts [Strong, Probable, Weak]:', counts);
  assert.deepStrictEqual(counts, [0, 3, 2]);
  assert.ok((await main.page.locator('#matcherCounts').innerText()).includes('Strong 3, Probable 4, same-name pairs (not leads) 2'));
  assert.ok((await main.page.locator('#tierCapBadge').innerText()).includes('North Carolina'));
  assert.ok((await main.page.locator('#excludedLine').innerText()).includes('2 matches excluded: registered after declaration'));
  assert.ok((await main.page.locator('#cannotCompareLine').innerText()).includes('2 matches cannot compare: no registration date'));
  assert.ok((await main.page.locator('#regDateNote').innerText()).includes('latest registration change'));
  assert.ok((await main.page.locator('#templateDateNote').innerText()).includes('The registration date is needed for a named referral.'));
  assert.match(await main.page.locator('#referralHeader').innerText(), /Wake County \(37183\)/);
  const summary = await main.page.locator('#countySummary').innerText();
  assert.match(summary, /Wake County, North Carolina:/);
  assert.match(summary, /coded non-citizen/);
  assert.match(summary, /3 potential matches on the voter roll \(Strong 0 \/ Probable 3\), 2 same-name pairs \(not leads\)/);
  assert.match(summary, /Language 0 excluded/);
  assert.match(summary, /Non-resident 0 excluded/);
  assert.ok(!summary.includes('Sample Juror 01'));
  assert.match(await main.page.locator('#summaryDisclaimer').innerText(), /leads for official verification/);
  assert.strictEqual(await main.page.locator('#countyRollup tbody tr').count(), 1);
  const rowsDefault = await main.page.locator('#results tr').count() - 1;
  assert.strictEqual(rowsDefault, 3, 'named leads are the pairs registered before the declaration');
  const namedText = await main.page.locator('#results').innerText();
  assert.ok(namedText.includes('Sample Juror 01'));
  assert.ok(!namedText.includes('Sample Juror 06'));
  assert.ok(!namedText.includes('Sample Juror 11'));
  assert.ok(!namedText.includes('Sample Juror 04'));
  assert.ok(!namedText.includes('Sample Juror 05'));
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

  await openStep(main.page, 'export');
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
  assert.ok(csv.includes('Sample Juror 01'));
  assert.ok(!csv.includes('Sample Juror 06'));
  assert.ok(!csv.includes('V0011'));
  assert.ok(!csv.includes('V0005'));
  assert.ok(!csv.includes('V0007'));
  await main.page.waitForSelector('#purgeNow');
  assert.ok((await main.page.locator('#purgeTitle').innerText()).includes('Referral saved. Purge the data now?'));
  await main.page.screenshot({ path: path.join(shots, '05b-purge-prompt.png'), fullPage: true });
  await main.page.click('#keepData');

  await openStep(main.page, 'triage');
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
  const savedLog = readAuditDownload(logPath);
  assert.strictEqual(savedLog.header.county_name, 'Wake County');
  assert.strictEqual(savedLog.header.county_fips, '37183');
  assert.ok(!savedLog.text.includes('No county selected'));
  const entries = savedLog.entries;
  const types = entries.map((entry) => entry.type);
  console.log('Audit types:', types.join(', '));
  assert.deepStrictEqual(types, ['session_start', 'rules_loaded', 'attestation_signed', 'file_loaded', 'file_loaded', 'mapping_set', 'match_run', 'export']);
  const matchRun = entries.find((entry) => entry.type === 'match_run');
  assert.strictEqual(matchRun.data.excluded_registered_after, 2);
  assert.strictEqual(matchRun.data.cannot_compare_no_reg_date, 2);
  assert.strictEqual(matchRun.data.county_name, 'Wake County');
  assert.strictEqual(matchRun.data.county_fips, '37183');
  assert.strictEqual(entries.find((entry) => entry.type === 'export').data.county_fips, '37183');
  const logText = savedLog.text;
  assert.ok(!logText.includes('Sample Juror 01'));
  assert.ok(!logText.includes('J-0001'));
  assert.ok(!logText.includes('sample_juror'));
  assert.ok(!logText.includes('000 Sample Road'));
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
  fs.writeFileSync(path.join(datesDir, 'juror.csv'), 'Juror Number,Last,First,Birth Date,Address,Zip,Disqualification Reason,Note,Disqualification Date\nJ1,Sample Juror 01,Pat,03/14/1901,000 Sample Road,00000,Not a U.S. citizen,FICTIONAL SAMPLE DATA,2020-01-15\nJ2,Sample Juror 02,Example,04/02/1901,000 Sample Road,00000,Not a U.S. citizen,FICTIONAL SAMPLE DATA,2020-06-01\nJ3,Sample Juror 03,Pat,05/03/1901,000 Sample Road,00000,Not a U.S. citizen,FICTIONAL SAMPLE DATA,\n');
  fs.writeFileSync(path.join(datesDir, 'voter.csv'), 'voter_id,name_last,name_first,date_of_birth,res_street,res_zip,status,data_note,registration_date,county\nV1,Sample Juror 01,Pat,1901-03-14,000 Sample Road,00000,ACTIVE,FICTIONAL SAMPLE DATA,2021-05-01,Wake\nV2,Sample Juror 02,Example,1901-04-02,000 Sample Road,00000,ACTIVE,FICTIONAL SAMPLE DATA,2019-01-01,Wake\nV3,Sample Juror 03,Pat,1901-05-03,000 Sample Road,00000,ACTIVE,FICTIONAL SAMPLE DATA,,Wake\n');
  const dates = await openPage(browser);
  await selectState(dates.page, 'NC');
  await attest(dates.page);
  await pickCounty(dates.page);
  await openStep(dates.page, 'files');
  await dates.page.setInputFiles('#fileJuror', path.join(datesDir, 'juror.csv'));
  await dates.page.waitForSelector('#infoJuror');
  await dates.page.setInputFiles('#fileVoter', path.join(datesDir, 'voter.csv'));
  await openStep(dates.page, 'run');
  await dates.page.waitForFunction(() => !document.getElementById('runBtn').disabled);
  await dates.page.click('#runBtn');
  await dates.page.waitForSelector('#excludedLine');
  const excluded = await dates.page.locator('#excludedLine').innerText();
  const cannot = await dates.page.locator('#cannotCompareLine').innerText();
  assert.ok(excluded.includes('1 matches excluded: registered after declaration'));
  assert.ok(cannot.includes('1 matches cannot compare: no registration date'));
  const bodyText = await dates.page.locator('body').innerText();
  assert.ok(!bodyText.includes('Sample Juror 01'));
  assert.ok(bodyText.includes('Sample Juror 02'));
  assert.ok(!bodyText.includes('Sample Juror 03'));
  assert.ok(bodyText.includes('Official SAVE / naturalization check required'));
  await openStep(dates.page, 'export');
  const [dateDownload] = await Promise.all([
    dates.page.waitForEvent('download'),
    dates.page.click('#exportBtn'),
  ]);
  const dateCsvPath = path.join(datesDir, 'out.csv');
  await dateDownload.saveAs(dateCsvPath);
  const dateCsv = fs.readFileSync(dateCsvPath, 'utf8');
  assert.ok(!dateCsv.includes('Sample Juror 01'));
  assert.ok(dateCsv.includes('Sample Juror 02'));
  assert.ok(!dateCsv.includes('Sample Juror 03'));
  assert.ok(dateCsv.includes('1 matches excluded: registered after declaration'));
  assert.ok(dateCsv.includes('1 matches cannot compare: no registration date'));
  pass('AT-10');
  pass('AT-11');
  pass('AT-13-dates');
  await dates.context.close();

  const refused = await openPage(browser);
  await selectState(refused.page, 'NC');
  await attest(refused.page);
  await openStep(refused.page, 'files');
  const ssnPath = path.join(datesDir, 'ssn.csv');
  fs.writeFileSync(ssnPath, 'voter_id,name_last,name_first,data_note,ssn\nV1,Example,Pat,FICTIONAL SAMPLE DATA,123-45-6789\n');
  await refused.page.setInputFiles('#fileVoter', ssnPath);
  await refused.page.waitForSelector('#fileError');
  assert.ok((await refused.page.locator('#fileError').innerText()).toLowerCase().includes('ssn'));
  assert.strictEqual(await refused.page.locator('#infoVoter').count(), 0);
  pass('AT-20');
  await refused.context.close();

  const xlsx = await openPage(browser);
  await selectState(xlsx.page, 'NC');
  await attest(xlsx.page);
  await pickCounty(xlsx.page);
  await openStep(xlsx.page, 'files');
  await xlsx.page.setInputFiles('#fileJuror', sampleJx);
  await xlsx.page.waitForSelector('#infoJuror');
  await xlsx.page.setInputFiles('#fileVoter', sampleVx);
  await openStep(xlsx.page, 'run');
  await xlsx.page.waitForFunction(() => !document.getElementById('runBtn').disabled);
  await xlsx.page.click('#runBtn');
  await xlsx.page.waitForSelector('#matcherCounts');
  const xlsxCounts = await xlsx.page.evaluate(() => ['Strong', 'Probable', 'Weak'].map((tier) => Number(document.querySelector(`#count${tier} .n`).textContent)));
  assert.deepStrictEqual(xlsxCounts, [0, 3, 2]);
  assert.ok((await xlsx.page.locator('#matcherCounts').innerText()).includes('Strong 3, Probable 4, same-name pairs (not leads) 2'));
  assert.deepStrictEqual(xlsx.errors, [], 'xlsx page errors: ' + xlsx.errors.join('; '));
  console.log('XLSX UI counts [Strong, Probable, Weak]:', xlsxCounts);
  pass('AT-XLSX');
  await xlsx.context.close();

  const later = await openPage(browser, { time: '2026-10-10T15:00:00Z' });
  await selectState(later.page, 'NC');
  await attest(later.page);
  await openStateNotices(later.page);
  assert.strictEqual(await later.page.locator('#challengePanel').count(), 0);
  assert.strictEqual(await later.page.locator('#deadlineBanner').count(), 0);
  assert.strictEqual(await later.page.locator('#challengeFormLink').count(), 0);
  pass('AT-31-passed');
  await later.context.close();

  const timed = await openPage(browser, { time: '2026-10-07T15:00:00Z' });
  await selectState(timed.page, 'NC');
  await attest(timed.page);
  await pickCounty(timed.page);
  await openStep(timed.page, 'files');
  await timed.page.setInputFiles('#fileJuror', sampleJ);
  await timed.page.waitForSelector('#infoJuror');
  await timed.page.setInputFiles('#fileVoter', sampleV);
  await openStep(timed.page, 'run');
  await timed.page.waitForFunction(() => !document.getElementById('runBtn').disabled);
  await timed.page.click('#runBtn');
  await timed.page.waitForSelector('#countStrong');
  await openStep(timed.page, 'export');
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
  await selectState(idle.page, 'NC');
  await attest(idle.page);
  await openStep(idle.page, 'files');
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
    await selectState(page, 'NC');
    await attest(page);
    await pickCounty(page);
    await openStep(page, 'files');
    await page.setInputFiles('#fileJuror', path.join(fixtures, jurorName));
    await page.waitForSelector('#infoJuror');
    await page.setInputFiles('#fileVoter', path.join(fixtures, voterName));
    await openStep(page, 'run');
    await page.waitForFunction(() => !document.getElementById('runBtn').disabled);
    await page.click('#runBtn');
    await page.waitForSelector('#cannotCompareLine');
  }

  const missing = await openPage(browser);
  await runPair(missing.page, 'juror_missing_reg.csv', 'voter_missing_reg.csv');
  assert.ok((await missing.page.locator('#cannotCompareLine').innerText()).includes('1 matches cannot compare: no registration date'));
  assert.ok((await missing.page.locator('#excludedLine').innerText()).includes('0 matches excluded: registered after declaration'));
  assert.ok(!(await missing.page.locator('body').innerText()).includes('Sample Juror 03'));
  await openStep(missing.page, 'export');
  const [missingDownload] = await Promise.all([
    missing.page.waitForEvent('download'),
    missing.page.click('#exportBtn'),
  ]);
  const missingPath = path.join(shots, 'missing-reg.csv');
  await missingDownload.saveAs(missingPath);
  const missingCsv = fs.readFileSync(missingPath, 'utf8');
  assert.ok(!missingCsv.includes('Sample Juror 03'));
  assert.ok(missingCsv.includes('1 matches cannot compare: no registration date'));
  pass('AT-12-missing');
  await missing.context.close();

  const equal = await openPage(browser);
  await runPair(equal.page, 'juror_equal.csv', 'voter_equal.csv');
  assert.ok((await equal.page.locator('#cannotCompareLine').innerText()).includes('1 matches cannot compare: no registration date'));
  assert.ok((await equal.page.locator('#excludedLine').innerText()).includes('0 matches excluded: registered after declaration'));
  assert.ok(!(await equal.page.locator('body').innerText()).includes('Sample Juror 11'));
  await openStep(equal.page, 'export');
  const [equalDownload] = await Promise.all([
    equal.page.waitForEvent('download'),
    equal.page.click('#exportBtn'),
  ]);
  const equalPath = path.join(shots, 'equal-date.csv');
  await equalDownload.saveAs(equalPath);
  assert.ok(!fs.readFileSync(equalPath, 'utf8').includes('Sample Juror 11'));
  pass('AT-12');
  await equal.context.close();

  const before = await openPage(browser);
  await runPair(before.page, 'juror_before_only.csv', 'voter_before_only.csv');
  assert.ok((await before.page.locator('#excludedLine').innerText()).includes('0 matches excluded: registered after declaration'));
  assert.ok((await before.page.locator('#cannotCompareLine').innerText()).includes('0 matches cannot compare: no registration date'));
  assert.ok((await before.page.locator('#results').innerText()).includes('Sample Juror 02'));
  pass('AT-39');
  await before.context.close();

  const noReg = await openPage(browser);
  await runPair(noReg.page, 'juror_three.csv', 'voter_no_regdate.csv');
  assert.ok((await noReg.page.locator('#cannotCompareLine').innerText()).includes('3 matches cannot compare: no registration date'));
  assert.ok((await noReg.page.locator('#excludedLine').innerText()).includes('0 matches excluded: registered after declaration'));
  assert.strictEqual(await noReg.page.locator('#results tbody tr').count(), 0);
  await openStep(noReg.page, 'export');
  const [noRegDownload] = await Promise.all([
    noReg.page.waitForEvent('download'),
    noReg.page.click('#exportBtn'),
  ]);
  const noRegPath = path.join(shots, 'no-reg.csv');
  await noRegDownload.saveAs(noRegPath);
  const noRegCsv = fs.readFileSync(noRegPath, 'utf8');
  assert.ok(noRegCsv.includes('3 matches cannot compare: no registration date'));
  assert.ok(noRegCsv.includes('0 matches excluded: registered after declaration'));
  assert.ok(!noRegCsv.includes('Sample Juror 01'));
  assert.ok(!noRegCsv.includes('Sample Juror 02'));
  assert.ok(!noRegCsv.includes('Sample Juror 03'));
  assert.ok(!/^Strong,|^Probable,|^Weak,/m.test(noRegCsv));
  await noReg.page.waitForSelector('#keepData');
  await noReg.page.click('#keepData');
  const [noRegLog] = await Promise.all([
    noReg.page.waitForEvent('download'),
    noReg.page.click('#downloadLog'),
  ]);
  const noRegLogPath = path.join(shots, 'no-reg-audit.jsonl');
  await noRegLog.saveAs(noRegLogPath);
  const noRegSaved = readAuditDownload(noRegLogPath);
  assert.strictEqual(noRegSaved.header.county_fips, '37183');
  const noRegEntries = noRegSaved.entries;
  const noRegMatch = noRegEntries.find((entry) => entry.type === 'match_run');
  assert.strictEqual(noRegMatch.data.cannot_compare_no_reg_date, 3);
  assert.strictEqual(noRegMatch.data.excluded_registered_after, 0);
  pass('AT-37');
  await noReg.context.close();

  const blankDecl = await openPage(browser);
  await runPair(blankDecl.page, 'juror_missing_decl.csv', 'voter_missing_decl.csv');
  assert.ok((await blankDecl.page.locator('#cannotCompareLine').innerText()).includes('1 matches cannot compare: no registration date'));
  assert.ok(!(await blankDecl.page.locator('#results').innerText()).includes('Sample Juror 12'));
  pass('AT-40');
  await blankDecl.context.close();

  const dc = await openPage(browser);
  await selectState(dc.page, 'DC');
  await openStateNotices(dc.page);
  const dcBanner = await dc.page.locator('#nonSignalBanner').innerText();
  assert.ok(dcBanner.includes('D.C. lets non-citizens vote'));
  assert.ok(dcBanner.includes('not evidence of unlawful registration in this jurisdiction'));
  assert.strictEqual(await dc.page.locator('#challengePanel').count(), 0);
  assert.strictEqual(await dc.page.locator('#fileJuror').count(), 0);
  assert.strictEqual(await dc.page.locator('#exportBtn').count(), 0);
  pass('AT-34');
  await dc.context.close();

  const nd = await openPage(browser);
  await selectState(nd.page, 'ND');
  await openStateNotices(nd.page);
  assert.ok((await nd.page.locator('#ndBanner').innerText()).includes('North Dakota has no voter registration'));
  assert.strictEqual(await nd.page.locator('#challengePanel').count(), 0);
  assert.strictEqual(await nd.page.locator('#fileJuror').count(), 0);
  pass('AT-35');
  await nd.context.close();

  const ca = await openPage(browser);
  await selectState(ca.page, 'CA');
  await openStateNotices(ca.page);
  const limit = await ca.page.locator('#useLimitBanner').innerText();
  assert.ok(limit.includes('Your state limits how its voter list may be used'));
  assert.ok(limit.includes('Election, scholarly, journalistic, political, or governmental purposes'));
  assert.ok(limit.includes('2194'));
  assert.strictEqual(await ca.page.locator('#challengePanel').count(), 0);
  pass('AT-36');
  await ca.context.close();

  const gate = await openPage(browser);
  await selectState(gate.page, 'NC');
  await gate.page.waitForSelector('#sampleBtn', { state: 'attached' });
  async function enableMatch() {
    await gate.page.evaluate(() => {
      for (const id of ['step-panel-files', 'step-panel-run']) {
        const node = document.getElementById(id);
        if (node) node.hidden = false;
      }
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
  await gate.page.waitForFunction(() => document.getElementById('fileJuror').files.length === 0 && document.getElementById('fileVoter').files.length === 0);
  assert.strictEqual(await gate.page.locator('#fileJuror').inputValue(), '');
  assert.strictEqual(await gate.page.locator('#fileVoter').inputValue(), '');
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

  const reselect = await openPage(browser);
  await selectState(reselect.page, 'NC');
  await reselect.page.waitForSelector('#fileJuror', { state: 'attached' });
  await reselect.page.evaluate(() => {
    const panel = document.getElementById('step-panel-files');
    if (panel) panel.hidden = false;
    document.getElementById('step1').disabled = false;
    document.getElementById('fileJuror').disabled = false;
    document.getElementById('fileVoter').disabled = false;
  });
  const firstChoice = await chooseFileIfValueChanges(reselect.page, 'fileJuror', sampleJ);
  assert.strictEqual(firstChoice.dispatched, true);
  await reselect.page.waitForSelector('#fileError');
  assert.strictEqual(await reselect.page.locator('#fileJuror').inputValue(), '');
  assert.strictEqual(await reselect.page.locator('#infoJuror').count(), 0);
  await attest(reselect.page);
  await openStep(reselect.page, 'files');
  const secondChoice = await chooseFileIfValueChanges(reselect.page, 'fileJuror', sampleJ);
  assert.strictEqual(secondChoice.dispatched, true);
  await reselect.page.waitForSelector('#infoJuror');
  const voterChoice = await chooseFileIfValueChanges(reselect.page, 'fileVoter', sampleV);
  assert.strictEqual(voterChoice.dispatched, true);
  await reselect.page.waitForSelector('#infoVoter');
  pass('AT-46-reselect');
  await reselect.context.close();

  const switched = await openPage(browser);
  await selectState(switched.page, 'NC');
  await attest(switched.page);
  await openStep(switched.page, 'files');
  await switched.page.click('#sampleBtn');
  await switched.page.waitForSelector('#infoJuror');
  const entriesBefore = await switched.page.locator('#logPanel').innerText();
  await switched.page.evaluate(() => {
    document.getElementById('stateSel').dispatchEvent(new Event('change', { bubbles: true }));
  });
  await switched.page.waitForFunction((prev) => document.getElementById('logPanel').innerText !== prev, entriesBefore);
  assert.strictEqual(await switched.page.locator('#infoJuror').count(), 1);
  assert.strictEqual(await switched.page.locator('#jurorCleared').count(), 0);
  await selectState(switched.page, 'NY');
  await switched.page.waitForSelector('#comingLater');
  await switched.page.waitForSelector('#jurorCleared');
  assert.strictEqual(await switched.page.locator('#infoJuror').count(), 0);
  const switchedBasis = JSON.parse(fs.readFileSync(path.join(root, 'shared/rules/NY.json'), 'utf8')).gates.basis;
  await assertComingLater(switched.page, 'NY', 'New York');
  const clearedNote = await switched.page.locator('#jurorCleared').innerText();
  assert.match(clearedNote, /cleared/i);
  assert.ok(!clearedNote.includes(switchedBasis), clearedNote);
  await selectState(switched.page, 'NC');
  await openStep(switched.page, 'files');
  await switched.page.waitForSelector('#fileJuror');
  assert.strictEqual(await switched.page.locator('#jurorCleared').count(), 0);
  assert.strictEqual(await switched.page.locator('#juryRefuse').count(), 0);
  assert.strictEqual(await switched.page.locator('#infoJuror').count(), 0);
  pass('AT-43-state-switch');
  await switched.context.close();

  const walk = await openPage(browser);
  const codes = await walk.page.$$eval('#stateSel option', (opts) => opts.map((opt) => opt.value).filter(Boolean));
  assert.strictEqual(codes.length, 51);
  const ran = [];
  let loaded = false;
  let signed = false;
  for (const code of codes) {
    await selectState(walk.page, code);
    await walk.page.waitForFunction((expected) => {
      const sel = document.querySelector('#stateSel');
      if (!sel || sel.value !== expected) return false;
      return Boolean(document.querySelector('#sampleBtn') || document.querySelector('#comingLater'));
    }, code);
    const sampleCount = await walk.page.locator('#sampleBtn').count();
    if (sampleCount > 0) {
      if (!signed) {
        await attest(walk.page);
        signed = true;
      }
      await openStep(walk.page, 'files');
      assert.strictEqual(await walk.page.locator('#sampleBtn').isEnabled(), true, `${code} sample button disabled`);
      assert.strictEqual(await walk.page.locator('#challengePanel').count(), 0, `${code} challenge panel`);
      assert.strictEqual(await walk.page.locator('#comingLater').count(), 0, code);
      assert.strictEqual(await walk.page.locator('#fileJuror').count(), 1, code);
      assert.strictEqual(await walk.page.locator('#juryRefuse').count(), 0, code);
      if (!loaded) {
        await walk.page.click('#sampleBtn');
        await walk.page.waitForSelector('#infoJuror');
        await walk.page.waitForSelector('#infoVoter');
      } else {
        assert.strictEqual(await walk.page.locator('#infoJuror').count(), 1, `${code} kept the juror file`);
        assert.strictEqual(await walk.page.locator('#jurorCleared').count(), 0, code);
      }
      await openStep(walk.page, 'where');
      await walk.page.selectOption('#county', { index: 1 });
      await openStep(walk.page, 'run');
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
      const stateName = await walk.page.locator('#comingLater h2').innerText();
      await assertComingLater(walk.page, code, stateName.trim());
      assert.strictEqual(await walk.page.locator('#challengePanel').count(), 0, `${code} challenge panel`);
      if (loaded) {
        const cleared = await walk.page.locator('#jurorCleared').innerText();
        assert.match(cleared, /cleared/i, code);
        const basis = JSON.parse(fs.readFileSync(path.join(root, 'shared/rules', `${code}.json`), 'utf8')).gates.basis;
        assert.ok(!cleared.includes(basis), `${code} repeated the basis on the cleared note`);
        loaded = false;
      }
    }
  }
  const expectedRan = codes.filter((code) => {
    const gates = JSON.parse(fs.readFileSync(path.join(root, 'shared/rules', `${code}.json`), 'utf8')).gates;
    return gates.allow_jury_list === true;
  });
  assert.deepStrictEqual(ran, expectedRan);
  const ruleNames = fs.readdirSync(path.join(root, 'shared/rules')).filter((name) => name.endsWith('.json') && name !== 'schema.json');
  const challengeCodes = ruleNames.filter((name) => {
    const gates = JSON.parse(fs.readFileSync(path.join(root, 'shared/rules', name), 'utf8')).gates;
    return gates.show_challenge_guidance === true;
  });
  assert.strictEqual(ruleNames.length, 52);
  assert.deepStrictEqual(challengeCodes, []);
  pass('AT-44-all-states');
  await walk.context.close();

  const counties = await openPage(browser);
  assert.strictEqual(await counties.page.locator('#county').isDisabled(), true);
  assert.strictEqual(await counties.page.locator('#countyFilter').count(), 0);
  await counties.page.waitForSelector('#usMap path[data-code="NC"]');
  await selectState(counties.page, 'NC');
  await counties.page.waitForSelector('#county:not([disabled])');
  await counties.page.waitForSelector('#usMap[data-level="state"]');
  assert.strictEqual(await counties.page.locator('#county option').count(), 101);
  assert.strictEqual(await counties.page.locator('#county option').nth(1).innerText(), 'Alamance County (37001)');
  assert.ok(await counties.page.locator('#countyRequired').isVisible());
  await counties.page.locator('#placePicker').screenshot({ path: path.join(shots, 'county-picker-nc.png') });
  await pickCounty(counties.page);
  assert.strictEqual(await counties.page.locator('#countyRequired').count(), 0);
  await selectState(counties.page, 'NY');
  await counties.page.waitForSelector('#comingLater');
  assert.strictEqual(await counties.page.locator('#county').inputValue(), '');
  assert.ok(await counties.page.locator('#countyRequired').isVisible());
  await assertComingLater(counties.page, 'NY', 'New York');
  await counties.page.selectOption('#county', '36047');
  assert.strictEqual(await counties.page.locator('#county').inputValue(), '36047');
  assert.strictEqual(await counties.page.locator('#fileJuror').count(), 0);
  assert.strictEqual(await counties.page.locator('#auditLetterBtn').count(), 0);
  await selectState(counties.page, 'NC');
  await counties.page.waitForSelector('#sampleBtn', { state: 'attached' });
  await attest(counties.page);
  await openStep(counties.page, 'files');
  await counties.page.click('#sampleBtn');
  await counties.page.waitForSelector('#infoJuror');
  await counties.page.evaluate(() => {
    const panel = document.getElementById('step-panel-run');
    if (panel) panel.hidden = false;
    document.getElementById('step3').disabled = false;
    document.getElementById('runBtn').disabled = false;
  });
  await counties.page.click('#runBtn');
  assert.strictEqual(await counties.page.locator('#countStrong').count(), 0);
  await openStep(counties.page, 'where');
  assert.ok(await counties.page.locator('#countyRequired').isVisible());
  await pickCounty(counties.page);
  await openStep(counties.page, 'run');
  await counties.page.waitForFunction(() => !document.getElementById('runBtn').disabled);
  await counties.page.click('#runBtn');
  await counties.page.waitForSelector('#countStrong');
  assert.match(await counties.page.locator('#referralHeader').innerText(), /Wake County \(37183\)/);
  pass('AT-47-counties');

  const logOnly = await openPage(browser);
  const note = await logOnly.page.locator('#auditLogNote').innerText();
  assert.ok(note.includes('accountability record'));
  assert.ok(note.includes('before you choose a county'));
  assert.ok(note.includes('before a purge'));
  assert.ok(note.includes('still require a county'));
  assert.strictEqual(await logOnly.page.locator('#downloadLog').isDisabled(), false);
  const [bareDownload] = await Promise.all([
    logOnly.page.waitForEvent('download'),
    logOnly.page.click('#downloadLog'),
  ]);
  assert.match(bareDownload.suggestedFilename(), /^juryroll-audit-\d{4}-\d{2}-\d{2}\.jsonl$/);
  const barePath = path.join(shots, 'audit-no-county.jsonl');
  await bareDownload.saveAs(barePath);
  const bare = readAuditDownload(barePath);
  assert.strictEqual(bare.header.county_name, null);
  assert.strictEqual(bare.header.county_fips, null);
  assert.strictEqual(bare.header.header, 'No county selected');
  assert.strictEqual(bare.text, '{"county_name":null,"county_fips":null,"header":"No county selected"}\n');
  assert.strictEqual(bare.entries.length, 0);
  await selectState(logOnly.page, 'NY');
  await logOnly.page.waitForFunction(() => {
    const panel = document.getElementById('logPanel');
    return Boolean(panel && panel.innerText.includes('2 entries on this computer'));
  });
  await logOnly.page.waitForSelector('#comingLater');
  assert.strictEqual(await logOnly.page.locator('#auditLetterBtn').count(), 0);
  assert.strictEqual(await logOnly.page.locator('#fileJuror').count(), 0);
  assert.strictEqual(await logOnly.page.locator('#exportBtn').count(), 0);
  assert.strictEqual(await logOnly.page.locator('#downloadLog').isDisabled(), false);
  const [stillBare] = await Promise.all([
    logOnly.page.waitForEvent('download'),
    logOnly.page.click('#downloadLog'),
  ]);
  const stillBarePath = path.join(shots, 'audit-ny-no-county.jsonl');
  await stillBare.saveAs(stillBarePath);
  const still = readAuditDownload(stillBarePath);
  assert.strictEqual(still.header.county_name, null);
  assert.strictEqual(still.header.county_fips, null);
  assert.ok(still.text.includes('No county selected'));
  assert.deepStrictEqual(still.entries.map((entry) => entry.type), ['session_start', 'rules_loaded']);
  await logOnly.page.selectOption('#county', '36047');
  assert.strictEqual(await logOnly.page.locator('#auditLetterBtn').count(), 0);
  const [kingsDownload] = await Promise.all([
    logOnly.page.waitForEvent('download'),
    logOnly.page.click('#downloadLog'),
  ]);
  const kingsPath = path.join(shots, 'audit-kings.jsonl');
  await kingsDownload.saveAs(kingsPath);
  const kings = readAuditDownload(kingsPath);
  assert.deepStrictEqual(
    { county_name: kings.header.county_name, county_fips: kings.header.county_fips },
    { county_name: 'Kings County', county_fips: '36047' },
  );
  assert.ok(!kings.text.includes('No county selected'));
  pass('AT-48-audit-log');
  assert.deepStrictEqual(logOnly.requests, [], 'audit log page network: ' + logOnly.requests.join('; '));
  await logOnly.context.close();
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

  const paNote = 'Pennsylvania county lists usually hold only names and reasons. Without a date of birth or address, matches stay Weak and are not exported, so you will mostly see counts. Leads go to the county board of elections, the Department of State, or the Attorney General.';
  const guideMd = fs.readFileSync(path.join(root, 'shared/GUIDE.md'), 'utf8');
  const guideHtml = fs.readFileSync(path.join(root, 'app/public/guide.html'), 'utf8');
  assert.ok(guideMd.includes(paNote));
  for (const code of ['NC', 'PA', 'TX']) {
    const row = fs.readFileSync(path.join(root, 'shared/guide/rows', `${code}.md`), 'utf8').trim();
    assert.ok(row.startsWith(`| ${code} |`), row);
    const cells = row.split('|').slice(2, -1).map((cell) => cell.trim());
    for (const cell of cells) {
      const plain = cell.replace(/`([^`]+)`/g, '$1');
      assert.ok(guideHtml.includes(plain), `${code} guide cell missing: ${plain}`);
    }
  }
  const pa = await openPage(browser);
  const paBase = pa.page.url().split('#')[0];
  await pa.page.goto(`${paBase}#/state/pa`);
  await pa.page.waitForSelector('#paWalkthrough');
  assert.strictEqual(await pa.page.locator('#paWalkthrough').innerText(), paNote);
  assert.strictEqual(await pa.page.locator('#challengePanel').count(), 0);
  await pa.page.goto(`${paBase}#/run/pa`);
  await pa.page.waitForFunction(() => document.querySelector('#stateSel') && document.querySelector('#stateSel').value === 'PA');
  await openStep(pa.page, 'where');
  await openStateNotices(pa.page);
  assert.strictEqual(await pa.page.locator('#challengePanel').count(), 0);
  await openStep(pa.page, 'sign');
  await attest(pa.page);
  await openStep(pa.page, 'where');
  await pa.page.selectOption('#county', { index: 1 });
  const paDir = path.join(shots, 'pa');
  fs.mkdirSync(paDir, { recursive: true });
  const paJuror = path.join(paDir, 'juror.csv');
  const paVoter = path.join(paDir, 'voter.csv');
  fs.writeFileSync(paJuror, 'Last,First,Reason,Note\nSample Juror 01,Pat,Not a U.S. citizen,FICTIONAL SAMPLE DATA\n');
  fs.writeFileSync(paVoter, 'voter_id,name_last,name_first,date_of_birth,res_street,res_zip,status,data_note,registration_date\nV1,Sample Juror 01,Pat,1901-01-02,000 Sample Road,00000,ACTIVE,FICTIONAL SAMPLE DATA,2019-01-01\n');
  await openStep(pa.page, 'files');
  await pa.page.setInputFiles('#fileJuror', paJuror);
  await pa.page.waitForSelector('#infoJuror');
  await pa.page.check('#voterUseCheck');
  await pa.page.setInputFiles('#fileVoter', paVoter);
  await pa.page.waitForSelector('#infoVoter');
  await openStep(pa.page, 'run');
  await pa.page.waitForFunction(() => !document.getElementById('runBtn').disabled);
  await pa.page.click('#runBtn');
  await pa.page.waitForSelector('#countStrong');
  assert.strictEqual(await pa.page.locator('#countStrong .n').innerText(), '0');
  assert.strictEqual(await pa.page.locator('#countProbable .n').innerText(), '0');
  const paWeak = Number(await pa.page.locator('#countWeak .n').innerText());
  const paCannot = await pa.page.locator('#cannotCompareLine').innerText();
  assert.ok(paWeak + (Number(paCannot.match(/^(\d+)/)?.[1]) || 0) >= 1);
  assert.strictEqual(await pa.page.locator('#results tbody tr').count(), 0);
  assert.strictEqual(await pa.page.locator('#challengePanel').count(), 0);
  assert.strictEqual(await pa.page.locator('#paNamesNote').innerText(), paNote);
  assert.strictEqual(await pa.page.locator('#countyUnchecked').innerText(), 'The county could not be checked.');
  assert.strictEqual(await pa.page.locator('#exportBtn').count(), 0);
  assert.ok(!(await pa.page.locator('body').innerText()).includes('Sample Juror 01'));
  pass('AT-41');
  assert.deepStrictEqual(pa.requests, [], 'PA page network: ' + pa.requests.join('; '));
  await pa.context.close();
  await sameOrigin.context.close();
  await new Promise((resolve) => preview.close(resolve));

  const design = await openPage(browser);
  const RAW_FLAGS = /REGISTERED_BEFORE_DECLARATION|REGISTERED_AFTER_DECLARATION|DATES_NOT_COMPARABLE|POSSIBLE_WRONGFUL_REMOVAL/;
  async function shot(name) {
    await design.page.screenshot({ path: path.join(shots, name), fullPage: true });
  }
  await design.page.setViewportSize({ width: 1280, height: 800 });
  await selectState(design.page, 'NC');
  await design.page.waitForSelector('#stateBrief');
  assert.strictEqual(await design.page.locator('#stateBrief').innerText(), 'North Carolina: named leads allowed. Referral only. Why?');
  await assertFits(design.page, 1280, 'home NC');
  const rail = await design.page.locator('#stepper').boundingBox();
  assert.ok(rail && rail.y < 800, `stepper starts at ${rail && rail.y}`);
  await shot('home-nc-1280.png');
  await design.page.setViewportSize({ width: 390, height: 844 });
  await assertFits(design.page, 390, 'home NC');
  await shot('home-nc-390.png');
  await design.page.setViewportSize({ width: 1280, height: 800 });
  await attest(design.page);
  await pickCounty(design.page);
  await openStep(design.page, 'files');
  await design.page.waitForSelector('#typeGrid');
  await assertFits(design.page, 1280, 'files grid');
  const gridBox = await design.page.locator('#typeGrid').boundingBox();
  assert.ok(gridBox && gridBox.x + gridBox.width <= 1280, 'type grid escapes the 1280 viewport');
  await shot('files-grid-1280.png');
  await design.page.setViewportSize({ width: 390, height: 844 });
  await assertFits(design.page, 390, 'files grid');
  await shot('files-grid-390.png');
  await design.page.setViewportSize({ width: 1280, height: 800 });
  await design.page.click('#sampleBtn');
  await design.page.waitForSelector('#infoJuror');
  await openStep(design.page, 'run');
  await design.page.click('#runBtn');
  await design.page.waitForSelector('#results');
  const triageText = await design.page.locator('#step-panel-triage').innerText();
  assert.ok(!RAW_FLAGS.test(triageText), triageText);
  assert.ok(triageText.includes('Registered before the declaration'));
  await assertFits(design.page, 1280, 'triage');
  await shot('triage-1280.png');
  await design.page.setViewportSize({ width: 390, height: 844 });
  await assertFits(design.page, 390, 'triage');
  await shot('triage-390.png');
  const base = design.page.url().split('#')[0];
  await design.page.setViewportSize({ width: 1280, height: 800 });
  await design.page.goto(`${base}#/state/nc`);
  await design.page.waitForSelector('#walkthrough');
  assert.strictEqual(await design.page.locator('#ncWalkthrough').innerText(), ncNote);
  assert.strictEqual(await design.page.locator('#challengePanel').count(), 0);
  const headings = await design.page.locator('#walkthrough h2').allInnerTexts();
  assert.ok(headings.indexOf('Walk through it') === 0, headings.join(' | '));
  assert.ok(headings.indexOf('Walk through it') < headings.indexOf('At a glance'));
  const glance = await design.page.locator('#guide-at-a-glance').innerText();
  assert.ok(glance.includes('The jury list is public in this state.'));
  assert.ok(!glance.includes('Jury list public:'));
  await design.page.locator('#guide-state-layer').evaluate((node) => { node.open = true; });
  const ruleLink = design.page.locator('#guide-state-layer a[href^="http"]').first();
  assert.strictEqual(await ruleLink.getAttribute('target'), '_blank');
  assert.strictEqual(await ruleLink.getAttribute('rel'), 'noopener noreferrer');
  await assertFits(design.page, 1280, 'state NC');
  await shot('state-nc-1280.png');
  await design.page.setViewportSize({ width: 390, height: 844 });
  await assertFits(design.page, 390, 'state NC');
  await shot('state-nc-390.png');
  await design.page.setViewportSize({ width: 390, height: 844 });
  await design.page.goto(`${base}#/state/pa`);
  await design.page.waitForSelector('#walkthrough');
  assert.strictEqual(await design.page.locator('#paWalkthrough').innerText(), paNote);
  await assertFits(design.page, 390, 'state PA');
  await design.context.close();

  const mapShots = await openPage(browser, { viewport: { width: 1280, height: 800 } });
  const population = JSON.parse(fs.readFileSync(path.join(root, 'shared/map/population.json'), 'utf8'));
  const alleghenyPop = population.counties['42003'];
  const pennsylvaniaPop = population.states['42'];
  const alleghenyPct = ((alleghenyPop / pennsylvaniaPop) * 100).toFixed(1);
  const alleghenySentence = `Allegheny County, Pennsylvania: population ${alleghenyPop.toLocaleString('en-US')} of the state's ${pennsylvaniaPop.toLocaleString('en-US')} (${alleghenyPct}%)`;
  async function shootMap(name) {
    await mapShots.page.locator('#usMap').evaluate((node) => node.scrollIntoView({ block: 'start' }));
    await mapShots.page.screenshot({ path: path.join(shots, name) });
  }
  await mapShots.page.waitForSelector('#usMap path.is-available[data-code="PA"]');
  await mapShots.page.waitForSelector('#usMap path.is-later[data-code="GA"]');
  const legend = await mapShots.page.locator('.map-legend').innerText();
  assert.match(legend, /Available/);
  assert.match(legend, /Coming later/);
  const optionText = await mapShots.page.$$eval('#stateSel option', (opts) => opts.map((opt) => opt.textContent || ''));
  const pennsylvania = optionText.indexOf('Pennsylvania');
  const georgia = optionText.findIndex((text) => text.startsWith('Georgia'));
  assert.ok(pennsylvania > 0 && georgia > pennsylvania, optionText.join(' | '));
  assert.match(optionText[georgia], /\(coming later\)/);
  assert.strictEqual(await mapShots.page.locator('#stateSel option[value="GA"]').isEnabled(), true);
  await mapShots.page.waitForTimeout(200);
  await shootMap('map-us-1280.png');
  await mapShots.page.locator('#usMap path[data-code="PA"]').click();
  await mapShots.page.waitForFunction(() => document.querySelector('#stateSel').value === 'PA');
  await mapShots.page.waitForSelector('#usMap[data-level="state"]');
  await mapShots.page.waitForTimeout(900);
  await shootMap('map-pennsylvania-1280.png');
  await mapShots.page.locator('#usMap path[data-fips="42003"]').click();
  await mapShots.page.waitForSelector('#populationCard');
  await mapShots.page.waitForTimeout(900);
  assert.strictEqual(await mapShots.page.locator('#populationCardText').innerText(), alleghenySentence);
  assert.strictEqual(await mapShots.page.locator('#populationSource').innerText(), population.label);
  assert.strictEqual(await mapShots.page.locator('#county').inputValue(), '42003');
  await assertFits(mapShots.page, 1280, 'map allegheny');
  await shootMap('map-allegheny-1280.png');
  await mapShots.page.click('#mapBackState');
  await mapShots.page.waitForFunction(() => document.querySelector('#county').value === '' && document.querySelector('#stateSel').value === 'PA');
  await mapShots.page.click('#mapBackUs');
  await mapShots.page.waitForFunction(() => document.querySelector('#stateSel').value === '');
  await mapShots.page.locator('#usMap path[data-code="GA"]').click();
  await mapShots.page.waitForSelector('#usMap[data-level="state"] path.is-later');
  assert.strictEqual(await mapShots.page.locator('#usMap path.is-available').count(), 0);
  await mapShots.page.click('#mapBackUs');
  await mapShots.page.waitForSelector('#usMap[data-level="us"] path.is-available[data-code="PA"]');
  await mapShots.page.locator('#usMap path[data-code="DE"]').focus();
  await mapShots.page.keyboard.press('Enter');
  await mapShots.page.waitForFunction(() => document.querySelector('#stateSel').value === 'DE');
  await mapShots.page.locator('#usMap path[data-fips="10001"]').focus();
  await mapShots.page.keyboard.press('Space');
  await mapShots.page.waitForFunction(() => document.querySelector('#county').value === '10001');
  assert.match(await mapShots.page.locator('#populationCardText').innerText(), /Kent County, Delaware: population /);
  await mapShots.page.setViewportSize({ width: 390, height: 800 });
  await mapShots.page.click('#mapBackUs');
  await mapShots.page.waitForSelector('#usMap[data-level="us"]');
  await mapShots.page.waitForTimeout(900);
  await assertFits(mapShots.page, 390, 'map us narrow');
  await shootMap('map-us-390.png');
  await mapShots.page.selectOption('#stateSel', 'PA');
  await mapShots.page.waitForSelector('#usMap[data-level="state"]');
  await mapShots.page.waitForTimeout(900);
  await assertFits(mapShots.page, 390, 'map pa narrow');
  await shootMap('map-pennsylvania-390.png');
  await mapShots.page.selectOption('#county', '42003');
  await mapShots.page.waitForSelector('#populationCard');
  await mapShots.page.waitForTimeout(900);
  await assertFits(mapShots.page, 390, 'map allegheny narrow');
  await shootMap('map-allegheny-390.png');
  pass('AT-50-map');
  assert.deepStrictEqual(mapShots.requests, [], 'map page network: ' + mapShots.requests.join('; '));
  assert.deepStrictEqual(mapShots.errors, [], 'map page errors: ' + mapShots.errors.join('; '));
  await mapShots.context.close();

  const reducedPage = await openPage(browser, { reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });
  await reducedPage.page.waitForSelector('#usMap[data-motion="reduced"]');
  await reducedPage.page.selectOption('#stateSel', 'PA');
  await reducedPage.page.waitForFunction(() => {
    const box = document.querySelector('#usMap')?.getAttribute('viewBox') ?? '';
    return box.length > 0 && !box.startsWith('0 0 960');
  });
  const jumped = await reducedPage.page.locator('#usMap').getAttribute('viewBox');
  await reducedPage.page.waitForTimeout(250);
  assert.strictEqual(await reducedPage.page.locator('#usMap').getAttribute('viewBox'), jumped);
  await reducedPage.context.close();

  const ONLY_LINE = 'JuryRoll supports one use only: counting matches and referring them to election officials.';
  const paRules = JSON.parse(fs.readFileSync(path.join(root, 'shared/rules/PA.json'), 'utf8'));
  const usePage = await openPage(browser);
  await selectState(usePage.page, 'PA');
  await attest(usePage.page);
  await openStep(usePage.page, 'files');
  const panelBeforeSlot = await usePage.page.evaluate(() => {
    const panel = document.getElementById('voterUsePanel');
    const slot = document.getElementById('voterSlot');
    if (!panel || !slot) return false;
    return Boolean(panel.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  assert.strictEqual(panelBeforeSlot, true);
  assert.strictEqual(await usePage.page.locator('#voterUseText').evaluate((el) => el.textContent), paRules.voter_file.use_restriction);
  assert.strictEqual(await usePage.page.locator('#voterUseSource').getAttribute('href'), paRules.voter_file.source_url);
  assert.ok((await usePage.page.locator('#voterUseOnly').innerText()).includes(ONLY_LINE));
  assert.strictEqual(await usePage.page.locator('#voterUseCheck').isChecked(), false);
  assert.strictEqual(await usePage.page.locator('#fileVoter').isEnabled(), false);
  await usePage.page.setViewportSize({ width: 390, height: 844 });
  await assertFits(usePage.page, 390, 'PA voter use panel');
  await usePage.page.setViewportSize({ width: 1360, height: 900 });
  pass('AT-45');

  await usePage.page.evaluate(() => {
    const proto = FileReader.prototype;
    const original = proto.readAsText;
    window.__reads = 0;
    proto.readAsText = function readAsTextSpy(...args) {
      window.__reads += 1;
      return original.apply(this, args);
    };
    const slot = document.getElementById('voterSlot');
    const transfer = new DataTransfer();
    transfer.items.add(new File(['voter_id,name_last,data_note\nV9,Sample Voter 09,FICTIONAL SAMPLE DATA\n'], 'voters.csv', { type: 'text/csv' }));
    slot.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  assert.strictEqual(await usePage.page.evaluate(() => window.__reads), 0);
  assert.strictEqual(await usePage.page.locator('#infoVoter').count(), 0);
  assert.strictEqual(await usePage.page.locator('#fileVoter').isEnabled(), false);
  await usePage.page.check('#voterUseCheck');
  await usePage.page.evaluate(() => {
    const slot = document.getElementById('voterSlot');
    const transfer = new DataTransfer();
    transfer.items.add(new File(['voter_id,name_last,name_first,data_note\nV9,Sample Voter 09,Pat,FICTIONAL SAMPLE DATA\n'], 'voters.csv', { type: 'text/csv' }));
    slot.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  await usePage.page.waitForSelector('#infoVoter');
  const [useLogDownload] = await Promise.all([
    usePage.page.waitForEvent('download'),
    usePage.page.click('#downloadLog'),
  ]);
  const useLogPath = path.join(shots, 'voter-use-audit.jsonl');
  await useLogDownload.saveAs(useLogPath);
  const useLog = readAuditDownload(useLogPath);
  const useEntries = useLog.entries.filter((entry) => entry.type === 'voter_use_attested');
  assert.strictEqual(useEntries.length, 1);
  const useData = useEntries[0].data;
  assert.deepStrictEqual(Object.keys(useData).sort(), ['state', 'text_sha256']);
  assert.strictEqual(useData.state, 'PA');
  assert.strictEqual(useData.text_sha256, crypto.createHash('sha256').update(paRules.voter_file.use_restriction).digest('hex'));
  assert.ok(!useLog.text.includes(paRules.voter_file.use_restriction));
  assert.ok(!useLog.text.includes('Sample Voter 09'));
  await selectState(usePage.page, 'NC');
  await openStep(usePage.page, 'files');
  assert.strictEqual(await usePage.page.locator('#voterUsePanel').count(), 0);
  assert.strictEqual(await usePage.page.locator('#fileVoter').isEnabled(), true);
  await selectState(usePage.page, 'PA');
  await openStep(usePage.page, 'files');
  assert.strictEqual(await usePage.page.locator('#voterUseCheck').isChecked(), false);
  assert.strictEqual(await usePage.page.locator('#fileVoter').isEnabled(), false);
  await usePage.page.check('#voterUseCheck');
  await usePage.page.click('#purgeBtn');
  await usePage.page.waitForFunction(() => document.body.dataset.purged === '1');
  assert.strictEqual(await usePage.page.locator('#voterUseCheck').isChecked(), false);
  assert.strictEqual(await usePage.page.locator('#fileVoter').isEnabled(), false);
  pass('AT-46');
  assert.deepStrictEqual(usePage.requests, [], 'voter use network: ' + usePage.requests.join('; '));
  assert.deepStrictEqual(usePage.errors, [], 'voter use errors: ' + usePage.errors.join('; '));
  await usePage.context.close();

  const ga = await openPage(browser);
  await selectState(ga.page, 'GA');
  await ga.page.waitForSelector('#comingLater');
  await assertComingLater(ga.page, 'GA', 'Georgia');
  assert.strictEqual(await ga.page.locator('#voterUsePanel').count(), 0);
  assert.strictEqual(await ga.page.locator('#voterUseCheck').count(), 0);
  pass('AT-47');
  assert.deepStrictEqual(ga.requests, [], 'GA network: ' + ga.requests.join('; '));
  await ga.context.close();

  // LOGIC-CHANGES L.2 (REQ-NOTE 68): names-only notice, same-name label, and no match rate anywhere.
  const namesOnlyNotice = 'This list has names only. Many people share a name. A name-only match is not a lead and is never exported. If you copied the list by hand, check it against the original.';
  const sameNameLabel = 'Same-name pairs (not leads)';
  const ratioRe = /%|\b1\s+in\s+\d+|\bmatch(?:ing)?\s+rate\b|\bper\s?cent\b/i;
  // The population card shows the county's share of the state population (Census), not a share of juror rows.
  const pageText = (page) => page.evaluate(() => {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('#populationCardText').forEach((node) => node.remove());
    clone.querySelectorAll('details').forEach((node) => node.setAttribute('open', ''));
    return clone.textContent || '';
  });
  function assertNoRatio(text, label) {
    const hit = text.match(ratioRe);
    assert.ok(!hit, `${label} shows a ratio: ${hit && text.slice(Math.max(0, hit.index - 60), hit.index + 20)}`);
  }
  const req68Dir = path.join(shots, 'req68');
  fs.mkdirSync(req68Dir, { recursive: true });

  const paNames = await openPage(browser);
  const paNamesBase = paNames.page.url().split('#')[0];
  await paNames.page.goto(`${paNamesBase}#/run/pa`);
  await paNames.page.waitForFunction(() => document.querySelector('#stateSel') && document.querySelector('#stateSel').value === 'PA');
  await openStep(paNames.page, 'sign');
  await attest(paNames.page);
  await openStep(paNames.page, 'where');
  await paNames.page.selectOption('#county', '42001');
  await openStep(paNames.page, 'files');
  await paNames.page.setInputFiles('#fileJuror', path.join(fixtures, 'juror_pa_names_only.csv'));
  await paNames.page.waitForSelector('#infoJuror');
  assert.strictEqual(await paNames.page.locator('#namesOnlyNotice').innerText(), namesOnlyNotice);
  await paNames.page.locator('#namesOnlyNotice').scrollIntoViewIfNeeded();
  await paNames.page.screenshot({ path: path.join(req68Dir, 'req68-names-only-notice.png') });
  await paNames.page.check('#voterUseCheck');
  await paNames.page.setInputFiles('#fileVoter', path.join(fixtures, 'voter_pa_names_only.csv'));
  await paNames.page.waitForSelector('#infoVoter');
  await openStep(paNames.page, 'run');
  assert.strictEqual(await paNames.page.locator('#namesOnlyNoticeRun').innerText(), namesOnlyNotice);
  assert.ok(await paNames.page.locator('#namesOnlyNoticeRun').isVisible(), 'notice shows before the run');
  await paNames.page.waitForFunction(() => !document.getElementById('runBtn').disabled);
  await paNames.page.locator('#namesOnlyNoticeRun').scrollIntoViewIfNeeded();
  await paNames.page.screenshot({ path: path.join(req68Dir, 'req68-before-run.png') });
  await paNames.page.click('#runBtn');
  await paNames.page.waitForSelector('#countWeak');
  assert.strictEqual(await paNames.page.locator('#countStrong .n').innerText(), '0');
  assert.strictEqual(await paNames.page.locator('#countProbable .n').innerText(), '0');
  // A 4523 list has no declaration date, so B.4 puts every same-name pair in "cannot compare" (as in AT-41).
  assert.ok((await paNames.page.locator('#matcherCounts').innerText()).includes('Strong 0, Probable 0, same-name pairs (not leads) 3'));
  const paNamesWeak = Number(await paNames.page.locator('#countWeak .n').innerText());
  const paNamesCannot = Number((await paNames.page.locator('#cannotCompareLine').innerText()).match(/^(\d+)/)[1]);
  assert.strictEqual(paNamesWeak + paNamesCannot, 3);
  assert.ok((await paNames.page.locator('#countWeak').innerText()).includes(sameNameLabel));
  assert.ok((await paNames.page.locator('#weakDetails summary').innerText()).includes(`${sameNameLabel}: ${paNamesWeak}`));
  assert.strictEqual(await paNames.page.locator('#results tbody tr').count(), 0);
  const paSummary = await paNames.page.locator('#countySummary').innerText();
  assert.match(paSummary, new RegExp(`0 potential matches on the voter roll \\(Strong 0 \\/ Probable 0\\), ${paNamesWeak} same-name pairs \\(not leads\\), 0 excluded, ${paNamesCannot} cannot compare`));
  assertNoRatio(paSummary, 'PA county summary');
  await paNames.page.locator('#countWeak').scrollIntoViewIfNeeded();
  await paNames.page.screenshot({ path: path.join(req68Dir, 'req68-same-name-pairs.png') });
  assertNoRatio(await pageText(paNames.page), 'PA counts screen');
  await openStep(paNames.page, 'export');
  const [paNamesDownload] = await Promise.all([
    paNames.page.waitForEvent('download'),
    paNames.page.click('#exportBtn'),
  ]);
  const paNamesCsvPath = path.join(req68Dir, 'pa-names-only.csv');
  await paNamesDownload.saveAs(paNamesCsvPath);
  const paNamesCsv = fs.readFileSync(paNamesCsvPath, 'utf8');
  assert.ok(!/^Strong,|^Probable,|^Weak,/m.test(paNamesCsv), 'zero exported rows');
  for (const name of ['Sample Juror 31', 'Sample Juror 32']) assert.ok(!paNamesCsv.includes(name), name);
  assertNoRatio(paNamesCsv, 'PA export');
  pass('AT-58');
  await paNames.page.waitForSelector('#keepData');
  await paNames.page.click('#keepData');
  const [paNamesLog] = await Promise.all([
    paNames.page.waitForEvent('download'),
    paNames.page.click('#downloadLog'),
  ]);
  const paNamesLogPath = path.join(req68Dir, 'pa-names-only-audit.jsonl');
  await paNamesLog.saveAs(paNamesLogPath);
  assertNoRatio(fs.readFileSync(paNamesLogPath, 'utf8'), 'PA audit log');
  assertNoRatio(await pageText(paNames.page), 'PA page after export');
  assert.deepStrictEqual(paNames.errors, [], 'AT-58 page errors: ' + paNames.errors.join('; '));
  assert.deepStrictEqual(paNames.requests, [], 'AT-58 network: ' + paNames.requests.join('; '));
  await paNames.context.close();

  const tx = await openPage(browser);
  const txBase = tx.page.url().split('#')[0];
  await selectState(tx.page, 'TX');
  await tx.page.waitForSelector('#comingLater');
  assertNoRatio(await pageText(tx.page), 'TX check page');
  await tx.page.goto(`${txBase}#/records-audit/tx`);
  await tx.page.waitForSelector('#recordsLetter');
  await tx.page.selectOption('#recordsCounty', { index: 1 });
  for (const [id, value] of [['#countDeath', '40'], ['#countAddress', '10'], ['#countInactive', '4'], ['#countNotices', '1']]) await tx.page.fill(id, value);
  assertNoRatio(await tx.page.locator('#recordsLetter').innerText(), 'TX records letter');
  assertNoRatio(await pageText(tx.page), 'TX records page');
  const [txRecords] = await Promise.all([
    tx.page.waitForEvent('download'),
    tx.page.click('#recordsDownload'),
  ]);
  const txRecordsPath = path.join(req68Dir, 'tx-records.txt');
  await txRecords.saveAs(txRecordsPath);
  assertNoRatio(fs.readFileSync(txRecordsPath, 'utf8'), 'TX records download');
  await tx.page.goto(`${txBase}#/jury-handoff-letter/tx`);
  await tx.page.waitForSelector('#handoffState');
  if (await tx.page.locator('#handoffCounty').count()) await tx.page.selectOption('#handoffCounty', { index: 1 });
  assertNoRatio(await pageText(tx.page), 'TX handoff page');
  if (await tx.page.locator('#handoffDownload').count() && await tx.page.locator('#handoffDownload').isEnabled()) {
    assertNoRatio(await tx.page.locator('#handoffLetter').innerText(), 'TX handoff letter');
    const [txHandoff] = await Promise.all([
      tx.page.waitForEvent('download'),
      tx.page.click('#handoffDownload'),
    ]);
    const txHandoffPath = path.join(req68Dir, 'tx-handoff.txt');
    await txHandoff.saveAs(txHandoffPath);
    assertNoRatio(fs.readFileSync(txHandoffPath, 'utf8'), 'TX handoff download');
    console.log('AT-59 TX handoff letter checked');
  }
  assert.deepStrictEqual(tx.errors, [], 'AT-59 TX page errors: ' + tx.errors.join('; '));
  assert.deepStrictEqual(tx.requests, [], 'AT-59 TX network: ' + tx.requests.join('; '));
  await tx.context.close();
  pass('AT-59');

  await browser.close();
  console.log('ALL UI TESTS PASSED');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
