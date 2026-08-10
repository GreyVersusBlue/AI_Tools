# Improvement Prompts — Vocabulary Flashcard & Word Wall Generator

**Tool file:** `Tools/vocab-flashcard-generator.html`
**Support folder:** `Tools/vocab-flashcard-generator/` — `vfg-layout.js`, `vfg-store.js`

**Current description (from README):** Paste a "term: definition" word list, print cut-apart flashcards (front/back pages, mirrored for double-siding) or large word-wall cards. Saves multiple named word lists.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Paste a `term: definition` list; multiple saved lists
  (`gvb-vocab-flashcards:list` / `:data:*`) with import/export
- **Flashcard printing** with front/back pages **mirrored for double-sided
  printing** (`buildFlashPages`, `flashCardHtml`, `defCardHtml`) — the detail
  that makes the output actually usable
- **Word wall cards** at large sizes (`buildWallPages`, `wallCardHtml`) with
  auto-fitting type (`fitFontSizeRem`)
- Cards-per-page selection down to 1 (full page)
- A quiz preview (`renderQuiz`)

## Quick Wins

- **Cut lines and a light border** on the flashcard sheets, plus a margin
  guide, so cutting thirty cards doesn't produce thirty crooked cards.
- **Image on a card.** For vocabulary — especially language and science
  vocabulary — a picture is often the definition. Requires downscaling and a
  storage warning (P12).
- **Part of speech, example sentence, and pronunciation** as optional card
  fields, since a bare definition is rarely enough for a word wall.
- **Alignment test page** before a class set is printed double-sided — the
  mirroring is already right, but the printer's duplex settings are the usual
  culprit and one test page saves a ream.
- **Sort and shuffle** the list; print in a randomized order.
- **Index-card stock sizes** (3×5, 4×6) as presets, not just cards-per-page.
- **Foldable single-sided cards** for printers without duplex — print term and
  definition on one sheet with a fold line, which is what most classroom
  printers actually need.

## Major Features

- **Shared vocabulary store** (P7). This tool,
  `vocab-conjugation-drill.html`, `roleplay-scenario-generator.html`, and
  `novel-study-circles-manager.html` (which accumulates a vocabulary log) all
  hold word lists in incompatible formats. One list should drive flashcards,
  wall cards, drills, review game questions, and a word search.
- **Projected whole-class review mode.** Flip through the deck on the board —
  term, pause, definition — with shuffle and a "missed it" pile the teacher
  taps, producing a reteach list at the end. The existing quiz preview is
  most of the way there.
- **More printable formats from the same list**: a word search, a crossword,
  a matching worksheet, a bingo card set, a quiz with an answer key, a Frayer
  model page per word. Each is a mechanical transformation of the same data
  and each gets used.
- **Word wall as a system**, not a print job — cards sized and coloured by
  unit, with a printable index of which words are up, and an easy way to
  retire a unit's words and add the next.
- **Text-to-speech on the study mode** (P7 — the conjugation drill already
  has it).

## Moonshot / North Star

**One word list, a whole unit of vocabulary instruction.** Paste the terms
once and get: cut-apart flashcards that print correctly on any printer, word
wall cards sized for the room, a Frayer model page per word, a word search and
a crossword for the warm-up, a matching quiz with a key, review game
questions, and a projected whole-class review round that hands you a reteach
list at the end — all offline, all free, all from one paste.

## Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see `_platform-themes.md`). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Student study decks on their own devices**, with self-testing and spaced
  repetition. This is how students actually use flashcards now, and it is
  still out of scope. Printed cards and the projected class review above are
  the teacher-facing equivalents.

## Platform themes that matter here

- **P7 (cross-tool)** — the shared vocabulary store, and formats that feed the
  review game and drill tools.
- **P6 (print quality)** — double-sided alignment, cut lines, and card stock
  sizes are this tool's core craft.
- **P3 (share links)** — sharing a word list with a colleague.
- **P12 (storage)** — if images are added to cards.

## Open Questions

- Which tool should own the shared vocabulary store — this one, the
  conjugation drill, or a new small "word lists" hub in the way
  `class-roster-hub.html` owns rosters? The hub pattern is probably right.
- ~~Is a student-facing study mode in scope?~~ **Answered: no** — students
  aren't intended users. Printed cards remain the deliverable, with the
  projected class review as the on-screen option.
