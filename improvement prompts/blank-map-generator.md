# Improvement Prompts — 046 — Blank Map Generator

**Tool file:** `Tools/blank-map-generator.html`
**Support folder:** `Tools/blank-map-generator/` — `bmg-colors.js`, `bmg-commons.js`, `bmg-geography.js`, `bmg-label-sets.js`, `bmg-labels.js`, `bmg-latlong.js`, `bmg-legend.js`, `bmg-lines.js`, `bmg-locator.js`, `bmg-map-cache.js`, `bmg-markers.js`, `bmg-regions.js`, `bmg-store.js`, `bmg-viewer.js`

**Current description (from README):** Search Wikimedia Commons for a map, pan/zoom into a region, and annotate it with draggable labels, markers (pin/star/dot/flag), and shaded polygon regions — all auto-building an editable legend. Optional compass rose, lat/long grid, and a locator inset. Undo for accidental deletes. Maps are cached for offline reuse; print or save as PDF.

---

## Status

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
  ones, dropped onto any calibrated map, and a **Tidy Labels** pass that
  nudges overlapping labels apart
- **Semantic line types** (river / border / trade route / migration / …)
  that caption their own legend row
- **Student Handout Mode**, **Self-Check Quiz Mode** (with reveal-next,
  scoring, reshuffle and projector text), and a **numbered worksheet +
  answer key** builder with word bank and multiple shuffled versions
- Multiple named projects, import/export, PNG download, print / save PDF, and
  **tiled poster printing** across several pages
- IndexedDB map cache for genuine offline reuse; "clear cached maps"
- Full undo/redo history

## Quick Wins

Round 10 shipped the worksheet/answer-key/label-set/tidy/line-type/quiz
cluster and Round 9 shipped grayscale-safe fills; what's left here is what
those rounds surfaced rather than solved.

- **Word bank on the answer-key page is redundant** — it prints there
  because the key reuses the worksheet layout wholesale. Minor, but it's a
  wasted inch of paper on every key.
- **Numbered markers aren't worksheet items.** The worksheet numbers text
  labels only. A teacher who built their map from numbered pins (and put the
  answers in the legend captions) gets an empty worksheet with no
  explanation beyond the panel's hint. Either number them too, or say so
  where they'll see it.
- **Label sets can't be edited or exported.** A saved set can be created and
  deleted, but not renamed, trimmed, or handed to a colleague — and the
  built-in coordinates can't be corrected in place, only re-saved as a
  private copy. Set import/export would also make the built-ins
  community-fixable.
- **A "shrink to fit" pass for labels**, as a companion to Tidy Labels: on a
  really dense map, separation alone runs out of room and the honest fix is
  smaller type.
- **Worksheet answer lines don't wrap.** A long place name in a narrow
  answer column overruns its line rather than shrinking or wrapping.

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
  `data-chart-builder.html` (P7).
- **Projected quiz mode** — *shipped in Round 10* (reveal-next, counter, ✓/✗
  tally, reshuffle, projector text). What's still missing is persistence of
  which labels a class struggled with across sessions, which is the part
  that would actually change reteaching.
- **Map + timeline pairing** (P7). `timeline-builder.html` covers *when*;
  this covers *where*. A combined print — timeline along the bottom, map
  above, events pinned to both — would be a genuinely distinctive artifact.
- **Attribution done properly and automatically.** `renderAttribution` exists;
  making the Commons licence line unmissable on every export protects the
  teacher and models good practice for students.

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
