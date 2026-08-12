// smoke-allowed.mjs — the formula sheet's allowed-on-the-test subset.
//
//   node Tools/formula-sheet-builder/test/smoke-allowed.mjs
//
// A reference sheet and a test-day reference sheet are different documents.
// The second one is shorter, and — the part that actually matters — it has to
// say what it is approved for, because a bare list of formulas sitting on a
// desk during an assessment is a page nobody can vouch for.
//
// Three things worth pinning, each a place this goes quietly wrong:
//
//   - A sheet saved before the flag existed has no `allowed` on any formula.
//     Read that as "not allowed" and switching the mode on empties a year of
//     saved sheets.
//   - Ticking a box must not rebuild the list under the teacher's hand: the
//     obvious wiring re-renders everything and takes the focus with it, which
//     makes ticking six boxes in a row unpleasant in a way nobody reports.
//   - The printed page is the deliverable, not the preview.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8206;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/041-formula-sheet-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1500, height: 1050 });

console.log('Formula Sheet Builder — allowed-on-the-test subset');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 500);

/* Load a real template so there is a sheet worth subsetting. */
const templates = await page.$$eval('#templatePicker option', els => els.map(o => o.value).filter(Boolean));
ok(templates.length > 0, 'there is a template to start from');
await page.selectOption('#templatePicker', templates[0]);
await page.click('#loadTemplateBtn');
await settle(page, 600);

const rowCount = await page.$$eval('#itemsList .item-row', e => e.length);
ok(rowCount >= 4, `the template brought in a sheet worth subsetting (${rowCount} formulas)`);
const printedCount = () => page.$$eval('#previewArea .formula', e => e.length);
eq(await printedCount(), rowCount, 'everything prints to begin with');

/* ── everything is allowed until somebody says otherwise ───────────────── */
eq(await page.$$eval('#itemsList input[data-allow]', els => els.filter(e => e.checked).length), rowCount,
   'every formula starts ticked — a sheet is the whole list until a subset is chosen');
eq(await page.isChecked('#allowedOnlyBox'), false, 'and the subset mode is off');
ok(!(await page.isVisible('#assessmentRow')), 'so the assessment field stays out of the way');
ok(/All \d+ print until you switch this on/.test(await page.textContent('#allowCount')),
   'the count line says what will happen: ' + await page.textContent('#allowCount'));

/* ── ticking down to a subset ──────────────────────────────────────────── */
const boxes = await page.$$('#itemsList input[data-allow]');
for (let i = 2; i < boxes.length; i++) { await boxes[i].uncheck(); await settle(page, 60); }
await settle(page, 300);
eq(await printedCount(), rowCount, 'unticking alone changes nothing — the flags are set first, the mode second');
ok(/2 of \d+ are ticked/.test(await page.textContent('#allowCount')),
   'though the count line already reflects it: ' + await page.textContent('#allowCount'));

await page.check('#allowedOnlyBox');
await settle(page, 400);
eq(await printedCount(), 2, 'switching the mode on drops the sheet to the ticked formulas');
ok(await page.isVisible('#assessmentRow'), 'and asks what they are approved for');
ok(/2 of \d+ formulas will print/.test(await page.textContent('#allowCount')), 'with the count restated');

/* ── the line that makes the page defensible ───────────────────────────── */
const banner = () => page.textContent('#previewArea .sheet-approved').catch(() => '');
ok(/Approved for/.test(await banner()),
   'the sheet says it is a permitted subset even before an assessment is named: ' + await banner());
ok(/these formulas only/.test(await banner()),
   'and says the list is exhaustive, which is the claim being made');

await page.fill('#assessmentName', 'Unit 4 Test — Area & Volume');
await settle(page, 400);
ok(/Unit 4 Test/.test(await banner()), 'naming the assessment puts it on the sheet: ' + await banner());
eq(await page.evaluate(() => document.activeElement && document.activeElement.id), 'assessmentName',
   'and typing into that field does not rebuild it out from under the caret');

/* Unticking must not steal focus either — six boxes in a row is the real use. */
const firstBox = (await page.$$('#itemsList input[data-allow]'))[0];
await firstBox.focus();
await firstBox.uncheck();
await settle(page, 300);
eq(await page.evaluate(() => {
  const el = document.activeElement;
  return el && el.getAttribute && el.getAttribute('data-allow');
}), '0', 'the checkbox keeps focus after being ticked, so a run of them can be worked through');
eq(await printedCount(), 1, 'and the preview follows immediately');
await firstBox.check();
await settle(page, 300);

/* ── turning it back off restores the full sheet ───────────────────────── */
await page.uncheck('#allowedOnlyBox');
await settle(page, 400);
eq(await printedCount(), rowCount, 'switching the mode off brings the whole sheet back — nothing was deleted');
eq(await page.$$eval('#previewArea .sheet-approved', e => e.length), 0, 'and the approval line comes off with it');

/* ── an empty subset says why, rather than printing a blank page ───────── */
await page.check('#allowedOnlyBox');
await settle(page, 200);
for (const b of await page.$$('#itemsList input[data-allow]')) { await b.uncheck(); await settle(page, 50); }
await settle(page, 400);
eq(await printedCount(), 0, 'nothing ticked, nothing printed');
ok(/Nothing is ticked/.test(await page.textContent('#previewArea')),
   'the sheet itself explains the empty page rather than leaving it blank');
ok(await page.$eval('#allowCount', e => e.classList.contains('warn')),
   'and the count line reads as a problem to fix');

/* ── it survives a reload, and an older sheet is not emptied by it ─────── */
for (const b of (await page.$$('#itemsList input[data-allow]')).slice(0, 2)) { await b.check(); await settle(page, 50); }
await settle(page, 400);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 600);
eq(await page.isChecked('#allowedOnlyBox'), true, 'the mode survives a reload');
eq(await page.inputValue('#assessmentName'), 'Unit 4 Test — Area & Volume', 'so does the assessment name');
eq(await printedCount(), 2, 'and so do the individual ticks');

/* A sheet written before this round has no `allowed` field anywhere. Reading
   that as "not allowed" would empty every saved sheet the first time the mode
   was switched on — the one failure here that destroys existing work. */
await page.evaluate(() => {
  const keys = Object.keys(localStorage).filter(k => k.indexOf('data:') !== -1);
  keys.forEach(k => {
    try {
      const v = JSON.parse(localStorage.getItem(k));
      if (v && Array.isArray(v.items)) {
        v.items.forEach(i => { delete i.allowed; });
        delete v.allowedOnly;
        delete v.assessment;
        localStorage.setItem(k, JSON.stringify(v));
      }
    } catch (e) { /* not a sheet */ }
  });
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 600);
eq(await page.isChecked('#allowedOnlyBox'), false, 'a sheet saved before this round opens with the mode off');
eq(await page.$$eval('#itemsList input[data-allow]', els => els.filter(e => e.checked).length),
   await page.$$eval('#itemsList .item-row', e => e.length),
   'and every formula on it counts as allowed — the sheet was the whole list');
await page.check('#allowedOnlyBox');
await settle(page, 400);
eq(await printedCount(), rowCount,
   'so switching the mode on does not silently empty a year of saved sheets');

/* ── no console noise, nothing left the site ───────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
