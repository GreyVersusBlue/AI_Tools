# Improvement Prompts — 077 — Testing Accommodations Reference Card Generator

**Tool file:** `Tools/077-testing-accommodations-card-generator.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** A roster × accommodation-type grid with a per-student note field, printed as small reference cards — entirely local.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: a roster (paste/type names), an editable accommodation-type
list (6 defaults: extended time, separate setting, read-aloud, breaks as
needed, calculator, preferential seating), a grid to check which types
apply to which student plus a free-text note per student, and a print view
that lays out one small card per student in a 3-column grid, listing only
the checked accommodations. Everything autosaves to one localStorage key
(`tacg_cards_v1`). Verified with a headless Chromium smoke test (save
roster, check one accommodation, add a note, print) — no console errors.

This tool ships with the same "stays entirely local" framing the backlog
explicitly calls out (comparing it to Final Grade Checker) since
accommodation data is sensitive. This closes out the General/Classroom
Logistics section of the Ideas Backlog for now.

**2026-08-11 — Round (session `b4zswl`).** Shipped three of the four Quick
Wins: (1) a visible **"N of M students have at least one accommodation
checked"** summary line above the assignment grid; (2) a **"print one
student only"** select next to the print button (defaults to "All
students"), so a single new student's card can be printed without
regenerating the whole class set; (3) a **cards-per-row control**
(2/3/4, default 3 — matching the prior fixed layout) that resizes the
print grid's columns. Found and fixed a real bug while testing (2): the
existing checkbox-change handler updated `state.assignments` and saved,
but never re-rendered anything, so the new summary line was stuck at
"0 of N" until some other action (like editing a roster) happened to
trigger a full table re-render — added a `renderSummary()` call to the
checkbox change handler to fix it. Did not attempt "sort/filter the grid
by accommodation type" — see Open Questions. Verified with a headless
Chromium/Playwright smoke test: saved a 3-student roster, confirmed the
summary read "0 of 3," checked one accommodation and confirmed it updated
to "1 of 3," printed with a single student selected and confirmed exactly
one card rendered, then printed with "All students" and confirmed all
three rendered — zero console errors. `node --check` passed on both
inline scripts.

## What it does today

- Roster + editable accommodation-type list
- Checkbox grid (student &times; type) plus a free-text note per student
- A live "N of M students have at least one accommodation checked"
  summary above the grid
- Print: one small card per student (or a single selected student),
  2/3/4-column grid, listing checked types and the note

## Quick Wins

- **Sort/filter the grid** by accommodation type (e.g. "show only students
  with extended time") — useful when planning room assignments for a
  testing day.

## Major Features

- **Multiple named saved rosters/sections**, matching the multi-save
  convention in Class Roster Hub and other tools — right now it's one flat
  roster, which doesn't scale to a teacher with several class periods each
  needing their own accommodation set.
- **Load roster from Name Picker/Class Roster Hub's shared storage**,
  reusing rosters already built elsewhere instead of re-typing names for
  yet another tool.
- **An expiration/review-date field** per student, since accommodations
  (like IEP/504 plans) are periodically reviewed and a stale card is worse
  than no card if a teacher trusts it without checking.
- **A room-assignment view**: given a set of testing rooms/proctors, sort
  students by which room their accommodations route them to (e.g. everyone
  needing "separate setting" together), turning the card generator into an
  actual testing-day logistics tool, not just a reference.

## Moonshot / North Star

**A testing-day accommodations system that answers "who goes where and
needs what" at a glance, stays current because it's reviewed on a schedule,
and never requires re-typing a roster that already exists in another
tool.** Room-assignment logic turns individual reference cards into a
building-wide testing-day plan; shared roster loading removes the
redundant-typing tax; and a review-date field keeps the data trustworthy
instead of quietly going stale.

## Platform themes that matter here

- **P7 (cross-tool)** — roster sharing with Name Picker/Class Roster Hub is
  the most direct opportunity; this is the second tool in this round (after
  Parent/Guardian Contact Log) dealing with sensitive per-student data
  that stays local by design.
- **P6 (print quality)** — card-size/column control shipped this round;
  matters more once real accommodation lists (which can be longer than the
  6 defaults) get used.
- **P15 (first run)** — the "N students have accommodations" count shipped
  this round; sort/filter is still open and would further reduce the
  friction of scanning a full roster by eye.

## Open Questions

- Is a review-date/expiration field worth the added complexity given this
  tool's explicitly lightweight, single-teacher, single-testing-day
  framing? A school-wide accommodations system with expiration tracking is
  a meaningfully bigger scope than "print a reference card."
- Should room-assignment logic live here, or is that different enough in
  audience (a testing coordinator, not a single classroom teacher) that it
  deserves its own tool built on top of this one's data model instead of
  growing this tool's scope?
- Next round: sort/filter by accommodation type is the only Quick Win left
  unbuilt — a small addition to the existing grid, not a new data shape,
  so it's probably a quick pickup whenever this tool's turn comes around
  again.
