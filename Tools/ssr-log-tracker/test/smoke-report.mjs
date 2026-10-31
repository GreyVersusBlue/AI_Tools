// smoke-report.mjs — 033's printable parent reading report on the real page.
//   node Tools/ssr-log-tracker/test/smoke-report.mjs     (port 8630)
//
// Held here: one page per student with only that student's own reading; the pages a sitting
// added are worked out over the whole log, so a period that starts mid-book does not count
// the pages before it; the batch is one sheet per student in Chromium's own PDF, even for a
// student with 14+ weeks and a dozen books; goals, the note box and a bad date range behave;
// names and titles with markup print as text; printing changes nothing that is stored;
// 360 px and axe. All names and titles are invented.
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = 8630;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/033-ssr-log-tracker.html';

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; return true; } failed++; console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const E = (id, date, book, pagesTo, minutes) => ({ id, date, book, pagesTo, minutes });
const HOSTILE = '<img src=x onerror=window.__pwned=1>';
const stress = [];
for (let w = 0; w < 18; w++) for (const d of [0, 2]) {
  const day = new Date(Date.UTC(2026, 0, 5 + w * 7 + d)).toISOString().slice(0, 10);
  stress.push(E('s' + w + d, day, 'Book ' + String.fromCharCode(65 + (w % 15)) + ' of Many', 20 * (Math.floor(w / 15) + 1) + d, 20));
}
const SECTION = {
  roster: ['Ada Okonkwo', 'Ben Marsh', 'Carla Reyes', 'Dee Stress', HOSTILE, 'Eli Empty'],
  logs: {
    'Ada Okonkwo': [E('a1', '2026-10-05', 'Hatchet', 40, 20), E('a2', '2026-10-12', 'Hatchet', 70, 25), E('a3', '2026-10-13', 'Hatchet', 90, 30), E('a4', '2026-10-20', 'The Giver', 30, 15)],
    'Ben Marsh': [E('b1', '2026-10-14', 'Holes', 50, 30), E('b2', '2026-10-15', 'Holes', 80, 20)],
    'Carla Reyes': [E('c1', '2026-10-21', 'Wonder', 25, 10)],
    'Dee Stress': stress,
    [HOSTILE]: [E('h1', '2026-10-14', '<b onclick=1>Bold Title</b>', 10, 5)],
    'Eli Empty': []
  },
  finished: { 'Ada Okonkwo': ['hatchet'] }, genres: { hatchet: 'Adventure' }, weeklyGoalPages: 0, weeklyGoalMinutes: 0, rosterName: '', idNames: {}
};

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1200 });
await page.clock.setFixedTime(new Date('2026-10-30T15:00:00Z'));
await page.addInitScript((section) => {
  if (localStorage.getItem('__seeded')) return;
  localStorage.setItem('__seeded', '1');
  localStorage.setItem('sslt_sections_v1', JSON.stringify({ 'Period 1': section }));
  localStorage.setItem('sslt_current_v1', 'Period 1');
  window.print = () => { window.__prints = (window.__prints || 0) + 1; };
}, SECTION);

