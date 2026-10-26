// smoke-plan.mjs — 032's pacing that recomputes around lost days, in the page (Path 9 P2,
// increment 1's page half). scv-plan.js itself is held by plan.test.mjs; this holds what the
// page does with it.
//
//   node Tools/school-calendar/test/smoke-plan.mjs   (or: npm run test:school-calendar-plan-page)
//
// What is held: a v2 blob with lessons, bumps and dated units loads with every lesson in the
// cell it was in, becomes the course "Course 1", says so, and leaves `cal.units`, the days, the
// day types and the year (what 010 and 045 read) unchanged in storage; Undo of that writes the
// old bytes back; the .ics lists every lesson on its old date; the snow-day shortcut, "This
// class didn't meet" and "This lesson needs another day" each move the lessons after, say so in
// the notice bar, and Undo puts the stored bytes back exactly; a lost date is taken back from
// the drawer; a blob whose stamped dates are stale shows the bar and is not written until
// "Keep these dates"; a second course is its own track; an A-day course with the cycle off says
// so; a plan from a newer page is read-only and written back untouched; a broken one is kept in
// `planBroken`; a calendar with no pacing is not written on load; and the card and bar have no
// serious axe finding. Then the deliberate breaks: the same checks run against a page whose
// scv-plan.js is altered on the wire, and each must fail.
//
// The clock is pinned (2026-09-15 10:00 local), and every date in the fixtures is read off the
// seeded 2026-27 calendar by the page's own modules, not typed by hand. Nothing here describes
// a real class. Exits 1 on any failure.

import { dayRuns } from '../scv-ics.js';
import { serve, launch, prepPage, settle, a11yScan, downloadText } from '../../board-check/harness.mjs';
import { seedCalendar2026 } from '../scv-seed.js';
import { parseLessonList, placeLessons, isTeachableDay } from '../scv-pacing.js';

const PORT = 8541;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/032-School%20Calendar%20Visualizer.html';
const NOW = new Date('2026-09-15T10:00:00');

