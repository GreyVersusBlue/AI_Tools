# Improvement Prompts — 046 — Blank Map Generator

**Tool file:** `Tools/046-blank-map-generator.html`
**Support folder:** `Tools/blank-map-generator/` — `bmg-colors.js`, `bmg-commons.js`, `bmg-geography.js`, `bmg-label-sets.js`, `bmg-labels.js`, `bmg-latlong.js`, `bmg-legend.js`, `bmg-lines.js`, `bmg-locator.js`, `bmg-map-cache.js`, `bmg-markers.js`, `bmg-regions.js`, `bmg-store.js`, `bmg-vector.js`, `bmg-viewer.js`, `test/smoke-starters.mjs`

**Current description (from README):** Search Wikimedia Commons for a map, pan/zoom into a region, and annotate it with draggable labels, markers (pin/star/dot/flag), and shaded polygon regions — all auto-building an editable legend. Optional compass rose, lat/long grid, and a locator inset. Undo for accidental deletes. Maps are cached for offline reuse; print or save as PDF.

---

## Status

### 2026-08-13 — session `q4wmxz` — Devon-assigned social studies demo round

**Shipped choropleth from pasted data** — `IDEAS_BACKLOG.md` **rank 13,
"Choropleth from a data table"**, which this round covers in full for the
built-in vector base maps. (Backlog file untouched, per the round rules —
Devon runs one bookkeeping pass after the branches merge.)

**Read this first if you are picking up phase 2:** Round 13's notes sequence
choropleth *after* per-region hit-testing. **This round deliberately bypassed
that sequencing, and the sequencing was wrong.** Hit-testing is a prerequisite
for *click*-to-shade — turning a mouse position into a region — and for
nothing else. Shading from a pasted table needs the region's *name* and its
*polygon*, both of which the GeoJSON has already, so the fill can be painted
during the base-map render with no picking involved. Per-region hit-testing is
still open and still worth doing; it is simply not a dependency of this.

- **A "Shade by data" panel** on the built-in base maps strip. Paste one
  `place, number` per line, choose 4–6 bands and a colour ramp, press "Shade
  the map". "Remove shading" puts it back. Built-in vector maps only —
  Commons and uploaded rasters have no region shapes to fill.
- **New `bmg-choropleth.js` holds all of the thinking and touches no DOM.**
  Parsing tolerates tabs, semicolons, pipes and commas, thousands separators,
  `$`/`%`, blank lines, and a header row (detected and skipped, and *said so*
  in the report rather than silently). A name containing the delimiter still
  parses, because the value has to match to the end of the line — so
  `Congo, Dem. Rep., 95000000` comes out whole. Matching is case- and
  accent-insensitive with an alias table covering the traps the prompt named
  (United States/USA, UK, DRC, Burma, D.C. + all 50 postal abbreviations) and
  the ones the *data* creates, which are worse: Natural Earth ships
  `Dem. Rep. Congo`, `Bosnia and Herz.`, `Central African Rep.`, `Czechia`,
  `eSwatini`, `W. Sahara`, `Côte d'Ivoire`. **No row is ever dropped
  silently** — the panel prints "48 of 50 rows matched" and then names every
  row that matched nothing.
- **Quantile bands, not equal intervals.** Equal intervals on state
  population put 46 states in the lightest band and California alone in the
  darkest, which is a true map that shows nothing. The legend prints each
  band's real numeric range, so the choice hides nothing either.
- **Grayscale-safe here means one hue getting darker.** The tool's existing
  grayscale-safe convention substitutes hatch/dot *patterns*, because that
  convention is for *categorical* regions where two hues photocopy to the same
  gray. Ordered bands need the opposite: falling luminance is exactly what a
  b&w copier reproduces, and a hatch is not "more" than a dot. Four
  single-hue ramps ship; `RAMP_LUMINANCE_STEP` states the minimum drop per
  step and the suite enforces it. The grayscale render was inspected directly,
  not just asserted.
- **The wiring is thin on purpose, which is the whole containment strategy
  for a 3,800-line tool.** `bmg-vector.js` paints the fills between the land
  fill and the boundary strokes as it draws the base raster, so labels,
  markers, worksheets, PNG, print, PDF and the poster tiles all work on a
  shaded map without knowing one exists — the same trick Round 13 used for
  base maps themselves. Total footprint in the main file: the panel's markup
  and CSS, one `kind === 'choro'` clause in `drawPngLegend()`, and the panel's
  event wiring.
