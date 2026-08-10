# Improvement Prompts — 056 — DBQ / Source Packet Builder

**Tool file:** `Tools/dbq-source-packet-builder.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Add text or image sources with a citation and source-specific guiding questions, plus a shared question set, printed as one packet with a cover page and one source per page.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: a packet title and historical-context/task field, an
editable list of "shared" guiding questions asked after every source, and
a list of sources — each with a title, type toggle (text vs. image),
citation, and its own source-specific guiding questions. An image source
uploads as a data URL and stores locally, the same pattern used in Book
Tasting Menu Generator and Image &rarr; PDF Assembler. Print output is one
packet: a cover page (title, context, name/date line), then one page per
source (auto-lettered Source A, B, C&hellip;) with its citation, body
(text or image), and every applicable question (its own + the shared set)
each with a blank line. Autosaves to `localStorage`
(`dbq_packet_v1`). Verified with a headless Chromium smoke test (fill
context, add a text source, add a second source, print, confirm the right
number of pages and that both source text and shared questions appear) —
no console errors.

Nothing below has been started.

## What it does today

- Packet title, historical context/task
- Shared guiding questions asked of every source
- Sources: text or image, citation, source-specific questions,
  auto-lettered (A, B, C&hellip;)
- Print: cover page + one page per source with all applicable questions

## Quick Wins

- **Reorder sources** via up/down buttons, matching the pattern used
  elsewhere in this toolkit — source order (and therefore lettering)
  is currently fixed by insertion order.
- **A final synthesis/essay prompt field** on the cover page or as a
  closing page — real DBQ packets typically end with an overall essay
  question that ties the sources together, which this MVP doesn't have a
  dedicated spot for (a teacher can currently only put it in the context
  field, mixed with background).
- **Multiple named saved packets**, matching the multi-save convention
  used by most builder tools in this round — one packet per browser right
  now, so a unit with several DBQ activities can't keep them all ready at
  once.
- **Image size/crop control** on upload — right now an uploaded image
  prints at its natural size scaled to page width, which may be too large
  or awkwardly cropped for some source images.

## Major Features

- **Direct integration with Primary Source Analysis Worksheet Generator**,
  which the backlog explicitly names as a pairing — e.g. generate an
  OPTIC/SOAPSTone-style analysis worksheet per source directly from a
  packet, instead of building the two documents independently.
- **A source bank/library**: save individual sources (not whole packets)
  to a personal library, so a source used across multiple DBQ packets
  (e.g. a frequently-cited primary document) doesn't need re-uploading
  and re-captioning every time.
- **JSON export/import**, for sharing a built packet with another social
  studies teacher on the same team or across a department.
- **Difficulty/scaffolding levels per source** — e.g. a vocabulary gloss
  or a simplified-language version alongside the original text, for
  differentiating the same DBQ packet across ability levels.

## Moonshot / North Star

**A DBQ packet builder backed by a reusable source library, tightly
integrated with Primary Source Analysis Worksheet Generator, that produces
differentiated packets for the same source set without rebuilding from
scratch for each ability level.** A source library removes the biggest
recurring cost (re-uploading and re-captioning the same historical
documents across units and years); the Primary Source Analysis
Worksheet Generator integration delivers on the backlog's explicit
pairing; and per-source scaffolding turns one packet into several
appropriately-leveled versions without duplicated authoring work.

## Platform themes that matter here

- **P7 (cross-tool)** — the explicit backlog pairing with Primary Source
  Analysis Worksheet Generator is the clearest opportunity in this tool;
  a source library would also benefit any future tool needing
  reusable historical-document content.
- **P6 (print quality)** — image size/crop control matters here more than
  most tools, since source images vary enormously in size and aspect
  ratio.
- **P15 (first run)** — a source library reduces the single biggest
  recurring cost of using this tool (finding and uploading the same
  sources again and again).

## Open Questions

- Should a source library be scoped per-browser (matching this toolkit's
  local-only philosophy) even though that means it can't be shared between
  a teacher's home and school computers, or is that an acceptable
  trade-off given every other tool in this toolkit makes the same choice?
- Is scaffolding/differentiation worth building as a first-class feature
  here, or does it belong as general guidance (a teacher builds two
  separate packets by hand) given how much source-specific judgment
  "simplify this historical document" actually requires?
