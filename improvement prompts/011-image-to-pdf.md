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

**2026-08-12 — Round 5 (backlog rank 5: whiteboard auto-enhance).** A new
"Clean up photos of a board or a page" control with three settings — **Off**,
**Whiteboard**, and **Worksheet / page** — plus a before/after preview of the
first queued image, so the setting can be judged before a PDF is built. It is
the flat-field correction a document scanner does, in canvas, on the same
canvas the encoder was already going to use:

1. **Estimate the illumination** by drawing the image down to a thumbnail and
   back up, so the writing averages away and what is left is a map of how
   bright each region of the *board* is. Divide by that map to flatten the
   gradient.
2. **Set the black and white points**, with the white point taken from a high
   percentile rather than the maximum, so one glare highlight can't define the
   level for the whole photo.

Whiteboard keeps a gentle black point so red and blue marker survive as
colour; Worksheet pulls harder, since a photo of a printed page wants to come
out as black text on white paper.

**Two real bugs, both found by the suite measuring pixels rather than by
looking at an image:**

- **The blur radius was comparable to a marker stroke.** Downscaling by 24
  makes each map cell about as wide as the writing, so the strokes darkened
  the very cells they sat in — and dividing by a background that already
  contains the ink *brightens the ink*. Measured: writing went from luminance
  29 to 187, the exact opposite of the feature. The map now passes through a
  local **maximum** filter (radius one cell, ~72 source pixels) before being
  scaled up: the board is the bright end of any neighbourhood, so a max is the
  right estimator and an average is not. It costs nothing — the map is tens of
  pixels across.
- **Per-channel normalisation preserved the colour cast.** Dividing red by the
  red mean and blue by the blue mean flattens each channel's gradient but
  leaves the board exactly as warm as it was, because the cast *is* the
  difference between those means. All three channels now normalise to one grey
  target, which is what actually white-balances it.

The PNG passthrough at "Original" quality had to learn about this: it is only
valid while nothing is being changed, so it is skipped when cleanup is on.

Verified with a new 22-assertion headless Chromium suite,
`Tools/image-to-pdf/test/smoke-enhance.mjs` (folded into
`npm run test:image-to-pdf`). It generates a synthetic whiteboard photo — a
left-to-right brightness gradient with a warm cast, and dark strokes at known
positions in both the dim and bright regions — then reads real pixels back out
of the tool's own before/after preview and asserts that both ends of the board
land above luminance 235 and within six levels of each other, that the ink
darkens at both ends, that contrast rises, that the cast is neutralised, and
that red marker is still red. It also generates a PDF with and without cleanup
and asserts the bytes differ, so the pass is proven to run in the pipeline and
not only in the preview. The pre-existing suite still passes unchanged.

**Next round should pick up** a per-image cleanup override — the setting is
currently one answer for the whole queue, and a packet mixing board photos
with ordinary pictures wants it per file, exactly like the Word merger's
per-document options shipped this same round.

