# Improvement Prompts — Blank Map Generator

**Tool file:** `Tools/blank-map-generator.html`
**Support folder:** `Tools/blank-map-generator/` — `bmg-colors.js`, `bmg-commons.js`, `bmg-geography.js`, `bmg-labels.js`, `bmg-latlong.js`, `bmg-legend.js`, `bmg-lines.js`, `bmg-locator.js`, `bmg-map-cache.js`, `bmg-markers.js`, `bmg-regions.js`, `bmg-store.js`, `bmg-viewer.js`

**Current description (from README):** Search Wikimedia Commons for a map, pan/zoom into a region, and annotate it with draggable labels, markers (pin/star/dot/flag), and shaded polygon regions — all auto-building an editable legend. Optional compass rose, lat/long grid, and a locator inset. Undo for accidental deletes. Maps are cached for offline reuse; print or save as PDF.

---

## Status

Reviewed — structural read of the source. This is the most architecturally
mature tool on the site: properly modularized, IndexedDB-backed, with
undo/redo. Ideas below are deliberately ambitious and **not** scoped to one
session.

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
- **Student Handout Mode** and **Self-Check Quiz Mode**
- Multiple named projects, import/export, PNG download, print / save PDF, and
  **tiled poster printing** across several pages
- IndexedDB map cache for genuine offline reuse; "clear cached maps"
- Full undo/redo history

## Quick Wins

- **Answer key printing** as a first-class pair to Student Handout Mode —
  same map, labels visible, marked "KEY".
- **Numbered-blank worksheets**: place numbered markers, print a blank with a
  numbered answer-line list beside the map. This is the single most common
  map worksheet format in a social studies classroom.
- **Quiz mode scoring/shuffle** — Self-Check Quiz Mode exists; randomizing
  which labels are hidden, and generating several versions from one project,
  turns one map into a whole set.
- **Label collision avoidance** or at least a "nudge overlapping labels" pass;
  a dense map currently needs a lot of manual dragging.
- **Reusable label sets.** The 13 colonies, the 50 states, the countries of
  Europe — a saved list you can drop onto any calibrated map.
- **Line style for rivers/borders/routes as semantic types**, so the legend
  writes itself with the right words.
- **Print in grayscale-safe fills** (P6) — shaded regions currently rely on
  colour, and most classroom printers are black and white. The region fill
  *pattern* machinery already exists (`regionFillPatternTile`); make patterns
  the default for print.

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
- **Student-facing interactive mode.** With `state-link.js` or a QR code
  (P3), hand students a link that opens the map in quiz mode on their own
  device, with nothing stored anywhere. Pairs with the QR tools already on
  the site.
- **Map + timeline pairing** (P7). `timeline-builder.html` covers *when*;
  this covers *where*. A combined print — timeline along the bottom, map
  above, events pinned to both — would be a genuinely distinctive artifact.
- **Attribution done properly and automatically.** `renderAttribution` exists;
  making the Commons licence line unmissable on every export protects the
  teacher and models good practice for students.

## Moonshot / North Star

**A social studies map studio that runs on a Chromebook with the wifi off.**
Vector base maps, layered time slices, data-driven shading, student handouts
with answer keys, poster-size tiled printing, and a link a student can open on
a phone — all offline, all local, all free. There is no product in this space
that is both classroom-appropriate and privacy-respecting; this tool is
already most of the way to being it.

## Platform themes that matter here

- **P12 (IndexedDB)** — this tool already solved the problem the rest of the
  site has; `bmg-map-cache.js` is the reference implementation to copy.
- **P6 (print quality)** — tiled poster printing is the site's most advanced
  print feature and worth generalizing.
- **P3 (share links)** — student handouts by link/QR.
- **P11 (undo)** — has undo *and* redo; the only tool that does.
- **P15 (first run)** — "Recently used" is good; a shipped sample project
  would be better.

## Open Questions

- How much of the geography data (`bmg-geography.js`) should be shipped
  locally versus fetched? Fully local is better offline and bigger.
- Is Wikimedia Commons search reliable enough long-term to be the primary
  map source, or should shipped base maps become the default with Commons as
  the fallback?
