// smoke-calibration.mjs — the graph paper tool's printer calibration page.
//
//   node Tools/graph-paper-generator/test/smoke-calibration.mjs
//
// Every page this tool produces is drawn in real inches, and that only survives
// if the printer prints at 100%. "Fit to page", a driver default, or a copier
// reduction quietly shrinks it, and a 1/4in grid that is really 0.238in ruins
// any measuring task done on it. The calibration page is the check.
//
// A test page that is itself wrong would be worse than none, so most of this
// suite is geometry, asserted against the SVG the renderer produces: the ruler
// really is N inches long in a coordinate system where 1 unit = 1 inch, the
// centimetre ruler is exactly 2.54 units per 10 marks, and the squares are
// exactly 1in and 5cm. The renderer is DOM-free, so that part runs in plain
// Node with no browser at all.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const near = (a, b, tol, label) => ok(Math.abs(a - b) <= tol, `${label} (got ${a}, want ~${b})`);

console.log('Graph Paper — printer calibration page');

/* ── 1. the geometry, in plain Node ────────────────────────────────────── */
const here = path.dirname(fileURLToPath(import.meta.url));
const renderSrc = readFileSync(path.join(here, '..', 'gpg-render.js'), 'utf8');
const sandbox = {};
new Function('global', renderSrc + '\n;return global;')(sandbox);
const R = sandbox.GraphPaperRender;
ok(typeof R.renderCalibration === 'function', 'the renderer exposes renderCalibration');

const out = R.renderCalibration({ orientation: 'portrait' });
const svg = out.svg;

// The whole scheme rests on this: the SVG is sized in inches and the viewBox
// uses the same numbers, so one user unit is one inch.
ok(/width="8.5in" height="11in"/.test(svg), 'the page is 8.5x11 inches');
ok(/viewBox="0 0 8.5 11"/.test(svg), 'and the viewBox matches, so 1 unit = 1 inch');

eq(out.inchUnits, 6, 'the inch ruler is 6 inches long');
eq(out.cmUnits, 15, 'the centimetre ruler is 15 cm long');

const lines = [...svg.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"[^>]*stroke-width="([\d.]+)"/g)]
  .map(m => ({ x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4], w: +m[5] }));
const horizontals = lines.filter(l => Math.abs(l.y1 - l.y2) < 1e-9);
ok(horizontals.length >= 2, 'both rulers have a baseline');
near(horizontals[0].x2 - horizontals[0].x1, 6, 0.0001, 'the inch ruler baseline spans exactly 6 units');
near(horizontals[1].x2 - horizontals[1].x1, 15 / 2.54, 0.0001, 'the cm ruler baseline spans exactly 15/2.54 units');

// Tick spacing is the real assertion: an inch tick every 1.0 units, a cm tick
// every 0.3937... units. 2.54 is exact by definition, not an approximation.
const ticksOn = (baseline) => lines
  .filter(l => Math.abs(l.x1 - l.x2) < 1e-9 && Math.abs(l.y2 - baseline.y1) < 1e-6)
  .map(l => ({ x: l.x1, len: l.y2 - l.y1 }))
  .sort((a, b) => a.x - b.x);

const inchTicks = ticksOn(horizontals[0]);
eq(inchTicks.length, 6 * 8 + 1, 'the inch ruler has eighth-inch ticks (48 + 1)');
const inchMajors = inchTicks.filter(t => t.len > 0.3);
eq(inchMajors.length, 7, 'seven full-inch ticks, 0 through 6');
for (let i = 1; i < inchMajors.length; i++) {
  near(inchMajors[i].x - inchMajors[i - 1].x, 1, 0.0001, `inch ${i} is exactly one unit from inch ${i - 1}`);
}

const cmTicks = ticksOn(horizontals[1]);
eq(cmTicks.length, 15 * 10 + 1, 'the cm ruler has millimetre ticks (150 + 1)');
const cmMajors = cmTicks.filter(t => t.len > 0.3);
eq(cmMajors.length, 16, 'sixteen centimetre ticks, 0 through 15');
near(cmMajors[10].x - cmMajors[0].x, 10 / 2.54, 0.0001, '10 cm is exactly 10/2.54 inches — the two rulers agree');

const rects = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)]
  .map(m => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] }));
eq(rects.length, 2, 'two measuring squares');
near(rects[0].w, 1, 0.0001, 'the first square is exactly 1 inch wide');
near(rects[0].h, 1, 0.0001, 'and 1 inch tall');
near(rects[1].w, 5 / 2.54, 0.0001, 'the second is exactly 5 cm wide');
near(rects[1].h, 5 / 2.54, 0.0001, 'and 5 cm tall');

// Everything has to stay on the paper, or the ruler a teacher measures is a
// ruler the printer already clipped.
const maxX = Math.max(
  ...lines.map(l => Math.max(l.x1, l.x2)),
  ...rects.map(r => r.x + r.w));
ok(maxX <= 8.5, `nothing is drawn past the right edge of the page (max ${maxX.toFixed(2)}in)`);

// Landscape still works, and gets a longer ruler cap only if the page allows.
const land = R.renderCalibration({ orientation: 'landscape' });
ok(/width="11in" height="8.5in"/.test(land.svg), 'landscape swaps the page dimensions');
eq(land.inchUnits, 6, 'the inch ruler is still 6 inches — the check does not change with the page');

/* ── 2. it is reachable and prints, in the real tool ───────────────────── */
const PORT = 8197;
const BASE = `http://127.0.0.1:${PORT}`;
const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1300, height: 1100 });
await page.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
await page.goto(`${BASE}/Tools/012-graph-paper-generator.html`, { waitUntil: 'networkidle' });
await settle(page, 500);

ok(await page.isVisible('.mode-tab[data-mode="calibration"]'), 'the Printer check tab is there');
await page.click('.mode-tab[data-mode="calibration"]');
await settle(page, 400);
ok(await page.isVisible('#panel-calibration'), 'its panel opens');

const previewText = await page.textContent('#previewArea');
ok(/Printer calibration test page/.test(previewText), 'the preview shows the calibration page');
ok(/100% scale/.test(previewText), 'telling the teacher to print at 100%');
ok(/Measured: ________ inches instead of 6/.test(previewText), 'with the arithmetic for when it is wrong');

const svgAttrs = await page.$eval('#previewArea svg', el => ({
  w: el.getAttribute('width'), h: el.getAttribute('height'), vb: el.getAttribute('viewBox'),
}));
eq(svgAttrs.w, '8.5in', 'the rendered SVG is inch-sized on the page too');
eq(svgAttrs.vb, '0 0 8.5 11', 'with a matching viewBox');

await page.click('#printBtn');
await settle(page, 250);
ok(await page.evaluate(() => window.__printed > 0), 'it prints through the tool\'s normal print button');

// Switching away and back leaves the other modes alone.
await page.click('.mode-tab[data-mode="graph"]');
await settle(page, 400);
ok(!/calibration test page/.test(await page.textContent('#previewArea')), 'switching back to graph paper drops it');
ok(await page.$('#previewArea svg') !== null, 'and graph paper still renders');

// The mode persists like every other one.
await page.click('.mode-tab[data-mode="calibration"]');
await settle(page, 400);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);
ok(/Printer calibration test page/.test(await page.textContent('#previewArea')),
   'the chosen mode survives a reload, like the others');

eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
