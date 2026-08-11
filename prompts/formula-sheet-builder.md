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
- Reuse jsPDF (already vendored) or a print stylesheet for output — use your
  judgment on which fits a one-page reference sheet better.
- Update the root `README.md` tools table and `index.html` landing page (plus
  `index.html`'s DEV NOTES items 4/5/6) to link the new tool once it's built.
  Also remove its `.row.soon` placeholder from `index.html`, and its entry
  from `IDEAS_BACKLOG.md` and `ideas-backlog.html`.

## The tool: Formula Reference Sheet Builder

Goal: build a printable one-page formula reference sheet for a math unit
(area/perimeter/volume formulas, algebra formulas, etc.) instead of retyping
one in a Word doc every time a unit changes.

Requirements:
- **Pick from templates**: ship with a set of ready-made formula templates
  organized by common middle/high school math topics (e.g. geometry — area &
  perimeter, geometry — volume & surface area, algebra — linear equations,
  algebra — quadratics, basic statistics). Selecting a template populates the
  sheet with that topic's standard formulas (with labeled variables/a short
  example if space allows).
- Let me customize a template after picking it: remove formulas I don't need,
  add a custom formula (name + expression, plain text/simple notation is
  fine — no need for full math typesetting), and reorder items.
- Support building a sheet from scratch (blank) instead of a template too.
- Clean, printable one-page layout via an @media print stylesheet — this is
  meant to be handed out or referenced during a test, so keep it legible and
  not cluttered.
- Persist my custom sheets via localStorage so I can come back and reuse/edit
  one instead of rebuilding it each time (similar to how Sub Plan Builder
  saves reusable boilerplate).
- Design the template data as a simple, extensible structure (plain JS/JSON
  per template) so adding a new topic template later is just adding a config
  entry, not touching the renderer.

Ask me clarifying questions about which formula templates to start with
before building.
