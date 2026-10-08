// smoke-weeks-core.mjs — the A/B letters and the weeks of the School Calendar Visualizer,
// walked in pure Node over whole school years.
//
//   node Tools/school-calendar/test/smoke-weeks-core.mjs
//
// Three things are held here.
//
//   1. The letter of every school day is the one the month grid has always shown: the new
//      module (scv-weeks.js) is compared with a copy of the page's OLD function, which is
//      written below in local-time Date arithmetic exactly as the page had it, and with
//      properties that do not come from either: the letters alternate on school days and only
//      on school days, a weekend or a no-school day never takes one and never advances the cycle.
//   2. The one quirk of that rule (ANCHOR_QUIRK) is pinned by name, so that the day somebody
//      fixes it, on purpose, this suite says so.
//   3. Dates are calendar dates. Every date is checked against integer arithmetic that never
//      touches Date, and the file runs itself again under four zones, two of which change
//      their clocks at midnight, so a daylight-saving week cannot move a day.
//
// Everything here is made up. Exits 1 on any failure.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODULE = process.env.SCV_WEEKS_MODULE || path.join(HERE, '..', 'scv-weeks.js');
const W = await import(pathToFileURL(MODULE).href);
const { DEFAULT_DAY_TYPES } = await import(pathToFileURL(path.join(HERE, '..', 'scv-seed.js')).href);

