# Improvement Prompts — 028 — Primary Source Analysis Worksheet Generator

**Tool file:** `Tools/028-primary-source-analysis-generator.html`
**Support folder:** none — single file

**Current description (from README):** Builds a printable OPTIC or SOAPSTone worksheet around a described or pasted-in source, with an answer key from your own notes.

---

## Status

**2026-08-10 — Round 5 (PR #56): four Quick Wins shipped, plus one
pre-existing bug fixed.** Found that **APPARTS and 5 W's frameworks already
existed** in the source (this file was stale on that point) — this round
added two more: **HIPP** (Historical Context / Intended Audience / Purpose /
Point of View — the AP/IB sourcing framework) and **See-Think-Wonder** (a
visible-thinking routine for younger students or a first look at a visual
source), bringing the total to six frameworks.

- **Done — Source citation block.** Three new optional fields (author/
  creator, date created, where it's from) print as a single italic citation
  line under the source box — modeling real citation practice, which was
  entirely absent before.
- **Done — Line numbering.** A checkbox switches the pasted source text from
  a plain block to a numbered-gutter layout (one number per line), so a
  class can reference "line 12" when discussing a document together.
- **Done — Vocabulary / glossary box.** A new textarea (same tolerant
  `word: definition` parsing used elsewhere on the site, e.g.
  `027-novel-study-circles-manager.html`'s vocab log) renders a small glossary
  box under the source.
- **Fixed — stale framework whitelist.** `isPlausibleWorksheet()` (the import
  validator) only accepted `framework === 'optic' || 'soapstone'`, silently
  rejecting valid exports using the already-shipped APPARTS/5 W's frameworks
  (and would have rejected HIPP/STW too). Now checks membership in the live
  `FRAMEWORKS` object instead of a hardcoded pair.

Verified with a headless Chromium smoke test: citation line, numbered-line
source text, and vocab box all render correctly together; all six framework
radio options present; HIPP and See-Think-Wonder both render their real step
labels and questions when selected. No console errors.

**Where a future round should pick up:** the DBQ / multi-source packet idea
(Major Features below) is the single biggest lever left in this tool and is
untouched — this round deliberately stayed inside the single-source shape
rather than take on that larger restructuring. Reading-support variant,
image cropping/zoom, a source library, and projected analysis mode are also
all still open.

Ideas below are deliberately ambitious and are **not** scoped to a single
session. This is a social-studies-teacher's tool written by a social studies
teacher, and it has the most room to grow of any content tool on the site.

## What it does today

- **Framework picker** (`renderFrameworkPicker`) — OPTIC / SOAPSTone
  scaffolds, with per-step blocks (`stepBlockHtml`)
- Source block: pasted text, a description, or an **uploaded image**
  (`sourceBlockHtml`, `buildSourceTypeSelect`)
- **Teacher notes per step** (`renderNotesEditor`) that become an answer key
- Configurable answer line counts (`answerLineCount`)
- Print **student worksheet (blank)** and **answer key (with notes)**
  separately
- Saved worksheets (`gvb-primary-source:list` / `:current`) with
  import/export and validation (`isPlausibleWorksheet`)

## Quick Wins

- **Partly done.** **More frameworks.** APPARTS and 5 W's already existed (this file
  was stale — they were built in an earlier round not reflected here); HIPP
  and See-Think-Wonder shipped this round. Still open: the NARA document
  analysis worksheets and a dedicated Corroboration/Sourcing/Contextualization
  set for historical thinking skills.
- **Done —** **Source citation block** — author, date, origin, where you found it —
  printed on the worksheet. Modelling citation is half the point of the
  exercise and it's currently absent.
- **Done —** **Vocabulary / glossary box** for a hard text, since primary sources are
  usually above grade reading level.
- **Reading-support version**: the same source with a summary sidebar, a
  simplified paraphrase field, or line numbers for text references.
- **Done —** **Line numbering** on pasted text — the single most useful formatting
  feature for discussing a document with a class.
- **Image cropping and zoom** for the uploaded source, plus a
  "detail callout" that prints an enlarged region next to the whole image.
- **Downscale and warn on image size** (P12).

## Major Features

- **Multi-source packets (DBQ).** `IDEAS_BACKLOG.md` lists a DBQ / Source
  Packet Builder as a separate tool; it is this tool with several sources and
  a shared set of guiding questions plus a synthesis prompt. Building it here
  is far less work than building it separately, and this tool's framework
  machinery is exactly what it needs.
- **A source library.** Shipped or teacher-built collections of frequently-used
  sources by unit, so building a worksheet starts from a source rather than a
  blank paste. Combined with `046-blank-map-generator.html`'s Wikimedia search,
  there's a precedent for finding public-domain material in-browser (P7).
- **Projected analysis mode.** The source shown large with the framework's
  questions revealed one at a time, for working through a document together
  as a class — the no-copier fallback, driven from the teacher's machine.
- **Corroboration exercises.** Two sources on the same event, side by side,
  with "where do they agree, where do they conflict, why" — the actual
  historical thinking skill, and a natural extension of a two-source packet.
- **Timeline and map handoff** (P7). A source has a date and a place;
  `015-timeline-builder.html` and `046-blank-map-generator.html` both want them.
- **Answer key with sample student responses**, not just teacher notes — what
  a proficient answer looks like, which is what makes the key useful to a
  substitute or a co-teacher.

## Moonshot / North Star

**Turn any document into a full lesson in ten minutes.** Drop in a source —
text, image, cartoon, map, photograph — pick the analysis framework, and get a
scaffolded student worksheet with line numbers and vocabulary support, a
reading-support variant, a teacher key with sample responses, a multi-source
DBQ packet when you want one, and a projected walk-through version for the day
the copier is down. With the source's date and place flowing into the class
timeline and map.

## Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see `_platform-themes.md`). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Student-device worksheet.** A link or QR opening the source and questions
  on a student device with responses staying local. The projected analysis
  mode above covers the no-copier case.

## Platform themes that matter here

- **P7 (cross-tool)** — the DBQ builder on the backlog belongs here, and
  timeline/map handoff is natural for social studies.
- **P12 (storage/images)** — uploaded source images base64'd into
  `localStorage`.
- **P6 (print quality)** — line-numbered text, image detail callouts, and a
  worksheet that leaves the right amount of writing space.
- **P3 (share links)** — sharing a worksheet with a colleague or a co-teacher.

## Open Questions

- Should the DBQ builder be built here as a "multi-source" mode, or stay a
  separate backlog tool? Building it here is cheaper and keeps one place to
  look; a separate tool is more discoverable from the landing page.
- Is there a public-domain source library worth shipping (Commons, Library of
  Congress, National Archives are all searchable and free), and does searching
  them in-browser stay within the offline-first constraint the way
  `046-blank-map-generator.html` handles Commons?
