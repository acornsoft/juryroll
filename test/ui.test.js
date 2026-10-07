// Browser test: loads index.html in headless Chrome, feeds the sample CSVs, checks counts and export, takes a screenshot.
const { chromium } = require('playwright-core');
const path = require('path'), fs = require('fs'), assert = require('assert');
const root = path.join(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) requests.push(r.url()); });
  await page.goto('file://' + path.join(root, 'index.html'));
  await page.setInputFiles('#fileJuror', path.join(root, 'sample_juror_disqualifications.csv'));
  await page.setInputFiles('#fileVoter', path.join(root, 'sample_voter_roll.csv'));
  await page.waitForFunction(() => !document.getElementById('runBtn').disabled);
  await page.click('#runBtn');
  await page.waitForSelector('#countStrong');
  const counts = await page.evaluate(() => ['Strong', 'Probable', 'Weak'].map(t => +document.querySelector('#count' + t + ' .n').textContent));
  console.log('UI tier counts [Strong, Probable, Weak]:', counts);
  assert.deepStrictEqual(counts, [3, 4, 2]);
  const rowsDefault = await page.locator('#results tr').count() - 1;
  assert.strictEqual(rowsDefault, 7, 'weak rows must be hidden by default');
  // export default (no weak)
  let [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);
  const p1 = path.join(__dirname, 'export_default.csv'); await dl.saveAs(p1);
  const csv1 = fs.readFileSync(p1, 'utf8');
  console.log('Export file name:', dl.suggestedFilename());
  assert.ok(csv1.replace(/^\uFEFF/, '').startsWith('Referral for official verification'));
  assert.ok(!/^Weak,/m.test(csv1));
  console.log('Default export data rows:', csv1.trim().split(/\r\n/).length - 5);
  // show weak
  await page.check('#showWeak');
  const rowsWeak = await page.locator('#results tr').count() - 1;
  assert.strictEqual(rowsWeak, 9);
  assert.ok(await page.isVisible('#weakWarn'));
  assert.deepStrictEqual(errors, [], 'page errors: ' + errors.join('; '));
  assert.deepStrictEqual(requests, [], 'network requests: ' + requests.join('; '));
  await page.screenshot({ path: path.join(root, 'screenshot.png'), fullPage: true });
  console.log('Screenshot saved. Page errors: 0. Network requests: 0.');
  await browser.close();
  console.log('ALL UI TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
