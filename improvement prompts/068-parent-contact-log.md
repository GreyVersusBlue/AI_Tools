# Improvement Prompts — 068 — Parent/Guardian Contact Log

**Tool file:** `Tools/068-parent-contact-log.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Log a call, email, or note home per student — date, method, and outcome — with a per-student contact count and a printable history, for quick reference before a conference or a difficult phone call.

---

## Status

**2026-08-12 — session `r8kq4t`.** Backlog rank 2 (as it stood): a reason
tally above the history, with the positive count called out separately.

- **It counts what is filtered, not the whole log.** The useful questions here
  are narrow — this student, this month, this method — and a tally of
  everything answers a question nobody asked. Filter to one student and it
  becomes "what have my four contacts about her actually been about".
- **Good news is pulled out of the list and stated on its own line**, with a
  share as well as a count. As one bar among seven it would be buried, and
  "2" means nothing without "of 7". This is the number the row was really
  about: a teacher keeps it roughly in their head, is sometimes asked for it
  out loud at a conference or an IEP meeting, and the honest answer is usually
  lower than the remembered one.
- **A term with nothing positive in it says so** — "None of them good news
  yet" — rather than leaving the line off. The uncomfortable case is the one
  worth getting right; an absent line is easy to read past.
- Entries logged before the reason axis existed are counted under "(not
  recorded)" rather than dropping out of the total, so the breakdown always
  adds up to the rows underneath. The suite asserts that sum.
- Bars are proportional to the largest reason rather than to the total, so a
  4/3/2/1 spread is legible instead of four slivers. Ties keep the order
  `REASONS` declares, so the list does not reshuffle itself every time a
  contact is logged. The box is an `aria-live` region, since it changes in
  response to a filter rather than a click on itself.
- One bug found by looking at the render rather than the code: `.tally-fill`
  is a bare `<span>`, which is inline and ignores `width` — the bars came out
  as empty tracks. There is now a check that a bar has non-zero width.
- `smoke-reasons.mjs` 30 → 45 checks.

**Where the next round should pick up:** the conference print packet still on
the ranked backlog is the natural next one, and the tally is most of its
header — one student's full history plus this breakdown is exactly the page
that gets handed to an administrator before a meeting.

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
  home/in person/text/other), **reason** (attendance / grades / behavior /
  positive news / academic support / scheduling / other), initials, free-text
  outcome
- Per-student contact count next to each roster name (a `0` count stands out
  in red — an at-a-glance "who haven't I reached" signal), sortable by name
  or by fewest contacts first
- History table: filter by student name, method, **reason**, and/or a date
  range — method and reason compose, so "every attendance phone call" is one
  pair of dropdowns; edit or delete any entry
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
- **Done — 2026-08-11.** **Contact "tags"** (attendance / grades / behavior /
  positive note home) as a lightweight second axis alongside method, since
  "why" matters as much as "how" when a teacher is scanning history before a
  call. *(Shipped as a Reason select on the form and a matching filter that
  composes with the method filter — see the reason-tags round below.)*

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

## Reason-tags round — 2026-08-11 (backlog rank 1)

Shipped the **contact reason** axis — the Quick Win this file already named as
the next best pick.

- Seven reasons on the log form: Attendance, Grades / missing work, Behavior,
  Positive news, Academic support, Scheduling / logistics, Other. A fixed list
  rather than free text, because the whole value is being able to filter and
  scan by it; a free-text field would have produced "behaviour", "behavior" and
  "beh." within a term.
- The history filter gained a matching dropdown that **composes with the method
  filter**, which is the point of a second axis: "every attendance phone call"
  is now one pair of dropdowns.
- The reason travels into the table (as a badge that reads without colour — the
  school printer is black and white), the CSV export, the printed full log, and
  the per-student printed history.

The care went into the old data. Entries logged before this round have no
`reason` field at all, and that reads as **not recorded** everywhere — an em
dash in the table, a blank CSV cell, its own selectable filter bucket — rather
than being guessed at or backfilled, since nothing in an old entry says what it
was about. Opening one for edit shows the first reason but does **not** write
it; only saving does. The suite asserts the legacy entry is byte-for-byte
untouched on disk until an actual save.

New suite `Tools/parent-contact-log/test/smoke-reasons.mjs` (25 checks) as
`npm run test:parent-log`.

### Where the next round should pick up

- The reason axis makes a **"contact balance" readout** cheap and genuinely
  useful: a per-student or class count of positive-news contacts against the
  rest, which is the thing a teacher would actually act on. That was
  deliberately not built here — the row asked for the axis, not the analysis.
- The **conference print packet** idea further down this file is still open,
  and would now naturally group a student's history by reason.
