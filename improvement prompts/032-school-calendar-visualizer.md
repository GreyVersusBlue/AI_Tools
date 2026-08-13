# Improvement Prompts — 032 — School Calendar Visualizer

**Tool file:** `Tools/032-School Calendar Visualizer.html`
**Support folder:** `Tools/school-calendar/`

**Current description (from README):** Build a full-year calendar template — holidays, half days, workdays, grading periods, testing windows — and lay lesson pacing on top. Saves in your browser; print or export a backup.

---

## Status

### 2026-08-13 — unit pacing layer (backlog: "Existing Tools — Enhancement Ideas")

**Shipped a new "Units" layer** — named date-range spans laid across the
calendar, computed instructional-day counts, and a printable pacing
calendar. This is a genuinely different feature from everything
`smoke-pacing.mjs` already covered — see the clarification below, it
matters for scoping.

- **A new "Units" card** (`cal.units`, an array of
  `{ id, name, start, end, color }`) lets a teacher name a unit and give it
  a start/end date, e.g. "Unit 3: Fractions", 2027-01-11 to 2027-02-05.
  Not persisted through `scv-store.js`'s `isValid()`/`migrate()` — like
  `cal.abCycle` before it, it's read lazily (`ensureUnits()` defaults it to
  `[]`) so old saved calendars keep loading with the feature simply off
  until a teacher adds a unit. No `VERSION` bump needed.
- **Instructional-day counting** is a new pure function,
  `unitInstructionalStats(startISO, endISO, days, dayTypes)` in
  `scv-pacing.js`, built on the same `isTeachableDay` predicate the lesson
  placer and the A/B cycle already share — a unit's count can never
  disagree with what the rest of the tool considers a school day. Half
  days stay instructional (matching the tool's existing convention that a
  half day still has students in the building) but are called out
  separately (`halfDays`) rather than counted as 0.5, since nothing else
  in this tool does fractional day counting.
- **Units render as a colored band** across the days they cover on the
  month grid — a thin bar along the bottom of each cell, with the unit's
  name labelled only on its first day (labelling every cell would drown
  out the day-type chips, A/B badge, and lesson text already competing for
  a 58px cell). Year-grid badges were skipped for the same space/clutter
  reason the A/B cycle's year-grid badges were skipped in Round 2 — a
  natural next step, not done here.
- **A fourth print mode, "Unit pacing calendar"** — a table (unit, start,
  end, instructional days, half days, with a total row), following the
  week strip's precedent of swapping the on-screen view rather than only
  appearing in `@media print`, since a table isn't something to discover
  for the first time on paper.
- **Verified** by extending both existing suites rather than adding a new
  one (the assignment's boundaries excluded touching `package.json`, so a
  new unwired test file would never run in `npm test`):
  `Tools/school-calendar/test/smoke-pacing.mjs` gained a pure-logic section
  for `unitInstructionalStats` (14 assertions: a range spanning a holiday
  *and* a half day, a clean week, single-day ranges landing on/off a
  holiday, a weekend-only range, and invalid ranges reporting zeros rather
  than throwing); `Tools/school-calendar/test/smoke-week.mjs` gained an
  end-to-end browser section (18 assertions) that adds a unit through the
  UI, confirms its computed count against a range with both a tagged
  holiday and a tagged half day, checks the band/label rendering on the
  month grid, and confirms the printable table's row and its print-media
  visibility. `npm run test:school-calendar` is 86 + 52 = 138 assertions,
  0 failed.

**Is this the same thing `smoke-pacing.mjs` already tested? No — read this
before touching either feature again.** `smoke-pacing.mjs` is named for the
tool's pre-existing **lesson pacing** feature: a pasted list of individual
lesson codes (`U1-03-A-Title`) gets distributed one-per-teachable-day
across the calendar, with a "bump forward" mechanic for gaps. It has no
notion of a named unit with an explicit date range, no instructional-day
count for a span, and nothing printable beyond what already shows on the
calendar. This round's "Units" layer is a separate, additive data
structure (`cal.units`, not `cal.pacing`) — a teacher can use either, both,
or neither. They do share underlying machinery (`isTeachableDay`), which is
exactly the reuse the assignment asked to check for, but they are not the
same feature and neither subsumes the other. **This backlog row was not
previously done** — `smoke-pacing.mjs`'s existence was a name collision
with a different, earlier feature, not partial completion of this one.

