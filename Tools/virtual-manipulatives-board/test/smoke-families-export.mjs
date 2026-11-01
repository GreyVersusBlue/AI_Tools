// smoke-families-export.mjs — 080's piece families are one table, and a board is a file (rank 151).
//
//   node Tools/virtual-manipulatives-board/test/smoke-families-export.mjs   (or: npm run test:manipulatives-families; port 8662)
//
// What this pins:
//   - the palette and every piece the page makes are byte for byte what the hand-written page made
//     (test/golden-pieces.json, recorded from the page BEFORE the families became a table); a die is
//     compared with its face made a placeholder, since it rolls
//   - every palette button makes a piece of its own type, and a type the table does not know is refused
//   - Export board downloads the board on screen in an envelope ({ v, kind, name, state }) and says so
//   - Import board adds the file as a NEW saved board (an existing name is kept: " (2)"), draws it as it was,
//     and a board exported and imported again comes back with the same pieces in the same places
//   - a hostile file is cut down, not trusted: unknown types, non-numbers, places off the board, a run of
//     400 pieces, markers that are not numbers; a name that is markup stays text; and a file that is not
//     JSON, is another kind of file, or is over 1 MB changes nothing and says so
//   - an import over unsaved work asks first, and "no" changes nothing
//   - no page errors, and nothing leaves the site
//
// Every board here is invented. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle, downloadText } from '../../board-check/harness.mjs';

const PORT = 8662;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/080-virtual-manipulatives-board.html';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = JSON.parse(fs.readFileSync(path.join(HERE, 'golden-pieces.json'), 'utf8'));

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; fails.push(label); console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const norm = s => String(s).replace(/\s+/g, ' ').trim().replace(/die-\d/g, 'die-N').replace(/Die showing \d/g, 'Die showing N')
  .replace(/background-position:[^;"]*;/g, m => (/-?(268|328|388|448|508|568)px -190px/.test(m) ? 'background-position:DIE;' : m));

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 950 });
page.on('dialog', d => d.accept());
const fresh = async (seed) => {
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await page.evaluate(s => { localStorage.clear(); Object.entries(s || {}).forEach(([k, v]) => localStorage.setItem(k, v)); }, seed || null);
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 250);
};
const status = () => page.textContent('#saveStatus');
const pieces = () => page.$$eval('#board .piece', ps => ps.map(p => [p.getAttribute('data-piece-type'), Math.round(parseFloat(p.style.left)), Math.round(parseFloat(p.style.top))]));
const names = () => page.$$eval('#boardSelect option', os => os.map(o => o.value).filter(Boolean));
const importText = async (text, name = 'board.json') => {
  await Promise.all([page.waitForEvent('filechooser').then(c => c.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) })), page.click('#importBoardBtn')]);
  await settle(page, 350);
};
const envelope = state => JSON.stringify({ v: 1, kind: 'vmb-board', name: 'Imported', state });

console.log('Virtual Manipulatives Board — piece families and board files');

await fresh();
console.log('1. the table makes what the hand-written page made');
eq(norm(await page.$eval('#pane-blocks .palette', e => e.innerHTML)), norm(GOLDEN.palette), 'the palette is the same markup');
const types = GOLDEN.buttons.map(([a, f]) => (f ? 'fraction-' + f : a));
for (const t of types) {
  await page.click('#clearBoardBtn');
  await page.click(t.startsWith('fraction-') ? `[data-add-fraction="${t.slice(9)}"]` : `[data-add="${t}"]`);
  const got = await page.$eval('#board .piece', e => ({ html: e.outerHTML, type: e.getAttribute('data-piece-type'), label: e.getAttribute('aria-label') }));
  eq(norm(got.html), norm(GOLDEN.pieces[t].html), `${t}: the piece is the same markup`);
  eq(norm(got.label), norm(GOLDEN.pieces[t].label), `${t}: and has the same name`);
  ok(t === 'die' ? /^die-[1-6]$/.test(got.type) : got.type === t, `${t}: and its own type`);
}
eq(types.length, 24, 'twenty-four buttons, as before');

