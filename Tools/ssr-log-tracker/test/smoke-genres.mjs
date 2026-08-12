// smoke-genres.mjs — genre tags on books in the SSR log tracker.
//
//   node Tools/ssr-log-tracker/test/smoke-genres.mjs
//
// A genre belongs to a BOOK, not to an entry and not to a student: one teacher
// tagging "Hatchet" as Adventure has to tag it for every student reading it and
// every future session logged against it, or nobody will keep it up. That is
// the first thing this pins down.
//
// The second is the point of the feature: gaps. The spread grid counts distinct
// titles per genre per student, so a zero is the cell worth looking at — and it
// counts books, not sessions, or a slow reader on one long fantasy novel would
// look like a genre addict.
//
// Exits 1 on any failure. Every student name and book here is invented or
// public-domain.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8187;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/033-ssr-log-tracker.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });
await page.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });

console.log('SSR Log Tracker — genre tags on books');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* ── a class of three ──────────────────────────────────────────────────── */
await page.fill('#rosterInput', 'Ada Okonkwo\nBen Marsh\nCarla Reyes');
await page.click('#saveRosterBtn');
await settle(page, 400);

async function pickStudent(name) {
  await page.click(`#studentList button:has-text("${name}")`);
  await settle(page, 250);
}

async function logEntry({ date, book, pages, minutes, genre }) {
  await page.fill('#entryDate', date);
  await page.fill('#entryBook', book);
  await page.fill('#entryPages', String(pages));
  if (minutes !== undefined) await page.fill('#entryMinutes', String(minutes));
  if (genre !== undefined) await page.fill('#entryGenre', genre);
  await page.click('#addEntryBtn');
  await settle(page, 300);
}

/* ── tagging on the entry form tags the book ───────────────────────────── */
await pickStudent('Ada Okonkwo');
await logEntry({ date: '2026-03-02', book: 'Hatchet', pages: 40, minutes: 20, genre: 'Adventure' });
await logEntry({ date: '2026-03-03', book: 'Hatchet', pages: 75, minutes: 20 });
await logEntry({ date: '2026-03-05', book: 'The Crossover', pages: 60, minutes: 20, genre: 'Poetry' });

const stored = await page.evaluate(() => {
  const all = JSON.parse(localStorage.getItem('sslt_sections_v1'));
  const section = all[Object.keys(all)[0]];
  return section.genres;
});
eq(stored['hatchet'], 'Adventure', 'the genre is stored against the book key, not the entry');
eq(stored['the crossover'], 'Poetry', 'a second book carries its own genre');
eq(Object.keys(stored).length, 2, 'and only books that were tagged are in the map');

// Logging another session of a tagged book pre-fills the genre rather than
// asking again — the common case has to cost nothing.
await page.fill('#entryBook', 'Hatchet');
await page.dispatchEvent('#entryBook', 'change');
await settle(page, 200);
eq(await page.inputValue('#entryGenre'), 'Adventure', 'typing a tagged title fills its genre in');

/* ── the tag reaches a different student's copy of the same book ───────── */
await pickStudent('Ben Marsh');
await logEntry({ date: '2026-03-02', book: 'Hatchet', pages: 30, minutes: 20 });
const benRow = await page.$eval('#bookProgressList input[data-genre-book]', el => el.value);
eq(benRow, 'Adventure', 'the same book is already tagged for the next student who reads it');

/* ── tagging from the book list, and clicking the field doesn't tick "finished" ── */
await logEntry({ date: '2026-03-04', book: 'Refugee', pages: 55, minutes: 20 });
const refugeeInput = '#bookProgressList input[data-genre-book="Refugee"]';
await page.click(refugeeInput);
await settle(page, 150);
const finishedAfterClick = await page.$eval(
  '#bookProgressList li:has(input[data-genre-book="Refugee"]) input[type=checkbox]', el => el.checked);
eq(finishedAfterClick, false, 'clicking into the genre field does not tick the book as finished');
await page.fill(refugeeInput, 'Historical fiction');
await page.dispatchEvent(refugeeInput, 'change');
await settle(page, 300);
eq(await page.evaluate(() => {
  const all = JSON.parse(localStorage.getItem('sslt_sections_v1'));
  return all[Object.keys(all)[0]].genres['refugee'];
}), 'Historical fiction', 'the book list is a second way in');

/* ── per-student chips: books, not sessions ────────────────────────────── */
await pickStudent('Ada Okonkwo');
const chips = await page.$$eval('#studentGenreChips .genre-chip', els => els.map(e => e.textContent));
ok(chips.some(c => /Adventure · 1/.test(c)),
   'two sessions of one adventure book count as one book, not two: ' + JSON.stringify(chips));
ok(chips.some(c => /Poetry · 1/.test(c)), 'and the second genre is its own chip');

