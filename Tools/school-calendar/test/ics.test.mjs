// ics.test.mjs — the .ics writer and reader (Path 9 P4), pure Node, no browser.
//
//   node Tools/school-calendar/test/ics.test.mjs   (or: npm run test:school-calendar-ics)
//
// What is held. Text escaping both ways; folding at 75 octets on a UTF-8 boundary and
// unfolding back; the export of the 2026-27 seed (CRLF, one event per run of dates, Winter
// Break as one event, the export moment as written, the grading periods and lessons handed
// in, a golden hash of the whole file); the round trip (a file this page wrote changes
// nothing on the calendar it came from, and rebuilds every day on a blank one, a field the
// module does not know kept); a district file in the shape Google and Outlook publish
// (a VTIMEZONE block, a multi-day closure, a TZID time, a UTC time that is the day before in
// New York, a repeat, a cancellation, a folded title, a category the legend knows, a date
// outside the year), imported without overwriting a label or removing a type, and a second
// import of it changing nothing; files that must be refused; and the title guesses. Then
// the deliberate breaks (MUTANTS): each must turn a check red.
//
// The clock is never read: the export moment is handed in. The file runs itself again
// under TZ=Pacific/Kiritimati (UTC+14) and judges the breaks in the first zone only; CI
// runs in UTC. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { seedCalendar2026, blankCalendar } from '../scv-seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const MODULE = path.join(here, '..', 'scv-ics.js');
const SRC = fs.readFileSync(MODULE, 'utf8');
const STAMP = new Date(Date.UTC(2026, 9, 25, 12, 0, 0));
const PERIODS = [
  { n: 1, start: '2026-08-31', end: '2026-11-04', name: 'Quarter 1', days: 46 },
  { n: 2, start: '2026-11-05', end: '2027-01-22', name: 'Quarter 2', days: 46 },
];
const LESSONS = [
  { date: '2026-09-01', courseId: 'c_math', course: 'Math 7', text: 'U1-01-A Integers, opposites' },
  { date: '2026-09-01', courseId: 'c_sci', course: 'Science', text: 'Cells, day 1 of 10' },
];
// sha256 of writeIcs(seed, { periods: PERIODS, lessons: LESSONS, stamp: STAMP }); the
// writer reads no clock and no zone, so this is the same in every TZ.
const GOLDEN = 'a313aa194abfdd856d79d2e8eb4684a73992908efd318e9425984553fe9f8451';

