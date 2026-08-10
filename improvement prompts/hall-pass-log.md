# Improvement Prompts — Digital Hall Pass / Sign-Out Log

**Tool file:** `Tools/hall-pass-log.html`
**Support folder:** none — single file

**Current description (from README):** Tap a destination, tap a student — a live board tracks who's out and for how long, with a per-day log, archived history, and a printable report.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- **Arm a destination, tap a student** — the same fast interaction model as
  Behavior Points Tracker
- Live board of who is out and for how long, with an **overtime beep**
  (`playOvertimeBeep`)
- Editable destinations (`renderDestsEditor`); multiple sections
  (`hall-pass-log-sections`); loads `np_rosters`
- Sign in, per-day log, **archived day history**, printable report
- **Weekly counts** (`renderWeekly`, `weeklyCounts`, `startOfWeekMs`,
  `topEntries`) — frequency tracking per student
- Read live by `command-center-dashboard.html`

## Quick Wins

- **A printable paper pass.** The board tracks the pass; the student still
  needs something in hand for the hallway. A half-sheet with name,
  destination, time out, and the teacher's initials — printed or, better,
  shown as a QR/code on a screen.
- **One-out-at-a-time enforcement**, as an option, with a clear "someone is
  already out" state.
- **Configurable time limits per destination** (bathroom 5 min, nurse 20 min,
  locker 2 min) rather than one global overtime.
- **Quick sign-in from the live board** — currently the flow back in is more
  steps than the flow out.
- **Flags that mean something**: a student who has been out 4 times this week,
  or who consistently goes during the same activity. The weekly counts are
  already computed; surfacing the pattern is the value.
- **Undo an accidental sign-out** (P11).
- **Fullscreen / projector-safe view** (P1) — and a privacy consideration: a
  projected board that shows who is at the nurse is a small but real problem.

## Major Features

- **Pass restrictions and passes-per-week budgets.** A per-student allowance,
  a blocked-during-first-and-last-ten-minutes rule, and a "needs teacher
  approval" flag. Every school has these policies and they're enforced from
  memory today.
- **Correlate with the schedule.** Which period, which activity, which day of
  the week — the report a counselor or administrator actually wants when a
  pattern is suspected (P7, using the calendar/bell schedule).
- **Student-initiated request flow** (P9). A student taps a request on a
  shared classroom device or their own; it appears on the teacher's board for
  approval. Keeps the teacher from being interrupted mid-sentence, and needs
  no server.
- **Nurse / office / counselor destinations with a note field**, since those
  are the ones that get asked about later.
- **Multi-teacher awareness.** Two teachers in the same hallway both tracking
  passes is the real scenario; peer-to-peer sync between two browsers (P9)
  would be a genuinely novel answer that keeps data local.
- **Long-range reporting.** Per-quarter per-student totals, printable, for a
  conference or an attendance conversation.

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

- Should the live board ever be projected, given it names students and
  destinations? A "teacher screen only" default with an explicitly reduced
  projected view might be the right shape.
- How long should archived hall pass history be retained, and should it
  auto-expire at the end of a quarter?
