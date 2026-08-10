# Improvement Prompts — Behavior & Points Tracker

**Tool file:** `Tools/behavior-points-tracker.html`
**Support folder:** none — single file

**Current description (from README):** Arm a behavior (built-in +1/-1, or an editable list of point-valued behaviors) and tap any student's card to apply it — a live, projector-friendly per-student point tally with an activity feed and undo. Archive a day into an expandable history and print a report of the current totals.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Multiple named **sections** (`behavior-points-tracker-sections`), each with
  its own roster; loads a saved `np_rosters` roster
- Editable **behavior chips** with point values; arm a chip, then tap student
  cards to apply it
- Live board of student cards with running totals; sort by name or points
- **Activity feed** with per-entry **Undo** (one of the better undo
  implementations on the site)
- **Archive Day & Reset** into an expandable history
- Print report; export history as CSV

## Quick Wins

- **Whole-class / group awards.** Tapping 28 cards to give everyone a point is
  the most obvious missing action; "award all", "award this group", and
  "award everyone not on this list" would each get used.
- **Undo the whole day**, not just the last entry — and a confirm on Archive
  Day & Reset, which is currently a one-click destroyer of the day's data.
- **Behavior chip categories and colours** (academic / social / effort) so the
  printed report can group by kind rather than list flat.
- **Keyboard/number-key arming** so a chip can be selected without looking
  (P10).
- **Show today vs cumulative on the same card** — a student who is at +14 for
  the quarter and -2 today is a different conversation from one who is at -2
  for both.
- **Per-student note on a tap** ("called out during the video"), optional and
  quick — the report is far more useful with a sentence than with a number.
- **Anonymous / projector-safe mode.** Publicly displaying negative points
  next to a named child is a real pedagogical and privacy concern; a mode that
  shows only positives, or shows initials, or shows only the class total,
  should exist and arguably should be the default for the projected view.

## Major Features

- **Trends over time.** The archive already stores days; charting a student's
  or a class's trajectory across a quarter turns tally marks into evidence for
  a parent conference or an intervention meeting. Pair with
  `data-chart-builder.html` rather than rewriting charting (P7).
- **Goal / contract tracking.** A student with a behavior plan needs "4 of 5
  periods at or above target" tracked and printed weekly. This tool is one
  small feature away from serving that need, which is currently done on paper
  clipboards everywhere.
- **Team / house points.** Aggregate individual points into groups from
  Group/Team Generator, with a projector leaderboard — a very common classroom
  economy that currently needs a whiteboard.
- **Redeemable points / classroom economy.** Points spent on rewards, with a
  balance rather than a total.
- **Seating-chart board layout** (P7). Tapping students arranged the way the
  room actually is, rather than alphabetically, is dramatically faster mid-
  lesson — read the layout from Seating Chart Generator.
- **Parent-facing printable summary.** A single, kindly-worded page per
  student for a conference, drawing on the notes and the trend, kept local.

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
