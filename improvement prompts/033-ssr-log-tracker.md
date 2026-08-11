# Improvement Prompts — 033 — Silent Reading (SSR) Log Tracker

**Tool file:** `Tools/033-ssr-log-tracker.html`
**Support folder:** none — single file

**Current description (from README):** Track books and pages read during independent reading time, per student or for the whole class — multiple saved sections, a class summary table, and printable logs.

---

## Status

### Pass 2 — Round 2 — 2026-08-11 — session `j6ok2v`

- **Done — Printable finished-books wall.** The "Books completed" count
  already existed in the class summary table (`finishedCount`); this adds
  the display artifact itself — a "Print finished-books wall" button that
  prints one card per student with at least one book checked off, listing
  every title they've finished, with a total-books/total-readers header
  line. Skips students with nothing finished rather than printing empty
  cards.
- **Fixed a real bug found while testing that feature.** The single-entry
  `#entryForm` submit handler never called `renderBookProgress()` — the
  bulk-entry save handler did, but the everyday single-entry path didn't —
  so the "Books" checklist under a student's log silently failed to show a
  newly-logged book until some unrelated action happened to trigger a full
  re-render. Since the finished-books wall depends entirely on that
  checklist being checkable, this was blocking the new feature as well as
  being wrong on its own; added the missing call.

