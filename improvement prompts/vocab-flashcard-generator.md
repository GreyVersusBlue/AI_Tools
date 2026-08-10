# Improvement Prompts — Vocabulary Flashcard & Word Wall Generator

**Tool file:** `Tools/vocab-flashcard-generator.html`
**Support folder:** `Tools/vocab-flashcard-generator/` — `vfg-layout.js`, `vfg-store.js`

**Current description (from README):** Paste a "term: definition" word list, print cut-apart flashcards (front/back pages, mirrored for double-siding) or large word-wall cards. Saves multiple named word lists.

---

## Status

**2026-08-10 — implementation round.** Shipped all five Quick Wins scoped for
this round: cut lines & margin guide, part-of-speech/pronunciation card
fields (example sentence already existed — verified, not duplicated), sort +
shuffle, index-card stock size presets, and a foldable single-sided layout.
Storage stayed additive — `cardSizePreset`, `flashLayout`, `sortOrder`, and
`showGuides` are all defaulted in `loadListByName()` for lists saved before
this round, and the JSON import handler normalizes the same fields from an
older export.

What shipped, in order of the Quick Wins list:

- **Cut lines and a light border, plus a margin guide** — a "Cut lines &
  margin guide" checkbox (on by default) that adds a `.guides` class to the
  page wrapper (a dashed inset outline approximating the printable-safe
  margin) and to every card (a solid border instead of the lighter dashed
  default), via a small `guideClass()`/`pageClass()` helper threaded through
  every card renderer (`flashCardHtml`, `defCardHtml`, `wallCardHtml`,
  `foldCardHtml`).
- **Optional per-card fields: part of speech, example sentence, pronunciation
  guide.** Checked first: **example sentence already existed** (a third
  column, or `| example sentence` after the colon-format definition,
  parsed by `VocabLayout.parseWordList`) — not duplicated. Added
  **pronunciation** and **part of speech** as two more optional
  tab/comma/pipe-delimited columns (`term: definition | example |
  pronunciation | part of speech`, each segment optional), rendered on the
  card front (pronunciation, under the term) and back (part of speech,
  above the definition) for flashcards, word wall cards, the fold layout,
  and the self-quiz.
- **Sort and shuffle controls.** A new `VocabLayout.sortItems()` (A→Z / Z→A
  by term / "as entered") composes with the existing shuffle checkbox via a
  single `currentItems()` helper that both the live preview and the print
  build now call, so preview and print can never disagree about ordering.
- **Index-card stock sizes (3×5, 4×6).** A "Card stock size" select next to
  Columns/Rows; picking a preset locks columns/rows to a fixed grid (2×2 for
  3×5, 2×1 for 4×6) and switches the card grid from `1fr`-stretched cells to
  fixed-inch cells (`CARD_SIZE_PRESETS`), centered on the page instead of
  filling it edge-to-edge.
- **Foldable single-sided card layout.** A "Printing layout" select
  (Double-sided / Single-sided fold-over). The fold layout
  (`foldCardHtml`/`buildFoldPages`) prints term-on-top, definition rotated
  180° underneath a dashed fold line — fold the card back (a valley fold)
  and the definition reads right-side up on the reverse, with no duplex
  pass needed.

Also built this round: the lightweight **cross-tool bridge** to Vocab &
Conjugation Drill Generator (see Open Questions for the shape and what's not
bridged yet).

Not attempted this round: **image on a card** and the **alignment test
page** (both Quick Wins in the backlog below), and everything under Major
Features / Moonshot.

## What it does today

- Paste a `term: definition` list, with three more optional
  tab/comma/pipe-delimited columns — **example sentence, pronunciation,
  part of speech** — all parsed by `VocabLayout.parseWordList`; multiple
  saved lists (`gvb-vocab-flashcards:list` / `:data:*`) with import/export
- **Sort** (A→Z / Z→A / as entered, `VocabLayout.sortItems`) and **shuffle**
  the list before printing, composed through one `currentItems()` helper so
  the live preview and the print output always agree
