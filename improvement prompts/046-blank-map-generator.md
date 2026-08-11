# Improvement Prompts — 046 — Blank Map Generator

**Tool file:** `Tools/046-blank-map-generator.html`
**Support folder:** `Tools/blank-map-generator/` — `bmg-colors.js`, `bmg-commons.js`, `bmg-geography.js`, `bmg-label-sets.js`, `bmg-labels.js`, `bmg-latlong.js`, `bmg-legend.js`, `bmg-lines.js`, `bmg-locator.js`, `bmg-map-cache.js`, `bmg-markers.js`, `bmg-regions.js`, `bmg-store.js`, `bmg-viewer.js`

**Current description (from README):** Search Wikimedia Commons for a map, pan/zoom into a region, and annotate it with draggable labels, markers (pin/star/dot/flag), and shaded polygon regions — all auto-building an editable legend. Optional compass rose, lat/long grid, and a locator inset. Undo for accidental deletes. Maps are cached for offline reuse; print or save as PDF.

---

## Status

### Round 12 (2026-08-11, session `albm3m`) — shipped

Cleared the Quick Wins list (all three that Round 11 left open) plus the
most tractable Major Feature (attribution on every export). All verified
with a 27-check headless Chromium pass driving the real UI end-to-end
(uploaded map → calibrate → batch place → worksheet PDF/print, label-set
save/rename/edit/export/import round-trips, shrink+undo, all four export
paths), zero unexpected console errors, plus direct visual inspection of
the rendered worksheet/answer-key/PNG/poster-tile output.

- **Numbered markers are now worksheet items.** A numbered pin whose key
  caption holds the answer joins the text labels in one top-to-bottom
  numbering (`worksheetEntries()` flattens both kinds to `{kind, ref,
  text, x, y}`); on the worksheet render each pin displays *that
  version's* item number instead of its natural placement order
  (`opts.markerNumbers` in `drawMapContent()`), the caption goes into the
  word bank and the numbered answer lines, and the answer key draws the
  caption in a text box beside the pin. An **uncaptioned** numbered pin
  can't be an item (no answer to key), so its circle prints "?" rather
  than a stray number from the wrong sequence — and the worksheet panel
  now says exactly that, with a count, when it opens ("N numbered markers
  with no key caption won't be on the worksheet…"), which was the other
  half of this Quick Win ("or say so where they'll see it").
- **Label sets can now be renamed, edited, exported, and imported.**
  Rename (saved sets), an "Edit places…" sub-panel that round-trips the
  set through the same one-place-per-line `name, lat, lon` text the batch
  paste already taught (same `parseCoordLine()`; bad lines are reported
  by count with the first offender quoted, and nothing saves until they
  parse), JSON export of any set (built-ins included), and import with
  validation via `bmg-label-sets.js`'s existing `isValidPlaceList()`.
  Editing a **built-in** saves the result as "<name> (edited)" — the
  shipped data stays as shipped — and the editor's hint says so before
  you type. Import reuses `saveLabelSet()`'s same-name save-over
  behavior deliberately, so re-importing a corrected file updates rather
  than duplicates. New store methods: `renameLabelSet()`,
  `updateLabelSetPlaces()`.
- **Shrink to Fit** (`btnShrinkLabels`, next to Tidy Labels). Steps only
  the labels currently involved in a collision down one text size (large
  → medium → small, never below small) and then re-runs the tidy
  relaxation against the now-smaller measured boxes — committed through a
  single `onChange`, so resizes and nudges undo together with one Ctrl+Z
  (verified). The box-measure/overlap geometry was extracted from
  `tidyOverlaps()` into shared `measureBoxes()`/`boxOverlap()` helpers,
  and `tidyOverlaps()` gained a `silent` option so the composed pass
  commits once. Reports honestly, including the "everything colliding is
  already smallest" case.
- **Attribution on every export** (Major Feature, scoped to the raster
  exports). A new `drawPngCredit()` stamps the credit line on a
  translucent strip along the bottom-left of PNG download, Print Map, and
  Save PDF (via `renderMapCanvas()`), and on the tiled poster's
  bottom-left page (drawn at 16px on the poster canvas, since each poster
  pixel prints physically larger). `worksheetCreditLine()` was
  generalized to `mapCreditLine()`, shared with the worksheet footer; for
  a teacher-uploaded image it now credits "Map: <name> (teacher-supplied
  image)" instead of reprinting the stored "you are responsible…"
  advice text, which was advice to the teacher, not attribution.
  Automatic and not a toggle, unlike Round 9's grayscale checkbox — the
  licence line is the price of using a Commons map, which is the point of
  the backlog item ("unmissable on every export").