**2026-08-13 — Student portfolio mode (Major Features: "Student portfolio
mode").** New "5 · Student Portfolios (optional)" card: a checkbox that, when
on, groups the queued images by student name parsed from each filename,
builds one complete PDF per student (using all the same layout/quality/
header/title-page/caption options already on the page), and bundles every
student's PDF into a single `.zip` download via the newly-vendored
`_shared/vendor/jszip/jszip.min.js` (linked with a plain relative
`<script src>`, same pattern as the existing jsPDF vendoring — no per-tool
copy, nothing from cdnjs).

- **Filename → student name convention (new — nothing existed to match, so
  this one is now the canonical reference for the site):**
  1. Drop the extension.
  2. Strip one trailing run of separator characters (space/underscore/
     hyphen), an optional "page number" word (`pg`, `p`, `page`, `pic`,
     `photo`, `img`, `image`, `scan`), and a digit run — e.g. `_04`,
     `" - pg2"`, `-photo3`. That's the sequence/page-number part of the name.
  3. Turn remaining underscores/hyphens into spaces and collapse whitespace —
     that's the student name.
  4. If nothing is left, what's left is purely numeric, or it matches a short
     list of camera-default/generic tokens (`img`, `dsc`, `dscn`, `photo`,
     `pic`, `picture`, `scan`, `page`, `pg`, `screenshot`, `image`, `pxl`,
     `mvimg` — case-insensitive), the file did **not** carry a student name.
     It is never dropped: every such file is grouped into one shared
     "Unsorted" PDF instead, so a forgotten rename can't silently lose a
     photo. "Unsorted" always sorts last regardless of where the word would
     otherwise fall alphabetically.
  - `extractStudentName`, `groupEntriesByStudent`, `sanitizeForFilename`, and
    `substituteStudentToken` are exposed as `window.__imgToPdfPortfolio` for
    test/devtools introspection, mirroring the existing
    `window.__imgToPdfLastRun` pattern.
  - A live preview under the checkbox lists every group and its image count
    before anything is generated, so a bad rename is visible before the
    student finds out their packet is missing a page.
  - `{student}` in the shared title-page Title or Subtitle is substituted
    (case-insensitively) with each group's actual name, so one title-page
    template personalizes every student's PDF.
  - Target output size, when set, applies **per student PDF**, not to the
    zip as a whole — "keep it emailable" means each kid's file individually.
  - Zip entry names are the sanitized student name + `.pdf`
    (`sanitizeForFilename` strips filesystem-unsafe characters); collisions
    are de-duplicated with a `(2)`, `(3)`, … suffix.
- **Known limitation, not a bug:** a filename that runs two names together
  with no delimiter (`SmithJohn_2.jpg`) comes out as one token
  (`"SmithJohn"`) — there is no dictionary-free way to guess where to split
  it. Documented in the UI's own help text as well as here.
- **Test coverage:** `Tools/image-to-pdf/test/smoke-portfolio.mjs` (50
  assertions, all passing), following `smoke.mjs`'s conventions exactly —
  same browser-launch/network-guard pattern, same "assert on real PDF bytes,
  no vendored PDF parser" approach (`%PDF-` header, `/Type /Page` dict
  counts). Since no zip parser is vendored either, the suite hand-rolls a
  minimal ZIP reader (End Of Central Directory → Central Directory → Local
  File Header, via node's built-in `zlib` for the deflate case) the same way
  `make-fixtures.mjs` hand-rolls PNG chunks. Covers: the parsing/grouping
  helpers directly (including the camera-default, bare-number, and
  run-together edge cases above), an end-to-end run with real files on disk
  named like real student photos (grouped preview text, downloaded zip byte
  signature, exactly 3 entries for 2 students + 1 Unsorted bucket, correct
  page count in each resulting PDF), `{student}` title-page substitution
  reaching the actual generated PDFs, and the filename field's auto-swap
  between `assembled.pdf`/`portfolios.zip` defaults. Run directly with `node
  Tools/image-to-pdf/test/smoke-portfolio.mjs`; **not yet wired into the
  `test:image-to-pdf` npm script** (`package.json` was out of scope for this
  round) — next round should add it there alongside `smoke.mjs` and
  `smoke-enhance.mjs`.
- **Known limitations / next round:**
  - No manual QA pass yet with a real folder of phone-camera photos with
    inconsistent naming (mixed casing, trailing spaces, non-Latin names) —
    only synthetic fixtures and the documented convention have been
    exercised.
  - The portfolio checkbox's state and the zip filename default are
    deliberately **not** persisted to `localStorage`, same reasoning as the
    target-size input (see Pass 2 Round 1 Challenges above): a forgotten
    toggle silently switching every future session into zip-download mode is
    a worse surprise than an unchecked box.
  - No per-student title/subtitle override beyond the shared `{student}`
    template — every student gets the same layout, just a personalized
    title.

## What it does today

- Add many images (drag-drop), reorder, rotate, remove, clear; sort modes
  including **natural numeric ordering** (`extractLeadingNumber`)
- Page sizes: Letter, Legal, A4, Tabloid, or **match image size**
- Layouts: one image per page, or **contact sheets** at 2 / 4 / 6 / 9 / 12
  per page
- Quality/compression choices (Original / High / Standard) with size
  implications explained
- **Whiteboard / worksheet cleanup**: canvas-only flat-field correction that
  evens out the lighting, white-balances, whitens the board or paper and
  darkens the writing, with a before/after preview
- **Student portfolio mode**: group queued images by student name parsed from
  filename, produce one PDF per student, zip them all into a single download
  (`_shared/vendor/jszip/jszip.min.js`)
- **SVG support** (`processSVG`, `svgToDataURL`) alongside raster
- Rotation-aware embedding (`rotateForEmbed`), mm-accurate page math
  (`pxToMm`, `clampPageDimsMm`), progress reporting
- Loads `_shared/theme.css` and `_shared/a11y.js`; jsPDF comes from the
  site-wide `_shared/vendor/` copy (Phase 1b), not from cdnjs

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
- **Done —** **Student portfolio mode.** Group photos by student name from
  filenames and produce one PDF per student in a single pass. *(Shipped
  2026-08-13 — see Status above for the naming convention and known
  limitations; one PDF per parsed student name, unparseable filenames grouped
  into a shared "Unsorted" PDF rather than dropped, all zipped together via
  the newly-vendored `_shared/vendor/jszip/jszip.min.js`.)*

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
