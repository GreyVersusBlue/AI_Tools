# Seating Chart Generator — support files

Everything the tool needs that isn't the page itself. The page stays at
`Tools/005-Seating Chart Generator.html`, so the board link
(`/Tools/005-Seating%20Chart%20Generator.html`) is unchanged.

```
seating.mjs         pure logic + the save slot. No DOM. Node runs it as-is.
fonts/              the two vendored families, with licences. See fonts/README.md.
test/smoke-seating.mjs   Node test of the logic and the save slot
test/drive-seating.mjs   the same tool in a real browser: build, reload, print, import
shots/              screenshots and the printed PDF the driver writes (gitignored)
```

## Running the tests

```
node Tools/seating-chart/test/smoke-seating.mjs      → 123 passed, 0 failed
node Tools/seating-chart/test/drive-seating.mjs      → 74 checks, 0 failed
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
