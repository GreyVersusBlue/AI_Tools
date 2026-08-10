# Improvement Prompts — Silent Reading (SSR) Log Tracker

**Tool file:** `Tools/ssr-log-tracker.html`
**Support folder:** none — single file

**Current description (from README):** Track books and pages read during independent reading time, per student or for the whole class — multiple saved sections, a class summary table, and printable logs.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Multiple class sections (`sslt_sections_v1` / `sslt_current_v1`), loads and
  saves `np_rosters`
- Per-student reading entries (date, book, pages) with add / edit / delete
- **Per-book progress tracking** (`renderBookProgress`, `studentBookList`,
  `isBookFinished`, `setBookFinished`, `withSessionPages`)
- **Weekly goal tracking** (`daysLoggedThisWeek`, `currentWeekRange`,
  `goalCellHtml`)
- Class summary table; date-range filtering
- Print class summary and per-student logs; export CSV
- Loads `_shared/a11y.js`

## Quick Wins

- **Bulk entry built for a stack of paper logs.** The teacher transcribing
  thirty students' reading is the real cost of this tool, and it's currently
  one form at a time. A single grid — student down the side, today's book and
  pages across — plus "same book as last time" defaults and tab-to-advance
  would cut the typing by most of it.
- **Printable paper log slips** students fill in during SSR and hand back, in
  exactly the column order the bulk-entry grid expects, so transcription is
  a straight read-across.
- **Book autocomplete** from books already logged in the class — most
  students in a class are reading from the same classroom library.
- **Reading rate** (pages per minute over logged sessions) — the number that
  makes a conference concrete: "you read 1.2 pages a minute; this book is 240
  pages; that's about three weeks."
- **Books-finished count and a finished-books wall**, which is the motivating
  artifact for middle schoolers, printable as a display.
- **Genre tagging**, so "you've read six fantasy books; try one of these" is a
  conversation the data supports.
- **Undo on Delete class / delete entry** (P11).
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
- **Novel study integration** (P7). `novel-study-circles-manager.html` tracks
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