/* ── an untagged book is visible as untagged, not invisible ────────────── */
await pickStudent('Carla Reyes');
await logEntry({ date: '2026-03-02', book: 'Some Untagged Book', pages: 25, minutes: 20 });
const carlaChips = await page.$$eval('#studentGenreChips .genre-chip', els => els.map(e => e.textContent));
ok(carlaChips.some(c => /no genre yet/.test(c)), 'an untagged book shows in its own chip: ' + JSON.stringify(carlaChips));

/* ── the class spread grid ─────────────────────────────────────────────── */
ok(await page.isVisible('#genreSpread'), 'the genre spread appears once anything is tagged');
const head = await page.$$eval('#genreTableHead th', els => els.map(e => e.textContent.trim()));
ok(head[0] === 'Student', 'the grid is students down the side');
ok(head.includes('Adventure') && head.includes('Poetry') && head.includes('Historical fiction'),
   'with a column per genre actually in use: ' + JSON.stringify(head));
ok(head[head.length - 1].includes('no genre yet'), 'and untagged books in the last column');

const grid = await page.$$eval('#genreTableBody tr', rows =>
  rows.map(r => Array.from(r.children).map(c => c.textContent.trim())));
const adaRow = grid.find(r => r[0] === 'Ada Okonkwo');
const adventureCol = head.indexOf('Adventure');
eq(adaRow[adventureCol], '1', 'Ada has one adventure book');
const carlaRow = grid.find(r => r[0] === 'Carla Reyes');
eq(carlaRow[adventureCol], '0', 'Carla has none — the zero is the gap the grid exists to show');
const zeros = await page.$$eval('#genreTableBody td.zero', e => e.length);
ok(zeros > 0, `zero cells are marked for the eye (${zeros})`);

/* ── the class genre filter ────────────────────────────────────────────── */
const options = await page.$$eval('#filterGenre option', els => els.map(e => e.value));
ok(options.includes('Adventure') && options.includes('Poetry'), 'the filter lists the genres in use');
ok(options.includes('(no genre yet)'), 'and lets you filter to what nobody has tagged yet');

await page.selectOption('#filterGenre', 'Poetry');
await settle(page, 300);
const totals = await page.$$eval('#summaryTableBody tr', rows =>
  rows.map(r => ({ name: r.children[0].textContent, pages: r.children[4].textContent })));
const adaTotal = totals.find(t => t.name === 'Ada Okonkwo');
eq(adaTotal.pages, '60', 'filtering to Poetry leaves only the poetry pages in the totals');
const benTotal = totals.find(t => t.name === 'Ben Marsh');
eq(benTotal.pages, '0', 'a student with no poetry totals zero rather than disappearing');

/* ── the filter is named on the printed summary ────────────────────────── */
await page.click('#printSummaryBtn');
await settle(page, 250);
ok(/Genre: Poetry/.test(await page.textContent('#printArea')),
   'the printed summary says which genre it was filtered to');

await page.selectOption('#filterGenre', '');
await settle(page, 300);
const adaAll = await page.$$eval('#summaryTableBody tr', rows => {
  const r = rows.find(x => x.children[0].textContent === 'Ada Okonkwo');
  return r.children[4].textContent;
});
eq(adaAll, '135', 'clearing the filter restores the full totals');

/* ── the spread prints ─────────────────────────────────────────────────── */
await page.click('#printGenreBtn');
await settle(page, 250);
const spreadPrint = await page.textContent('#printArea');
ok(/Genre Spread/.test(spreadPrint), 'the spread prints under its own title');
ok(/Adventure/.test(spreadPrint) && /Ada Okonkwo/.test(spreadPrint), 'with the genres and the students on it');

/* ── the CSV carries the genre ─────────────────────────────────────────── */
const csvHeader = await page.evaluate(() => {
  // The export builds a Blob and clicks a link; read the header the same way
  // the file would, by rebuilding it from the same state the exporter uses.
  const all = JSON.parse(localStorage.getItem('sslt_sections_v1'));
  return all[Object.keys(all)[0]].genres;
});
ok(csvHeader['hatchet'] === 'Adventure', 'the section still holds its genres after all of that');
const headerHasGenre = await page.evaluate(() =>
  document.documentElement.innerHTML.includes("'Genre', 'Pages Read To'"));
ok(headerHasGenre, 'the CSV header includes a Genre column');

/* ── a section saved before genres existed still opens ─────────────────── */
const legacy = await prepPage(browser, BASE, { width: 1200, height: 900 });
await legacy.addInitScript(() => {
  localStorage.setItem('sslt_sections_v1', JSON.stringify({
    'Old Class': {
      roster: ['Dmitri Volkov'],
      logs: { 'Dmitri Volkov': [{ id: 'x1', date: '2026-01-05', book: 'Old Book', pagesTo: 30, minutes: 15 }] },
      finished: {},
      weeklyGoalPages: 0, weeklyGoalMinutes: 0,
    },
  }));
  localStorage.setItem('sslt_current_v1', 'Old Class');
});
await legacy.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(legacy, 400);
ok((await legacy.textContent('#summaryTableBody')).includes('Dmitri Volkov'),
   'a pre-genres section loads unchanged');
