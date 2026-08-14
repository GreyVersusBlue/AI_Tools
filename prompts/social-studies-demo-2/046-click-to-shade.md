# SS demo round 2 — 046 Blank Map Generator — click-to-shade regions

Read `CLAUDE.md`, then `prompts/social-studies-demo-2/_preamble.md` and
follow it exactly, then `improvement prompts/046-blank-map-generator.md`
(Status top-down; round 1 just shipped `bmg-choropleth.js` — paste-data
choropleth with alias matching, grayscale-safe ramps, legend integration —
deliberately bypassing hit-testing. This round builds the hit-testing it
bypassed).

Your tool: `Tools/046-blank-map-generator.html` + `Tools/blank-map-generator/`
(16 modules incl. `bmg-choropleth.js`, `data/` TopoJSON, 2 test suites).
Biggest tool in the toolkit; blast-radius containment is most of the job.
Read Round 13's Status notes plus `bmg-vector.js`, `bmg-regions.js`,
`bmg-choropleth.js`, and `bmg-map-cache.js` before writing code.

## Headline — Click-to-shade (per-region hit-testing on built-in vector maps)

The long-planned interaction: on a built-in vector base map (world
countries, US states), the teacher clicks a country/state and it shades.

- **Hit-testing**: point-in-polygon against the vendored TopoJSON
  geometries, honoring the current pan/zoom/projection math used at render
  time. Implement in a new module (e.g. `bmg-hittest.js`) with pure
  functions testable without a DOM. Handle multi-polygon countries
  (Alaska/Hawaii, archipelagos) and holes (Lesotho/South Africa).
- **Shade mode**: a toolbar mode where click cycles a region through the
  existing grayscale-safe categorical fill set (and Ctrl/right-click or a
  second control un-shades). Shaded regions appear in the legend via the
  existing machinery, named by their region name, editable like other
  legend entries.
- Plays cleanly with round 1's choropleth: manual shading and data
  choropleth are separate layers/modes; entering one warns before
  discarding the other on the same map (or they compose, if `bmg-vector.js`
  makes that clean — your call, but state the choice in your Status entry).
- Persists with the project workspace (`bmg_workspace_v1`), survives
  reload, exports in print/PDF/PNG/tiled output like every other layer.
- Undo/redo integration with the existing undo stack.
- Region hover feedback (name tooltip/status readout) while in shade mode —
  it doubles as a quick "what's this country called" check.

Demo cut if hit-testing on the world map runs long: US-states preset only
(the state polygons are far friendlier), world deferred with a Status note.

## Supporting (cut first if time runs short)

1. **Time-slice choropleth**: extend the round-1 paste-data flow to accept
   multiple value columns (e.g. `state, 1900, 1950, 2000` — header row
   names the slices) and print a labeled small-multiple series, one map per
   column, shared class bands across slices so the maps are comparable.
2. **Extend the smoke suites**: hit-test pure-function tests (known point →
   known region, including a multi-polygon and a hole case), click-to-shade
   drive test (click coordinates → region filled → legend row appears),
   persistence round-trip. Wire into `test:blank-map`.

## Non-goals

Hit-testing on Commons/uploaded raster images; freehand region drawing;
editing other tools' files (the Timeline Builder and Geography Bee sessions
read your `data/` and modules read-only this round — your files are yours
alone to write).

## Notes

- New modules → `sw.js` `PRECACHE_URLS` next to the other `bmg-*.js`
  entries + `CACHE_VERSION` bump.
- Both existing suites (`smoke-starters.mjs`, `smoke-choropleth.mjs`) green
  before you start and after every feature.
- README row + index.html pitch: mention click-to-shade.
