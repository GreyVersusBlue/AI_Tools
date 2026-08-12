# Improvement Prompts — 073 — Science Fair Project Tracker

**Tool file:** `Tools/073-science-fair-project-tracker.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Six editable milestones with due dates, a per-student checkbox grid with a live progress percentage, and a printable report with a "still missing, by milestone" chase-list.

---

## Status

**2026-08-12 — Backlog round: per-milestone notes field shipped (backlog
rank 6).** Every student-milestone cell in the progress grid now has a
small pencil button beside its checkbox that opens a `prompt()` for a
short status note — "board 80% done, missing abstract". Notes are stored
in a new `state.notes` map keyed by the same `student|milestoneId` key the
`done` map already uses (defaulted in `load()` so pre-existing trackers
migrate cleanly), shown truncated under the cell's checkbox on screen
(full text in the tooltip; the pencil turns accent-colored when a note
exists), and — the point of the row — **printed in the "still missing, by
milestone" chase list**, italicized in parentheses after the student's
name. An empty prompt answer deletes the note. What was hard: nothing —
the only design choice was note entry via `prompt()` instead of an inline
input per cell, because a roster × milestones grid of text inputs would
have blown up the table layout for a note most cells don't have. Verified
with a headless Chromium test: add note → renders in cell with has-note
styling, survives reload, prints in the chase list next to the right
student, done students stay out of the chase list, empty answer removes
the note — zero console errors. Next round: multiple named saved trackers
(its own backlog row) is the natural next lift.

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: six default milestones (Question & Hypothesis, Background
Research, Materials & Procedure, Data Collection, Board Complete,
Presentation Ready), each with an editable name and an optional due date;
a roster &times; milestone checkbox grid with a live per-student "N/M
(percent)" progress readout; and a print view that shows the full
checkmark grid plus a "still missing, by milestone" section listing exactly
who hasn't finished each milestone yet — the actual "chase list" a teacher
needs before a checkpoint deadline. Everything autosaves to one
localStorage key (`sfpt_tracker_v1`). Verified with a headless Chromium
smoke test (default milestone renders correctly with its ampersand, check
a box, confirm the progress readout updates, print and confirm both the
grid and missing-list sections render) — no console errors. One bug
caught and fixed before testing: the default milestone name
`Question & Hypothesis` was originally written as a JS string literal
containing the HTML entity text `&amp;` instead of a literal ampersand
character — since that string flows through `escapeHtml()` before being
inserted into the print view, it would have rendered as the double-escaped
literal text `&amp;amp;` on the printed report (a different symptom of
the same class of entity-in-JS-string bug caught twice already in this
round, on Verb Conjugation Reference Poster Generator and Sub Note /
Feedback Slip Generator).

**2026-08-11 — Round (session `b4zswl`).** Shipped all four Quick Wins in
one pass, since they all touch the same `renderTable()`/`renderMilestones()`
functions and compose cleanly: (1) overdue highlighting — any milestone
cell for an unchecked student whose due date has passed gets a red-tinted
`.overdue` background plus a small ⚠ marker (not color alone, so it still
reads on a grayscale printer or for a colorblind teacher — though this is
on-screen only, the print view is unaffected); (2) a whole-class summary
bar above the grid showing "N/M done with [milestone]" per milestone;
(3) a "sort: least complete first" checkbox that re-sorts the on-screen
table by completed-milestone count (print output is unaffected, so the
chase-list on paper keeps roster order); (4) up/down reorder buttons on
each milestone row, matching the pattern used elsewhere in this toolkit.
Verified with a headless Chromium/Playwright smoke test: saved a 3-student
roster, set a milestone's due date to yesterday and confirmed 3 overdue
cells appeared, checked one box and confirmed the overdue count dropped to
2, confirmed the summary bar text, confirmed least-complete-first sort
reorders correctly, and confirmed a milestone moved down actually swaps
position — zero console errors throughout. `node --check` passed on both
inline scripts.

## What it does today

- 6 default milestones with editable names, optional due dates, and
  up/down reorder buttons
- Roster &times; milestone checkbox grid, live per-student progress
  percentage
- Overdue cells (unchecked past their due date) highlighted red on-screen
- Whole-class summary bar: per-milestone completion counts above the grid
- Optional "least complete first" sort (on-screen only)
- Print: full checkmark grid + a "still missing, by milestone" chase-list
- **Per-cell status notes** (pencil button per student-milestone cell,
  `state.notes` keyed like `done`), shown truncated in the grid and
  printed after the student's name in the chase list

## Major Features

- **Multiple named saved trackers** (e.g. separate science-fair cohorts
  per class period), matching the multi-save convention used by most
  builder/tracker tools in this round — right now one tracker per browser.
- **Done — 2026-08-12.** **Per-milestone notes field** (not just a
  checkbox) — e.g. "board is 80% done, missing the abstract". *(Shipped —
  see Status.)*
- **Student self-check-in via a share link** (this toolkit's P3 pattern):
  students mark their own milestones complete from their own device,
  instead of a teacher manually checking every box for every student.
- **Export to Google Calendar/ICS** for milestone due dates, so deadlines
  show up wherever a teacher already tracks their calendar.

## Moonshot / North Star

**A tracker that surfaces exactly who's behind on exactly what, before the
deadline arrives, with students checking in on their own progress instead
of a teacher manually auditing every row.** Overdue highlighting and a
"least complete first" sort turn the chase-list from something read on
print day into an ongoing early-warning system; student self-check-in
turns a teacher-maintained spreadsheet into a shared, live status board.

## Platform themes that matter here

- **P3 (share links)** — student self-check-in is the single highest-value
  feature gap between "a teacher's tracking spreadsheet" and "a live
  project-status board the whole class updates."
- **P7 (cross-tool)** — could share roster storage with Class Roster Hub;
  overdue highlighting logic is a small, reusable pattern that could apply
  to any due-date-bearing tool in this toolkit (Field Trip Permission
  Slip's due dates, for instance).
- **P6 (print quality)** — the missing-list-by-milestone print section is
  already the tool's strongest print-quality feature; nothing urgent to
  add there.

## Open Questions

- Should student self-check-in require any verification (a student marks
  their own milestone done, but a teacher must confirm before it counts),
  or is trusting student self-report sufficient for a formative tracking
  tool like this?
- ~~Is overdue-highlighting worth doing purely client-side against
  `new Date()`...~~ Resolved this round: shipped as a client-side
  `new Date()` comparison, on-screen only. It's cheap and correct for the
  common case (teacher opens the tracker sometime before or during the
  checkpoint); a background notification would need a service-worker
  periodic-sync or similar, which felt like real scope creep for what this
  quick win was meant to solve.
- Next round could pick up any of the Major Features above — multiple
  named trackers and per-milestone notes are the two that don't require
  new toolkit-wide infrastructure (P3 share-link plumbing, ICS export) and
  so are probably the next-cheapest wins.