Where the next round should pick up: the Quick Wins list is now empty —
next is the Major Features list (time-slice maps, vector base maps,
choropleth, quiz-mode persistence, map+timeline pairing). One small seam
left on purpose: the answer key draws a pin's caption box at the pin's
own anchor, so two items sharing one spot (e.g. a batch-placed pin plus
its label) overlap boxes there — same behavior two stacked labels always
had; a per-page collision pass over answer-key text boxes would be the
fix if a real map ever makes it illegible.

### Round 11 (2026-08-11, session `gb5c6e`) — shipped

Two of the five open Quick Wins from Round 10's list — the two that were
pure bugs in the numbered-worksheet/answer-key renderer rather than new
features:

- **Word bank no longer prints on the answer-key page.** `settings.wordBank
  && items.length` gained `&& !showAnswers` in `renderWorksheetPage()` — the
  key already spells out every answer on the numbered answer lines, so the
  word bank was a genuinely redundant inch of paper on that specific page.
  The worksheet page itself is unaffected; the bank still prints there.
- **Answer-key text now shrinks to fit its column instead of overflowing.**
  A new `fitFontSizeToWidth()` helper measures the answer text against the
  actual space left in its column (after the number and the rule line) and
  steps the font down (13px/11px base, down to an 8px floor) until it fits,
  used in `drawAnswerLines()`'s `showAnswers` branch. A long name like
  "Massachusetts" or "Guinea-Bissau" in a narrow multi-column answer key no
  longer runs past its line — verified directly against `drawAnswerLines()`
  in an isolated canvas harness (six real place names across a stress-test
  6-column narrow layout: every realistic name fit within its measured
  column width; only a deliberately absurd 45-character stress string still
  overflowed even at the 8px floor, which is the expected, correctly-bounded
  behavior for that helper — there's a floor on how small text can go before
  it stops being a font-size problem). End-to-end verified too: uploaded a
  synthetic image, placed real labels including long names via the actual
  UI, generated a real worksheet+answer-key PDF through
  `btnWorksheetPdf` (both pages present, byte-verified via the PDF's own
  `/Type /Page` count), zero console errors.