- **Cache ids gained a `:choro:<hash>` suffix**, so plain base maps keep their
  own clean records. New `stripBaseMapId()` / `sameBaseMap()` let
  `displayMap()` recognise that a re-shade is *the same piece of paper
  redrawn* — same preset, crop, style, pixel size and calibration. That is
  what stops a teacher's already-placed labels from being wiped when they add
  or remove shading, which the naive version did (`isSameMap` was false, so
  the fresh-map reset fired). Loading a genuinely different map still drops
  the shaded state and its key so the legend can't advertise bands the picture
  doesn't have, while keeping the pasted data itself.
- **Legend rows go through the existing `bmg-legend.js` machinery** as
  ordinary draggable, editable rows — range as the caption when nothing is
  typed — and the same rows are drawn into every raster export by
  `drawPngLegend()`. They are stored on the project rather than recomputed,
  so a reload brings the key back without re-reading a 250 KB data file, and
  the key can never disagree with the raster it belongs to.
- **Bug found and fixed on the way:** Student Handout Mode blanks every legend
  caption. On a shaded map that hands a student a picture with no way to read
  it, so choropleth class ranges are now exempt in both the on-screen panel
  and the raster export. A class range is the map's units, not its answer.
- **"Load example data"** (P15): rounded populations for all 50 states,
  written with thousands separators because that is what a spreadsheet
  pastes and the parser should be seen coping with it. It also points the
  picker at a US map, so a first click can't produce "none of those rows
  matched".
- **Persistence** rides in the existing `bmg_workspace_v1` project (no new
  localStorage key, so Backup & Restore needs no change);
  `normalizeProjectData()` backfills the new fields for older saves.

**Verified.** `smoke-choropleth.mjs` (new, `npm run test:blank-map` runs it
alongside the starters suite) — **59 checks, all green**, in two halves. The
first runs the module against the real vendored GeoJSON: parsing, the alias
table, quantile edge cases (four identical values collapse to one band, not
five empty ones), ramp luminance, and the example data matching 50/50. The
second drives the real UI and **reads the rendered pixels back**: California
comes out darker than Wyoming, re-shading with inverted data flips both, the
key gains five range rows, unmatched names appear in the report, labels
survive a re-shade *and* an un-shade, and the whole thing comes back shaded
after a reload. Zero console errors and **zero offsite requests** across the
run. `smoke-starters.mjs` still 22/22, `check:dedupe` green,
`check:social` byte-identical before and after.

**Where the next round should pick up:**

1. **Per-region hit-testing → click-to-shade** is still the keystone for the
   *other* half of region work, and it is now the only thing standing between
   this tool and "shade the states this treaty covers" without drawing
   polygons by hand. The projection is `project()` in `bmg-vector.js` and the
   names are already in memory.
2. **Choropleth on a Commons or uploaded map** is not possible and should
   stay out of scope: there are no region shapes in a JPEG.
3. **A title for the key.** The class rows say "6.2M to 8.7M" but nothing says
   *of what*. A one-line "what does this data show?" field feeding a legend
   heading is the obvious next small thing, and the legend panel has no
   heading row concept yet.
4. **Equal-interval as an option.** Quantiles are right for population;
   percentages (0–100 with real meaning at the boundaries) would read better
   in equal intervals. `quantileBreaks()` is the only thing that would need a
   sibling.
5. **Shared-code opportunity, deliberately not taken:** `038-data-chart-
   builder.html` parses two-column pasted data too, and `bmg-choropleth.js`'s
   ramps/luminance helpers are generic. The round rules forbid touching
   `_shared/`, so both were written locally. Logged in `_site-requests.md`.

### 2026-08-11 — session `m3r8ro`

**Shipped starter map projects** (backlog rank 17, platform theme P15). A first
run opened to an empty canvas and a list of things to configure, which is a
poor use of the five minutes a teacher gives a tool during a prep period.

- Three finished maps on the landing card: **Europe — countries**, **United
  States — states**, **World — physical features**, each assembled from parts
  that already ship offline (a `bmg-vector.js` base map preset plus a
  `bmg-label-sets.js` built-in set). Nothing is downloaded.
