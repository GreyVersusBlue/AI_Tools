// smoke-plan-bands.mjs — 032's unit bands for every course, not only the active one (Path 9
// P2's last page piece). The placer is held by plan.test.mjs; this holds what the month grid
// and the day editor draw from every course's placement.
//
//   node Tools/school-calendar/test/smoke-plan-bands.mjs   (or: npm run test:school-calendar-plan-bands)
//
// What is held: with three courses (the active one a lesson list, a typed "Science" and a
// lesson list "History"), the active course draws no band of its own (as before: its lessons
// are in the cells) and each other course has one lane, in the plan's order, whose band runs
// from its unit's first class day to its last; a lane with nothing on a day is an empty gap,
// so the lanes line up; each band's title names its course; one name fits on a cell, with
// "+N" when more units start there. The day editor lists every other course's day in words
// ("Other courses"), a lost day included. Switching to Science draws its own bands first, as
// the active typed course always did, then the others. A calendar with one course draws what
// it did before (no gap, no course in the title). Six courses draw thinner bands that stay in
// the lower half of the cell. The month grid and the editor have no serious axe finding. Then
// the deliberate breaks: the page is altered on the wire, and each must fail.
//
// The clock is pinned (the seed's third school day, 10:00 local); every expected date is read
// off the seeded 2026-27 calendar with scv-pacing.js's isTeachableDay, not with the placer.
// The record is built with scv-plan.js's newCourse/newUnit/syncUnits (shape only). Nothing
// here describes a real class. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { seedCalendar2026 } from '../scv-seed.js';
import { isTeachableDay, parseLessonList } from '../scv-pacing.js';
import { emptyPlan, newCourse, newUnit, syncUnits } from '../scv-plan.js';

const PORT = 8545;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/032-School%20Calendar%20Visualizer.html';

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

/* ── dates off the seed, without scv-plan.js's placer ── */
const SEED = seedCalendar2026();
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
}
const SCHOOL = [];
for (let d = SEED.meta.start; d <= SEED.meta.end; d = addDays(d, 1)) if (isTeachableDay(d, SEED.days, SEED.dayTypes)) SCHOOL.push(d);
const NOW = new Date(SCHOOL[2] + 'T10:00:00');

function lessonCourse(name, id, codes) {
  const c = newCourse(name, { id });
  c.lessons = parseLessonList(codes.join('\n')).lessons;
  return syncUnits(c);
}
function typedCourse(name, id, units) {
  const c = newCourse(name, { id });
  c.units = units.map(([n, days, color], i) => newUnit(n, days, { id: `${id}_u${i + 1}`, color }));
  return c;
}
const MATH = [];
for (let k = 1; k <= 6; k++) MATH.push(`U1-0${k}-A-Ratios ${k}`);
const SCIENCE = [['Cells', 6, '#2e6b3e'], ['Energy', 4, '#c98a1f']];
const HISTORY = ['U1-01-A-Rivers', 'U1-02-A-Cities', 'U1-03-A-Writing'];

function blob(courses, active, mutate) {
  const cal = seedCalendar2026();
  cal.plan = { ...emptyPlan(), courses, active };
  if (mutate) mutate(cal);
  return JSON.stringify(cal);
}
const THREE = () => [lessonCourse('Math 7', 'course_1', MATH), typedCourse('Science', 'course_2', SCIENCE), lessonCourse('History', 'course_3', HISTORY)];

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
const putRaw = (page, s) => page.evaluate((v) => localStorage.setItem('scv_calendar_v1', v), s);
const open = async (page) => { await page.goto(URL_PAGE, { waitUntil: 'networkidle' }); await settle(page, 400); };
/** Each band slot in a cell: [kind, colour or '', title or ''] in lane order. */
const lanesOn = (page, date) => page.$$eval(`#months .day[data-date="${date}"] .unit-bars > *`, (els) => els.map((e) =>
  [e.className, e.className === 'unit-bar' ? getComputedStyle(e).backgroundColor : '', e.getAttribute('title') || '']));
