// smoke-plan-buffers.mjs — 032's buffer days, "Split into A and B" and the new-year carry, in
// the page (Path 9 P2, increment 4). scv-plan.js's buffers, splitByLetter() and
// carryForward() are held by plan.test.mjs; this holds what the page does with them.
//
//   node Tools/school-calendar/test/smoke-plan-buffers.mjs   (or: npm run test:school-calendar-plan-buffers)
//
// What is held: a lesson list with two BUF lessons in its first unit shows 2 in the Buffer
// column; with buffers off (the default) a snow day inside that unit moves the next unit a
// class day later; with "Buffer days take a lost day" ticked the same snow day uses a buffer
// day instead (the bar says so, the next unit's first lesson keeps its date, the BUF lesson
// is stored with no date, the column says "2 (1 used)" and the notes name the date), and
// Undo writes the old bytes back. "Split into A and B…" with the A/B cycle off explains and
// cannot be applied; with it on the preview says no lesson changes date, the split makes an
// A course and a B course with every lesson on its old date, and Undo puts the one course
// back. "Start New Year" carries the course with its lessons and buffer days, drops its pin,
// bump, lost day and baseline (the confirm counts each), and starts it on the new year's
// first day. The card has no serious axe finding. Then the deliberate breaks: the scenario
// is run against a page whose scv-plan.js is altered on the wire, and each must fail.
//
// The clock is pinned (2026-08-20 10:00 local while planning, then the seed's third school
// day at 10:00); every expected date is read off the seeded 2026-27 calendar with
// scv-pacing.js's isTeachableDay, not with the module under test. Nothing here describes a
// real class. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { seedCalendar2026 } from '../scv-seed.js';
import { isTeachableDay } from '../scv-pacing.js';

const PORT = 8544;
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

/* ── dates off the seed, without scv-plan.js ── */
const SEED = seedCalendar2026();
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
}
const SCHOOL = [];
for (let d = SEED.meta.start; d <= SEED.meta.end; d = addDays(d, 1)) if (isTeachableDay(d, SEED.days, SEED.dayTypes)) SCHOOL.push(d);
const PLANNING = new Date('2026-08-20T10:00:00');
const LATER = new Date(SCHOOL[2] + 'T10:00:00');

// Unit 1: eight lessons and two buffer days; unit 2: ten lessons. Letters alternate from A.
const CODES = [];
for (let k = 1; k <= 8; k++) CODES.push(`U1-0${k}-${k % 2 ? 'A' : 'B'}-Lesson ${k}`);
CODES.push('U1-BUF1-A-Review', 'U1-BUF2-B-Review');
for (let k = 1; k <= 10; k++) CODES.push(`U2-${String(k).padStart(2, '0')}-${k % 2 ? 'A' : 'B'}-Topic ${k}`);

const server = await serve(PORT);
const browser = await launch();

