// smoke-clue-image.mjs — a picture inside a clue on the Review Game Board.
//
//   node Tools/review-game-board/test/smoke-clue-image.mjs
//
// For a social studies or science review, the picture often IS the question:
// "which region does this map show", "what is happening in this cartoon". A
// text-only board limits the tool to recall questions.
//
// The three things worth holding still:
//   1. an imported image is downscaled hard — it is kept inline in the board,
//      and localStorage caps out around 5 MB for the whole site (P12);
//   2. it survives the whole round trip — editor -> saved board -> projected
//      clue -> printed quiz and answer key -> JSON export -> JSON import;
//   3. a Daily Double keeps it hidden behind the wager panel, because a
//      picture shown early is the clue given away before anyone has bet.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8173;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/030-review-game-board.html';

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

console.log('Review Game Board — images inside a clue');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* ── a deliberately oversized PNG, to prove the downscale is real ──────── */
const BIG_W = 2400, BIG_H = 1600;
const bigPng = await page.evaluate(([w, h]) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  // Noise, not flat colour: a flat image compresses to nothing and would make
  // the "it got smaller" assertion meaningless.
  const img = g.createImageData(w, h);
  let seed = 7;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    img.data[i] = seed & 255; img.data[i + 1] = (seed >> 8) & 255;
    img.data[i + 2] = (seed >> 16) & 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}, [BIG_W, BIG_H]);
ok(bigPng.length > 400000, `source image is genuinely large (${Math.round(bigPng.length / 1024)} KB of data URL)`);

/* ── build a one-category board with an image on the first clue ────────── */
await page.fill('#boardName', 'Map Skills Review');
await page.fill('.cat-name-input', 'Maps');
const rows = () => page.$$('#categoriesEditor .clue-row');
let clueRows = await rows();
await clueRows[0].$eval('.clue-points', el => { el.value = '100'; });
await clueRows[0].$eval('.clue-question', el => { el.value = 'Which river is highlighted here?'; });
await clueRows[0].$eval('.clue-answer', el => { el.value = 'The Nile'; });

// Feed the file input the way a picked file would arrive.
await clueRows[0].$eval('input[type="file"]', (input, b64) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const dt = new DataTransfer();
  dt.items.add(new File([bytes], 'map.png', { type: 'image/png' }));
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}, bigPng.split(',')[1]);

await page.waitForFunction(
  () => !!document.querySelector('#categoriesEditor .clue-row').__clueImage, null, { timeout: 10000 });

const stored = await page.evaluate(() => document.querySelector('#categoriesEditor .clue-row').__clueImage);
ok(/^data:image\/jpeg/.test(stored), 'the stored image is re-encoded as JPEG, not kept as the original PNG');
ok(stored.length < bigPng.length / 4,
   `downscaled hard: ${Math.round(stored.length / 1024)} KB vs ${Math.round(bigPng.length / 1024)} KB`);
const dims = await page.evaluate(src => new Promise(res => {
  const i = new Image();
  i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight });
  i.src = src;
}), stored);
eq(dims.w, 1000, 'long edge capped at 1000px');
eq(dims.h, Math.round(1000 * BIG_H / BIG_W), 'aspect ratio preserved');
ok(await page.isVisible('#categoriesEditor .clue-image-thumb'), 'a thumbnail appears in the editor');
ok(/KB/.test(await page.textContent('#categoriesEditor .clue-image-size')), 'the editor shows the size it took');

// A second, image-free clue so the "no image" path is exercised too.
await page.click('#categoriesEditor .cat-actions button.secondary');
clueRows = await rows();
await clueRows[1].$eval('.clue-points', el => { el.value = '200'; });
await clueRows[1].$eval('.clue-question', el => { el.value = 'What is a cardinal direction?'; });
await clueRows[1].$eval('.clue-answer', el => { el.value = 'North, south, east or west'; });

