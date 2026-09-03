# Seating Chart Generator — support files

Everything the tool needs that isn't the page itself. The page stays at
`Tools/005-Seating Chart Generator.html`, so the board link
(`/Tools/005-Seating%20Chart%20Generator.html`) is unchanged.

```
seating.mjs         pure logic + the save slot. No DOM. Node runs it as-is.
fonts/              the two vendored families, with licences. See fonts/README.md.
test/smoke-seating.mjs   Node test of the logic and the save slot
test/smoke-sub-packet.mjs the whole-day substitute packet
test/smoke-zoom-pan.mjs  wheel zoom and drag-to-pan on the floor, in a browser
test/drive-seating.mjs   the same tool in a real browser: build, reload, print, import
shots/              screenshots and the printed PDF the driver writes (gitignored)
```

## Zooming and panning the floor

The floor is a 1280x900 room drawn at `--fscale`, a single CSS variable that
three things now write: fit-to-window, 100%, and a free zoom level left behind
by the mouse wheel. `state.zoom` holds `'fit'`, `'full'`, or a number between
`ZOOM_MIN` and `ZOOM_MAX` (exported from `seating.mjs`, so the wheel, the saved
level and `repairState` all agree on the limits), and it is saved with the
chart.

Panning is the stage's own scrollbars, moved by dragging any empty part of the
floor — deliberately *not* a second transform. The floor already carries the
`--fscale` scale and `#deskLayer`'s transform (mirror view, print trimming),
and a third one would have to be unpicked again in the desk-drag maths and in
`printLayoutFor()`. Scrolling a scroll container composes with all of it for
free. Drag-to-pan is mouse-only: a touch drag is already a native scroll (and
a pinch a native zoom), and handling it here as well would move the floor
twice as far as the finger.

## The toolbar on a phone

Below 900px the toolbar folds: the controls a teacher uses standing in the
room (assign, shuffle, clear, undo, pick a student, the three view toggles)
stay in one sideways-scrolling row, and a **More** button pinned at its right
edge unfolds the desk-building and printing groups underneath. The wrappers
that make this work (`.tb-primary`, `.tb-more`) are `display:contents` on a
desktop, so the toolbar there is still one flat flex row. This is what turned
the long-standing "chart is within one swipe of the top" assertion green
(2026-09-03, Path 14 P1): folded, the bar is 70px tall instead of 460px.

## Running the tests

```
node Tools/seating-chart/test/smoke-seating.mjs      → 123 passed, 0 failed
node Tools/seating-chart/test/drive-seating.mjs      → 110 checks, 0 failed
```

Both exit non-zero on failure. The driver borrows `serve()`, `launch()` and
`prepPage()` from `Tools/board-check/harness.mjs` rather than starting its own
browser, and runs headless, so it does not fight `npm run games` for the screen.

## Why the logic lives in a module

`seating.mjs` holds the seat solver, the constraint checker, `repairState`, the
roster parser and the layout maths. All of it is arithmetic and string work, which
is exactly what a Node test can drive without a browser and what a browser test
would be a slow way to check. The page keeps the DOM and nothing else.

The page is therefore an ES-module page. That is not a new dependency: adopting
`assets/js/gvb-save.js` already made it one. The consequence worth knowing is
that opening the saved `.html` file from disk no longer works — a browser refuses
module imports over `file://`. The page detects that and says so instead of
rendering a blank floor.

## Storage

One key, permanent: **`seating-chart-v1`**. Schema version 1. The trailing `v1`
is part of the name and does not move when the schema version does (locked
decision #36). It holds every section, roster, note, desk and seat assignment for
this browser.
