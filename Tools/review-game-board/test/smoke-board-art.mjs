// smoke-board-art.mjs — 030's rendered board art (Path 21 P4).
//
//   node Tools/review-game-board/test/smoke-board-art.mjs
//
// The projected board draws a rendered backdrop behind the grid and rendered
// 9-slice tiles under the category names and point values
// (Tools/review-game-board/art/, ledgered in Tools/blender-art/renders.json).
// What this suite holds down:
//
//   Every ledgered board file is one the page's CSS draws, loads from the
//   site at its ledgered size, and every one the CSS draws is ledgered.
//
//   A playable clue shows the cell tile and swaps to the hover tile under the
//   pointer and on keyboard focus; a spent clue drops the art for the flat
//   --board-used, so it reads as played at a glance.
//
//   The gold text on a tile is --gold, the colour renders.json measured the
//   tile's middle against: if the page's gold drifts, the recorded contrast
//   is about a colour nobody draws.
//
//   The board looks the same in the dark theme (the entries' use is "sheet").
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8456;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/030-review-game-board.html';
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ART = 'Tools/review-game-board/art/';

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const ledger = JSON.parse(fs.readFileSync(path.join(SITE, 'Tools', 'blender-art', 'renders.json'), 'utf8'));
const entries = ledger.entries.filter(e => e.path.startsWith(ART));
const file = u => (/url\("?([^")]+)"?\)/.exec(u || '') || [])[1] || '';
const name = u => file(u).split('/').pop();

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

console.log('Review Game Board — board art');
const clue = (points, question) => ({ points, question, answer: question + ' answer', used: false, dailyDouble: false });
const BOARD = {
  name: 'Rivers',
  categories: [{ name: 'Rivers', clues: [clue(100, 'Longest river?'), clue(200, 'Widest river?')] },
               { name: 'Deltas', clues: [clue(100, 'Which delta?'), clue(200, 'Why deltas form')] }],
  teams: [{ name: 'Team 1', score: 0 }, { name: 'Team 2', score: 0 }],
  dailyDoubleEnabled: false, lightningRoundEnabled: false, lightningRoundSeconds: 15,
};
await page.goto(URL_PAGE, { waitUntil: 'load' });
await page.evaluate(b => {
  localStorage.clear();
  localStorage.setItem('gvb-review-board:list', JSON.stringify(['Rivers']));
  localStorage.setItem('gvb-review-board:current', 'Rivers');
  localStorage.setItem('gvb-review-board:data:Rivers', JSON.stringify(b));
}, BOARD);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('#boardCols .cell:not(.used):not(.blank)');
await settle(page, 200);

const look = () => page.evaluate(() => {
  const cs = el => getComputedStyle(el);
  const cell = document.querySelector('#boardCols .cell:not(.used):not(.blank)');
  const head = document.querySelector('#boardCols .cat-header');
  return {
    backdrop: cs(document.querySelector('.board-grid')).backgroundImage,
    header: cs(head).borderImageSource, headerColor: cs(head).color,
    cell: cs(cell).borderImageSource, cellColor: cs(cell).color, slice: cs(cell).borderImageSlice,
    gold: cs(document.documentElement).getPropertyValue('--gold').trim()
  };
});

/* ── 1. the CSS draws exactly the ledgered files, and they load ────────── */
const base = await look();
await page.hover('#boardCols .cell:not(.used):not(.blank)');
const hovered = await page.evaluate(() => getComputedStyle(document.querySelector('#boardCols .cell:hover')).borderImageSource);
const drawn = [name(base.backdrop), name(base.header), name(base.cell), name(hovered)];
eq(drawn.slice().sort().join(','), entries.map(e => e.path.split('/').pop()).sort().join(','), 'the board draws exactly the ledgered art');
for (const e of entries) {
  const got = await page.evaluate(async url => {
    const im = new Image();
    im.src = url;
    try { await im.decode(); } catch { return null; }
    return { w: im.naturalWidth, h: im.naturalHeight };
  }, BASE + '/' + e.path);
  ok(got && got.w === e.width && got.h === e.height, `${e.subject} loads at ${e.width}x${e.height}: ${JSON.stringify(got)}`);
}
eq(base.slice, `${entries.find(e => e.subject === 'cell').slice} fill`, 'the cell tile is cut at its ledgered slice, middle filled');

/* ── 2. the gold the page draws is the gold the ledger measured ─────────── */
const ledgerGold = entries.find(e => e.subject === 'cell').underText[0].hex;
eq(base.gold.toLowerCase(), ledgerGold, '--gold is the text colour renders.json measured');
eq(base.cellColor, 'rgb(240, 196, 25)', 'a point value is drawn in it');
eq(base.headerColor, 'rgb(240, 196, 25)', 'and so is a category name');

/* ── 3. keyboard focus gets the hover tile too ───────────────────────────── */
await page.mouse.move(0, 0);
await page.focus('#boardCols .cell:not(.used):not(.blank)');
await page.keyboard.press('Shift+Tab');
await page.keyboard.press('Tab');
const focused = await page.evaluate(() => {
  const el = document.activeElement;
  return el && el.classList.contains('cell') ? getComputedStyle(el).borderImageSource : null;
});
ok(name(focused) === 'cell-hover.webp', 'a clue with keyboard focus shows the hover tile: ' + name(focused));

/* ── 4. a spent clue drops the art ───────────────────────────────────────── */
await page.mouse.move(0, 0);
await page.locator('#boardCols .cell:not(.used):not(.blank)').first().click();
await settle(page, 200);
if (await page.isVisible('#wagerPanel')) {
  await page.click('#wagerStartBtn');
  await settle(page, 200);
}
await page.click('#showAnswerBtn');
await settle(page, 100);
if (await page.isVisible('#closeUsedBtn')) await page.click('#closeUsedBtn');
else await page.locator('#awardRow button').first().click();
await settle(page, 200);
const used = await page.evaluate(() => {
  const el = document.querySelector('#boardCols .cell.used');
  if (!el) return null;
  const cs = getComputedStyle(el);
  return { img: cs.borderImageSource, bg: cs.backgroundColor, board: getComputedStyle(document.documentElement).getPropertyValue('--board-used').trim() };
});
ok(used && used.img === 'none', 'a played clue has no tile art: ' + JSON.stringify(used));
ok(used && used.bg === 'rgb(10, 20, 54)', 'it is the flat --board-used');
await page.hover('#boardCols .cell.used');
eq(await page.evaluate(() => getComputedStyle(document.querySelector('#boardCols .cell.used')).borderImageSource), 'none', 'and hovering it does not light it up');

/* ── 5. the same board in the dark theme ─────────────────────────────────── */
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
await settle(page, 100);
const dark = await look();
eq(JSON.stringify([name(dark.backdrop), name(dark.header), name(dark.cell), dark.cellColor]),
  JSON.stringify([name(base.backdrop), name(base.header), name(base.cell), base.cellColor]), 'the dark theme draws the same board');

/* ── 6. no console noise ────────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
