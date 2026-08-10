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

- **Students should be able to log their own reading.** Thirty students each
  logging two lines is thirty times faster than one teacher typing sixty
  lines. A projected QR/link to a per-student entry form (P3/P9), or even a
  shared classroom device with a "pick your name" screen, would change the
  economics of the tool entirely.
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
- **Book recommendations between students.** A student finishes a book and
  rates it; the class sees what their classmates recommend. Powerful, entirely
  local, and needs no external book database.
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

**The full picture of a reader's year, mostly logged by the reader.** Students
log their own reading in seconds from their own device; the teacher's
conference notes sit beside it; the class sees a wall of finished books and
each other's recommendations; the classroom library knows where its books are;
and at conference time there's a printed report showing exactly what this
child read, how their pace changed, and what to try next — all stored only in
the teacher's browser.

## Platform themes that matter here

- **P9/P3 (student devices, share links)** — student self-logging is the
  change that makes the tool sustainable.
- **P2 (shared roster)** — both reads and writes `np_rosters`.
- **P7 (cross-tool)** — novel study, the timer, and the QR tools all connect.
- **P14 (year lifecycle)** — reading logs are annual and want archiving.

## Open Questions

- Is student self-logging acceptable, given the site's teacher-tool framing?
  It's the highest-value idea here and it does put students in front of the
  tool.
- Should classroom library inventory be part of this tool or its own?
