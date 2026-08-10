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

## What it does today

- Roster + editable accommodation-type list
- Checkbox grid (student &times; type) plus a free-text note per student
- Print: one small card per student, 3-column grid, listing checked types
  and the note

## Quick Wins

- **A "print one student only" option**, for when a single new student's
  accommodations need a card without regenerating the whole class set.
- **Sort/filter the grid** by accommodation type (e.g. "show only students
  with extended time") — useful when planning room assignments for a
  testing day.
- **A visible "N students have accommodations" summary** at the top of the
  grid, so a quick glance answers "how many cards will I actually print"
  before printing.
- **Card size/columns control** (2 vs 3 vs 4 per page) since a student with
  many checked accommodations or a long note may want more room than a
  fixed 3-column grid gives.

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
- **P6 (print quality)** — card-size/column control matters once real
  accommodation lists (which can be longer than the 6 defaults) get used.
- **P15 (first run)** — a visible "N students have accommodations" count
  and sort/filter both reduce the friction of scanning a full roster by eye.

## Open Questions

- Is a review-date/expiration field worth the added complexity given this
  tool's explicitly lightweight, single-teacher, single-testing-day
  framing? A school-wide accommodations system with expiration tracking is
  a meaningfully bigger scope than "print a reference card."
- Should room-assignment logic live here, or is that different enough in
  audience (a testing coordinator, not a single classroom teacher) that it
  deserves its own tool built on top of this one's data model instead of
  growing this tool's scope?