- **Flashcard printing** with front/back pages **mirrored for double-sided
  printing** (`buildFlashPages`, `flashCardHtml`, `defCardHtml`), or a
  **single-sided fold-over layout** (`buildFoldPages`, `foldCardHtml`) for
  printers without duplex — the detail that makes the output actually usable
- **Cut lines and a margin guide** (`guideClass`/`pageClass`), on by default,
  toggleable
- **Index-card stock size presets** (3×5, 4×6, `CARD_SIZE_PRESETS`) alongside
  the custom columns/rows grid
- **Word wall cards** at large sizes (`buildWallPages`, `wallCardHtml`) with
  auto-fitting type (`fitFontSizeRem`)
- Cards-per-page selection down to 1 (full page)
- A quiz preview (`renderQuiz`)
- **Read-only import bridge** from Vocab & Conjugation Drill Generator's
  saved drill sets (`vfg-conjdrill-link.js`)

## Quick Wins

- **Done —** **Cut lines and a light border** on the flashcard sheets, plus a margin
  guide, so cutting thirty cards doesn't produce thirty crooked cards.
  *(A toggleable "Cut lines & margin guide" checkbox, on by default —
  a dashed inset outline on the page plus a solid card border.)*
- **Skipped — deferred.** **Image on a card.** For vocabulary — especially language and science
  vocabulary — a picture is often the definition. Requires downscaling and a
  storage warning (P12). *(Not part of this round's scoped list. The
  downscale-on-import pattern already exists in `formula-sheet-builder.html`
  — `readAndDownscaleImage` — and would be the template to copy.)*
- **Done —** **Part of speech, example sentence, and pronunciation** as optional card
  fields, since a bare definition is rarely enough for a word wall.
  *(Example sentence already existed — verified before building, not
  duplicated. Added part of speech and pronunciation as two more optional
  columns, shown on the card front/back and in the self-quiz.)*
- **Skipped — deferred.** **Alignment test page** before a class set is printed double-sided — the
  mirroring is already right, but the printer's duplex settings are the usual
  culprit and one test page saves a ream. *(Not part of this round's scoped
  list — a natural next Quick Win; would print one front page + one back
  page with big registration marks instead of the full deck.)*
- **Done —** **Sort and shuffle** the list; print in a randomized order. *(A Sort
  select — A→Z / Z→A / as entered — alongside the existing Shuffle
  checkbox; composable, and now the single source both the preview and
  print pull from.)*
- **Done —** **Index-card stock sizes** (3×5, 4×6) as presets, not just cards-per-page.
  *(A "Card stock size" select; a preset locks columns/rows to a fixed grid
  and switches cards from stretch-to-fill to fixed physical inches,
  centered on the page.)*
- **Done —** **Foldable single-sided cards** for printers without duplex — print term and
  definition on one sheet with a fold line, which is what most classroom
  printers actually need. *(A "Printing layout" select; the fold layout
  rotates the definition half 180° under a dashed fold line so a valley
  fold puts it right-side up on the reverse.)*

## Major Features

- **Partially done — lightweight bridge shipped, full hub deferred.**
  **Shared vocabulary store** (P7). This tool,
  `vocab-conjugation-drill.html`, `roleplay-scenario-generator.html`, and
  `novel-study-circles-manager.html` (which accumulates a vocabulary log) all
  hold word lists in incompatible formats. One list should drive flashcards,
  wall cards, drills, review game questions, and a word search.
  *(A full shared hub was explicitly out of scope for this round. Instead,
  this tool gained `vfg-conjdrill-link.js` — a read-only reader of Vocab &
  Conjugation Drill Generator's saved sets, converting to this tool's own
  `{term, definition, example, pronunciation, partOfSpeech}` shape — and
  that tool gained the mirror-image bridge reading this tool's lists. Copies
  the pattern `writing-prompt-generator.html`'s `wpg-rubric-link.js`
  established. See Open Questions below for exactly what does and doesn't
  make the trip.)*
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
