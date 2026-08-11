// smoke-clue-image.mjs — images attached to a review-game clue.
//
//   node Tools/review-game-board/test/smoke-clue-image.mjs
//
// A map, a diagram, or a primary source is often the whole question, and until
// now the only way to project one was to describe it out loud. An image now
// rides with the clue: downscaled on import, stored inline with the board, and
// shown on the projector overlay, the answer key and the practice quiz.
//
// The interesting parts are the ones that would go wrong quietly:
//
//   1. The downscale has to actually shrink. localStorage is capped around
//      5 MB for the whole origin, so a full-size phone photo per clue would
//      fill it in a handful of questions.
//   2. A Daily Double hides its question until the wager is in. If the image
//      stayed on screen, the map would tell the class what to bet.
//   3. A save that gets refused has to say so. Before this, a full store threw
//      out of saveBoard and a period of scoring vanished with no warning.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8193;
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

/** A deliberately oversized PNG (2400x1800 of noise) as a File on the input —
 *  noise so it can't be compressed away, which is what makes the downscale
 *  assertion meaningful. The "+ Image" button has to be clicked first: it is
 *  what tells the page which row the next file belongs to. Playwright cancels
 *  the native file chooser it opens, which is exactly what we want. */
const attachBigImage = (p, selector) => p.evaluate(async (sel) => {
  const c = document.createElement('canvas');
  c.width = 2400; c.height = 1800;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = (i * 7) % 255; img.data[i + 1] = (i * 13) % 255;
    img.data[i + 2] = (i * 29) % 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const file = new File([blob], 'map.png', { type: 'image/png' });
  const dt = new DataTransfer();
  dt.items.add(file);
  const input = document.querySelector(sel);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return blob.size;
}, selector);

const fillClue = async (p, rowIdx, pts, q, a) => {
  const rows = p.locator('.clue-row');
  await rows.nth(rowIdx).locator('.clue-points').fill(String(pts));
  await rows.nth(rowIdx).locator('.clue-question').fill(q);
  await rows.nth(rowIdx).locator('.clue-answer').fill(a);
};

console.log('Quiz / Review Game Board — images inside a clue');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

await page.fill('#boardName', 'Unit 4 Maps');
await page.fill('.cat-name-input', 'Geography');
await fillClue(page, 0, 100, 'Which river is marked here?', 'The Nile');
await page.click('.category-block .cat-actions button.secondary');
await settle(page, 150);
await fillClue(page, 1, 200, 'Name this landform.', 'A delta');

/* ── 1. the image is downscaled hard on import ─────────────────────────── */
eq(await page.locator('.clue-row').nth(0).locator('.clue-image-cell button').textContent(), '+ Image',
   'each clue row offers an image');
await page.locator('.clue-row').nth(0).locator('.clue-image-cell button').click();
await settle(page, 200);
const originalBytes = await attachBigImage(page, '#clueImageFile');
await settle(page, 900);

const stored = await page.evaluate(() => {
  const row = document.querySelectorAll('.clue-row')[0];
  return row.__clueImage;
});
ok(typeof stored === 'string' && stored.indexOf('data:image/jpeg') === 0,
   'the image is stored inline as a JPEG data URL');
const storedBytes = Math.round((stored.length - stored.indexOf(',') - 1) * 3 / 4);
ok(storedBytes < originalBytes / 8,
   `and is far smaller than the original (${Math.round(originalBytes / 1024)} KB in, ${Math.round(storedBytes / 1024)} KB out)`);
const dims = await page.evaluate(src => new Promise(r => {
  const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.src = src;
}), stored);
eq(dims[0], 900, 'the long edge is capped at 900px for a projector');
eq(dims[1], 675, 'with the aspect ratio kept');
ok(/KB/.test(await page.textContent('#storageNote')), 'the size after downscaling is reported: ' + await page.textContent('#storageNote'));
ok(/storage/.test(await page.textContent('#storageNote')), 'alongside a running storage readout');

/* ── 2. it survives Save board, and a reload ───────────────────────────── */
await page.click('#buildFromManualBtn');
await settle(page, 500);
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gvb-review-board:data:Unit 4 Maps')));
ok(saved.categories[0].clues[0].image.indexOf('data:image/jpeg') === 0, 'the board record carries the image');
eq(saved.categories[0].clues[1].image, null, 'and the clue without one carries null, not a stray copy');

await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);

/* ── 3. it shows on the projector overlay ──────────────────────────────── */
await page.locator('.cell:not(.blank)').first().click();
await settle(page, 300);
const shown = await page.evaluate(() => {
  const img = document.getElementById('overlayImage');
  return { visible: img.classList.contains('show'), hasSrc: !!img.getAttribute('src'), alt: img.alt };
});
eq(shown.visible, true, 'opening the clue shows its image');
ok(/Which river/.test(shown.alt), 'with the question as its alt text: ' + shown.alt);
await page.keyboard.press('Escape');
await settle(page, 200);

