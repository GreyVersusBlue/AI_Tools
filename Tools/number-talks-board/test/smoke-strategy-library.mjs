// smoke-strategy-library.mjs — the Number Talks board's cross-session class
// strategy library (wall reference posters).
//
//   node Tools/number-talks-board/test/smoke-strategy-library.mjs
//
// The Strategy-Sharing Board (`strategies` / #strategyGrid) is per-session:
// it is cleared by clearBoard() and lives only in memory, so its content is
// gone the moment the board is cleared or the tab reloads — the only copies
// are the .txt export and the printed session record. This suite is about a
// different, new thing: a named-strategy LIBRARY that accumulates across the
// whole year in its own localStorage key (`gvb-number-talks:strategyLibrary`,
// distinct from both `gvb-number-talks:settings` and the per-session board),
// survives a reload, and prints one full-page poster per strategy for the
// classroom wall — the "printable as posters" feature from the backlog row.
//
// Exits 1 on any failure. Every student name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8281;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/024-number-talks-board.html';
const LIB_KEY = 'gvb-number-talks:strategyLibrary';

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

console.log('Number Talks — class strategy library (wall posters)');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* ── starts empty, with an honest empty state ───────────────────────────── */
ok((await page.textContent('#libraryList')).includes('No strategies saved'),
   'the library starts empty with an explanatory message');

/* ── adding directly to the library, independent of the session board ──── */
await page.fill('#libraryNameInput', 'Priya');
await page.fill('#libraryContextInput', '36 + 28');
await page.fill('#libraryTextInput', 'Rounded 28 up to 30, added 6 to get 36, then took the extra 2 back off.');
await page.click('#addToLibraryBtn');
await settle(page, 200);

let libListText = await page.textContent('#libraryList');
ok(libListText.includes('Priya'), 'the named entry appears in the on-screen list');
ok(libListText.includes('Rounded 28 up to 30'), 'and the strategy text is shown in full');
ok(libListText.includes('36 + 28'), 'and the "for which problem" context is shown');

eq(await page.$$eval('#libraryList li', e => e.length), 1, 'one library entry so far');

/* the add form clears after adding, ready for the next student */
eq(await page.inputValue('#libraryNameInput'), '', 'the name field clears after adding');
eq(await page.inputValue('#libraryTextInput'), '', 'the text field clears after adding');

/* blank text is not a strategy worth keeping — the button is a no-op */
await page.fill('#libraryNameInput', 'Nobody');
await page.click('#addToLibraryBtn');
await settle(page, 150);
eq(await page.$$eval('#libraryList li', e => e.length), 1, 'a blank strategy is not added to the library');

/* ── it is a genuinely separate store from the per-session board ────────── */
await page.click('#addStrategyBtn');
await settle(page, 150);
await page.fill('.strategy-card:nth-of-type(1) .s-name', 'Devon');
await page.fill('.strategy-card:nth-of-type(1) .s-text', 'Doubled 25 to 50, then halved the other factor.');
await page.dispatchEvent('.strategy-card:nth-of-type(1) .s-text', 'input');
await settle(page, 150);
eq(await page.$$eval('#libraryList li', e => e.length), 1,
   'a fresh card on the session board is NOT itself in the library — only an explicit save puts it there');

/* "+ Save to library" copies a live session card across without retyping it,
   and — since a number string is on the board — captures what it was for. */
await page.fill('#customInput', '25 x 4\n50 x 4');
await page.click('#useCustomBtn');
await settle(page, 250);
await page.click('.strategy-card:nth-of-type(1) [data-save-to-library]');
await settle(page, 200);

eq(await page.$$eval('#libraryList li', e => e.length), 2, 'saving a session card adds a second library entry');
libListText = await page.textContent('#libraryList');
ok(libListText.includes('Devon'), 'the saved card carries its name into the library');
ok(libListText.includes('Doubled 25 to 50'), 'and its text');
ok(libListText.includes('25 x 4'), 'and the number string that was on the board when it was saved, as context');

/* saving to the library does not touch the session board itself */
eq(await page.$$eval('#strategyGrid .strategy-card', e => e.length), 1,
   'the session board still has its card — saving to the library is a copy, not a move');

/* ── persists across a reload (the whole point) ──────────────────────────── */
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
eq(await page.$$eval('#libraryList li', e => e.length), 2, 'the library survives a reload');
ok((await page.textContent('#libraryList')).includes('Priya'), 'with the same names still on it');

/* the per-session board, by contrast, is really gone after a reload */
eq(await page.$$eval('#strategyGrid .strategy-card', e => e.length), 0,
   'the per-session board is empty again after reload — unlike the library');

/* ── clearing the per-session board never touches the library ───────────── */
await page.click('#addStrategyBtn');
await settle(page, 150);
await page.fill('.strategy-card:nth-of-type(1) .s-text', 'Some in-session strategy, never saved to the library.');
await page.dispatchEvent('.strategy-card:nth-of-type(1) .s-text', 'input');
await settle(page, 150);
await page.click('#clearBoardBtn');
await settle(page, 150);
eq(await page.$$eval('#libraryList li', e => e.length), 2,
   'clearing the session board (clearBoard/Undo mechanism) does not touch the accumulated library');