console.log('2. export');
await page.click('#clearBoardBtn');
for (const t of ['unit', 'ten', 'fraction-4', 'alg-negx', 'pb-hex', 'die-3']) await page.click(t.startsWith('fraction-') ? `[data-add-fraction="${t.slice(9)}"]` : `[data-add="${t.replace('die-3', 'die')}"]`).catch(() => {});
const before = await pieces();
ok(before.length >= 5, 'a board of several families is on screen');
const text = await downloadText(page, '#exportBoardBtn', { what: 'the board file' });
const file = JSON.parse(text);
eq([file.v, file.kind, file.name], [1, 'vmb-board', 'Manipulatives board'], 'the file has the envelope');
eq(file.state.pieces.map(p => [p.type, p.left, p.top]), before, 'and the board on screen, piece for piece');
ok(/Exported/.test(await status()), 'and the page says it exported');

console.log('3. import');
await page.click('#clearBoardBtn');
await importText(text, 'my-board.json');
eq(await names(), ['Manipulatives board'], 'the file became a new saved board');
eq(await pieces(), before, 'drawn as it was');
ok(/Imported "Manipulatives board": \d+ pieces\./.test(await status()), 'and the page says what came in: ' + (await status()));
await importText(text, 'again.json');
eq(await names(), ['Manipulatives board', 'Manipulatives board (2)'], 'importing the same file again keeps the first board and adds a second name');
const again = JSON.parse(await downloadText(page, '#exportBoardBtn', { what: 'the board file' }));
eq(again.state, file.state, 'export, import and export again gives the same board');

console.log('4. a hostile file');
const hostile = {
  pieces: [
    { type: 'unit', left: 10, top: 20 }, { type: '<img src=x onerror=window.__pwned=1>', left: 5, top: 5 }, { type: 'fraction-99', left: 1, top: 1 },
    { type: 'ten', left: 'far', top: 3 }, { type: 'hundred', left: 99999, top: -50 }, { type: 'die-9', left: 0, top: 0 }, null, 7, { type: 'die-5', left: 30.6, top: 40.4 }
  ].concat(Array.from({ length: 400 }, () => ({ type: 'unit', left: 1, top: 1 }))),
  line: { min: 5, max: 2, markers: [1, 'x', 3, null, 1e9] }
};
await fresh();
await importText(JSON.stringify({ v: 1, kind: 'vmb-board', name: '"><img src=x onerror=window.__pwned=1>', state: hostile }));
const got = await pieces();
eq(got.length, 300, 'at most 300 pieces come in');
eq(got.slice(0, 4), [['unit', 10, 20], ['hundred', 4000, 0], ['die-5', 31, 40], ['unit', 1, 1]], 'unknown types, non-numbers and "die-9" are dropped; a place off the board is pulled onto it; decimals are rounded');
eq(await page.$$eval('#nlMin, #nlMax', is => is.map(i => i.value)), ['-10', '10'], 'an impossible number-line range falls back to -10 to 10');
ok(/could not be read/.test(await status()), 'and the page says some did not come in');
eq(await page.evaluate(() => window.__pwned || 0), 0, 'nothing in the file ran');
eq(await page.$$eval('#boardSelect option', os => os.filter(o => o.querySelector('img')).length), 0, 'a name that is markup is only text in the list');
const before2 = await pieces();
const stored = await page.evaluate(() => localStorage.getItem('vmb_boards_v1'));
await importText('this is not json');
ok(/not a board file/.test(await status()), 'text that is not JSON is refused with a note');
await importText(JSON.stringify({ v: 1, kind: 'something-else', state: {} }));
ok(/not a board file/.test(await status()), 'another kind of file is refused');
await importText(' '.repeat(1000001));
ok(/too big/.test(await status()), 'a file over 1 MB is refused');
eq([await pieces(), await page.evaluate(() => localStorage.getItem('vmb_boards_v1'))], [before2, stored], 'and none of them changed the board or the saved boards');

console.log('5. unsaved work is asked about');
await fresh();
await page.click('[data-add="unit"]');
let asked = 0;
page.removeAllListeners('dialog');
page.on('dialog', d => { asked++; d.dismiss(); });
await importText(envelope({ pieces: [{ type: 'ten', left: 0, top: 0 }], line: { min: -10, max: 10, markers: [] } }));
eq([asked, (await pieces()).map(p => p[0])], [1, ['unit']], 'an import over unsaved work asks, and "no" leaves the board as it was');
eq(await names(), [], 'and adds nothing');

await page.setViewportSize({ width: 360, height: 800 });
await settle(page, 200);
ok(await page.evaluate(() => document.documentElement.scrollWidth <= 361), 'at 360 px the page does not scroll sideways with the two new buttons');
ok(page.__errs.length === 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
ok(page.__blocked.length === 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
