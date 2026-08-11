# Improvement Prompts — 068 — Parent/Guardian Contact Log

**Tool file:** `Tools/068-parent-contact-log.html`
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

**2026-08-11 — Round 2 (session `4o6xmy`).** Five Quick Wins shipped, all
verified with a headless Chromium smoke test (real interactions, not
mocked, except `window.print`) with zero console errors:

- **Date range filter** (`filterFrom`/`filterTo` date inputs plus a "Clear
  dates" button) added alongside the existing name/method filters in the
  history toolbar — combines with them via simple AND logic.
- **CSV export** (`Export CSV` button) — exports whatever the current
  filter (name/method/date range) currently shows, matching "Print this
  list"'s existing filtered-not-full-log semantics, as a UTF-8 BOM'd CSV
  with proper quoting for commas/quotes/newlines in outcome text.
- **Roster sort toggle** — "Sort by: Name / Fewest contacts first" select
  above the roster list, turning the existing red-zero at-a-glance signal
  into an actual worklist as the backlog's Quick Win described.
- **Confirmation toast** — a small bottom-center toast ("Contact logged." /
  "Contact updated.") replaces the previous silent form-clear.
- **Enter-to-submit** — Enter in the outcome textarea logs the contact
  (Shift+Enter still inserts a newline), matching the pattern description
  exactly.

**Where the next round should pick up:** Contact "tags" (attendance/
grades/behavior/positive) as a second axis alongside method is the next
Quick Win, then the two Major Features that matter most for this tool's
sensitivity — follow-up flags and the real conference print packet (title
page + blank note area) — since this remains the single most
sensitive-data tool in the toolkit and still has no explicit "this never
leaves your browser, export before clearing your cache" warning banner
(see Open Questions below, still open). Multiple sections/classes is the
other big lift, deliberately not attempted this round since it changes the
storage shape (see Open Questions).

## What it does today

- Roster: type/paste names, or pull a saved Name Picker roster in
- Log a contact: student, date (defaults today), method (phone/email/note
  home/in person/text/other), initials, free-text outcome
- Per-student contact count next to each roster name (a `0` count stands out
  in red — an at-a-glance "who haven't I reached" signal), sortable by name
  or by fewest contacts first
- History table: filter by student name, method, and/or a date range; edit
  or delete any entry
- Print the full filtered list, or one student's whole history, as a plain
  table; export the filtered list as CSV
- Log the form with Enter from the outcome field, with a confirmation toast

## Quick Wins

- **Done — Date range filter** on the history table (from/to date inputs,
  combines with the existing name/method filters) — a "this quarter/this
  semester" preset dropdown would be a nice follow-up but plain from/to
  covers the described use case.
- **Done — CSV export**, scoped to the current filter (matches "Print this
  list"'s existing filtered-not-full-log behavior).
- **Done — Sort the roster list** by "fewest contacts first" as a view
  option.
- **Done — Confirmation toast instead of nothing** after logging a contact.
- **Done — Keyboard-friendly logging**: Enter in the outcome field submits,
  Shift+Enter inserts a newline.
- **Contact "tags"** (attendance / grades / behavior / positive note home)
  as a lightweight second axis alongside method, since "why" matters as much
  as "how" when a teacher is scanning history before a call. *(Still open —
  next round's best Quick Win pick.)*

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