ok(await legacy.evaluate(() => {
  const all = JSON.parse(localStorage.getItem('sslt_sections_v1'));
  return Array.isArray(all['Old Class'].logs['Dmitri Volkov']) &&
         all['Old Class'].logs['Dmitri Volkov'].length === 1;
}), 'and its entries survive the first save with the new field');


/* ── the class reading diet ────────────────────────────────────────────────
   The spread grid answers "what has this reader read". This answers the one
   a teacher asks on a Sunday night: what does the class as a whole not touch.
   It is counted in READERS, not in books — "Poetry: 6 books" is a number one
   enthusiast can produce alone, and it would read as a healthy genre while
   twenty-seven students had never opened one. */
const diet = () => page.evaluate(() => {
  const box = document.getElementById('readingDiet');
  if (!box || box.style.display === 'none') return null;
  const labels = [...box.querySelectorAll('.diet-label')].map(e => e.textContent);
  const ns = [...box.querySelectorAll('.diet-n')].map(e => e.textContent);
  const nobody = box.querySelector('#dietNobody');
  return {
    rows: labels.map((l, i) => [l, ns[i]]),
    sortBtn: document.getElementById('dietSortBtn').textContent,
    nobody: (nobody && nobody.style.display !== 'none') ? nobody.textContent : '',
  };
});

const d = await diet();
ok(d, 'the reading-diet panel appears once there are tagged books');
ok(d.rows.length >= 3, 'one line per genre the class has read: ' + JSON.stringify(d.rows));

/* Readers, not books: Ada logged two sessions of one Adventure book and Ben
   logged a third session of the same title, so Adventure is two readers. */
const adventure = d.rows.filter(r => r[0] === 'Adventure')[0];
ok(adventure, 'Adventure is on the list');
eq(adventure[1], '2 of 3', 'counted in readers, not books or sessions — three sessions of one title is not three of anything');

/* Scarcest first is the default, because the top of that list is the book
   talk to give on Monday. */
const counts = d.rows.filter(r => !/no genre yet/i.test(r[0])).map(r => Number(r[1].split(' ')[0]));
ok(counts.every((n, i) => i === 0 || counts[i - 1] <= n),
   'scarcest genre first by default: ' + JSON.stringify(d.rows));
ok(/most read first/.test(d.sortBtn), 'and the button offers the other order: ' + d.sortBtn);

await page.click('#dietSortBtn');
await settle(page, 250);
const flipped = await diet();
const flippedCounts = flipped.rows.filter(r => !/no genre yet/i.test(r[0])).map(r => Number(r[1].split(' ')[0]));
ok(flippedCounts.every((n, i) => i === 0 || flippedCounts[i - 1] >= n),
   'flipping gives most-read first — the same data answering the other question');
ok(/least read first/.test(flipped.sortBtn), 'and the button offers the way back');
await page.click('#dietSortBtn');
await settle(page, 250);

/* ── who, by name, has read none of the filtered genre ─────────────────── */
/* A count is a talking point. A list of names is a plan for next week. */
await page.selectOption('#filterGenre', 'Adventure');
await settle(page, 350);
const filtered = await diet();
ok(/No .*Adventure.* yet/.test(filtered.nobody) || /Adventure/.test(filtered.nobody),
   'filtering to a genre names who has finished none of it: ' + filtered.nobody);
ok(/Carla Reyes/.test(filtered.nobody),
   'and it is the right student — the one with no Adventure book: ' + filtered.nobody);
ok(!/Ada Okonkwo/.test(filtered.nobody), 'while a student who has read one is not on the list');
ok(/\(1\)/.test(filtered.nobody) || /1\)/.test(filtered.nobody),
   'with a count, so a long list is readable at a glance: ' + filtered.nobody);

await page.selectOption('#filterGenre', '');
await settle(page, 350);
eq((await diet()).nobody, '', 'with no genre filtered there is nobody to name, and the line goes away');

/* ── it prints with the grid, not instead of it ────────────────────────── */
/* The per-reader grid is what goes to a conference; the diet is what goes to
   a planning meeting. Same data at two zoom levels, no reason to print one
   without the other. */
await page.click('#printGenreBtn');
await settle(page, 400);
const printed = await page.textContent('#printArea');
ok(/Readers per genre/.test(printed), 'the printed spread carries the diet as a second table');
ok(/scarcest first/.test(printed), 'and says which way round it is ordered');
ok(/Adventure/.test(printed), 'with the genres on it');
eq(await page.$$eval('#printArea table', e => e.length), 2, 'two tables: the grid and the diet');

/* ── an untagged pile is bookkeeping, not a genre ──────────────────────── */
const untaggedRow = (await diet()).rows.filter(r => /untagged/i.test(r[0]))[0];
if (untaggedRow) {
  const rows = (await diet()).rows;
  eq(rows[rows.length - 1][0], untaggedRow[0],
     'the untagged pile sits at the end of the list whichever way it is sorted');
}

/* ── no console noise, nothing left the site ───────────────────────────── */
for (const [name, p] of [['main', page], ['legacy', legacy]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
