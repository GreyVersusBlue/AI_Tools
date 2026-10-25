// smoke-consumers.mjs — the first two readers of 032's school-year spine (Path 9 P3):
// 004 Classroom Timer's "Rest of this period" and 010 Command Center's period strip,
// Bell Schedule and Today panels, each reading 032's calendar through
// _shared/school-day.js and never writing it.
//
//   node Tools/school-calendar/test/smoke-consumers.mjs   (or: npm run test:school-day-consumers)
//
// What is held. 004: with no calendar saved the Countdown card has no period row (the
// card is the markup it was; golden-single-view.json holds the rest); on a B day at
// 09:00 the row names the day and Period 2's end and the button counts down to it,
// through the card's own "until" setting; a half day reads the half-day schedule over
// its letter; a passing time and a closed day leave the button off and say why; a
// calendar saved by another tab brings the row in without a reload. 010: on a B day the
// strip shows the day, the period, the minutes left and the next period from 032's
// B-day schedule; a page row with the same name lends the period its roster, which the
// bell switches to; a closed day runs no period even where the page's own rows would;
// a school day 032 has no schedule for, and unticking "Use the School Calendar's bell
// times", both put the page's rows back in charge; the Bell Schedule panel lists 032's
// periods with the current one marked; the Today panel names the letter and the
// schedule; another tab's save is picked up; neither page writes scv_calendar_v1. axe
// finds nothing serious in either page's new parts. Then the deliberate breaks: a page
// or school-day.js is altered on the wire, and each must fail.
//
// The clock is pinned per check (local time, the zone the run is in); every expected date
// is read off the seeded 2026-27 calendar with scv-pacing.js's isTeachableDay and the A/B
// letters by alternating over those days, not by school-day.js. Times in words are made
// by the browser's own toLocaleTimeString, so the locale is not under test. Exits 1 on
// any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { seedCalendar2026 } from '../scv-seed.js';
import { isTeachableDay } from '../scv-pacing.js';

const PORT = 8546;
const BASE = `http://127.0.0.1:${PORT}`;
const TIMER = BASE + '/Tools/004-Classroom%20Timer.html';
const DASH = BASE + '/Tools/010-command-center-dashboard.html';
const KEY = 'scv_calendar_v1';

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

/* ── dates off the seed, without school-day.js ── */
const SEED = seedCalendar2026();
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
}
const SCHOOL = [];
for (let d = SEED.meta.start; d <= SEED.meta.end; d = addDays(d, 1)) if (isTeachableDay(d, SEED.days, SEED.dayTypes)) SCHOOL.push(d);
const LETTER = Object.fromEntries(SCHOOL.map((d, i) => [d, i % 2 ? 'B' : 'A']));
const HALF = '2026-09-18';
const CLOSED = '2026-09-07';
const isHalf = (d) => (SEED.days[d]?.types || []).includes('halfday');
const B_DAY = SCHOOL.find((d) => LETTER[d] === 'B' && !isHalf(d) && !(SEED.days[d]?.types || []).length);
const A_DAY = SCHOOL.find((d) => LETTER[d] === 'A' && !isHalf(d) && !(SEED.days[d]?.types || []).length);
if (!SEED.days[CLOSED] || SEED.days[CLOSED].label !== 'Labor Day' || !isHalf(HALF) || SCHOOL.includes(CLOSED)) {
  console.log('FAIL the seed is not the one this suite was written against'); process.exit(1);
}

const P = (label, start, end) => ({ label, start, end });
const BELL = {
  v: 1,
  schedules: [
    { id: 'sa', name: 'Long A', periods: [P('Period 1', '07:30', '08:20'), P('Period 2', '08:25', '09:15'), P('Period 3', '09:20', '10:10'), P('Period 4', '10:15', '11:05')] },
    { id: 'sb', name: 'Long B', periods: [P('Period 1', '07:45', '08:40'), P('Period 2', '08:45', '09:40'), P('Period 3', '09:45', '10:40')] },
    { id: 'sh', name: 'Early release', periods: [P('Period 1', '07:30', '08:05'), P('Period 2', '08:10', '08:45'), P('Period 3', '08:50', '09:25')] },
  ],
  regular: null, letters: { A: 'sa', B: 'sb' }, types: { halfday: 'sh' },
};
function calendar({ bell = true } = {}) {
  const cal = seedCalendar2026();
  cal.abCycle = { enabled: true, anchorDate: SCHOOL[0], anchorLetter: 'A' };
  if (bell) cal.bell = JSON.parse(JSON.stringify(BELL));
  return JSON.stringify(cal);
}
const at = (date, hm) => new Date(`${date}T${hm}:00`);