Not attempted this round: the other three open Quick Wins (numbered
markers as worksheet items, label-set edit/export, a shrink-to-fit pass for
label placement itself — distinct from this round's answer-text fit, which
only touches the answer-key's own text) and everything in Major Features.

---

Reviewed — structural read of the source. This is the most architecturally
mature tool on the site: properly modularized, IndexedDB-backed, with
undo/redo. Ideas below are deliberately ambitious and **not** scoped to one
session.

### Round 10 (2026-08-10) — shipped

The classroom-worksheet round: everything a labeled map has to become
before it's actually an assignment. Five of the six open Quick Wins, plus
the projected half of the quiz-mode major feature.

- **Numbered-blank worksheets + answer key printing** (`Worksheet…`). Every
  text label on the map becomes a numbered circle; a numbered answer line
  per label prints beside or below the map, with an optional shuffled word
  bank and a matching **ANSWER KEY** page (same map, numbers *and* names,
  stamped in red). Ask for up to 4 versions and each gets its own numbering
  and word-bank order from a seeded PRNG — one map becomes a set of
  non-copyable papers, and "version 3" regenerates identically if a copy
  gets lost. A worksheet page is laid out and drawn on a **single canvas**
  (the map panel is rendered by the same `drawMapContent()` path everything
  else uses, then composited in), so Print and Save PDF share one layout
  implementation instead of an HTML one and a jsPDF one that drift apart.
  Layout units are hundredths of an inch, so the whole page is physical page
  space and only the rasterization density changes between preview and
  print. The map panel is shaped to the on-screen view's aspect ratio and
  then made as large as the answer list allows, rather than being letterboxed
  into whatever rectangle is left.
- **Reusable label sets** (`Label Sets…`, new `bmg-label-sets.js`). Seven
  built-in lists — continents & oceans, the Thirteen Colonies, the 50
  states, the countries of Europe / Africa / South America, and world
  physical features — drop onto any *calibrated* map in one click, reusing
  the same `fromLatLon()` + `addAt()` path the batch coordinate paste
  already used. Teachers can also **save their own set** from a map they've
  labeled and dragged into place (stored by lat/lon on the workspace, not
  the project, so it's available to every project — and no second
  localStorage key for Backup & Restore to learn). Options: skip places
  outside this map's bounds, drop a marker at each place, and auto-tidy
  afterwards.
- **Label collision avoidance** (`Tidy Labels`). An iterative relaxation
  pass over each label's *measured* rendered box, pushing colliding pairs
  apart along whichever axis they overlap least with a weak spring home.
  Placing 50 states at once used to mean 50 manual drags. It's one edit
  through `save()`, so Ctrl+Z puts everything back (verified). It measures
  the DOM, so it also works on the enlarged Projector-text labels below.
- **Semantic line types.** A type picker next to the line tool: river,
  border, disputed boundary, trade route, migration path, invasion route,
  railroad/road, exploration route. Picking one sets the colour, dash style
  and arrowhead that feature is conventionally drawn with, and captions its
  legend row automatically on finish (each type's colour+style pair is
  distinct, so no two types collapse into one row). Still fully overridable;
  "Custom" keeps the old behavior.
- **Quiz mode scoring, shuffle, and a projected mode.** Self-Check Quiz Mode
  gained a control bar: `Reveal next` picks a still-hidden label at random,
  a counter shows how far through the map the class is, ✓/✗ buttons keep
  score on the board, `New round` reshuffles, and `Projector text` enlarges
  on-screen label text for the back of the room. Session-only, screen-only,
  exactly as before.
- **Bug found and fixed on the way:** a bare `display: flex` outranks the
  browser's `[hidden]` rule, so `#lineArrowWrap` (the line Arrowhead
  checkbox) had been showing in the toolbar whether or not a line was being
  drawn. Fixed for both it and the new quiz bar.
