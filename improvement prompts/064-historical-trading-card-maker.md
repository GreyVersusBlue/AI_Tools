# Improvement Prompts — 064 — Historical Figure / Country Trading Card Maker

**Tool file:** `Tools/064-historical-trading-card-maker.html`
**Support folder:** `Tools/historical-trading-card-maker/` — test suite only;
the tool itself is still one self-contained file.

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

**2026-08-11 — Round 2 (session `9iiyas`).** Shipped three of the four
Quick Wins below. Row-mirrored duplex printing was adapted from
Vocabulary Flashcard & Word Wall Generator's `VocabLayout.mirrorPageRows`
— copied into this file's own script (not loaded via a shared `<script>`
tag, so this file stays self-contained) — and required switching from a
continuously-flowing card grid to explicit 3&times;2 (6-card) paginated
pages with `null`-padded blanks, since mirroring needs known row
boundaries; verified by screenshot that fronts render left-to-right in
entry order and the matching back page renders in reverse per row. Editing
an existing card now works in place (Edit button per card loads the form
into edit mode; `<input type="file">` can't be prefilled, so a `KEEP_IMAGE`
sentinel preserves the existing image unless a new one is chosen). A
stat-overflow warning (`statOverflowRisk`, a coarse 6-lines-with-photo /
11-lines-without-photo heuristic, not measured against real font metrics)
now shows live while typing and as a badge per card in the list. Card size
options (the fourth Quick Win) is not yet started. Verified with headless
Playwright — add/edit/no-duplicate, overflow warning triggering, and print
DOM structure — no console errors.

**Worth a human sanity check next round:** the switch to explicit 6-cards-
per-page pagination changes how many physical sheets a given card count
produces versus the old continuously-flowing layout — worth confirming
against real printer output, not just DOM structure.

**2026-08-12 — Round 3 (backlog rank 3: standard trading-card size).** A
"Print layout" card now offers two card sizes: **Standard trading card —
2.5 × 3.5 in** (the new default) and **Fill the page**, which is exactly what
the tool printed before.

**The backlog row's premise was wrong and worth recording.** It asked for
"a 2.5×3.5 inch preset alongside the current larger card" — but the old card
was never larger. It was three columns of `1fr` inside a 7.7in print band,
which works out to about **2.43in × 3.4in**: *under* standard size in both
directions, and not a measurement at all — it moved with the paper size and
the page margin. So the real gap this closes is not "smaller cards", it is
**stated dimensions**: a card that comes out of the printer at the size a
sleeve or a nine-pocket page is built for. A genuinely larger reference card
(3.5 × 5in, four to a page) is still unbuilt, and is the honest version of
what that row thought it was asking for — see Quick Wins.

What was fiddly:

- **The page margin had to move.** Three 2.5in cards plus two 0.15in gutters
  is 7.8in, which does not clear a letter page at the old 0.4in side margins.
  `@page` is now 0.3in (still inside the ~0.25in unprintable edge office
  printers have). Since `@page` cannot be scoped per preset, "Fill the page"
  is pinned back to its original 7.7in band with a `max-width` on the grid,
  so widening the margin did not silently resize a layout teachers already
  print.
- **Six to a page, not nine.** Three rows of 3.5in is 10.5in of cards on an
  11in sheet, leaving nothing for the section label or the printer's own
  margin. Nine-up would mean dropping the section labels; not worth it.
- Row-mirrored duplex from round 2 is untouched and still asserted.

Verified with a new 18-assertion headless Chromium suite,
`Tools/historical-trading-card-maker/test/smoke-card-size.mjs`
(`npm run test:trading-cards`). It measures the **laid-out box** rather than
reading the stylesheet: `#printArea` is `display:none` on screen, so the suite
clones it, forces it visible at the printed page's content width, and asserts
the card is 2.5in × 3.5in (±0.02in), that three cards plus gutters fit the
printable width, and that the grid is centered — no console errors.

**Next round should pick up** the large-reference-card preset below, and the
stat-overflow heuristic, which still assumes the old card geometry (6 lines
with a photo / 11 without) and was not re-derived for the 3.5in card.

## What it does today

- Batch-add cards: name, optional image, `Label: Value` stats, one-per-
  line facts
- Edit an existing card in place
- Two print sizes: standard trading card at exactly 2.5 × 3.5in, centered on
  the page (default), or the original fill-the-page layout at about
  2.43 × 3.4in; the choice persists across visits
- Row-mirrored duplex print: 6-card front pages, then row-mirrored back
  pages, so a flipped physical stack lines up automatically
- A live stat-overflow warning in the editor, before print

## Quick Wins

- **Done — Card size options** (2026-08-12). Standard 2.5&times;3.5in
  (default) alongside the original fill-the-page layout; see the Round 3
  note above.
- **A genuinely large reference card** (3.5&times;5in, four to a page) — the
  thing the backlog row mistakenly believed already existed. Needs the
  section labels moved or dropped, since 2 rows of 5in plus a label does not
  clear a letter page, and needs the stat-overflow heuristic re-derived for
  the taller card.
- **Re-derive the stat-overflow heuristic per card size.** The 6-lines-with-
  photo / 11-without thresholds were measured against the old 3.4in card and
  are now applied unchanged to a 3.5in one with tighter padding.

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

- ~~Should `VocabLayout.mirrorPageRows` be extracted into a genuinely
  shared module~~ **Resolved this round:** copied/adapted in place rather
  than extracted — the function is small, and copying kept this file
  self-contained per this round's own scope constraint (no edits to
  `040-vocab-flashcard-generator.html`). Worth revisiting as a real shared
  `_shared/duplex-print.js` if a *third* tool ever needs front/back
  mirroring, so the logic isn't hand-copied a third time.
- Is a small built-in flag image library (a fixed set of common countries)
  worth maintaining as static assets in this repo, or does that risk
  scope creep/staleness (new countries, disputed flags, political
  sensitivity) that's better left to "the teacher uploads their own
  flag image" as the tool already supports?
