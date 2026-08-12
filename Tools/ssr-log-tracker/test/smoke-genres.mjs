// smoke-genres.mjs — genre tags on books in the silent reading log.
//
//   node Tools/ssr-log-tracker/test/smoke-genres.mjs
//
// The tracker could tell you a student had read 340 pages. It could not tell
// you they were 340 pages of the same graphic novel series, which is the
// conversation a reading teacher actually needs to have.
//
// The design decision under test is that a genre belongs to a BOOK, not to a
// log entry. The same title read by four students is the same genre four
// times, so tagging it once has to be enough — otherwise the class ends up
// with four spellings of "historical fiction" and the whole feature is noise.
// That leads to the second thing pinned here: logging tonight's pages with the
// genre field left blank must never erase a tag somebody set last week.
//
// Exits 1 on any failure. Every name and title here is invented or public.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8199;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/033-ssr-log-tracker.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const ROSTER = ['Ada Lovelace', 'Marco Polo', 'Nellie Bly'];

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1500, height: 1200 });

const pickStudent = async (p, name) => {
  await p.evaluate(n => {
    const btn = [...document.querySelectorAll('.student-item')].find(b => b.textContent.indexOf(n) === 0);
    if (btn) btn.click();
  }, name);
  await settle(p, 250);
};

const logEntry = async (p, { book, genre, pages, date }) => {
  await p.fill('#entryDate', date || '2026-05-04');
  await p.fill('#entryBook', book);
  if (genre !== undefined) await p.fill('#entryGenre', genre);
  await p.fill('#entryPages', String(pages));
  await p.click('#addEntryBtn');
  await settle(p, 350);
};

const summaryRow = (p, name) => p.evaluate(n => {
  const tr = [...document.querySelectorAll('#summaryTableBody tr')].find(r => r.cells[0].textContent === n);
  if (!tr) return null;
  return {
    book: tr.cells[1].textContent,
    genres: [...tr.cells[2].querySelectorAll('.genre-chip')].map(c => c.textContent),
    untagged: !!tr.cells[2].querySelector('.genre-chip.none'),
    pages: tr.cells[5].textContent,
  };
}, name);

console.log('Silent Reading Log Tracker — genre tags on books');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 500);
await page.fill('#rosterInput', ROSTER.join('\n'));
await page.click('#saveRosterBtn');
await settle(page, 400);

/* ── 1. a genre is tagged once and belongs to the book ─────────────────── */
await pickStudent(page, 'Ada Lovelace');
await logEntry(page, { book: 'Hatchet', genre: 'Adventure', pages: 40 });
let row = await summaryRow(page, 'Ada Lovelace');
eq(JSON.stringify(row.genres), JSON.stringify(['Adventure']), 'the genre shows on the student who logged it');

// A different student picking up the same title inherits it without typing.
await pickStudent(page, 'Marco Polo');
await page.fill('#entryBook', 'Hatchet');
await page.dispatchEvent('#entryBook', 'input');
await settle(page, 250);
eq(await page.inputValue('#entryGenre'), 'Adventure',
   'a second student typing the same title gets the genre filled in for them');
await page.fill('#entryPages', '25');
await page.click('#addEntryBtn');
await settle(page, 350);
row = await summaryRow(page, 'Marco Polo');
eq(JSON.stringify(row.genres), JSON.stringify(['Adventure']), 'and it lands on their row too');

const genreKeys = await page.evaluate(() => {
  const all = JSON.parse(localStorage.getItem('sslt_sections_v1'));
  return all[Object.keys(all)[0]].genres;
});
eq(JSON.stringify(genreKeys), JSON.stringify({ hatchet: 'Adventure' }),
   'stored once, keyed by book — not once per entry: ' + JSON.stringify(genreKeys));

/* ── 2. a blank genre field never erases an existing tag ───────────────── */
await logEntry(page, { book: 'Hatchet', genre: '', pages: 60, date: '2026-05-05' });
eq(await page.evaluate(() => {
  const all = JSON.parse(localStorage.getItem('sslt_sections_v1'));
  return all[Object.keys(all)[0]].genres.hatchet;
}), 'Adventure', 'logging more pages with the genre box empty leaves the tag alone');

/* ── 3. the Books list is where a genre can be changed or cleared ──────── */
await page.evaluate(() => {
  const input = document.querySelector('#bookProgressList input.book-genre-input');
  input.value = 'Survival';
  input.dispatchEvent(new Event('change', { bubbles: true }));
});
await settle(page, 350);
eq(await page.evaluate(() => {
  const all = JSON.parse(localStorage.getItem('sslt_sections_v1'));
  return all[Object.keys(all)[0]].genres.hatchet;
}), 'Survival', 'editing it in the Books list retags the book for everybody');
row = await summaryRow(page, 'Ada Lovelace');
eq(JSON.stringify(row.genres), JSON.stringify(['Survival']), 'including the student who first tagged it');

/* ── 4. a student with books but no genre is called out, not left blank ── */
await pickStudent(page, 'Nellie Bly');
await logEntry(page, { book: 'Wonder', genre: '', pages: 30 });
row = await summaryRow(page, 'Nellie Bly');
eq(row.untagged, true, 'a student reading an untagged book reads as "untagged", not as nothing');
const noBooks = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('#summaryTableBody tr')].find(r => r.cells[0].textContent === 'Marco Polo');
  return tr.cells[2].textContent;
});
ok(noBooks.length > 0, 'and a student with tagged books shows chips instead');