/* ── raw storage: a distinct key, not folded into settings or myBank ────── */
const stored = await page.evaluate(key => localStorage.getItem(key), LIB_KEY);
const parsed = JSON.parse(stored);
ok(Array.isArray(parsed) && parsed.length === 2, 'the library is stored under its own dedicated key');
ok(parsed.every(e => typeof e.id === 'string' && typeof e.ts === 'number'), 'each entry has a stable id and a timestamp');

/** Clicks a Playwright selector (a per-row "Print poster" button, or
    #printLibraryBtn) with window.print() stubbed out, then returns what's in
    #printArea. Uses page.click (Playwright's selector engine, so :has-text
    works) rather than document.querySelector inside page.evaluate. */
async function printSelectorAndRead(sel) {
  await page.evaluate(() => { window.__origPrint = window.print; window.print = () => {}; });
  await page.click(sel);
  await page.evaluate(() => { window.print = window.__origPrint; });
  await settle(page, 200);
  return page.evaluate(() => ({
    html: document.getElementById('printArea').innerHTML,
    text: document.getElementById('printArea').textContent,
  }));
}

/* ── printing one poster, from the row's own "Print poster" button ──────── */
// Entries are newest-first (unshift), so pick Priya's row by name rather than
// by position — Devon was added after Priya and would be first otherwise.
const onePoster = await printSelectorAndRead('#libraryList li:has-text("Priya") [data-print-poster]');
eq(await page.$$eval('#printArea .poster-page', e => e.length), 1, 'printing a single row makes exactly one poster page');
ok(onePoster.text.includes('Priya'), 'the poster names the student');
ok(onePoster.text.includes('Rounded 28 up to 30'), 'and carries the full strategy text');
ok(onePoster.text.includes('36 + 28'), 'and the "for" context, for a teacher who pins several posters up together');
ok(/Strategy Wall/.test(onePoster.text), 'the poster identifies itself as a wall poster, not a report');
ok(!/rec-/.test(onePoster.html), 'poster markup is its own thing, not reusing the session-record rec- classes');

/* ── printing the whole library — one page per entry ─────────────────────── */
const allPosters = await printSelectorAndRead('#printLibraryBtn');
eq(await page.$$eval('#printArea .poster-page', e => e.length), 2, 'printing "all" makes one poster page per library entry');
ok(allPosters.text.includes('Priya') && allPosters.text.includes('Devon'), 'both students appear across the pages');

/* an entry saved with no name still prints something, not a blank card */
await page.fill('#libraryTextInput', 'A strategy jotted down without a name attached.');
await page.click('#addToLibraryBtn');
await settle(page, 200);
eq(await page.$$eval('#libraryList li', e => e.length), 3, 'an unnamed entry is still added');
const unnamedPoster = await printSelectorAndRead('#libraryList li:nth-of-type(1) [data-print-poster]');
ok(/Unnamed strategy/.test(unnamedPoster.text), 'an unnamed entry gets a stable label rather than a blank heading');

/* ── removing a single entry ─────────────────────────────────────────────── */
await page.click('#libraryList li:nth-of-type(1) [data-remove-library]');
await settle(page, 150);
eq(await page.$$eval('#libraryList li', e => e.length), 2, 'removing one entry leaves the other two');

/* ── clearing the whole library is a deliberate, confirmed act ──────────── */
await page.evaluate(() => { window.confirm = () => false; });
await page.click('#clearLibraryBtn');
await settle(page, 150);
eq(await page.$$eval('#libraryList li', e => e.length), 2, 'declining the confirm leaves the library untouched');

await page.evaluate(() => { window.confirm = () => true; });
await page.click('#clearLibraryBtn');
await settle(page, 150);
eq(await page.$$eval('#libraryList li', e => e.length), 0, 'confirming clears the whole library');
ok((await page.textContent('#libraryList')).includes('No strategies saved'), 'back to the empty-state message');

const storedAfterClear = await page.evaluate(key => localStorage.getItem(key), LIB_KEY);
eq(JSON.parse(storedAfterClear).length, 0, 'the cleared library persists as empty, not just in memory');

/* clearing an already-empty library is a silent no-op — no confirm dialog
   should even fire, since there is nothing to lose */
await page.evaluate(() => { window.confirm = () => { window.__confirmCalls = (window.__confirmCalls || 0) + 1; return true; }; });
await page.click('#clearLibraryBtn');
await settle(page, 100);
const confirmCalls = await page.evaluate(() => window.__confirmCalls || 0);
eq(confirmCalls, 0, 'clearing an already-empty library never prompts');

/* ── roster autocomplete is shared with the session board's name field ──── */
await page.evaluate(() => {
  localStorage.setItem('np_rosters', JSON.stringify({ 'Period 3': ['Amara Diallo', 'Ben Ortiz'] }));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
const libraryNameList = await page.getAttribute('#libraryNameInput', 'list');
eq(libraryNameList, 'strategyNameOptions', 'the library name field uses the same shared roster datalist as the session board');
const options = await page.$$eval('#strategyNameOptions option', els => els.map(o => o.value));
ok(options.includes('Amara Diallo') && options.includes('Ben Ortiz'), 'roster names populate the datalist the library input reads from');

/* ── no console noise, nothing left the site ───────────────────────────── */
eq(page.__errs.length, 0, `no page/console errors: ` + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, `nothing left the site: ` + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }

