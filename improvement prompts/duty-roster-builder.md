# Improvement Prompts — Duty Roster Builder

**Tool file:** `Tools/duty-roster-builder.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Editable duty locations and staff list, a round-robin auto-fill across the week, and a printable Monday–Friday grid for the workroom board.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: an editable duty-location list, a paste-in staff list, a
Monday&ndash;Friday grid (dropdown per cell, one dropdown per duty per day),
a "round robin" auto-fill button that cycles the staff list across every
cell in day-then-duty order, and a print view of the finished grid. State
autosaves to `localStorage` (`drb_roster_v1`). Verified with a headless
Chromium smoke test (save staff, auto-fill, print) — no console errors.

Nothing below has been started.

## What it does today

- Editable duty-location list (add/rename/remove)
- Paste-in staff list (one per line)
- Fixed Monday&ndash;Friday grid, one dropdown assignment per duty per day
- Round-robin auto-fill across the whole grid in one click
- Print the finished grid as a plain table

## Quick Wins

- **Per-staff assignment counts** shown somewhere (e.g. next to the staff
  textarea or as a small summary row) so a teacher can see at a glance
  whether the round-robin (or manual edits afterward) left the load
  balanced — round robin distributes evenly by construction, but any manual
  edit afterward can silently unbalance it with no visibility.
- **"Skip a person this week" flag** per staff member (e.g. someone's out,
  or on a different duty schedule) so auto-fill respects it instead of
  needing every assignment fixed by hand afterward.
- **Multiple weeks/rotations saved**, not just one grid — a real duty
  schedule usually rotates who's on hallway vs. cafeteria week to week, and
  right now there's only one current week's grid.
- **CSV export** for handing the schedule to an administrator who wants it
  outside a browser.

## Major Features

- **True week-to-week rotation**, not just round-robin-fills-one-week: a
  multi-week rotation where week 2's grid is auto-derived from week 1's
  (shift everyone over one duty), matching the backlog's "rotating" framing
  more literally than a single auto-filled grid does.
- **Duty-location constraints** ("this duty needs 2 people," "this person
  can't do bus loop") — the current model is one person per cell, which
  doesn't match every real duty roster (some locations need multiple staff
  covering at once).
- **Multiple named saved rosters** (e.g. "Fall semester" vs "Spring
  semester," or separate rosters per grade-level team), matching the
  multi-save convention used elsewhere in this toolkit.
- **Print layout for a full month at once**, if multi-week rotation ships,
  instead of one week per print.

## Moonshot / North Star

**A duty schedule that rotates itself fairly across the whole semester,
respects who's out and who can't cover what, and never needs the same
manual balancing act every single week.** Real multi-week rotation with
skip/unavailability flags turns this from "a grid I fill in once a week"
into "a schedule that mostly runs itself" — the actual promise in the
Ideas Backlog's "rotating" framing.

## Platform themes that matter here

- **P7 (cross-tool)** — the staff list here duplicates effort with Staff
  Directory Builder; sharing that list (rather than re-pasting names into
  two tools) would be a natural follow-up once both tools exist.
- **P6 (print quality)** — a full-month print layout matters more here
  once multi-week rotation ships; a single week's plain table is
  sufficient for now.
- **P15 (first run)** — auto-fill already gets a usable grid in one click;
  skip/unavailability flags would keep that fast even as reality
  (substitutes, part-time staff) complicates it.

## Open Questions

- Should this tool read from Staff Directory Builder's saved list instead
  of (or in addition to) its own paste-in staff textarea, now that both
  tools exist? Sharing avoids re-typing the same names in two places but
  couples two otherwise-independent tools.
- Is round-robin-by-day-then-duty the right default rotation order, or
  should rotation be by-duty-then-day (each duty cycles through the full
  staff list before moving to the next duty)? The two produce visibly
  different weekly patterns and it's not obvious which a real workroom
  actually wants without asking a teacher who currently builds one by hand.