const tagOn = (page, date) => page.$eval(`#months .day[data-date="${date}"]`, (c) => {
  const t = c.querySelector('.unit-tag');
  return t ? [t.textContent, t.getAttribute('title')] : null;
});
const othersOn = async (page, date) => {
  await page.click(`#months .day[data-date="${date}"]`);
  await settle(page, 200);
  const r = await page.$$eval('#drawerPacing .drawer-others li', (li) => li.map((x) => x.textContent));
  await page.click('#drawerClose');
  await settle(page, 100);
  return r;
};
const GREEN = 'rgb(46, 107, 62)', GOLD = 'rgb(201, 138, 31)', BLUE = 'rgb(31, 111, 139)';

async function scenario(label, pageEdit) {
  const p = await freshPage(pageEdit);
  // A title's dates in the browser's own short form (the dates are under test, not the locale).
  const M = await p.evaluate((ds) => Object.fromEntries(ds.map((d) => [d, new Date(d + 'T00:00:00')
    .toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })])), SCHOOL.slice(0, 12));
  const md = (iso) => M[iso];

  // three courses, Math 7 (lessons) active
  await putRaw(p, blob(THREE(), 'course_1'));
  await open(p);
  eq(await lanesOn(p, SCHOOL[0]), [
    ['unit-bar', GREEN, `Science: Cells (${md(SCHOOL[0])}–${md(SCHOOL[5])})`],
    ['unit-bar', BLUE, `History: Unit 1 (${md(SCHOOL[0])}–${md(SCHOOL[2])})`],
  ], `${label}: on the first day each other course has a lane, in order, and the active lesson course none`);
  eq(await tagOn(p, SCHOOL[0]), ['Cells +1', 'Science: Cells; History: Unit 1'], `${label}: one name fits, with +1 for the other unit starting there`);
  eq(await lanesOn(p, SCHOOL[4]), [['unit-bar', GREEN, `Science: Cells (${md(SCHOOL[0])}–${md(SCHOOL[5])})`], ['unit-gap', '', '']],
    `${label}: History has ended, so its lane is a gap and Science's stays on top`);
  eq(await tagOn(p, SCHOOL[4]), null, `${label}: no name in the middle of a unit`);
  eq((await lanesOn(p, SCHOOL[6]))[0], ['unit-bar', GOLD, `Science: Energy (${md(SCHOOL[6])}–${md(SCHOOL[9])})`], `${label}: Science's second unit follows its first`);
  eq(await tagOn(p, SCHOOL[6]), ['Energy', 'Science: Energy'], `${label}: the second unit's name is on its first day`);
  eq(await lanesOn(p, SCHOOL[10]), [], `${label}: after every unit, no band`);
  eq(await othersOn(p, SCHOOL[1]), ['Science: Cells — class day 2 of 6', 'History: U1-02-A-Cities (Unit 1)'], `${label}: the day editor lists the other courses' day in words`);
  eq(await othersOn(p, SCHOOL[8]), ['Science: Energy — class day 3 of 4', 'History: nothing planned'], `${label}: and says when a course has nothing planned`);

  // a lost day in Science moves its bands and shows in the editor
  await putRaw(p, blob(THREE(), 'course_1', (cal) => { cal.plan.courses[1].lost = [{ id: 'lost_1', date: SCHOOL[2], reason: 'Assembly' }]; }));
  await open(p);
  eq((await lanesOn(p, SCHOOL[6]))[0], ['unit-bar', GREEN, `Science: Cells (${md(SCHOOL[0])}–${md(SCHOOL[6])})`], `${label}: a lost day in Science ends Cells a class day later`);
  eq((await othersOn(p, SCHOOL[2]))[0], 'Science: didn\'t meet', `${label}: and the editor says Science didn't meet`);

  // Science active: its bands first, as the active typed course's always were
  await putRaw(p, blob(THREE(), 'course_2'));
  await open(p);
  eq((await lanesOn(p, SCHOOL[0])).map((x) => x.slice(0, 2)), [['unit-bar', GREEN], ['unit-bar', BLUE], ['unit-bar', BLUE]],
    `${label}: with Science active, its band comes first, then Math 7's and History's lanes`);
  eq((await othersOn(p, SCHOOL[0])).map((x) => x.split(':')[0]), ['Math 7', 'History'], `${label}: and the editor lists the two others`);

  // one course: as before
  await putRaw(p, blob([typedCourse('Science', 'course_2', SCIENCE)], 'course_2'));
  await open(p);
  eq(await lanesOn(p, SCHOOL[0]), [['unit-bar', GREEN, `Cells (${md(SCHOOL[0])}–${md(SCHOOL[5])})`]], `${label}: one typed course draws as before (no gap, no course in the title)`);
  eq(await tagOn(p, SCHOOL[0]), ['Cells', 'Cells'], `${label}: and its name as before`);
  eq(await p.$$eval('#drawerPacing .drawer-others', (x) => x.length), 0, `${label}: and the editor has no Other courses`);
  await putRaw(p, blob([lessonCourse('Math 7', 'course_1', MATH)], 'course_1'));
  await open(p);
  eq(await p.$$eval('#months .unit-bars', (x) => x.length), 0, `${label}: one lesson course draws no band, as before`);

  // six courses: thinner bands, still in the lower half of the cell
  const six = THREE();
  for (let k = 4; k <= 6; k++) six.push(typedCourse('Elective ' + k, 'course_' + k, [['Block ' + k, 3, '#6d4aa0']]));
  await putRaw(p, blob(six, 'course_1'));
  await open(p);
  const geo = await p.$eval(`#months .day[data-date="${SCHOOL[0]}"]`, (c) => {
    const b = c.querySelector('.unit-bars');
    return { n: b.children.length, many: b.classList.contains('many'), h: b.getBoundingClientRect().height, cell: c.getBoundingClientRect().height };
  });
  ok(geo.n === 5 && geo.many && geo.h <= geo.cell / 2, `${label}: five other courses draw five thin lanes in the lower half of the cell (${JSON.stringify(geo)})`);
  eq((await tagOn(p, SCHOOL[0]))[0], 'Cells +4', `${label}: and the name says +4`);
  eq(p.__errs, [], `${label}: the page threw nothing`);
  return p;
}