/* ── the zones ─────────────────────────────────────────────────────────── */
const ZONES = ['UTC', 'America/New_York', 'America/Havana', 'Pacific/Auckland'];
if (!process.env.SCV_ZONE_CHILD) {
  let bad = 0;
  for (const tz of ZONES) {
    try {
      const out = execFileSync(process.execPath, [fileURLToPath(import.meta.url)], {
        env: { ...process.env, TZ: tz, SCV_ZONE_CHILD: '1' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
      console.log(`[TZ=${tz}] ${out.trim().split('\n').pop()}`);
    } catch (e) {
      bad++;
      console.log(`[TZ=${tz}] FAILED\n${String(e.stdout || '').split('\n').filter((l) => /FAIL/.test(l)).slice(0, 12).join('\n')}`);
    }
  }
  process.exit(bad ? 1 : 0);
}

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; if (fails.length < 40) fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* ── integer calendar arithmetic that never calls Date ─────────────────── */
function daysFromCivil(y, m, d) {            // days since 1970-01-01
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400), yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function civilFromDays(z) {
  z += 719468;
  const era = Math.floor(z / 146097), doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1, m = mp + (mp < 10 ? 3 : -9);
  return [yoe + era * 400 + (m <= 2 ? 1 : 0), m, d];
}
const dn = (iso) => { const [y, m, d] = iso.split('-').map(Number); return daysFromCivil(y, m, d); };
const fromDn = (n) => { const [y, m, d] = civilFromDays(n); return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; };
const dowOf = (iso) => ((dn(iso) % 7) + 11) % 7;           // 1970-01-01 was a Thursday (4); 0 = Sunday
const range = (a, b) => { const out = []; for (let n = dn(a); n <= dn(b); n++) out.push(fromDn(n)); return out; };

/* ── calendars ─────────────────────────────────────────────────────────── */
const noSchoolIds = new Set(DEFAULT_DAY_TYPES.filter((t) => t.noSchool).map((t) => t.id));
function makeCal({ start, end, off = [], half = [], anchor, letter = 'A', enabled = true }) {
  const days = {};
  for (const d of off) days[d] = { types: ['holiday'], label: 'Closed', note: '', lesson: '' };
  for (const d of half) days[d] = { types: ['halfday'], label: 'Early', note: '', lesson: '' };
  return {
    meta: { yearLabel: 'Test year', start, end },
    dayTypes: DEFAULT_DAY_TYPES.map((t) => ({ ...t })),
    days,
    abCycle: anchor ? { enabled, anchorDate: anchor, anchorLetter: letter } : undefined,
  };
}
/* a school day, judged without the module under test */
const isSchool = (cal, iso) => {
  const w = dowOf(iso);
  if (w === 0 || w === 6) return false;
  const e = cal.days[iso];
  return !(e && e.types.some((id) => noSchoolIds.has(id)));
};

/* the page's OLD buildAbMap, as it was (local-time Date arithmetic) */
function oldAbMap(cal) {
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const elig = (d) => isSchool(cal, d);
  const between = (a, b) => {
    let n = 0; const cur = new Date(a + 'T00:00:00'), end = new Date(b + 'T00:00:00');
    cur.setDate(cur.getDate() + 1);
    while (cur < end) { if (elig(iso(cur.getFullYear(), cur.getMonth(), cur.getDate()))) n++; cur.setDate(cur.getDate() + 1); }
    return n;
  };
  const map = {}; const ac = cal.abCycle;
  if (!ac || !ac.enabled || !ac.anchorDate) return map;
  const anchorLetter = ac.anchorLetter === 'B' ? 'B' : 'A';
  const lo = ac.anchorDate < cal.meta.start ? ac.anchorDate : cal.meta.start;
  const hi = ac.anchorDate > cal.meta.end ? ac.anchorDate : cal.meta.end;
  if (lo > hi) return map;
  let letter;
  if (lo === ac.anchorDate) letter = anchorLetter;
  else { const n = lo < ac.anchorDate ? between(lo, ac.anchorDate) : between(ac.anchorDate, lo); letter = n % 2 === 0 ? anchorLetter : (anchorLetter === 'A' ? 'B' : 'A'); }
  const cur = new Date(lo + 'T00:00:00'), end = new Date(hi + 'T00:00:00');
  while (cur <= end) {
    const c = iso(cur.getFullYear(), cur.getMonth(), cur.getDate());
    if (elig(c)) { map[c] = letter; letter = letter === 'A' ? 'B' : 'A'; }
    cur.setDate(cur.getDate() + 1);
  }
  return map;
}

/* The page's old function walked dates with local-time setDate(). In a zone that changes its
   clocks at midnight (Havana, in the table above) that walk skips or repeats a day, and its
   map is wrong: that is a fault the new module does not have, so the comparison is made only
   where the old function was sound. The properties below are made everywhere. */
const OLD_ORACLE_SOUND = ['UTC', 'America/New_York', 'Pacific/Auckland'].includes(process.env.TZ);

/* whole school years, each with its breaks somewhere else */
const YEARS = {
  'a year that starts on a Monday, winter break at Dec 24-31': {
    start: '2026-08-31', end: '2027-06-11',
    off: ['2026-09-07', '2026-11-26', '2026-11-27', ...range('2026-12-24', '2026-12-31'), '2027-01-01', ...range('2027-03-25', '2027-03-30'), '2027-05-31'],
    half: ['2026-09-18', '2026-11-25', '2026-12-23', '2027-06-11'],
  },
  'a year that starts mid-week (a Wednesday) and ends on a Thursday': {
    start: '2026-09-02', end: '2027-06-10',
    off: ['2026-10-12', ...range('2026-12-21', '2027-01-01'), ...range('2027-02-15', '2027-02-19'), '2027-04-05', '2027-05-31'],
    half: ['2026-12-18'],
  },
  'a leap year (Feb 29, 2028 a school day)': {
    start: '2027-08-30', end: '2028-06-09',
    off: ['2027-09-06', ...range('2027-11-24', '2027-11-26'), ...range('2027-12-23', '2028-01-03'), '2028-01-17', ...range('2028-04-10', '2028-04-14')],
    half: [],
  },
  'a leap year with Feb 29 a no-school day': {
    start: '2027-08-30', end: '2028-06-09',
    off: ['2028-02-29', '2027-10-11', ...range('2028-03-20', '2028-03-24'), ...range('2027-12-20', '2027-12-31')],
    half: [],
  },
  'a year whose first day is a Saturday and whose week-long breaks fall in odd places': {
    start: '2026-08-29', end: '2027-06-04',
    off: [...range('2026-10-05', '2026-10-09'), ...range('2027-01-04', '2027-01-08'), ...range('2027-04-26', '2027-04-30'), '2026-11-11'],
    half: [],
  },
  'a year whose first school day is a no-school day': {
    start: '2026-08-31', end: '2027-01-29',
    off: ['2026-08-31', '2026-09-01', '2026-12-25', '2027-01-01'],
    half: [],
  },
};

function anchorsFor(cal) {
  const { start, end } = cal.meta;
  const days = range(start, end);
  const school = days.filter((d) => isSchool(cal, d));
  const weekend = days.find((d) => dowOf(d) === 6);
  const offWeekday = days.find((d) => dowOf(d) > 0 && dowOf(d) < 6 && !isSchool(cal, d));
  return [
    ['the first day', start], ['the first school day', school[0]], ['the second school day', school[1]],
    ['a school day mid-year', school[Math.floor(school.length / 2)]], ['the last school day', school[school.length - 1]],
    ['a Saturday', weekend], ['a no-school weekday', offWeekday],
    ['a day a month before the year starts', fromDn(dn(start) - 31)], ['a day a month after it ends', fromDn(dn(end) + 31)],
  ].filter(([, d]) => d);
}

/* ── 1. the letters of whole years ─────────────────────────────────────── */
console.log('School Calendar Visualizer — A/B letters and weeks (pure Node, TZ=' + (process.env.TZ || 'unset') + ')');
let calendars = 0;
for (const [name, y] of Object.entries(YEARS)) {
  for (const letter of ['A', 'B']) {
    for (const [anchorName, anchor] of anchorsFor(makeCal(y))) {
      const cal = makeCal({ ...y, anchor, letter });
      const label = `${name} / anchor ${anchorName} (${anchor}) ${letter}`;
      calendars++;
      const got = W.abLetters(cal);
      const keys = Object.keys(got).sort();

      // it is what the month grid has always shown
      if (OLD_ORACLE_SOUND) eq(got, oldAbMap(cal), `${label}: the same letters the page gave before`);

      // the keys are the school days of the range, and nothing else
      const lo = anchor < cal.meta.start ? anchor : cal.meta.start, hi = anchor > cal.meta.end ? anchor : cal.meta.end;
      const want = range(lo, hi).filter((d) => isSchool(cal, d));
      eq(keys, want, `${label}: a letter on exactly the school days`);

      // the letters alternate down the school days, and only A and B appear
      let alternates = true, only = true;
      want.forEach((d, i) => {
        if (got[d] !== 'A' && got[d] !== 'B') only = false;
        if (i && got[d] === got[want[i - 1]]) alternates = false;
      });
      ok(alternates, `${label}: consecutive school days alternate`);
      ok(only, `${label}: only A and B`);
    }
  }
}
ok(calendars > 100, `over a hundred year-and-anchor cases walked (${calendars})`);

/* a break is skipped, not counted: the day after it carries the letter that follows the day before it */
{
  const y = YEARS['a year that starts on a Monday, winter break at Dec 24-31'];
  const cal = makeCal({ ...y, anchor: '2026-08-31', letter: 'A' });
  const m = W.abLetters(cal);
  ok(m['2026-12-23'] && m['2027-01-04'] && m['2026-12-23'] !== m['2027-01-04'], 'the first school day after winter break is the other letter than the last one before it');
  ok(!m['2026-12-25'] && !m['2026-12-26'], 'a no-school weekday and a Saturday carry no letter');
  ok(m['2026-09-18'] !== undefined, 'a half day is a school day and carries its letter');
  const friday = '2026-09-04', monday = '2026-09-08'; // Labor Day (09-07) is closed
  ok(m[friday] && m[monday] && m[friday] !== m[monday], 'Friday, a closed Monday, then Tuesday: the closed day does not advance the cycle');
}
/* no cycle, no letters */
eq(W.abLetters(makeCal({ ...YEARS['a leap year (Feb 29, 2028 a school day)'] })), {}, 'no abCycle: no letters');
eq(W.abLetters(makeCal({ ...YEARS['a leap year (Feb 29, 2028 a school day)'], anchor: '2027-09-01', enabled: false })), {}, 'a cycle that is switched off: no letters');
eq(W.abLetters(makeCal({ ...YEARS['a leap year (Feb 29, 2028 a school day)'], anchor: '' })), {}, 'no anchor date: no letters');
{
  const y = YEARS['a leap year (Feb 29, 2028 a school day)'];
  const m = W.abLetters(makeCal({ ...y, anchor: '2027-08-30', letter: 'A' }));
  ok(m['2028-02-29'] !== undefined, 'Feb 29 of a leap year (a Tuesday) takes a letter');
  ok(m['2028-02-28'] !== undefined, 'the Monday before it takes a letter too');
  ok(m['2028-02-28'] !== m['2028-02-29'] && m['2028-02-29'] !== m['2028-03-01'], 'and the letters run through Feb 28, 29 and Mar 1 without a gap');
  const noLeap = W.abLetters(makeCal({ ...YEARS['a leap year with Feb 29 a no-school day'], anchor: '2027-08-30', letter: 'A' }));
  ok(noLeap['2028-02-29'] === undefined && noLeap['2028-02-28'] !== noLeap['2028-03-01'], 'with Feb 29 closed, Mar 1 follows Feb 28 in the cycle');
}

/* ── 2. the one quirk, by name ─────────────────────────────────────────── */
// ANCHOR_QUIRK: when the range's first day is a school day and the anchor is LATER in it, the
// anchor date shows the opposite of the letter given. Pinned because a calendar saved by the old
// page prints this way; fixing it flips every letter of such a calendar.
{
  const y = YEARS['a year that starts on a Monday, winter break at Dec 24-31'];
  const first = W.abLetters(makeCal({ ...y, anchor: '2026-08-31', letter: 'A' }));
  eq(first['2026-08-31'], 'A', 'anchored on the first day: the anchor shows the letter given');
  const later = W.abLetters(makeCal({ ...y, anchor: '2026-09-14', letter: 'A' }));
  eq(later['2026-09-14'], 'B', 'ANCHOR_QUIRK: anchored on a later school day, the anchor date shows the OTHER letter');
  eq(later['2026-09-15'], 'A', 'ANCHOR_QUIRK: and the cycle runs on from there');
  const before = W.abLetters(makeCal({ ...y, anchor: '2026-08-17', letter: 'A' }));
  eq(before['2026-08-17'], 'A', 'anchored before the range, the anchor shows the letter given (the range is widened to take it in)');
  eq(before['2026-08-31'], W.abLetters(makeCal({ ...y, anchor: '2026-08-17', letter: 'A' }))['2026-08-31'], 'and the walk is the same each time');
  eq(before['2026-08-18'], 'B', 'the day after it is the other letter');
}

/* ── 3. the year grid's badge ──────────────────────────────────────────── */
{
  const y = YEARS['a year that starts on a Monday, winter break at Dec 24-31'];
  const cal = makeCal({ ...y, anchor: '2026-08-31', letter: 'A' });
  const m = W.abLetters(cal);
  eq(W.yearBadge(cal, m, '2026-08-31'), { kind: 'letter', text: 'A', spoken: 'A day' }, 'a school day: its letter, spoken as "A day"');
  eq(W.yearBadge(cal, m, '2026-09-01'), { kind: 'letter', text: 'B', spoken: 'B day' }, 'and the next is B');
  eq(W.yearBadge(cal, m, '2026-09-07'), { kind: 'off', text: '–', spoken: 'no school' }, 'a closed weekday: an en dash, spoken "no school"');
  eq(W.yearBadge(cal, m, '2026-09-05'), null, 'a Saturday: no badge');
  eq(W.yearBadge(cal, m, '2026-09-06'), null, 'a Sunday: no badge');
  eq(W.yearBadge(cal, {}, '2026-09-01'), null, 'the cycle off: no badge on any day');
  eq(W.yearBadge(cal, {}, '2026-09-07'), null, 'the cycle off: not even on a closed day');
  ok(W.yearBadge(cal, m, '2026-09-18').kind === 'letter', 'a half day is a school day: a letter');
}

/* ── 4. the weeks ──────────────────────────────────────────────────────── */
// every date from 2026-01-01 to 2028-12-31, against integer arithmetic (the two spring-forward
// and two fall-back weeks of 2026, 2027 and 2028 are all in it)
let mondaysChecked = 0, dstOk = true;
for (let n = dn('2026-01-01'); n <= dn('2028-12-31'); n++) {
  const d = fromDn(n);
  const back = (dowOf(d) + 6) % 7;
  const want = fromDn(n - back);
  const got = W.mondayOf(d);
  mondaysChecked++;
  if (got !== want) { dstOk = false; ok(false, `mondayOf(${d}) = ${got}, want ${want}`); }
  if (W.dayOfWeek(d) !== dowOf(d)) { dstOk = false; ok(false, `dayOfWeek(${d}) = ${W.dayOfWeek(d)}, want ${dowOf(d)}`); }
  if (W.addDays(d, 7) !== fromDn(n + 7) || W.addDays(d, -1) !== fromDn(n - 1)) { dstOk = false; ok(false, `addDays around ${d}`); }
}
ok(dstOk, `mondayOf, dayOfWeek and addDays agree with integer arithmetic on all ${mondaysChecked} dates of 2026-2028`);
for (const [what, sunday] of [['spring forward 2026', '2026-03-08'], ['fall back 2026', '2026-11-01'], ['spring forward 2027', '2027-03-14'], ['fall back 2027', '2027-11-07'], ['spring forward 2028', '2028-03-12'], ['fall back 2028', '2028-11-05']]) {
  eq(dowOf(sunday), 0, `${what}: ${sunday} is a Sunday`);
  const mon = W.mondayOf(sunday);
  eq(mon, fromDn(dn(sunday) - 6), `${what}: the Sunday belongs to the week before it (Monday ${mon})`);
  const week = W.weekDates(mon);
  eq(week, [0, 1, 2, 3, 4].map((i) => fromDn(dn(mon) + i)), `${what}: five consecutive dates, none repeated or skipped`);
  const next = W.weekDates(W.mondayOf(fromDn(dn(sunday) + 1)));
  eq(next, [0, 1, 2, 3, 4].map((i) => fromDn(dn(sunday) + 1 + i)), `${what}: and the week that follows`);
  eq(W.weekRange(mon, fromDn(dn(mon) + 14), '2026-01-01', '2028-12-31'), [mon, fromDn(dn(mon) + 7), fromDn(dn(mon) + 14)], `${what}: a range steps seven days at a time`);
}
eq(W.mondayOf('2028-02-29'), '2028-02-28', 'the leap day (a Tuesday) belongs to the week of Monday Feb 28');
eq(W.weekDates('2028-02-28'), ['2028-02-28', '2028-02-29', '2028-03-01', '2028-03-02', '2028-03-03'], 'and that week runs across it');
eq(W.mondayOf('2027-02-28'), '2027-02-22', 'in a common year Feb 28, 2027 is a Sunday: the week before');
eq(W.mondayOf('not a date'), null, 'a bad date gives no week');
eq(W.mondayOf('2026-02-30'), null, 'and so does a date that does not exist');
eq(W.mondayOf(''), null, 'and so does a blank');
eq(W.isValidIso('2028-02-29'), true, 'Feb 29, 2028 is a date');
eq(W.isValidIso('2027-02-29'), false, 'Feb 29, 2027 is not');

// the weeks of a whole year
{
  const y = YEARS['a year that starts mid-week (a Wednesday) and ends on a Thursday'];
  const all = W.weekRange(y.start, y.end, y.start, y.end);
  eq(all[0], '2026-08-31', 'a year that opens on a Wednesday: its first page is the week of the Monday before');
  eq(all[all.length - 1], '2027-06-07', 'and closes on a Thursday: its last is the week of Monday June 7');
  ok(all.every((m, i) => dowOf(m) === 1 && (i === 0 || dn(m) - dn(all[i - 1]) === 7)), 'every page is a Monday, seven days after the one before');
  eq(all.length, (dn('2027-06-07') - dn('2026-08-31')) / 7 + 1, 'and none is missing');
  eq(W.weekRange(y.start, y.start, y.start, y.end), ['2026-08-31'], 'from = through is one week');
  eq(W.weekRange('2026-09-09', '', y.start, y.end), ['2026-09-07'], 'a blank "through" is the one week, as the one-week print has always been');
  eq(W.weekRange('2026-09-09', 'junk', y.start, y.end), ['2026-09-07'], 'and so is an invalid one');
  eq(W.weekRange('2026-09-16', '2026-09-02', y.start, y.end), ['2026-09-14'], 'and so is one earlier than the start');
  eq(W.weekRange('2026-09-16', '2026-09-17', y.start, y.end), ['2026-09-14'], 'and one in the same week');
  eq(W.weekRange('2025-01-06', '', y.start, y.end), ['2025-01-06'], 'a single week outside the calendar is still printed, as before');
  eq(W.weekRange('2026-08-03', '2026-09-08', y.start, y.end), ['2026-08-31', '2026-09-07'], 'a range drops weeks with no day in the calendar');
  eq(W.weekRange('2027-06-01', '2027-08-01', y.start, y.end), ['2027-05-31', '2027-06-07'], 'at the far end too');
  eq(W.weekRange('2026-01-05', '2030-01-01', '2026-01-01', '2030-12-31').length, W.MAX_WEEKS, 'never more than MAX_WEEKS pages');
  eq(W.MAX_WEEKS, 60, 'which is sixty');
  eq(W.weekRange('x', '2026-09-01', y.start, y.end), [], 'no usable start: no pages');
  ok(W.weekTouches('2026-08-31', '2026-09-02', '2027-06-10') && !W.weekTouches('2026-08-24', '2026-09-02', '2027-06-10'), 'a week touches the calendar by any one of its five days');
  ok(!W.weekTouches('2026-08-24', '2026-08-29', '2027-06-10'), 'a calendar that opens on the Saturday after a week touches no day of it (a Monday-to-Friday week)');
  ok(W.weekTouches('2026-08-24', '2026-08-28', '2027-06-10'), 'and one that opens on the Friday touches it');
}

console.log(failed ? `${passed} passed, ${failed} FAILED` : `${passed} passed`);
if (failed) { console.log(fails.join('\n')); process.exit(1); }