await page.click('#buildFromManualBtn');
await settle(page, 400);

/* ── it reached the saved board, and only the clue that has one ────────── */
const saved = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('gvb-review-board:data:Map Skills Review')));
ok(/^data:image\/jpeg/.test(saved.categories[0].clues[0].image), 'the image is saved with the board');
eq(saved.categories[0].clues[1].image, undefined, 'a clue with no picture carries no image field');

/* ── projected: the image shows with the clue ──────────────────────────── */
await page.evaluate(() => { // make sure the Daily Double isn't on the clue under test
  const st = JSON.parse(localStorage.getItem('gvb-review-board:data:Map Skills Review'));
  st.dailyDoubleEnabled = false;
  st.categories[0].clues.forEach(c => { c.dailyDouble = false; });
  localStorage.setItem('gvb-review-board:data:Map Skills Review', JSON.stringify(st));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
await page.click('#boardCols .cell');
await settle(page, 300);
ok(await page.isVisible('#overlayImage'), 'the clue image is projected with the question');
ok(await page.evaluate(() => document.getElementById('overlayImage').naturalWidth > 0),
   'and it actually decoded (not a broken image)');
await page.keyboard.press('Escape');
await settle(page, 200);

// The second clue has no image — the element must not linger from the first.
const cells = await page.$$('#boardCols .cell');
await cells[1].click();
await settle(page, 300);
ok(!(await page.isVisible('#overlayImage')), 'a text-only clue shows no image');
await page.keyboard.press('Escape');
await settle(page, 200);

/* ── Daily Double: hidden until the wager is in ────────────────────────── */
// Pin the Daily Double to the picture clue rather than letting the random
// assignment decide which branch this check exercises. loadBoardByName() reads
// the flags as saved, so writing them here is enough.
await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('gvb-review-board:data:Map Skills Review'));
  st.dailyDoubleEnabled = true;
  st.categories[0].clues[0].dailyDouble = true;
  st.categories[0].clues.forEach(c => { c.used = false; });
  localStorage.setItem('gvb-review-board:data:Map Skills Review', JSON.stringify(st));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
await page.click('#boardCols .cell');
await settle(page, 250);
ok(await page.isVisible('#wagerPanel'), 'the Daily Double wager panel opened on the picture clue');
ok(!(await page.isVisible('#overlayImage')), 'a Daily Double keeps the picture hidden behind the wager panel');
await page.click('#wagerStartBtn');
await settle(page, 250);
ok(await page.isVisible('#overlayImage'), 'and reveals it once the wager is placed');
await page.keyboard.press('Escape');
await settle(page, 200);

/* ── printed output carries the picture ────────────────────────────────── */
await page.click('#printQuizBtn');
await settle(page, 300);
eq(await page.$$eval('#printArea .quiz-img', e => e.length), 1, 'the practice quiz prints the picture');
await page.click('#printAnswerKeyBtn');
await settle(page, 300);
eq(await page.$$eval('#printArea .key-img', e => e.length), 1, 'the answer key prints a thumbnail of it');

/* ── JSON export/import round trip ─────────────────────────────────────── */
const roundTripped = await page.evaluate(() => {
  const exported = JSON.parse(JSON.stringify(
    JSON.parse(localStorage.getItem('gvb-review-board:data:Map Skills Review'))));
  // Same shape the file-import path receives, including a hostile image field
  // on the second clue that must not survive.
  exported.categories[0].clues[1].image = 'javascript:alert(1)';
  return exported;
});
// Drive the real import handler by handing it a file.
await page.$eval('#importBoardFile', (input, text) => {
  const dt = new DataTransfer();
  dt.items.add(new File([text], 'board.json', { type: 'application/json' }));
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}, JSON.stringify(roundTripped));
await settle(page, 600);
const imported = await page.evaluate(() => {
  const names = JSON.parse(localStorage.getItem('gvb-review-board:list'));
  const last = names[names.length - 1];
  return JSON.parse(localStorage.getItem('gvb-review-board:data:' + last));
});
ok(/^data:image\/jpeg/.test(imported.categories[0].clues[0].image), 'the image survives a JSON export/import');
eq(imported.categories[0].clues[1].image, undefined, 'a non-image string in that field is dropped on import');


/* ── the storage readout ───────────────────────────────────────────────────
   Clue images are the first thing in this tool that can realistically fill
   localStorage, and the failure they cause arrives mid-lesson, on a save the
   teacher never pressed. The only signal before this was an alert AFTER the
   write had already failed.

   The measurement itself is the risky part, because there is no API that
   reports a quota — the ceiling has to be probed by writing until it throws.
   A probe that leaves its padding behind would eat the very space it is
   measuring, so that is the first thing checked here. */
const report = () => page.evaluate(() => window.ReviewBoardStore.storageReport());

const r0 = await report();
ok(r0 && r0.cap > 1024 * 1024, 'the ceiling can be measured at all: ' + JSON.stringify(r0 && Math.round(r0.cap / 1048576) + ' MB'));
ok(r0.boards > 0, 'the saved board is counted');
ok(r0.total >= r0.boards, 'and the whole-origin figure includes it');
eq(await page.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf('__probe') !== -1).length), 0,
   'the probe cleans up after itself — padding left behind would eat the space it is measuring');

