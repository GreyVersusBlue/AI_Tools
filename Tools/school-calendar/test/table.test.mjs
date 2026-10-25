// table.test.mjs — the pasted-table reader (Path 9 P4, the rest), pure Node, no browser.
//
//   node Tools/school-calendar/test/table.test.mjs   (or: npm run test:school-calendar-table)
//
// What is held. readTable() reads a district calendar's date table copied out of a PDF in
// the shapes that copy produces: tab-separated with a header row and a weekday column; runs
// of spaces with the year left off ("Nov 25-27", "Dec 21 – Jan 1"); the name first and the
// date last, numeric with four- and two-digit years; bars between cells; ISO dates. Each gives
// readIcs()'s event shape, so planIcsImport() maps it exactly as a file: the closures and day
// types guessed from the names, nothing overwritten, a second paste changing nothing. A date
// without a year takes the one year that puts it in the school year. A line it cannot read is
// listed with its number and the reason, never guessed: a header, two dates, a weekday that
// is not the date's, a date that is not real, a yearless date outside the year or in it twice
// (a 14-month year), a range that ends before it starts, a date with no name. "1/2 Day" is a
// half day, not January 2. Then the deliberate breaks (MUTANTS): each must turn a check red.
//
// The reader reads no clock and no zone; the file runs itself again under
// TZ=Pacific/Kiritimati (UTC+14) anyway and judges the breaks in the first zone only.
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { seedCalendar2026, blankCalendar } from '../scv-seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const MODULE = path.join(here, '..', 'scv-ics.js');
const SRC = fs.readFileSync(MODULE, 'utf8');
const YEAR = { start: '2026-08-31', end: '2027-06-11' };

// shape 1: tab-separated, a header row, a weekday column, the year on every date
const TABS = [
  'Date\tDay\tEvent',
  'September 7, 2026\tMonday\tLabor Day - Schools Closed',
  'October 9, 2026\tFriday\t1/2 Day for Students',
  'November 3, 2026\tTuesday\tTeacher Workday',
  'June 11, 2027\tFriday\tLast Day for Students',
].join('\n');

// shape 2: a PDF's columns as runs of spaces, no years, ranges in three spellings
const SPACED = [
  '2026-27 SCHOOL CALENDAR',
  '',
  'Mon., Sept. 7         Labor Day — Schools Closed',
  'Oct 12                Professional Development Day, No Students',
  'Nov 25-27             Thanksgiving Break',
  'Dec 21 – Jan 1        Winter Break',
  'Mar 29 through Apr 2  Spring Break',
  'May 3rd to 5th        State Testing',
].join('\r\n');

// shape 3: the name first and the date last, numeric, with four- and two-digit years
const NAME_FIRST = [
  'Event,Date',
  'Winter Break\t12/21/2026 - 1/1/2027',
  'Early Dismissal\t1/22/27',
  'End of Quarter 3\t3/26/2027',
].join('\n');

// shape 4: bars and ISO dates (a table pasted from a web page or a spreadsheet)
const BARS = [
  '| Date | Event |',
  '| --- | --- |',
  '| 2026-11-11 | Veterans Day Holiday |',
  '| 2027-02-15 | Presidents Day - No School |',
].join('\n');

const BAD = [
  'Sept 7 Labor Day   Oct 12 Columbus Day',  // 2: two dates
  'Tuesday, September 7   Wrong weekday',     // 3: Sept 7 2026 is a Monday
  'Feb 30   Not a day',                        // 4
  'July 4   Independence Day',                 // 5: no year, outside the year
  'Oct 12 - 2   Two hour delay',               // 6: a bare end before the start
  'Oct 12 - Oct 2   Backwards',                // 7: a named end before the start, not next year
  '10/14/2026',                                // 8: no name
  'Thanksgiving Break',                        // 9: no date
  'Nov 26   Thanksgiving Day',                 // 10: read
].join('\n');

