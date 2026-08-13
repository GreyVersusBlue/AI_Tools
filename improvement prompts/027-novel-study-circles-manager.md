# Improvement Prompts — 027 — Novel Study / Reading Circles Manager

**Tool file:** `Tools/027-novel-study-circles-manager.html`
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
assessment, book/reading-log integration with `033-ssr-log-tracker.html`, and
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
  the study, with handoff exports to both `040-vocab-flashcard-generator.html`
  and `030-review-game-board.html` (each mints a new, uniquely-named list/
  board there rather than overwriting anything)
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
- **Done — Pass 2, Round 2 — Vocabulary handoff** (P7). The vocabulary log
  now exports directly to `040-vocab-flashcard-generator.html` via an
  "Export vocabulary to Flashcard Generator" button, in addition to the
  printed list. *(`030-review-game-board.html` handoff shipped 2026-08-13 —
  see update below.)*
- **Done — Pass 2, Round 2 — Undo on "Delete this meeting"** and on
  role-history reset (P11).

## Major Features

- **Multiple books at once.** Differentiated reading circles mean four groups
  reading four different books at four different paces — the single most
  common real shape of this activity and currently one project per book with
  no shared view.
- **Discussion assessment.** A quick per-meeting rubric tap (participated /
  prepared / advanced the conversation) with a printable summary. This is the
  hardest thing to grade in an ELA classroom and the tool is already in the
  room when it happens.
- **Book and reading-log integration** (P7). `033-ssr-log-tracker.html` already
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
  `022-lab-group-role-randomizer.html`, or are the roles different enough that
  only the recency algorithm is worth sharing?
- Is discussion assessment something to build here, or is it a rubric problem
  that `003-rubric-builder.html` should own with this tool calling it?

## Pass 2 — Round 2 update — 2026-08-11 (session `mxpfjs`)

Shipped the two remaining Quick Wins.

**1. Vocabulary handoff to Flashcard Generator (P7).** New "Export
vocabulary to Flashcard Generator" button next to "Print vocabulary list."
Every vocab word logged across every meeting (`state.meetings`, oldest-first)
is deduped case-insensitively on the word, keeping the earliest non-empty
definition, and formatted as `term: definition` per line — the same colon
convention this tool already uses for typing vocab in
(`parseVocabLines`) and the one `040-vocab-flashcard-generator.html`'s own
`VocabLayout.parseWordList` reads. It's written directly into that tool's own
localStorage contract (`Tools/vocab-flashcard-generator/vfg-store.js`): a new,
uniquely-named entry appended to the name list at `gvb-vocab-flashcards:list`,
the full list-state blob at `gvb-vocab-flashcards:data:<name>` (`{name, words,
mode: 'flashcards', flashCols: 2, flashRows: 4, cardSizePreset: 'grid',
flashLayout: 'duplex', wallPerPage: 2, wallShowDef: true, sortOrder: 'none',
shuffle: false, showGuides: true}`), and the `gvb-vocab-flashcards:current`
pointer that tool reads on boot — same mechanics as
`wpg-rubric-link.js`/`vfg-conjdrill-link.js`, except there's no pre-existing
Flashcard Generator list to point at for a brand-new novel-study project's
vocabulary, so this mints one (never overwriting any existing saved list
there) rather than only writing a `:current` pointer. Opens
`040-vocab-flashcard-generator.html` in a new tab afterward. The
`030-review-game-board.html` half of the original idea is still open.

**2. Undo on "Delete this meeting" and role-history reset (P11).** New
single-level `undoSnapshot` module variable (not persisted, same pattern as
`022-lab-group-role-randomizer.html`) plus one shared "Undo" button under the
message bar, disabled by default. Deleting a meeting or resetting role
history snapshots the field it's about to overwrite (`state.meetings` or
`state.history`) before mutating it, arms the button with a matching label
("Undo: delete meeting" / "Undo: reset role history"), and clicking it
restores that field, re-renders, and disables the button again. The button
also disables itself (snapshot invalidated) when logging a new meeting —
which mutates both meetings and role history — or when switching/loading/
creating a project, since either would make the snapshot stale. Only the
most recent destructive action is undoable (single level, not a stack).

