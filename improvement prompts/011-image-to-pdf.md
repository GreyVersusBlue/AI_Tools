# Improvement Prompts — 011 — Image → PDF Assembler

**Tool file:** `Tools/011-image-to-pdf.html`
**Support folder:** `Tools/image-to-pdf/`

**Current description (from README):** Combine photos into one clean PDF.

---

## Status

Reviewed — structural read of the source. This tool is considerably more
capable than its one-line README description. Ideas below are deliberately
ambitious and **not** scoped to a single session.

### Pass 2 — Round 1 — 2026-08-10 — session `v19h3x`

- **Automated smoke test (`Tools/image-to-pdf/test/smoke.mjs`).** This tool had
  zero automated coverage before this round — the exact gap Round 3's
  "Challenges" section flagged. Wrote a Playwright-driven suite in the same
  spirit as `Tools/schedule/test/smoke.mjs` but fully self-contained (no
  shared harness file existed to reuse — see below): it opens
  `Tools/011-image-to-pdf.html` over `file://`, feeds it PNG fixtures via
  `#file-input`'s `setInputFiles`, drives the real UI (queue → quality →
  target size → Generate), and asserts on the *downloaded* PDF bytes (a real
  `%PDF-` header, a page count derived by counting `/Type /Page` object
  dictionaries — carefully excluding the root `/Type /Pages` — since no PDF
  parser is vendored) plus zero `console.error`/`pageerror` activity. Three
  scenarios: (1) basic one-per-page generation — 3 images in, 3 pages out; (2)
  an impossible target size (~1 KB) — confirms the retry ladder runs all the
  way to its lowest tier and then *reports failure honestly* rather than
  silently keeping the oversized file; (3) a reachable target — confirms the
  ladder actually stops early with a size-appropriate quality and reports
  success. Scenario (2)/(3) fixtures are synthesized noise PNGs built
  byte-by-byte in `test/make-fixtures.mjs` (xorshift32, no image library) —
  solid-color swatches compress to near-nothing at every quality tier, which
  would make the target-size assertions vacuous (nothing to downgrade *from*).
  Verified the suite actually catches regressions, not just happy-path
  theater, by deliberately breaking (a) the vendored jsPDF `<script src>` path
  and (b) the target-size retry loop's stop condition, confirming both fail
  loudly — then reverted both. `node Tools/image-to-pdf/test/smoke.mjs` (no
  `npm install`; resolves the global Playwright install via
  `createRequire(...).resolve('playwright', {paths:['/opt/node22/lib/node_modules']})`
  since Node's ESM loader, unlike CJS `require`, does not honor `NODE_PATH`).
- **Target output size (Quick Win).** New "Target output size (MB, optional)"
  number input next to Quality, off by default (blank = feature disabled, not
  persisted across sessions on purpose — see Challenges). When set, the
  existing `generatePDF()` was split into `buildAtQuality(ordered, opts,
  qualityMode, progressPrefix)` (the ~150 lines of per-image/page-fit/header-
  footer logic, now parameterized on quality instead of closing over it) plus
  a thin orchestrator that walks a `QUALITY_LADDER` —
  `['original','high','standard','compact','min']`, where `compact`/`min` are
  two new internal-only presets one notch below "Standard" (not exposed in the
  Quality dropdown — see code comment for why) — starting at whatever the user
  picked and stepping only downward, rebuilding the whole PDF at each tier
  until the blob fits the target or the ladder runs out. Always reports the
  outcome in the existing `#msg` banner: "downgraded to X quality to fit the N
  MB target," "within target size (N MB)" if no downgrade was needed, or
  "could not reach the N MB target even at Minimum quality (lowest tried);
  final size N.N MB" if it never fit — never silent. Exposes
  `window.__imgToPdfLastRun = { attempts, targetBytes, targetSizeMB,
  finalQuality }` purely for test/devtools introspection; the UI itself
  doesn't read it.

#### Challenges

- `Tools/schedule/test/smoke.mjs` (referenced by Round 3's notes as the model
  to follow) imports a shared harness at `../../board-check/harness.mjs` —
  that file does not exist in this checkout. Rather than depend on
  infrastructure that may be mid-flight in a sibling workstream, this round's
  test is fully self-contained: its own Playwright resolution, its own
  request-blocking, its own PNG fixture generator. If `board-check/harness.mjs`
  lands later and offers equivalent (or better) `serve`/`launch`/`prepPage`
  helpers, `smoke.mjs` here could be slimmed down to use it — not urgent, the
  current version works standalone.
- The shared design-system stylesheet every tool loads
  (`_ds/industry-.../styles.css`, referenced via `../_ds/...` from
  `011-image-to-pdf.html`) `@import`s Google Fonts over HTTPS. In an
  offline/sandboxed test environment that request fails with
  `net::ERR_CONNECTION_RESET`, which Chromium surfaces as a generic "Failed to
  load resource" console error on *every* page load — nothing to do with this
  tool's own script. Asserting "zero console errors" without accounting for
  it would make the suite permanently red for a pre-existing, site-wide, P5
  gap that lives well outside `Tools/011-image-to-pdf.html` and
  `Tools/image-to-pdf/`. Worked around it two ways in `smoke.mjs`: all
  non-`file://` requests are aborted up front (this tool is supposed to work
  fully offline anyway), and the resulting generic message is filtered out of
  the asserted error list by pattern, while any *other* console error (a real
  thrown exception, an explicit `console.error(err)` from `generatePDF`'s
  catch blocks) still fails the suite. Flagging this here since it's a real
  finding, just not one in scope for this tool's own files to fix — the
  underlying `@import` lives in `Tools/_ds/`.
- Getting the target-size test to be meaningful (not just "any target passes
  trivially") took some thought: this tool's own quality presets only change
  JPEG re-encode quality and a max-dimension cap, and a solid-color test image
  compresses to near-nothing at *every* quality tier — there's no signal to
  detect a real downgrade. Solved by generating a pseudo-random noise PNG
  in-test (`make-fixtures.mjs`), where JPEG quality and downscaling actually
  produce visibly different file sizes, and made the "reachable target"
  scenario self-adapting (target = half of a freshly-measured baseline size)
  rather than a hardcoded MB figure, so the test doesn't quietly rot if
  compression ratios shift with a future jsPDF version or preset tweak.
- Deliberately did **not** persist the target-size input to `localStorage`
  alongside page size/quality/grid density, even though the existing settings
  code makes that a one-line addition. A forgotten target silently downgrading
  every future PDF (long after whoever set it forgot why) seemed like a worse
  surprise than having to re-type "5" occasionally. Worth reconsidering if a
  future round adds a visible "target size is active" indicator elsewhere in
  the UI — persistence would be safer paired with that.

#### Where the next round should pick up

- The retry ladder's `compact`/`min` tiers are new presets invented for this
  feature (`{maxDim:1100,q:0.55}` and `{maxDim:850,q:0.40}`); they haven't
  been validated against a *real* phone photo, only synthetic test fixtures.
  Worth a manual pass with an actual multi-megapixel photo batch to confirm
  "Minimum (auto)" still produces something legible before calling this
  feature fully done.
- Crop/straighten, document-scanner mode, and reorder-by-thumbnail-grid (all
  still open from Round 3) remain the highest-value unbuilt ideas.
- The smoke suite covers the one-per-page path plus both target-size outcomes;
  it does **not** cover contact sheets, SVG input, or the title-page/header/
  caption combination end-to-end (those were manually re-verified by hand this
  round after the `generatePDF()`/`buildAtQuality()` split, and still pass,
  but aren't asserted in `smoke.mjs`). Extending the suite to cover those
  paths — especially contact-sheet page-count math — would be a reasonable
  next increment before adding more features to this file.

### Round 3 (2026-08-10) — shipped

- **Vendored jsPDF (P5).** Copied `Tools/schedule/libs/jspdf/jspdf.umd.min.js`
  (2.5.1, same hash) into `Tools/image-to-pdf/lib/jspdf.umd.min.js` and
  pointed the `<script>` tag at it instead of cdnjs. Added the file to
  `sw.js`'s precache list so offline-first load now works. `031-docx-merger.html`
  and `044-Sub Plan Builder.html` still load JSZip from cdnjs — untouched, still
  open per P5.
- **Page numbers, running header, and a title page.** New "3 · Header, Title
  Page & Page Numbers" card: an optional title page (title, subtitle, dated
  automatically) as PDF page 1, an optional running header printed at the top
  of every content page, and an optional "Page N of M" footer where N/M count
  only the content pages (the title page itself is unnumbered, the
  conventional behavior). Implemented as a post-process pass over
  `pdf.internal.getNumberOfPages()` after the main image loop, since the
  total page count isn't known until generation finishes.
- **Per-image captions.** Each row in the file queue now has a caption text
  input; the caption prints centered under the image on the one-per-page
  path, and under each cell (max 2 lines) on the contact-sheet path. Page/cell
  image-fit math was reworked to reserve space for header/footer/caption
  bands so nothing overlaps — verified visually via a headless Playwright
  screenshot of the actual jsPDF output for both one-per-page and 4-per-page
  grid modes (title page → header/caption/footer page → contact sheet with
  mixed captioned/uncaptioned cells).

### Challenges

- The existing `placedCount` variable was scoped to grid mode only
  ("successfully-embedded images only; skipped ones don't consume a grid
  cell"); reusing it as a universal "did anything actually get embedded?"
  check for the new failure path required also incrementing it on the
  one-per-page branch, which the original code never did. Caught by an actual
  headless run, not by reading the diff — the one-per-page path silently hit
  the new failure message about a third of the way through testing. Worth
  flagging for future rounds: this file has no automated smoke test the way
  `Tools/schedule` does, so a canvas/jsPDF change here is easy to break
  without noticing.
- Grid-mode captions are reserved per-cell globally (if *any* image in the
  batch has a caption, every cell reserves the caption band, whether or not
  that particular image has one) rather than per-image, to keep the grid
  visually even. An uncaptioned image next to a captioned one gets a little
  extra white space at the bottom of its cell instead of a ragged grid.

### Where the next round should pick up

- No automated test harness exists for this tool (contrast with
  `Tools/schedule/test/smoke.mjs`); a small Playwright script that generates
  a PDF and asserts page count / absence of console errors would catch the
  kind of regression described above without a human eyeballing a screenshot.
- Crop/straighten and document-scanner mode (Major Features) are still
  unbuilt and are the highest-value remaining ideas.
- Reorder-by-thumbnail-grid for large batches (list becomes unwieldy past
  ~15-20 files) is still open.

## What it does today

- Add many images (drag-drop), reorder, rotate, remove, clear; sort modes
  including **natural numeric ordering** (`extractLeadingNumber`)
- Page sizes: Letter, Legal, A4, Tabloid, or **match image size**
- Layouts: one image per page, or **contact sheets** at 2 / 4 / 6 / 9 / 12
  per page
- Quality/compression choices (Original / High / Standard) with size
  implications explained
- **SVG support** (`processSVG`, `svgToDataURL`) alongside raster
- Rotation-aware embedding (`rotateForEmbed`), mm-accurate page math
  (`pxToMm`, `clampPageDimsMm`), progress reporting
- Loads `_shared/theme.css` and `_shared/a11y.js`; loads jsPDF from cdnjs

## Quick Wins

- **Done —** **Vendor jsPDF locally** (P5). `Tools/schedule/libs/jspdf/jspdf.umd.min.js`
  is already in the repo — this tool should use it rather than cdnjs. Right
  now the tool is dead on a blocked or offline first load. *(Shipped Round 3
  — copied into `Tools/image-to-pdf/lib/` and added to `sw.js`'s precache
  list.)*
- **Done —** **Page numbers, a header, and a title page** — the difference between a
  stack of photos and a document you can hand in. *(Shipped Round 3 as the
  "Header, Title Page & Page Numbers" card.)*
- **Done —** **Per-image caption**, printed under the image. For a lab photo series or a
  documentation packet this is the whole point. *(Shipped Round 3 — centered
  under the image on one-per-page, under each cell on contact sheets.)*
- **Crop and straighten.** Photos of student work and whiteboards are always
  slightly rotated with desk visible around the edges; a simple crop would
  improve nearly every output.
- **Auto-enhance for whiteboard/document photos** — contrast boost and
  white-balance to make a phone photo of a page legible and ink-cheap. Purely
  canvas math, no libraries.
- **Done —** **Target file size.** "Make this under 5 MB so it can be emailed" is the
  actual constraint teachers hit, and the tool has the compression levers to
  hit it. *(Shipped Pass 2 Round 1 — an optional "Target output size (MB)"
  input that retries generation at progressively lower quality tiers and
  always reports the final outcome, success or honest failure.)*
- **Remember the last session's settings per use case** rather than one global
  preference.

## Major Features

- **Document scanner mode.** Edge detection, perspective correction, grayscale
  thresholding — turning a phone photo of a worksheet into a clean scan. This
  is achievable with canvas math alone and it is the single most-wanted
  capability in this category. It would make the tool the answer to "the
  copier's scanner is broken again."
- **OCR / searchable PDF.** A vendored Tesseract build is large, but a text
  layer would make scanned handouts searchable and, more importantly, make
  student work accessible to a screen reader.
- **Reorder by thumbnail grid**, not a list — with 40 photos the list becomes
  unusable.
- **PDF in, PDF out.** Merge existing PDFs, insert images into one, extract
  pages, rotate pages. Combined with `031-docx-merger.html` this would give the
  site a complete local document-assembly story (P7).
- **Print-shop presets**: two-sided, booklet imposition, saddle-stitch order,
  N-up with cut marks. Booklet imposition in particular is something teachers
  need and no free local tool does well.
- **Student portfolio mode.** Group photos by student name from filenames and
  produce one PDF per student in a single pass.

## Moonshot / North Star

**A local document workshop for a teacher with a phone and a printer.**
Photograph a stack of student work or a set of textbook pages, and get back
clean, straightened, contrast-corrected, correctly-ordered, captioned,
page-numbered PDFs — one combined packet or one per student, sized to email,
optionally imposed as a booklet — without any of it touching a cloud service.

## Platform themes that matter here

- **P5 (offline integrity)** — the cdnjs jsPDF load, with a vendored copy
  already sitting in the repo.
- **P7 (cross-tool)** — a shared PDF layer would serve this tool,
  `031-docx-merger.html`, and every tool that currently prints.
- **P6 (print quality)** — imposition and N-up are print problems in their
  purest form.
- **P12 (memory)** — 40 full-resolution photos in canvas is the site's
  heaviest memory workload; progressive processing matters.

## Open Questions

- Is scanning (perspective correction, thresholding) worth building here, or
  does it deserve its own tool that hands off to this one?
- How large a vendored library is acceptable for OCR, given the site's
  precache-everything service worker?
