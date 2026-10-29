// smoke-science.mjs — Data Chart Builder for science (Path 16 P5), on the running page.
//
//   node Tools/data-chart-builder/test/smoke-science.mjs   (npm run test:chart-builder-science, port 8582)
//
// Step 1, regression: with the trendline on, the Fit select picks linear, power, exponential,
// logarithmic or quadratic; the curve, its equation and R² are on the chart, in its <desc> and in the
// note under the select; linear (the default) is the same dashed straight line as before and draws no
// curve; a share link written without a model opens as linear and one with a model opens with it.
// Step 2, log axes: the two checkboxes put the axis in powers of ten (decade labels, a <desc> that says so),
// a zero or negative value is left out and counted on the page and in the <desc>, and the choice travels in a share link.
// Step 3, more series: with a third numeric column the "More Y columns" group offers it (labelled), ticking it draws two series with
// their own marker shapes and a legend, each fitted on its own, and the columns travel in a share link.
// Step 4, annotations: a card on the scatter only; a region, an arrow and a callout are added from numbers, drawn on the chart and
// named in its <desc>; a bad entry says what is wrong and adds nothing; Remove takes one off; they travel in a share link, and a
// link whose note text is markup draws it as text.
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

console.log('step 2 (log axes)');
await setup();
await page.fill('#data-input', 'Dose\tResponse\n0\t1\n1\t3\n10\t30\n100\t310\n1000\t2900\n');
await page.dispatchEvent('#data-input', 'input');
await settle(page, 600);
eq(await page.evaluate(() => document.getElementById('x-log').checked || document.getElementById('y-log').checked), false, 'log axes are off by default');
const linearHtml = (await svg()).html;
await page.check('#x-log');
await settle(page, 400);
s = await svg();
ok(/The horizontal axis is logarithmic/.test(s.desc) && !/vertical axis is logarithmic/.test(s.desc), 'x log: the desc says which axis: ' + s.desc);
ok(/1 point with a zero or negative value is not plotted\./.test(s.desc), 'x log: the zero is counted in the desc');
ok(/1 point has a zero or negative value and is not plotted on a logarithmic axis\./.test(await page.textContent('#log-note')), 'x log: and on the page: ' + await page.textContent('#log-note'));
ok(s.html !== linearHtml && (s.html.match(/<circle /g) || []).length === 4, 'x log: four points drawn, not five');
await page.check('#y-log');
await page.check('#show-trendline');
await pick('power');
s = await svg();
ok(/Both axes are logarithmic/.test(s.desc) && s.poly >= 1, 'both log with a power fit: described and a curve drawn');
ok(/>10<\/text>/.test(s.html) && />1k<\/text>/.test(s.html), 'decade labels are on the chart');
await page.uncheck('#x-log'); await page.uncheck('#y-log');
await settle(page, 400);
eq(await page.textContent('#log-note'), '', 'the log note goes with the log axes');
ok(!/logarithmic/.test((await svg()).desc), 'and so does the log wording');
await open({ ...base, xLog: true, yLog: true });
eq(await page.evaluate(() => [document.getElementById('x-log').checked, document.getElementById('y-log').checked].join()), 'true,true', 'a link with both log axes opens with them');
await open(base);
eq(await page.evaluate(() => [document.getElementById('x-log').checked, document.getElementById('y-log').checked].join()), 'false,false', 'a link from before opens linear');
await open({ ...base, xLog: 'yes' });
eq(await page.evaluate(() => document.getElementById('x-log').checked), false, 'a log flag that is not true is ignored');

console.log('step 3 (more series)');
await setup();
eq(await page.evaluate(() => getComputedStyle(document.getElementById('scatter-extra-group')).display), 'none', 'two numeric columns: no extra-Y group');
const T3 = 'Time\tMass\tVolume\tHeat\n1\t2\t4\t1\n2\t4.2\t7\t4\n3\t5.9\t10\t9\n4\t8.1\t13\t16\n5\t10\t16\t25\n';
await page.fill('#data-input', T3);
await page.dispatchEvent('#data-input', 'input');
await settle(page, 600);
eq(await page.evaluate(() => getComputedStyle(document.getElementById('scatter-extra-group')).display), 'block', 'four numeric columns: the group shows');
eq(await page.evaluate(() => Array.from(document.querySelectorAll('#scatter-extra-list label')).map(l => l.textContent).join()), 'Volume,Heat', 'it offers the two columns that are neither X nor Y');
eq(await page.evaluate(() => Array.from(document.querySelectorAll('#scatter-extra-list input')).every(i => document.querySelector('label[for="' + i.id + '"]'))), true, 'each box is labelled');
await page.check('#scatter-extra-3');
await settle(page, 400);
s = await svg();
ok(/Scatter plot of 2 series against Time, 10 points: Mass \(5\), Heat \(5\)\./.test(s.desc), 'two series described: ' + s.desc);
ok(s.html.includes('>Mass<') && s.html.includes('>Heat<') && (s.html.match(/<rect /g) || []).length > 1, 'legend with both names and a square marker');
await page.check('#show-trendline');
await pick('power');
s = await svg();
ok(/Mass: Power fit/.test(s.desc) && /Heat: Power fit/.test(s.desc) && (s.html.match(/<polyline /g) || []).length === 2, 'a power fit each: ' + s.desc);
ok(/Mass: y = /.test(await page.textContent('#fit-note')) && /Heat: y = /.test(await page.textContent('#fit-note')), 'the note lists both fits: ' + await page.textContent('#fit-note'));
await page.selectOption('#scatter-x-col', '2');
await settle(page, 400);
eq(await page.evaluate(() => Array.from(document.querySelectorAll('#scatter-extra-list label')).map(l => l.textContent).join()), 'Time,Heat', 'changing X rebuilds the list (the ticked Heat stays ticked)');
eq(await page.evaluate(() => document.querySelector('#scatter-extra-list input:checked').nextElementSibling.textContent), 'Heat', 'and keeps the tick');
await open({ data: T3, hasHeaders: true, chartType: 'scatter', scatterX: 0, scatterY: 1, scatterYs: [3, 3, 0, 1, 99], trendline: false });
eq(await page.evaluate(() => Array.from(document.querySelectorAll('#scatter-extra-list input:checked')).map(i => i.value).join()), '3', 'a link opens with its extra column once; the X, the Y and a column that is not there are dropped');
await open({ ...base, data: T3 });
eq(await page.evaluate(() => document.querySelectorAll('#scatter-extra-list input:checked').length), 0, 'a link from before has no extra series');
eq((await svg()).html.includes('Scatter plot of'), true, 'and draws as a single series');

