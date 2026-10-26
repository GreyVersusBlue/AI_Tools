// smoke-ics-wall.mjs — 032's .ics export and import and its one-page wall calendar
// (Path 9 P4). The writer and reader are held by ics.test.mjs; this holds the page.
//
//   node Tools/school-calendar/test/smoke-ics-wall.mjs   (or: npm run test:school-calendar-ics-wall)
//
// What is held. Export: with a course planned "with paced lessons" starts ticked and the
// file has every day run, every grading period and each lesson on the date stamped for it,
// read back with the module's own reader; unticked, no lesson. Import: the page's own file
// shows "Nothing would change" and offers no Add; a district file shows every date that
// would change (the rows planIcsImport gives for the stored calendar) and what is skipped,
// stores nothing until "Add these days", then stores exactly the plan, and the notice bar's
// Undo writes the old bytes back; a malformed file is refused in words and stores nothing.
// Wall calendar: the fifth print choice shows the sheet and a "Preview pages" button and
// writes a landscape Letter @page, which leaving it takes away; a closure is hatched and
// says its abbreviation; a run of named days is one line; the legend and the grading
// periods are there; Chromium's PDF of the seed is one page and the preview says "Page 1 of
// 1"; a calendar with a long name on every school day is still one page (the names capped,
// "+N more") and a 14-month year shows twelve months and says so. axe finds nothing serious
// in the import preview or the sheet. Then the deliberate breaks: the page is altered on the
// wire, and each must fail.
//
// The clock is pinned (the seed's third school day, 10:00 local). Run it in a second zone
// too (TZ=UTC; CI runs in UTC). Nothing here describes a real class. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan, downloadText } from '../../board-check/harness.mjs';
import { seedCalendar2026 } from '../scv-seed.js';
import { isTeachableDay, parseLessonList } from '../scv-pacing.js';
import { emptyPlan, newCourse, syncUnits, placePlan, stamp } from '../scv-plan.js';
import { readIcs, planIcsImport, dayRuns } from '../scv-ics.js';

const PORT = 8549;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/032-School%20Calendar%20Visualizer.html';
const KEY = 'scv_calendar_v1';
const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

let passed = 0, failed = 0;
const fails = [];
let quiet = false;
let breakFails = 0;
const ok = (cond, label) => {
  if (quiet) { if (!cond) breakFails++; return !!cond; }
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const pdfPageCount = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

const SEED = seedCalendar2026();
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
}
const SCHOOL = [];
for (let d = SEED.meta.start; d <= SEED.meta.end; d = addDays(d, 1)) if (isTeachableDay(d, SEED.days, SEED.dayTypes)) SCHOOL.push(d);
const NOW = new Date(SCHOOL[2] + 'T10:00:00');

const MATH = [];
for (let k = 1; k <= 6; k++) MATH.push(`U1-0${k}-A-Ratios ${k}`);
function withCourse() {
  const cal = seedCalendar2026();
  const c = newCourse('Math 7', { id: 'course_1' });
  c.lessons = parseLessonList(MATH.join('\n')).lessons;
  cal.plan = { ...emptyPlan(), courses: [syncUnits(c)], active: 'course_1' };
  return JSON.stringify(stamp(cal, placePlan(cal)));   // as 032's own save leaves it
}
function dense() {
  const cal = seedCalendar2026();
  SCHOOL.forEach((d, i) => {
    cal.days[d] = { types: i % 3 ? ['testing'] : ['testing', 'mpend'], label: `A long event name for school day ${i + 1}, to fill the sheet`, note: '', lesson: '' };
  });
  return JSON.stringify(cal);
}
function longYear() {
  const cal = seedCalendar2026();
  cal.meta = { ...cal.meta, start: '2026-07-01', end: '2027-08-31' };
  return JSON.stringify(cal);
}

const DISTRICT = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Test District//EN',
  'BEGIN:VEVENT', 'UID:a@d', 'DTSTART;VALUE=DATE:20260907', 'SUMMARY:Labor Day Holiday', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:b@d', 'DTSTART;VALUE=DATE:20261012', 'DTEND;VALUE=DATE:20261014', 'SUMMARY:Fall Break', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:c@d', 'DTSTART;TZID=America/New_York:20261021T123000', 'SUMMARY:Early Dismissal', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:d@d', 'DTSTART;VALUE=DATE:20260909', 'RRULE:FREQ=WEEKLY', 'SUMMARY:Staff meeting', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:e@d', 'DTSTART;VALUE=DATE:20270705', 'SUMMARY:Summer School', 'END:VEVENT',
  'END:VCALENDAR', '',
].join('\r\n');

