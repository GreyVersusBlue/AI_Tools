// smoke-scenario-chart.mjs — the before/after charts in the Final Grade Checker's Scenarios card.
//
//   node Tools/final-grade-checker/test/smoke-scenario-chart.mjs
//
// scenario-math.test.mjs holds distributions() (what is counted) against hand-worked cases. This is
// the half that needs a page: the charts appear only with a scenario on, count the same students
// the table does, are labelled for a screen reader, carry no name, and download as the SVG shown.
// Every name is invented. Exits 1 on any failure.

import { serve, launch, prepPage, settle, downloadText, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8580;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/036-final_grade_checker.html';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 1600 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));

const PASTE = [
  '10001\tLovelace, Ada\t03\t07\tA(95.00)\tA(95.00)\tA(95.00)\tA(95.00)\t95.00',
  '10002\tPolo, Marco\t03\t07\tB(85.00)\tB(85.00)\tB(85.00)\tB(85.00)\t85.00',
  '10003\tHopper, Grace\t03\t07\tC(75.00)\tC(75.00)\tC(75.00)\tC(75.00)\t75.00',
  '10004\tHe, Zheng\t03\t07\tF(46.00)\tF(46.00)\tF(46.00)\tF(46.00)\t46.00',
  '10005\tBly, Nellie\t03\t07\tB(88.00)\tB(85.00)\tB(84.00)\t\t',
].join('\n');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await page.fill('#import-area', PASTE);
await page.click('#import-btn');
await settle(page, 300);

console.log('Final Grade Checker — scenario charts');
eq(await page.isVisible('#sc-charts'), false, 'no charts while no scenario is on');

await page.selectOption('#sc-curve-mode', 'plus');
await page.fill('#sc-points', '5');
await page.dispatchEvent('#sc-points', 'input');
await settle(page, 300);
eq(await page.isVisible('#sc-charts'), true, 'charts appear with a scenario');

const svgs = await page.$$eval('#sc-charts svg', els => els.map(s => ({
  role: s.getAttribute('role'),
  title: s.querySelector('title').textContent,
  desc: s.querySelector('desc').textContent,
  labelled: s.getAttribute('aria-labelledby'),
  text: s.textContent,
})));
eq(svgs.length, 2, 'two charts');
eq(svgs.map(s => s.role), ['img', 'img'], 'each is an image for a screen reader');
ok(svgs.every(s => s.labelled && s.title && s.desc), 'each has a title and a description');
ok(svgs[0].title.includes('4 students'), 'the title says how many students are counted (the one without a final is not): ' + svgs[0].title);
ok(/Real grades/.test(svgs[0].desc) && /With the scenario/.test(svgs[0].desc), 'the description names both series');
// 95 -> A, 85 -> B, 75 -> C, 46 -> F ; +5: 100 A, 90 A, 80 B, 51 F
ok(svgs[0].desc.includes('Real grades: A 1, B 1, C 1, D 0, F 1') && svgs[0].desc.includes('With the scenario: A 2, B 1, C 0, D 0, F 1'), 'letters before and after as worked by hand: ' + svgs[0].desc);
ok(!/Lovelace|Polo|Hopper|He, Zheng|Bly/.test(svgs.map(s => s.text + s.desc).join(' ')), 'no student name is in either chart');
eq(await page.isVisible('#sc-scroll'), true, 'the table is still there beside them');

// the same letters the page's own summary line states
const summary = await page.$eval('#sc-summary', e => e.textContent);
ok(summary.includes('Letters before: A 1, B 1, C 1, D 0, F 1, no final 1. After: A 2, B 1, C 0, D 0, F 1, no final 1.'), 'the summary and the chart agree: ' + summary);

// a download is the SVG on the page
const dl = { text: await downloadText(page, '[data-sc-dl="letters-svg"]', { what: 'the letters chart' }) };
ok(dl.text.startsWith('<svg') && dl.text.includes('role="img"'), 'Download SVG gives the drawn chart');
ok(dl.text.length > 500, 'and it is not empty');

// turning the scenario off removes them
await page.selectOption('#sc-curve-mode', 'none');
await settle(page, 200);
eq(await page.isVisible('#sc-charts'), false, 'back to no scenario, no charts');

// accessibility with the charts showing
await page.selectOption('#sc-curve-mode', 'plus');
await page.fill('#sc-points', '5');
await page.dispatchEvent('#sc-points', 'input');
await settle(page, 300);
const bad = await a11yScan(page, { impact: 'serious', include: '#sc-charts' });
eq(bad.map(v => v.id), [], 'no serious or critical axe violation inside the charts');

eq(errors, [], 'no page errors');
await browser.close();
server.close && server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