- Not done this round: choropleth from a data table, vector base maps,
  time-slice maps, map+timeline pairing, and making attribution unmissable
  on *every* export (the worksheet carries a credit line; the plain map
  exports still don't).

### Round 9 (2026-08-10) — shipped

- **Page-format / aspect-ratio picker.** New "Page shape" control above the
  viewer: US Letter 8.5×11 (portrait, for printing), Widescreen 16:9 (for
  dropping into a PowerPoint slide), or a Custom ratio set with two range
  sliders, plus a Flip button to swap orientation. `#viewport` itself is
  resized in real pixels (not CSS `aspect-ratio`, to sidestep min/max-height
  interplay quirks) to match, as large as the card width and a viewport-height
  cap allow, and the map is refit into the new shape — so the live preview is
  a true WYSIWYG of what Print/Save PDF/Download PNG will produce. Persisted
  per-project as `project.pageFormat`.
- **Print Map and Save PDF now export the actual map, not a screenshot of
  the page.** The old single "Print / Save PDF" button just called
  `window.print()` on the live interactive DOM — whatever happened to be
  visible in the browser chrome around the map, toolbar included, went to
  the printer/PDF. Both are now genuine exports: they rasterize the
  annotated map via the same canvas renderer the PNG download already used
  (`renderMapCanvas`/`drawMapContent`), sized to the selected page format's
  exact physical dimensions (`getPhysicalPageInches` — a literal 8.5:11
  ratio comes out as exact US Letter). **Print Map** injects that raster
  into a dedicated print-only stage with a dynamically-set `@page` size and
  calls `window.print()` against *that*, not the app UI; Ctrl/Cmd+P is
  intercepted to go through the same path. **Save PDF** is new — builds a
  real PDF via a newly-vendored jsPDF (`Tools/blank-map-generator/lib/`,
  same 2.5.1 build already used elsewhere on the site) instead of relying on
  the browser's own print-to-PDF. Tiled poster printing was already doing
  this correctly (it never screenshotted the DOM) and was left alone.
- **Grayscale-safe fills (P6), scoped down.** The backlog item below asked
  for patterns to become print's default; shipped as a "Grayscale-safe
  fills" checkbox (on by default) next to the export buttons instead of a
  silent behavior change, so a teacher who deliberately wants flat color
  output (color printer, projector) can turn it off. When on, any region
  still set to "Solid" gets rendered in the export (map + legend swatch,
  both from the same substitution map so they always agree) with an
  alternating hatch/dots pattern per distinct color — the on-screen SVG
  editing view and the region's actual `pattern` field/legend-text key are
  untouched, only the raster output changes. Verified with a real
  two-color-both-"Solid" region case via Playwright screenshots: on
  renders visibly different hatch vs. dot fills, off renders flat color.
- Not done this round: answer-key printing, numbered-blank worksheets, quiz
  mode scoring/shuffle, reusable label sets, semantic line types — see Quick
  Wins below, still open.

## What it does today

- **Wikimedia Commons search** with continent browsing and "load more", plus
  upload-your-own-image
- Annotation layers: labels, markers (pin / numbered pin / star / dot / flag),
  freehand lines (solid/dashed/dotted, with arrowheads), shaded polygon
  regions with fill patterns
- **Auto-building editable legend** ordered from the layers
- Map furniture: compass rose, lat/long grid, scale bar, **locator inset map**
- **Map coordinate calibration** (Mercator or equirectangular), which enables
  **batch placing markers from a coordinate list** and **distance measurement**
  in km/mi
- **Reusable label sets** — seven built-in place lists plus teacher-saved
  ones, dropped onto any calibrated map; saved sets can be renamed and
  edited in place, and any set (built-ins included) exports/imports as a
  JSON file for sharing between colleagues
- **Tidy Labels** (nudges overlapping labels apart) and **Shrink to Fit**
  (steps colliding labels' text down a size, then tidies — for maps too
  dense for separation alone), each a single undoable edit
- **Semantic line types** (river / border / trade route / migration / …)
  that caption their own legend row
- **Student Handout Mode**, **Self-Check Quiz Mode** (with reveal-next,
  scoring, reshuffle and projector text), and a **numbered worksheet +
  answer key** builder with word bank and multiple shuffled versions —
  numbered blanks come from text labels *and* from numbered markers whose
  key captions hold the answers
- Multiple named projects, import/export, PNG download, print / save PDF, and
  **tiled poster printing** across several pages — every raster export
  automatically carries the map's Commons credit line
- IndexedDB map cache for genuine offline reuse; "clear cached maps"
- Full undo/redo history

## Quick Wins

**All clear as of Round 12.** Rounds 9–12 worked through this whole list;
the entries are kept below (marked Done) as the record of what shipped
where. New quick wins surfaced by future rounds go here.

- **Done —** **Word bank on the answer-key page is redundant** — it prints there
  because the key reuses the worksheet layout wholesale. Minor, but it's a
  wasted inch of paper on every key. *(Shipped Round 11 — the answer key no
  longer draws the word bank at all; the worksheet page still does.)*
- **Done —** **Numbered markers aren't worksheet items.** The worksheet numbers text
  labels only. A teacher who built their map from numbered pins (and put the
  answers in the legend captions) gets an empty worksheet with no
  explanation beyond the panel's hint. Either number them too, or say so
  where they'll see it. *(Shipped Round 12 — both halves: captioned pins
  are items, and the panel explains uncaptioned ones with a count.)*
- **Done —** **Label sets can't be edited or exported.** A saved set can be created and
  deleted, but not renamed, trimmed, or handed to a colleague — and the
  built-in coordinates can't be corrected in place, only re-saved as a
  private copy. Set import/export would also make the built-ins
  community-fixable. *(Shipped Round 12 — rename, a text editor reusing
  the batch-paste line format, and JSON export/import.)*