- **They are built by driving the tool's own controls**, not by writing a
  project blob: set the base-map preset/style/borders, call the same
  `useBuiltInBaseMap()` the Base Map button calls, then click the same
  `#btnPlaceLabelSet` the Label Sets panel uses. A sample therefore cannot
  drift out of step with what the tool actually produces, and a teacher who
  opens either panel afterwards finds it set to what they are looking at.
- **Each opens as its own new project**, with a suffixed name if one already
  exists, so a first click cannot overwrite work already in the workspace and a
  second click on the same sample gives a second project rather than a
  collision.
- **Bug found and fixed while building it:** `loadActiveProjectIntoUI()` fires
  a default Wikimedia search whenever it lands on an empty project. The starter
  flow creates an empty project and then immediately sets the base map, so that
  search was pure waste — a network request on a school network for results
  thrown away a moment later. It now takes a `{ skipSearch: true }` option that
  only the starter path passes; every other caller is unchanged.
- **Verified** by `Tools/blank-map-generator/test/smoke-starters.mjs` (22
  checks, `npm run test:blank-map`). The assertion that matters most counts
  offsite requests before and after a build and requires the difference to be
  zero — the entire point of assembling these from vendored vector data is that
  they work on a blocked network. It also checks the labels are real, placed,
  draggable label objects and that the map comes back calibrated.
