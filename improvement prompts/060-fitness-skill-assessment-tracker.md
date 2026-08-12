# Improvement Prompts — 060 — Fitness & Skill Assessment Tracker

**Tool file:** `Tools/060-fitness-skill-assessment-tracker.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Save a roster, add time- or count-based
fitness-test events, enter results in a per-student grid with live class
average/range stats, and print a report.

---

## Status

**2026-08-12 — session `r8kq4t`.** Shipped the last of this tool's original
Quick Wins: **sortable results columns**.

- Click any event heading to rank the class by it, again to flip it, and the
  Student heading for A–Z. A note above the grid says which way round it is,
  with a "Back to roster order" button beside it.
- **Best-first has to mean best, and that is different arithmetic per event
  type.** A count event is better higher and a time event is better lower, so
  the first click on Push-ups puts the most at the top and the first click on
  Mile Run puts the fastest there. One numeric comparator gets one of the two
  backwards and nothing on screen would say so. The note is worded in the
  event's own terms — "fastest first", "highest first" — rather than
  "ascending", which means nothing to a reader looking at a projected grid.
- **A blank cell is not a zero and not the fastest time on record.** Students
  with no result sink to the bottom in *both* directions, so flipping a sort
  never floats an empty row onto the projector. Sorting by an event nobody has
  results for leaves the roster order alone instead of shuffling it.
- The mm:ss parser added in Round 2 does the comparing, so `9:58` correctly
  beats `10:02` — as text it would lose, and the grid would still look sorted.
- **The print and the CSV follow the sorted order, and the printed page says
  what the order is.** Printing the mile-run ranking is the reason to sort in
  the first place, and a printout found in a drawer in March has to be able to
  say what it is ordered by. The class average/range footer is unaffected — it
  reads off the whole class, not the visible view.
- **Sorting is deliberately not persisted.** A teacher reopening this tool
  wants their roster, not whatever they were ranking by last Thursday. Nothing
  about the sort is written to `fsat_tracker_v1`, and the suite checks that.
- Headings are keyboard-operable (`role="button"`, `tabindex="0"`, Enter or
  Space), and the sort note is an `aria-live` region so the reordering is
  announced rather than being a silent visual change (P4).
- **New suite:** `Tools/fitness-skill-assessment-tracker/test/smoke-sort.mjs`,
  25 checks, wired into `npm test` and `npm run test:fitness` — the first
  automated coverage this tool has had.

**Where the next round should pick up:** with sorting in, the remaining Quick
Win — a per-student Fall/Spring improvement indicator — is the one that turns
this from a snapshot into a year of progress, and it now has a natural home
(a sort by "most improved" is the same machinery). It needs a decision first
about how two events are recognised as the same test at two dates; event
names are free text today.

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from
the Ideas Backlog. Paste-a-roster textarea, an editable list of test events
(each named freely, typed as either "count, higher is better" or "time"),
and a per-student × per-event results grid with autosave to `localStorage`
(`fsat_tracker_v1`). A live class average/min/max row sits under the grid
for count-type events. Print produces a clean report table.

Caught and fixed one real bug during smoke testing, not just a test
artifact: the grid's `change` listener originally called a full
`renderResultsTable()` re-render (rebuilding every `<input>` in the table)
any time a result cell lost focus with a changed value. That destroys and
recreates the exact cell a person is about to click into next, which in
Playwright showed up as a second student's result silently failing to
save. Fixed by having `change` refresh only the stats footer via a new
`refreshStatsRow()` instead of rebuilding the whole table body — real
users tabbing or clicking quickly between result cells were at risk of
the same lost-input behavior, not just the automated test. Verified with
a headless Chromium smoke test: 3-student roster, added a 4th event,
filled results across multiple students and events in sequence, confirmed
every value persisted in `localStorage`, confirmed live stats recompute
correctly, and confirmed print output matches saved data — no console
errors.

**2026-08-11 — Round 2 (session `kq3g3h`).** Shipped the single biggest
functionality gap plus one Quick Win.

- **Done — Time-value parsing and stats.** Time-type results now support
  `mm:ss` (e.g. `8:30`, with optional fractional seconds like `9:00.5`) as
  well as a plain-seconds fallback, parsed by a small regex-based parser.
  `computeStats()` now branches on event type: count events keep their
  existing average/min/max math, and time events convert every entry to
  seconds, average/min/max in seconds, then format the result back to
  `m:ss` for display. Previously time events always showed "—" in the
  stats row regardless of data entered — now the class average/range row
  populates correctly for both of the two default time-type events (Mile
  Run is time-type; Push-ups/Sit-ups are count-type). Malformed time entries (anything that doesn't match `mm:ss` or
  parse as a plain number) are silently excluded from stats the same way
  non-numeric count entries already were, rather than throwing.
- **Done — CSV export.** A new "Export CSV" button next to Print builds a
  CSV (student rows × event columns, raw entered values — not
  reparsed/reformatted) and triggers a browser download via a Blob URL, for
  handing to a gradebook or district PE reporting requirement.
- Verified with a headless Chromium smoke test: entered three students'
  mixed-precision `mm:ss` mile times, confirmed the stats row shows a
  correctly-averaged `m:ss` value derived from the actual parsed seconds
  (not a naive string average), exported CSV and confirmed the downloaded
  file contains the raw entered values.

Not started this round: per-student trend across two dates (Fall vs
Spring), sortable results table, standards/benchmark bands, multiple saved
rosters, retest-duplication, and per-student report cards. The Open
Questions (free-text-with-parsing vs two separate number inputs for time
entry; where per-student report cards should live) are both still
unresolved — this round kept the existing free-text-with-parsing-on-input
approach rather than switching to separate minute/second fields, since it
required no UI change and the parser handles the common formats forgivingly.

**Where the next round should pick up:** sortable results table is the
smallest remaining Quick Win. Per-student trend across two dates is the
most valuable Major Feature now that time events actually produce
comparable numbers to trend against.

## What it does today

- Paste-a-roster textarea (one name per line, de-duplicated)
- Editable test events list: name + type (count or time), add/delete
- Results grid: one row per student, one column per event, free-text cells
- Live class average/min/max for both count-type and time-type events
  (`mm:ss` parsed to seconds for the math, formatted back for display)
- **Click an event heading to rank the class by it** — best first (fastest
  for a time event, highest for a count), again to flip, with students who
  have no result held at the bottom either way. The Student heading sorts A–Z,
  and a note above the grid names the current order and offers a way back to
  roster order
- CSV export of the full results grid, in whatever order is on screen
- Print: report table matching the on-screen grid plus the stats row, with the
  sort order named in the subtitle

## Quick Wins

- **Parse time-type results** (mm:ss or seconds) so average/min/max/"most
  improved" stats work for time events too, not just counts — the single
  biggest functionality gap since two of the three default events (Mile
  Run) are time-based and get no stats today.
- **Per-student trend across two dates**: if the same event name is
  reused across a Fall and Spring entry, show a simple improved/declined
  indicator per student — turns "a snapshot" into "a year of progress."
- **CSV export** of the full results grid, for a gradebook or district PE
  reporting requirement that wants raw numbers, not just a printed table.
- **Done — 2026-08-12.** **Sortable results table** (click a column header to
  sort by that event's results) for quickly finding the fastest/slowest in a
  projected view during class. *(See Status.)*

## Major Features

- **Standards/benchmark bands per event** (e.g. Presidential Fitness
  thresholds) so a result cell shows pass/fail or a percentile alongside
  the raw number, not just the raw number.
- **Multiple saved rosters/classes**, matching the multi-save convention
  used by most builder tools in this round — one flat roster per browser
  right now, so a PE teacher with 6 class periods can't keep them
  separate.
- **Retest workflow**: duplicate an existing event as "<name> — Retest"
  in one click, pre-filling nothing but keeping the same type, instead of
  manually adding and renaming a new event every time.
- **Individual student report cards**: a print view that's one page per
  student across all events and dates, instead of only the single
  whole-class grid view, for handing back to students/parents.

## Moonshot / North Star

**A full-year, standards-aware fitness and skill tracker that turns a
list of numbers into a visible trend per student and per class, with
zero setup beyond pasting a roster.** Time-value parsing and stats close
the biggest functional gap in what exists today; benchmark bands and
trend indicators are what would make this genuinely useful for PE
reporting requirements instead of just a spreadsheet substitute.

## Platform themes that matter here

- **P7 (cross-tool)** — CSV export and multi-roster support echo patterns
  already proven elsewhere in the toolkit (Staff Directory Builder's bulk
  import, several tools' named-save conventions).
- **P12 (data integrity)** — the full-table-rebuild-on-change bug found
  during this build is a good example of a broader pattern worth a sweep:
  any tool with a "rebuild the whole list/table on every change" listener
  is at risk of destroying in-flight user interaction the same way; worth
  auditing similar tools for the same shape of bug.

## Open Questions

- Should time-type results be entered as free text (mm:ss, forgiving of
  typos) with parsing/validation on blur, or as two separate minute/second
  number inputs — trading a little more visual complexity for guaranteed-
  parseable data from the start?
- Is per-student report cards a feature that belongs in this tool, or
  would it fit better as a shared "printable report card" pattern reused
  across several data-collecting tools (this one, Science Fair Project
  Tracker, Duty Roster Builder) rather than reimplemented per tool?
