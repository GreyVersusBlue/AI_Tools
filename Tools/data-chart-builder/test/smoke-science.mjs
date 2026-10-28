// smoke-science.mjs — Data Chart Builder for science (Path 16 P5), on the running page.
//
//   node Tools/data-chart-builder/test/smoke-science.mjs   (npm run test:chart-builder-science, port 8582)
//
// Step 1, regression: with the trendline on, the Fit select picks linear, power, exponential,
// logarithmic or quadratic; the curve, its equation and R² are on the chart, in its <desc> and in the
// note under the select; linear (the default) is the same dashed straight line as before and draws no
// curve; a share link written without a model opens as linear and one with a model opens with it.
// axe finds nothing serious with the select showing. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8582;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/038-data-chart-builder.html';

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

// y = 3·x^1.5, exactly (rounded to 4 places)
const DATA = 'Length (m)\tPeriod (s)\n' + [1, 2, 3, 4, 5, 6, 8].map(x => x + '\t' + (3 * Math.pow(x, 1.5)).toFixed(4)).join('\n') + '\n';

async function setup() {
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 300);
  await page.fill('#data-input', DATA);
  await page.dispatchEvent('#data-input', 'input');
  await settle(page, 600);
  await page.evaluate(() => {
    const r = document.querySelector('input[name="chart-type"][value="scatter"]');
    r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle(page, 300);
}
const svg = () => page.evaluate(() => {
  const s = document.querySelector('#chart-stage svg');
  return s ? { html: s.outerHTML, desc: s.querySelector(':scope > desc').textContent, poly: s.querySelectorAll('polyline').length, line: s.querySelectorAll('line[stroke-dasharray="5,4"]').length } : null;
});
const pick = async model => { await page.selectOption('#trend-model', model); await settle(page, 400); };

console.log('Data Chart Builder — science, step 1 (regression)');
await setup();
eq(await page.evaluate(() => getComputedStyle(document.getElementById('trend-model-group')).display), 'none', 'the Fit select is hidden while the trendline is off');
await page.check('#show-trendline');
await settle(page, 400);
eq(await page.evaluate(() => getComputedStyle(document.getElementById('trend-model-group')).display), 'block', 'the Fit select shows with the trendline on');
let s = await svg();
eq(s.line, 1, 'linear: the same dashed straight line as before');
eq(s.poly, 0, 'linear: no curve');
ok(/Trend line y = /.test(s.desc), 'linear: the desc still says "Trend line y = …"');

await pick('power');
s = await svg();
ok(s.poly >= 1 && s.line === 0, 'power: a curve and no straight line');
ok(/y = 3·x\^1\.5/.test(s.html) && /R² = 1\)/.test(s.html), 'power: the equation and R² are on the chart');
ok(/Power fit y = 3·x\^1\.5, R squared 1/.test(s.desc), 'power: the desc carries the fit: ' + s.desc);
const note = await page.textContent('#fit-note');
ok(/least squares on the logs of x and y/.test(note) && /R² is measured on the original values/.test(note), 'power: the note says how: ' + note);
ok(/^Scatter plot|updated/.test(await page.textContent('#chart-announce')) && /Power fit/.test(await page.textContent('#chart-announce')), 'power: the redraw is announced with the fit');

for (const m of ['exponential', 'logarithmic', 'quadratic']) {
  await pick(m);
  s = await svg();
  ok(s && s.poly >= 1 && new RegExp(m[0].toUpperCase() + m.slice(1) + ' fit').test(s.desc), m + ': drawn and described');
}
// a fit that cannot be made says so instead of drawing nothing silently
await page.fill('#data-input', 'x\ty\n-1\t2\n-2\t3\n');
await page.dispatchEvent('#data-input', 'input');
await settle(page, 600);
await pick('power');
ok(/Not enough usable points for a power fit/.test(await page.textContent('#fit-note')), 'no usable point: the note says so: ' + await page.textContent('#fit-note'));

// zero y and negative x are counted, not fitted
await page.fill('#data-input', 'x\ty\n0\t0\n1\t2\n2\t8\n3\t18\n4\t32\n');
await page.dispatchEvent('#data-input', 'input');
await settle(page, 600);
await pick('power');
ok(/1 point left out \(x is not above 0\)/.test(await page.textContent('#fit-note')), 'a zero is left out and counted: ' + await page.textContent('#fit-note'));

// share round trip: the model travels, and a link with none opens as linear
await setup();
await page.check('#show-trendline');
await pick('exponential');
const link = await page.evaluate(() => {
  const st = { data: document.getElementById('data-input').value, hasHeaders: true, chartType: 'scatter', scatterX: 0, scatterY: 1, trendline: true, trendModel: 'exponential' };
  return StateLink.encodeState(st);
});
ok(link, "StateLink.encodeState writes a link");
const open = async st => {
  await page.goto(URL_PAGE + '?chart=' + encodeURIComponent(await page.evaluate(x => StateLink.encodeState(x), st)), { waitUntil: 'networkidle' });
  await settle(page, 600);
};
const base = { data: DATA, hasHeaders: true, chartType: 'scatter', scatterX: 0, scatterY: 1, trendline: true };
await open({ ...base, trendModel: 'exponential' });
eq(await page.inputValue('#trend-model'), 'exponential', 'a link with a model opens with it');
await open(base);
eq(await page.inputValue('#trend-model'), 'linear', 'a link from before this step opens as linear');
await open({ ...base, trendModel: 'bogus' });
eq(await page.inputValue('#trend-model'), 'linear', 'a link with a model this page does not know opens as linear');

const scan = await a11yScan(page, { impact: 'serious' });
ok(!scan.length, 'axe: no serious violation with the Fit select showing: ' + JSON.stringify(scan.map(v => [v.id, v.nodes])));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