const stored = () => page.evaluate(() => localStorage.getItem('sslt_sections_v1'));
const area = () => page.textContent('#printArea');
const pageCount = () => page.locator('#printArea .rep-page').count();
async function printFor(who, from, to) {
  if (from !== undefined) await page.fill('#reportFrom', from);
  if (to !== undefined) await page.fill('#reportTo', to);
  await page.selectOption('#reportWho', who);
  await page.click('#printReportsBtn');
  await settle(page, 200);
}
async function pdfPages() {
  await page.emulateMedia({ media: 'print' });
  const buf = await page.pdf({ format: 'Letter', printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  const dir = mkdtempSync(path.join(tmpdir(), 'ssrpdf-'));
  try {
    const f = path.join(dir, 'r.pdf'); writeFileSync(f, buf);
    const txt = execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' });
    return txt.split('\f').filter((t, i, a) => i < a.length - 1 || t.trim());
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

console.log('SSR Log Tracker — parent reading reports');
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 500);
const before = await stored();

/* 1. the card and its defaults */
ok(await page.isVisible('#reportCard'), 'the Parent reading reports card is on the page');
eq(await page.inputValue('#reportFrom'), '2026-01-05', 'From defaults to the earliest entry in the class');
eq(await page.inputValue('#reportTo'), '2026-10-30', 'To defaults to today');
eq((await page.locator('#reportWho option').allTextContents()).slice(0, 3), ['Every student', 'Ada Okonkwo', 'Ben Marsh'], 'the picker lists the roster');

/* 2. one student, one page, only their own reading */
await printFor('Ada Okonkwo', '2026-10-01', '2026-10-30');
eq(await pageCount(), 1, 'one page for one student');
eq(await page.evaluate(() => window.__prints), 1, 'print() called once');
let t = await area();
ok(t.includes('Reading report: Ada Okonkwo') && t.includes('Period 1'), 'it names the student and the class');
ok(t.includes('Hatchet') && t.includes('The Giver') && t.includes('Adventure'), 'her books, and the genre the teacher tagged');
ok(!/Ben Marsh|Holes|Carla|Wonder|Dee Stress/.test(t), "nothing of another student is on it");
const stats = await page.locator('#printArea .rep-stat b').allTextContents();
eq(stats, ['4', '120', '90', '1'], 'days read, pages (40+30+20+30), minutes (20+25+30+15) and books finished (Hatchet)');
ok(/finished/.test(t) && /in progress/.test(t), 'a finished book says so, the other is in progress');
ok(t.includes('Oct 5') && t.includes('Oct 12') && t.includes('Oct 19'), 'the weeks are listed');

/* 3. a period that starts mid-book does not count the pages before it */
await printFor('Ada Okonkwo', '2026-10-12', '2026-10-30');
const stats2 = await page.locator('#printArea .rep-stat b').allTextContents();
eq(stats2.slice(0, 3), ['3', '80', '70'], 'from Oct 12: 3 days, 30+20+30 pages (not Hatchet\'s page 70 and 90 as if read in the period)');

/* 4. weekly dots are text, not colour */
const dots = await page.locator('#printArea .rep-dots').allTextContents();
ok(dots.length >= 3 && dots.every(d => /[●○–]/.test(d)), 'each week is drawn with filled, empty and outside marks');
await printFor('Ada Okonkwo', '2026-10-14', '2026-10-30');
ok((await page.locator('#printArea .rep-dots').first().textContent()).startsWith('\u2013 \u2013'), 'days before the period start are marked as outside it');

/* 5. an empty student; the note box */
await printFor('Eli Empty', '2026-10-01', '2026-10-30');
ok((await area()).includes('No reading was logged for Eli Empty'), 'a student with nothing logged says so');
eq(await page.locator('#printArea .rep-note').count(), 1, 'the note box is there by default');
await page.uncheck('#reportNote');
await printFor('Eli Empty');
eq(await page.locator('#printArea .rep-note').count(), 0, 'and gone when unticked');
await page.check('#reportNote');

/* 6. goals */
ok(!(await area()).includes('Weekly goal'), 'no goal line when none is set');
await page.fill('#goalPages', '50');
await page.dispatchEvent('#goalPages', 'change');
await page.fill('#goalMinutes', '40');
await page.dispatchEvent('#goalMinutes', 'change');
await settle(page, 200);
await printFor('Ada Okonkwo', '2026-10-01', '2026-10-30');
t = await area();
ok(/Weekly goal: 50 pages, met in \d of 5 weeks; 40 minutes, met in \d of 5 weeks\./.test(t), 'the goal line says in how many weeks it was met: ' + t.match(/Weekly goal[^.]*\.[^.]*\./));

/* 7. a bad range prints nothing */
const n0 = await page.evaluate(() => window.__prints);
await printFor('', '2026-10-30', '2026-10-01');
eq(await page.evaluate(() => window.__prints), n0, 'From after To does not print');
ok(/on or before/.test(await page.textContent('#reportHint')), 'and says why');

/* 8. hostile names stay text */
await printFor(HOSTILE, '2026-10-01', '2026-10-30');
eq(await page.evaluate(() => window.__pwned), undefined, 'a name with markup ran nothing');
eq(await page.locator('#printArea img, #printArea b[onclick]').count(), 0, 'and made no element');
ok((await area()).includes('<img src=x') && (await area()).includes('<b onclick=1>Bold Title</b>'), 'name and title print as text');

/* 9. the batch is one sheet per student in the PDF, even for the stress student */
await printFor('', '2026-01-05', '2026-10-30');
eq(await pageCount(), 6, 'six students, six report pages');
let sheets = await pdfPages();
eq(sheets.length, 6, `Chromium prints six sheets, one per student (got ${sheets.length})`);
const names = ['Ada Okonkwo', 'Ben Marsh', 'Carla Reyes', 'Dee Stress', '<img src=x', 'Eli Empty'];
ok(sheets.every((s, i) => s.includes(names[i])), 'in roster order, each sheet starting with its own student');
ok(!/Holes|Wonder/.test(sheets[0]) && !/Hatchet|Wonder/.test(sheets[1]), "and a sheet holds only its own student's books");
await printFor('Dee Stress', '2026-01-05', '2026-10-30');
sheets = await pdfPages();
eq(sheets.length, 1, 'the student with 43 weeks and 15 books still fits one sheet');
await page.emulateMedia({ media: 'print' });
const tallest = await page.evaluate(() => Math.max(...Array.from(document.querySelectorAll('#printArea .rep-page')).map(p => p.getBoundingClientRect().height)));
await page.emulateMedia({ media: 'screen' });
ok(tallest < 880, `and with room to spare for a wider font: the fullest page is ${Math.round(tallest)} px of about 940 (${Math.round(tallest / 96 * 100) / 100} in of 9.8)`);
ok(/earlier weeks? (is|are) left off/.test(sheets[0]) && /and 9 more/.test(sheets[0]), 'and says what it left off (earlier weeks, books beyond six)');

/* 10. printing stored nothing */
eq(await stored() === before || (JSON.parse(await stored())['Period 1'].weeklyGoalPages === 50), true, 'the stored log is untouched except for the goals just typed');
const after = JSON.parse(await stored())['Period 1'];
eq(after.logs, SECTION.logs, 'no log entry was changed by printing');

/* 11. 360 px and axe */
await page.setViewportSize({ width: 360, height: 900 });
await settle(page, 300);
ok(await page.evaluate(() => document.documentElement.scrollWidth <= 360), 'no sideways scroll at 360 px: ' + await page.evaluate(() => document.documentElement.scrollWidth));
for (const theme of ['light', 'dark']) {
  await page.evaluate((th) => document.documentElement.setAttribute('data-theme', th), theme);
  await settle(page, 600);
  const v = await a11yScan(page, { impact: 'serious', include: '#reportCard' });
  eq(v.map(x => x.id + ' ' + JSON.stringify(x.nodes)), [], `axe is clean on the report card in ${theme}`);
}
ok(page.__errs.length === 0, 'no console errors: ' + JSON.stringify(page.__errs));

await browser.close();
server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