const server = await serve(PORT);
const browser = await launch();

async function freshPage(pageEdit) {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  await page.clock.setFixedTime(NOW);
  page.__errs = [];
  page.on('pageerror', (e) => page.__errs.push(String(e)));
  page.on('dialog', (d) => d.accept());
  if (pageEdit) {
    await page.route('**/032-School*', async (route) => {
      const res = await route.fetch();
      route.fulfill({ response: res, body: pageEdit(await res.text()), headers: { ...res.headers(), 'content-type': 'text/html' } });
    });
  }
  await page.goto(BASE + '/index.html');
  return page;
}
const putRaw = (page, s) => page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, s]);
const raw = (page) => page.evaluate((k) => localStorage.getItem(k), KEY);
const open = async (page) => { await page.goto(URL_PAGE, { waitUntil: 'networkidle' }); await settle(page, 400); };
const upload = async (page, name, text) => {
  await page.setInputFiles('#fileImportIcs', { name, mimeType: 'text/calendar', buffer: Buffer.from(text, 'utf8') });
  await settle(page, 300);
};
const pickPrint = async (page, mode) => { await page.check(`input[name="printMode"][value="${mode}"]`); await settle(page, 300); };
const pdfPages = async (page) => pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: true }));

async function scenario(label, pageEdit) {
  const p = await freshPage(pageEdit);

  /* ── export ── */
  await putRaw(p, withCourse());
  await open(p);
  const stored = JSON.parse(await raw(p));
  ok(await p.isChecked('#icsLessons'), `${label}: with a course planned, "with paced lessons" starts ticked`);
  const ics = await downloadText(p, '#btnExportIcs', { what: 'the .ics' });
  const r = readIcs(ics, { timeZone: ZONE });
  ok(r.ok, `${label}: the exported file reads back (${r.error || ''})`);
  const kinds = (ics.match(/X-SCV-KIND:[a-z-]+/g) || []).reduce((o, k) => { o[k.slice(11)] = (o[k.slice(11)] || 0) + 1; return o; }, {});
  eq(kinds, { day: dayRuns(stored).length, 'grading-period': 4, lesson: 6 }, `${label}: one event per run of days, per grading period (4) and per lesson (6)`);
  const lessonOn = stored.plan.courses[0].lessons.map((l) => [l.on, l.title]);
  ok(lessonOn.every(([on, title]) => ics.includes('DTSTART;VALUE=DATE:' + on.replace(/-/g, '') + '\r\nDTEND;VALUE=DATE:' + addDays(on, 1).replace(/-/g, '') + '\r\nSUMMARY:Math 7: U1-') && ics.includes(title)),
    `${label}: each lesson is on the date stamped for it, named by its course`);
  ok(/SUMMARY:Quarter 1\r\n/.test(ics) && ics.includes('DTSTART;VALUE=DATE:20260831\r\nDTEND;VALUE=DATE:20261105\r\nSUMMARY:Quarter 1'), `${label}: Quarter 1 runs Aug 31 to Nov 4`);
  ok(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75), `${label}: every line is folded to 75 octets`);
  await p.uncheck('#icsLessons');
  const bare = await downloadText(p, '#btnExportIcs', { what: 'the .ics without lessons' });
  ok(!bare.includes('X-SCV-KIND:lesson') && bare.includes('X-SCV-KIND:grading-period'), `${label}: unticked, the file has no lesson`);

  /* ── import: the page's own file ── */
  const before = await raw(p);
  await upload(p, 'mine.ics', ics);
  eq(await p.textContent('#icsSummary'), 'Nothing would change: every date in this file already says what it says.', `${label}: the page's own file changes nothing`);
  eq(await p.$('#icsApply'), null, `${label}: ...and offers no Add`);
  ok((await p.textContent('#icsBox details summary')).startsWith('10 events are not imported'), `${label}: its grading periods and lessons are listed as not imported`);
  await p.click('#icsCancel');
  eq(await p.$('#icsBox'), null, `${label}: Close takes the preview away`);

  /* ── import: a district's file ── */
  await upload(p, 'district.ics', DISTRICT);
  const plan = planIcsImport(JSON.parse(before), readIcs(DISTRICT, { timeZone: ZONE }));
  const rows = await p.$$eval('#icsTable tbody tr', (trs) => trs.length);
  eq(rows, plan.rows.length, `${label}: the preview lists every date that would change (${plan.rows.length})`);
  ok(plan.rows.length === 4, `${label}: (Labor Day's note, the two Fall Break days, the early dismissal)`);
  const skips = await p.$$eval('#icsBox details li', (li) => li.map((x) => x.textContent));
  ok(skips.length === 2 && skips.some((s) => s.includes('Staff meeting') && s.includes('repeats')) && skips.some((s) => s.includes('Summer School') && s.includes('outside this school year')), `${label}: the repeat and the date outside the year are listed with why (${skips.join(' | ')})`);
  eq(await raw(p), before, `${label}: nothing is stored while the preview is open`);
  await p.click('#icsApply');
  await settle(p, 300);
  const after = JSON.parse(await raw(p));
  eq(after.days, plan.cal.days, `${label}: "Add these days" stores exactly the plan`);
  eq(after.days['2026-09-07'], { types: ['holiday'], label: 'Labor Day', note: 'Also: Labor Day Holiday', lesson: '' }, `${label}: the label there stays and the district's title is in the note`);
  ok(!(await p.isHidden('#planNotice')) && (await p.textContent('#planNoticeText')).includes('district.ics') && !(await p.isHidden('#planUndo')), `${label}: the notice bar names the file and offers Undo`);
  eq(await p.$eval('#months .day[data-date="2026-10-12"]', (c) => [c.querySelector('.lbl') && c.querySelector('.lbl').textContent, [...c.querySelectorAll('.chip')].map((x) => x.title)]), ['Fall Break', ['Holiday / No School']], `${label}: the month grid shows Fall Break as a closure`);
  await p.click('#planUndo');
  await settle(p, 300);
  eq(await raw(p), before, `${label}: Undo writes the old bytes back`);

  /* ── import: refused ── */
  await upload(p, 'broken.ics', 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261001\r\n');
  const refusal = await p.textContent('#icsBox [role="alert"]');
  ok(/END:VCALENDAR/.test(refusal) && refusal.endsWith('Nothing was imported.'), `${label}: a broken file is refused in words (${refusal})`);
  eq(await raw(p), before, `${label}: ...and nothing is stored`);
  await upload(p, 'district.ics', DISTRICT);
  const v1 = await a11yScan(p, { include: ['#icsPreview'] });
  eq(v1.map((x) => x.id), [], `${label}: the import preview has no serious or critical axe finding`);
  await p.click('#icsCancel');

  /* ── the wall calendar ── */
  ok(await p.isHidden('#btnWallPreview') && await p.isHidden('#wallSheet'), `${label}: the wall sheet and its preview button are hidden until picked`);
  await pickPrint(p, 'wall');
  ok(await p.isVisible('#wallSheet') && await p.isVisible('#btnWallPreview') && await p.isHidden('#months'), `${label}: picking "Wall calendar" shows the sheet and "Preview pages", not the month grid`);
  const pageRule = await p.evaluate(() => { const s = document.getElementById('pk-page-style'); return s ? s.textContent : ''; });
  ok(/size: letter landscape/.test(pageRule), `${label}: the page is landscape Letter (${pageRule})`);
  eq(await p.$$eval('#wallSheet .wmonth h3', (h) => h.map((x) => x.textContent)), ['August 2026', 'September 2026', 'October 2026', 'November 2026', 'December 2026', 'January 2027', 'February 2027', 'March 2027', 'April 2027', 'May 2027', 'June 2027'], `${label}: every month of the year, in order`);
  const labor = await p.evaluate(() => {
    const m = [...document.querySelectorAll('#wallSheet .wmonth')].find((x) => x.querySelector('h3').textContent === 'September 2026');
    const c = [...m.querySelectorAll('.wcell')].find((x) => (x.querySelector('.wn') || {}).textContent === '7');
    return [c.className, c.querySelector('.wt') && c.querySelector('.wt').textContent, [...m.querySelectorAll('.wnames li')].map((l) => l.textContent)];
  });
  eq(labor, ['wcell woff', 'H', ['7 Labor Day', '18 Early Dismissal — Professional Learning']], `${label}: a closure is hatched and says H; the month's named days are listed`);
  const dec = await p.$$eval('#wallSheet .wmonth', (ms) => [...ms.find((x) => x.querySelector('h3').textContent === 'December 2026').querySelectorAll('.wnames li')].map((l) => l.textContent));
  ok(dec.includes('24–31 Winter Break'), `${label}: a run of named days is one line (${dec.join(' | ')})`);
  const foot = await p.textContent('#wallSheet .wall-foot');
  ok(SEED.dayTypes.every((t) => foot.includes(t.label)) && foot.includes('No school'), `${label}: the legend names every type and the hatching`);
  ok(/Quarter 1: .+, \d+ days/.test(await p.textContent('#wallSheet .wall-periods')), `${label}: the grading periods are listed with their school days`);
  eq(await pdfPages(p), 1, `${label}: Chromium's PDF of the seed's wall calendar is one page`);
  await p.click('#btnWallPreview');
  await p.waitForFunction(() => /^Page \d+ of \d+$/.test((document.querySelector('.pk-preview-status') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
  eq(await p.textContent('.pk-preview-status'), 'Page 1 of 1', `${label}: the preview says one page too`);
  await p.click('.pk-preview-close');
  await settle(p, 200);
  const v2 = await a11yScan(p, { include: ['#wallSheet'] });
  eq(v2.map((x) => x.id), [], `${label}: the sheet has no serious or critical axe finding`);
  await pickPrint(p, 'month');
  eq(await p.$('#pk-page-style'), null, `${label}: leaving the wall calendar takes its @page away`);

  await putRaw(p, dense());
  await open(p);
  await pickPrint(p, 'wall');
  eq(await pdfPages(p), 1, `${label}: with a long name on every school day it is still one page`);
  const more = await p.$$eval('#wallSheet .wnames', (uls) => uls.map((u) => [u.children.length, u.lastElementChild.textContent]));
  ok(more.every(([n]) => n <= 5) && more.some(([, t]) => /^\+\d+ more$/.test(t)), `${label}: ...at most five lines a month, "+N more" after`);

  await putRaw(p, longYear());
  await open(p);
  await pickPrint(p, 'wall');
  eq(await p.$$eval('#wallSheet .wmonth', (m) => m.length), 12, `${label}: a 14-month year shows twelve months`);
  ok((await p.textContent('#wallSheet .wall-periods')).includes('The first 12 months of 14 are shown.'), `${label}: ...and says so`);
  eq(await pdfPages(p), 1, `${label}: ...on one page`);

  eq(p.__errs, [], `${label}: the page threw nothing`);
  return p;
}

console.log(`School Calendar Visualizer: .ics export and import, and the wall calendar (Path 9 P4; TZ=${ZONE})`);
const page = await scenario('page');
await page.context().close();

/* ═══ deliberate breaks: each altered page must fail the scenario ═══ */
const BREAKS = [
  ['no lessons in the export', (s) => s.replace('lessons: withLessons ? icsLessons() : []', 'lessons: []')],
  ['the import stores before Add', (s) => s.replace('  const plan = planIcsImport(cal, result);\n', '  const plan = planIcsImport(cal, result);\n  store.set(plan.cal);\n')],
  ['no Undo after an import', (s) => s.replace('save("Importing \u201c" + fileName + "\u201d", `Imported', 'save(null, null && `Imported')],
  ['a portrait page', (s) => s.replace('orientation: "landscape", margin: "0.4in"', 'orientation: "portrait", margin: "0.4in"')],
  ['names not capped', (s) => s.replace('const WALL_MAX_NAMES = 5;', 'const WALL_MAX_NAMES = 60;')],
  ['no hatching', (s) => s.replace('else if (types.some(t => t.noSchool)) cell.classList.add("woff");', '')],
  ['runs not joined', (s) => s.replace('if (prev && prev.name === name && prev.to === d - 1) prev.to = d;', 'if (false) prev.to = d;')],
];
let caught = 0;
for (const [name, edit] of BREAKS) {
  quiet = true; breakFails = 0;
  let r = null;
  try { r = await scenario(name, edit); } catch (e) { breakFails++; }
  quiet = false;
  if (r) await r.context().close().catch(() => {});
  if (breakFails) caught++; else { failed++; fails.push('break not caught: ' + name); console.log('  FAIL break not caught: ' + name); }
}

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed; ${caught}/${BREAKS.length} deliberate breaks caught`);
if (failed) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
