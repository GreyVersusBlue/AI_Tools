# Improvement Prompts — 008 — Behavior & Points Tracker

**Tool file:** `Tools/008-behavior-points-tracker.html`
**Support folder:** `Tools/behavior-points-tracker/` — `seating-layout.js`
(the read-only bridge to Seating Chart Generator's saved room layout) plus
`test/` for the browser and data-transform suites
(`smoke-shared-record.mjs`, `npm run test:behavior`; `smoke-seating-layout.mjs`
and `smoke-seating-board.mjs`, run directly with `node` — see Status). The
tool's own page is still a single file.

**Current description (from README):** Arm a behavior (built-in +1/-1, or an editable list of point-valued behaviors) and tap any student's card to apply it — a live, projector-friendly per-student point tally with an activity feed and undo. Archive a day into an expandable history and print a report of the current totals.

---

## Status

**2026-08-13 — Round 3.** Shipped **the seating-chart board layout** (backlog
rank 1, "the single biggest speed-up available here and untouched" per the
previous round's notes): a "Layout" control next to Sort, with "Sorted list"
(unchanged) and "Seating chart" — the board arranged the way the room is
actually seated instead of alphabetically.

- **Read-only, on purpose.** The board reads `seating-chart-v1` (owned by
  `005-Seating Chart Generator`) and never writes it —
  `Tools/behavior-points-tracker/seating-layout.js` only ever calls
  `localStorage.getItem` on that key. A student's points, goals, log and
  history stay exactly where they always lived, keyed by roster name; the
  seating chart only ever supplies *positions* for the cards that already
  exist.
- **The matching/layout math lives in its own DOM-free module** so it can be
  driven under plain Node
  (`Tools/behavior-points-tracker/test/smoke-seating-layout.mjs`, 43 checks):
  which chart section to use (an explicit remembered choice, then the Name
  Picker roster this section follows, then this section's own name, then the
  chart's own active section), and turning a chart section's desks into
  0-100% boxes a plain `<div>` can be positioned with — including the same
  mirror-by-coordinate-reflection and bounding-box-plus-padding approach
  `010-command-center-dashboard.html`'s existing seating panel already uses,
  so the two readers of `seating-chart-v1` don't quietly disagree about what
  a chart means.
- **The fallback contract is explicit, not incidental.** A missing chart, a
  corrupt one, a chart with no desks placed for this class, or a chart
  section that doesn't overlap this roster at all — every one of those
  leaves the board exactly as it was (the sorted grid), with a one-line note
  explaining why, never a blank or broken panel. A roster name the chart
  doesn't know about, or a chart desk assigned to someone not on this
  roster, is handled per-student: it's left out of the room and — for a
  roster name — shown as an ordinary tappable card underneath, under "Not on
  the seating chart yet," rather than silently dropped or taking the rest of
  the layout down with it.
- **Every seated card is still a plain `.student-card`** with the same
  `data-name` the sorted grid uses, absolutely positioned inside a
  room-shaped box instead of left to the grid — so the existing click /
  long-press / flash / keyboard-arm handling, all delegated from
  `#studentGrid`, needed no changes to award points on a seated card.
- **Cross-tab freshness:** a chart saved in Seating Chart Generator in one
  tab while this board is open in another picks it up via a `storage`
  listener, the same freshness the command-center dashboard's seating panel
  already keeps — no manual refresh needed.
- Storage stayed additive: `state.boardLayout` (`'sorted'` | `'seating'`,
  defaulting to `'sorted'`) and `state.seatingSectionId` are new, optional
  fields on a section; a section saved before this round has neither and
  loads exactly as it always did.
- Verified by `Tools/behavior-points-tracker/test/smoke-seating-layout.mjs`
  (43 checks, pure data-transform, no browser) and
  `Tools/behavior-points-tracker/test/smoke-seating-board.mjs` (27 checks,
  Playwright — no chart, a corrupt chart, a real chart with a partial-roster
  match, tapping a seated card, switching between two chart sections, and
  switching back to the sorted grid). Neither is wired into `npm test` /
  `npm run test:behavior` yet (that's a `package.json` edit, out of scope
  for this round); run them directly with
  `node Tools/behavior-points-tracker/test/smoke-seating-layout.mjs` and
  `node Tools/behavior-points-tracker/test/smoke-seating-board.mjs`
  (set `PW_CHROMIUM_EXECUTABLE` first if the default Chromium path isn't
  present).
- `sw.js` `PRECACHE_URLS` and `CACHE_VERSION` were **not** touched this
  round — out of scope for this pass (`sw.js` is a listed boundary file for
  this session) — so the new `seating-layout.js` module is not yet precached
  for offline use. That's the one loose end the next round touching `sw.js`
  should close: add `Tools/behavior-points-tracker/seating-layout.js` to
  `PRECACHE_URLS` and bump `CACHE_VERSION`, or the "Seating chart" layout
  mode will silently be unavailable offline until the module has been
  fetched online once.

**2026-08-11 — Round 2 (session `m3r8ro`).** Shipped **adoption of the shared
student record** (backlog rank 8): preferred names on the cards, and — the part
that actually mattered — point history that survives a student being renamed.

- **The bug.** Every per-student thing this tool stores is keyed by the name
  string: `points`, `posCount`, `negCount`, `goals`, today's `log`, and every
  row of every archived day. Editing a roster name in Class Roster Hub (or
  fixing "Smith, John" to "John Smith") therefore orphaned the lot — the
  student reappeared on the board at 0, and a term of history belonged to a
  name nobody had any more. `followRenames()` now moves it across.
- **How the rename is detected.** Class Roster Hub mints a stable id per
  student and keeps it across a rename (its `syncRecords()` re-matches a
  vanished name by sorted-token key). The section stores `state.idNames` =
  `{id: last-seen name}`; when an id turns up under a different name and the
  old name is no longer on the roster, `renameStudentData()` moves every bag.
  It deliberately refuses to move onto a name that already has data of its own
  — merging two students' behaviour records is not something to do unasked.
- **Preferred names.** The card shows what the class actually calls the student
  with the roster name beneath it, the same treatment the Name Picker gives.
  Suppressed in initials mode, where the whole point is that nothing readable
  is on screen. Points are still keyed and stored by the roster name, so
  nothing downstream (`010-command-center-dashboard.html` reads
  `store.sets[name]`) changes shape.
- **`np-details.js` was promoted to `_shared/student-details.js`** rather than
  copied, which is what the backlog row suggested. Two copies of a name-matching
  rule is exactly the drift `CLAUDE.md` exists to stop: if this tool's
  `normalize()` and Class Roster Hub's `normKey()` ever disagreed about what
  counts as the same name, students would lose their details in one tool and
  keep them in another. `Tools/name-picker/np-details.js` is now a thin
  re-export, so the Name Picker's import path and its 261-check suite are
  untouched. The shared file gained `parseIds`/`loadIds`/`lookupId` — the
  detail lookup deliberately drops a student with neither a preferred name nor
  a pronunciation, but following a rename needs the id of *every* student.
- **Also fixed:** `Tools/name-picker/np-details.js` was never in `sw.js`'s
  `PRECACHE_URLS` despite being imported by the Name Picker — a genuine offline
  gap. Both it and the new shared file are precached now.
- Storage stayed additive (`idNames`, `rosterName`), and a teacher who has
  never opened Class Roster Hub has no sidecar, gets null from every lookup,
  and sees the tool behave exactly as before — asserted in the suite.
- Verified by `Tools/behavior-points-tracker/test/smoke-shared-record.mjs`
  (24 checks): points are awarded, a day is archived, the student is renamed in
  the sidecar, and every bag is then checked to have followed — including the
  archived day — plus the no-sidecar path.

**2026-08-10 — Trends, goal tracking, the parent-facing summary, and the
privacy modes all shipped, along with six of the seven Quick Wins.** Every
storage change is additive: a section saved by the old build loads and renders
exactly as before, and `010-command-center-dashboard.html` (which reads
`store.sets[name]`) was re-checked against the new shape. Verified with a
33-check Playwright pass whose fixture is deliberately an *old-format* section
with no `displayMode`, no goals, no categories and no notes.

What shipped, against the backlog below:

- **Anonymous / projector-safe mode (Quick Win — and the one that matters
  most).** A "Show" control on the board with four settings: names and points,
  **names with positives only**, **initials and points**, and **class total
  only**. Negative points are still counted, still in the activity feed and
  still on every printed page — they just need not be on the wall next to a
  named child. Each mode explains in one line what it is hiding, so a teacher
  choosing one knows what the room can and cannot see. **The default was left
  at "names and points"** — changing what an existing user's projector shows
  without asking is not an agent's call, and the pedagogy question in Open
  Questions below is unresolved. The affordance now exists so that decision is
  a one-word change.
- **Whole-class and group awards (Quick Win)** — "Award everyone", "Award
  ticked", "Award everyone else", each confirmed before it fires. Ticking is
  shift-click, plus a long-press for the classroom touch panel, since
  shift-click has no touchscreen equivalent.
- **Per-student note on a tap (Quick Win)** — an opt-in "Ask for a note on
  each tap" mode. The note rides on the log entry, shows as a pill in the
  activity feed, and — the important part — **is archived with the day**, so
  it is still there months later when it is needed.
- **Behavior categories and colours (Quick Win)** — academic / social /
  effort / other on each behavior, colouring the chip and grouping the printed
  report by kind ("six academic, one social") instead of listing flat.
- **Number-key arming (Quick Win, P10)** — 1–9 arms a chip, with the number
  printed on the chip so nobody has to be told the shortcut exists. Esc clears
  the ticked set. Ignored while a text field has focus.
- **Today vs cumulative on the same card (Quick Win)** — the running total to
  date sits under today's number, because +14 for the term and −2 today is a
  different conversation from −2 for both.
- **Undo the whole day (Quick Win)** — separate from the per-entry undo, and
  separate from Archive: wipes today without filing it, for the period that
  got used as a demo or tapped through by a substitute. Archive already had a
  confirm; that has not changed.
- **Trends over time (Major Feature)** — a per-student sparkline across every
  archived day, oldest to newest, scaled to that student's own biggest day, so
  a run of red on the right is visible at a glance. Built in-tool rather than
  handed to `038-data-chart-builder.html`: the chart is twenty pixels wide and
  lives beside the roster, and a round trip through another tool would cost
  more than it returned. The P7 handoff is still the right answer for anything
  bigger.
- **Goal / contract tracking (Major Feature)** — a daily point target per
  student, counted as "4 of 5 days met" across the archive, shown on the
  student card, in the trends list, and on both printed pages. **The target in
  force on the day is archived with that day**, so changing a goal now does
  not silently rewrite last month's record — which is exactly the property
  that makes it usable as evidence.
- **Parent-facing printable summary (Major Feature)** — one page per student:
  totals across recorded days, positives, entries needing follow-up, the goal
  record, a day-by-day table, and every note recorded at the time. Worded
  deliberately flatly ("entries needing follow-up", not "bad behavior") — this
  page can end up in front of a parent, and it is a record of what was logged,
  not a judgement about a child.

**Challenges hit:**

- **The category `<select>` silently broke the behaviors editor**, and it took
  a screenshot to see it: the page's shared `select { width: 100% }` rule beat
  the `.tag-row` flex layout and squashed every label field to a sliver. Worth
  knowing before adding another control to that row.
- A related near-miss in the same area: `normalizeState` builds the default
  behavior list with an explicit field-by-field `map`, so the new `cat` was
  dropped on the floor for every brand-new section — the categories existed
  and every chip said "Other". Anything added to `DEFAULT_TAGS` has to be
  added to that map too.
- **Archived days had no machine-readable date** — only a locale string like
  "Aug 5, 2026". New archives now carry `iso` as well; trends and summaries
  still work off array order so old history is not excluded, but anything that
  wants real date arithmetic (a week-by-week rollup, an auto-expire) should
  use `iso` and treat its absence as "old entry".
- Notes are capped at six per student per archived day and 240 characters
  each. A busy day with a talkative section could otherwise put a section over
  the `localStorage` budget, and this tool has no IndexedDB path (P12).
- Ticked students are session-only on purpose. Persisting a selection would
  mean opening the tool tomorrow to a mystery set of ticks.

**Where the next round should pick up:**

1. **Precache the new module.** `Tools/behavior-points-tracker/seating-layout.js`
   is not yet in `sw.js`'s `PRECACHE_URLS` (out of scope for the round that
   added it — see Status, 2026-08-13); add it and bump `CACHE_VERSION` so the
   seating layout mode works offline.
2. **Team / house points and the redeemable-points economy** are both
   unbuilt. House points now have most of what they need — the ticking
   mechanism and group awards exist — but the group definitions should come
   from Group/Team Generator rather than being re-entered.
3. **Stable student IDs (P2)** — the tool keys everything on the name string,
   so a roster edit still orphans a student's history. Class Roster Hub's
   `crh_students_v1` sidecar now exists and Name Picker reads it
   (`np-details.js` is the pattern to copy); this tool is the next obvious
   consumer, and it is the one where the identity problem actually costs data.
4. **History expiry** — see the second Open Question. `iso` makes it possible
   now; nothing auto-expires yet and the answer needs Devon.
5. **The pedagogy question in Open Questions is still open and still
   deliberately unanswered by this round.** The privacy modes make a
   positive-only default cheap to adopt if that is the call.

## What it does today

- Multiple named **sections** (`behavior-points-tracker-sections`), each with
  its own roster; loads a saved `np_rosters` roster
- Reads Class Roster Hub's shared student record (`crh_students_v1`, via
  `_shared/student-details.js`): cards show the **preferred name** over the
  roster name, and a student **renamed there keeps their points, goals, log
  and archived history** here, followed by stable id
- Editable **behavior chips** with point values; arm a chip, then tap student
  cards to apply it
- Live board of student cards with running totals; sort by name or points
- **Activity feed** with per-entry **Undo** (one of the better undo
  implementations on the site)
- **Archive Day & Reset** into an expandable history
- Print report; export history as CSV

## Quick Wins

- **Done —** **Whole-class / group awards.** Tapping 28 cards to give everyone a point is
  the most obvious missing action; "award all", "award this group", and
  "award everyone not on this list" would each get used. *(Shipped as "Award
  everyone" / "Award ticked" / "Award everyone else", each confirmed; ticking
  is shift-click plus long-press for touch panels.)*
- **Done —** **Undo the whole day**, not just the last entry — and a confirm on Archive
  Day & Reset, which is currently a one-click destroyer of the day's data.
  *(The whole-day undo is new this round; Archive already had a confirm
  before this round and was left unchanged — see Status.)*
- **Done —** **Behavior chip categories and colours** (academic / social / effort) so the
  printed report can group by kind rather than list flat. *(Shipped —
  academic/social/effort/other, colouring the chip and grouping the printed
  report.)*
- **Done —** **Keyboard/number-key arming** so a chip can be selected without looking
  (P10). *(Shipped — 1–9 arms a chip, printed on the chip; Esc clears.)*
- **Done —** **Show today vs cumulative on the same card** — a student who is at +14 for
  the quarter and -2 today is a different conversation from one who is at -2
  for both. *(Shipped — the running total to date sits under today's number.)*
- **Done —** **Per-student note on a tap** ("called out during the video"), optional and
  quick — the report is far more useful with a sentence than with a number.
  *(Shipped as an opt-in "Ask for a note on each tap" mode; the note is
  archived with the day.)*
- **Done —** **Anonymous / projector-safe mode.** Publicly displaying negative points
  next to a named child is a real pedagogical and privacy concern; a mode that
  shows only positives, or shows initials, or shows only the class total,
  should exist and arguably should be the default for the projected view.
  *(Shipped as a four-setting "Show" control; default left at "names and
  points" — see Status and Open Questions.)*

## Major Features

- **Done —** **Trends over time.** The archive already stores days; charting a student's
  or a class's trajectory across a quarter turns tally marks into evidence for
  a parent conference or an intervention meeting. Pair with
  `038-data-chart-builder.html` rather than rewriting charting (P7). *(Shipped as
  an in-tool per-student sparkline across every archived day — built
  in-tool rather than handed to Data Chart Builder; see Status for why.)*
- **Done —** **Goal / contract tracking.** A student with a behavior plan needs "4 of 5
  periods at or above target" tracked and printed weekly. This tool is one
  small feature away from serving that need, which is currently done on paper
  clipboards everywhere. *(Shipped — a daily point target per student,
  counted as "4 of 5 days met"; the target in force on a given day is
  archived with that day.)*
- **Team / house points.** Aggregate individual points into groups from
  Group/Team Generator, with a projector leaderboard — a very common classroom
  economy that currently needs a whiteboard.
- **Redeemable points / classroom economy.** Points spent on rewards, with a
  balance rather than a total.
- **Done —** **Seating-chart board layout** (P7). Tapping students arranged the way the
  room actually is, rather than alphabetically, is dramatically faster mid-
  lesson. *(Shipped — a "Layout" control reads `seating-chart-v1` read-only;
  see Status.)*
- **Done —** **Parent-facing printable summary.** A single, kindly-worded page per
  student for a conference, drawing on the notes and the trend, kept local.
  *(Shipped — one page per student: totals, positives, entries needing
  follow-up, goal record, day-by-day table, and notes.)*

## Moonshot / North Star

**Documentation that writes itself, and stays private.** The hard part of
behavior tracking isn't the counting — it's having something concrete and
fair to show when it matters, months later, without having run a surveillance
apparatus on children. This tool should make a teacher's day-to-day taps
accumulate into a defensible, printable, per-student record with dates and
context, stored only on their machine, erasable in one click, and never
displayed to the class in a way that shames anyone.

## Platform themes that matter here

- **P11 (undo)** — already strong; the per-entry undo pattern is worth
  extracting for other tools.
- **P2 (shared roster)** — reads `np_rosters`; would benefit from stable IDs
  so history survives a roster edit.
- **P1 (projector mode)** — this is a projected board; see the privacy note
  above about what should be projected at all.
- **P7 (cross-tool)** — seating layout in, charts out.

## Open Questions

- Should negative points exist at all, or should the default configuration be
  positive-only with negatives as an explicit opt-in? This is a pedagogy
  question as much as a product one, and it's worth Devon deciding rather than
  an agent choosing by default.
- How long should archived day history be kept, and should it auto-expire?