**Testing.** `node --check` on the extracted inline script. Headless
Chromium (`/opt/pw-browsers/chromium`) smoke test: built a roster, split
into groups, logged two meetings with overlapping vocabulary, exported to
Flashcard Generator and inspected the exact localStorage keys/shape written,
then loaded `040-vocab-flashcard-generator.html` in a second page with that
same storage and confirmed it booted straight into the exported list (name,
word text, and rendered preview cards all matched) — a real round-trip, not
just a write. Then deleted a meeting and undid it (meeting restored, button
re-disabled), deleted again and confirmed logging a new meeting invalidated
the undo, and reset role history and undid that (history restored, button
re-disabled). Zero console errors on either page throughout.

**What's still open** (see Major Features above for the full picture):
multiple books at once (differentiated circles reading different books in
one class), discussion assessment (a per-meeting participation rubric),
book/reading-log integration with `033-ssr-log-tracker.html`, and reusable
templates for roles/question banks/schedules across the year.

## Pass 2, Round 3 update — 2026-08-13

**Shipped — Vocabulary handoff to Review Game Board (P7), the other half of
the original idea.** New "Export vocabulary to Review Game Board" button next
to the two existing vocabulary outputs (print, Flashcard Generator export).
Same non-overwriting bridge pattern as the Flashcard Generator handoff,
targeting `030-review-game-board.html`'s own localStorage contract
(`Tools/review-game-board/rgb-store.js`): a new, uniquely-named entry
appended to `gvb-review-board:list`, the full board blob at
`gvb-review-board:data:<name>` (`{name, categories:[{name, clues:[{points,
question, answer, used, dailyDouble}]}], teams:[{name,score}],
dailyDoubleEnabled:false, lightningRoundEnabled:false,
lightningRoundSeconds:15}`), and the `gvb-review-board:current` pointer that
tool reads on boot — written directly to those keys rather than going through
`ReviewBoardStore`'s API, matching how the Flashcard handoff also writes its
target's raw keys instead of loading `vfg-store.js`. Opens
`030-review-game-board.html` in a new tab afterward.

Three judgment calls, each recorded in a comment at the handoff site:

- **Clue direction: `question = definition`, `answer = word`.** A review
  game is played by reading a clue aloud and having a team name the answer,
  so the definition is what gets read out and the word is what a team has
  to produce — the opposite of the Flashcard export's `term: definition`
  line, which is read front-to-back by one student studying alone. A word
  logged with no definition anywhere in the log can't make a real clue in
  either direction, so (unlike the Flashcard export, which can still show a
  word-only card) it's dropped from this export; the success message says
  how many were skipped when that happens.
- **Grouping: one category per meeting checkpoint that has vocabulary**, via
  `meetingCheckpointLabel()` — the same label the printed vocabulary list
  already groups by — in the order those meetings happened. A study whose
  vocabulary was all logged at a single meeting collapses to one category
  on its own, which is the right flat fallback without special-casing it.
  Two meetings sharing the same checkpoint label (e.g. both logged the same
  date) also naturally collapse into one category, since the label itself
  is the grouping key.
- **Points: 100/200/300/... in logging order within each category.** An
  ordinary review-game point ladder; the tool has no basis to judge word
  difficulty, so it doesn't invent one.

**Testing.** `node --check` on the extracted inline script. Ad hoc headless
Chromium (`PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/...`,
`Tools/board-check/harness.mjs`) smoke test since this tool has no `test/`
folder: built a roster, split into groups, logged two meetings on different
dates with overlapping vocabulary (one word logged without a definition at
meeting 1 and backfilled at meeting 2), exported to the Review Game Board and
inspected the exact localStorage keys/shape written (one board, two
categories matching the two meeting dates, correct clue counts, backfilled
definition preserved, `question`/`answer` in the intended direction,
ascending points, default two teams), then loaded
`030-review-game-board.html` in a second page/context sharing that storage
and confirmed it booted straight into the exported board (setup screen
skipped, board card visible) — a real round-trip, not just a write. Zero
console/page errors on either page throughout. `npm run check:dedupe` still
passes (no new files, nothing vendored duplicated).

**What's still open**: multiple books at once, discussion assessment,
book/reading-log integration with `033-ssr-log-tracker.html`, and reusable
templates across the year — see Major Features above.