const server = await serve(PORT);
const browser = await launch();

let edits = {};
/** A page with the clock fixed at `when` and `store` in localStorage before it loads. */
async function openAt(url, when, store) {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  await page.clock.setFixedTime(when);
  page.__errs = [];
  page.on('pageerror', (e) => page.__errs.push(String(e)));
  for (const [pat, fn] of Object.entries(edits)) {
    await page.route(pat, async (route) => {
      const res = await route.fetch();
      route.fulfill({ response: res, body: fn(await res.text()), headers: { ...res.headers() } });
    });
  }
  await page.goto(BASE + '/index.html');
  await page.evaluate((kv) => { localStorage.clear(); for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, store || {});
  await page.goto(url, { waitUntil: 'networkidle' });
  await settle(page, 300);
  return page;
}
const words = (page, hm) => page.evaluate((t) => {
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}, hm);
const text = (page, sel) => page.$eval(sel, (e) => e.textContent.trim()).catch(() => null);
const raw = (page, k) => page.evaluate((key) => localStorage.getItem(key), k);
const done = async (page, label) => {
  eq(page.__errs, [], `${label}: no page error`);
  await page.context().close();
};

async function scenario() {
  /* ═══ 004 Classroom Timer ═══ */
  {
    const p = await openAt(TIMER, at(B_DAY, '09:00'));
    eq(await p.$('#cdPeriodRow') === null, true, '004 with no calendar: no period row');
    await done(p, '004 no calendar');
  }
  {
    const cal = calendar();
    const p = await openAt(TIMER, at(B_DAY, '09:00'), { [KEY]: cal });
    eq(await text(p, '#cdPeriodNote'), `B day. Period 2 ends at ${await words(p, '09:40')} (40 min left).`,
      '004 on a B day at 09:00 names the day and the end of Period 2 (B schedule)');
    eq(await p.$eval('#cdRestOfPeriod', (b) => b.disabled), false, '...and the button is on');
    const v = await a11yScan(p, { include: ['#cdPeriodRow'] });
    eq(v.map((x) => x.id), [], '004\'s period row has no serious or critical axe finding (before it starts: a running timer dims the whole panel)');
    await p.click('#cdRestOfPeriod');
    await settle(p, 200);
    const prefs = JSON.parse(await raw(p, 'ct_prefs') || '{}');
    eq([prefs.countdown?.untilEnabled, prefs.countdown?.untilTime], [true, '09:40'], 'the button sets the card\'s "until" to the period\'s end');
    eq(await p.$eval('#cdUntilToggle', (e) => e.checked), true, '...and shows it');
    eq(await text(p, '#timeDisplay'), '40:00', 'the timer counts the 40 minutes left');
    ok(!!(await raw(p, 'ct_running_v1')), 'the timer is running');
    eq(await raw(p, KEY), cal, '004 never writes the calendar');
    await done(p, '004 B day');
  }
  {
    const p = await openAt(TIMER, at(HALF, '08:20'), { [KEY]: calendar() });
    eq(await text(p, '#cdPeriodNote'), `${LETTER[HALF]} day · Half Day / Early Dismissal · ${SEED.days[HALF].label}. Period 2 ends at ${await words(p, '08:45')} (25 min left).`,
      '004 on a half day reads the half-day schedule, not its letter\'s');
    await done(p, '004 half day');
  }
  {
    const p = await openAt(TIMER, at(A_DAY, '08:22'), { [KEY]: calendar() });
    eq(await text(p, '#cdPeriodNote'), `A day. Passing time. Period 2 starts at ${await words(p, '08:25')}.`, '004 in a passing time says so');
    eq(await p.$eval('#cdRestOfPeriod', (b) => b.disabled), true, '...and the button is off');
    await done(p, '004 passing');
  }
  {
    const p = await openAt(TIMER, at(CLOSED, '10:00'), { [KEY]: calendar() });
    eq(await text(p, '#cdPeriodNote'), 'No school: Labor Day.', '004 on a closed day names it');
    eq(await p.$eval('#cdRestOfPeriod', (b) => b.disabled), true, '...and the button is off');
    await done(p, '004 closed');
  }
  {
    const p = await openAt(TIMER, at(B_DAY, '09:00'));
    const other = await p.context().newPage();
    await other.goto(BASE + '/index.html');
    await other.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, calendar()]);
    await settle(p, 400);
    eq(await text(p, '#cdPeriodNote'), `B day. Period 2 ends at ${await words(p, '09:40')} (40 min left).`, '004 picks up a calendar another tab saves');
    await done(p, '004 other tab');
  }

  /* ═══ 010 Command Center ═══ */
  const rows = (list) => JSON.stringify({ periods: list });
  {
    const cal = calendar();
    const p = await openAt(DASH, at(B_DAY, '09:00'), { [KEY]: cal });
    eq([await text(p, '#nowDay'), await text(p, '#nowPeriod'), await text(p, '#nowLeft'), await text(p, '#nowNext')],
      ['B day', 'Period 2', '40 min left', `Next: Period 3 at ${await words(p, '09:45')}`],
      '010 on a B day: the day, the period, the minutes left and the next, from 032\'s B schedule');
    const list = await p.$$eval('[data-panel="schedule"] .cal-bell li', (li) => li.map((x) => [x.className, x.textContent]));
    eq(list.map((x) => x[0]), ['', 'current', ''], 'the Bell Schedule panel lists 032\'s three B-day periods with Period 2 marked');
    eq(await text(p, '[data-panel="schedule"] .cal-bell strong'), 'Today: Long B', '...under the schedule\'s name');
    eq(await text(p, '[data-panel="today"] .today-kind'), 'B day · Long B bell schedule', 'the Today panel names the letter and the schedule');
    const v = await a11yScan(p, { include: ['#nowStrip', '[data-panel="schedule"]', '[data-panel="today"]'] });
    eq(v.map((x) => x.id), [], '010\'s strip and panels have no serious or critical axe finding');
    await p.uncheck('#calBellBox');
    await settle(p, 200);
    eq(JSON.parse(await raw(p, 'gvb-command-center:settings')).bellSource, 'page', 'unticking the calendar\'s times is saved');
    eq(await text(p, '#nowPeriod'), '', '...and with no rows of its own the page shows no period');
    eq(await text(p, '#nowDay'), 'B day', '...but still the day');
    eq(await raw(p, KEY), cal, '010 never writes the calendar');
    await done(p, '010 B day');
  }
  {
    const p = await openAt(DASH, at(B_DAY, '09:00'), {
      [KEY]: calendar(),
      np_rosters: JSON.stringify({ Blue: ['Ada', 'Grace'], Red: ['Alan'] }),
      'gvb-command-center:settings': JSON.stringify({ rosterName: 'Red', periods: [
        { id: 'r2', label: ' period 2 ', start: '13:00', end: '13:50', roster: 'Blue' },
        { id: 'r9', label: 'Homeroom', start: '08:30', end: '09:30', roster: 'Red' },
      ] }),
    });
    eq(await text(p, '#nowPeriod'), 'Period 2', '010 follows 032 over a page row that covers the same time');
    eq(JSON.parse(await raw(p, 'gvb-command-center:settings')).rosterName, 'Blue', 'a page row of the same name lends the period its roster');
    await done(p, '010 roster');
  }
  {
    const p = await openAt(DASH, at(CLOSED, '09:00'), {
      [KEY]: calendar(),
      'gvb-command-center:settings': rows([{ id: 'r9', label: 'Homeroom', start: '08:30', end: '09:30', roster: '' }]),
    });
    eq([await text(p, '#nowDay'), await text(p, '#nowPeriod'), await text(p, '#nowNext')], ['No school: Labor Day', '', ''],
      '010 on a closed day runs no period, even where its own rows would');
    eq(await text(p, '[data-panel="today"] .today-kind'), 'No school: Labor Day', 'the Today panel says no school');
    await done(p, '010 closed');
  }
  {
    const p = await openAt(DASH, at(B_DAY, '09:00'), {
      [KEY]: calendar({ bell: false }),
      'gvb-command-center:settings': rows([{ id: 'r9', label: 'Homeroom', start: '08:30', end: '09:30', roster: '' }]),
    });
    eq([await text(p, '#nowDay'), await text(p, '#nowPeriod')], ['B day', 'Homeroom'], '010 on a day 032 has no schedule for uses its own rows');
    await done(p, '010 no schedule');
  }
  {
    const p = await openAt(DASH, at(B_DAY, '09:00'), {
      [KEY]: calendar(),
      'gvb-command-center:settings': JSON.stringify({ bellSource: 'page', periods: [{ id: 'r9', label: 'Homeroom', start: '08:30', end: '09:30', roster: '' }] }),
    });
    eq(await text(p, '#nowPeriod'), 'Homeroom', '010 with the calendar\'s times unticked uses its own rows');
    eq(await p.$eval('#calBellBox', (b) => b.checked), false, '...and shows the box unticked');
    await done(p, '010 page source');
  }
  {
    const p = await openAt(DASH, at(B_DAY, '09:00'));
    eq([await text(p, '#nowDay'), await p.$('[data-panel="schedule"] .cal-bell')], ['', null], '010 with no calendar: no day words and no calendar block');
    const other = await p.context().newPage();
    await other.goto(BASE + '/index.html');
    await other.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, calendar()]);
    await settle(p, 1500);
    eq([await text(p, '#nowDay'), await text(p, '#nowPeriod')], ['B day', 'Period 2'], '010 picks up a calendar another tab saves');
    await done(p, '010 other tab');
  }
}

