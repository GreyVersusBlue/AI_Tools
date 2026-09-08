// smoke-share.mjs — the Rubric Builder's "Share rubric…" sheet.
//
//   node Tools/rubric-builder/test/smoke-share.mjs
//
// Path 6 P2's third increment moved this tool off state-link.js's own
// mountShareControl — a button that module built itself, copy-link only,
// every message through alert() — and onto the shared sheet, which adds a
// QR code with a measured payload budget and a downloadable .json.
//
// Two things here are worth a suite rather than a diff. First, what travels:
// a rubric and its scores live under different storage prefixes
// (`gvb-rubric-builder:data:` and `gvb-rubric-builder:scores:`), and a link
// that carried a class's marks to whoever the teacher sent it to would be a
// privacy failure, not a feature. Section 2 proves it does not. Second, the
// open sheet is a dialog behind a click, and the site-wide axe sweep opens
// every page with empty storage and cannot click — so section 5 scans it,
// in BOTH themes, because this page paints a real dark palette and the
// sheet paints its own surface on top of it.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8233;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/003-rubric-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

console.log('Rubric Builder — share a rubric');

await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 600);

await page.fill('#rubricName', 'Expedition Journal Rubric');
await page.dispatchEvent('#rubricName', 'change');
await settle(page, 200);
await page.fill('#rubricTitle', 'Expedition Journal — Grading Rubric');
await page.dispatchEvent('#rubricTitle', 'change');
await settle(page, 300);

/* A real student score, saved through the tool's own Score-a-student mode, so
   section 2's "the marks do not travel" is a claim about real stored data
   rather than about an empty store. */
await page.click('#modeScoreBtn');
await settle(page, 300);
await page.fill('#studentNameInput', 'Ada Lovelace');
await page.click('#loadStudentScoreBtn');
await settle(page, 400);
const scoreKeys = await page.evaluate(() =>
  Object.keys(localStorage).filter(k => k.indexOf('gvb-rubric-builder:scores:') === 0));
ok(scoreKeys.length > 0, 'a student score is on file before sharing: ' + JSON.stringify(scoreKeys));
await page.click('#modeBuildBtn');
await settle(page, 300);

/* ── 1. the button is a real button in the toolbar ──────────────────────── */
eq(await page.isVisible('#shareBtn'), true, 'the toolbar has a Share rubric… button');

/* Opens the sheet, clicks Copy link, and CLOSES it in the same call: the
   sheet is a real modal with a backdrop, and leaving it open makes the next
   click on the page miss. */
const shareLink = async (p = page) => {
  await p.click('#shareBtn');
  await settle(p, 250);
  return p.evaluate(() => {
    let captured = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
    });
    document.querySelector('.share-sheet button[data-share="copy"]').click();
    return new Promise(r => setTimeout(() => { window.Share.close(); r(captured); }, 60));
  });
};

const url = await shareLink();
ok(url && url.indexOf('rubric=') !== -1, 'the Copy link row produces a ?rubric= link');
ok(/Link copied/.test(await page.textContent('#shareNote')),
  'and the note under the toolbar says so, in place of the old alert()');

/* ── 2. the rubric travels; the marks do not ────────────────────────────── */
const payload = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('rubric')), url);
eq(payload.name, 'Expedition Journal Rubric', 'the payload carries the rubric name');
eq(payload.title, 'Expedition Journal — Grading Rubric', 'and its printed title');
ok(Array.isArray(payload.criteria), 'and its criteria');
ok(Array.isArray(payload.levels) && payload.levels.length > 0, 'and its performance levels');
const asText = JSON.stringify(payload);
ok(!/Ada Lovelace/.test(asText), 'no student name is in the payload');
ok(!/selections|overallComment/.test(asText), 'nor any scoring: ' + asText.slice(0, 120));

/* ── 3. opening the link elsewhere saves it as a NEW rubric ─────────────── */
const other = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await other.goto(url, { waitUntil: 'load' });
await settle(other, 800);
eq(await other.inputValue('#rubricName'), 'Expedition Journal Rubric', 'the receiving browser opens the shared rubric');
ok(/Loaded a shared rubric/.test(await other.textContent('#shareNote')), 'and says so');
eq(new URL(other.url()).searchParams.get('rubric'), null,
  'the parameter is consumed on open, so a refresh cannot import it twice');
