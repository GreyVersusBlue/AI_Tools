# Improvement Prompts — Science Fair Project Tracker

**Tool file:** `Tools/science-fair-project-tracker.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Six editable milestones with due dates, a per-student checkbox grid with a live progress percentage, and a printable report with a "still missing, by milestone" chase-list.

---

## Status

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

Nothing below has been started.

## What it does today

- 6 default milestones with editable names and optional due dates
- Roster &times; milestone checkbox grid, live per-student progress
  percentage
- Print: full checkmark grid + a "still missing, by milestone" chase-list

## Quick Wins

- **Overdue highlighting**: visually flag a milestone cell red once its
  due date has passed and it's still unchecked — right now due dates are
  purely informational text, not connected to any visual urgency signal.
- **Sort the roster by "least complete first"** as a view option, turning
  the tracker into an actual worklist for who needs a check-in.
- **A whole-class summary bar** (e.g. "18 of 24 students have completed
  Background Research") above the grid, for a quick administrative view
  without scanning every row.
- **Reorder milestones** via up/down buttons, matching the pattern used
  elsewhere in this toolkit.

## Major Features

- **Multiple named saved trackers** (e.g. separate science-fair cohorts
  per class period), matching the multi-save convention used by most
  builder/tracker tools in this round — right now one tracker per browser.
- **Per-milestone notes field** (not just a checkbox) — e.g. "board is 80%
  done, missing the abstract" — turning a binary checkbox into an actual
  status update a teacher can act on.
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
- Is overdue-highlighting worth doing purely client-side against
  `new Date()` (meaning the highlight only updates when the page is open,
  not via any background notification), or should "days until/overdue"
  just be a computed, always-visible column instead of a color change that
  a teacher might not notice until they open the tool?