const line0 = await page.textContent('#storageLine');
ok(/using about/.test(line0), 'the readout says how much is used: ' + line0);
ok(/%/.test(line0), 'as a share of what there is, not just a raw number');
eq(await page.getAttribute('#storageLine', 'aria-live'), 'polite', 'and is announced when it changes');
eq(await page.$eval('#storageLine', e => e.className), 'storage-line',
   'with no warning styling while there is plenty of room');

/* ── it warns before the wall, not after it ────────────────────────────── */
/* Fill the origin to somewhere past 70% with a key belonging to nothing, and
   the line has to (a) go up, (b) change tone, and (c) say what to do. */
async function fillTo(fraction) {
  return page.evaluate(async (frac) => {
    localStorage.removeItem('__test_padding');
    window.ReviewBoardStore.forgetCapacity();
    const r = window.ReviewBoardStore.storageReport();
    const want = Math.max(0, Math.floor((r.cap * frac - r.total) / 2));  // chars, 2 bytes each
    if (want <= 0) return false;
    try { localStorage.setItem('__test_padding', 'x'.repeat(want)); } catch (e) { return false; }
    window.ReviewBoardStore.forgetCapacity();
    return true;
  }, fraction);
}

ok(await fillTo(0.75), 'the origin can be filled for the test');
await page.evaluate(() => document.getElementById('buildFromManualBtn') && null);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 600);
const warnLine = await page.textContent('#storageLine');
const warnClass = await page.$eval('#storageLine', e => e.className);
ok(/warn|danger/.test(warnClass), 'past ~70% the line changes tone: ' + warnClass);
ok(/clue images|Export a board|remove/i.test(warnLine),
   'and says what to do about it rather than only stating a number: ' + warnLine);

ok(await fillTo(0.95), 'and the origin can be filled further');
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 600);
const dangerLine = await page.textContent('#storageLine');
eq(await page.$eval('#storageLine', e => e.className), 'storage-line danger',
   'nearly full reads as urgent rather than as a note');
ok(/likely to fail/.test(dangerLine),
   'and names the consequence — a board that will not save loses a game mid-lesson: ' + dangerLine);

await page.evaluate(() => { localStorage.removeItem('__test_padding'); window.ReviewBoardStore.forgetCapacity(); });
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 600);
eq(await page.$eval('#storageLine', e => e.className), 'storage-line',
   'clearing the space clears the warning — the probed ceiling is not cached past a delete');

/* ── no console noise, nothing left the site ───────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