const arrivedScores = await other.evaluate(() =>
  Object.keys(localStorage).filter(k => k.indexOf('gvb-rubric-builder:scores:') === 0));
eq(arrivedScores.length, 0, 'and no score came with it: ' + JSON.stringify(arrivedScores));

/* Opening the SAME link twice must not overwrite the first arrival. */
await other.goto(url, { waitUntil: 'load' });
await settle(other, 800);
const names = await other.evaluate(() => {
  const raw = localStorage.getItem('gvb-rubric-builder:list');
  try { return JSON.parse(raw); } catch (e) { return raw; }
});
ok(JSON.stringify(names).includes('(2)'),
  'a second copy of the same link lands under a suffixed name rather than over the first: ' + JSON.stringify(names));

/* ── 4. the sheet's rows and its download ───────────────────────────────── */
await page.click('#shareBtn');
await settle(page, 250);
const rows = await page.$$eval('.share-sheet-rows button', bs => bs.map(b => b.getAttribute('data-share')));
ok(rows.includes('copy') && rows.includes('qr') && rows.includes('download'),
  'the sheet offers copy, QR and download: ' + JSON.stringify(rows));
const qr = await page.evaluate(() => {
  const b = document.querySelector('.share-sheet button[data-share="qr"]');
  return { disabled: b.disabled, reason: (document.querySelector('.share-sheet-reason') || {}).textContent || '' };
});
if (!qr.disabled) {
  await page.click('.share-sheet button[data-share="qr"]');
  await settle(page, 250);
  ok(await page.evaluate(() => document.querySelector('.share-sheet-qr canvas').width) > 100,
    'a default-size rubric fits a scannable QR');
} else {
  ok(/(KB|modules)/.test(qr.reason), 'an over-large rubric greys the QR row out with a reason: ' + JSON.stringify(qr.reason));
}
const file = await page.evaluate(() => {
  let text = null;
  const realCreate = URL.createObjectURL;
  URL.createObjectURL = (blob) => { blob.text().then(t => { text = t; }); return realCreate.call(URL, blob); };
  document.querySelector('.share-sheet button[data-share="download"]').click();
  return new Promise(r => setTimeout(() => { URL.createObjectURL = realCreate; r(text); }, 200));
});
const parsedFile = JSON.parse(file);
eq(parsedFile.aplp.tool, 'rubric-builder', 'the downloaded file says which tool it belongs to');
eq(parsedFile.aplp.param, 'rubric', 'and which parameter it is a payload for');
eq(await page.evaluate(t => window.Share.unwrap(JSON.parse(t)).name, file), 'Expedition Journal Rubric',
  'Share.unwrap() reads that envelope back as a plain rubric payload');

/* ── 5. axe on the open sheet, in both themes ───────────────────────────── */
const light = await a11yScan(page, { impact: 'serious', include: '.share-sheet' });
eq(light.length, 0, 'no serious/critical axe violations on the open sheet in light: ' +
  JSON.stringify(light.map(v => v.id)));
await page.evaluate(() => {
  localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' }));
});
await page.reload({ waitUntil: 'load' });
await settle(page, 700);
eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark',
  'the page is in its own dark theme');
await page.click('#shareBtn');
await settle(page, 300);
const dark = await a11yScan(page, { impact: 'serious', include: '.share-sheet' });
eq(dark.length, 0, 'and none in dark, where the sheet paints its own surface over the page: ' +
  JSON.stringify(dark.map(v => v.id)));
await page.keyboard.press('Escape');
await settle(page, 200);
ok(!(await page.$('.share-sheet')), 'Escape closes the sheet');

/* ── 6. a mangled link fails in words, once ─────────────────────────────── */
const broken = await prepPage(browser, BASE, { width: 1200, height: 900 });
await broken.goto(URL_PAGE + '?rubric=not-base64-%%%', { waitUntil: 'load' });
await settle(broken, 700);
ok(/could not be read/.test(await broken.textContent('#shareNote')),
  'a mangled link says so rather than opening blank: ' + JSON.stringify(await broken.textContent('#shareNote')));
eq(new URL(broken.url()).searchParams.get('rubric'), null,
  'and is cleared even though it was unusable, so a refresh does not repeat the failure');

/* ── 7. no console noise ────────────────────────────────────────────────── */
for (const [name, p] of [['sender', page], ['receiver', other], ['broken-link', broken]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