/* ── 5. the reading diet panel ranks scarcity first ────────────────────── */
await pickStudent(page, 'Nellie Bly');
await page.evaluate(() => {
  const input = [...document.querySelectorAll('#bookProgressList input.book-genre-input')].pop();
  input.value = 'Realistic fiction';
  input.dispatchEvent(new Event('change', { bubbles: true }));
});
await settle(page, 400);

const diet = await page.evaluate(() => ({
  shown: document.getElementById('dietPanel').style.display !== 'none',
  rows: [...document.querySelectorAll('#dietList li')].map(li => ({
    name: li.querySelector('.d-name').textContent,
    count: li.querySelector('.d-count').textContent.replace(/\s+/g, ' '),
  })),
}));
eq(diet.shown, true, 'the reading diet panel appears once anything is tagged');
eq(diet.rows.length, 2, 'one line per genre in use');
eq(diet.rows[0].name, 'Realistic fiction', 'the least-read genre is first — that is the one to book-talk');
ok(/1 of 3 students/.test(diet.rows[0].count), 'with the reader count: ' + diet.rows[0].count);
ok(/2 of 3 students/.test(diet.rows[1].count), 'and the better-read one below it: ' + diet.rows[1].count);

/* ── 6. the genre filter narrows the totals and names the gap ──────────── */
const before = await summaryRow(page, 'Ada Lovelace');
await page.selectOption('#filterGenre', 'Realistic fiction');
await settle(page, 400);
const after = await summaryRow(page, 'Ada Lovelace');
eq(after.pages, '0', 'filtering to a genre Ada has not read zeroes her totals');
ok(before.pages !== after.pages, `whereas unfiltered she had pages (${before.pages})`);
const gap = await page.textContent('#dietGap');
ok(/Ada Lovelace/.test(gap) && /Marco Polo/.test(gap), 'and the gap line names who has read none of it: ' + gap);
ok(!/Nellie Bly/.test(gap), 'leaving out the student who has');

await page.selectOption('#filterGenre', '__untagged__');
await settle(page, 400);
eq((await summaryRow(page, 'Nellie Bly')).pages, '0',
   'the untagged filter finds nothing once every book has a genre');
eq(await page.evaluate(() => document.getElementById('dietGap').style.display), 'none',
   'and the gap line is not shown for it — "untagged" is not a reading gap');

await page.click('#clearFilterBtn');
await settle(page, 400);
eq(await page.inputValue('#filterGenre'), '', 'Clear filter clears the genre too');
eq((await summaryRow(page, 'Ada Lovelace')).pages, before.pages, 'and the totals come back');

/* ── 7. genres travel with the exports ─────────────────────────────────── */
const csv = await page.evaluate(() => {
  // Capture the blob but hand back a real object URL: a stub string makes
  // the download anchor try to navigate to it and logs a console error.
  let captured = null;
  const realCreate = URL.createObjectURL;
  URL.createObjectURL = (blob) => { captured = blob; return realCreate.call(URL, blob); };
  document.getElementById('exportCsvBtn').click();
  URL.createObjectURL = realCreate;
  return captured ? captured.text() : null;
});
ok(csv && /Genre/.test(csv.split('\r\n')[0]), 'the CSV has a Genre column: ' + (csv || '').split('\r\n')[0]);
ok(/Survival/.test(csv), 'and the tag is in the rows');

await page.evaluate(() => { window.print = () => {}; });
await page.click('#printSummaryBtn');
await settle(page, 300);
const printed = await page.evaluate(() => document.getElementById('printArea').textContent);
ok(/Genres read/.test(printed), 'the printed class summary gains a Genres read column');
ok(/Survival/.test(printed), 'with the genres in it');

/* ── 8. a class saved before genres existed still opens ────────────────── */
const legacy = await prepPage(browser, BASE, { width: 1300, height: 900 });
await legacy.goto(URL_PAGE, { waitUntil: 'networkidle' });
await legacy.evaluate(() => {
  localStorage.setItem('sslt_sections_v1', JSON.stringify({
    'Old Class': {
      roster: ['Grace Hopper'],
      logs: { 'Grace Hopper': [{ id: 'a1', date: '2026-04-01', book: 'Holes', pagesTo: 50, minutes: 20 }] },
      finished: {},
    },
  }));
  localStorage.setItem('sslt_current_v1', 'Old Class');
});
await legacy.reload({ waitUntil: 'networkidle' });
await settle(legacy, 600);
eq(await legacy.inputValue('#sectionName'), 'Old Class', 'a class saved before this round loads');
const legacyRow = await summaryRow(legacy, 'Grace Hopper');
eq(legacyRow.untagged, true, 'its books read as untagged rather than breaking the row');
eq(legacyRow.pages, '50', 'and its totals are unaffected');
eq(await legacy.evaluate(() => document.getElementById('dietPanel').style.display), 'none',
   'the diet panel stays hidden until something is actually tagged');

/* ── 9. no console noise ───────────────────────────────────────────────── */
for (const [name, p] of [['main', page], ['legacy', legacy]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
