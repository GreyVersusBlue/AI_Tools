// smoke-import.mjs — 049's book-list import and genre-balance check (btmg-import.js and the page).
//
//   node Tools/book-tasting-menu-generator/test/smoke-import.mjs
//
// A cart of books comes in as a spreadsheet (.xlsx through the vendored SheetJS, read only when a
// file is chosen), a CSV, or pasted cells; the page shows what it will add and adds nothing until
// told to. A lopsided list gets a plain warning. What this holds down:
//
//   The mapper: columns by heading in any order, or positionally; rows with no title named; limits.
//   The merge: a repeat of a book already here, or earlier in the file, is left out; a genre in
//   another case takes the spelling in use (so the menu has one Mystery course, not two).
//   The check: silent below six books, quiet at exactly half, loud above it, and for one genre,
//   for unlabelled books and for a menu of one-book genres.
//   The page: a real .xlsx made by the test, a quoted CSV, a paste, a broken file, a repeat import,
//   the warning in the Books card, 360 px, and no request leaving the site. Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import '../btmg-import.js';

const B = globalThis.BookImport;
const PORT = 8636;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/049-book-tasting-menu-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (c, l) => { if (c) { passed++; return true; } failed++; fails.push(l); console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(a === b, `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const j = JSON.stringify;

console.log('Book Tasting Menu Generator — import and genre balance');

/* ── pure: mapRows ─────────────────────────────────────────────────────── */
let m = B.mapRows([['Title', 'Author', 'Genre', 'Blurb'], ['Holes', 'Louis Sachar', 'Adventure', 'A boy digs.']]);
ok(m.header && m.books.length === 1 && m.books[0].title === 'Holes' && m.books[0].genre === 'Adventure', 'a heading row is read by name');
m = B.mapRows([['Summary', 'Book Title', 'Writer'], ['A boy digs.', 'Holes', 'Louis Sachar']]);
eq(j([m.books[0].title, m.books[0].author, m.books[0].blurb, m.books[0].genre]), j(['Holes', 'Louis Sachar', 'A boy digs.', '']), 'columns in any order, other names for them, a missing column blank');
m = B.mapRows([['Holes', 'Louis Sachar', 'Adventure', 'A boy digs.'], ['Wonder', 'R. J. Palacio', 'Realistic', 'A boy goes to school.']]);
ok(!m.header && m.books.length === 2 && m.books[1].genre === 'Realistic', 'no heading: title, author, genre, blurb in order');
eq(m.books[0].line, 1, 'and the first row is row 1');
m = B.mapRows([['Title', 'Notes'], ['Holes', 'x']]);
ok(m.header, 'a heading row needs only two known names');
m = B.mapRows([['Holes', 'Louis Sachar'], ['Wonder', 'R. J. Palacio']]);
ok(!m.header && m.books.length === 2, 'two plain rows are books, not a heading');
m = B.mapRows([['Book', 'Some Author'], ['Dune', 'Frank Herbert']]);
ok(!m.header && m.books.length === 2, 'one word that is also a heading is not enough: a book may be called “Book”');
m = B.mapRows([['Title', 'Author'], ['', 'Nobody'], ['', '', '', ''], ['Real', 'Someone']], [1, 2, 3, 4]);
eq(j(m.skipped), j([{ line: 2, reason: 'no title' }]), 'a row with no title is named by its line; an empty row is not a problem');
eq(m.books.length, 1, 'the good row is kept');
m = B.mapRows([['  Holes \n ', ' A  B '], ['x'.repeat(500), 'y']]);
eq(m.books[0].title + '|' + m.books[0].author, 'Holes|A B', 'cells are trimmed and spaces collapsed');
eq(m.books[1].title.length, B.LIMITS.title, 'a long title is cut at the limit');
m = B.mapRows(new Array(B.MAX_ROWS + 20).fill(['t', 'a']).map((r, i) => [r[0] + i, r[1]]));
eq(m.books.length, B.MAX_ROWS, 'a long list is capped');
eq(m.over, 20, 'and says how many were left out');
eq(B.mapRows(null).books.length, 0, 'nothing in, nothing out');

/* ── pure: merge ───────────────────────────────────────────────────────── */
const have = [{ title: 'Holes', author: 'Louis Sachar', genre: 'Adventure' }];
let g = B.merge(have, [{ title: 'HOLES', author: 'louis sachar', genre: '' }, { title: 'Holes', author: 'Someone Else', genre: 'adventure' }, { title: 'New', author: 'N', genre: 'Mystery' }, { title: 'New', author: 'N', genre: 'x' }]);
eq(g.duplicates.length, 2, 'a repeat of a book here, and a repeat within the file, are left out');
eq(g.add.map(b => b.title).join(), 'Holes,New', 'a different author is a different book');
eq(g.add[0].genre, 'Adventure', 'a genre in another case takes the spelling already used');
eq(g.genreCase, 1, 'and is counted');
g = B.merge([], [{ title: 'A', author: '', genre: 'mystery' }, { title: 'B', author: '', genre: 'Mystery' }]);
eq(g.add.map(b => b.genre).join(), 'mystery,mystery', 'within a file the first spelling wins');

/* ── pure: genreBalance ────────────────────────────────────────────────── */
const mk = (spec) => Object.entries(spec).flatMap(([genre, n]) => new Array(n).fill(0).map(() => ({ genre: genre === '_' ? '' : genre })));
eq(B.genreBalance(mk({ Mystery: 5 })).warnings.length, 0, 'five books: nothing to say');
eq(B.genreBalance(mk({ A: 3, B: 3 })).warnings.length, 0, 'exactly half is not dominant');
let w = B.genreBalance(mk({ Mystery: 7, Fantasy: 2, Poetry: 1 })).warnings;
ok(w.length === 1 && /Mystery is 7 of the 10 books \(70%\)/.test(w[0]), 'a dominant genre is named with its share: ' + w[0]);
w = B.genreBalance(mk({ Mystery: 8 })).warnings;
ok(w.length === 1 && /All 8 books are Mystery/.test(w[0]), 'one genre says so');
w = B.genreBalance(mk({ A: 2, B: 2, _: 4 })).warnings;
ok(w.length === 1 && /4 of the 8 books have no genre/.test(w[0]), 'unlabelled books are counted');
w = B.genreBalance(mk({ A: 1, B: 1, C: 1, D: 1, E: 1, F: 2 })).warnings;
ok(w.length === 1 && /5 genres have just one book each/.test(w[0]), 'a menu of one-book courses is flagged');
eq(B.genreBalance([{ genre: 'Sci-Fi' }, { genre: 'sci-fi' }, { genre: 'X' }, { genre: 'Y' }, { genre: 'Z' }, { genre: 'Z' }]).counts[0].n, 2, 'counts ignore case');
eq(B.genreBalance(null).total, 0, 'no list, no counts');

/* ── page ──────────────────────────────────────────────────────────────── */
const server = await serve(PORT);
const browser = await launch();
async function open(books, size = { width: 1200, height: 1000 }) {
  const page = await prepPage(browser, BASE, size);
  await page.addInitScript(b => {
    window.print = () => {};
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    if (b) localStorage.setItem('btmg_books_v1', b);
  }, books ? JSON.stringify(books) : null);
  await page.goto(URL_PAGE, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('btmg_books_v1') || '[]'));

// A real .xlsx, made in a scratch page with the vendored SheetJS.
const maker = await prepPage(browser, BASE, { width: 400, height: 400 });
await maker.goto(BASE + '/index.html', { waitUntil: 'load' });
await maker.addScriptTag({ url: BASE + '/_shared/vendor/xlsx/xlsx.full.min.js' });
const xlsx = Buffer.from(await maker.evaluate(() => {
  const rows = [['Book', 'Writer', 'Category', 'Description'],
    ['Holes', 'Louis Sachar', 'Adventure', 'A boy digs holes at a camp.'],
    ['Wonder', 'R. J. Palacio', 'Realistic Fiction', 'A boy with a different face starts school.'],
    ['Hatchet', 'Gary Paulsen', 'adventure', 'Alone in the woods.'],
    ['', 'No Title', 'Poetry', 'a row with nothing to call it']];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Cart');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Other', 'Sheet']]), 'Second');
  return Array.from(new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })));
}));
await maker.close();

let page = await open();
eq(await page.evaluate(() => typeof window.XLSX), 'undefined', 'the spreadsheet reader is not loaded with the page');
await page.setInputFiles('#importFile', { name: 'cart.xlsx', mimeType: 'application/octet-stream', buffer: xlsx });
await page.waitForSelector('#importAddBtn:not([hidden])', { timeout: 15000 });
eq(await page.evaluate(() => typeof window.XLSX), 'object', 'it is loaded when an .xlsx is chosen');
let summary = await page.textContent('#importSummary');
ok(/3 books from cart\.xlsx will be added to the 0 already here/.test(summary), 'the preview counts the books: ' + summary);
let notes = await page.textContent('#importNotes');
ok(/found by their headings/.test(notes), 'it says the columns were read by heading');
ok(/1 row skipped for having no title \(row 5\)/.test(notes), 'it names the row with no title: ' + notes);
ok(/different case/.test(notes), 'it says a genre took another spelling');
ok(/Only the first sheet \(Cart\)/.test(notes), 'it says only the first sheet was read');
eq((await stored(page)).length, 0, 'nothing is stored before Add');
await page.click('#importAddBtn');
await settle(page, 200);
let books = await stored(page);
eq(books.map(b => b.title).join(), 'Holes,Wonder,Hatchet', 'the books are added in order');
eq(books.map(b => b.genre).join(), 'Adventure,Realistic Fiction,Adventure', '"adventure" took the spelling already in the file');
eq(books[0].author + '|' + books[0].blurb, 'Louis Sachar|A boy digs holes at a camp.', 'author and blurb came across');
eq(await page.$$eval('#booksWrap .book-row', e => e.length), 3, 'the Books card lists them');
ok(/Added 3 books/.test(await page.textContent('#importSummary')), 'and says so');
ok(await page.isHidden('#importAddBtn'), 'the Add button goes away');

// Printing groups the menu by the shared spelling.
await page.click('#printBtn');
await settle(page, 100);
eq(await page.$$eval('#printArea .menu-course-heading', e => e.map(h => h.textContent).join()), 'Adventure,Realistic Fiction', 'the menu has one Adventure course');

// The same file again: all repeats.
await page.setInputFiles('#importFile', { name: 'cart.xlsx', mimeType: 'application/octet-stream', buffer: xlsx });
await page.waitForFunction(() => /already in the list/.test(document.getElementById('importSummary').textContent), null, { timeout: 5000 }).catch(async () => { console.log('SUMMARY:', await page.textContent('#importSummary'), '/', await page.textContent('#importNotes')); });
ok(await page.isHidden('#importAddBtn'), 'a repeat import has nothing to add');
eq((await stored(page)).length, 3, 'and adds nothing');

// A CSV with quotes and a comma in a blurb; no heading; a lopsided list.
const rowsCsv = [];
for (let i = 1; i <= 7; i++) rowsCsv.push(`Mystery ${i},Author ${i},Mystery,"A case, a clue, and a twist ${i}"`);
rowsCsv.push('Poem Book,A. Poet,Poetry,Short ones');
rowsCsv.push('Space Book,B. Writer,Fantasy,Dragons in space');
await page.click('#importCancelBtn').catch(() => {});
await page.setInputFiles('#importFile', { name: 'more.csv', mimeType: 'text/csv', buffer: Buffer.from(rowsCsv.join('\r\n')) });
await page.waitForSelector('#importAddBtn:not([hidden])');
notes = await page.textContent('#importNotes');
ok(/No heading row/.test(notes), 'no heading row is said');
ok(/Once added: Mystery is 7 of the 12 books/.test(notes), 'the preview warns about the list as it will be: ' + notes);
await page.click('#importAddBtn');
await settle(page, 200);
books = await stored(page);
eq(books.length, 12, 'twelve books');
eq(books[3].blurb, 'A case, a clue, and a twist 1', 'a quoted comma stays in the blurb');
const warn = await page.textContent('#genreBalance');
ok(await page.isVisible('#genreBalance') && /Mystery is 7 of the 12 books \(58%\)/.test(warn), 'the Books card shows the warning: ' + warn);

// Pasted cells; the preview is cancelled; a broken file.
await page.fill('#importText', 'Title\tAuthor\nOne Book\tA\nTwo Book\tB');
await page.click('#importPasteBtn');
ok(/2 books from the pasted list/.test(await page.textContent('#importSummary')), 'pasted cells preview');
await page.click('#importCancelBtn');
ok(await page.isHidden('#importPreview'), 'Cancel closes the preview');
eq((await stored(page)).length, 12, 'and adds nothing');
await page.setInputFiles('#importFile', { name: 'broken.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('this is not a workbook') });
await page.waitForFunction(() => /Could not read broken\.xlsx|No books found/.test(document.getElementById('importSummary').textContent), null, { timeout: 15000 });
ok(await page.isHidden('#importAddBtn'), 'a broken workbook adds nothing: ' + await page.textContent('#importSummary'));
await page.setInputFiles('#importFile', { name: 'empty.csv', mimeType: 'text/csv', buffer: Buffer.from('') });
await page.waitForFunction(() => /No books found in empty\.csv/.test(document.getElementById('importSummary').textContent), null, { timeout: 15000 });
ok(true, 'an empty file is said to have no books');

// 360 px.
await page.setViewportSize({ width: 360, height: 800 });
await page.fill('#importText', 'A\tB\tC\tD');
await page.click('#importPasteBtn');
await settle(page, 200);
eq(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1), true, 'the import card fits at 360 px');
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
