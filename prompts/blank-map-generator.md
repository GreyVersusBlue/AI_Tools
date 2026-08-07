I'm Devon Moore, a 7th grade Social Studies teacher. I run a small repo called
"East Middle Staff Toolkit" (GitHub Pages site, custom domain via `CNAME`,
publicly known as AsPerMyLessonPlan.com). It's a set of small, single-file
HTML tools for day-to-day classroom logistics — no accounts, no server, no data
leaving the browser. `index.html` at the repo root is the landing page that links
to everything; `README.md` has a table describing each tool.

Conventions already established in this repo (look at existing tools before
building):
- Each tool's entry point is one `.html` file directly under `Tools/`; this
  one will need a substantial subfolder (`Tools/blank-map-generator/`) for
  its rendering/annotation JS, since this is the most feature-heavy tool in
  the backlog — don't force it into a single file if that gets unwieldy.
- Vendor third-party libraries locally, no CDN-only dependencies — including
  the map imagery itself: fetched/cached maps should be usable offline once
  loaded, not re-fetched from Wikimedia every time (consider what's feasible
  to bundle vs. what has to stay a live fetch given map file sizes).
- Reuse jsPDF (already vendored) or a print stylesheet for exporting the
  finished map.
- Update the root `README.md` tools table and `index.html` landing page (plus
  `index.html`'s DEV NOTES items 4/5/6) to link the new tool once it's built.
  Also remove its `.row.soon` placeholder from `index.html`, and its entry
  from `IDEAS_BACKLOG.md` and `ideas-backlog.html`.

## The tool: Blank Map Generator ("the whole suite")

Goal: a full map-annotation tool for Social Studies (and other subjects) —
pull in a high-quality blank/physical/political map, zoom into a region, and
annotate it for a labeling activity or a display map, then export/print it.
This is the biggest tool in this batch — expect to scope it in phases and
confirm each phase with me rather than building the entire suite blind.

Requirements (the full feature set to design toward):
- **Map source**: pull high-resolution map images from Wikimedia Commons
  (note: not "Wikipedia Commons" — the actual project name is Wikimedia
  Commons; confirm the exact images/API approach with me, since Commons file
  licensing and file sizes vary a lot). Support at least a world map, and a
  way to search/pick a specific region or country map.
- **Zoom on HQ maps**: the source images should be large enough to zoom into
  a sub-region without getting blurry/pixelated, with pan/zoom controls.
- **"Map in a map"**: a small inset locator map (toggleable) showing where
  the current zoomed-in view sits within the larger map/globe context.
- **Labels**: click to place a text label anywhere on the map (place names,
  custom text), draggable after placement, editable text.
- **Markers**: multiple marker styles/icons (e.g. pin, star, dot, flag) that
  can be placed and moved, for marking specific locations.
- **Automatic key/legend**: as labels/markers are added, auto-build a legend
  listing them (e.g. marker style → what it represents), which the user can
  also edit.
- **Movable legend**: the legend itself should be a draggable element on the
  map/canvas, not fixed in one corner.
- **Compass rose toggle**: an optional decorative compass rose element.
- **Lat/long**: display latitude/longitude (e.g. on hover, or as an optional
  grid overlay) tied to the actual map's real-world coordinates.
- Export/print the finished annotated map (image or PDF) at a usable
  resolution/size for handing out or projecting.

Given the size of this, propose a build order (e.g.: 1. load & zoom/pan a
static map image, 2. add labels, 3. add markers + auto legend + movable
legend, 4. add compass rose + lat/long overlay, 5. export) and confirm the
Wikimedia Commons sourcing approach with me before writing any map-fetching
code — I'd rather lock down phase 1 solid than half-build all five phases.
