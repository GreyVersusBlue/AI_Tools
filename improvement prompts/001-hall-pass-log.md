# Improvement Prompts — 001 — Digital Hall Pass / Sign-Out Log

**Tool file:** `Tools/001-hall-pass-log.html`
**Support folder:** `Tools/hall-pass-log/test/` — the browser suite
(`smoke-export.mjs`, `npm run test:hall-pass`). The page itself is a single file.

**Current description (from README):** Tap a destination, tap a student — a live board tracks who's out and for how long, with a per-day log, archived history, and a printable report.

---

## Status

**2026-08-11 — Round 2 (session `m3r8ro`).** Shipped the **pass-log
spreadsheet export** (backlog rank 5). The long-range report could be read and
printed, but a year of hall-pass data could not leave the browser — and the
conversation it feeds (counselor, attendance clerk, parent meeting) happens in
a spreadsheet.

- Two buttons on the built report: **Export CSV** and **Export Excel**.
- **The export is deliberately richer than the on-screen report.** The report
  stays a summary because it's read at a glance mid-conversation; the export
  carries the per-student totals *and* every individual trip behind them —
  date, student, destination, out, back, minutes, note. "12 passes, 96
  minutes" is what starts the conversation; the individual trips are what the
  conversation is about. New `buildRangeDetail()` walks the same two sources
  `buildRangeTotals()` does (today's live log plus archived history) and
  normalizes both into one row shape.
- **CSV is hand-written, no library.** It leads with a UTF-8 BOM (without it
  Excel on Windows mangles names), quotes any cell containing a comma, quote
  or newline, and puts both tables in one file separated by a blank line — a
  CSV can't carry two sheets and two downloads is worse than one scroll.
- **XLSX lazy-loads the shared vendored SheetJS** (`_shared/vendor/xlsx/`)
  only when Excel is actually asked for, and writes two named sheets, "Totals"
  and "Every pass". Numbers go in as numbers. If the library fails to load the
  error message points at the CSV, which needs nothing.
- Nothing about the storage schema changed — this is a read of what's already
  there.
- Verified by `Tools/hall-pass-log/test/smoke-export.mjs` (23 checks): the
  real buttons are clicked, the real downloads are saved and parsed, the .xlsx
  is read back through the tool's own SheetJS to check both sheets, and a note
  containing a comma is proven to survive the CSV round trip. Out-of-range
  history is checked to be absent from both files.

**2026-08-10 — Quick Wins and the two required Major Features implemented,
plus long-range reporting.** All storage stayed additive: `outNow`/`log`/
`history` entries gained new optional fields (`note`, `outHour`, `destId`)
but kept their existing shape, and `010-command-center-dashboard.html` (which
only reads `store.sets[name].outNow.length`) was re-checked against the new
code and still works unmodified.

What actually shipped, in order of the backlog:

- **Printable paper pass** — an on-screen "Pass" overlay per out-row (name,
  destination, out time, teacher initials, a deterministic 4-digit check
  code) plus a half-sheet print version. The code is a hash of the trip, not
  a real credential — it exists so a hall monitor can eyeball-match a
  student against the board, nothing more.
- **One-out-at-a-time** — a per-section toggle in the new "Pass Rules" card.
  When on, other student cards go visibly dim/disabled with a "Someone's
  already out" status, and the direct sign-out attempt shows who.
- **Per-destination overtime** — this one turned out to **already exist**
  (added in an earlier round, commit `abd6430`, via `overtimeMin` per
  destination in `renderDestsEditor`). Nothing to build; I only changed the
  out-of-the-box defaults for a brand-new section to match the doc's own
  examples (Restroom 5, Nurse 20, Office 15, Locker 2) instead of one
  uniform 9-minute default. Existing saved sections are untouched.
- **Quick sign-in from the live board** — tapping an already-out student's
  card in the main grid now signs them in directly (previously it just
  showed an error), so the return flow is a single tap same as the exit
  flow. The dedicated "Sign in" button in the Currently Out list still works
  too.
- **Meaningful weekly flags** — the frequent-flyer badge/threshold already
  existed; added a self-contained time-of-day clustering check
  (`weeklyHourClusters`/`studentTimePatternNote`) that surfaces "4 of 5
  trips around 10 AM" under a student's name in the weekly list, without
  needing the bell schedule from School Calendar Visualizer. History rows
  now carry an `outHour` so this keeps working across archived days; older
  archived rows without it are skipped gracefully.
- **Undo** — a single-level undo bar above Currently Out reverses the most
  recent sign-out or sign-in. Deliberately one level (not a full stack) to
  match the "reverse an accidental tap" scope of the ask; it's cleared on
  section switch and on Archive Day so it can't resurrect a signed-out
  student into an already-archived day.
- **Projector view** — a fullscreen overlay reachable from a new button
  next to the live board. **Resolved the open privacy question**: the
  projected view never shows student names or which student is at which
  destination — only a total out-count, per-destination counts (e.g.
  "Restroom: 2"), and an over-time alert with no name attached. That's a
  deliberate compromise: enough for the room to see "things are moving
  normally" without a wall screen naming who went to the nurse. There's no
  toggle to reveal names in this view — if a teacher wants the full board
  visible, that's what their own screen already does.
- **Pass restrictions (Major Feature)** — a per-student weekly pass budget
  (soft-blocked with a confirm, since there's no server-side enforcement
  possible here) and a per-student "needs approval" flag (confirm-gated at
  sign-out), both in the new "Pass Rules" card.
- **Nurse/office/counselor notes (Major Feature)** — destinations get a
  "Note at sign-out" checkbox, on by default for anything matching
  nurse/office/counsel(or) in the label (existing sections get this
  heuristic applied once, then it's a normal editable checkbox from then
  on). The note is captured via `prompt()` at sign-out and carried through
  the live board, today's log, archived history, and both print reports.
- **Long-range reporting (Major Feature, time allowed)** — a date-range
  picker builds a per-student totals table (passes + total minutes) across
  archived history and today's log, with its own printable report.

Real tradeoffs hit: the weekly budget and approval flag are **prompts the
teacher sees and confirms**, not hard locks — there's no login layer here to
enforce anything harder than a `confirm()` dialog, and the UI says so
explicitly so nobody mistakes it for real access control. The projector
view's "no names" default is a genuine loss of detail (a teacher glancing at
the projector can't see *who* is out) traded deliberately for the privacy
win; if a future round wants a middle ground (initials only? a teacher-only
unlock code to temporarily reveal names on the projector?), that's an open
design space, not a bug.

**Where a future round should pick up:** everything explicitly skipped per
the task scope — bell-schedule/period correlation (needs School Calendar
Visualizer, P7), student-initiated request flow via device pairing (P9),
multi-teacher peer-to-peer sync (P9), and the Moonshot section. Also worth
a look: stable per-student IDs (P2) so a roster rename doesn't fragment a
student's weekly/long-range history under two different name strings — that
gap already existed and this round didn't touch it. The long-range report
currently buckets by exact name-string match for the same reason.

## What it does today

- **Arm a destination, tap a student** — the same fast interaction model as
  Behavior Points Tracker
- Live board of who is out and for how long, with an **overtime beep**
  (`playOvertimeBeep`) and **per-destination overtime thresholds**
- Editable destinations (`renderDestsEditor`), each with an optional
  **note-at-sign-out** flag (on by default for Nurse/Office/Counselor-style
  labels); multiple sections (`hall-pass-log-sections`); loads `np_rosters`
- **Pass Rules**: one-out-at-a-time toggle, a per-student weekly pass
  budget, and a per-student "needs teacher approval" flag — all enforced as
  confirm-gated prompts, not hard locks
- **On-screen / printable hall pass** with a short verification code and
  teacher initials, opened per out-row
- **One-level undo** for the most recent sign-out or sign-in
- **Projector view** — a fullscreen, deliberately name-free/destination-free
  summary (counts and an over-time alert only) safe to put on a wall screen
- Quick sign-in directly from a student's card in the main grid (in addition
  to the live board's own Sign In button)
- Sign in, per-day log (now carrying an optional note per trip), **archived
  day history**, printable report
- **Weekly counts** (`renderWeekly`, `weeklyCounts`, `startOfWeekMs`,
  `topEntries`) — frequency tracking per student, plus a self-contained
  time-of-day pattern flag ("4 of 5 trips around 10 AM")
- **Long-range report**: pick a date range, get a printable per-student
  passes/minutes total, exportable as CSV or a two-sheet .xlsx (totals plus
  every individual trip)
- Read live by `010-command-center-dashboard.html` (via `outNow.length` only —
  unaffected by any of the above)

## Quick Wins

- **Done —** **A printable paper pass.** The board tracks the pass; the student still
  needs something in hand for the hallway. A half-sheet with name,
  destination, time out, and the teacher's initials — printed or, better,
  shown as a QR/code on a screen. *(Shipped as an on-screen pass overlay with
  a print version; used a short deterministic check code instead of a real
  QR code to avoid adding a library to a single-file tool.)*
- **Done —** **One-out-at-a-time enforcement**, as an option, with a clear "someone is
  already out" state.
- **Done — already existed.** **Configurable time limits per destination** (bathroom 5 min, nurse 20 min,
  locker 2 min) rather than one global overtime. *(This was built in an
  earlier round, commit `abd6430`. This round only updated the out-of-the-box
  defaults for brand-new sections to match the examples above.)*
- **Done —** **Quick sign-in from the live board** — currently the flow back in is more
  steps than the flow out. *(Tapping an out student's card in the main grid
  now signs them in directly.)*
- **Done —** **Flags that mean something**: a student who has been out 4 times this week,
  or who consistently goes during the same activity. The weekly counts are
  already computed; surfacing the pattern is the value. *(The 4-times-a-week
  flag already existed; added a self-contained time-of-day clustering flag as
  a proxy for "same activity" that doesn't require the bell schedule.)*
- **Done —** **Undo an accidental sign-out** (P11). *(One level — reverses the most
  recent sign-out or sign-in.)*
- **Done —** **Fullscreen / projector-safe view** (P1) — and a privacy consideration: a
  projected board that shows who is at the nurse is a small but real problem.
  *(See Open Questions below — resolved by never showing names or
  per-student destinations in this view.)*

## Major Features

- **Done —** **Pass restrictions and passes-per-week budgets.** A per-student allowance,
  a blocked-during-first-and-last-ten-minutes rule, and a "needs teacher
  approval" flag. Every school has these policies and they're enforced from
  memory today. *(Shipped the per-student weekly budget and the approval
  flag, both as confirm-gated prompts. Skipped the first/last-N-minutes
  block — it needs a notion of period start/end this tool doesn't have, and
  edges into the deferred bell-schedule correlation below.)*
- **Skipped — deferred.** **Correlate with the schedule.** Which period, which activity, which day of
  the week — the report a counselor or administrator actually wants when a
  pattern is suspected (P7, using the calendar/bell schedule). *(Explicitly
  out of scope for this round per the cross-tool dependency on School
  Calendar Visualizer.)*
- **Skipped — deferred.** **Student-initiated request flow** (P9). A student taps a request on a
  shared classroom device or their own; it appears on the teacher's board for
  approval. Keeps the teacher from being interrupted mid-sentence, and needs
  no server. *(Explicitly out of scope for this round — nontrivial WebRTC/UX
  work.)*
- **Done —** **Nurse / office / counselor destinations with a note field**, since those
  are the ones that get asked about later.
- **Skipped — deferred.** **Multi-teacher awareness.** Two teachers in the same hallway both tracking
  passes is the real scenario; peer-to-peer sync between two browsers (P9)
  would be a genuinely novel answer that keeps data local. *(Explicitly out
  of scope for this round.)*
- **Done —** **Long-range reporting.** Per-quarter per-student totals, printable, for a
  conference or an attendance conversation. *("If time allows" item — time
  allowed. Buckets by exact student name string; see Status for the stable-ID
  caveat.)*

## Moonshot / North Star

**Hall passes that answer questions, not just record events.** A teacher taps
twice; the board handles the rest — enforcing the policy, timing the trip,
noticing the pattern, printing the pass, and being able to say, six weeks
later and entirely from local data, exactly when a student has been out of the
room and what was happening in class at the time.

## Platform themes that matter here

- **P2 (shared roster)** — already reads `np_rosters`; needs stable IDs for
  history that survives a roster edit.
- **P7 (cross-tool)** — already consumed by Command Center; wants the
  bell schedule and the seating chart.
- **P9 (device pairing)** — student request flow and multi-teacher awareness.
- **P1 (projector mode)** — with a genuine privacy caveat about what gets
  projected.

## Open Questions

- **Resolved 2026-08-10.** Should the live board ever be projected, given it
  names students and destinations? A "teacher screen only" default with an
  explicitly reduced projected view might be the right shape. — Went with
  exactly that: the full board with names and destinations stays on the
  teacher's own screen only; the new "Projector View" is a separate,
  always-redacted display (total out-count, per-destination counts with no
  names attached, an over-time alert with no name attached) and has no
  toggle to reveal names. If a future round wants a middle ground — initials
  only, or a teacher-side unlock to temporarily show names on the projector
  — that's an open design space this round didn't attempt.
- How long should archived hall pass history be retained, and should it
  auto-expire at the end of a quarter? *(Still open — `HISTORY_LIMIT = 90`
  entries was already the cap before this round; no auto-expiry-by-date
  logic exists yet.)*
