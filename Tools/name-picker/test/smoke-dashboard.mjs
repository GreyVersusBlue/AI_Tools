// smoke-dashboard.mjs — Name Picker: the equity dashboard on the Equity tab and its one printed page (Path 15 P3).
//
//   node Tools/name-picker/test/smoke-dashboard.mjs
//
// A fixed clock (Friday 23 Oct 2026), two saved rosters, dated history plus a per-day rollup. The card shows a chart, the
// quiet list and the student-by-week table; the period and week pickers change them; Preview shows one page and Chromium's PDF
// agrees, even for a roster longer than a page holds; nothing new is stored; the Data buttons are the existing ones.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8607;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else { failed++; console.log(`  FAIL ${l}\n    got  ${JSON.stringify(a)}\n    want ${JSON.stringify(b)}`); } };

const P1 = ['Ada', 'Bo', 'Cy', 'Di'];
const P2 = ['Cy', 'Ed', 'Fay <i>x</i>'];
const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
await page.clock.setFixedTime(new Date('2026-10-23T12:00:00'));
await page.addInitScript(({ P1, P2 }) => {
  if (localStorage.getItem('seeded')) return;
  localStorage.setItem('seeded', '1');
  localStorage.setItem('np_rosters', JSON.stringify({ 'Period 1': P1, 'Period 2': P2 }));
  localStorage.setItem('np_current', JSON.stringify(P1));
  const h = (name, date) => ({ name, time: '09:00 AM', date });
  localStorage.setItem('np_history', JSON.stringify([h('Ada', '2026-10-21'), h('Ada', '2026-10-21'), h('Bo', '2026-10-22'), h('Fay <i>x</i>', '2026-10-22')]));
  localStorage.setItem('np_daily', JSON.stringify({
    days: { '2026-10-06': { 'n:ada': 1 }, '2026-10-14': { 'n:cy': 3 }, '2026-09-20': { 'n:ed': 1 } },
    who: { 'n:ada': 'Ada', 'n:cy': 'Cy', 'n:ed': 'Ed' }
  }));
}, { P1, P2 });
await page.goto(BASE + '/Tools/007-Name Picker.html', { waitUntil: 'networkidle' });
await settle(page, 400);
const click = sel => page.evaluate(q => document.querySelector(q).click(), sel);   /* the tab row scrolls; a script click needs no viewport */
const keysBefore = await page.evaluate(() => Object.keys(localStorage).sort());
await click('button[data-tab="equity"]');
await settle(page, 300);

ok(await page.locator('#dashBody .dash-chart svg').count() === 1, 'the chart is drawn');
ok(/Picks per week — Period 1/.test(await page.textContent('#dashBody .dash-chart svg title')), 'the chart is titled for the period (the saved roster the list matches)');
eq(await page.evaluate(() => document.getElementById('dashPeriod').value), 'Period 1', 'the period picker opens on the roster in use');
eq(await page.textContent('#dashStatus'), '7 picks across 4 students in the last 8 weeks (Aug 31 to Oct 23).', 'the live region carries the first sentence');
eq(await page.locator('#dashBody .dash-grid').first().locator('thead th').count(), 8 + 3, 'eight week columns plus student, total and last called');
const rows = () => page.evaluate(() => Array.from(document.querySelectorAll('#dashBody .dash-grid')[0].querySelectorAll('tbody tr')).map(r => Array.from(r.cells).map(c => c.textContent)));
let t = await rows();
eq(t.map(r => r[0] + ':' + r[9]), ['Ada:3', 'Bo:1', 'Cy:3', 'Di:0'], 'the totals by student, from the history and the rollup together');
eq(t[0].slice(1, 9), ['·', '·', '·', '·', '·', '1', '·', '2'], 'Ada: one pick the week of Oct 5 (rollup), two the week of Oct 19 (history)');
eq(t[3][10], 'never on record — quiet', 'Di was never called and the row says so in words');
eq(await page.locator('.dash-quiet li').allTextContents(), ['Di — never on record'], 'the quiet list holds only Di (Cy is 9 days ago)');

await page.selectOption('#dashWeeks', '4');
await settle(page, 200);
eq(await page.locator('#dashBody .dash-grid').first().locator('thead th').count(), 4 + 3, 'four weeks: four week columns');
eq(await page.textContent('#dashStatus'), '7 picks across 4 students in the last 4 weeks (Sep 28 to Oct 23).', 'and the sentence follows (Oct 5 is inside four weeks, so the same seven picks)');
await page.selectOption('#dashWeeks', '8');

await page.selectOption('#dashPeriod', '');
await settle(page, 200);
ok(/6 students/.test(await page.textContent('#dashStatus')), 'All periods counts Cy once: six students, not seven');
eq(await page.locator('#dashBody .dash-grid').count(), 2, 'with more than one period the comparison table appears');
const cmp = await page.evaluate(() => Array.from(document.querySelectorAll('#dashBody .dash-grid')[1].querySelectorAll('tbody tr')).map(r => Array.from(r.cells).map(c => c.textContent)));
eq(cmp.map(r => r.slice(0, 4)), [['Period 1', '4', '7', '3 of 4 (75%)'], ['Period 2', '3', '5', '3 of 3 (100%)']], 'the periods side by side');
eq(await page.locator('#dashBody i').count(), 0, 'a student name with markup in it is text, not an element');
ok((await page.textContent('#dashBody')).includes('Fay <i>x</i>'), 'and it is shown as typed');
await page.selectOption('#dashPeriod', 'Period 2');
await settle(page, 200);