- **Done —** **A "shrink to fit" pass for labels**, as a companion to Tidy Labels: on a
  really dense map, separation alone runs out of room and the honest fix is
  smaller type. *(Shipped Round 12 — steps colliding labels down one size
  and re-tidies, one undoable edit.)*
- **Done —** **Worksheet answer lines don't wrap.** A long place name in a narrow
  answer column overruns its line rather than shrinking or wrapping.
  *(Shipped Round 11 as shrink-to-fit rather than wrapping — a new
  `fitFontSizeToWidth()` steps the answer text's font down, per item, until
  it fits the column's actual remaining width, down to an 8px floor. Chosen
  over multi-line wrapping because the answer list's row height is already
  computed by `planAnswerList()` for a fixed number of single-line rows;
  wrapping would need that layout pass to know in advance which rows grow,
  which is more invasive than this round's scope.)*

## Major Features

- **Time-slice maps.** One project, several dated states — 1783 / 1803 / 1848
  — that print as a sequence or animate on screen. Territorial change over
  time is the core visual argument of most history units and there is no good
  classroom tool for it.
- **Vector base maps.** Wikimedia raster maps limit zoom quality and file
  size. Shipping or importing simple GeoJSON outlines (continents, countries,
  US states) would give infinitely scalable printing, real per-region
  click-to-shade, and choropleth colouring from pasted data.
- **Choropleth from a data table.** Paste "state, value" and shade
  accordingly — directly reusing the parsing already in
  `038-data-chart-builder.html` (P7).
- **Projected quiz mode** — *shipped in Round 10* (reveal-next, counter, ✓/✗
  tally, reshuffle, projector text). What's still missing is persistence of
  which labels a class struggled with across sessions, which is the part
  that would actually change reteaching.
- **Map + timeline pairing** (P7). `015-timeline-builder.html` covers *when*;
  this covers *where*. A combined print — timeline along the bottom, map
  above, events pinned to both — would be a genuinely distinctive artifact.
- **Done —** **Attribution done properly and automatically.** `renderAttribution` exists;
  making the Commons licence line unmissable on every export protects the
  teacher and models good practice for students. *(Shipped Round 12 —
  `drawPngCredit()` stamps the credit line on PNG / Print / Save PDF and
  the tiled poster's bottom-left page automatically; the worksheet footer
  already had it and now shares the same `mapCreditLine()`.)*

## Moonshot / North Star

**A social studies map studio that runs on a Chromebook with the wifi off.**
Vector base maps, layered time slices, data-driven shading, student handouts
with answer keys, poster-size tiled printing, and a projected quiz mode for
whole-class review — all offline, all local, all free. There is no product in
this space that is both classroom-appropriate and privacy-respecting; this
tool is already most of the way to being it.

## Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see `_platform-themes.md`). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Student-device quiz mode.** Hand students a link or QR that opens the map
  in Self-Check Quiz Mode on their own device. The projected version above
  covers the same teaching purpose without putting students on the site.

## Platform themes that matter here

- **P12 (IndexedDB)** — this tool already solved the problem the rest of the
  site has; `bmg-map-cache.js` is the reference implementation to copy.
- **P6 (print quality)** — tiled poster printing is the site's most advanced
  print feature and worth generalizing.
- **P3 (share links)** — sending a map project to a colleague; student
  handouts are printed, not linked.
- **P11 (undo)** — has undo *and* redo; the only tool that does.
- **P15 (first run)** — "Recently used" is good; a shipped sample project
  would be better.

## Open Questions

- How much of the geography data (`bmg-geography.js`) should be shipped
  locally versus fetched? Fully local is better offline and bigger.
- **How accurate do the built-in label-set coordinates need to be?** They're
  deliberately approximate label anchors (a readable spot inside each area),
  and they land well on equirectangular/Mercator maps, but a Robinson or
  conic Commons map will need dragging. The alternative — per-projection
  anchor sets, or real centroids from GeoJSON — is most of the way to the
  "vector base maps" moonshot, so it may be the wrong problem to solve
  twice.
- Is Wikimedia Commons search reliable enough long-term to be the primary
  map source, or should shipped base maps become the default with Commons as
  the fallback?
