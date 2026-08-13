# SS demo round — 015 Timeline Builder — timeline + map combined print

Read `CLAUDE.md`, then `prompts/social-studies-demo/_preamble.md` and follow it
exactly, then `improvement prompts/015-timeline-builder.md` (Status top-down is
the source of truth — tiled wall print and compressed scale already shipped
even though older Quick Win bullets still mention them).

Your tool: `Tools/015-timeline-builder.html` + `Tools/timeline-builder/`
(modules `tlb-layout.js`, `tlb-photo.js`, `tlb-store.js`). Storage keys:
`gvb-timeline:list`, `gvb-timeline:data:<name>`, `gvb-timeline:current`.

## Headline — "Timeline plus map print" (backlog rank 2)

Pair events to places and print the timeline along the bottom with a map
above, each event pinned to both.

- Add an optional **Place** to each event: place name + lat/lon. Provide a
  small built-in gazetteer (a plain JS array of ~100 well-known cities,
  countries, and US states with coordinates) so a teacher can pick from a
  datalist/autocomplete instead of typing coordinates; manual lat/lon entry
  stays available. Events without a place are simply omitted from the map.
- New print option **"Map + timeline print"**: one landscape page with a map
  on top (numbered pins at each placed event) and the existing timeline strip
  along the bottom, with matching numbers on the timeline entries so students
  connect when to where.
- Base map: **read, never edit,** the GeoJSON/TopoJSON already vendored at
  `Tools/blank-map-generator/data/` (world countries 110m, US states 10m).
  First read `Tools/blank-map-generator/bmg-vector.js` — if it is cleanly
  callable standalone, reuse it; if it is entangled with 046's app state,
  write your own ~100-line plate-carrée (equirectangular) renderer against
  the same data inside `Tools/timeline-builder/`. Vendor no new data, no new
  libraries. Auto-fit the map extent to the pinned events with sane padding,
  falling back to world extent.
- The demo cut, if the full version runs long: world/continent-extent map,
  single page, no zoom controls. That is acceptable; a half-working zoom is
  not.

Another session owns `Tools/blank-map-generator/` this round. Reading its
files is fine; any write to them will collide.

## Supporting (in order; cut from the bottom)

1. **Load example** (P15): a one-click sample timeline with places prefilled,
   e.g. the American Revolution (Boston, Philadelphia, Trenton, Saratoga,
   Yorktown...), so the headline demos with zero typing. Keep it 8–12 events,
   7th-grade friendly. Do not overwrite unsaved work without a confirm.
2. **Share link + QR** (P3): copy the pattern from
   `Tools/028-primary-source-analysis-generator.html` (~line 1091, which uses
   `_shared/state-link.js` + `_shared/vendor/qrcode/qrcode.js`). The payload
   excludes event photos (they are base64 and would blow the URL); show a
   visible note saying photos stay on this device, mirroring 028's wording.
   An incoming link must save as a new uniquely-named timeline via the
   existing library, not silently replace the current one.
3. **First smoke test**: `Tools/timeline-builder/test/smoke-map-print.mjs`
   using `Tools/board-check/harness.mjs` like existing suites. Assert: place
   can be set, map+timeline print DOM renders pins matching placed events,
   share link round-trips a timeline (minus photos). Add `test:timeline` to
   `package.json` and append to the `test` chain.

## Non-goals

Projector/presentation mode; IndexedDB photo migration (P12); renaming the
legacy `gvb-timeline:*` keys; multi-page/tiled map+timeline variant; any edit
under `Tools/blank-map-generator/`; changes to `_shared/`.

## Notes

- New files (gazetteer module, test) → `sw.js` `PRECACHE_URLS` next to the
  existing `Tools/timeline-builder/` entries + `CACHE_VERSION` bump. Test
  files are NOT precached (check how existing `test/` folders are handled —
  they are excluded; match that).
- No new localStorage keys are expected; if you add one, register it in
  `Tools/009-backup-restore.html`.
- README row + index.html pitch: update to mention the map pairing.
