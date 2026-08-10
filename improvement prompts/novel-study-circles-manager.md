# Improvement Prompts — 027 — Novel Study / Reading Circles Manager

**Tool file:** `Tools/novel-study-circles-manager.html`
**Support folder:** none — single file

**Current description (from README):** Splits a roster into reading circles and rotates discussion roles meeting after meeting, with a chapter checkpoint logged each time.

---

## Status

**2026-08-10 — Round 5 (PR #56): three Quick Wins shipped.** `state.roles`
changed shape from `[string, ...]` to `[{name, prompts}, ...]`; a
`normalizeRoles()` helper migrates old string-shaped roles (including ones
inside a JSON import) on load, so existing saved projects and old exports
keep working.

- **Done — Role sheets with the role's actual job on them.** Each of the six
  default roles (Discussion Director, Summarizer, Word Wizard, Passage
  Picker, Connector, Illustrator) ships with 3-4 starter discussion prompts;
  the role editor now has a prompts textarea per role (one per line) instead
  of just a name field. A teacher-added role starts with an empty prompt
  list rather than a guess.
- **Done — Discussion question bank per role**, via the same prompts field
  above — this and the "role sheets" item were really one feature once
  written, so both shipped together as a new **"Print role cards"** output:
  one card per (student, role) from the latest meeting, with that role's
  prompts printed as a numbered list and the group's checkpoint underneath.
  "Group Member" doesn't get a card (no job to print).
- **Done — Reading schedule generator.** A new "Reading Schedule Planner"
  card: total chapters/pages, a start and end date, and which weekdays the
  class meets → an evenly-paced per-meeting chapter target. Clicking a
  schedule row drops that date and "Through Chapter N" checkpoint straight
  into the Log a Meeting form below. Explicitly does **not** know about
  school holidays or early-release days (calendar awareness is P7, deferred);
  the UI says so directly rather than silently being wrong.
- **Done — Individual accountability sheet**, as a "Print reading logs"
  output: one half-sheet-ish card per student (grouped by reading circle)
  with the next reading due (pulled from the schedule planner, or the latest
  meeting's checkpoint if no schedule exists) and blank fields for a
  question, a passage to discuss, and something noticed/predicted.

Verified with a headless Chromium smoke test: split a roster into groups,
confirmed 6 role-prompt textareas render with non-empty defaults, generated
and printed a schedule (rows clickable, prefill confirmed), logged a
meeting, and printed both new outputs (role cards contained an `<ol>` of
prompts; accountability sheets rendered one per student) — no console
errors.

**Where a future round should pick up:** multiple books at once, discussion
assessment, book/reading-log integration with `ssr-log-tracker.html`, and
reusable-across-the-year templates are all still open (Major Features
below). The vocabulary-handoff-to-other-tools idea (P7) is also untouched.

Ideas below are deliberately ambitious and are **not** scoped to a single
session.

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

- **Done —** **Role sheets with the role's actual job on them.** Discussion Director,
  Word Wizard, Connector, Illustrator — each needs its prompts printed, not
  just its name. This is the difference between roles working and roles being
  a label. *(Shipped as "Print role cards.")*
- **Done —** **Discussion question bank per role**, so the Discussion Director has five
  starter questions rather than a blank page. *(Same prompts field powers
  both this and the role cards above.)*
- **Done —** **Reading schedule generator.** Given a book length and an end date, produce
  the per-meeting chapter targets — the tool logs checkpoints but doesn't help
  plan them, and calendar awareness (P7) would make it account for holidays.
  *(Weekday picker instead of full calendar awareness; still doesn't know
  about holidays — see Status.)*
- **Done —** **Individual accountability sheet** — a per-student half sheet for the
  reading between meetings, which is where reading circles usually fall apart.
  *(Shipped as "Print reading logs.")*
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

## Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see `_platform-themes.md`). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Role cards on student devices** by link/QR, instead of printing them.
  Printing is the teacher-facing path and is already the better artifact,
  since the role prompts need to sit in front of the student all meeting.

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
