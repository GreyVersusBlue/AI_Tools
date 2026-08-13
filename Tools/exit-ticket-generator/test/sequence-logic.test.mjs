// sequence-logic.test.mjs — the date/cursor math behind Planned Sequence.
//
//   node Tools/exit-ticket-generator/test/sequence-logic.test.mjs
//
// etg-sequence.js is pure — no DOM, no localStorage — so the part that
// decides which prompt is "today's" prompt can be checked directly instead
// of through a browser. This is the same cadence Writing Prompt Generator's
// Prompt Sets use (schoolDaysSince / suggestedIndex in
// Tools/025-writing-prompt-generator.html), ported here per the
// improvement-prompt doc's note that the pattern is shared across the bank
// tools; the sibling never got its own unit test for this logic, so this
// suite is the first one and follows Math Drill Generator's
// load-the-IIFE-with-Function style for exercising a pure module from Node.
//
// What this suite holds down:
//
//   School-day counting is Mon-Fri only, and Day 1 is the start date
//   itself — not the first day *after* it. A Friday start rolls to the
//   following Monday, not Saturday.
//
//   The suggested index clamps to the set's actual length, so a five-item
//   set well into its second week still suggests a real day rather than
//   running off the end.
//
//   Prev/Next never walks past either end of the list, so a teacher
//   spamming the button can't index into undefined.
//
//   "Jump to today" is undefined (not just "0") for a set with no start
//   date or no items yet, so the UI knows to hide the button rather than
//   claim Day 1 means something it doesn't.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

const globalShim = {};
new Function('global', fs.readFileSync(path.join(dir, '..', 'etg-sequence.js'), 'utf8'))(globalShim);
const S = globalShim.EtgSequence;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, what) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(what); console.log('  FAIL ' + what); return false;
};
const eq = (a, b, what) => ok(a === b, `${what} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Exit Ticket — planned-sequence date/cursor math');

/* ── schoolDaysSince ─────────────────────────────────────────────────── */
{
  // A 2026 calendar for reference: Mon 2026-08-10 .. Sun 2026-08-16,
  // Mon 2026-08-17 .. Fri 2026-08-21.
  eq(S.schoolDaysSince('2026-08-10', '2026-08-10'), 0, 'the start date itself is Day 1 (0 school days elapsed)');
  eq(S.schoolDaysSince('2026-08-10', '2026-08-11'), 1, 'the next weekday is one school day in (Mon -> Tue)');
  eq(S.schoolDaysSince('2026-08-10', '2026-08-14'), 4, 'Mon -> Fri same week is 4 school days in');
  eq(S.schoolDaysSince('2026-08-14', '2026-08-17'), 1,
     'a Friday start rolls to the following Monday as day-index 1, not a 3-calendar-day jump');
  eq(S.schoolDaysSince('2026-08-15', '2026-08-17'), 1,
     'a Saturday start also rolls to Monday as day-index 1 — weekends never advance the count');
  eq(S.schoolDaysSince('2026-08-10', '2026-08-17'), 5, 'a full Mon-Fri week plus the next Monday is 5 school days in');
  eq(S.schoolDaysSince('2026-08-10', '2026-08-09'), 0, 'a "today" before the start date clamps to 0, not negative');
  eq(S.schoolDaysSince('not-a-date', '2026-08-17'), 0, 'an unparsable start date is treated as 0 school days');
  eq(S.schoolDaysSince('2026-08-10', 'not-a-date'), 0, 'an unparsable "today" is treated as 0 school days');
}

/* ── clampIndex / nextCursor ────────────────────────────────────────── */
{
  eq(S.clampIndex(2, 5), 2, 'an in-range index passes through unchanged');
  eq(S.clampIndex(-3, 5), 0, 'a negative index clamps up to 0');
  eq(S.clampIndex(99, 5), 4, 'an over-range index clamps down to the last item');
  eq(S.clampIndex(undefined, 5), 0, 'a missing/undefined index treats as 0');

  eq(S.nextCursor(2, 1, 5), 3, 'Next steps the cursor forward by one');
  eq(S.nextCursor(4, 1, 5), 4, 'Next at the last item stays put — no walking off the end');
  eq(S.nextCursor(0, -1, 5), 0, 'Prev at the first item stays put — no walking before the start');
  eq(S.nextCursor(2, -1, 5), 1, 'Prev steps the cursor back by one');
}

/* ── suggestedIndex ("Jump to today") ───────────────────────────────── */
{
  eq(S.suggestedIndex(5, null, '2026-08-13'), null, 'no start date -> no suggestion (nothing to jump to)');
  eq(S.suggestedIndex(0, '2026-08-10', '2026-08-13'), null, 'no items yet -> no suggestion, even with a start date');
  eq(S.suggestedIndex(5, '2026-08-10', '2026-08-10'), 0, 'on the start date, today\'s slot is Day 1 (index 0)');
  eq(S.suggestedIndex(5, '2026-08-10', '2026-08-13'), 3, 'Thursday of the start week is index 3 (Day 4) in a 5-day set');
  // Only 3 items planned but the calendar has run past them — clamps to the
  // last real item instead of landing on a day that doesn't exist.
  eq(S.suggestedIndex(3, '2026-08-10', '2026-08-20'), 2,
     'a short set clamps the suggestion to its last item once the calendar runs past it');
  eq(S.suggestedIndex(5, '2026-08-14', '2026-08-17'),
     S.clampIndex(1, 5),
     'a Friday-start set suggests Monday as Day 2, consistent with schoolDaysSince');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