let passed = 0, failed = 0;
const fails = [];
let quiet = false; // during a deliberate break, checks are counted by the break, not printed
let breakFails = 0;
const ok = (cond, label) => {
  if (quiet) { if (!cond) breakFails++; return !!cond; }
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* ── the fixture: the seeded year, 40 lessons in three units, one bump, one dated unit ── */
const LESSON_TEXT = [];
for (let i = 1; i <= 40; i++) {
  const unit = i <= 14 ? 1 : i <= 28 ? 2 : 3;
  LESSON_TEXT.push(`U${unit}-${String(i).padStart(2, '0')}-${i % 2 ? 'A' : 'B'}-Lesson ${i}`);
}
function legacyBlob() {
  const cal = seedCalendar2026();
  const { lessons } = parseLessonList(LESSON_TEXT.join('\n'));
  cal.pacing = {
    startDate: cal.meta.start,
    lessons,
    adjustments: [{ id: 'adj_fixture', beforeLessonId: lessons[4].id, reason: 'Ran long', createdOn: '2026-09-04' }],
  };
  cal.units = [{ id: 'unit_dated', name: 'Dated unit', start: '2026-09-01', end: '2026-09-30', color: '#2e6b8f' }];
  return cal;
}
const LEGACY = legacyBlob();
const legacyPlace = (cal) => placeLessons({
  lessons: cal.pacing.lessons, adjustments: cal.pacing.adjustments,
  startISO: cal.pacing.startDate || cal.meta.start, endISO: cal.meta.end,
  isTeachable: (d) => isTeachableDay(d, cal.days, cal.dayTypes),
});
const OLD = legacyPlace(LEGACY);
const dateOf = (n) => OLD.dateByLessonId['les_' + n]; // where lesson n was before

const server = await serve(PORT);
const browser = await launch();

async function freshPage(routes = {}) {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  await page.clock.setFixedTime(NOW);
  page.__answers = [];
  page.on('dialog', (d) => {
    const a = page.__answers.length ? page.__answers.shift() : null;
    if (a === false) return d.dismiss();
    return d.type() === 'prompt' ? d.accept(a === null ? d.defaultValue() : String(a)) : d.accept();
  });
  for (const [file, edit] of Object.entries(routes)) {
    await page.route('**/school-calendar/' + file, async (route) => {
      const res = await route.fetch();
      route.fulfill({ response: res, body: edit(await res.text()), headers: { ...res.headers(), 'content-type': 'text/javascript' } });
    });
  }
  return page;
}
const raw = (page) => page.evaluate(() => localStorage.getItem('scv_calendar_v1'));
const stored = async (page) => JSON.parse(await raw(page) || 'null');
const putRaw = (page, s) => page.evaluate((v) => { if (v === null) localStorage.removeItem('scv_calendar_v1'); else localStorage.setItem('scv_calendar_v1', v); }, s);
const open = async (page) => { await page.goto(URL_PAGE, { waitUntil: 'networkidle' }); await settle(page, 400); };
const notice = async (page) => (await page.isVisible('#planNotice')) ? (await page.textContent('#planNoticeText')).trim() : '';
const openDay = async (page, date) => { await page.click(`#months .day[data-date="${date}"]`); await settle(page, 200); };
const lessonOn = (cal, n) => {
  const c = cal.plan.courses.find((x) => x.id === cal.plan.active);
  const l = c.lessons.find((x) => x.id === 'les_' + n);
  return l && l.on;
};
const cellPaced = (page, date) => page.evaluate((d) => {
  const el = document.querySelector(`#months .day[data-date="${d}"] .paced`);
  return el ? el.textContent : '';
}, date);

/** The scenario every break re-runs: load the legacy blob, then a snow day on lesson 10's date. */
async function scenario(page, label) {
  await page.goto(BASE + '/index.html');
  await putRaw(page, JSON.stringify(LEGACY));
  await open(page);
  const after = await stored(page);
  ok(after && after.plan && after.plan.courses.length === 1, `${label}: the sequence became one course`);
  ok(after && Array.isArray(after.pacing.lessons) && after.pacing.lessons.length === 0, `${label}: and cal.pacing was emptied`);
  ok(after && [1, 5, 10, 25, 40].every((n) => lessonOn(after, n) === dateOf(n)), `${label}: every lesson is stamped with the date it had`);
  ok((await notice(page)).includes('No date changed'), `${label}: the bar says no date changed`);
  const before = await raw(page);
  await openDay(page, dateOf(10));
  page.__answers.push('Snow Day');
  await page.click('#drawerSnow');
  await settle(page, 300);
  const snowed = await stored(page);
  const text = await notice(page);
  ok(/Marking .* as Snow Day: Moved 31 lessons one class day later/.test(text), `${label}: the snow day's bar says what moved (${text})`);
  ok(lessonOn(snowed, 10) !== dateOf(10) && lessonOn(snowed, 10) === dateOf(11), `${label}: lesson 10 is stamped on the next class day`);
  await page.click('#planUndo');
  await settle(page, 300);
  ok((await raw(page)) === before, `${label}: Undo writes the stored bytes back exactly`);
}

console.log('School Calendar Visualizer: courses and pacing that recomputes (Path 9 P2)');

/* ═══ 1. a calendar with no pacing is not written on load, and shows no bar ═══ */
{
  const page = await freshPage();
  await open(page);
  eq(await raw(page), null, 'a first visit with no pacing writes nothing on load');
  eq(await notice(page), '', 'and shows no notice');
  ok(await page.isVisible('#coursesTitle'), 'the Courses card is shown');
  ok(!(await page.isVisible('#courseFields')), 'with no course, no course fields are shown');
  eq(await page.textContent('#paceStatus'), 'No lessons paced yet — paste a list above or import the county spreadsheet.', 'and it reads as the Lesson Pacing card did');
  await page.context().close();
}

/* ═══ 2. migration, Undo of it, the .ics ═══ */
const page = await freshPage();
await scenario(page, 'migration');
{
  const legacyBytes = JSON.stringify(LEGACY);
  await putRaw(page, legacyBytes);
  await open(page);
  const cal = await stored(page);
  eq(cal.units, LEGACY.units, 'cal.units (the dated units) is unchanged in storage');
  eq([cal.days, cal.dayTypes, cal.meta, cal.__v], [LEGACY.days, LEGACY.dayTypes, LEGACY.meta, 2], 'and so are the days, day types, year and __v (what 010 and 045 read)');
  eq(cal.plan.courses[0].adjustments.map((a) => [a.id, a.beforeLessonId, a.on]), [['adj_fixture', 'les_5', OLD.vacated && Object.keys(OLD.vacated)[0]]], 'the bump came with its lesson and is stamped on the day it empties');
  const cells = [];
  for (const n of [1, 4, 5, 6, 14, 15, 30, 40]) cells.push(await cellPaced(page, dateOf(n)));
  ok([1, 4, 5, 6, 14, 15, 30, 40].every((n, i) => cells[i].includes(LESSON_TEXT[n - 1].split('-').slice(0, 3).join('-'))), `every sampled lesson is in the cell it was in (${cells.join(' | ')})`);
  eq(await page.inputValue('#courseName'), 'Course 1', 'the course is named Course 1');
  const units = await page.$$eval('#unitTable tbody tr', (rows) => rows.map((r) => [r.querySelector('input').value, r.cells[1].textContent]));
  eq(units, [['Unit 1', '15, 1 half day'], ['Unit 2', '14'], ['Unit 3', '12, 1 half day']], 'the unit table lists the three runs with their class days (the bump counts in U1)');
  const ics = await downloadText(page, '#btnExportIcs', { what: 'the .ics' });
  const events = ics.split('BEGIN:VEVENT').slice(1);
  // Since Path 9 P4 a lesson is its own event (X-SCV-KIND:lesson), named by its course, its
  // code and its title, on the date stamped for it; the days are one event per run of dates.
  const lessonEvents = events.filter((e) => e.includes('X-SCV-KIND:lesson'));
  const missing = Object.entries(OLD.dateByLessonId).filter(([id, d]) => {
    const [u, n, l, ...title] = OLD.byDate[d].raw.split('-');
    return !lessonEvents.some((e) => e.includes('DTSTART;VALUE=DATE:' + d.replace(/-/g, '')) && e.includes(`SUMMARY:Course 1: ${u}-${n}-${l} ${title.join('-')}`));
  });
  eq(missing.length, 0, 'the .ics lists every lesson on the date the old page gave it');
  eq([lessonEvents.length, events.filter((e) => e.includes('X-SCV-KIND:day')).length], [Object.keys(OLD.dateByLessonId).length + 1, dayRuns(LEGACY).length],
    'and has one event per lesson, one for the bump\'s catch-up day and one per run of tagged days');
  await page.click('#planUndo');
  await settle(page, 300);
  eq(await raw(page), legacyBytes, 'Undo of the migration writes the old bytes back');
}

/* ═══ 3. the two drawer actions, and taking a lost date back ═══ */
{
  await putRaw(page, JSON.stringify(LEGACY));
  await open(page);
  const start = await raw(page);
  await openDay(page, dateOf(12));
  ok((await page.textContent('#drawerPacing')).includes("This class didn't meet"), 'the drawer offers "This class didn\'t meet…"');
  ok((await page.textContent('#drawerPacing')).includes('This lesson needs another day'), 'and "This lesson needs another day…"');
  page.__answers.push('Assembly');
  await page.click('#drawerLost');
  await settle(page, 300);
  let cal = await stored(page);
  const c = cal.plan.courses[0];
  eq(c.lost.map((x) => [x.date, x.reason]), [[dateOf(12), 'Assembly']], 'a lost date is saved on the course, with its reason');
  eq(cal.days[dateOf(12)], LEGACY.days[dateOf(12)], 'and the day itself is not tagged');
  eq([lessonOn(cal, 11), lessonOn(cal, 12)], [dateOf(11), dateOf(13)], 'lesson 11 stays, lesson 12 moves to the next class day');
  ok((await notice(page)).includes("didn't meet on"), 'the bar names the change');
  await openDay(page, dateOf(12));
  ok((await page.textContent('#drawerPacing')).includes('Assembly'), 'the lost day\'s drawer shows the reason');
  await page.click('#drawerUnlost');
  await settle(page, 300);
  cal = await stored(page);
  eq([cal.plan.courses[0].lost.length, lessonOn(cal, 12)], [0, dateOf(12)], '"It met after all" takes the date back and lesson 12 returns');
  await openDay(page, dateOf(20));
  page.__answers.push('Ran long');
  await page.click('#drawerBump');
  await settle(page, 300);
  cal = await stored(page);
  eq([lessonOn(cal, 19), lessonOn(cal, 20), lessonOn(cal, 21)], [dateOf(19), dateOf(21), dateOf(22)], '"needs another day" moves that lesson and the ones after by one class day');
  eq(cal.plan.courses[0].adjustments.length, 2, 'and adds a bump anchored to it');
  ok((await notice(page)).includes('needs another day: Moved'), 'the bar says so');
  await page.click('#planUndo');
  await settle(page, 300);
  cal = await stored(page);
  eq(cal.plan.courses[0].adjustments.length, 1, 'Undo takes the bump back off');
  void start;
}

/* ═══ 4. stale stamped dates: shown, not written, until kept ═══ */
{
  const cal = await stored(page);
  cal.plan.courses[0].lessons[7].on = '2026-09-01';
  const staleBytes = JSON.stringify(cal);
  await putRaw(page, staleBytes);
  await open(page);
  const t = await notice(page);
  ok(t.includes('not the ones this calendar gives now') && t.includes('Moved 1 lesson'), `a blob with a stale date shows the bar (${t})`);
  ok(await page.isVisible('#planKeep'), 'with "Keep these dates"');
  eq(await raw(page), staleBytes, 'and nothing is written on load');
  await page.click('#planKeep');
  await settle(page, 300);
  eq(lessonOn(await stored(page), 8), dateOf(8), '"Keep these dates" stamps the placer\'s date');
  eq(await notice(page), '', 'and the bar goes');
}

/* ═══ 5. a second course, and an A-day course with the cycle off ═══ */
{
  page.__answers.push('Science');
  await page.click('#btnCourseAdd');
  await settle(page, 300);
  let cal = await stored(page);
  eq(cal.plan.courses.map((c) => c.name), ['Course 1', 'Science'], '+ New course adds a second course');
  eq(cal.plan.active, cal.plan.courses[1].id, 'and makes it the one shown');
  eq(await cellPaced(page, dateOf(1)), '', 'the grid shows the new, empty course');
  await page.fill('#paceInput', 'U1-01-A-Cells\nU1-02-B-Tissues\nU1-03-A-Organs');
  await page.click('#btnPaceDistribute');
  await settle(page, 300);
  cal = await stored(page);
  const sci = cal.plan.courses[1];
  eq(sci.lessons.map((l) => l.on), [dateOf(1), dateOf(2), dateOf(3)], 'Distribute paces the second course from the year\'s first class day');
  eq(cal.plan.courses[0].lessons.length, 40, 'and the first course keeps its lessons');
  await page.selectOption('#courseMeets', 'A');
  await settle(page, 300);
  ok((await page.textContent('#courseProblems')).includes('A/B Day Cycle is off'), 'an A-day course with the cycle off says so');
  await page.click('#courseTabs button >> nth=0');
  await settle(page, 300);
  ok((await cellPaced(page, dateOf(1))).includes('U1-01-A'), 'picking Course 1 shows its lessons again');
  /* the card and the bar, scanned */
  await openDay(page, dateOf(3));
  page.__answers.push('Snow Day');
  await page.click('#drawerSnow');
  await settle(page, 300);
  ok(await page.isVisible('#planNotice'), 'the bar is up for the scan');
  const v = await a11yScan(page, { include: ['.pacing-card', '#planNotice'] });
  eq(v.map((x) => x.id), [], 'the Courses card and the notice bar have no serious or critical axe finding');
}

/* ═══ 6. a newer plan is read-only; a broken one is kept ═══ */
{
  const newer = JSON.parse(JSON.stringify(LEGACY));
  newer.pacing = { startDate: null, lessons: [], adjustments: [] };
  newer.plan = { v: 2, active: 'x', algo: 9, courses: [{ id: 'x', name: 'From the future', futureField: true }] };
  const nb = JSON.stringify(newer);
  await putRaw(page, nb);
  await open(page);
  ok(await page.isVisible('#planReadOnly'), 'a plan from a newer page shows the read-only note');
  ok(await page.isDisabled('#paceInput'), 'and its lesson box is disabled');
  eq(await raw(page), nb, 'and nothing is written on load');
  await page.fill('#metaLabel', 'Renamed');
  await page.click('#btnApplyMeta');
  await settle(page, 300);
  eq((await stored(page)).plan, newer.plan, 'a later save writes the newer plan back untouched');

  const broken = JSON.parse(JSON.stringify(LEGACY));
  broken.pacing = { startDate: null, lessons: [], adjustments: [] };
  broken.plan = 'not a plan';
  await putRaw(page, JSON.stringify(broken));
  await open(page);
  const cal = await stored(page);
  eq([cal.planBroken, cal.plan], ['not a plan', undefined], 'a broken plan is kept in planBroken, and an empty plan is not written');
  ok((await notice(page)).includes('could not be read'), 'and the bar says so');
}
eq(page.__errs || [], [], 'the page threw nothing');
await page.context().close();

/* ═══ 7. deliberate breaks: each altered module must fail the scenario ═══ */
const BREAKS = [
  ['describeDiff says nothing', { 'scv-plan.js': (s) => s.replace('export function describeDiff(diff) {', 'export function describeDiff(diff) { return "";') }],
  ['stamp writes no dates', { 'scv-plan.js': (s) => s.replace('(c.lessons || []).forEach((l) => { l.on = p.dateByLessonId[l.id] || null; });', '') }],
  ['absorbLegacy leaves cal.pacing', { 'scv-plan.js': (s) => s.replace('out.pacing = emptyPacing();', '') }],
  ['the placer ignores closures', { 'scv-plan.js': (s) => s.replace('if (closing) { out.why = "closed:" + closing.id; return out; }', '') }],
  ['diffPlacement sees no move', { 'scv-plan.js': (s) => s.replace('if (to && to !== from) moved.push', 'if (false) moved.push') }],
];
let caught = 0;
for (const [name, routes] of BREAKS) {
  const p = await freshPage(routes);
  quiet = true; breakFails = 0;
  try { await scenario(p, name); } catch (e) { breakFails++; }
  quiet = false;
  if (breakFails) caught++; else { failed++; fails.push('break not caught: ' + name); console.log('  FAIL break not caught: ' + name); }
  await p.context().close();
}

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed; ${caught}/${BREAKS.length} deliberate breaks caught`);
if (failed) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