console.log('step 4 (annotations)');
await setup();
eq(await page.evaluate(() => getComputedStyle(document.getElementById('notes-card')).display), 'block', 'the annotation card shows for a scatter');
await page.evaluate(() => { const r = document.querySelector('input[name="chart-type"][value="bar"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); });
eq(await page.evaluate(() => getComputedStyle(document.getElementById('notes-card')).display), 'none', 'and hides for a bar chart');
await page.evaluate(() => { const r = document.querySelector('input[name="chart-type"][value="scatter"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); });
await settle(page, 300);
const addNote = async (type, vals, text) => {
  await page.selectOption('#note-type', type);
  for (const [k, v] of Object.entries(vals)) await page.fill('#note-' + k, String(v));
  await page.fill('#note-text', text || '');
  await page.click('#note-add');
  await settle(page, 400);
};
await addNote('callout', { a: 4, b: 48 }, 'Turning point');
s = await svg();
ok(/r="7"/.test(s.html) && s.html.includes('>Turning point<') && /Callout at 4, 48: Turning point\./.test(s.desc), 'a callout is drawn and in the desc: ' + s.desc);
ok(/Added\. 1 note on the chart\./.test(await page.textContent('#notes-msg')), 'the form says what happened');
eq(await page.inputValue('#note-text'), '', 'and clears');
await addNote('callout', { a: 4, b: 48 }, '');
ok(/needs both numbers and some text/.test(await page.textContent('#notes-msg')), 'a callout without text is refused: ' + await page.textContent('#notes-msg'));
await addNote('region', { a: 2, b: 3 }, 'Fast part');
await addNote('region', { a: 2, b: 3, c: 5 }, '');
ok(/both Y values/.test(await page.textContent('#notes-msg')), 'half a band is refused');
await addNote('arrow', { a: 1, b: 20, c: 3, d: 31 }, 'Check this');
s = await svg();
ok(/Shaded region across 2 to 3: Fast part\./.test(s.desc) && /Arrow from 1, 20 to 3, 31: Check this\./.test(s.desc), 'region and arrow are in the desc: ' + s.desc);
ok(/<pattern id="cs-nr"/.test(s.html) && /stroke-width="1.6"/.test(s.html), 'region hatch and arrow drawn');
eq(await page.evaluate(() => document.querySelectorAll('#notes-list li').length), 3, 'three notes are listed');
eq(await page.evaluate(() => document.querySelector('#notes-list button').getAttribute('aria-label')), 'Remove note: Callout at 4, 48: Turning point', 'a Remove button says which note');
await page.click('#notes-list li:first-child button');
await settle(page, 400);
eq(await page.evaluate(() => document.querySelectorAll('#notes-list li').length), 2, 'Remove takes one off');
ok(!/r="7"/.test((await svg()).html), 'and off the chart');
await page.selectOption('#note-type', 'callout'); await page.fill('#note-a', '500'); await page.fill('#note-b', '5'); await page.fill('#note-text', 'far away'); await page.click('#note-add');
await settle(page, 400);
ok(/1 note outside the plot is not drawn\./.test((await svg()).desc), 'a note off the plot is counted, not drawn');
// share round trip
const withNotes = { ...base, trendline: false, notes: [{ type: 'callout', x: 3, y: 15, text: '<img src=x onerror=window.__pwned=1>' }, { type: 'bogus' }, { type: 'callout', x: 'a', y: 1, text: 'x' }] };
await open(withNotes);
eq(await page.evaluate(() => document.querySelectorAll('#notes-list li').length), 1, 'a link opens with its valid notes only');
ok(await page.evaluate(() => !document.querySelector('#chart-stage img, #notes-list img') && !window.__pwned && document.querySelector('#chart-stage svg').textContent.includes('<img src=x')), 'note text from a link is text, not markup');
await open(base);
eq(await page.evaluate(() => document.querySelectorAll('#notes-list li').length), 0, 'a link from before has no notes');

const scan = await a11yScan(page, { impact: 'serious' });
ok(!scan.length, 'axe: no serious violation with the Fit select showing: ' + JSON.stringify(scan.map(v => [v.id, v.nodes])));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
