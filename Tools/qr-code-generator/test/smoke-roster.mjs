// smoke-roster.mjs — the QR Code Generator's roster-labelled code sheet.
//
//   node Tools/qr-code-generator/test/smoke-roster.mjs
//
// Bulk mode could already turn a pasted list into a sheet of codes on Avery
// label stock. What it could not do was start from the class list the teacher
// already saved somewhere else, so labelling thirty student folders meant
// retyping thirty names into a textarea that fifteen other tools already know.
// That shortcut shipped without a suite; this is it.
//
// Three things are actually under test, and each is somewhere a plausible
// implementation quietly does the wrong thing:
//
//   1. The generated lines are TAB-separated, not comma-separated. Rosters are
//      full of "Ruiz, Marisol", and splitBulkLine() splits on the first comma
//      when there is no tab — so a comma-joined line would label the sticker
//      "Ruiz" and encode ", Marisol". Nothing on screen would look broken.
//   2. Filling from a roster moves the print layout to Avery labels, because a
//      per-student sheet is a sheet of stickers. It must not stomp a preset the
//      teacher chose on purpose.
//   3. `np_rosters` is somebody else's key. This tool reads it and must never
//      write it, not even to tidy it.
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

// The "Ruiz, Marisol" entry is the whole reason this file exists. The blank and
// the padded entry are there because a roster typed by hand has both.
const ROSTERS = {
  'Period 3 Social Studies': ['Ada Lovelace', 'Ruiz, Marisol', '  Nellie Bly  ', '', 'Zheng He'],
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

/* ── 1. the saved rosters show up, counted ─────────────────────────────── */
await page.click('label[for="mode-bulk"]');
await settle(page, 200);
ok(await page.isVisible('#bulk-roster-panel'), 'the roster panel is part of bulk mode');
const opts = await page.$$eval('#bulk-roster option', els => els.map(o => o.textContent));
eq(opts.length, 3, 'both saved rosters are offered, plus the placeholder');
ok(opts.includes('Period 3 Social Studies (4)'),
   'named, and counted after the blank line is dropped: ' + JSON.stringify(opts));

/* ── 2. names only: one labelled line per student, tab-separated ───────── */
await page.selectOption('#bulk-roster', 'Period 3 Social Studies');
ok(!(await page.isVisible('#bulk-roster-link-group')), 'the link field stays out of the way for name-only codes');
await page.click('#btn-bulk-roster');
await settle(page, 250);

const lines = (await page.inputValue('#bulk-text')).split('\n').filter(Boolean);
eq(lines.length, 4, 'one line per student, and none for the blank roster entry');
eq(lines[0], 'Ada Lovelace\tAda Lovelace', 'label and content are tab-separated');
ok(lines.every(l => l.indexOf('\t') !== -1), 'every line uses a tab, not a comma');
eq(lines[1], 'Ruiz, Marisol\tRuiz, Marisol', 'so a comma inside a name is just part of the name');
eq(lines[2], 'Nellie Bly\tNellie Bly', 'and a hand-typed entry is trimmed on the way through');

/* the comma-in-a-name case, all the way out to a drawn code */
await page.click('#btn-bulk-generate');
await page.waitForFunction(
  () => document.querySelectorAll('#bulk-grid .bulk-item').length > 0, null, { timeout: 30000 });
await settle(page, 400);
const captions = await page.$$eval('#bulk-grid .bulk-item-label', els => els.map(n => n.textContent));
eq(captions.length, 4, 'four codes were generated');
ok(captions.includes('Ruiz, Marisol'),
   '"Ruiz, Marisol" is one label rather than two halves: ' + JSON.stringify(captions));
ok(captions.every(c => !/unverified|—/.test(c)),
   'and every code decodes back to itself: ' + JSON.stringify(captions));

/* ── 3. it lands on label stock without being asked twice ──────────────── */
eq(await page.inputValue('#bulk-sheet'), 'avery5160', 'the print layout moved to Avery 5160');
ok(!(await page.isVisible('#bulk-cols-row')), 'so the plain-paper column picker is out of the way');
ok(/Avery 5160/.test(await page.textContent('#bulk-roster-msg')),
   'and the panel says it did it, rather than changing the layout silently');
const printItems = await page.evaluate(() => {
  const el = document.querySelector('#print-area-bulk .bulk-item');
  return {
    count: document.querySelectorAll('#print-area-bulk .bulk-item').length,
    w: el && el.style.width, h: el && el.style.height,
  };
});
eq(printItems.count, 4, 'the print sheet has one label per student');
eq(printItems.w, '2.625in', 'sized to the physical label width');
eq(printItems.h, '1in', 'and height');
ok(/Avery 5160/.test(await page.textContent('#bulk-status')), 'the status line names the stock needed');

/* A preset chosen on purpose survives the next fill — this is the half of the
   rule that a "just set it every time" implementation gets wrong. */
await page.selectOption('#bulk-sheet', 'avery5163');
await page.fill('#bulk-text', '');
await page.selectOption('#bulk-roster', 'Period 5 Social Studies');
await page.click('#btn-bulk-roster');
await settle(page, 250);
eq(await page.inputValue('#bulk-sheet'), 'avery5163', 'a preset the teacher already picked is left alone');
ok(!/Avery/.test(await page.textContent('#bulk-roster-msg')), 'and nothing claims to have changed it');

/* Filling adds to the textarea rather than replacing it, so two class periods
   can go onto one sheet of stickers. Worth pinning: it is the surprising half. */
await page.click('#btn-bulk-roster');
await settle(page, 250);
eq((await page.inputValue('#bulk-text')).split('\n').filter(Boolean).length, 4,
   'a second fill appends rather than replacing — two periods, one sheet');

/* ── 4. a link per student ─────────────────────────────────────────────── */
await page.fill('#bulk-text', '');
await page.selectOption('#bulk-roster-mode', 'link');
await settle(page, 150);
ok(await page.isVisible('#bulk-roster-link-group'), 'choosing the link mode reveals the link field');
ok((await page.inputValue('#bulk-roster-link')).length > 0,
   'pre-filled with a shape to edit rather than an empty box');

await page.fill('#bulk-roster-link', 'https://example.org/{roster}/{n}/{name}');
await page.click('#btn-bulk-roster');
await settle(page, 250);
const linked = (await page.inputValue('#bulk-text')).split('\n').filter(Boolean).map(l => l.split('\t'));
eq(linked[0][0], 'Grace Hopper', 'the label is still the plain name');
eq(linked[0][1], 'https://example.org/Period%205%20Social%20Studies/1/Grace%20Hopper',
   'and every placeholder is filled in, URL-encoded, in place');
eq(linked[1][1], 'https://example.org/Period%205%20Social%20Studies/2/Ida%20B%20Wells',
   '{n} counts up the list rather than repeating');

await page.fill('#bulk-text', '');
await page.fill('#bulk-roster-link', 'https://example.org/one-form');
await page.click('#btn-bulk-roster');
await settle(page, 250);
const shared = (await page.inputValue('#bulk-text')).split('\n').filter(Boolean).map(l => l.split('\t'));
eq(shared[0][1], 'https://example.org/one-form', 'a link with no placeholders is encoded untouched');
eq(shared[1][1], 'https://example.org/one-form', 'for everyone');
eq(shared[1][0], 'Ida B Wells', 'while each sticker still carries a different name');

/* ── 5. this tool never writes the shared roster key ───────────────────── */
eq(await page.evaluate(() => localStorage.getItem('np_rosters')), JSON.stringify(ROSTERS),
   'np_rosters is byte-identical after all of the above');

/* ── 6. nothing saved anywhere says so, instead of erroring ────────────── */
const empty = await prepPage(browser, BASE, { width: 1200, height: 900 });
await empty.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(empty, 300);
await empty.click('label[for="mode-bulk"]');
await settle(empty, 200);
ok(/No saved rosters/.test(await empty.textContent('#bulk-roster')), 'an empty toolkit says there are no rosters');
eq(await empty.evaluate(() => document.getElementById('btn-bulk-roster').disabled), true,
   'and the fill button is disabled rather than throwing');
ok(/Name Picker|Class Roster Hub/.test(await empty.textContent('#bulk-roster-msg')),
   'pointing at the tools that make one');

/* A roster saved in another tab is picked up on the next switch into bulk
   mode — the tool has no storage listener, so this is the only way in. */
await empty.evaluate(() => localStorage.setItem('np_rosters', JSON.stringify({ 'Homeroom': ['Amaia Etxeberria'] })));
await empty.click('label[for="mode-single"]');
await empty.click('label[for="mode-bulk"]');
await settle(empty, 200);
ok(/Homeroom/.test(await empty.textContent('#bulk-roster')),
   'a roster saved after the page loaded turns up on the next visit to bulk mode');

/* ── 7. no console noise, nothing left the site ────────────────────────── */
for (const [name, p] of [['main', page], ['empty', empty]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
