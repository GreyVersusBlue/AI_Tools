# Improvement Prompts — Novel Study / Reading Circles Manager

**Tool file:** `Tools/novel-study-circles-manager.html`
**Support folder:** none — single file

**Current description (from README):** Splits a roster into reading circles and rotates discussion roles meeting after meeting, with a chapter checkpoint logged each time.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Projects per novel (`novel-study-circles` / `-current`), with import/export
- Splits a roster into circles (loads `np_rosters`), editable group membership
- **Role rotation with recency memory** (`roleRecencyScore`, `recordHistory`)
  across meetings — the same good idea as the lab role randomizer
- **Meeting log** with chapter checkpoints (`meetingCheckpointLabel`,
  `renderCheckpointInputs`, pace radios) and per-meeting delete
- **Vocabulary log** (`parseVocabLines`, `renderVocabLog`) accumulated across
  the study
- Prints: today's roles sheet, full meeting log, vocabulary list

## Quick Wins

- **Role sheets with the role's actual job on them.** Discussion Director,
  Word Wizard, Connector, Illustrator — each needs its prompts printed, not
  just its name. This is the difference between roles working and roles being
  a label.
- **Discussion question bank per role**, so the Discussion Director has five
  starter questions rather than a blank page.
- **Reading schedule generator.** Given a book length and an end date, produce
  the per-meeting chapter targets — the tool logs checkpoints but doesn't help
  plan them, and calendar awareness (P7) would make it account for holidays.
- **Individual accountability sheet** — a per-student half sheet for the
  reading between meetings, which is where reading circles usually fall apart.
- **Vocabulary handoff** (P7). The vocabulary log should export directly to
  `vocab-flashcard-generator.html` and `review-game-board.html` rather than
  ending as a printed list.
- **Undo on "Delete this meeting"** and on role-history reset (P11).

## Major Features

- **Multiple books at once.** Differentiated reading circles mean four groups
  reading four different books at four different paces — the single most
  common real shape of this activity and currently one project per book with
  no shared view.
- **Discussion assessment.** A quick per-meeting rubric tap (participated /
  prepared / advanced the conversation) with a printable summary. This is the
  hardest thing to grade in an ELA classroom and the tool is already in the
  room when it happens.
- **Student-facing role card by link/QR** (P3) so each student's job and
  questions are on their own device.
- **Book and reading-log integration** (P7). `ssr-log-tracker.html` already
  tracks books and pages; a student in a novel study is doing both, in two
  tools that don't know about each other.
- **Reusable across the year.** Roles, question banks, and reading schedules
  saved as reusable templates rather than rebuilt per book.
- **Meeting-day board.** Project today's circles, roles, chapter target, and a
  discussion timer — the shape this tool takes on the actual day.

## Moonshot / North Star

**Reading circles that run themselves for a whole unit.** Set up the books,
the groups, and the end date; get a paced reading schedule that respects the
school calendar, rotating roles that nobody repeats, printed role cards with
real prompts on them, an accountability sheet between meetings, a running
vocabulary list that feeds flashcards and a review game, and a per-student
discussion record — with the projector showing today's circles when the bell
rings.

## Platform themes that matter here

- **P7 (cross-tool)** — role rotation duplicated from the lab tool, group
  formation duplicated from three tools, vocabulary that should flow onward,
  reading logs that already exist elsewhere.
- **P2 (shared roster)** — role history needs stable IDs.
- **P6 (print quality)** — role cards and accountability sheets are the
  deliverables.
- **P14 (year lifecycle)** — templates should outlive a single book.

## Open Questions

- Should the role-rotation engine be shared with
  `lab-group-role-randomizer.html`, or are the roles different enough that
  only the recency algorithm is worth sharing?
- Is discussion assessment something to build here, or is it a rubric problem
  that `rubric-builder.html` should own with this tool calling it?
