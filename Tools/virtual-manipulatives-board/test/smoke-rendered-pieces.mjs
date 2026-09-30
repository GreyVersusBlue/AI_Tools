// smoke-rendered-pieces.mjs — 080's pieces drawn from the rendered atlas (Path 21 P4).
//
//   node Tools/virtual-manipulatives-board/test/smoke-rendered-pieces.mjs
//
// Every piece on the board is one cell of Tools/virtual-manipulatives-board/art/pieces.webp,
// rendered by Tools/blender-art/scene_pieces.py into the cells renders.json names. What
// this suite holds down:
//
//   The page and the ledger agree on every cell. CELLS in the page and "cells" in the
//   ledger are two copies of one table; a piece whose background-position is off by a
//   cell shows its neighbour, and nothing else would notice.
//
//   The atlas really loads, at the size the ledger says, from the site.
//
//   Every piece has a name and value a screen reader can read (role="img" plus
//   aria-label), and colour is never the only carrier: a negative algebra tile says
//   "negative" and shows "−", and a fraction tile shows "1/n".
//
//   Dice roll, save the face they show, and come back showing it after a reload.
//
//   The snapshot is drawn from the atlas at 2x: a unit block's pixels in the export
//   match the atlas's own, not a flat fill.
//
//   The board stays light in the dark theme. That is the premise of shipping one
//   light atlas (the entry's use is "sheet"); if the board ever follows the theme,
//   this fails and the atlas needs its dark twin.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8453;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/080-virtual-manipulatives-board.html';
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ATLAS = 'Tools/virtual-manipulatives-board/art/pieces.webp';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const ledger = JSON.parse(fs.readFileSync(path.join(SITE, 'Tools', 'blender-art', 'renders.json'), 'utf8'));
const entry = ledger.entries.find(e => e.path === ATLAS);
if (!entry) { console.log('  FAIL no renders.json entry for ' + ATLAS); process.exit(1); }

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

console.log('Virtual Manipulatives Board — rendered pieces');
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

/* ── 1. the atlas loads, at the ledger's size ───────────────────────────── */
const img = await page.evaluate(async url => {
  const im = new Image();
  im.src = url;
  await im.decode();
  return { w: im.naturalWidth, h: im.naturalHeight };
}, BASE + '/' + ATLAS);
eq(`${img.w}x${img.h}`, `${entry.width}x${entry.height}`, 'the atlas decodes at its ledgered size');
const bgSize = await page.evaluate(() => {
  const d = document.createElement('div');
  d.className = 'piece-art';
  document.body.appendChild(d);
  const s = getComputedStyle(d).backgroundSize;
  d.remove();
  return s;
});
eq(bgSize, `${entry.width / entry.density}px ${entry.height / entry.density}px`, 'the page draws it at 1x CSS size (the ledger size over its density)');

/* ── 2. every cell the ledger has, the page shows from the same place ───── */
const ADD = {
  unit: 'unit', ten: 'ten', hundred: 'hundred',
  'alg-pos1': 'alg-pos1', 'alg-neg1': 'alg-neg1', 'alg-posx': 'alg-posx', 'alg-negx': 'alg-negx',
  'alg-posx2': 'alg-posx2', 'alg-negx2': 'alg-negx2',
  'pb-hex': 'pb-hex', 'pb-trapezoid': 'pb-trapezoid', 'pb-rhombus': 'pb-rhombus',
  'pb-thin': 'pb-thin', 'pb-square': 'pb-square', 'pb-triangle': 'pb-triangle'
};
for (const b of Object.keys(ADD)) await page.click(`[data-add="${b}"]`);
await page.click('[data-add-fraction="4"]');
await settle(page);
const shown = await page.evaluate(() => Array.from(document.querySelectorAll('#board [data-cell]')).map(el => {
  const cs = getComputedStyle(el);
  return { cell: el.getAttribute('data-cell'), pos: cs.backgroundPosition, w: el.offsetWidth, h: el.offsetHeight };
}));
const seen = new Set();
for (const s of shown) {
  const c = entry.cells[s.cell];
  if (!ok(!!c, `${s.cell} is a ledger cell`)) continue;
  if (seen.has(s.cell)) continue;
  seen.add(s.cell);
  eq(s.pos, `${-c[0]}px ${-c[1]}px`, `${s.cell} is drawn from its ledger cell`);
  eq(`${s.w}x${s.h}`, `${c[2]}x${c[3]}`, `${s.cell} is its cell's size`);
}
// The dice: load a saved working board with one of each face.
await page.evaluate(() => {
  const pieces = [1, 2, 3, 4, 5, 6].map((f, i) => ({ type: 'die-' + f, left: 20 + i * 60, top: 300 }));
  localStorage.setItem('vmb_working_v1', JSON.stringify({ v: 1, name: '', state: { pieces, line: { min: -10, max: 10, markers: [] } } }));
});
await page.reload({ waitUntil: 'networkidle' });
const dice = await page.evaluate(() => Array.from(document.querySelectorAll('#board [data-cell^="die-"]')).map(el => ({
  cell: el.getAttribute('data-cell'), pos: getComputedStyle(el).backgroundPosition
})));
eq(dice.length, 6, 'a saved board brings back one die per face');
for (const d of dice) {
  const c = entry.cells[d.cell];
  ok(c && d.pos === `${-c[0]}px ${-c[1]}px`, `${d.cell} is drawn from its ledger cell (${d.pos})`);
  seen.add(d.cell);
}
for (const k of ['frac-empty', 'frac-fill']) seen.add(k);
const unshown = Object.keys(entry.cells).filter(k => !seen.has(k));
eq(unshown.join(','), '', 'every ledger cell is something the board can show');

