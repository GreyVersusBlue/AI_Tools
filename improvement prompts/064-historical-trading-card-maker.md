# Improvement Prompts — 064 — Historical Figure / Country Trading Card Maker

**Tool file:** `Tools/064-historical-trading-card-maker.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Batch-add cards with a photo/flag image, label:value stats, and back-of-card facts, printed as matching card-front and card-back grids.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: add a card with a name, an optional uploaded photo/flag
image (data URL, same local-only pattern as Book Tasting Menu Generator
and DBQ / Source Packet Builder), a stats list parsed from
`Label: Value` lines, and a facts list parsed one per line for the back.
Print output is two separate 3-column grids in the same entry order — card
fronts (image, name, stats) first, then card backs (name, facts) — rather
than a fully-mirrored automatic-duplex layout. Everything autosaves to one
localStorage key (`htcm_cards_v1`). Verified with a headless Chromium
smoke test (add a card with stats and facts, print, confirm both a front
and a back card render with the right content) — no console errors.

**A known simplification versus this toolkit's existing card-printing
tool:** Vocabulary Flashcard & Word Wall Generator already implements true
row-mirrored duplex printing (`VocabLayout.mirrorPageRows`) so a flipped
stack lines up automatically front-to-back when run back through a
printer. This tool instead prints all fronts as one block of pages, then
all backs as a second block in the same linear order — correct content,
but a teacher printing double-sided will need to flip the whole stack
(not just alternate sheets) and may need to manually verify alignment
depending on their printer's duplex behavior. This was a deliberate MVP
scope cut to avoid re-deriving that mirroring logic under this round's
time constraints — see Quick Wins.

## What it does today

- Batch-add cards: name, optional image, `Label: Value` stats, one-per-
  line facts
- Print: two grids (fronts, then backs) in matching order

## Quick Wins

- **Adopt Vocabulary Flashcard & Word Wall Generator's row-mirrored duplex
  layout** — the single highest-value fix, since it's a proven pattern
  already built elsewhere in this toolkit and would make double-sided
  printing actually line up automatically instead of requiring a manual
  stack-flip.
- **Edit an existing card** (currently delete-and-re-add is the only
  option) — a real gap versus most other list-builder tools in this round.
- **Card size options** (e.g. 2.5"&times;3.5" standard trading-card size
  vs. the current larger custom size) for a teacher who wants an actual
  pocket-sized trading card rather than a bigger reference card.
- **A stat-overflow warning**: right now `.cstats { overflow: hidden }`
  silently clips content if a card has too many stats to fit — should at
  minimum warn the teacher rather than silently truncating on print.

## Major Features

- **Batch-add from a roster** (matching the "from a roster or an assigned
  list" framing in the backlog description) — right now each card is
  added individually through the form; a bulk-paste mode (name per line,
  creating blank cards to fill in) would match how a whole-class research
  project actually gets set up.
- **Multiple named saved card sets**, matching the multi-save convention
  used by most builder tools in this round — one flat set per browser
  right now, so "World Leaders" and "Ancient Civilizations" card sets
  can't coexist.
- **A student-facing fill-in mode** via a share link (this toolkit's P3
  pattern) — each student fills in their own assigned figure's card
  directly, instead of a teacher typing every student's research into one
  form.
- **Flag/photo library integration** for countries specifically (the
  backlog explicitly covers both historical figures and countries) — a
  small built-in flag-image picker for common countries would remove the
  need to hunt down and upload a flag image by hand.

## Moonshot / North Star

**A trading-card set built collaboratively by a whole class researching
different figures or countries, printed with reliable automatic
front-to-back duplex alignment, and pulled from a small built-in flag
library for the country half of the idea.** Row-mirrored duplex closes the
print-quality gap versus this toolkit's own Vocabulary Flashcard
Generator; a student-facing share-link fill-in mode turns "one teacher
typing everyone's research" into "a class collaboratively building the
deck"; and a flag library removes the most repetitive manual step for the
country-card use case specifically.

## Platform themes that matter here

- **P6 (print quality)** — the duplex-alignment gap versus Vocabulary
  Flashcard & Word Wall Generator is the clearest, most concrete
  print-quality improvement available in this entire round, since a
  working reference implementation already exists in this same toolkit.
- **P3 (share links)** — student-facing fill-in mode is the natural
  extension for a whole-class research project.
- **P7 (cross-tool)** — reusing `VocabLayout.mirrorPageRows` (or
  extracting it into a small shared module both tools can use) avoids
  re-implementing duplex mirroring from scratch a second time.

## Open Questions

- Should `VocabLayout.mirrorPageRows` be extracted into a genuinely shared
  module (e.g. `_shared/duplex-print.js`) that both Vocabulary Flashcard
  Generator and this tool import, or is copying/adapting the logic into
  this tool's own support folder simpler and sufficiently DRY given how
  small the function is?
- Is a small built-in flag image library (a fixed set of common countries)
  worth maintaining as static assets in this repo, or does that risk
  scope creep/staleness (new countries, disputed flags, political
  sensitivity) that's better left to "the teacher uploads their own
  flag image" as the tool already supports?