Verified in headless Chromium: logging a book via the single-entry form
now populates the Books checklist immediately (reproduced the stale
checklist before the fix, confirmed it's gone after); marking one
student's book finished and printing the wall shows exactly that student
and book, excludes a student with no finished books, and the empty-state
alert fires correctly when no student in the class has any finished book
yet.

**Where a future round should pick up:** genre tagging and reading
conference notes are the two Quick Win-scale items still open (Major
Features below) that build directly on the book-progress data this round
touched. The bigger items — goals/challenges, novel-study integration,
and classroom library inventory — are all still open and larger lifts.

**2026-08-10 — Round 6 (PR #58): five Quick Wins shipped.**

- **Done — Bulk entry grid.** A collapsible "Bulk entry" section: one row
  per roster student (Student / Book / Pages read to / Minutes) for a single
  date, tab-ordered down the grid. Each row's book defaults to that
  student's most-recently-logged title ("same book as last time"); reopening
  the grid for a date that already has entries shows the existing values
  instead of blanks, so it doubles as a same-day review/correction view.
  Only rows with a pages value are saved — untouched rows are silently
  skipped, so a partial day's entry doesn't force filling in the whole
  class. Existing single-day entries and bulk-saved entries land in the
  exact same data structure and are fully interchangeable.
- **Done — Printable paper log slips.** One card per roster student, in
  roster order — the same order the bulk-entry grid lists students in — so
  a stack of filled-in slips reads straight down into the grid rather than
  requiring the teacher to hunt for each name.
- **Done — Book autocomplete.** A shared `<datalist>` of every distinct book
  title already logged anywhere in the class, wired to both the single-entry
  form and every bulk-grid row.
- **Done — Reading rate.** Pages-per-minute computed from every entry with
  minutes logged, shown on the per-student card once at least two timed
  sessions exist ("1.11 pages/minute — based on 2 timed sessions"). Kept to
  the per-student view rather than added as a summary-table column, since a
  reading-pace number is conference material, not a whole-class scan.
- **Done — Undo on Delete class / delete entry (P11).** One shared undo
  slot (a banner with a 10-second auto-dismiss) rather than a per-item
  history — deleting an entry or a whole class shows what was removed and a
  one-tap Undo. The restore functions close over the actual removed data
  (or, for a class, the whole storage blob) rather than reading current UI
  state, so Undo still works correctly even if the teacher has navigated
  elsewhere in the meantime.

A real bug was caught during testing, not by inspection: the bulk-save
handler set its own status message ("Saved 2 entries.") *before* calling
`renderBulkTable()`, which unconditionally clears that same status line as
part of its normal refresh — so the message was wiped the instant it was
set, and every bulk save silently showed a blank status. Fixed by moving the
status-line write to after the refresh. Caught by asserting the actual
status text in a headless-Chromium run, not just that the save didn't throw.

Verified end-to-end in headless Chromium: two timed entries producing the
right pages/minute rate, the datalist populated after logging a book, the
bulk grid defaulting a continuing book correctly, a bulk save landing in the
same per-student log the single-entry form reads, entry-delete-then-undo and
class-delete-then-undo both restoring exactly the prior state, and the
printed slips rendering one card per roster student. No console errors.

**Where a future round should pick up:** reading conference notes, goals and
challenges (weekly page targets, a class-wide "million pages" thermometer),
the printed class-recommendations board, and novel-study/library-inventory
cross-tool integration are all still open (Major Features below) — the
bulk-entry grid this round built is the piece those all would sit on top of.

Ideas below are deliberately ambitious and are **not** scoped to a single
session.

## What it does today

- Multiple class sections (`sslt_sections_v1` / `sslt_current_v1`), loads and
  saves `np_rosters`
- Per-student reading entries (date, book, pages) with add / edit / delete
- **Per-book progress tracking** (`renderBookProgress`, `studentBookList`,
  `isBookFinished`, `setBookFinished`, `withSessionPages`)
- **Weekly goal tracking** (`daysLoggedThisWeek`, `currentWeekRange`,
  `goalCellHtml`)
- **Genre tags on books** (`setGenreFor`, `genreCountsFor`, `renderGenreSpread`)
  — an optional genre per *title*, shared across every student reading it, with
  per-student chips, a class genre filter, and a printable genre-spread grid
- Class summary table; date-range filtering
- Print class summary and per-student logs; export CSV
- Loads `_shared/a11y.js`

## Quick Wins

- **Done —** **Bulk entry built for a stack of paper logs.** The teacher transcribing
  thirty students' reading is the real cost of this tool, and it's currently
  one form at a time. A single grid — student down the side, today's book and
  pages across — plus "same book as last time" defaults and tab-to-advance
  would cut the typing by most of it.
- **Done —** **Printable paper log slips** students fill in during SSR and hand back, in
  exactly the column order the bulk-entry grid expects, so transcription is
  a straight read-across.
- **Done —** **Book autocomplete** from books already logged in the class — most
  students in a class are reading from the same classroom library.
- **Done —** **Reading rate** (pages per minute over logged sessions) — the number that
  makes a conference concrete: "you read 1.2 pages a minute; this book is 240
  pages; that's about three weeks."
- **Done —** **Books-finished count and a finished-books wall**, which is the motivating
  artifact for middle schoolers, printable as a display. *(The count already
  existed in the summary table; the wall itself shipped this round.)*
- **Genre tagging**, so "you've read six fantasy books; try one of these" is a
  conversation the data supports.
- **Done —** **Undo on Delete class / delete entry** (P11).
- **Timer for the SSR period itself** (P7 — the timer already exists).

## Major Features

- **Reading conference notes.** The teacher's per-student notes from a reading
  conference, dated, alongside the log — turning a page counter into the
  record of the reading relationship, and exactly what you want in front of
  you at a conference.
- **Goals and challenges.** Personal page goals, a class total (a "read a
  million pages" thermometer), a 40-book challenge tracker — the structures
  that make independent reading programs work.
- **A printed class recommendations board.** The teacher records a rating when
  a student finishes a book, and the tool prints a "what your classmates
  recommend" sheet or poster for the classroom library wall — the same social
  effect, produced as a teacher artifact.
- **Novel study integration** (P7). `027-novel-study-circles-manager.html` tracks
  students reading assigned books with chapter checkpoints; this tracks
  independent reading. A student is doing both and the tools don't know about
  each other.
- **Parent-facing reading report**, printable, showing what a child read this
  quarter and how consistently — one of the most welcome things a parent can
  receive.
- **Classroom library inventory.** Which books exist, who has which one
  checked out, what's missing — the natural sibling problem, and one every
  classroom library has (QR codes on books; the site already has both a
  generator and a scanner, P7).

## Moonshot / North Star

**The full picture of a reader's year, logged in minutes a week.** Paper slips
come back in the order the bulk-entry grid expects, so a class set is
transcribed in one pass; the teacher's conference notes sit beside the log;
the wall gets a printed finished-books display and a class recommendations
board; the classroom library knows where its books are; and at conference time
there's a printed report showing exactly what this child read, how their pace
changed, and what to try next — all stored only in the teacher's browser.

## Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see `_platform-themes.md`). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Student self-logging.** Students entering their own reading from a
  projected QR/link or a shared classroom device. This would genuinely change
  the tool's economics — transcription is its real cost — and it is
  nonetheless out of scope. The bulk-entry grid and matching paper slips above
  are the teacher-facing way to attack the same cost.
- **Student-to-student book recommendations** displayed in-app, as opposed to
  the printed recommendations board above.

## Platform themes that matter here

- **P6 (print quality)** — paper log slips and the parent-facing report are
  the outputs that make the tool sustainable.
- **P2 (shared roster)** — both reads and writes `np_rosters`.
- **P7 (cross-tool)** — novel study, the timer, and the QR tools all connect.
- **P14 (year lifecycle)** — reading logs are annual and want archiving.

## Open Questions

- ~~Is student self-logging acceptable?~~ **Answered: no** — students aren't
  intended users of this site. That makes transcription cost the central
  design problem for this tool, so the bulk-entry grid matters more than it
  otherwise would.
- Should classroom library inventory be part of this tool or its own?

## Genre round — 2026-08-11 (backlog rank 1)

Shipped **genre tags on books**, with the per-student and class views the
backlog row asked for.

The design decision that makes it maintainable: **a genre belongs to a book,
not to an entry and not to a student.** `state.genres` is a `{ bookKey: genre }`
map on the section, keyed exactly like `withSessionPages`/`studentBookList`
already key titles. One teacher tagging "Hatchet" as Adventure tags it for every
student reading it and for every session logged against it, forever. Tagging
per entry would have meant re-picking a genre on every one of a class's ~600
entries a year, which nobody would do, and the data would be junk.

- **Two ways in.** A genre field on the entry form (free text, backed by a
  datalist of the 13 presets plus whatever the class already uses), which
  pre-fills the moment a title that is already tagged is typed; and a small
  genre input on each row of a student's Books list. Both write the same map.
- **Per student:** genre chips under the Books list, counting **distinct
  titles**, not sessions — a slow reader on one long fantasy novel should not
  read as a genre addict. Untagged books get their own muted chip rather than
  vanishing.
- **Class filter:** a genre dropdown beside the date filter, applying to
  exactly what the date filter applies to (the totals, the CSV, the printed
  summary — never "current book" or "days logged this week"). The printed
  summary names the genre it was filtered to, since a page that silently showed
  only fantasy totals would be a lie by omission on somebody's desk. The
  untagged bucket is selectable in its own right, for cleanup passes.
- **Class spread grid:** students down the side, genres in use across, distinct
  titles per cell, zeros marked — the gap view, on screen and as its own print
  for a PLC meeting or a conference folder.
- The CSV export gained a Genre column; the per-student printed log gained one
  too.
- **Migration:** sections saved before this round have no `genres` key at all,
  and an absent map reads identically to "nothing tagged yet", so nothing to
  migrate and nothing to lose. The suite loads a pre-genres section and checks
  its entries survive the first save with the new field.

One UI trap worth remembering: the genre input sits inside the Books row's
`<label>`, so a click in it toggled the "finished" checkbox that label is for.
The click handler preventDefaults for that input.

New suite `Tools/ssr-log-tracker/test/smoke-genres.mjs` (33 checks) as
`npm run test:ssr`.

### Where the next round should pick up

- Nothing reads genres across *classes* yet. A teacher with five sections has
  five separate genre maps, so the same book tagged in period 3 is untagged in
  period 5. A shared book table (P7/P8) would fix that, and is the natural next
  step — but it is a storage-schema change and wants its own round.
- A genre-balance nudge ("Ada has read six graphic novels and nothing else
  since October") would fall straight out of `genreCountsFor`, and is closer to
  what a teacher actually acts on than the grid alone.
