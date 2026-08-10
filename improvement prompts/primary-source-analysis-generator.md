# Improvement Prompts — Primary Source Analysis Worksheet Generator

**Tool file:** `Tools/primary-source-analysis-generator.html`
**Support folder:** none — single file

**Current description (from README):** Builds a printable OPTIC or SOAPSTone worksheet around a described or pasted-in source, with an answer key from your own notes.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session. This is a
social-studies-teacher's tool written by a social studies teacher, and it has
the most room to grow of any content tool on the site.

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

- **More frameworks.** APPARTS, HIPP/HAPP, the NARA document analysis
  worksheets, "See–Think–Wonder", and a Corroboration/Sourcing/Contextualization
  set for historical thinking skills. Each is a small data addition and each
  serves a different grade level or purpose.
- **Source citation block** — author, date, origin, where you found it —
  printed on the worksheet. Modelling citation is half the point of the
  exercise and it's currently absent.
- **Vocabulary / glossary box** for a hard text, since primary sources are
  usually above grade reading level.
- **Reading-support version**: the same source with a summary sidebar, a
  simplified paraphrase field, or line numbers for text references.
- **Line numbering** on pasted text — the single most useful formatting
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
  blank paste. Combined with `blank-map-generator.html`'s Wikimedia search,
  there's a precedent for finding public-domain material in-browser (P7).
- **Student-facing digital version** (P3). A link or QR that opens the source
  and the questions on a student device, with responses staying local — for
  the day the copier is broken.
- **Corroboration exercises.** Two sources on the same event, side by side,
  with "where do they agree, where do they conflict, why" — the actual
  historical thinking skill, and a natural extension of a two-source packet.
- **Timeline and map handoff** (P7). A source has a date and a place;
  `timeline-builder.html` and `blank-map-generator.html` both want them.
- **Answer key with sample student responses**, not just teacher notes — what
  a proficient answer looks like, which is what makes the key useful to a
  substitute or a co-teacher.

## Moonshot / North Star

**Turn any document into a full lesson in ten minutes.** Drop in a source —
text, image, cartoon, map, photograph — pick the analysis framework, and get a
scaffolded student worksheet with line numbers and vocabulary support, a
reading-support variant, a teacher key with sample responses, a multi-source
DBQ packet when you want one, and a student-device version when the copier is
down. With the source's date and place flowing into the class timeline and
map.

## Platform themes that matter here

- **P7 (cross-tool)** — the DBQ builder on the backlog belongs here, and
  timeline/map handoff is natural for social studies.
- **P12 (storage/images)** — uploaded source images base64'd into
  `localStorage`.
- **P6 (print quality)** — line-numbered text, image detail callouts, and a
  worksheet that leaves the right amount of writing space.
- **P3 (share links)** — a student-device version.

## Open Questions

- Should the DBQ builder be built here as a "multi-source" mode, or stay a
  separate backlog tool? Building it here is cheaper and keeps one place to
  look; a separate tool is more discoverable from the landing page.
- Is there a public-domain source library worth shipping (Commons, Library of
  Congress, National Archives are all searchable and free), and does searching
  them in-browser stay within the offline-first constraint the way
  `blank-map-generator.html` handles Commons?
