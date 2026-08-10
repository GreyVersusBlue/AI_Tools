# Improvement Prompts — 068 — Parent/Guardian Contact Log

**Tool file:** `Tools/parent-contact-log.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Log a call, email, or note home per student — date, method, and outcome — with a per-student contact count and a printable history, for quick reference before a conference or a difficult phone call.

---

## Status

**2026-08-10 — First build.** Shipped as a basic, functioning MVP out of the
Ideas Backlog: paste-or-type roster (with an optional pull from a saved Name
Picker roster via the shared `np_rosters` localStorage key), a log-a-contact
form (student, date, method, initials, outcome), a filterable/sortable
history table with edit/delete, and two print paths — the full filtered list,
or a single student's history from a "print" link next to their roster entry.
Everything lives in two localStorage keys (`pcl_roster_v1`, `pcl_entries_v1`),
no accounts, nothing leaves the browser. Verified with a headless Chromium
smoke test (save roster, log an entry, confirm it renders) — no console
errors.

This is intentionally the *minimum* that's useful. Nothing below has been
started — it's all open for a future round.

## What it does today

- Roster: type/paste names, or pull a saved Name Picker roster in
- Log a contact: student, date (defaults today), method (phone/email/note
  home/in person/text/other), initials, free-text outcome
- Per-student contact count next to each roster name (a `0` count stands out
  in red — an at-a-glance "who haven't I reached" signal)
- History table: filter by student name and/or method, edit or delete any
  entry
- Print the full filtered list, or one student's whole history, as a plain
  table

## Quick Wins

- **Date range filter** on the history table (this quarter, this semester,
  custom range) — right now filtering is name/method only.
- **CSV export** of the full log, for a counselor or admin request, or to
  archive at year's end before clearing it out.
- **Sort the roster list** by "fewest contacts first" as a view option, so
  the at-a-glance red-zero signal becomes an actual worklist.
- **Confirmation toast instead of nothing** after logging a contact — right
  now the form just clears silently, which reads as "did that save?"
- **Keyboard-friendly logging**: submit the form on Enter from the outcome
  textarea (Shift+Enter for a newline) instead of requiring a button click.
- **Contact "tags"** (attendance / grades / behavior / positive note home)
  as a lightweight second axis alongside method, since "why" matters as much
  as "how" when a teacher is scanning history before a call.

## Major Features

- **Reminders / follow-up flag.** Mark a contact "needs follow-up by [date]"
  and surface a small "N follow-ups due" banner — the log becomes a to-do
  list, not just a record.
- **Multiple sections/classes**, the way Behavior & Points Tracker and SSR
  Log Tracker support named sections — right now there's exactly one roster
  and one log, which won't scale past a single class list.
- **Templates for the outcome field** — canned openers ("Called about missing
  homework", "Positive note home", "Behavior follow-up") a teacher can pick
  and edit instead of typing from scratch every time, cutting logging
  friction to almost nothing.
- **Year-end archive/rollover**: snapshot the year's log into a dated export
  and start fresh, mirroring the archive pattern already built for Hall Pass
  Log and Behavior & Points Tracker's daily history.
- **A real conference print packet**: one student's contact history plus a
  blank note-taking area, formatted for handing to an admin or printing right
  before a parent walks in — the actual "quick reference before a
  conference" the backlog idea named.

## Moonshot / North Star

**The one place a teacher can answer "have I talked to this kid's family
about this before, and what did we say?" in five seconds, for every kid, all
year, without typing more than the outcome itself.** Fast enough to log
mid-hallway-conversation, complete enough to hand an admin, and structured
enough that a start-of-year rollover doesn't lose last year's pattern (e.g.
"we called four times about the same thing last year — should the plan
change?").

## Platform themes that matter here

- **P7 (cross-tool)** — shares roster storage with Name Picker/Class Roster
  Hub already; multiple sections would make it a first-class citizen of that
  shared-roster ecosystem instead of a one-off reader.
- **P6 (print quality)** — the conference packet above is the whole point of
  this tool's existence per the backlog description; it's currently just a
  plain table.
- **P15 (first run)** — outcome templates would remove almost all the typing
  from the first time someone uses this mid-class-period.

## Open Questions

- Sensitivity: this is the most sensitive data of any tool in the toolkit
  (documented details of difficult family conversations). Is browser-only
  local storage sufficient, or does this deserve an explicit "this data never
  leaves your browser and isn't backed up automatically — export before you
  clear your cache" warning banner that other tools don't need?
- Should multiple sections be modeled as separate rosters (like Name Picker)
  or as one roster with a "class period" tag per student? The former matches
  existing conventions; the latter is less duplication if the same student
  roster is shared across contact-log purposes.
