# SS demo round 2 — 015 Timeline Builder — story mode + worksheet print

Read `CLAUDE.md`, then `prompts/social-studies-demo-2/_preamble.md` and
follow it exactly, then `improvement prompts/015-timeline-builder.md`
(Status top-down; round 1 just shipped places/gazetteer, the map + timeline
print, share links, and `test/smoke-map-print.mjs`).

Your tool: `Tools/015-timeline-builder.html` + `Tools/timeline-builder/`
(`tlb-layout.js`, `tlb-photo.js`, `tlb-places.js`, `tlb-store.js`). Round 1
reuses `Tools/blank-map-generator/bmg-vector.js` read-only for map
rendering — that arrangement stands: read 046's files, never write them.

## Headline — Story mode (projector playthrough)

A full-screen presentation mode that steps through the timeline one event at
a time, documentary style, driven by the teacher.

- Enter/exit via a "Present" button; full-screen layout with big type
  readable from the back of a classroom.
- Each step shows one event: date, title, description, photo if present,
  and the map with that event's pin highlighted, panning/zooming smoothly
  from the previous event's location (simple animated interpolation of the
  existing renderer's viewport is enough; if smooth animation fights the
  renderer, a quick crossfade between fitted views is an acceptable cut).
- Events without a place keep the previous map view and just dim the map.
- Controls: next/prev (click and arrow keys), a progress dots/counter, Esc
  to exit. A small "context strip" of the whole timeline at the bottom with
  the current event highlighted, so students keep the sequence in view.
- Respect `prefers-reduced-motion`: instant cuts instead of pans.
- Works with the existing named-timeline library and the round-1 example
  timeline (the American Revolution example should demo this perfectly).

## Supporting (in order; cut from the bottom)

1. **Timeline worksheet print**: a student-facing printable generated from
   the current timeline — the timeline strip with N chosen events blanked
   (teacher picks how many), a word bank of the removed titles, and an
   answer key page. Follow the Blank Map Generator's worksheet-generator
   pattern (numbered blanks + word bank + key; seeded shuffle for multiple
   versions if it falls out naturally).
2. **Extend the smoke suite** (`test/smoke-map-print.mjs` sibling or new
   file): story mode opens, steps in order, highlights the right pin,
   Esc exits cleanly; worksheet print blanks the chosen count and the key
   matches. Wire into `test:timeline`.

## Non-goals

Audio narration; autoplay timers; student-operated anything (the teacher
drives); editing 046's files; IndexedDB photo migration; renaming legacy
`gvb-timeline:*` keys.

## Notes

- New module file(s) go in `Tools/timeline-builder/` → `sw.js`
  `PRECACHE_URLS` next to the existing entries + `CACHE_VERSION` bump.
- Keyboard handling must not fight the page's inputs (only bind while
  presenting).
- README row + index.html pitch: mention story mode and the worksheet.