function checks(M, counting = true) {
  const fails = [];
  let count = 0;
  const ok = (cond, label) => { count++; if (!cond) fails.push(label); return !!cond; };
  const eq = (a, b, label) => ok(isDeepStrictEqual(a, b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
  const range = (a, b) => { const out = []; for (let d = new Date(a + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= b; d = new Date(d.getTime() + 864e5)) out.push(d.toISOString().slice(0, 10)); return out; };
  const pairs = (r) => r.events.map((e) => [e.summary, e.dates[0], e.dates[e.dates.length - 1], e.dates.length]);
  try {
    /* ── shape 1: tabs ── */
    const t1 = M.readTable(TABS, YEAR);
    eq(t1.ok, true, 'tabs: read');
    eq(pairs(t1), [
      ['Labor Day - Schools Closed', '2026-09-07', '2026-09-07', 1],
      ['1/2 Day for Students', '2026-10-09', '2026-10-09', 1],
      ['Teacher Workday', '2026-11-03', '2026-11-03', 1],
      ['Last Day for Students', '2027-06-11', '2027-06-11', 1],
    ], 'tabs: each row its date and its name, the weekday column dropped, "1/2 Day" not January 2');
    eq(t1.skipped.map((s) => [s.summary, s.reason]), [['Line 1 (“Date Day Event”)', 'it has no date this page can read']], 'tabs: the header row is listed, with its line number');
    eq(Object.keys(t1.events[0]).filter((k) => k !== 'line').sort(),
      ['allDay', 'categories', 'dates', 'description', 'kind', 'scvLabel', 'scvLesson', 'scvTypes', 'summary', 'uid'],
      'an event has readIcs()\'s fields (and its line)');
    eq(t1.events.map((e) => e.line), [2, 3, 4, 5], 'each event says which line it came from');

    /* ── shape 2: spaced columns, no years, ranges ── */
    const t2 = M.readTable(SPACED, YEAR);
    eq(pairs(t2), [
      ['Labor Day — Schools Closed', '2026-09-07', '2026-09-07', 1],
      ['Professional Development Day, No Students', '2026-10-12', '2026-10-12', 1],
      ['Thanksgiving Break', '2026-11-25', '2026-11-27', 3],
      ['Winter Break', '2026-12-21', '2027-01-01', 12],
      ['Spring Break', '2027-03-29', '2027-04-02', 5],
      ['State Testing', '2027-05-03', '2027-05-05', 3],
    ], 'spaced: a yearless date takes the year that puts it in the school year; "25-27", "– Jan 1" (into the next year) and "through" are ranges');
    eq(t2.events[3].dates, range('2026-12-21', '2027-01-01'), 'spaced: a range is every date in it');
    eq(t2.skipped.map((s) => s.summary), ['Line 1 (“2026-27 SCHOOL CALENDAR”)'], 'spaced: the title line is listed; a blank line is not');

    /* ── shape 3: name first, numeric ── */
    const t3 = M.readTable(NAME_FIRST, YEAR);
    eq(pairs(t3), [
      ['Winter Break', '2026-12-21', '2027-01-01', 12],
      ['Early Dismissal', '2027-01-22', '2027-01-22', 1],
      ['End of Quarter 3', '2027-03-26', '2027-03-26', 1],
    ], 'name first: the date may be the last cell; a two-digit year is 20YY');

    /* ── shape 4: bars, ISO ── */
    const t4 = M.readTable(BARS, YEAR);
    eq(pairs(t4), [
      ['Veterans Day Holiday', '2026-11-11', '2026-11-11', 1],
      ['Presidents Day - No School', '2027-02-15', '2027-02-15', 1],
    ], 'bars: cells between bars, ISO dates');
    eq(t4.skipped.length, 2, 'bars: the header and the rule are listed');

    /* ── what is never guessed ── */
    const tb = M.readTable(BAD, YEAR);
    const why = Object.fromEntries(tb.skipped.map((s) => [+s.summary.match(/^Line (\d+)/)[1], s.reason]));
    eq(why[1], 'it has more than one date, so it is not clear which the name belongs to', 'two dates on a line: skipped');
    eq(why[2], 'it says Tuesday, but Sep 7, 2026 is a Monday', 'a weekday that is not the date\'s: skipped, both named');
    eq(why[3], 'its date is not a real date', 'Feb 30: skipped');
    eq(why[4], 'Jul 4 has no year, and it is not in this school year (2026-08-31 to 2027-06-11)', 'a yearless date outside the year: skipped, not moved into it');
    eq(why[5], 'it ends before it starts', '"Oct 12 - 2": skipped, not stretched to next October');
    eq(why[6], 'it ends before it starts', '"Oct 12 - Oct 2": skipped, not stretched to next October');
    eq(why[7], 'it has a date but no name beside it', 'a date alone: skipped');
    eq(why[8], 'it has no date this page can read', 'a name alone: skipped');
    eq(pairs(tb), [['Thanksgiving Day', '2026-11-26', '2026-11-26', 1]], 'the one good line is read');
    eq(tb.skipped[1].date, '2026-09-07', 'a skip with a readable date carries it');
    const twice = M.readTable('Aug 31  First day\nJan 5  Second', { start: '2026-08-31', end: '2027-10-29' });
    eq(twice.skipped.map((s) => s.reason), ['Aug 31 has no year, and this school year has it twice (Aug 31, 2026 and Aug 31, 2027)'], 'a 14-month year: a yearless date it holds twice is skipped');
    eq(pairs(twice), [['Second', '2027-01-05', '2027-01-05', 1]], 'and one it holds once is read');
    eq(M.readTable('Wednesday 9/2/2026  Open House', YEAR).events.length, 1, 'a weekday that matches is accepted');
    eq(M.readTable('Mon 9/7 - Fri 9/11  Spirit Week', YEAR).events[0].dates.length, 5, 'a range with a weekday on each end');
    eq(M.readTable('Mon 9/7 - Thu 9/11  Spirit Week', YEAR).error, 'That line could not be read: it says Thursday, but Sep 11, 2026 is a Friday.', 'and the end\'s weekday is held too (one line, refused in words)');
    eq(M.readTable('Sept 7th, 2026: Labor Day', YEAR).events[0].dates, ['2026-09-07'], 'an ordinal and a colon');

    /* ── refusals ── */
    eq(M.readTable('', YEAR).ok, false, 'nothing pasted: refused');
    eq(M.readTable('Date\tEvent\nTBA', YEAR), { ok: false, error: 'None of those 2 lines could be read (the first, “Date Event”: it has no date this page can read).' }, 'no line read: refused in words, the first reason named');
    eq(M.readTable('9/7  Labor Day', { start: '', end: '' }).ok, false, 'no school year: refused');
    eq(M.readTable('x\n'.repeat(M.MAX_TABLE_LINES + 1), YEAR).ok, false, 'too many lines: refused');

    /* ── through planIcsImport, as a file is ── */
    const blank = blankCalendar('2026–27', YEAR.start, YEAR.end);
    const all = M.readTable([TABS, SPACED, NAME_FIRST, BARS].join('\n'), YEAR);
    const plan = M.planIcsImport(blank, all);
    const typeOf = (d) => (plan.cal.days[d] || { types: [] }).types;
    eq(typeOf('2026-09-07'), ['holiday'], 'Labor Day, schools closed: a closure');
    eq(typeOf('2026-10-09'), ['halfday'], '"1/2 Day for Students": a half day');
    eq(typeOf('2026-11-03'), ['workday'], 'a teacher workday');
    eq(typeOf('2026-10-12'), ['workday'], 'professional development, no students: a workday');
    eq(typeOf('2026-11-26'), ['holiday'], 'inside Thanksgiving Break');
    eq(typeOf('2027-05-04'), ['testing'], 'inside State Testing');
    eq(typeOf('2027-06-11'), ['firstlast'], 'the last day');
    eq(typeOf('2027-01-22'), ['halfday'], 'an early dismissal');
    eq(plan.cal.days['2026-12-21'].label, 'Winter Break', 'a label from the name');
    ok(!String(plan.cal.days['2026-12-21'].note || '').includes('Winter Break'), 'a range pasted twice (two shapes) is not noted twice');
    eq(M.planIcsImport(plan.cal, M.readTable(SPACED, YEAR)).rows.length, 0, 'pasting the same table again changes nothing');
    const seed = seedCalendar2026();
    const onSeed = M.planIcsImport(seed, M.readTable('Sept 7  Community Day', YEAR));
    eq(onSeed.cal.days['2026-09-07'].label, seed.days['2026-09-07'].label, 'a label already there stays');
    ok(onSeed.cal.days['2026-09-07'].note.includes('Also: Community Day'), 'and the pasted name goes into the note');
    eq(seed.days['2026-09-07'], seedCalendar2026().days['2026-09-07'], 'the calendar handed in is not touched');
    eq(M.planIcsImport(blank, M.readTable('6/14/2027  Summer School', YEAR)).skipped.map((s) => s.reason), ['it is outside this school year (2026-08-31 to 2027-06-11)'], 'a dated line outside the year is skipped by the plan, as a file\'s event is');
  } catch (e) {
    fails.push('threw: ' + (e && e.stack || e));
  }
  if (counting) checks.count = count;
  return fails;
}

const failsMain = checks(await import(pathToFileURL(MODULE).href + '?main'));
const ran = checks.count;
let failed = failsMain.length;
failsMain.forEach((f) => console.log('  FAIL ' + f));

const MUTANTS = [
  ['a second date ignored', '} else if (found.length > 1) {', '} else if (false) {'],
  ['weekday not checked', 'if (real === p.wd) return "";', 'return "";'],
  ['yearless date guessed into the year', 'if (fits.length === 1) return { date: fits[0] };', 'if (fits.length) return { date: fits[0] };'],
  ['a bare end rolls into next year', 'const next = p.mo < +after.slice(5, 7) && !p.bare ? real(y0 + 1) : null;', 'const next = real(y0 + 1);'],
  ['1/2 read as a date', 'const scan = line.replace(/(?<![\\w/])1\\/2(?=[\\s-]*days?\\b)/gi, "½  ");', 'const scan = line;'],
  ['no-name line read', 'if (!summary) return skip("it has a date but no name beside it", a.date);', ''],
  ['weekday column kept in the name', 'else if (wd === null) cells.push(c);', 'cells.push(c);'],
  ['range end year not lent back', 'if (p.y === null && last && last.p.y !== null && !(last.p.mo < p.mo)) p.y = last.p.y;', ''],
];

let caught = 0;
const abs = (f) => JSON.stringify(pathToFileURL(path.join(here, '..', f)).href);
for (const [name, from, to] of process.env.TABLE_CHILD ? [] : MUTANTS) {
  if (!SRC.includes(from)) { console.log(`  FAIL mutant "${name}": its text is not in the module any more`); failed++; continue; }
  const src = SRC.replace(from, to).replace('"./scv-weeks.js"', abs('scv-weeks.js'));
  let red;
  try { red = checks(await import('data:text/javascript,' + encodeURIComponent(src)), false).length > 0; } catch (e) { red = true; }
  if (red) caught++;
  else { console.log(`  FAIL mutant "${name}" passed every check`); failed++; }
}

console.log(`table (TZ=${process.env.TZ}): ${ran - failsMain.length}/${ran} checks passed` + (process.env.TABLE_CHILD ? '' : `; ${caught}/${MUTANTS.length} deliberate breaks caught`));

if (!process.env.TABLE_CHILD) {
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, TZ: 'Pacific/Kiritimati', TABLE_CHILD: '1' }, encoding: 'utf8' });
  process.stdout.write(child.stdout || '');
  process.stderr.write(child.stderr || '');
  if (child.status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
