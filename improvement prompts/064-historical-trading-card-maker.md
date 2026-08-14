# Improvement Prompts — 064 — Historical Figure / Country Trading Card Maker

**Tool file:** `Tools/064-historical-trading-card-maker.html`
**Support folder:** `Tools/historical-trading-card-maker/` — test suite only;
the tool itself is still one self-contained file.

**Current description (from README):** Build collectible-style research cards with a live preview: era themes and decorative frames, rarity foil tiers, photo crop/shape editing, stat bars, set numbering, named decks, and batch-add from a saved class roster or a pasted list — printed as duplex front/back grids, exported as PNG / PDF / zip, or shared as a finished deck by link or QR code (card text and design, not photos). A one-click sample deck shows off the whole visual system with zero setup.

---

## Status

**2026-08-13 — SS demo round: share links, roster integration, sample deck
(branch `claude/ssdemo-064-vqrmlk`).** Devon-assigned round ahead of the
live teacher presentation. Step 0 revisit first, per the round's own rule:

- **The backlog row this round was pointed at (rank 31, "Batch-add blank
  cards from a roster") is confirmed stale — it already shipped.** The
  prior Visual-upgrade round's "Named decks + roster" bullet (below) added
  a paste-a-list batch-add dialog (`rosterBtn`/`rosterOverlay`/`rosterText`/
  `rosterAddBtn`) that creates one blank card per pasted line and inherits
  the set name — this is a real, working implementation of "batch-add blank
  cards from a roster or an assigned list," not a partial or misleading
  version of it. Nothing to build there; this round only added the
  np_rosters *source* for that existing dialog (below). Devon owns the one
  bookkeeping pass over `IDEAS_BACKLOG.md`; this file just states the
  ground truth for that pass.

With that confirmed, this round shipped the P3 share-link headline plus two
of the three supporting items in order:

- **Share a deck by link + QR (headline, P3).** Copied the pattern from
  `028-primary-source-analysis-generator.html` (`_shared/state-link.js` +
  `_shared/vendor/qrcode/qrcode.js`) rather than inventing a new one. The
  payload is the deck minus photos: every card's `id`/`name`/`stats`/
  `facts`/`meta`/`theme` travels, `image` is always sent as `null`, and the
  deck's own `settings` (theme + card size) travels too. A visible hint
  under the Decks card and the post-copy note both say photos stay on this
  device and point at Download PDF / All PNGs (zip) as the full-fidelity
  path. An incoming `?deck=` link always lands as a new, uniquely-named
  deck via the existing `htcm:*` multi-save — collisions get a `(shared)`
  suffix, exactly like 028's worksheet import — so it can never overwrite
  a deck already on the device, including the default "My cards". QR
  generation is wrapped in the same try/catch 028 uses: `qrcode.js` throws
  `'code length overflow'` past its max capacity, and a big deck (many
  cards, long fact lists) catches that and shows the copy-link path with a
  named reason instead of drawing a square nobody's phone can scan — this
  is a real failure mode, not a hypothetical one; the smoke test seeds an
  80-card deck via `localStorage` specifically to trigger it.
- **np_rosters integration for batch-add (P2).** The existing roster
  paste dialog now has a class-list `<select>` above the textarea, fed from
  the shared `np_rosters` key (same read as
  `050-civics-role-card-generator.html`), showing each saved class list's
  name and count. Picking one fills the textarea — still the thing actually
  read on "Add cards" — so paste stays the fallback with no rosters saved,
  and a teacher can still edit the list before adding. A `storage` event
  listener refreshes the dropdown live if another tab saves a new roster
  while this dialog might be open.
- **"Load sample deck" (P15).** One click drops in a real 5-card deck —
  Washington, Franklin, Abigail Adams, Hamilton, Phillis Wheatley — with
  real stats (a `Known for` line plus 2–3 `X/10` meter stats each) and real
  facts, no photos (this schema's images are teacher-uploaded; a "sample
  photo" would mean shipping a fake one, so mixed rarity/theme carries the
  visual demo instead: legendary/epic/rare/rare/common, the `parchment`
  deck theme with two cards overridden to `renaissance` and `deco` to show
  the per-card theme-override field actually works). Saves as its own
  "Sample deck", asks before loading a second copy over an existing one of
  that name (`window.confirm`, same pattern as `newDeckBtn`/`renameDeckBtn`),
  and switches to it — the existing "never overwrite" guarantee of
  `HtcmStore.saveDeck` under a fresh name applies here same as the roster
  and share-import paths.
- **Extended the smoke suite**: a new `smoke-share.mjs` (55 assertions —
  share-link round-trip incl. what does/doesn't travel, the QR-overflow
  fallback via a seeded 80-card deck, roster dropdown incl. a live
  `storage`-event refresh, and the sample deck incl. its duplicate-name
  confirm), wired into `test:trading-cards` and the root `test` chain.
  `smoke-card-size.mjs` (55) and `smoke-photo.mjs` (34) stayed green
  before and after every change — 144 assertions total, no console errors,
  no offsite requests.

No sw.js change was needed: both `state-link.js` and `vendor/qrcode/
qrcode.js` were already precached (other tools use them), and everything
new lives inline in the main HTML file rather than a new module, so
`CACHE_VERSION` did not need a bump.

**2026-08-13 — Visual-upgrade round (branch
`claude/trading-card-builder-upgrades-ntodvr`).** The big redesign, shipped
in six commits, each independently green (`npm run test:trading-cards`, now
55 + 34 assertions across `smoke-card-size.mjs` and a new
`smoke-photo.mjs`; `npm run check:dedupe` clean throughout). The tool is no
longer a single self-contained file: per repo convention it now loads
seven plain-global modules from `Tools/historical-trading-card-maker/`
(`htcm-store/image/render/frames/themes/photo/export.js`), all precached
(`sw.js` v103 → v109 across the round).

- **Schema v2 + honesty:** versioned per-deck document with
  repair-on-load (gvb-save discipline); photos downscale to 1000px JPEG on
  import (fifth copy of that pattern — `_shared/image-import.js` extraction
  is still the recorded follow-up); storage-full saves show a banner with
  per-photo KB instead of silently dropping work. v1 keys migrate and are
  kept one release as backup.
- **Live preview:** a flippable, true-size card beside the form renders
  through the same `htcm-render.js` the print path uses. The stat-overflow
  warning now *measures* the laid-out card (retiring the line-count
  heuristic and the "re-derive per size" debt). The preview counter-inverts
  per-face under the a11y dark-mode filter (a filter on an ancestor would
  flatten the 3D flip).
- **Themes/frames/rarity:** seven era themes generated from one data array
  (CSS, swatch picker, and canvas exporter all read the same values);
  procedural stroke-SVG frames on the cam-borders model; rare/epic/
  legendary swap frame strokes for silver/purple/gold SVG gradients plus a
  corner badge. Print-first: 4.5:1 ink contrast, ≤6% alpha textures,
  `print-color-adjust: exact`, foil defs duplicated into `#printArea`.
- **Photo editor:** non-destructive `{crop:{x,y,scale}, shape, filter}`
  against the downscaled master; pan/zoom editor whose viewport is the
  card's real photo window; six shapes from normalized paths consumed as
  objectBoundingBox clipPaths (DOM/print) and Path2D (export); sepia/gray
  filters. `photoStyle()` and `sourceRect()` sit adjacent in
  `htcm-photo.js` as the anti-drift defense.
- **Flash, all printable:** `Label: 7/10` stat bars with the number inside
  the bar, keyword stat icons, 0–5 stars, "n / total · SET NAME" strip
  with a Number-the-deck button, embossed name plate, and a static foil
  glint on rare+ (no animation anywhere, per the print-fidelity decision).
- **Export:** hand-drawn 300 DPI canvas renderer (no html2canvas, no
  foreignObject) reusing the theme data + SVG strings; per-card PNG pair,
  whole-deck jsPDF letter PDF with the same duplex mirroring as print, and
  a JSZip batch of all PNGs. **This was the third-consumer moment:**
  `paginate`/`mirrorPageRows` extracted to `_shared/duplex-print.js`
  (vfg still carries its own copy — migrating it is a separate change).
- **Named decks + roster:** vfg-store triple-key shape
  (`htcm:list` / `htcm:data:<name>` / `htcm:current`), Decks panel
  (new/rename/delete/switch, theme travels with the deck), and
  batch-add-from-roster (one blank card per pasted line, set name
  prefilled) — clearing the backlog item.

**Deliberately not done this round:** the P3 student share-link fill-in
mode (still the natural next step, now easier since a card is
identified by deck + name and exports its own PNG), the flag library
(open question below stands), and pointing vocab-flashcards at
`_shared/duplex-print.js`.

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

- Named decks (new/rename/delete/switch), each with its own cards, theme,
  and set name — one per class period or unit
- Add a card individually, or batch-add blank cards from a pasted list or a
  saved class list (`np_rosters`, shared with Name Picker / Class Roster
  Hub) — one card per name, set name prefilled
- Edit an existing card in place
- Seven era themes (deck-level default, with a per-card override), four
  rarity tiers with foil badges and a static print-safe glint, 0–5 star
  rating, `Label: 7/10` stats that render as a filled meter, keyword stat
  icons, and set numbering (`n / total · SET NAME`)
- A non-destructive photo/flag editor: pan/zoom crop, six clip shapes,
  sepia/gray filters
- A flippable, true-size live preview beside the form, rendering through
  the same code the print/export paths use, with a measured (not
  heuristic) stat-overflow warning before print
- Two print sizes: standard trading card at exactly 2.5 × 3.5in, centered on
  the page (default), or the original fill-the-page layout at about
  2.43 × 3.4in; the choice persists per deck
- Row-mirrored duplex print: 6-card front pages, then row-mirrored back
  pages, so a flipped physical stack lines up automatically
- Export: per-card PNG, a whole-deck duplex PDF, or a zip of every PNG
- Share a deck with another teacher by link or QR code — card text, stats,
  themes and rarity travel; photos stay on the sending device and the
  incoming deck always lands as a new save, never overwriting one already
  there
- "Load sample deck" — one click loads a real 5-card demo (mixed rarity and
  theme, no photos) as its own named deck, for a zero-setup live demo

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

- **A student-facing fill-in mode** via a share link — right now the share
  link this round shipped is teacher-to-teacher (a whole deck, read/write
  on arrival, saved as a new deck). A true per-student mode — a link to one
  blank card, identified by deck + name, that a student fills in and hands
  back — is a different shape: it would need some way for the filled-in
  card to return to the teacher (there's no server here), which the deck
  link's "just open it and it's yours" model doesn't solve. Worth scoping
  as its own round rather than folding into deck-sharing.
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
- **P3 (share links)** — the teacher-to-teacher deck link/QR shipped this
  round (state-link.js + vendor qrcode.js, same pattern as 028). A
  student-facing fill-in mode (one card, not a whole deck, with some way
  for the filled-in result to get back to the teacher) is the natural next
  extension for a whole-class research project — see Major Features.
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