await page.locator('.cell:not(.blank)').nth(1).click();
await settle(page, 300);
eq(await page.evaluate(() => document.getElementById('overlayImage').classList.contains('show')), false,
   'a clue with no image shows no image — the previous one does not linger');
await page.keyboard.press('Escape');
await settle(page, 200);

/* ── 4. a Daily Double keeps the image hidden until the wager is in ────── */
// Pinned onto the clue that has the image rather than left to the random
// draw: loadBoardByName keeps the stored flag, so this is deterministic.
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('gvb-review-board:data:Unit 4 Maps'));
  s.dailyDoubleEnabled = true;
  s.categories[0].clues[0].dailyDouble = true;
  s.categories[0].clues[1].dailyDouble = false;
  localStorage.setItem('gvb-review-board:data:Unit 4 Maps', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
await page.locator('.cell:not(.blank)').first().click();
await settle(page, 300);
const ddState = await page.evaluate(() => ({
  wagerOpen: document.getElementById('wagerPanel').style.display !== 'none',
  imageShown: document.getElementById('overlayImage').classList.contains('show'),
}));
eq(ddState.wagerOpen, true, 'the image clue is the Daily Double, so the wager panel opens');
eq(ddState.imageShown, false, 'and the image stays hidden — otherwise the map tells the class what to bet');
await page.click('#wagerStartBtn');
await settle(page, 300);
eq(await page.evaluate(() => document.getElementById('overlayImage').classList.contains('show')), true,
   'it appears with the question once the wager is in');
await page.keyboard.press('Escape');
await settle(page, 200);

/* ── 5. both printouts carry the image ─────────────────────────────────── */
await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
await page.click('#printAnswerKeyBtn');
await settle(page, 300);
eq(await page.evaluate(() => document.querySelectorAll('#printArea .key-thumb').length), 1,
   'the answer key shows a thumbnail for the clue that has one');
await page.click('#printQuizBtn');
await settle(page, 300);
eq(await page.evaluate(() => document.querySelectorAll('#printArea .quiz-image').length), 1,
   'the practice quiz prints the image at readable size');
eq(await page.evaluate(() => window.__printed), true, 'and both actually reach the print dialog');

/* ── 6. a refused save is reported instead of losing the game ──────────── */
const full = await prepPage(browser, BASE, { width: 1300, height: 900 });
await full.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(full, 400);
await full.evaluate(() => {
  window.__alerts = [];
  window.alert = (m) => window.__alerts.push(m);
  const real = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (k.indexOf('gvb-review-board:data:') === 0) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
    return real.call(this, k, v);
  };
});
await full.fill('#boardName', 'Too Big');
await full.fill('.cat-name-input', 'Anything');
await fillClue(full, 0, 100, 'A question', 'An answer');
await full.click('#buildFromManualBtn');
await settle(full, 400);
const alerts = await full.evaluate(() => window.__alerts);
eq(alerts.length, 1, 'a refused save says so, exactly once: ' + JSON.stringify(alerts).slice(0, 120));
ok(/storage is full/.test(alerts[0] || ''), 'naming the actual problem');
ok(/Remove an image/.test(alerts[0] || ''), 'and what to do about it');
eq(await full.evaluate(() => (JSON.parse(localStorage.getItem('gvb-review-board:list') || '[]')).indexOf('Too Big')), -1,
   'and the board list is not left pointing at a board that was never written');

/* ── 7. an imported board cannot smuggle in a remote image src ─────────── */
const importCheck = await page.evaluate(() => {
  // normalizeBoard is not exported; drive it the way the JSON import does.
  const evil = {
    name: 'Imported', categories: [{ name: 'C', clues: [
      { points: 100, question: 'q', answer: 'a', image: 'https://example.com/tracker.gif' },
      { points: 200, question: 'q2', answer: 'a2', image: 'data:image/png;base64,iVBORw0KGgo=' },
    ] }],
  };
  const file = new File([JSON.stringify(evil)], 'b.json', { type: 'application/json' });
  const dt = new DataTransfer(); dt.items.add(file);
  const input = document.getElementById('importBoardFile');
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return new Promise(r => setTimeout(() => {
    const names = JSON.parse(localStorage.getItem('gvb-review-board:list') || '[]');
    const imported = names.filter(n => n.indexOf('Imported') === 0).pop();
    r(JSON.parse(localStorage.getItem('gvb-review-board:data:' + imported)).categories[0].clues.map(c => c.image));
  }, 400));
});
eq(importCheck[0], null, 'a remote image URL in an imported board is dropped');
eq(importCheck[1], 'data:image/png;base64,iVBORw0KGgo=', 'while an inline data URL is kept');

/* ── 8. no console noise ───────────────────────────────────────────────── */
for (const [name, p] of [['main', page], ['full-storage', full]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