const DISTRICT = [
  'BEGIN:VCALENDAR',
  'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
  'VERSION:2.0',
  'X-WR-CALNAME:District Calendar',
  'BEGIN:VTIMEZONE',
  'TZID:America/New_York',
  'BEGIN:STANDARD',
  'DTSTART:19701101T020000',
  'TZOFFSETFROM:-0400',
  'TZOFFSETTO:-0500',
  'END:STANDARD',
  'END:VTIMEZONE',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261221',
  'DTEND;VALUE=DATE:20270102',
  'SUMMARY:Winter Break - Schools Closed',
  'UID:wb@district',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;TZID=America/New_York:20261020T123000',
  'DTEND;TZID=America/New_York:20261020T133000',
  'SUMMARY:Early Dismissal\\, Conferences',
  'DESCRIPTION:Students dismissed at 12:30.\\nBuses run early.',
  'UID:ed@district',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART:20261125T030000Z',
  'DTEND:20261125T040000Z',
  'SUMMARY:Night meeting',
  'UID:utc@district',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20260907',
  'SUMMARY:Labor Day Holiday',
  'UID:labor@district',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20270503',
  'DTEND;VALUE=DATE:20270506',
  'SUMMARY:State Assessment',
  'CATEGORIES:Testing Window',
  'UID:test@district',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20260902',
  'RRULE:FREQ=WEEKLY;BYDAY=WE',
  'SUMMARY:Staff meeting',
  'UID:rr@district',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261009',
  'STATUS:CANCELLED',
  'SUMMARY:Teacher Workday',
  'UID:cx@district',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20270614',
  'SUMMARY:Summer Programs Begin',
  'UID:out@district',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20270315',
  'DURATION:P3D',
  'SUMMARY:Teacher Work Day - No Students for this very long event title that has to be fol',
  ' ded across two lines',
  'UID:fold@district',
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n');

function checks(M, counting = true) {
  const fails = [];
  let count = 0;
  const ok = (cond, label) => { count++; if (!cond) fails.push(label); return !!cond; };
  const eq = (a, b, label) => ok(isDeepStrictEqual(a, b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
  const bytes = (s) => Buffer.byteLength(s, 'utf8');
  try {
    /* ── text ── */
    const tricky = 'a, b; c\\d\nsecond line — ✓ 😀';
    eq(M.escapeText(tricky), 'a\\, b\\; c\\\\d\\nsecond line — ✓ 😀', 'escaping: comma, semicolon, backslash, newline');
    eq(M.unescapeText(M.escapeText(tricky)), tricky, 'unescape(escape(x)) is x');
    eq(M.unescapeText('A\\NB\\\\n'), 'A\nB\\n', 'an escaped backslash before n is not a newline');

    /* ── folding ── */
    const long = 'SUMMARY:' + 'x'.repeat(200);
    const f = M.foldLine(long);
    ok(f.split('\r\n').every((l) => bytes(l) <= 75), 'every folded line is at most 75 octets');
    ok(f.split('\r\n').slice(1).every((l) => l[0] === ' '), 'each continuation starts with a space');
    eq(M.unfold(f), [long], 'unfold(fold(x)) is x');
    const wide = 'SUMMARY:' + '日本語の学校😀'.repeat(20);
    const fw = M.foldLine(wide);
    ok(fw.split('\r\n').every((l) => bytes(l) <= 75 && Buffer.from(l, 'utf8').toString('utf8') === l && !/�/.test(l)), 'a multibyte line folds on character boundaries, within 75 octets');
    eq(M.unfold(fw), [wide], 'and unfolds back');
    eq(M.foldLine('SUMMARY:short'), 'SUMMARY:short', 'a short line is left alone');

    /* ── the export ── */
    const seed = seedCalendar2026();
    const before = JSON.stringify(seed);
    const ics = M.writeIcs(seed, { periods: PERIODS, lessons: LESSONS, stamp: STAMP });
    eq(JSON.stringify(seed), before, 'writing does not change the calendar');
    ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n') && ics.endsWith('END:VCALENDAR\r\n'), 'the file is one VCALENDAR');
    ok(!/[^\r]\n/.test(ics), 'every line ends in CRLF');
    ok(ics.split('\r\n').every((l) => bytes(l) <= 75), 'no line is longer than 75 octets');
    const evs = ics.split('BEGIN:VEVENT').slice(1);
    const runs = M.dayRuns(seed);
    eq(evs.length, runs.length + PERIODS.length + LESSONS.length, 'one event per run of days, per grading period and per lesson');
    const wb = evs.find((e) => e.includes('SUMMARY:Winter Break'));
    ok(wb && wb.includes('DTSTART;VALUE=DATE:20261224') && wb.includes('DTEND;VALUE=DATE:20270101'), 'Winter Break is one event, Dec 24 to Dec 31 (DTEND exclusive)');
    eq(evs.filter((e) => e.includes('SUMMARY:Winter Break')).length, 1, 'and only one');
    ok(evs.every((e) => e.includes('DTSTAMP:20261025T120000Z')), 'DTSTAMP is the export moment handed in');
    ok(evs.every((e) => /\r\nUID:[^\r]+@scv\.aspermylessonplan\.com\r\n/.test(e)), 'every event has a UID');
    eq(new Set(evs.map((e) => /UID:([^\r]+)/.exec(e)[1])).size, evs.length, 'and no two UIDs are the same (two courses on one date included)');
    const lab = evs.find((e) => e.includes('SUMMARY:Labor Day'));
    ok(lab && lab.includes('CATEGORIES:Holiday / No School') && lab.includes('X-SCV-TYPES:holiday') && lab.includes('X-SCV-KIND:day'), 'a day says its types as categories and ids');
    const q1 = evs.find((e) => e.includes('SUMMARY:Quarter 1'));
    ok(q1 && q1.includes('DTSTART;VALUE=DATE:20260831') && q1.includes('DTEND;VALUE=DATE:20261105') && q1.includes('X-SCV-KIND:grading-period') && q1.includes('DESCRIPTION:46 school days'), 'a grading period is one event over its dates');
    ok(evs.some((e) => e.includes('SUMMARY:Math 7: U1-01-A Integers\\, opposites') && e.includes('X-SCV-KIND:lesson')), 'a lesson is an event named by its course');
    eq(crypto.createHash('sha256').update(ics).digest('hex'), GOLDEN, 'the seed\'s file is byte for byte the golden one');
    eq(M.writeIcs(seed, { stamp: STAMP }).split('BEGIN:VEVENT').length - 1, runs.length, 'with no periods or lessons, only the days');

    /* ── the round trip ── */
    const read = M.readIcs(ics, { timeZone: 'America/New_York' });
    ok(read.ok, 'the page reads its own file');
    eq(read.skipped.map((s) => s.reason.split(' this')[0]).sort(), [
      'it is a grading period', 'it is a grading period', 'it is a paced lesson', 'it is a paced lesson',
    ], 'its grading periods and lessons are listed as skipped, with why');
    const same = M.planIcsImport(seed, read);
    eq(same.rows, [], 'importing a file this page wrote into its calendar changes nothing');
    eq(same.cal.days, seed.days, 'and the days are as they were');
    const blank = blankCalendar('x', seed.meta.start, seed.meta.end);
    const rebuilt = M.planIcsImport(blank, read);
    eq(rebuilt.cal.days, seed.days, 'into a blank calendar it rebuilds every day exactly');
    eq(rebuilt.rows.length, Object.keys(seed.days).length, 'one row per day it fills');

    const odd = blankCalendar('x', '2026-08-31', '2027-06-11');
    odd.days['2026-10-01'] = { types: ['testing', 'halfday'], label: 'Café, “quotes”; semi', note: 'line one\nline two, with comma', lesson: 'U2-03-B', mine: 7 };
    odd.days['2026-10-02'] = { types: [], label: '', note: 'only a note', lesson: '' };
    odd.days['2026-10-05'] = { types: ['testing'], label: '', note: '', lesson: '' };
    odd.days['2026-10-06'] = { types: [], label: 'Staff holiday party', note: '', lesson: '' };
    odd.days['2026-10-07'] = { types: ['halfday'], label: 'A label long enough that its SUMMARY line has to be folded — twice, perhaps, with “quotes” ✓', note: '', lesson: '' };
    const oddIcs = M.writeIcs(odd, { stamp: STAMP });
    ok(oddIcs.split('\r\n').every((l) => bytes(l) <= 75) && /\r\n [^\r]/.test(oddIcs), 'a long label is folded within 75 octets');
    const oddRead = M.readIcs(oddIcs, { timeZone: 'UTC' });
    const oddBack = M.planIcsImport(odd, oddRead);
    eq(oddBack.rows, [], 'a label with punctuation, a two-line note, a lesson, a note-only day, a types-only day, a long label and an untyped "holiday" label come back unchanged');
    const oddBlank = M.planIcsImport(blankCalendar('x', '2026-08-31', '2027-06-11'), oddRead).cal.days;
    eq(oddBlank['2026-10-01'], { types: ['testing', 'halfday'], label: 'Café, “quotes”; semi', note: 'line one\nline two, with comma', lesson: 'U2-03-B' }, 'and rebuild exactly on a blank calendar');
    eq([oddBlank['2026-10-02'], oddBlank['2026-10-05']], [odd.days['2026-10-02'], odd.days['2026-10-05']], 'the note-only and the types-only day too (no title guessed into a label)');

    /* ── a district's file ── */
    const dr = M.readIcs(DISTRICT, { timeZone: 'America/New_York' });
    ok(dr.ok, `a district file is read (${dr.error || ''})`);
    const byUid = Object.fromEntries((dr.events || []).map((e) => [e.uid, e]));
    eq(byUid['wb@district'] && [byUid['wb@district'].dates[0], byUid['wb@district'].dates.length, byUid['wb@district'].dates.at(-1)], ['2026-12-21', 12, '2027-01-01'], 'a multi-day all-day event is every date to the one before DTEND');
    eq(byUid['ed@district'] && [byUid['ed@district'].dates, byUid['ed@district'].summary, byUid['ed@district'].description], [['2026-10-20'], 'Early Dismissal, Conferences', 'Students dismissed at 12:30.\nBuses run early.'], 'a TZID time is its date as written, with its title and description unescaped');
    eq(byUid['utc@district'] && byUid['utc@district'].dates, ['2026-11-24'], 'a UTC time at 03:00Z is the day before in New York');
    eq(M.readIcs(DISTRICT, { timeZone: 'UTC' }).events.find((e) => e.uid === 'utc@district').dates, ['2026-11-25'], '...and its own day in UTC');
    eq(byUid['fold@district'] && [byUid['fold@district'].summary.endsWith('folded across two lines'), byUid['fold@district'].dates], [true, ['2027-03-15', '2027-03-16', '2027-03-17']], 'a folded title is joined, and DURATION:P3D is three days');
    eq(byUid['test@district'] && byUid['test@district'].categories, ['Testing Window'], 'categories are read');
    eq(dr.skipped.map((s) => [s.summary, s.reason.split(',')[0]]), [
      ['Staff meeting', 'it repeats'], ['Teacher Workday', 'it is cancelled'],
    ], 'a repeat and a cancellation are skipped, with why');
    const seed2 = seedCalendar2026();
    const seed2Bytes = JSON.stringify(seed2);
    const plan = M.planIcsImport(seed2, dr);
    eq(JSON.stringify(seed2), seed2Bytes, 'planning an import does not change the calendar it is given');
    const d = plan.cal.days;
    eq(d['2026-09-07'], { types: ['holiday'], label: 'Labor Day', note: 'Also: Labor Day Holiday', lesson: '' }, 'a date with a label keeps it; the district title goes into the note');
    eq(d['2026-12-21'], { types: ['holiday'], label: 'Winter Break - Schools Closed', note: '', lesson: '' }, 'an empty date takes the title and the guessed closure type');
    eq(d['2026-12-23'].types, ['halfday', 'holiday'], 'a type is added beside the one there, never instead of it');
    eq(d['2026-12-23'].label, 'Early Dismissal — Last Day Before Winter Break', 'and the label there stays');
    eq(d['2026-10-20'], { types: ['halfday'], label: 'Early Dismissal, Conferences', note: 'Students dismissed at 12:30.\nBuses run early.', lesson: '' }, 'an early dismissal is a half day, its description the note');
    eq(d['2027-05-04'] && d['2027-05-04'].types, ['testing'], 'a category the legend knows names the type');
    eq(d['2026-11-24'] && d['2026-11-24'].types, [], 'a title with nothing to guess adds no type');
    eq(d['2027-03-16'] && d['2027-03-16'].types, ['workday'], 'a teacher work day is a workday');
    eq(d['2027-06-14'], undefined, 'a date outside the year is not added');
    ok(plan.skipped.some((s) => s.summary === 'Summer Programs Begin' && /outside this school year/.test(s.reason)), '...and is listed as skipped, with why');
    ok(plan.rows.every((r) => r.before.types.every((t) => r.after.types.includes(t))), 'no row removes a type');
    ok(plan.rows.every((r) => !r.before.label || r.after.label === r.before.label), 'no row replaces a label');
    ok(plan.rows.every((r) => r.after.note.startsWith(r.before.note)), 'no row loses a note');
    eq(plan.rows.find((r) => r.date === '2026-12-23').types, ['holiday'], 'a row says which types it adds');
    const again = M.planIcsImport(plan.cal, dr);
    eq([again.rows, again.cal.days], [[], plan.cal.days], 'importing the same file twice changes nothing the second time');
    eq(again.same, new Set(dr.events.flatMap((e) => e.dates).filter((x) => x <= '2027-06-11')).size, 'and counts every date it names as unchanged');
    const kept = { ...seedCalendar2026() };
    kept.days = { ...kept.days, '2026-09-07': { ...kept.days['2026-09-07'], color: 'x' } };
    eq(M.planIcsImport(kept, dr).cal.days['2026-09-07'].color, 'x', 'a field the module does not know is kept on a changed date');

    /* ── refused ── */
    const refused = {
      'an empty file': '',
      'a file that is not a calendar': 'hello, world\r\n',
      'a JSON backup': '{"meta":{}}',
      'no END:VCALENDAR': 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261001\r\nEND:VEVENT\r\n',
      'mismatched END': 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261001\r\nEND:VTODO\r\nEND:VCALENDAR\r\n',
      'an event inside an event': 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nBEGIN:VEVENT\r\nEND:VEVENT\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n',
      'a line with no colon': 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261001\r\nthis is not a property\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n',
      'something after the end': 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\nSUMMARY:extra\r\n',
      'binary': 'BEGIN:VCALENDAR\r\n\u0000\u0001\u0002\r\nEND:VCALENDAR\r\n',
      'too large': 'BEGIN:VCALENDAR\r\n' + 'X-PAD:' + 'x'.repeat(4.5 * 1024 * 1024) + '\r\nEND:VCALENDAR\r\n',
    };
    for (const [what, text] of Object.entries(refused)) {
      const r = M.readIcs(text, { timeZone: 'UTC' });
      ok(!r.ok && typeof r.error === 'string' && r.error.length > 10, `${what} is refused with a reason`);
    }
    ok(!M.readIcs(null).ok, 'a non-string is refused');
    const badDate = M.readIcs('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260231\r\nSUMMARY:Feb 31\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n', { timeZone: 'UTC' });
    eq([badDate.ok, badDate.events.length, badDate.skipped[0] && badDate.skipped[0].reason], [true, 0, 'its date could not be read'], 'an impossible date skips that event, not the file');
    const lf = M.readIcs('BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20261001\nSUMMARY:LF only\nEND:VEVENT\nEND:VCALENDAR\n', { timeZone: 'UTC' });
    eq(lf.ok && lf.events[0].dates, ['2026-10-01'], 'a file with bare LF line ends is still read');
    const quoted = M.parseLine('DTSTART;TZID="America/New_York:odd":20261001T080000');
    eq(quoted && [quoted.name, quoted.params.TZID, quoted.value], ['DTSTART', 'America/New_York:odd', '20261001T080000'], 'a colon inside a quoted parameter is not the value\'s colon');

    /* ── the title guesses ── */
    const T = seed.dayTypes;
    eq(M.guessTypes(T, 'Thanksgiving Break'), ['holiday'], 'a break is a closure');
    eq(M.guessTypes(T, 'Early Dismissal — Last Day Before Winter Break'), ['halfday'], 'an early dismissal before a break is a half day, not a closure');
    eq(M.guessTypes(T, 'End of Quarter 1 - Early Release'), ['halfday', 'mpend'], 'an end of quarter with early release is both');
    eq(M.guessTypes(T, 'Last Day Before Thanksgiving Break'), [], 'the day before a break is not a closure');
    eq(M.guessTypes(T, 'First Day of School'), ['firstlast'], 'first day of school');
    eq(M.guessTypes(T, 'Picture Day'), [], 'nothing to guess, nothing guessed');
    eq(M.guessTypes([{ id: 'x1', label: 'No School' }], 'Spring Holiday'), ['x1'], 'a legend without the seed\'s ids is matched by its labels');
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
  ['no folding', 'return lines.map(foldLine).join("\\r\\n") + "\\r\\n";', 'return lines.join("\\r\\n") + "\\r\\n";'],
  ['folds at 76', 'let cur = "", len = 0, limit = 75;', 'let cur = "", len = 0, limit = 76;'],
  ['folding counts characters, not octets', 'const n = utf8Len(ch);', 'const n = 1;'],
  ['commas unescaped', '.replace(/;/g, "\\\\;").replace(/,/g, "\\\\,")', '.replace(/;/g, "\\\\;")'],
  ['DTEND inclusive', '"DTEND;VALUE=DATE:" + compact(addDays(endIncl, 1))', '"DTEND;VALUE=DATE:" + compact(endIncl)'],
  ['no runs', 'if (last && addDays(last.end, 1) === d && sameEntry(last.entry, e)) last.end = d;', 'if (false) last.end = d;'],
  ['UTC read as written', 'const local = dateInZone(ms, timeZone);', 'const local = iso;'],
  ['all-day end read inclusive', 'last = end.midnight && end.date > start.date ? addDays(end.date, -1) : end.date;', 'last = end.date;'],
  ['repeats imported', 'if (p.RRULE || p.RDATE) return skip', 'if (false) return skip'],
  ['import replaces a label', 'if (!next.label) next.label = title;', 'next.label = title;'],
  ['import replaces the types', 'types.forEach((id) => { if (!next.types.includes(id)) next.types.push(id); });', 'if (types.length) next.types = [...types];'],
  ['own X-SCV-TYPES ignored', 'if (known.length || !ev.scvTypes.length) return known;', ''],
  ['note added twice', 'if (!line || String(note || "").includes(line)) return note;', 'if (!line) return note;'],
  ['unbalanced END accepted', 'if (stack.pop() !== what) return', 'if (stack.pop() === null) return'],
  ['no END:VCALENDAR accepted', 'if (!ended) return { ok: false', 'if (false) return { ok: false'],
  ['half day before a break is a closure', '|| /\\b(before|after)\\b/i.test(title || "")', ''],
  ['outside the year imported', 'const inside = ev.dates.filter((d) => d >= start && d <= end);', 'const inside = ev.dates;'],
];

let caught = 0;
const abs = (f) => JSON.stringify(pathToFileURL(path.join(here, '..', f)).href);
for (const [name, from, to] of process.env.ICS_CHILD ? [] : MUTANTS) {
  if (!SRC.includes(from)) { console.log(`  FAIL mutant "${name}": its text is not in the module any more`); failed++; continue; }
  const src = SRC.replace(from, to).replace('"./scv-weeks.js"', abs('scv-weeks.js'));
  let red;
  try { red = checks(await import('data:text/javascript,' + encodeURIComponent(src)), false).length > 0; } catch (e) { red = true; }
  if (red) caught++;
  else { console.log(`  FAIL mutant "${name}" passed every check`); failed++; }
}

console.log(`ics (TZ=${process.env.TZ}): ${ran - failsMain.length}/${ran} checks passed` + (process.env.ICS_CHILD ? '' : `; ${caught}/${MUTANTS.length} deliberate breaks caught`));

if (!process.env.ICS_CHILD) {
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, TZ: 'Pacific/Kiritimati', ICS_CHILD: '1' }, encoding: 'utf8' });
  process.stdout.write(child.stdout || '');
  process.stderr.write(child.stderr || '');
  if (child.status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