**Where a future round should pick up:** year-grid unit bands (space
reasons, see above); overlap handling when two units cover the same date
(currently just stacks a band per unit — untested with 3+ overlapping);
and the more ambitious version described in Major Features below — auto-
flowing a unit's *length* (a target day count) around holidays rather than
requiring a teacher to pick the end date by hand — is still open. This
round intentionally scoped to explicit start/end dates only, per the
assignment.

### 2026-08-11 — session `m3r8ro`

**Shipped the week-at-a-glance print view** (backlog rank 16). The month grid
answers "where does this fall in the year"; a planner page answers a different
question — what is happening Monday to Friday, and what do I need to know about
each day — and the part a teacher actually needs there is the *note*, which a
40px month cell has no room for.

- A third print mode, **One week**, plus a date picker for which week (the one
  containing today, or the first week of the calendar if today is outside it).
  Any date in a week resolves to its Monday, so picking a Thursday works.
- **It is five wide columns, not a small calendar.** Day type renders as a
  readable word rather than a colour chip — school printers are black and white
  (P6) — alongside the A/B letter, the paced lesson from the pacing layer, the
  free-text lesson, and the note in full.
- **A no-school day is greyed, not dropped.** "There is no Monday this week" is
  itself the thing worth seeing on a planner page. The greying reads
  `noSchool` off the calendar's own day types rather than re-deciding it.
- **The strip shows on screen, not only in print media.** Five columns of notes
  is not something to send to a printer sight-unseen, so the mode swaps the
  view; the month grid and year grid step aside and come back when the mode
  does. A blank three-rule "Notes for the week" block prints under it, because
  a planner page gets written on.
- **Verified** by `Tools/school-calendar/test/smoke-week.mjs` (34 checks,
  folded into `npm run test:school-calendar`), including a pass with print
  media emulated to confirm the strip prints and the month grid does not print
  alongside it.
- **Not done:** no multi-week (fortnight) strip, and no way to print a run of
  weeks in one job — each week is its own print.

### Pass 2 — Round 2 — 2026-08-11 — session `j6ok2v`

- **Done — A/B day cycle overlay.** The Quick Win flagged as "the single
  most-asked calendar question in a block-schedule school." A new "A/B Day
  Cycle" card lets the teacher name one known A-day or B-day date; the
  cycle then alternates on every real school day (weekday, not tagged "No
  school" by a Day Type — reusing the same flag the instructional-day
  counter already reads) and skips weekends and no-school days without
  losing sync, so the day after a break correctly continues the
  alternation as if the break weren't there. Every calendar cell gets a
  small A/B badge (month view only — the year-grid view was left alone to
  avoid cluttering its already-tiny cells; see below), and the stats line
  adds "today is an X day" when today's in range and the cycle is
  enabled. Stored as `cal.abCycle`; `scv-store.js`'s `isValid()` only
  checks `meta`/`dayTypes`/`days`, so old saved calendars load fine with
  the feature simply off until a teacher sets an anchor date.