async function freshPage(now, routes = {}) {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  await page.clock.setFixedTime(now);
  page.__answers = [];
  page.__seen = [];
  page.__errs = [];
  page.on('pageerror', (e) => page.__errs.push(String(e)));
  page.on('dialog', (d) => {
    page.__seen.push(d.message());
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
const snow = async (page, date) => { await openDay(page, date); page.__answers.push('Snow Day'); await page.click('#drawerSnow'); await settle(page, 300); };
const bufferCells = (page) => page.$$eval('#unitTable tbody tr', (rows) => rows.map((r) => r.cells[7].textContent.trim()));
const onOf = (cal, n) => cal.plan.courses[0].lessons[n - 1].on; // lesson n, 1-based

async function scenario(label, routes = {}) {
  // planning, before the year
  const a = await freshPage(PLANNING, routes);
  await a.goto(BASE + '/index.html');
  await putRaw(a, null);
  await open(a);
  await a.fill('#paceInput', CODES.join('\n'));
  await a.click('#btnPaceDistribute');
  await settle(a, 300);
  const planned = await raw(a);
  eq(await bufferCells(a), ['2', '0'], `${label}: the Buffer column counts the BUF lessons`);
  ok(!(await a.isChecked('#courseAbsorb')), `${label}: buffers are off by default`);
  await a.context().close();

  // a later day: buffers off
  const p = await freshPage(LATER, routes);
  await p.goto(BASE + '/index.html');
  await putRaw(p, planned);
  await open(p);
  await snow(p, SCHOOL[4]);
  let cal = await stored(p);
  eq(onOf(cal, 11), SCHOOL[11], `${label}: buffers off, a snow day inside unit 1 moves unit 2 a class day later`);
  await p.click('#planUndo');
  await settle(p, 300);
  ok((await raw(p)) === planned, `${label}: Undo puts it back`);
  // buffers on
  await p.check('#courseAbsorb');
  await settle(p, 300);
  cal = await stored(p);
  eq([cal.plan.courses[0].absorb, onOf(cal, 11)], [true, SCHOOL[10]], `${label}: ticking the box is saved, and moves nothing`);
  const beforeSnow = await raw(p);
  await snow(p, SCHOOL[4]);
  cal = await stored(p);
  eq([onOf(cal, 11), onOf(cal, 10), onOf(cal, 9), cal.plan.courses[0].units[0].buffered], [SCHOOL[10], null, SCHOOL[10 - 1], 1], `${label}: buffers on, the same snow day uses BUF2, and unit 2 keeps its date`);
  ok((await notice(p)).includes('Unit 1 used 1 buffer day'), `${label}: the bar says a buffer day was used (${await notice(p)})`);
  eq(await bufferCells(p), ['2 (1 used)', '0'], `${label}: the Buffer column says one was used`);
  const nt = (await p.textContent('#unitNotes'));
  const md = (iso) => (+iso.slice(5, 7)) + '/' + (+iso.slice(8, 10));
  ok(nt.includes('Unit 1 used a buffer day, for ') && nt.includes(md(SCHOOL[4]) + ', so it still ends ') && nt.endsWith(md(SCHOOL[9]) + '.'), `${label}: the notes name the lost day (${nt})`);
  await p.click('#planUndo');
  await settle(p, 300);
  ok((await raw(p)) === beforeSnow, `${label}: Undo writes the old bytes back`);

  // split, with the cycle off
  await p.click('#btnCourseSplit');
  await settle(p, 200);
  ok((await p.textContent('#splitBox')).includes('Turn the A/B Day Cycle on') && await p.isDisabled('#splitApply'), `${label}: with the A/B cycle off the split explains and cannot be applied`);
  // with it on
  const withCycle = JSON.parse(beforeSnow);
  withCycle.abCycle = { enabled: true, anchorDate: SCHOOL[0], anchorLetter: 'A' };
  await putRaw(p, JSON.stringify(withCycle));
  await open(p);
  const beforeSplit = await raw(p);
  const was = (await stored(p)).plan.courses[0].lessons.map((l) => [l.raw, l.on]);
  await p.click('#btnCourseSplit');
  await settle(p, 200);
  ok((await p.textContent('#splitBox')).includes('No lesson changes date.'), `${label}: the split preview says no lesson changes date`);
  await p.click('#splitApply');
  await settle(p, 300);
  cal = await stored(p);
  const cs = cal.plan.courses;
  eq(cs.map((c) => [c.name, c.meets, c.lessons.length]), [['Course 1 (A)', 'A', 10], ['Course 1 (B)', 'B', 10]], `${label}: the split makes an A course and a B course`);
  eq(cs.flatMap((c) => c.lessons.map((l) => [l.raw, l.on])).sort(), was.sort(), `${label}: every lesson keeps its date`);
  ok((await notice(p)).startsWith('Split “Course 1” into'), `${label}: the bar says what was split (${await notice(p)})`);
  await p.click('#planUndo');
  await settle(p, 300);
  ok((await raw(p)) === beforeSplit, `${label}: Undo puts the one course back`);

  // the new year
  const old = JSON.parse(beforeSnow);
  const c0 = old.plan.courses[0];
  c0.units[1].pin = SCHOOL[12];
  c0.lost = [{ id: 'lost_1', date: SCHOOL[3], reason: 'Assembly' }];
  c0.adjustments = [{ id: 'adj_1', beforeLessonId: c0.lessons[2].id, reason: 'Ran long', createdOn: SCHOOL[2] }];
  await putRaw(p, JSON.stringify(old));
  await open(p);
  p.__seen.length = 0;
  p.__answers.push('Next year', '2027-08-30', '2028-06-09');
  await p.click('#btnNewYear');
  await settle(p, 400);
  const carry = p.__seen.find((m) => m.startsWith('Carry')) || '';
  ok(carry.startsWith('Carry the course “Course 1” (20 lessons, 2 units) into the new year?') && carry.includes('Cleared: 1 pin, 1 bump, 1 day a course didn\'t meet, 1 plan behind is measured against.'), `${label}: the confirm counts what is kept and cleared (${carry})`);
  cal = await stored(p);
  const n = cal.plan.courses[0];
  eq([cal.meta.start, n.name, n.absorb, n.lessons.length, n.adjustments, n.lost, n.units.map((u) => u.pin), n.lessons[0].on, n.baseline && n.baseline.start],
    ['2027-08-30', 'Course 1', true, 20, [], [], [null, null], '2027-08-30', '2027-08-30'], `${label}: the new year keeps the lessons and buffers, drops the pin, bump and lost day, and starts on its first day`);
  eq(p.__errs, [], `${label}: the page threw nothing`);
  return p;
}

console.log('School Calendar Visualizer: buffer days, the A/B split and the new year (Path 9 P2 increment 4)');

const page = await scenario('page');
{
  await page.click('#btnCourseSplit').catch(() => {});
  const v = await a11yScan(page, { include: ['.pacing-card'] });
  eq(v.map((x) => x.id), [], 'the Courses card has no serious or critical axe finding');
}
await page.context().close();

/* ═══ deliberate breaks: each altered module must fail the scenario ═══ */
const BREAKS = [
  ['buffers never taken', { 'scv-plan.js': (s) => s.replace('if (!course.absorb) return [];', 'return [];') }],
  ['buffer days counted short', { 'scv-plan.js': (s) => s.replace('if (isBuf.has(k)) { if (st) st.buffered++; return; }', 'if (isBuf.has(k)) { if (st) st.short++; return; }') }],
  ['split keeps both letters', { 'scv-plan.js': (s) => s.replace('c.lessons = c.lessons.filter((l) => l.letter === L);', '') }],
  ['carry keeps pins', { 'scv-plan.js': (s) => s.replace('...u, pin: null, start: null,', '...u, start: null,') }],
];
let caught = 0;
for (const [name, routes] of BREAKS) {
  quiet = true; breakFails = 0;
  let r = null;
  try { r = await scenario(name, routes); } catch (e) { breakFails++; }
  quiet = false;
  if (r) await r.context().close().catch(() => {});
  if (breakFails) caught++; else { failed++; fails.push('break not caught: ' + name); console.log('  FAIL break not caught: ' + name); }
}

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed; ${caught}/${BREAKS.length} deliberate breaks caught`);
if (failed) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
