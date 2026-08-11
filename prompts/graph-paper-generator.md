I'm Devon Moore, a 7th grade Social Studies teacher. I run a small repo called
"East Middle Staff Toolkit" (GitHub Pages site, custom domain via `CNAME`,
publicly known as AsPerMyLessonPlan.com). It's a set of small, single-file
HTML tools for day-to-day classroom logistics — no accounts, no server, no data
leaving the browser. `index.html` at the repo root is the landing page that links
to everything; `README.md` has a table describing each tool.

Conventions already established in this repo (look at existing tools before
building):
- Repo-wide conventions are documented in `CLAUDE.md` at the repo root — read
  it first, and treat it as the authority if anything below conflicts with it.
  The rules that matter most when generating a new tool:
  - Third-party libraries come from `_shared/vendor/<name>/` — one canonical
    copy site-wide. Use the copy that's there; if the library isn't vendored
    yet, add it there, never as a per-tool copy and never from a CDN.
  - If the tool's subfolder needs a folder for remaining tool-specific
    vendored files, name it `lib/`, never `libs/`.
  - Link the shared boilerplate instead of inlining it: `_shared/theme.css`,
    `_shared/theme-toggle.js`, `_shared/a11y.css` + `_shared/a11y.js`, and
    `_shared/sw-register.js` for service-worker registration (see CLAUDE.md
    if that file doesn't exist yet).
  - Every file the tool adds must go into `PRECACHE_URLS` in `sw.js` with
    `CACHE_VERSION` bumped, or the tool silently breaks offline.
- Each tool's entry point is one `.html` file directly under `Tools/`.
- Supporting JS/assets for a tool live in a matching subfolder if needed.
- Reuse jsPDF (already vendored for Final Grade Checker/Sub Plan Builder) for
  any PDF export rather than adding a new PDF library. Printing via the
  browser's native print dialog (with an @media print stylesheet) is likely
  simpler here than a full PDF export — use your judgment.
- Update the root `README.md` tools table and `index.html` landing page (plus
  `index.html`'s DEV NOTES items 4/5/6) to link the new tool once it's built.
  Also remove its `.row.soon` placeholder from `index.html`, and its entry
  from `IDEAS_BACKLOG.md` and `ideas-backlog.html`.

## The tool: Graph Paper & Number Line Generator

Goal: printable math manipulatives generated on demand instead of hunting for
a worksheet online — this is a math-department tool even though I teach
Social Studies, so lean toward flexible/standard options over anything too
opinionated.

Requirements:
- **Graph paper**: configurable grid size (e.g. 1/4", 1/2", 1cm, or a custom
  squares-per-inch), configurable number of rows/columns or "fill the page,"
  page size (letter), and optionally bolded axis lines through the center.
- **Number lines**: configurable range (min/max), tick interval, and whether
  to label every tick or only some (e.g. every 5th). Support both a
  horizontal single number line and a "generate several on one page" mode for
  handing out strips.
- **Coordinate planes**: configurable quadrant count (full 4-quadrant vs.
  first-quadrant only), axis range, and gridline interval, with labeled axes.
- All three modes should render live in an on-screen preview before printing,
  and print cleanly (no browser chrome, sized to fill the page) via an
  @media print stylesheet — reuse this pattern if any other tool already
  has one, otherwise establish it here.
- Persist last-used settings via localStorage (same pattern as other tools)
  so re-opening the tool doesn't reset everything.

Ask me clarifying questions about default sizes/ranges before building.