Verified end-to-end in headless Chromium (served over `http://`, not
`file://` — this tool's `<script type="module">` imports are blocked by
CORS under `file://`, unlike 034/035's non-module tools): anchoring
2026-08-31 (a Monday) as an A day correctly alternates A/B/A/B/A through
the week, skips both weekend days with no badge, and correctly continues
the cycle as B on 09-08 after Labor Day (09-07, tagged Holiday/No School)
consumed no cycle slot — confirming the skip-and-resync logic, not just
plain alternation. The setting and its computed badges both survive a
full page reload via localStorage.

**Where a future round should pick up:** the A/B badge on the year-grid
view (skipped this round for space/clutter reasons) and week-at-a-glance
print are both natural, bounded next steps on the printing/display side.
The bigger items — the pacing layer, grading-period awareness for other
tools to read, and bell schedules per day type — are all still open
(Major Features below) and are where the real cross-tool leverage (P7)
is.

**2026-08-10 — Round 6 (PR #58): five Quick Wins shipped.** `scv-seed.js`'s
`DEFAULT_DAY_TYPES` gained a `noSchool` boolean (set on `holiday` and
`workday`, unset elsewhere); every other change lives in the tool's own
`<script type="module">`.

- **Done — Instructional-day counter.** A new stats line under the toolbar:
  "N instructional days in this range (M weekdays − K tagged 'No school')",
  plus "N remaining from today" when today falls inside the calendar's
  range. Each day type gained a "No school" checkbox in the legend so this
  stays accurate as types are added/edited, rather than hardcoding which
  built-in type IDs count.
- **Done — Count days by type in the legend.** Each legend row now shows how
  many days currently carry that tag — doubles as the data-entry sanity
  check the Quick Win asked for.
- **Done — Today marker + jump to today.** A filled accent-colored day
  number on today's cell in both the month and year-grid views, plus a
  "Jump to Today" toolbar button that scrolls to today's month (and says so
  plainly if today falls outside the calendar's configured range).
- **Done — Multi-select / drag to paint a range.** Implemented as
  click-then-shift-click (spreadsheet-style) rather than a mouse-drag: a
  plain click sets the range anchor, a shift-click on another day opens the
  drawer in "range mode" against every day between them. Range-mode Save is
  **additive** (checked types are added to each day, existing tags kept) and
  a typed label/lesson/note **replaces** each day's only if you typed one —
  documented in a hint banner inside the drawer itself. A live highlight of
  the pending range on hover (before you shift-click) was cut for scope;
  noted below as the natural next step.
- **Done — Round-trip .ics import.** Handles single, non-recurring, all-day
  `VEVENT`s (RFC 5545 line unfolding included) — the shape a district
  calendar's holiday/closure list almost always is. A light heuristic tags
  an imported day as "Holiday" if its title contains
  holiday/break/closed/"no school" and the calendar already has a
  holiday-like type; everything else imports as a label + note only, which
  is still real value for "paste the table off the district PDF."

Bug caught and fixed during testing, not by inspection: `closeDrawer()` only
called `renderMonths()`, so the new legend day-counts and the stats line
went stale after every single-day or range save until some *other* action
happened to trigger a full `render()`. Now calls `render()` on close instead
— the fix is one line, but it would have made the two flagship Quick Wins of
this round (the counters) silently wrong most of the time. Caught by an
end-to-end headless-Chromium test that checked the stats line's actual
number before and after a range-tag save, not just that the save didn't
throw.

**Where a future round should pick up:** the pacing layer (define units with
a target instructional-day count, auto-flow around holidays,
know-when-you're-behind), grading-period awareness for other tools to read,
bell schedules per day type, and a proper year-on-one-page print layout are
all still open (Major Features below) and are where the real cross-tool
leverage (P7) is. A live range-preview while shift-selecting (before the
second click) would also be worth adding.

Ideas below are deliberately ambitious and are **not** scoped to a single
session.

## What it does today

- Full school-year grid rendered month by month, with a year-at-a-glance view
- Editable **day types** (legend) — add, rename, recolour, remove
- Click a day to assign a type; clear a day; "Clear All Days (Keep Legend)"
- **Load 2026–27 CCPS Calendar** as a starting point
- **Start New Year From This Template** — the only tool on the site with a
  real year-rollover concept (P14)
- Export **.ics** (calendar subscription/import) and JSON backup; import backup
- Print / Save PDF, in four modes: month-by-month, whole year, a
  **one-week planner strip** (five wide columns with day type as a word, A/B
  letter, paced lesson, free-text lesson and the full note, plus a blank
  notes block), or a **unit pacing calendar** (a table of named units with
  their computed instructional-day counts)
- **Units layer** — named date-range spans (`cal.units`), separate from the
  lesson pacing sequence below, rendered as a colored band across the month
  grid with a computed instructional-day count per unit (half days called
  out, not fractional)
- Stored under `scv_calendar_v1` — read by `010-command-center-dashboard.html`
  and `045-sub-binder-generator.html`

## Quick Wins

- **Done —** **Instructional-day counter.** "37 teaching days left in Q3", "14 days until
  the testing window" — the number teachers actually do arithmetic for.
  *(Whole-range + remaining-from-today, driven by a per-type "No school"
  flag rather than the range boundaries alone.)*
- **Done —** **Count days by type** in the legend (12 half days, 4 workdays), which
  doubles as a data-entry check.
- **Done —** **A/B day cycle overlay.** The rest of the site (Schedule Browser, Schedule
  Visualizer) is built around A/B days; this calendar doesn't know about them,
  so it can't answer "is the Monday after break an A day?" — which is the
  single most-asked calendar question in a block-schedule school. *(Month
  view only — year-grid badges are still open.)*
- **Week-at-a-glance print** in addition to the month/year views.
- **Done —** **Multi-select / drag to paint a range** of days with one type, instead of
  clicking each day of a week-long break. *(Click-then-shift-click, not a
  mouse drag — see Status for why and what the range-mode Save actually
  does.)*
- **Already exists.** **Notes on a day**, not just a type — "picture day", "assembly 2nd period".
  *(The drawer's "Other note" field already did this before this round —
  this file was stale on that point.)*
- **Done —** **Today marker** and "jump to today" on open.
- **Done —** **Round-trip .ics** — the tool exports .ics but can't import one, which is
  how district calendars are usually published. *(Single-event, non-recurring
  only — see Status for the exact scope.)*

## Major Features

- **Pacing layer, properly.** *(Partially done 2026-08-13 — see Status: named
  units with explicit start/end dates, a computed instructional-day count,
  a calendar band, and a printable pacing table all exist now.)* Still
  open: a unit defined by a *target* instructional-day count rather than an
  explicit end date, auto-flowing its end around holidays/half days/testing
  windows as they change, and a "you're three days behind" comparison
  against where a unit should be by today. A pacing calendar that
  *recomputes* when you lose a day to a snow day is worth a great deal.
- **Grading-period awareness everywhere.** If the calendar knows quarter
  boundaries, Final Grade Checker knows what "the remaining quarter" means,
  Grade Distribution knows which window it's summarizing, and Sub Plan Builder
  knows whether tomorrow is a grading deadline (P7).
- **Import a district calendar.** Paste an .ics, or paste the table off the
  district PDF/webpage and parse it. The 2026–27 CCPS preset is great and also
  a maintenance burden that expires; a parser outlives it.
- **Multi-calendar overlay.** School calendar + your own PD/appointments +
  the athletics schedule, toggled on and off, printed together.
- **Bell schedules per day type.** Half day, assembly schedule, testing
  schedule — this is the missing piece that would let Classroom Timer answer
  "how long is 3rd period today?" (P7).
- **Print quality for the wall.** A one-page year wall calendar with a legend,
  sized for a letter or ledger sheet, is a thing every teacher tapes above
  their desk.

## Moonshot / North Star

**The spine of the school year.** Every other tool asks "what day is it, and
what does that mean?" — A or B, which quarter, which unit, how many teaching
days are left, is today a half day, when is the testing window. This tool
should be the single local source of truth for that, and everything else on
the site should read it. It is already read by two tools; the ambition is that
it is read by twenty.

## Platform themes that matter here

- **P14 (year lifecycle)** — this tool already solved rollover; its approach
  should be the model the rest of the site copies.
- **P7 (cross-tool handoff)** — the highest-value producer of shared context
  on the site.
- **P6 (print quality)** — a year-on-one-page print is a specific, hard,
  worthwhile layout problem.
- **P13 (import surfaces)** — .ics and pasted-table import.

## Open Questions

- Should bell schedules live here or in a separate tool? They're calendar-
  shaped but they're really schedule-shaped, and `035-schedule-visualizer.html`
  already has a bell-day concept (`_bellDayRows`, `brSnapshotBell`).
- Is the hard-coded CCPS calendar a feature to keep updating each year, or
  should it become "import from a file/paste" plus a shipped example?
