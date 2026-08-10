# Improvement Prompts — Word Doc Merger

**Tool file:** `Tools/docx-merger.html`
**Support folder:** none — single file (loads JSZip from cdnjs)

**Current description (from README):** Combine multiple Word docs into one, in order.

---

## Status

**2026-08-10 — Round 6 (PR #TBD): P5 fixed, plus three Quick Wins.**

- **Done — Vendor JSZip locally (P5).** cdnjs was unreachable in this
  session's own sandboxed network (blocked by egress policy — the exact
  failure mode this fix exists for), so the file came from the `jszip@3.10.1`
  npm package's `dist/jszip.min.js` instead, which is a byte-identical build
  to what cdnjs served at that version. Vendored to
  `Tools/docx-merger/lib/jszip.min.js` with a README following
  `Tools/image-to-pdf/lib/README.md`'s convention (version, hash, source,
  update instructions). `Sub Plan Builder.html` has the same cdnjs dependency
  and is still unfixed — separate tool, separate round.
- **Done — Preview before merge.** Opening each file's zip once now also
  extracts a short plain-text preview of its first readable content, shown
  under the filename in the list — the "wrong file, wrong order" case the
  Quick Win asked about shows up before merging, not after.
- **Done — Warn on unsupported content.** The same pass scans for headers,
  footers, comments, footnotes, and tracked changes and shows a small ⚠
  badge per file naming what won't carry over, instead of just the existing
  static disclaimer text.
- **Done — Custom heading text per document.** Each row got a "Heading
  text" field (defaults to the filename) feeding the existing
  file-name-as-heading option, instead of always using the raw filename.
- **Not done — per-document page-break/heading toggle, keep-or-normalize
  styles.** Scoped out to keep this round's changes centered on the file
  list (preview/warnings/heading) rather than also reworking the merge
  option model; both are still open below.

Side effect worth knowing about: the old `updatePageEstimate()` reopened
every file's zip on every add/remove to resum page counts. It's now
`scanFiles()`, which only opens zips for files that haven't been scanned yet
and caches pages/preview/warnings on the entry — faster on a re-add, and the
same pass now does three jobs instead of one.

Verified with a hand-built pair of minimal `.docx` files (one with a header,
one without) run through the actual merge in headless Chromium: preview text
extracted correctly for both, the header file got the right warning badge,
the page estimate summed correctly (2+3=5), the custom heading landed in the
merged `word/document.xml`, and the merged file re-opened cleanly with JSZip
to confirm both source texts and the page break were present. No console
errors.

**Where a future round should pick up:** section-aware merging (preserving
per-source page size/orientation via `sectPr`), headers/footers/page numbers
across the merged document, and the packet-builder moonshot are all still
open (Major Features below) — the OOXML groundwork for the first one already
exists in `stripTrailingSectPr`/`createDefaultSectPr`.

Ideas below are deliberately ambitious and are **not** scoped to a single
session.

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

- **Done —** **Vendor JSZip locally** (P5). Same cdnjs dependency as Sub Plan Builder;
  the tool simply fails on a blocked network. *(Sub Plan Builder itself is
  still unfixed — see Status.)*
- **Done —** **Preview before merge.** Even a plain-text extraction of the first lines of
  each document would prevent the "wrong file, wrong order" merge.
- **Per-document options**, not global: page break after *this* one, heading
  for *this* one, skip the first page of *this* one. *(Heading text is now
  per-document — see below. Page-break-after-this-one and skip-first-page
  are still global/unbuilt.)*
- **Done —** **Custom heading text** per document rather than the filename.
- **Keep or normalize styles** as an explicit choice. Merging documents with
  conflicting style definitions is the main way this kind of tool produces
  ugly output, and the user currently has no lever.
- **Done —** **Warn on unsupported content** — embedded images, headers/footers, tracked
  changes, comments, footnotes. Silently dropping content is the worst failure
  mode a merger can have; naming it is most of the fix. *(Images are actually
  carried over already — this warns on headers, footers, comments,
  footnotes, and tracked changes, the things genuinely dropped.)*
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

- **P5 (offline integrity)** — **fixed for this tool** (JSZip vendored,
  Round 6). `Sub Plan Builder.html` has the identical bug, still unfixed.
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
