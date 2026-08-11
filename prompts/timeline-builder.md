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
- Supporting JS/assets for a tool live in a matching subfolder if the JS gets
  large enough (likely, given photo handling) — e.g. `Tools/timeline-builder/`.
- Photos are user-provided, client-side only — read/embed them (e.g. as data
  URLs) rather than uploading anywhere, consistent with the "nothing leaves
  your browser" principle. Persist via localStorage same as other tools, but
  be mindful of localStorage size limits with embedded images (flag this as a
  constraint and propose a reasonable approach — e.g. downscaling photos
  before storing, or warning if a saved timeline is getting large).
- Reuse jsPDF (already vendored) or a print stylesheet for export.
- Update the root `README.md` tools table and `index.html` landing page (plus
  `index.html`'s DEV NOTES items 4/5/6) to link the new tool once it's built.
  Also remove its `.row.soon` placeholder from `index.html`, and its entry
  from `IDEAS_BACKLOG.md` and `ideas-backlog.html`.

## The tool: Timeline Builder

Goal: build a timeline of events (for a Social Studies unit, or any subject)
that's visual enough to display or print, not just a bulleted list of dates.

Requirements:
- Add events with a date (or date range/era, since some Social Studies
  content isn't exact-day precision — support approximate/era-level dates,
  not just exact calendar dates), a title, and a short description.
- **Individual photos per event** — attach an image to a specific event
  (uploaded from the user's device), shown alongside that event on the
  timeline.
- **Labels** — event titles/dates should render clearly on the timeline
  itself, not just in a hidden tooltip; support toggling label
  position/density if events get crowded together.
- **Different line styles** — let me pick how the timeline's main line
  renders (e.g. solid, dashed, dotted, or a styled/decorative line), plus
  maybe support multiple parallel lines/tracks if I want to compare two
  timelines side by side (e.g. "US history" vs. "world history" in the same
  era) — use your judgment on whether parallel tracks are in scope now or a
  later add; flag your decision.
- Both a horizontal scrolling layout (for on-screen use) and a printable
  layout (which may need to paginate or compress if the timeline is long) —
  flag how you plan to handle long timelines on paper.
- Persist saved timelines via localStorage so a unit's timeline can be
  reopened and edited later.

Ask me clarifying questions about date-precision handling and the parallel-
tracks scope before building.
