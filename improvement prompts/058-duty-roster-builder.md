# Improvement Prompts — 058 — Duty Roster Builder

**Tool file:** `Tools/058-duty-roster-builder.html`
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

**2026-08-11 — Round 2 (session `kq3g3h`).** Shipped two of the four Quick
Wins: per-staff assignment counts and a per-staff "skip this week" flag.

- The staff card now renders a live list below the paste-in textarea, one
  row per saved staff member, each showing a running count of duties
  assigned that week (recomputed from `state.assignments` on every grid
  edit, not just after auto-fill) and a "Skip this week" checkbox.
- Auto-fill now excludes any staff member with the skip flag set from the
  round-robin pool entirely, instead of assigning them and requiring a
  manual fix afterward. If everyone is flagged (or the staff list is
  empty), auto-fill refuses with an explanatory alert instead of silently
  doing nothing.
- Skip flags persist per-name in `localStorage` alongside the rest of the
  state, and survive re-saving the staff textarea (a re-save prunes flags
  for names that were removed, but keeps flags for names that are still
  present).
- Found and fixed a latent bug while building the counts feature: deleting
  a duty location left its assignments behind in `state.assignments`
  (never visible in the grid again, since the row was gone, but still
  counted toward a staff member's weekly total). Duty deletion now also
  clears any assignment entries keyed to that duty.
- Verified with a headless Chromium smoke test: save a 4-person staff
  list, flag one person as skip, auto-fill, confirm the flagged person
  never appears in any grid cell, confirm counts update live from manual
  grid edits, reload and confirm the skip flag persisted.

Not started this round: CSV export, multiple saved weeks/rotations, duty-
location capacity (2-people-per-cell), and the true week-to-week rotation
described under Major Features. The Open Questions (Staff Directory
Builder hand-off, round-robin ordering) also remain open — no shared-
roster read was added this round, so the staff textarea here is still
independent from Staff Directory Builder's list.

**Where the next round should pick up:** CSV export is the smallest
remaining Quick Win and would pair naturally with a "multiple saved
weeks" pass, since exporting only really matters once there's more than
one week's grid to hand off.

## What it does today

- Editable duty-location list (add/rename/remove)
- Paste-in staff list (one per line)
- Fixed Monday&ndash;Friday grid, one dropdown assignment per duty per day
- Round-robin auto-fill across the whole grid in one click, skipping any
  staff member flagged "out this week"
- Live per-staff assignment counts and a per-staff skip flag
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