eq(await page.evaluate(() => Object.keys(localStorage).sort()), keysBefore, 'nothing new was stored by viewing the dashboard');

/* the printed page, through the kit */
await page.evaluate(() => { window.__prints = 0; window.print = () => { window.__prints++; }; });
const pdfPages = async () => {
  await page.emulateMedia({ media: 'print' });
  const buf = await page.pdf({ preferCSSPageSize: true });
  await page.emulateMedia({ media: 'screen' });
  return (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
};
await click('#dashPreview');
await page.waitForSelector('dialog.pk-preview[open]', { timeout: 10000 });
await page.waitForFunction(() => /Page 1 of \d+/.test(document.querySelector('.pk-preview-status').textContent), null, { timeout: 10000 });
eq(await page.evaluate(() => window.__prints), 0, 'opening the preview prints nothing');
const pv = await page.evaluate(() => {
  const d = document.querySelector('.pk-preview-frame').contentDocument;
  return { text: d.body.textContent, svg: !!d.querySelector('svg'), status: document.querySelector('.pk-preview-status').textContent, tables: d.querySelectorAll('table').length };
});
eq(pv.status, 'Page 1 of 1', 'the dashboard is one page');
ok(/Participation dashboard/.test(pv.text) && /Period 2/.test(pv.text) && pv.svg, 'the sheet has its title, the period and the chart');
ok(pv.tables === 2, 'the grid and the periods side by side are both on the sheet');
await click('.pk-preview-print');
eq(await page.evaluate(() => window.__prints), 1, 'the preview’s Print button prints once');
ok(await page.evaluate(() => document.body.classList.contains('printing-dash')), 'with the dashboard in place of the page');
eq(await pdfPages(), 1, 'and Chromium’s PDF of it is one page');
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
ok(await page.evaluate(() => !document.body.classList.contains('printing-dash') && !document.getElementById('pk-page-style')), 'after printing the page is back and the kit’s page rule is gone');
await click('#dashPrint');
eq(await page.evaluate(() => window.__prints), 2, 'the Print button prints without a preview');
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));

/* a roster longer than a page holds: capped with a count, still one page */
const big = Array.from({ length: 60 }, (_, i) => 'Student ' + String(i + 1).padStart(2, '0'));
await page.evaluate(({ big, P1, P2 }) => { localStorage.setItem('np_rosters', JSON.stringify({ Big: big, 'Period 1': P1, 'Period 2': P2, R1: P1, R2: P1, R3: P1, R4: P1, R5: P1 })); localStorage.setItem('np_current', JSON.stringify(big)); }, { big, P1, P2 });
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
await click('button[data-tab="equity"]');
await settle(page, 300);
await page.evaluate(() => { window.__prints = 0; window.print = () => { window.__prints++; }; });
await page.selectOption('#dashPeriod', 'Big');
await settle(page, 200);
eq(await page.locator('#dashBody .dash-grid').first().locator('tbody tr').count(), 60, 'on screen every student has a row');
await click('#dashPreview');
await page.waitForSelector('dialog.pk-preview[open]', { timeout: 10000 });
await page.waitForFunction(() => /Page 1 of \d+/.test(document.querySelector('.pk-preview-status').textContent), null, { timeout: 10000 });
const bigPv = await page.evaluate(() => {
  const d = document.querySelector('.pk-preview-frame').contentDocument;
  return { status: document.querySelector('.pk-preview-status').textContent, more: Array.from(d.querySelectorAll('td')).some(c => /and 43 more students/.test(c.textContent)), rows: d.querySelectorAll('table')[0].querySelectorAll('tbody tr').length };
});
ok(bigPv.more && bigPv.rows === 18, `the sheet stops at 17 students with eight periods on the sheet, and says "and 43 more" (${bigPv.rows} rows)`);
await click('.pk-preview-print');
const bigPdf = await pdfPages();
const bigPrev = Number(bigPv.status.match(/of (\d+)/)[1]);
eq([bigPrev, bigPdf], [1, 1], 'a 60-student roster with eight periods is still one page, in the preview and in Chromium’s PDF');
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));

/* the Data front door */
await click('#dashGotoData');
ok(await page.evaluate(() => document.getElementById('tab-data').classList.contains('active')), 'the Data button opens the Data tab');
await click('button[data-tab="equity"]');
page.on('dialog', d => d.accept());
await click('#dashClear');
await settle(page, 400);
const after = await page.evaluate(() => ({ h: JSON.parse(localStorage.getItem('np_history') || '[]').length, d: JSON.parse(localStorage.getItem('np_daily') || 'null') }));
ok(after.h === 0 && (!after.d || Object.keys(after.d.days || {}).length === 0), 'Clear pick history from the card empties the history and the rollup');
eq(await page.locator('.dash-quiet li').count() > 0, true, 'and the dashboard redraws with everyone quiet');

await browser.close();
server.close && server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
