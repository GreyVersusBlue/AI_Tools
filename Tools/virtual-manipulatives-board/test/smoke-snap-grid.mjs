// smoke-snap-grid.mjs — snap-to-grid on the manipulatives board.
//
//   node Tools/virtual-manipulatives-board/test/smoke-snap-grid.mjs
//
// Base-ten blocks exist to show that ten units make a rod and ten rods make a
// flat. Dragging free-hand, ten units never quite line up, and the point gets
// made badly. Snapping puts every piece on a grid whose cell is one unit
// block. What this suite holds down:
//
//   The geometry actually agrees. Ten units in a row must be exactly as long
//   as a ten-rod, and a hundred-flat exactly ten rods. Before this round the
//   rod was 249px against ten 26px units — near enough to look right and
//   wrong enough to undercut the demonstration.
//
//   Snapping lands pieces on the grid during a real pointer drag, and leaves
//   them where they were when it is off.
//
//   Turning snapping on does not move anything by itself. Rearranging a
//   teacher's live demonstration under them would be a surprise; "Align
//   pieces" is the explicit way to ask for it.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8180;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/080-virtual-manipulatives-board.html';
const GRID = 26;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 950 });

const sizeOf = type => page.evaluate(t => {
  const el = document.querySelector(`#board .piece[data-piece-type="${t}"]`);
  const r = el.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height) };
}, type);

const posOf = nth => page.evaluate(i => {
  const el = document.querySelectorAll('#board .piece')[i];
  return { left: parseFloat(el.style.left), top: parseFloat(el.style.top) };
}, nth);

/** Drag the nth piece by (dx, dy) with real pointer events. */
async function dragPiece(nth, dx, dy) {
  const box = await page.evaluate(i => {
    const r = document.querySelectorAll('#board .piece')[i].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, nth);
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x + dx, box.y + dy, { steps: 6 });
  await page.mouse.up();
  await settle(page);
}

console.log('Virtual Manipulatives Board — snap to grid');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });

/* ── 1. the base-ten pieces are built from one module ────────────────────── */
await page.click('[data-add="unit"]');
await page.click('[data-add="ten"]');
await page.click('[data-add="hundred"]');
await settle(page);
const unit = await sizeOf('unit');
const ten = await sizeOf('ten');
const hundred = await sizeOf('hundred');
eq(`${unit.w}x${unit.h}`, `${GRID}x${GRID}`, 'a unit block is one grid cell');
eq(ten.w, unit.w * 10, 'a ten-rod is exactly ten units long');
eq(ten.h, unit.h, 'and one unit tall');
eq(hundred.w, ten.w, 'a hundred-flat is exactly one rod wide');
eq(hundred.h, unit.h * 10, 'and ten units tall');

/* ── 2. with snapping off, a drag lands wherever it lands ────────────────── */
await page.click('#clearBoardBtn');
await page.click('[data-add="unit"]');
await settle(page);
await dragPiece(0, 37, 19);
const free = await posOf(0);
ok(free.left % GRID !== 0 || free.top % GRID !== 0,
   `an unsnapped drag is off-grid: ${JSON.stringify(free)}`);

/* ── 3. with snapping on, a drag lands on the grid ───────────────────────── */
await page.check('#snapToggle');
await settle(page);
ok(await page.evaluate(() => document.getElementById('board').classList.contains('snap')),
   'the grid is drawn on the board while snapping is on');
eq(JSON.stringify(await posOf(0)), JSON.stringify(free), 'turning snapping on does not move what is already placed');

await dragPiece(0, 41, 33);
const snapped = await posOf(0);
eq(snapped.left % GRID, 0, `a snapped drag lands on a grid column (left ${snapped.left})`);
eq(snapped.top % GRID, 0, `and on a grid row (top ${snapped.top})`);

/* ── 4. ten snapped units really do make a rod ───────────────────────────── */
await page.click('#clearBoardBtn');
await settle(page);
for (let i = 0; i < 10; i++) await page.click('[data-add="unit"]');
await settle(page);
/* lay them out along one row, each one grid cell further along */
await page.evaluate(g => {
  document.querySelectorAll('#board .piece').forEach((el, i) => {
    el.style.left = (i * g) + 'px';
    el.style.top = (3 * g) + 'px';
  });
}, GRID);
await settle(page);
const row = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('#board .piece'));
  const left = Math.min(...els.map(e => e.getBoundingClientRect().left));
  const right = Math.max(...els.map(e => e.getBoundingClientRect().right));
  return Math.round(right - left);
});
await page.click('[data-add="ten"]');
await settle(page);
eq(row, (await sizeOf('ten')).w, 'ten units on consecutive grid cells span exactly one ten-rod');

/* ── 5. Align pieces pulls an existing arrangement onto the grid ─────────── */
await page.click('#clearBoardBtn');
await page.click('[data-add="unit"]');
await page.click('[data-add="unit"]');
await settle(page);
await page.evaluate(() => {
  document.querySelectorAll('#board .piece').forEach((el, i) => {
    el.style.left = (17 + i * 41) + 'px';
    el.style.top = '55px';
  });
});
await settle(page);
await page.click('#alignPiecesBtn');
await settle(page);
const aligned = await page.evaluate(() => Array.from(document.querySelectorAll('#board .piece'))
  .map(el => [parseFloat(el.style.left), parseFloat(el.style.top)]));
ok(aligned.every(([l, t]) => l % GRID === 0 && t % GRID === 0),
   'every piece is on the grid after Align: ' + JSON.stringify(aligned));
eq(aligned.map(a => a[0]).join(','), '26,52', 'each moved to its nearest column, not to a pile');

/* ── 6. new pieces land on the grid while snapping is on ─────────────────── */
await page.click('#clearBoardBtn');
await page.click('[data-add="alg-posx"]');
await settle(page);
const fresh = await posOf(0);
ok(fresh.left % GRID === 0 && fresh.top % GRID === 0,
   `a piece added while snapping starts on the grid: ${JSON.stringify(fresh)}`);

/* ── 7. the setting is remembered, and off means off ─────────────────────── */
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
ok(await page.isChecked('#snapToggle'), 'snapping is still on after a reload');
ok(await page.evaluate(() => document.getElementById('alignPiecesBtn').style.display !== 'none'),
   'and Align pieces is offered');
await page.uncheck('#snapToggle');
await settle(page);
ok(!(await page.evaluate(() => document.getElementById('board').classList.contains('snap'))),
   'unchecking hides the grid');
ok(await page.evaluate(() => document.getElementById('alignPiecesBtn').style.display === 'none'),
   'and Align pieces goes with it');
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
eq(await page.isChecked('#snapToggle'), false, 'off is remembered too');

/* ── 8. no console noise anywhere in the run ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
