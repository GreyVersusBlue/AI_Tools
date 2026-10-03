// smoke-print.mjs — what Ctrl+P puts on paper from the School Layout
// Visualizer's Blueprint tab (Path 7 P2).
//
//   node Tools/schedule-visualizer/test/smoke-print.mjs
//
// Until 2026-10-03 the visualizer half of 035 had no print rule at all: the
// app is a 100vh column of scroll boxes, so the paper got the header, the tab
// bar, both side panels' buttons and whatever part of the plan was on screen.
// Now print media shows #bp-print-sheet, a canvas drawn on `beforeprint`.
//
// Reuses the schedule suite's Northwind fixture (floor 1 uses 16 of the
// grid's 20 columns, which is what the crop assertions lean on). Checks:
//   - on screen the sheet does not show
//   - in print, with the plan loaded: no header, tab bar, side panel or
//     button reaches the paper; the frame is not a clipped 100vh box; the
//     sheet names the school and the floor; the canvas holds a drawing, is
//     cropped to the building, keeps its shape and fits a landscape page
//   - the editor's own drawing context is put back
//   - an empty floor prints a sentence, not a blank canvas
//   - another tab still loses the header and the clip
//   - the Schedule Browser's print is not disturbed
//   - Chromium's own PDF of the page is one landscape page
//
// Nothing here has been checked against a printer.
//
// Exits 1 on any failure.

/* global applyFullProject, AppState, ctx, canvas, switchTab, toggleApp, resizeCanvas -- page globals read inside page.evaluate() */
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import { fixtureProject } from '../../schedule/test/fixture-northwind.mjs';

const PORT = 8465;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/035-schedule-visualizer.html';
// Letter with half-inch margins at CSS px: landscape, then portrait.
const WIDE = { width: 960, height: 720 };

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 900 });

await page.context().addInitScript(() => {
  try { localStorage.setItem('stviz_onboarded', '1'); } catch (e) { /* storage blocked */ }
});

console.log('School Layout Visualizer — the Blueprint tab on paper');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);
await page.evaluate(project => { applyFullProject(project); }, fixtureProject());
await settle(page, 300);

const shown = sel => page.evaluate(s => {
  const el = document.querySelector(s);
  if (!el || !el.getClientRects().length) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility === 'visible';
}, sel);
const toPrint = async () => {
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await settle(page, 100);
};
const toScreen = async () => {
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.emulateMedia({ media: null }); // not 'screen': that would hold for page.pdf() too
  await settle(page, 100);
};

/* ── 1. on screen ───────────────────────────────────────────────────────── */
eq(await shown('#bp-print-sheet'), false, 'the print sheet does not show on screen');
eq(await shown('#bp-sidebar'), true, 'the editor shows on screen');

/* ── 2. in print, with a plan ───────────────────────────────────────────── */
await page.setViewportSize(WIDE);
await toPrint();

for (const sel of ['#app-header', '#tab-bar', '#floor-manager-strip', '#bp-sidebar', '#bp-right-panel', '#bp-canvas', '#bp-status-bar']) {
  eq(await shown(sel), false, `${sel} stays off the paper`);
}
const controls = await page.evaluate(() => [...document.querySelectorAll('button, select, input, textarea')].filter(el => {
  if (!el.getClientRects().length) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility === 'visible';
}).map(el => el.id || el.className || el.tagName).slice(0, 6));
eq(controls.length, 0, 'no button or field is visible in print: ' + JSON.stringify(controls));

const frame = await page.evaluate(() => ['#app-visualizer', '#content-area', '#panel-blueprint'].map(s => {
  const el = document.querySelector(s), cs = getComputedStyle(el);
  return { s, overflowY: cs.overflowY, clipped: el.scrollHeight > el.clientHeight + 1 };
}));
for (const f of frame) {
  eq(f.overflowY, 'visible', `${f.s} does not clip in print`);
  eq(f.clipped, false, `${f.s} holds no more than it shows`);
}