/* ── 3. names and values, never colour alone ────────────────────────────── */
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
for (const b of ['unit', 'hundred', 'alg-negx', 'alg-posx2', 'pb-hex']) await page.click(`[data-add="${b}"]`);
await page.click('[data-add-fraction="12"]');
await settle(page);
const names = await page.evaluate(() => Array.from(document.querySelectorAll('#board .piece')).map(p => ({
  type: p.getAttribute('data-piece-type'), role: p.getAttribute('role'), name: p.getAttribute('aria-label'),
  text: (p.querySelector('.algebra-tile, .lbl') || {}).textContent || ''
})));
ok(names.every(n => n.role === 'img' && n.name), 'every piece is role="img" with a name: ' + JSON.stringify(names.map(n => n.name)));
const byType = Object.fromEntries(names.map(n => [n.type, n]));
eq(byType.unit.name, 'Unit block, 1', 'a unit says its value');
eq(byType.hundred.name, 'Hundred flat, 100', 'a flat says its value');
ok(/negative x/.test(byType['alg-negx'].name) && byType['alg-negx'].text === '−x', 'a negative tile says "negative" and shows "−x"');
ok(/positive x squared/.test(byType['alg-posx2'].name), 'a positive x² tile says so');
ok(/1\/12/.test(byType['fraction-12'].name) && byType['fraction-12'].text === '1/12', 'a fraction tile says and shows "1/12"');
ok(/yellow hexagon/.test(byType['pb-hex'].name), 'a pattern block is named by its shape and conventional colour');

/* ── 4. dice roll and keep their face ───────────────────────────────────── */
await page.click('#clearBoardBtn');
await page.click('[data-add="die"]');
await settle(page);
const faces = new Set();
for (let i = 0; i < 40; i++) {
  await page.hover('#board .piece');
  await page.click('#board .piece .roll');
  const t = await page.evaluate(() => {
    const p = document.querySelector('#board .piece');
    return { type: p.getAttribute('data-piece-type'), name: p.getAttribute('aria-label'), cell: p.querySelector('[data-cell]').getAttribute('data-cell') };
  });
  const f = /^die-([1-6])$/.exec(t.type);
  if (!ok(f && t.cell === t.type && t.name === 'Die showing ' + f[1], 'a roll shows one face and says it: ' + JSON.stringify(t))) break;
  faces.add(f[1]);
}
ok(faces.size >= 4, `forty rolls show at least four different faces (${[...faces].sort().join('')})`);
const before = await page.evaluate(() => document.querySelector('#board .piece').getAttribute('data-piece-type'));
await page.reload({ waitUntil: 'networkidle' });
eq(await page.evaluate(() => document.querySelector('#board .piece').getAttribute('data-piece-type')), before, 'a reload shows the face that was rolled');

/* ── 5. the snapshot is drawn from the atlas, at 2x ─────────────────────── */
await page.click('#clearBoardBtn');
await page.click('[data-add="unit"]');
await settle(page);
await page.click('#snapshotBoardBtn');
await settle(page);
const snap = await page.evaluate(async url => {
  const canvas = document.querySelector('#snapshotPreview canvas');
  const board = document.getElementById('board').getBoundingClientRect();
  const cell = document.querySelector('#board [data-cell="unit"]').getBoundingClientRect();
  const x = Math.round((cell.left - board.left + 13) * 2), y = Math.round((cell.top - board.top + 13) * 2);
  const got = Array.from(canvas.getContext('2d').getImageData(x, y, 1, 1).data);
  const im = new Image();
  im.src = url;
  await im.decode();
  const c = document.createElement('canvas');
  c.width = im.naturalWidth; c.height = im.naturalHeight;
  const cx = c.getContext('2d');
  cx.drawImage(im, 0, 0);
  const want = Array.from(cx.getImageData((268 + 13) * 2, (34 + 13) * 2, 1, 1).data);
  return { w: canvas.width, h: canvas.height, bw: Math.round(board.width * 2), bh: Math.round(board.height * 2), got, want };
}, BASE + '/' + ATLAS);
eq(`${snap.w}x${snap.h}`, `${snap.bw}x${snap.bh}`, 'the snapshot is the board at 2x');
ok(snap.got.slice(0, 3).every((v, i) => Math.abs(v - snap.want[i]) <= 3),
  `a unit's centre in the snapshot is the atlas's own pixel (${snap.got} vs ${snap.want})`);

/* ── 6. the board stays light in the dark theme ─────────────────────────── */
await page.click('[data-add="alg-negx"]');
await page.click('[data-add="alg-posx"]');
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
await settle(page);
const dark = await page.evaluate(() => ({
  board: getComputedStyle(document.getElementById('board')).backgroundColor,
  body: getComputedStyle(document.body).backgroundColor,
  pos: getComputedStyle(document.querySelector('[data-cell="alg-posx"]')).color,
  neg: getComputedStyle(document.querySelector('[data-cell="alg-negx"]')).color
}));
ok(dark.body !== 'rgb(255, 255, 255)' && dark.body !== 'rgb(250, 250, 248)', 'the page itself did go dark: ' + dark.body);
eq(dark.board, 'rgb(255, 255, 255)', 'the board is still white paper in the dark theme');
eq(dark.pos, 'rgb(31, 36, 48)', 'a positive tile keeps its light --ink label');
eq(dark.neg, 'rgb(255, 255, 255)', 'a negative tile keeps its light --accent-ink label');

/* ── 7. no console noise anywhere in the run ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