console.log('Path 9 P3: 004 and 010 read the school-year spine');
await scenario();

/* ═══ deliberate breaks: each altered file must fail the scenario ═══ */
const T = '**/classroom-timer/ct-app.js', D = '**/010-command-center-dashboard.html', S = '**/_shared/school-day.js';
const BREAKS = [
  ['004: the row with no calendar', { [T]: (s) => s.replace("if (!cal) return null;", "if (!cal) return { can: false, end: null, text: '' };") }],
  ['004: the button on in a passing time', { [T]: (s) => s.replace("return { can: at.state === 'in',", "return { can: !!(at.period || at.next),") }],
  ['004: "until" left off', { [T]: (s) => s.replace("untilEnabled: true, untilTime: o.end", "untilEnabled: false, untilTime: o.end") }],
  ['004: no storage listener', { [T]: (s) => s.replace("if (e.key === null || (window.SchoolDay && e.key === window.SchoolDay.KEY)) renderPeriodOffer();", '') }],
  ['010: the page\'s rows always', { [D]: (s) => s.replace("if (t && t.day.schedule && t.day.schedule.periods.length) {", 'if (false) {') }],
  ['010: a closed day runs the rows', { [D]: (s) => s.replace("if (t && (t.day.why === 'weekend' || t.day.why === 'closed')) return", 'if (false) return') }],
  ['010: no roster by name', { [D]: (s) => s.replace("var row = periods().filter(function (r) { return sameName(r.label, p.label); })[0];", 'var row = null;') }],
  ['010: the box ignored', { [D]: (s) => s.replace("function usesCalendar() { return settings.bellSource !== 'page'; }", 'function usesCalendar() { return true; }') }],
  ['010: another tab ignored', { [D]: (s) => s.replace("forgetCalendar();\n      renderNow();", 'renderNow();') }],
  ['school-day: half day over its letter lost', { [S]: (s) => s.replace("var id = own(bell.types, t.id) ? bell.types[t.id] : null;", 'var id = null;') }],
];
let caught = 0;
for (const [name, e] of BREAKS) {
  edits = e;
  quiet = true; breakFails = 0;
  try { await scenario(); } catch (err) { breakFails++; }
  quiet = false;
  for (const c of browser.contexts()) await c.close().catch(() => {});
  if (breakFails) caught++; else { failed++; fails.push('break not caught: ' + name); console.log('  FAIL break not caught: ' + name); }
}
edits = {};

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed; ${caught}/${BREAKS.length} deliberate breaks caught`);
if (failed) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
