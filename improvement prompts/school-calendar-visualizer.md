# Improvement Prompts — School Calendar Visualizer

**Tool file:** `Tools/School Calendar Visualizer.html`
**Support folder:** `Tools/school-calendar/`

**Current description (from README):** Build a full-year calendar template — holidays, half days, workdays, grading periods, testing windows — and lay lesson pacing on top. Saves in your browser; print or export a backup.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Full school-year grid rendered month by month, with a year-at-a-glance view
- Editable **day types** (legend) — add, rename, recolour, remove
- Click a day to assign a type; clear a day; "Clear All Days (Keep Legend)"
- **Load 2026–27 CCPS Calendar** as a starting point
- **Start New Year From This Template** — the only tool on the site with a
  real year-rollover concept (P14)
- Export **.ics** (calendar subscription/import) and JSON backup; import backup
- Print / Save PDF
- Stored under `scv_calendar_v1` — read by `command-center-dashboard.html`
  and `sub-binder-generator.html`

## Quick Wins

- **Instructional-day counter.** "37 teaching days left in Q3", "14 days until
  the testing window" — the number teachers actually do arithmetic for.
- **Count days by type** in the legend (12 half days, 4 workdays), which
  doubles as a data-entry check.
- **A/B day cycle overlay.** The rest of the site (Schedule Browser, Schedule
  Visualizer) is built around A/B days; this calendar doesn't know about them,
  so it can't answer "is the Monday after break an A day?" — which is the
  single most-asked calendar question in a block-schedule school.
- **Week-at-a-glance print** in addition to the month/year views.
- **Multi-select / drag to paint a range** of days with one type, instead of
  clicking each day of a week-long break.
- **Notes on a day**, not just a type — "picture day", "assembly 2nd period".
- **Today marker** and "jump to today" on open.
- **Round-trip .ics** — the tool exports .ics but can't import one, which is
  how district calendars are usually published.

## Major Features

- **Pacing layer, properly.** The description promises "lay lesson pacing on
  top" — the natural full version is: define units with a target number of
  instructional days, drop them on the calendar, and have the tool
  automatically flow them around holidays, half days, and testing windows,
  then tell you when you're three days behind. A pacing calendar that
  *recomputes* when you lose a day to a snow day is worth a great deal.
- **Grading-period awareness everywhere.** If the calendar knows quarter
  boundaries, Final Grade Checker knows what "the remaining quarter" means,
  Grade Distribution knows which window it's summarizing, and Sub Plan Builder
  knows whether tomorrow is a grading deadline (P7).
- **Import a district calendar.** Paste an .ics, or paste the table off the
  district PDF/webpage and parse it. The 2026–27 CCPS preset is great and also
  a maintenance burden that expires; a parser outlives it.
- **Multi-calendar overlay.** School calendar + your own PD/appointments +
  the athletics schedule, toggled on and off, printed together.
- **Bell schedules per day type.** Half day, assembly schedule, testing
  schedule — this is the missing piece that would let Classroom Timer answer
  "how long is 3rd period today?" (P7).
- **Print quality for the wall.** A one-page year wall calendar with a legend,
  sized for a letter or ledger sheet, is a thing every teacher tapes above
  their desk.

## Moonshot / North Star

**The spine of the school year.** Every other tool asks "what day is it, and
what does that mean?" — A or B, which quarter, which unit, how many teaching
days are left, is today a half day, when is the testing window. This tool
should be the single local source of truth for that, and everything else on
the site should read it. It is already read by two tools; the ambition is that
it is read by twenty.

## Platform themes that matter here

- **P14 (year lifecycle)** — this tool already solved rollover; its approach
  should be the model the rest of the site copies.
- **P7 (cross-tool handoff)** — the highest-value producer of shared context
  on the site.
- **P6 (print quality)** — a year-on-one-page print is a specific, hard,
  worthwhile layout problem.
- **P13 (import surfaces)** — .ics and pasted-table import.

## Open Questions

- Should bell schedules live here or in a separate tool? They're calendar-
  shaped but they're really schedule-shaped, and `schedule-visualizer.html`
  already has a bell-day concept (`_bellDayRows`, `brSnapshotBell`).
- Is the hard-coded CCPS calendar a feature to keep updating each year, or
  should it become "import from a file/paste" plus a shipped example?
