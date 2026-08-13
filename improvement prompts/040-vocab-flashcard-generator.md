# Improvement Prompts — 040 — Vocabulary Flashcard & Word Wall Generator

**Tool file:** `Tools/040-vocab-flashcard-generator.html`
**Support folder:** `Tools/vocab-flashcard-generator/` — `vfg-layout.js`, `vfg-store.js`

**Current description (from README):** Paste a "term: definition" word list, print cut-apart flashcards (front/back pages, mirrored for double-siding) or large word-wall cards. Saves multiple named word lists.

---

## Status

**2026-08-13 — more printables from one list (backlog: "More printables from
one list").** Shipped **word search, crossword, bingo cards, and a matching
quiz** — four new print formats built from the same saved term/definition
list, alongside the existing flashcards/word-wall/self-quiz. Each is its own
mode tab (`Word search`, `Crossword`, `Bingo`, `Matching quiz`), with its own
options panel, live preview, and Print button, wired through the same
`currentItems()` (sort/shuffle already applied) so these can never disagree
with what the flashcard modes show for the same list.

The generation logic (`vocab-flashcard-generator/vfg-printables.js`) is a
pure-function sibling of `vfg-layout.js` — no DOM, same IIFE-attaches-to-
`global` shape — with its own Node suite
(`test/printables-logic.test.mjs`, 98 assertions) that doesn't need a
browser. A second Playwright suite (`test/smoke-printables.mjs`, 25
assertions) covers the browser wiring: the four tabs are reachable, Print
produces the right page shape, the too-few case shows a message instead of
opening a print dialog on garbage, and there's no console noise.

- **Word search.** Terms are hidden across, down, or on a forward diagonal
  (no reversed/backwards words — cheap to add, not required, and reversed
  words are the single biggest thing that makes a word search feel unfair to
  a middle-schooler, so it was deliberately left out). Only the letters of
  each term go in the grid — spaces and punctuation are stripped, so "Cell
  division" becomes `CELLDIVISION`; that's the one lossy step, and the
  options panel says so. Placement is greedy, longest terms first (they're
  hardest to fit, so they get first pick), each tried at up to 300 random
  position/direction combinations against a size derived from the list's
  total letters; a term that never finds room is dropped and named in a
  banner rather than silently missing from the word list. Needs 3+ terms
  with 2+ letters or it says so instead of drawing a puzzle. Prints a puzzle
  page (grid + word list) and a separate answer-key page (grid with the
  found letters highlighted).

- **Crossword — the scope tradeoff to know going in.** This is a **greedy
  best-effort placement, not a solver.** A crossword generator that
  guarantees every term places, in a genuinely optimal layout, is a real
  constraint-satisfaction/backtracking problem — out of scope for this
  round, and arguably out of scope for a client-side classroom tool at all.
  What's here instead: place the longest term first, then repeat passes over
  the remaining terms placing any that share a letter with something already
  on the grid (scored by intersection count, best available placement wins),
  until a full pass places nothing more. **Terms that never intersect
  anything are dropped and named** — reported the same way the word search
  reports what didn't fit, never a silently incomplete puzzle. A definition
  is required (it's the clue), so a term with no definition is excluded
  before placement is even attempted. The practical consequence, seen in
  testing: a list of *related* terms (biology vocabulary sharing common
  letters — "photosynthesis", "ecosystem", "mitosis") places most or all of
  its terms; a list of unrelated short words with little letter overlap
  (e.g. "chlorophyll" against the rest of a small biology set, in one test
  run) places worse. That's inherent to greedy placement, not a bug to chase
  — a smarter solver could do better on hard lists, but "best-effort, honest
  about what didn't fit" was the right scope for this round. Needs 3+
  eligible terms; if fewer than 2 terms ever manage to intersect anything
  (a `no-fit` case, distinct from `too-few`), it says a crossword couldn't be
  built rather than printing a lone floating word. Prints a clue page
  (numbered grid + Across/Down definitions) and a separate answer-key page
  (grid with letters filled in).

- **Bingo cards.** Card size (3×3, 4×4, or 5×5 with a classic FREE center)
  scales automatically with how many call-items (terms or definitions,
  teacher's choice) are available — needs at least 9 to fill even the
  smallest card. Every card in a set is an independently-seeded random
  subset-and-arrangement of the same pool, so "Cards to print" (default 4,
  up to 12) never hands out two identical cards to a class, while every cell
  on every card still comes from one caller's master list. Prints one page
  per card plus a caller's-list page that reads the *other* field (if cards
  show terms, the caller's list shows the definition to read aloud, in
  parentheses next to the term it belongs to).

- **Matching quiz.** Numbered terms in a left column, a scrambled/lettered
  right column of definitions, a blank for the student's letter. Needs at
  least 2 terms with definitions. Prints the quiz and a separate answer key.

All four share one deterministic-randomness trick worth knowing about:
placement/shuffling is seeded from a hash of the word list's own text
(`hashString` + `mulberry32` in `vfg-printables.js`), not `Math.random()`.
The same list regenerates the exact same word search/crossword/matching
layout on every re-render, so toggling an unrelated setting (cut lines, sort
order) doesn't reshuffle a puzzle the teacher was mid-look at — while bingo
cards, which need to *differ from each other on purpose*, use `seed +
cardIndex` per card. This also made the Node test suite possible without a
snapshot library: identical input asserted to produce byte-identical output.

Judgment calls made this round, for the next person to know about rather
than rediscover: (1) crossword and word search both use *letters only* from
each term (spaces/punctuation stripped) — there's no clean way to show a
space in a letter grid, and this matches how every paper word-search/
crossword generator handles multi-word terms; (2) bingo's "which field is
called out" is a per-list setting (`bingoField`, defaults to terms-on-cards/
definitions-called), not per-card, since a caller reading from two different
scripts mid-game would be worse than picking one; (3) the crossword's
`no-fit` case (distinct from `too-few`) exists because a "crossword" of one
isolated word is just a word — worth a distinct, honest message rather than
technically-succeeding output nobody would recognize as a crossword. New
mode-tab row now has seven tabs instead of three; `.mode-tabs` gained
`flex-wrap` so it degrades to two rows on narrow layouts instead of
squeezing tab labels unreadably thin.

Not attempted this round: the Frayer-model-page idea from the same Major
Feature entry (word search/crossword/bingo/matching were the four the
backlog row named explicitly); text-to-speech; the shared-vocabulary-store
Open Question is unchanged.

**2026-08-11 — toolbar visibility fix.** Not a backlog row; found while
comparing two parallel implementations of the share round below. The toolbar
holding the list switcher, Export, Import and both new share buttons was only
ever revealed by `newList()`. `loadListByName()` never showed it, so every
**return** visit — the normal case, since the tool reopens the last saved list
— came up with the toolbar hidden and no way to reach any other list. The
multi-list feature has probably been invisible to anyone past their first
session since it shipped. One line in `loadListByName`, plus four assertions in
the existing `smoke-share.mjs` that fail without it (verified by reverting the
fix and re-running).

**2026-08-11 — share round (backlog rank 1).** Shipped **share a word list by
link or QR** (P3). The tool could already export a `.json` file, but a file has
to be attached, downloaded, found again and imported — four steps and a thing
to lose. Two new toolbar buttons: **Copy link** builds a `?deck=` URL through
`_shared/state-link.js`, and **QR code** draws that URL with the shared
`_shared/vendor/qrcode/qrcode.js` encoder into a modal, for the colleague
standing next to you with a phone.

What travels is the deck: the list name, the raw word text, *and* the card
settings that decide how it prints (mode, columns/rows, card stock size,
fold-vs-duplex, sort, shuffle, guides). That last part was the design decision
— "the same deck" means the 3x5 fold-over cards the sender set up, not just the
words. What does not travel is the rest of the browser: other saved lists stay
home.

On the receiving side the arrival is saved as a **new** named list, uniqued
through the existing `uniqueListName()` (`"Unit 4 Vocabulary (shared)"`, then
`" 2"`), so a shared link can never land on top of a list already there — the
suite proves that with a pre-seeded list of the receiver's own. The `?deck=`
param is consumed on read so a refresh can't double-import, a mangled link says
so by name instead of opening blank, an empty list refuses to produce a link,
and a list too long for a QR is refused by name rather than drawn as an
unscannable square. The file-import path and the link-import path now share one
`normalizeIncomingList()` coercion so they can't drift apart.

New suite `Tools/vocab-flashcard-generator/test/smoke-share.mjs` (26 checks) as
`npm run test:vocab-share`: it opens the link in a second browser context and
checks the words, the non-ASCII round trip, every card setting, the
no-clobber guarantee, double-open, the mangled link, and zero console errors
or offsite requests.

**2026-08-11 — Pass 2 round.** Shipped **the alignment test page**, the
smaller of the two Quick Wins this file's Pass 1 round left deferred: a
"Print alignment test page" button (visible only in Flashcards mode with
the double-sided layout — hidden for the fold layout, which doesn't need
duplex alignment, and for Word Wall mode) prints one numbered front page
and one numbered back page at the *current* grid/card-size settings,
reusing the exact same `VocabLayout.mirrorPageRows` math the real print
path uses — a test page that verified alignment with different math than
the real print would be worthless. No real card content, no vocabulary
needed — a teacher can run these two sheets through the printer alone to
confirm the duplex settings before committing a whole class set, rather
than discovering a misalignment thirty cards in. Verified with a headless
Playwright pass: the button's visibility tracks layout/mode correctly
(hidden for fold, hidden for Word Wall, reappears when switching back);
clicking it builds exactly two `.page` blocks labeled FRONT/BACK with
numbered cards in the same mirrored order the real duplex print already
uses; `window.print()` is invoked; zero JS console errors.

Not attempted this round: **image on a card**, the other deferred Quick
Win (needs the downscale-on-import treatment `041-formula-sheet-builder.html`'s
`readAndDownscaleImage` already models, plus a storage-quota consideration
per P12 — a bigger addition than this round's scope), and everything under
Major Features/Moonshot.

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
- **Alignment test page** (`buildAlignmentTestPages`) — one numbered
  front/back sheet pair, reusing the real double-sided print's mirroring
  math, to check duplex settings before a full class set
- **Index-card stock size presets** (3×5, 4×6, `CARD_SIZE_PRESETS`) alongside
  the custom columns/rows grid
- **Word wall cards** at large sizes (`buildWallPages`, `wallCardHtml`) with
  auto-fitting type (`fitFontSizeRem`)
- Cards-per-page selection down to 1 (full page)
- A quiz preview (`renderQuiz`)
- **Read-only import bridge** from Vocab & Conjugation Drill Generator's
  saved drill sets (`vfg-conjdrill-link.js`)
- **Share a list by link or QR** (`buildSharePayload`, `importSharedList`,
  `normalizeIncomingList`) — a `?deck=` URL carrying the words and the card
  settings, received as a new uniquely-named saved list
- **Four more printable formats from the same list** (`vfg-printables.js`,
  pure logic + its own Node test suite): **word search**
  (`generateWordSearch`, greedy placement across/down/diagonal, puzzle +
  answer-key pages), **crossword** (`generateCrossword`, greedy best-effort
  intersection placement — not a solver, see Status for the tradeoff — clue
  + answer-key pages), **bingo cards** (`generateBingoCards`, 3×3/4×4/5×5
  scaling with list size, multiple independently-seeded card layouts plus a
  caller's master list), and a **matching quiz** (`generateMatchingQuiz`,
  numbered terms against scrambled lettered definitions, quiz + answer-key
  pages). All four honestly refuse (a message, not a garbage puzzle) below
  their minimum term count.

## Quick Wins

- **Done —** **Cut lines and a light border** on the flashcard sheets, plus a margin
  guide, so cutting thirty cards doesn't produce thirty crooked cards.
  *(A toggleable "Cut lines & margin guide" checkbox, on by default —
  a dashed inset outline on the page plus a solid card border.)*
- **Skipped — deferred.** **Image on a card.** For vocabulary — especially language and science
  vocabulary — a picture is often the definition. Requires downscaling and a
  storage warning (P12). *(Not part of this round's scoped list. The
  downscale-on-import pattern already exists in `041-formula-sheet-builder.html`
  — `readAndDownscaleImage` — and would be the template to copy.)*
- **Done —** **Part of speech, example sentence, and pronunciation** as optional card
  fields, since a bare definition is rarely enough for a word wall.
  *(Example sentence already existed — verified before building, not
  duplicated. Added part of speech and pronunciation as two more optional
  columns, shown on the card front/back and in the self-quiz.)*
- **Done — 2026-08-11.** **Alignment test page** before a class set is printed double-sided — the
  mirroring is already right, but the printer's duplex settings are the usual
  culprit and one test page saves a ream. *(A "Print alignment test page"
  button — one numbered front page + one numbered back page, reusing the
  real print's mirroring math, no vocabulary needed. See Status.)*
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
  `039-vocab-conjugation-drill.html`, `014-roleplay-scenario-generator.html`, and
  `027-novel-study-circles-manager.html` (which accumulates a vocabulary log) all
  hold word lists in incompatible formats. One list should drive flashcards,
  wall cards, drills, review game questions, and a word search.
  *(A full shared hub was explicitly out of scope for this round. Instead,
  this tool gained `vfg-conjdrill-link.js` — a read-only reader of Vocab &
  Conjugation Drill Generator's saved sets, converting to this tool's own
  `{term, definition, example, pronunciation, partOfSpeech}` shape — and
  that tool gained the mirror-image bridge reading this tool's lists. Copies
  the pattern `025-writing-prompt-generator.html`'s `wpg-rubric-link.js`
  established. See Open Questions below for exactly what does and doesn't
  make the trip.)*
- **Projected whole-class review mode.** Flip through the deck on the board —
  term, pause, definition — with shuffle and a "missed it" pile the teacher
  taps, producing a reteach list at the end. The existing quiz preview is
  most of the way there.
- **Partially done — 2026-08-13.** **More printable formats from the same
  list**: a word search, a crossword, a matching worksheet, a bingo card set
  **(shipped this round — see Status)**, plus a Frayer model page per word
  **(not attempted — the backlog row that scoped this round named only the
  four that shipped)**.
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
- **P3 (share links)** — **done:** Copy link / QR code in the toolbar, received
  as a new saved list.
- **P12 (storage)** — if images are added to cards.

## Open Questions

- Which tool should own the shared vocabulary store — this one, the
  conjugation drill, or a new small "word lists" hub in the way
  `006-class-roster-hub.html` owns rosters? The hub pattern is probably right.
- ~~Is a student-facing study mode in scope?~~ **Answered: no** — students
  aren't intended users. Printed cards remain the deliverable, with the
  projected class review as the on-screen option.

### Where the next round should pick up (after the share round)

- **Image on a card** is still the oldest deferred Quick Win, and it now has a
  second consequence: a base64 image would blow past what a `?deck=` URL can
  carry, let alone a QR. Whoever builds it should decide up front whether
  images travel in a share link at all (probably not — share the words, note
  that pictures stay behind) rather than discovering it after the fact.
- ~~**More printable formats from the same list** (word search, crossword,
  bingo, matching quiz, Frayer page) is the biggest remaining Major Feature
  and is still untouched.~~ **Done, 2026-08-13, except the Frayer page** —
  word search, crossword, bingo, and matching quiz shipped; see Status for
  the crossword's greedy-placement tradeoff. The Frayer model page (one
  four-quadrant page per word: term, definition, example, non-example/
  picture) is the one piece of this Major Feature still untouched — it's a
  per-word page layout, not a puzzle-generation problem, so it doesn't need
  `vfg-printables.js`'s seeded-RNG/placement machinery at all; it's closer in
  shape to `wallCardHtml`/`buildWallPages` (one page or quadrant per item)
  than to anything built this round.
- The share payload is versioned (`v: 1`) but nothing reads that field yet.
  A future shape change should branch on it rather than guessing. (This
  round added `bingoCount`/`bingoField` to the payload under the same v1
  shape rather than bumping the version — they're two more optional fields
  `normalizeIncomingList` already defaults for older payloads, the same
  pattern every prior round's new fields used.)