eq(await shown('#bp-print-sheet'), true, 'the print sheet shows in print');
const sheet = await page.evaluate(() => {
  const c = document.getElementById('bp-print-canvas');
  const s = document.getElementById('bp-print-sheet');
  const r = c.getBoundingClientRect();
  const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const colours = new Set();
  for (let i = 0; i < data.length; i += 4 * 97) colours.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
  const floor = AppState.blueprint.floors[AppState.blueprint.activeFloorIdx];
  return {
    title: document.getElementById('bp-print-title').textContent,
    sub: document.getElementById('bp-print-sub').textContent,
    floorLabel: floor.label,
    school: AppState.settings.schoolName,
    cw: c.width, ch: c.height, bw: r.width, bh: r.height, bottom: r.bottom, right: r.right,
    colours: colours.size,
    wide: s.classList.contains('bp-print-wide'),
    none: s.classList.contains('bp-print-none'),
    cell: AppState.settings.gridSize, cols: AppState.blueprint.gridCols, rows: AppState.blueprint.gridRows,
    docW: document.documentElement.scrollWidth,
    liveCtx: ctx === canvas.getContext('2d'),
  };
});
eq(sheet.title, sheet.school, 'the sheet is titled with the school name');
eq(sheet.sub, sheet.floorLabel, 'and names the floor being printed');
ok(sheet.colours >= 4, `the canvas holds a drawing (${sheet.colours} colours sampled)`);
eq(sheet.none, false, 'a floor with rooms is not marked empty');
// Northwind floor 1: columns 0..15 and one margin cell → 17 of 20 columns.
eq(sheet.cw, Math.round(17 * sheet.cell * 2.5), 'the canvas is cropped to the building plus one cell (17 of 20 columns)');
ok(sheet.ch < sheet.rows * sheet.cell * 2.5, `and to its rows (${sheet.ch}px of ${sheet.rows * sheet.cell * 2.5}px)`);
eq(sheet.wide, true, 'a plan wider than tall asks for a landscape page');
ok(Math.abs(sheet.bw / sheet.bh - sheet.cw / sheet.ch) < 0.02, `the printed canvas keeps the plan's shape (${(sheet.bw / sheet.bh).toFixed(3)} vs ${(sheet.cw / sheet.ch).toFixed(3)})`);
ok(sheet.right <= WIDE.width + 1 && sheet.docW <= WIDE.width + 1, `the sheet is no wider than the page (${Math.round(sheet.right)}px of ${WIDE.width}px)`);
ok(sheet.bottom <= WIDE.height, `title and plan fit one landscape page (${Math.round(sheet.bottom)}px of ${WIDE.height}px)`);
ok(sheet.bw > WIDE.width * 0.8, `the plan fills the page width (${Math.round(sheet.bw)}px of ${WIDE.width}px)`);
eq(sheet.liveCtx, true, "the editor's drawing context is put back after the sheet is drawn");

await toScreen();
eq(await shown('#bp-print-sheet'), false, 'back on screen the sheet is gone');
eq(await shown('#bp-canvas'), true, 'and the editor canvas is back');

/* ── 3. Chromium's own PDF: one landscape page ──────────────────────────── */
// printToPDF runs the real print path (page rules, named pages, pagination),
// which the measurements above only approximate with a viewport.
const pdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
const pdfPages = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
const box = /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(pdf);
eq(pdfPages, 1, 'the plan prints on one page');
ok(box && +box[3] > +box[4], `and that page is landscape (${box ? box[3] + ' x ' + box[4] : 'no MediaBox'})`);

/* ── 4. another tab ─────────────────────────────────────────────────────── */
await page.evaluate(() => switchTab('schedules'));
await toPrint();
eq(await shown('#app-header'), false, 'on the Schedules tab the header stays off the paper too');
eq(await shown('#tab-bar'), false, 'and the tab bar');
eq(await shown('#bp-print-sheet'), false, 'the plan sheet belongs to the Blueprint tab only');
eq(await page.evaluate(() => getComputedStyle(document.getElementById('panel-schedules')).overflowY), 'visible', 'the Schedules panel is not a scroll box in print');
await toScreen();
await page.evaluate(() => switchTab('blueprint'));

/* ── 5. the Schedule Browser's print is its own ─────────────────────────── */
await page.evaluate(() => toggleApp());
await toPrint();
eq(await shown('#app-visualizer'), false, 'with the Schedule Browser open the visualizer stays hidden in print');
eq(await shown('#app-browser'), true, 'and the Schedule Browser prints');
await toScreen();
await page.evaluate(() => toggleApp());

/* ── 6. an empty floor ──────────────────────────────────────────────────── */
await page.evaluate(() => resizeCanvas(AppState.blueprint.gridCols, AppState.blueprint.gridRows, true));
await settle(page, 200);
await toPrint();
eq(await page.evaluate(() => document.getElementById('bp-print-sheet').classList.contains('bp-print-none')), true, 'a floor with nothing drawn is marked empty');
eq(await shown('#bp-print-canvas'), false, 'no blank canvas is printed for it');
eq(await shown('#bp-print-empty'), true, 'the sheet says nothing is drawn yet');
eq(await shown('#bp-print-title'), true, 'under the same title');
await toScreen();

eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
