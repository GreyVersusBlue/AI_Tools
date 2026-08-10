# Improvement Prompts — Word Doc Merger

**Tool file:** `Tools/docx-merger.html`
**Support folder:** none — single file (loads JSZip from cdnjs)

**Current description (from README):** Combine multiple Word docs into one, in order.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

Considerably more than the README suggests — this is a genuine OOXML merger,
not a concatenator.

- Add multiple `.docx` files, drag-to-reorder, move up/down, remove, clear all,
  Sort A→Z, Reverse order
- Merges document bodies while **offsetting relationship IDs**
  (`offsetRelIds`), **merging and offsetting numbering definitions**
  (`mergeNumberingNodes`, `offsetNumbering`), copying missing namespaces, and
  updating `[Content_Types].xml` and references
- Optional **page break between documents**, **heading per document**, and a
  generated **table of contents field** (`createTocFieldParagraph`)
- Page-count estimate, progress bar, remembered options
  (`docx-merger-options`)
- Loads `_shared/theme.css` and `_shared/a11y.js` (one of only five tools with
  the theme)

## Quick Wins

- **Vendor JSZip locally** (P5). Same cdnjs dependency as Sub Plan Builder;
  the tool simply fails on a blocked network.
- **Preview before merge.** Even a plain-text extraction of the first lines of
  each document would prevent the "wrong file, wrong order" merge.
- **Per-document options**, not global: page break after *this* one, heading
  for *this* one, skip the first page of *this* one.
- **Custom heading text** per document rather than the filename.
- **Keep or normalize styles** as an explicit choice. Merging documents with
  conflicting style definitions is the main way this kind of tool produces
  ugly output, and the user currently has no lever.
- **Warn on unsupported content** — embedded images, headers/footers, tracked
  changes, comments, footnotes. Silently dropping content is the worst failure
  mode a merger can have; naming it is most of the fix.
- **Remember the last session's file list** (names only) so an accidental
  refresh doesn't lose a 20-file ordering.

## Major Features

- **Section-aware merging.** Preserve each source document's page size,
  orientation, and margins by keeping its `sectPr` — so a landscape rubric
  merged into a portrait packet stays landscape. `stripTrailingSectPr` and
  `createDefaultSectPr` show the groundwork is already understood.
- **Headers, footers, and page numbers** across the merged document — the
  single biggest gap between "merged file" and "packet you can hand out".
- **Split, extract, and reorder pages**, not just merge. The natural sibling
  operations, and there is no free local tool for them.
- **Merge PDFs too, or export the merged result as PDF.** `image-to-pdf.html`
  already vendors/loads jsPDF; a shared PDF layer would let this tool output
  both formats (P7).
- **Packet builder for the toolkit** (P7). The site generates a lot of
  printable documents — rubric, permission slip, sub plan, worksheet, answer
  key. A tool that assembles those into one ordered packet with a cover page
  and a table of contents is more valuable than a generic merger.
- **Cover page generator** with title, class, date, and teacher name.

## Moonshot / North Star

**The packet assembler.** Everything the toolkit prints, plus whatever Word
and PDF files the teacher already has, ordered into one document with a cover
page, a table of contents, consistent page numbering, and correct per-section
orientation — assembled and printed in one pass, entirely in the browser. The
OOXML machinery here is already the hardest part of that and it's already
written.

## Platform themes that matter here

- **P5 (offline integrity)** — the cdnjs JSZip load is a real availability bug.
- **P7 (cross-tool)** — the natural terminal step of many other tools'
  workflows.
- **P6 (print quality)** — headers/footers/page numbers are exactly the shared
  print concerns, expressed in OOXML instead of CSS.
- **P1 (theme)** — already loads `theme.css`; still needs the toggle.

## Open Questions

- How much OOXML fidelity is worth chasing? Images and tables are common;
  tracked changes and footnotes are rare. Worth deciding where the honest
  "not supported, and here's a warning" line sits.
- Is PDF output more useful than .docx output for how these get used?
