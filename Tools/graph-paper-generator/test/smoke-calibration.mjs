// smoke-calibration.mjs — the graph paper tool's printer scale check page.
//
//   node Tools/graph-paper-generator/test/smoke-calibration.mjs
//
// Everything this tool prints is true to size *if the printer prints at
// 100%*, and that "if" carries a lot of weight: most print dialogs default to
// "Fit to page", which shrinks the sheet by a few percent. Quarter-inch graph
// paper that is 3% small looks completely normal and is wrong all year.
//
// So this page has one job, and the assertions are about geometry rather than
// appearance: the inch marked 6 has to sit exactly six inches from the origin
// in the SVG's own inch coordinates, or the test page is lying too. The
// second half is that the page is FIXED — it deliberately ignores
// orientation, headers and every other panel's settings, because a scale
// check that varies isn't a check.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8203;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/012-graph-paper-generator.html';
const CM_PER_INCH = 2.54;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const near = (a, b, tol, label) => ok(Math.abs(a - b) <= tol, `${label} (got ${a}, want ${b} ±${tol})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });

/** The x position of each numbered label on a scale, keyed by its number —
 *  read out of the rendered SVG in the inch-based user units the whole file
 *  is drawn in. */
const scaleLabels = (p, afterText) => p.evaluate((marker) => {
  const svg = document.querySelector('#previewArea svg');
  const texts = [...svg.querySelectorAll('text')];
  const start = texts.findIndex(t => t.textContent === marker);
  const out = {};
  for (let i = start + 1; i < texts.length; i++) {
    const label = texts[i].textContent;
    if (!/^\d+$/.test(label)) break;
    out[label] = parseFloat(texts[i].getAttribute('x'));
  }
  return out;
}, afterText);

console.log('Graph Paper Generator — printer scale check');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 700);

/* ── 1. the mode exists and renders ────────────────────────────────────── */
await page.click('[data-mode="calibration"]');
await settle(page, 500);
eq(await page.isVisible('#panel-calibration'), true, 'the Printer check panel opens');
const root = await page.evaluate(() => {
  const svg = document.querySelector('#previewArea svg');
  return { w: svg.getAttribute('width'), h: svg.getAttribute('height'), viewBox: svg.getAttribute('viewBox') };
});
eq(root.w, '8.5in', 'the page is a real 8.5in wide');
eq(root.h, '11in', 'and 11in tall');
eq(root.viewBox, '0 0 8.5 11', 'with a viewBox in the same numbers, so one user unit is one inch');

/* ── 2. an inch on the page is an inch ─────────────────────────────────── */
const inches = await scaleLabels(page, 'INCHES');
const inchNumbers = Object.keys(inches).map(Number).sort((a, b) => a - b);
ok(inchNumbers.length >= 7, `the inch scale runs to at least 6 (${inchNumbers.join(',')})`);
const inchOrigin = inches['0'];
for (const n of inchNumbers) {
  near(inches[String(n)] - inchOrigin, n, 0.0005, `the "${n}" mark sits exactly ${n}in from zero`);
}

/* ── 3. and a centimetre is a centimetre ───────────────────────────────── */
const cms = await scaleLabels(page, 'CENTIMETRES');
const cmNumbers = Object.keys(cms).map(Number).sort((a, b) => a - b);
ok(cmNumbers.length >= 15, `the metric scale runs to at least 14 (${cmNumbers.length} marks)`);
const cmOrigin = cms['0'];
for (const n of [1, 5, 10, cmNumbers[cmNumbers.length - 1]]) {
  near(cms[String(n)] - cmOrigin, n / CM_PER_INCH, 0.0005,
    `the "${n} cm" mark sits exactly ${n}cm from zero, in inches`);
}
// The two scales must be the same physical ruler measured two ways.
near((cms[String(cmNumbers[cmNumbers.length - 1])] - cmOrigin) * CM_PER_INCH,
     cmNumbers[cmNumbers.length - 1], 0.001, 'the two scales agree with each other');

/* ── 4. the no-scale-needed reference blocks ───────────────────────────── */
const refs = await page.evaluate(() => {
  const svg = document.querySelector('#previewArea svg');
  const rect = svg.querySelector('rect');
  const texts = [...svg.querySelectorAll('text')].map(t => t.textContent);
  return {
    box: rect ? { w: parseFloat(rect.getAttribute('width')), h: parseFloat(rect.getAttribute('height')) } : null,
    labels: texts.filter(t => /exactly/.test(t)),
  };
});
eq(refs.box.w, 1, 'there is a square exactly one inch wide');
eq(refs.box.h, 1, 'and one inch tall');
ok(refs.labels.some(l => /1 inch square/.test(l)), 'labelled as such: ' + JSON.stringify(refs.labels));
ok(refs.labels.some(l => /10 cm/.test(l)), 'plus a 10cm bar for anyone reaching for a metric ruler');

/* ── 5. it says what it is for, and gives somewhere to record the answer ─ */
const words = await page.evaluate(() =>
  [...document.querySelectorAll('#previewArea svg text')].map(t => t.textContent).join(' '));
ok(/100%/.test(words), 'the page names the setting to use');
ok(/Fit to page/.test(words), 'and the one that breaks it');
ok(/Printer/.test(words) && /Setting that worked/.test(words),
   'with lines to write down which printer and which setting');
ok(/Tape this to the printer/.test(words), 'and a nudge to do this once rather than every year');

/* ── 6. the page is fixed — other settings must not reach it ───────────── */
const before = await page.evaluate(() => document.querySelector('#previewArea').innerHTML);

await page.evaluate(() => {
  const el = document.getElementById('orientation');
  if (el) { el.value = 'landscape'; el.dispatchEvent(new Event('change', { bubbles: true })); }
});
await settle(page, 400);
eq(await page.evaluate(() => document.querySelector('#previewArea svg').getAttribute('width')), '8.5in',
   'switching to landscape does not turn the ruler page sideways');

await page.evaluate(() => {
  const cb = document.getElementById('headerOn');
  if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
  const t = document.getElementById('headerTitle');
  if (t) { t.value = 'UNIT 4 WARMUP'; t.dispatchEvent(new Event('input', { bubbles: true })); }
});
await settle(page, 400);
ok(!/UNIT 4 WARMUP/.test(await page.evaluate(() => document.querySelector('#previewArea').textContent)),
   'and a header set for the other modes does not land on the test page');
eq(await page.evaluate(() => document.querySelector('#previewArea').innerHTML), before,
   'the rendered page is byte-identical whatever the other panels say');

/* ── 7. the other modes still work ─────────────────────────────────────── */
for (const mode of ['graph', 'numberline', 'plane', 'cornell', 'handwriting']) {
  await page.click(`[data-mode="${mode}"]`);
  await settle(page, 400);
  ok(await page.evaluate(() => !!document.querySelector('#previewArea svg')), `the ${mode} mode still renders`);
}
await page.click('[data-mode="calibration"]');
await settle(page, 400);

/* the choice survives a reload, like every other mode */
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 700);
eq(await page.evaluate(() => (document.querySelector('.mode-tab.active') || {}).dataset?.mode), 'calibration',
   'and the tool reopens on the mode it was left in');

/* ── 8. no console noise ───────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
