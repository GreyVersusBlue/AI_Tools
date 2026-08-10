# Improvement Prompts — Command Center

**Tool file:** `Tools/command-center-dashboard.html`
**Support folder:** none — single file

**Current description (from README):** A timer, today's School Calendar Visualizer entry, and a no-repeats roster quick-call, side by side on one projector page.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Reads four other tools' storage keys and composes them on one page:
  `np_rosters` (roster), `scv_calendar_v1` (today's calendar entry),
  `hall-pass-log-sections` (who's currently out), plus its own settings
- **Timer** panel with quick durations (5/10/15/20m), Set, Start, Reset, and
  alert sounds (Bell / Buzzer / Chime / None, with Test)
- **Quick-call** roster panel with no-repeats exclusion, persisted per roster
  (`gvb-command-center:excluded:*`), and Reset turns
- Live **hall pass** readout of who is out right now

## Quick Wins

- **It's a read-only composite; make the panels actionable.** Currently you
  can see who's out but not sign someone in, and see the calendar but not edit
  it. Every panel should be one tap from doing the thing.
- **Fullscreen / projector mode** (P1). This is explicitly a projector page
  and has neither fullscreen nor the shared theme.
- **A clock and the current period.** The most-glanced-at information in a
  classroom, and this page — which is the one meant to be up all day — doesn't
  show it.
- **Configurable panels.** Let the teacher choose which panels appear and in
  what order; a PE teacher and an English teacher want different dashboards.
- **Remember panel state across a refresh** so an accidental reload doesn't
  reset the timer and the turn order.
- **Reuse the real timer.** This page reimplements a simplified timer
  (`startTimer`, `tick`, `playAlert`) that duplicates `Classroom Timer.html`.
  Extract the timer into `_shared/` or embed the real one (P7).

## Major Features

- **A true classroom home screen.** Today's agenda, the current period's
  timer, the bell schedule, who's out, today's do-now prompt, the current
  seating chart, and the day's calendar note — assembled from the tools that
  already hold each piece, on one page you leave projected all day.
- **Widget architecture.** Panels as small, self-registering modules so adding
  a new one (exit ticket prompt, number talk of the day, SSR timer, behavior
  totals) is cheap. This is the enabling refactor for everything else here,
  and it's what turns this from a fixed trio into the site's front door.
- **Period-aware.** With bell schedules (see School Calendar Visualizer), the
  page can automatically switch to 3rd period's roster and seating chart at
  10:15 without being told.
- **Remote control from a phone** (P9). Start the timer, call the next
  student, sign someone back in — while walking the room, with the projector
  showing the result.
- **Do Now / agenda strip.** A slim always-visible band with the day's agenda
  and the current segment highlighted, pairing with the Classroom Timer agenda
  idea.
- **Morning setup routine.** One button that, at the start of the day, pulls
  today's calendar entry, resets turn order, archives yesterday's hall passes,
  and tells you what needs attention.

## Moonshot / North Star

**The screen that's on from bell to bell.** A teacher opens one tab in the
morning and never opens another: it knows what period it is, what's planned,
who's in the room, who's out of it, how long is left, and what's next — all
composed from local data the other tools already keep, all private, all
working with the wifi down. This is the tool that makes the toolkit feel like
a product rather than a directory of pages.

## Platform themes that matter here

- **P7 (cross-tool composition)** — this tool *is* the theme; it reads four
  keys already and is the natural consumer of every future handoff.
- **P1 (projector mode)** — highest-value adopter after Classroom Timer.
- **P9 (phone as remote)** — a dashboard you can't reach from across the room
  is a dashboard you stop using.
- **P10 (keyboard-first)** — the whole page should be operable without
  precision clicking.

## Open Questions

- Should this become the site's landing page for a logged-in-feeling
  experience, with `index.html` remaining the public directory?
- Reading other tools' storage keys directly is fast but brittle — if any of
  those four tools changes shape, this page breaks silently. Is it worth
  defining a small shared read API first (P7/P8)?
