// smoke-terms.mjs — the Final Grade Checker with two, three or four terms in a year, in a browser.
//
//   node Tools/final-grade-checker/test/smoke-terms.mjs
//
// terms.test.mjs proves the arithmetic with `terms`; this is the half a pure test cannot see: the
// setting changes the cards, the weight boxes, the scenario form, the need tab and the paste reading
// together, and four quarters (the default) is the page it always was. Every name is invented.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import { seedCalendar2026 } from '../../school-calendar/scv-seed.js';

const PORT = 8579;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/036-final_grade_checker.html';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 1400 });
const errors = [];
page.on('pageerror', e => errors.push(e.stack));
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

const visible = sel => page.$$eval(sel, els => els.filter(e => e.offsetParent !== null).length);
const texts = sel => page.$$eval(sel, els => els.filter(e => e.offsetParent !== null).map(e => e.textContent.trim()));
const setTerms = async n => { await page.evaluate(() => { document.getElementById('settings-panel').hidden = false; }); await page.selectOption('#term-count', String(n)); await settle(page, 200); };

console.log('Final Grade Checker — terms');

/* ── 1. the default is the page it always was ─────────────────────────── */
eq(await page.inputValue('#term-count'), '4', 'four quarters by default');
eq(await visible('.grade-input[data-quarter]'), 5 * 4, 'five blank cards of four boxes each');
eq((await texts('.quarter-wrap label')).slice(0, 4), ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'], 'labelled Quarter 1 to 4');
eq(await visible('#weights-inputs .weight-field'), 0, 'weights hidden until asked for');
eq(await page.$eval('#import-help', e => /four quarter grades/.test(e.textContent)), true, 'the paste help says four quarter grades');

/* ── 2. three trimesters ───────────────────────────────────────────────── */
await setTerms(3);
eq(await visible('.grade-input[data-quarter]'), 5 * 3, 'three boxes per card');
eq((await texts('.quarter-wrap label')).slice(0, 3), ['Trimester 1', 'Trimester 2', 'Trimester 3'], 'labelled Trimester 1 to 3');
await page.check('#weights-enabled');
eq(await visible('#weights-inputs .weight-field'), 3, 'three weight boxes');
eq(await texts('#weights-inputs .weight-field label'), ['T1', 'T2', 'T3'], 'weights labelled T1 to T3');
eq(await page.$$eval('#weights-inputs input', els => els.filter(e => e.offsetParent).map(e => e.value)), ['33.33', '33.33', '33.33'], 'equal thirds');
await page.uncheck('#weights-enabled');
// type a student by hand: 90, 80, 70 -> 80 average, B by percentage; QP 4,3,2 = 3 -> B
const first = await page.$$('.student-card');
const boxes = await first[0].$$('.grade-input');
for (const [i, v] of ['90', '80', '70'].entries()) await boxes[i].fill(v);
await settle(page, 100);
eq(await first[0].$eval('.final-letter', e => e.textContent.trim()), 'B', 'a trimester student gets a final from three scores');
eq(await first[0].$eval('.filled-count', e => e.textContent.trim()), 'All 3 trimesters entered', 'and the count line says three');
await boxes[2].fill('');
await settle(page, 100);
eq(await first[0].$eval('.filled-count', e => e.textContent.trim()), '2 of 3 trimesters entered, need all 3 for a final grade', 'two of three is not a final');

// a pasted trimester export (id, name, section, grade, T1..T3, average)
const PASTE3 = [
  '30001\tAda Placeholder\t01\t07\tA(95.00)\tB(85.00)\tC(75.00)\t85.00',
  '30002\tBo Notreal\t01\t07\tB(88.00)\t\tA(92.00)\t90.00',
].join('\n');
await page.fill('#import-area', PASTE3);
await page.click('#import-btn');
await settle(page, 400);
eq(await visible('.student-card'), 2, 'two imported cards');
eq((await texts('.student-card .quarter-label')).slice(0, 3), ['Trimester 1', 'Trimester 2', 'Trimester 3'], 'imported cards show three trimesters');
const warn = await page.$$eval('#import-warning-list li', els => els.map(e => e.textContent));
eq(warn, ['Row 2 (Bo Notreal): 1 trimester(s) missing, so no final grade'], 'the missing trimester is named in trimester words');
eq(await page.$eval('.student-card .final-letter', e => e.textContent.trim()), 'B', 'Ada: 95/85/75 is a B (QP 3.0, 85%)');

/* ── 3. the scenario form follows the count ─────────────────────────────── */
eq(await page.$$eval('#sc-drop option', els => els.filter(o => !o.hidden).map(o => o.textContent)), ['no trimesters', '1 trimester', '2 trimesters'], 'drop offers 0 to 2 trimesters');
eq(await page.$$eval('#sc-apply option', els => els.filter(o => !o.hidden).map(o => o.textContent)), ['Every trimester', 'Trimester 1 only', 'Trimester 2 only', 'Trimester 3 only'], 'apply offers three');
await page.check('#sc-rw');
eq(await visible('#sc-weights label'), 3, 'three scenario weight boxes');
await page.uncheck('#sc-rw');
await page.selectOption('#sc-drop', '1');
await settle(page, 200);
const sum = await page.$eval('#sc-summary', e => e.textContent);
ok(/drop each student’s lowest trimester/.test(sum), 'the scenario sentence says trimester: ' + sum);
await page.selectOption('#sc-drop', '0');

/* ── 4. two semesters, and the need tab ─────────────────────────────────── */
await setTerms(2);
eq(await page.inputValue('#import-area') === PASTE3, true, 'the paste is still in the box');
eq((await texts('.student-card .quarter-label')).slice(0, 2), ['Semester 1', 'Semester 2'], 'semesters');
await page.click('#tab-need-btn');
eq(await visible('.need-quarter-wrap'), 2, 'the need tab has two semesters');
eq(await page.$eval('input[name="need-solve"]:checked', e => e.value), '1', 'the open one is the last');
await page.fill('#need-q1', '90');
await settle(page, 200);
const need = await page.$eval('#need-results', e => e.textContent.replace(/\s+/g, ' '));
ok(/Semester 2/.test(need) && /%/.test(need), 'the need tab solves for Semester 2: ' + need.slice(0, 120));
await page.click('#tab-calc-btn');

/* ── 5. back to four, and what was a four-quarter paste reads as before ──── */
await setTerms(4);
eq((await texts('.student-card .quarter-label')).slice(0, 4), ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'], 'quarters again');
eq(await page.evaluate(() => localStorage.getItem('final-grade-checker:settings-v1')), null, 'nothing was stored: no setting was kept and no grade ever is');

/* ── 6. the grading window follows the count (Path 9's calendar, read through SchoolDay) ────────── */
// The 2026-27 seed ends marking periods on Nov 4, Jan 22 and Apr 7 (and the year's last day): four.
// Taking Nov 4 and Apr 7 off leaves Jan 22, two semesters; taking only Apr 7 off leaves three trimesters.
const calendarWithout = drop => {
  const cal = seedCalendar2026();
  for (const d of drop) cal.days[d].types = cal.days[d].types.filter(t => t !== 'mpend');
  return JSON.stringify(cal);
};
const openWith = async (when, cal, settings) => {
  const pg = await prepPage(browser, BASE, { width: 1280, height: 1000 });
  await pg.clock.setFixedTime(new Date(when));
  await pg.goto(BASE + '/index.html');
  await pg.evaluate(([c, st]) => { localStorage.clear(); localStorage.setItem('scv_calendar_v1', c); if (st) localStorage.setItem('final-grade-checker:settings-v1', st); }, [cal, settings]);
  await pg.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await pg.click('#tab-need-btn');
  await settle(pg, 200);
  return pg;
};
const SEM = JSON.stringify({ boundary: 'half', precision: 'none', weightsEnabled: false, weights: [50, 50], terms: 2, showWork: false, persist: true });
const TRI = JSON.stringify({ boundary: 'half', precision: 'none', weightsEnabled: false, weights: [33.33, 33.33, 33.33], terms: 3, showWork: false, persist: true });
{
  const pg = await openWith('2026-12-01T10:00:00', calendarWithout(['2026-11-04', '2027-04-07']), SEM);
  const note = await pg.$eval('#need-calendar', e => e.textContent);
  ok(/today is in Semester 1 \(.*\), \d+ school days? left/.test(note) && /Semester 1 is marked as the open one/.test(note), 'two semesters: December is Semester 1 and it is marked open: ' + note);
  eq(await pg.$eval('input[name="need-solve"]:checked', e => e.value), '0', 'the first semester is the open one');
  await pg.close();
}
{
  const pg = await openWith('2027-03-01T10:00:00', calendarWithout(['2026-11-04', '2027-04-07']), SEM);
  eq(await pg.$eval('input[name="need-solve"]:checked', e => e.value), '1', 'March is Semester 2');
  await pg.close();
}
{
  const pg = await openWith('2027-05-01T10:00:00', calendarWithout(['2027-04-07']), TRI);
  const note = await pg.$eval('#need-calendar', e => e.textContent);
  ok(/today is in Trimester 3 /.test(note) && /Trimester 3 is marked as the open one/.test(note), 'three trimesters: May is Trimester 3, marked open: ' + note);
  await pg.close();
}
{
  // four periods in the calendar, two semesters chosen: the periods are not read as semesters, as six were never read as quarters
  const pg = await openWith('2026-12-01T10:00:00', JSON.stringify(seedCalendar2026()), SEM);
  const note = await pg.$eval('#need-calendar', e => e.textContent);
  ok(/today is in grading period 2 of 4 /.test(note) && !/marked as the open one/.test(note), 'a four-period calendar is not read as two semesters: ' + note);
  await pg.close();
}

eq(errors, [], 'no page errors');
await browser.close();
server.close && server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
