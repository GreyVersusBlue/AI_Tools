# Improvement Prompts — Image → PDF Assembler

**Tool file:** `Tools/image-to-pdf.html`
**Support folder:** `Tools/image-to-pdf/`

**Current description (from README):** Combine photos into one clean PDF.

---

## Status

Reviewed — structural read of the source. This tool is considerably more
capable than its one-line README description. Ideas below are deliberately
ambitious and **not** scoped to a single session.

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

- **Vendor jsPDF locally** (P5). `Tools/schedule/libs/jspdf/jspdf.umd.min.js`
  is already in the repo — this tool should use it rather than cdnjs. Right
  now the tool is dead on a blocked or offline first load.
- **Page numbers, a header, and a title page** — the difference between a
  stack of photos and a document you can hand in.
- **Per-image caption**, printed under the image. For a lab photo series or a
  documentation packet this is the whole point.
- **Crop and straighten.** Photos of student work and whiteboards are always
  slightly rotated with desk visible around the edges; a simple crop would
  improve nearly every output.
- **Auto-enhance for whiteboard/document photos** — contrast boost and
  white-balance to make a phone photo of a page legible and ink-cheap. Purely
  canvas math, no libraries.
- **Target file size.** "Make this under 5 MB so it can be emailed" is the
  actual constraint teachers hit, and the tool has the compression levers to
  hit it.
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
  pages, rotate pages. Combined with `docx-merger.html` this would give the
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
  `docx-merger.html`, and every tool that currently prints.
- **P6 (print quality)** — imposition and N-up are print problems in their
  purest form.
- **P12 (memory)** — 40 full-resolution photos in canvas is the site's
  heaviest memory workload; progressive processing matters.

## Open Questions

- Is scanning (perspective correction, thresholding) worth building here, or
  does it deserve its own tool that hands off to this one?
- How large a vendored library is acceptable for OCR, given the site's
  precache-everything service worker?
