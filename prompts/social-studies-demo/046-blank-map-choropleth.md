# SS demo round — 046 Blank Map Generator — choropleth from pasted data

Read `CLAUDE.md`, then `prompts/social-studies-demo/_preamble.md` and follow it
exactly, then `improvement prompts/046-blank-map-generator.md`. Read Round 13's
Status notes carefully: they sequence choropleth AFTER per-region hit-testing.
**This round deliberately bypasses that sequencing** — hit-testing is only a
prerequisite for click-to-shade, not for shading from pasted data. Say so in
your Status entry so the next round isn't confused.

Your tool: `Tools/046-blank-map-generator.html` (~3,800 lines) +
`Tools/blank-map-generator/` (15 modules + `data/` TopoJSON + test). This is
the biggest tool in the round; containing the blast radius is most of the job.
Before writing code, read `bmg-vector.js`, `bmg-legend.js`, `bmg-regions.js`,
and `bmg-map-cache.js`.

## Headline — "Choropleth from pasted data" (backlog rank 13)

Paste "region, value" rows and shade the vector base map with a grayscale-safe
ramp plus an automatic legend.

- Scope: **built-in vector base maps only** (world countries, US states from
  `data/`). Never on Commons/uploaded raster images.
- Input: a textarea accepting one `region, value` pair per line (tolerate
  tabs, semicolons, and pasted two-column spreadsheet regions; ignore blank
  lines; a header row like `state, population` should be detected and
  skipped).
- Matching: case-insensitive, trimmed, with a small alias table for the
  usual traps (US vs United States, UK, DRC, Burma/Myanmar, D.C., common
  state abbreviations). **Unmatched rows are reported by name in the UI,
  never silently dropped.** Matched count shown ("48 of 50 matched").
- Classification: quantile or equal-interval classes (either is fine; pick
  one, 4–6 classes) into a **grayscale-safe sequential ramp** — the tool
  already has a "grayscale-safe fills" convention; follow it so a b&w copier
  preserves the meaning.
- Legend: automatic class rows (range + swatch) through the existing
  `bmg-legend.js` machinery.
- Rendering: fills applied when the vector base map is generated. Implement
  the logic (parse, match, classify, ramp) as a **new module**
  `Tools/blank-map-generator/bmg-choropleth.js` with minimal wiring in the
  main file and `bmg-vector.js`'s render options. Give choropleth renders a
  distinct cache-record id (e.g. append a `:choro:<hash>` suffix) so plain
  base maps in `bmg-map-cache.js` stay clean.
- Choropleth settings persist with the project (existing workspace store,
  `bmg_workspace_v1`) and survive reload.

Demo cut if this runs long: **US-states preset only**, world map deferred.

Note: the Timeline Builder session (015) will READ your `data/` GeoJSON this
round but must not write anything in your folder; you own every file under
`Tools/blank-map-generator/`.

## Supporting (in order; cut from the bottom)

1. **"Load example data" button** (P15) next to the paste box: US state
   populations (rounded, teacher-credible), so the demo is paste-free.
2. **Smoke test** `Tools/blank-map-generator/test/smoke-choropleth.mjs`
   following `smoke-starters.mjs`: assert a known state's rendered pixel
   differs across value classes, unmatched names are reported, example data
   loads and matches 50/50. Add `test:blank-map-choropleth` (or extend the
   existing `test:blank-map` script) in `package.json`.

## Non-goals

Click-to-shade / per-region hit-testing; choropleth on raster/Commons maps;
time-slice or animated maps; diverging ramps; 50m-resolution data; share
links; new starter projects; touching the worksheet generator.

## Notes

- `bmg-choropleth.js` → `sw.js` `PRECACHE_URLS` next to the other `bmg-*.js`
  entries + `CACHE_VERSION` bump (test files excluded, matching existing
  handling).
- Existing suite `test:blank-map` (`test/smoke-starters.mjs`) must be green
  before you start and after you finish.
- README row + index.html pitch: mention choropleth ("paste data, get a
  shaded map with a legend").
