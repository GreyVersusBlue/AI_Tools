# Improvement Prompts — 040 — Vocabulary Flashcard & Word Wall Generator

**Tool file:** `Tools/040-vocab-flashcard-generator.html`
**Support folder:** `Tools/vocab-flashcard-generator/` — `vfg-layout.js`, `vfg-store.js`

**Current description (from README):** Paste a "term: definition" word list, print cut-apart flashcards (front/back pages, mirrored for double-siding) or large word-wall cards. Saves multiple named word lists.

---

## Status

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
- **More printable formats from the same list** (word search, crossword, bingo,
  matching quiz, Frayer page) is the biggest remaining Major Feature and is
  still untouched — it is a pile of mechanical transformations of data the tool
  already parses.
- The share payload is versioned (`v: 1`) but nothing reads that field yet.
  A future shape change should branch on it rather than guessing.