console.log('School Calendar Visualizer: unit bands for every course (Path 9 P2)');

const page = await scenario('page');
{
  await putRaw(page, blob(THREE(), 'course_1'));
  await open(page);
  await page.click(`#months .day[data-date="${SCHOOL[1]}"]`);
  await settle(page, 200);
  const v = await a11yScan(page, { include: ['#months', '#drawer'] });
  eq(v.map((x) => x.id), [], 'the month grid and the day editor have no serious or critical axe finding');
}
await page.context().close();

/* ═══ deliberate breaks: each altered page must fail the scenario ═══ */
const BREAKS = [
  ['active course only', (s) => s.replace('if (!course || planState() !== "ok") return [];\n  return cal.plan.courses.filter', 'return [];\n  return cal.plan.courses.filter')],
  ['no gap for an empty lane', (s) => s.replace('u ? barOf(u) : `<span class="unit-gap"></span>`', 'u ? barOf(u) : ""')],
  ['the active course in its own lane', (s) => s.replace('cal.plan.courses.filter(c => c.id !== course.id && placements[c.id])\n    .map', 'cal.plan.courses.filter(c => placements[c.id])\n    .map')],
  ['no other courses in the editor', (s) => s.replace('html += otherCoursesHtml(dateISO, course);', '')],
  ['no +N', (s) => s.replace('${startsHere.length > 1 ? " +" + (startsHere.length - 1) : ""}', '')],
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
