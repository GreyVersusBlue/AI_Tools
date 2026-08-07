I'm Devon Moore, a 7th grade Social Studies teacher. I run a small repo called
"East Middle Staff Toolkit" (GitHub Pages site, custom domain via `CNAME`,
publicly known as AsPerMyLessonPlan.com). It's a set of small, single-file
HTML tools for day-to-day classroom logistics — no accounts, no server, no data
leaving the browser. `index.html` at the repo root is the landing page that links
to everything; `README.md` has a table describing each tool.

Conventions already established in this repo (look at existing tools before
building):
- Each tool's entry point is one `.html` file directly under `Tools/`.
- Supporting JS/assets for a tool live in a matching subfolder — this tool
  will likely need one (`Tools/certificate-award-maker/`) for template SVGs/
  fonts and a print/export helper (see `Tools/image-to-pdf.html` and
  `Tools/final-grade-checker/libs/` for the jsPDF pattern already used for
  print-to-PDF export in this repo — reuse jsPDF rather than adding a new
  PDF library).
- Vendor third-party libraries locally — no CDN-only dependencies.
- Update the root `README.md` tools table and `index.html` landing page (plus
  `index.html`'s DEV NOTES items 4/5/6) to link the new tool once it's built.
  Also remove its `.row.soon` placeholder from `index.html`, and its entry
  from `IDEAS_BACKLOG.md` and `ideas-backlog.html`.

## The tool: Certificate & Award Maker

Goal: generate printable certificates/awards for students without opening a
design tool — pick a template, type in details, print or export a PDF.

Requirements:
- **Multiple templates**, and specifically templates that read as appropriate
  for different grade bands (e.g. a more playful/colorful style for younger
  middle schoolers vs. a more formal look for high schoolers) — propose a
  starting set (I'd guess 4-6 templates covering a couple of grade-band looks
  and a couple of general-purpose "generic award" looks) and confirm before
  building them all out.
- **Cool borders** — decorative border art per template (not just a plain
  rectangle), ideally a few border styles to choose from independent of the
  template's color scheme.
- Editable fields: student name (required), award title/reason (e.g. "Most
  Improved," "Perfect Attendance," or freeform text), date, and
  teacher/signature line. Changes should preview live on the certificate.
- Batch mode: let me paste/type a list of names and generate one certificate
  per name (reusing the same template/settings) instead of doing them one at
  a time — useful for whole-class awards like "Completed the Unit."
  Export as a single multi-page PDF.
- Print-friendly output at a standard paper size (letter, landscape likely
  makes sense for a certificate) via the browser print dialog and/or a PDF
  export button (reuse jsPDF, same as Final Grade Checker/Sub Plan Builder).
- No accounts/uploads — all rendering happens client-side.

Ask me clarifying questions about the template set and batch-mode scope
before building anything elaborate.