- **Not done:** the samples are not offered again once a workspace has
  projects in it (the card is always shown, but there is no "you look new
  here" logic), and there is no sample using the regions or lines layers.

### Round 13 (2026-08-11, session `mn6d5m`) — shipped

**Vector base maps, phase 1** (Major Feature) — built-in, offline,
perfectly-calibrated blank maps, so a teacher gets a world/continent/USA
map with zero searching and no Wikimedia dependency. Devon-assigned round,
same per-tool override as Rounds 9–12.

- **Nine built-in base maps** in a new "Built-in base maps" strip at the
  top of the Find a map card: World, six continents (Africa, Europe, Asia,
  North America, South America, Australia & Oceania), and two USA crops
  (lower 48, and all 50 states with Alaska and Hawaii at their true
  coordinates rather than in inset boxes). Two styles — outline-only blank,
  or light land fill with a pale ocean — and a Show borders toggle
  (country/state boundaries on, or coastline/national outline only).
- **The architecture is deliberately unambitious, and that's the point.**
  The viewer was *not* rebuilt around vectors. New `bmg-vector.js` renders
  the chosen dataset and crop once, at high resolution (4000 px on the long
  side), in plate carrée, and returns **exactly the cache record
  `useUploadedFile()` already builds** — same fields, same IndexedDB store,
  same `displayMap()`. Every existing feature (labels, label sets, tidy,
  shrink, worksheets, answer keys, undo/redo, legend, all four export paths,
  tiled poster) therefore works on a built-in base map without knowing one
  exists. Total change to the main file: the picker's markup/CSS, ~50 lines
  of wiring, one clause in `displayMap()`, and one clause in
  `mapCreditLine()`. The record id is `vector:<preset>:<bounds>:<style>`, so
  the same choice regenerates to the same key and comes back out of the
  cache rather than being re-rendered.
- **Auto-calibration — the actual payoff.** Because the renderer chooses the
  projection and the bounds, it *knows* them; the record carries a
  `calibration` field and `displayMap()` applies it on load. The lat/long
  grid, scale bar, distance measurer, batch coordinate placement and the
  built-in label sets all work the instant a base map appears, with no
  eyeballing of the map's edges. Verified to **0.01 map pixels**: Paris,
  Sydney and Quito batch-placed onto the World map land exactly where the
  projection math says (the viewer transform was inverted to compare in map
  space), and the 50-state label set drops onto the USA map at 0.00 px
  error before tidy runs.
- **Data: vendored, public domain, documented.** Natural Earth via npm
  (`world-atlas@2` countries-110m, `us-atlas@3` states-10m), converted
  TopoJSON→GeoJSON with `topojson-client` in a one-off Node script, four
  files totalling ~670 KB under `Tools/blank-map-generator/data/` with a
  README covering provenance, the exact conversion (coordinates rounded to
  3 dp ≈ 110 m, only `name` kept), how to regenerate, and the public-domain
  terms. The open web was blocked from this sandbox again this round —
  npm was not, which is now twice this repo has routed a dependency that
  way (see `031-docx-merger.md`).
- **A real rendering bug found and fixed on the way.** Natural Earth stores
  rings that straddle the antimeridian with their vertices clamped to ±180,
  so a ring steps from −180 straight to +179.4 (Fiji), or +180 to −180
  (Antarctica's closing edge). Drawn naively in plate carrée each of those
  is a `lineTo` clean across the entire map — three stray full-width
  horizontal lines through the South Pacific and northern Siberia, which
  the first render had and which were only caught by *looking at the
  output*. Fixed in `drawableRings()`: rings are unwrapped into continuous
  longitude; a ring that encircles the globe is closed through the pole for
  filling (so Antarctica fills as a proper polar cap to the bottom of the
  map instead of a sliver cut off at the data's own clip latitude) but
  **not** for stroking (or every world map gets a hard line along its
  bottom edge — the first fix did exactly that, caught by a full-raster
  row scan); and a ring poking past ±180 is additionally drawn shifted
  360°, so the part belonging at the opposite edge appears there. The test
  suite now scans every row of the world raster for this class of artefact
  rather than trusting the eye on a downscaled preview.
- **Attribution.** `mapCreditLine()` gained a `vector:` branch producing
  "Base map: … — Natural Earth (public domain)", which Round 12's
  automatic stamping then carries onto PNG, Print, Save PDF, the poster
  tiles and the worksheet footer with no further work. Natural Earth asks
  for no credit at all; it's given because a handout should say where its
  map came from.
- Data files and the new module were added to `sw.js`'s precache list
  (`CACHE_VERSION` v43 → v44), so a PWA install carries the base maps.

Verified with `node --check` on `bmg-vector.js`, `sw.js` and the extracted
inline module script, plus a **19-check headless Chromium pass** driving the
real UI over local HTTP: render + auto-calibration + grid-works-immediately;
coordinate accuracy against the projection math; rendered-pixel land/ocean
probes at known points on three presets; the full-raster wrap-artefact scan;
the 50-state label set placed and tidied; a real worksheet + answer-key PDF
built end-to-end (both pages extracted and visually inspected — 50 numbered
circles, word bank, red ANSWER KEY, credit line in the footer); PNG credit
stamping read back out of the exported pixels; an **offline reload with the
vendored vector data and every remote host route-aborted**, confirming the
map, its 50 labels and its calibration all come back from IndexedDB without
touching the data files; and a regression guard that an ordinary uploaded
map is still *not* auto-calibrated. Zero unexpected console errors. The
rendered world/Europe/USA rasters were saved and looked at directly.

**Where phase 2 picks up** (all deliberately out of scope this round):

1. **Live vector rendering in the viewer** — the map is a raster once
   generated, so zooming past the render resolution softens. 4000 px covers
   a 300 dpi Letter page and the tiled poster, so this is a quality ceiling
   rather than a bug, but it's the precondition for everything below.
2. **Per-region hit-testing → click-to-shade.** The GeoJSON carries a
   `name` per country/state and is already in memory; point-in-polygon
   against the same projection is the whole mechanism. This is the feature
   that would replace hand-drawn `+ Shade Region` polygons.
3. **Choropleth from a data table** (P7) — needs (2) first, then reuses
   `038-data-chart-builder.html`'s parsing.
4. **Page shape vs. map shape.** A wide base map on the default US Letter
   *portrait* page letterboxes in the worksheet's map panel (visible in
   this round's inspected output). The Page shape control's Flip button is
   the workaround today; auto-suggesting a shape when a built-in map loads
   was left alone deliberately, since page shape is a printing decision the
   teacher owns.
5. **Finer resolutions.** 110m world data is coarse for a single small
   country; `world-atlas` ships 50m and 10m. Loading a finer file only for
   tight crops would cost ~750 KB (50m) more vendored.
6. **More crops** — the preset list is a plain array in `bmg-vector.js`, and
   a teacher-defined crop (type four bounds, get a calibrated map) is a
   small addition to the same machinery. Also: the all-50-states crop cuts
   the Aleutians west of 170°W.

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

- **Choropleth shading from pasted data** — paste "place, number" rows and
  the built-in base map shades itself in 4–6 quantile bands, with a key that
  writes its own numeric ranges. Grayscale-safe by construction (one hue,
  falling luminance), tolerant of spreadsheet paste, and it names every row
  it couldn't match instead of dropping it. "Load example data" fills the box
  with all 50 state populations
- **Three starter projects** on the landing card — Europe countries, US
  states, world physical features — each a complete map assembled offline from
  a built-in base map plus a built-in label set, opening as its own new project
- **Built-in base maps** — World, six continents and two USA crops, drawn
  offline from vendored Natural Earth data in outline-only or land-fill
  style, with borders on or off. They **calibrate themselves**, so the
  grid, scale bar, distance tool, coordinate placement and label sets work
  the moment one loads
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
- **Vector base maps — *phase 1 shipped in Round 13*.** Nine built-in
  base maps (World, six continents, two USA crops) render offline from
  vendored Natural Earth GeoJSON and, because the renderer owns the
  projection, **calibrate themselves** — which is what makes the label
  sets, grid, scale bar and coordinate placement work the moment one
  loads. They go through the existing raster pipeline, so every feature
  works on them unchanged. Still open, and the reason this stays on the
  list: **live vector rendering in the viewer** (the generated map is a
  raster, so zoom quality has a ceiling) and **per-region hit-testing and
  click-to-shade**. **Choropleth shipped 2026-08-13** — Round 13's note that
  it needed hit-testing first was wrong: hit-testing turns a *click* into a
  region, and shading from a pasted table never has a click to turn.
- **Done —** **Choropleth from a data table.** Paste "state, value" and shade
  accordingly (P7). *(Shipped 2026-08-13 in `bmg-choropleth.js` — quantile
  bands, a grayscale-safe single-hue ramp, an alias table, a self-writing
  key, and unmatched rows reported by name. Built-in vector base maps only;
  a raster has no region shapes to fill. The parsing was written fresh rather
  than lifted from `038-data-chart-builder.html`: the round rules forbid
  touching `_shared/`, and the two jobs differ anyway — a chart takes columns
  of numbers, a map takes one number per named place.)*
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
  Round 13 set a precedent worth reusing: ~670 KB of vendored Natural Earth
  GeoJSON, checked in as data with a provenance README, no build step, and
  added to the service-worker precache. That was a comfortable size; the
  next decision point is the 50m world data (~750 KB more) if finer crops
  are wanted.
- **How accurate do the built-in label-set coordinates need to be?**
  *Answered for built-in base maps (Round 13), still open elsewhere.* This
  question guessed right: the fix was not per-projection anchor sets but
  the vector base maps themselves. On a built-in base map the anchors land
  at **0.00 px** error against the projection math (measured on all 50
  states), because the map is drawn in the projection those anchors were
  written for and calibrates itself to it — no dragging, no eyeballed
  calibration, nothing to correct. The anchors stay deliberately
  approximate *as anchors* (a readable spot inside each area, not a
  centroid), which is the right shape for a label. What remains open is
  unchanged and now clearly separable: a Robinson or conic **Commons**
  map will still need dragging, and nothing in phase 1 helps there. The
  honest answer for that case is "use a built-in base map instead", which
  is now a real option rather than advice.
- **Is Wikimedia Commons search reliable enough long-term to be the primary
  map source?** *Answered in practice, not yet in the UI (Round 13).* Two
  consecutive sessions found Commons unreachable from their sandbox, and a
  teacher on school wifi with a filtered connection is in the same
  position — a map source that can simply be absent cannot be the primary
  one. Built-in base maps now cover the common classroom cases (world,
  continents, USA) with better results than search: correctly projected,
  self-calibrating, no licence to check, no results to sift. The strip is
  placed **above** the search box for that reason. What was *not* done is
  demoting Commons any further — it stays a full first-class path, because
  it covers everything the nine presets don't (historical maps, physical
  maps, thematic maps, individual countries) and a teacher who wants a
  specific map should still get one. The open part is whether the search
  card should eventually collapse Commons behind a disclosure; that's a
  judgement about the *card*, not about the data, and it can wait until
  the preset list stops growing.
