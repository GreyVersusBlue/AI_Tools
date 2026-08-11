// smoke-roster.mjs — the QR Code Generator's roster-labelled code sheet.
//
//   node Tools/qr-code-generator/test/smoke-roster.mjs
//
// Bulk mode could already turn a pasted list into a sheet of codes on Avery
// label stock. What it could not do was start from the class list the teacher
// already saved somewhere else, so labelling a set of thirty student folders
// meant retyping thirty names into a textarea that six other tools already
// know.
//
// Two things are actually under test here, and both are places where a naive
// implementation quietly does the wrong thing:
//
//   1. The generated lines are TAB-separated, not comma-separated. A roster
//      full of "Lovelace, Ada" entries fed through a comma delimiter gets cut
//      in half — the label becomes "Lovelace" and the code encodes ", Ada".
//   2. Filling from a roster switches the print layout to Avery labels, since
//      a per-student sheet is a sheet of stickers. It must not stomp a preset
//      the teacher already picked.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8191;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/016-qr-code-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

// Deliberately includes a "Last, First" name — the comma is the whole point.
const ROSTERS = {
  'Period 3 Social Studies': ['Ada Lovelace', 'Lovelace, Marco', 'Nellie Bly', 'Zheng He'],
  'Period 5 Social Studies': ['Grace Hopper', 'Ida B Wells'],
};

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });

console.log('QR Code Generator — roster-labelled code sheet');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await page.evaluate(r => localStorage.setItem('np_rosters', JSON.stringify(r)), ROSTERS);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);

/* ── 1. the saved rosters show up, with counts ─────────────────────────── */
await page.click('label[for="mode-bulk"]');
await settle(page, 200);
eq(await page.isVisible('#bulk-roster-group'), true, 'the roster panel is part of bulk mode');
const opts = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#bulk-roster option')).map(o => o.textContent));
eq(opts.length, 3, 'both saved rosters are offered (plus the placeholder)');
ok(opts.includes('Period 3 Social Studies (4)'), 'listed by name with a headcount: ' + JSON.stringify(opts));

/* ── 2. names only: one labelled line per student ──────────────────────── */
await page.selectOption('#bulk-roster', 'Period 3 Social Studies');
eq(await page.isVisible('#bulk-roster-link-group'), false, 'the link field stays out of the way for name-only codes');
await page.click('#btn-bulk-roster');
await settle(page, 200);

const lines = (await page.inputValue('#bulk-text')).split('\n');
eq(lines.length, 4, 'one line per student');
eq(lines[0], 'Ada Lovelace\tAda Lovelace', 'label and content are tab-separated');
ok(lines.every(l => l.indexOf('\t') !== -1), 'every line uses a tab, not a comma');

/* the comma-in-a-name case, end to end through the tool's own parser */
const parsed = await page.evaluate(() => {
  document.getElementById('btn-bulk-generate').click();
  return null;
});
await settle(page, 1200);
const captions = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#bulk-grid .bulk-item-label')).map(n => n.textContent));
eq(captions.length, 4, 'four codes were generated');
ok(captions.includes('Lovelace, Marco'),
   '"Lovelace, Marco" survives as one label instead of splitting on the comma: ' + JSON.stringify(captions));
ok(captions.every(c => !/unverified|failed/.test(c)),
   'and every code decodes back to itself: ' + JSON.stringify(captions));

/* ── 3. it lands on label stock without being asked twice ──────────────── */
eq(await page.inputValue('#bulk-sheet'), 'avery5160', 'the print layout switched to Avery 5160');
eq(await page.isVisible('#bulk-cols-row'), false, 'so the plain-paper column picker is out of the way');
const printItems = await page.evaluate(() => {
  const el = document.querySelector('#print-area-bulk .bulk-item');
  return { count: document.querySelectorAll('#print-area-bulk .bulk-item').length, w: el && el.style.width, h: el && el.style.height };
});
eq(printItems.count, 4, 'the print sheet has one label per student');
eq(printItems.w, '2.625in', 'sized to the physical label width');
eq(printItems.h, '1in', 'and height');
ok(/Avery 5160/.test(await page.textContent('#bulk-status')), 'the status line names the sheet needed');

/* an explicitly chosen preset is not overwritten by the next fill */
await page.selectOption('#bulk-sheet', 'avery5163');
await page.selectOption('#bulk-roster', 'Period 5 Social Studies');
await page.click('#btn-bulk-roster');
await settle(page, 200);
eq(await page.inputValue('#bulk-sheet'), 'avery5163', 'a preset the teacher already picked is left alone');
eq((await page.inputValue('#bulk-text')).split('\n').length, 2, 'and the shorter roster replaced the longer one');

/* ── 4. a link per student ─────────────────────────────────────────────── */
await page.selectOption('#bulk-roster-mode', 'link-name');
await settle(page, 100);
eq(await page.isVisible('#bulk-roster-link-group'), true, 'choosing a link mode reveals the link field');
await page.click('#btn-bulk-roster');
await settle(page, 150);
ok(/Add the link/.test(await page.textContent('#bulk-status')), 'an empty link is refused by name rather than silently encoding nothing');

await page.fill('#bulk-roster-link', 'https://example.org/turn-in?unit=3');
await page.click('#btn-bulk-roster');
await settle(page, 200);
const linked = (await page.inputValue('#bulk-text')).split('\n').map(l => l.split('\t'));
eq(linked[0][0], 'Grace Hopper', 'the label is still the plain name');
eq(linked[0][1], 'https://example.org/turn-in?unit=3&student=Grace%20Hopper',
   'the name is appended as a parameter, url-encoded, onto the existing query string');

await page.fill('#bulk-roster-link', 'https://example.org/{name}/portfolio');
await page.click('#btn-bulk-roster');
await settle(page, 200);
const templated = (await page.inputValue('#bulk-text')).split('\n')[1].split('\t');
eq(templated[1], 'https://example.org/Ida%20B%20Wells/portfolio', 'a {name} placeholder is substituted where it sits');

await page.selectOption('#bulk-roster-mode', 'link');
await page.fill('#bulk-roster-link', 'https://example.org/one-form');
await page.click('#btn-bulk-roster');
await settle(page, 200);
const shared = (await page.inputValue('#bulk-text')).split('\n').map(l => l.split('\t'));
eq(shared[0][1], 'https://example.org/one-form', 'the same-link mode encodes the link untouched');
eq(shared[1][1], 'https://example.org/one-form', 'for everyone');
eq(shared[1][0], 'Ida B Wells', 'while still labelling each label with a different student');

/* ── 5. this tool never writes the shared roster key ───────────────────── */
eq(await page.evaluate(() => localStorage.getItem('np_rosters')), JSON.stringify(ROSTERS),
   'np_rosters is read-only here — byte-identical after all of the above');

/* ── 6. no saved rosters at all says so ────────────────────────────────── */
const empty = await prepPage(browser, BASE, { width: 1200, height: 900 });
await empty.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(empty, 300);
await empty.click('label[for="mode-bulk"]');
await settle(empty, 150);
ok(/No saved rosters/.test(await empty.textContent('#bulk-roster')), 'an empty toolkit says there are no rosters');
eq(await empty.evaluate(() => document.getElementById('btn-bulk-roster').disabled), true, 'and the fill button is disabled rather than erroring');

/* ── 7. no console noise ───────────────────────────────────────────────── */
for (const [name, p] of [['main', page], ['empty', empty]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
