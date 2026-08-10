# Improvement Prompts — 072 — Story Elements / Plot Diagram Builder

**Tool file:** `Tools/plot-diagram-builder.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** A five-stage plot-mountain diagram (exposition through resolution) alongside a characters/setting/conflict/theme summary, printable or projectable as one shared reference.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog — closes out the English/Language Arts section for now.
Title/author fields, a story-elements summary (characters, setting,
conflict, theme), and the classic five-stage plot mountain (exposition,
rising action, climax, falling action, resolution) — an SVG polyline
background with a positioned, editable textarea at each stage. Everything
autosaves to one localStorage key (`pdb_diagram_v1`), including across a
reload (verified in the smoke test). Print renders the same mountain shape
and stage notes on one page. Verified with a headless Chromium smoke test
(fill fields, print, reload and confirm persistence) — no console errors.

Nothing below has been started. This is a single-current-diagram tool, the
same MVP scope decision made for several other builder tools in this
round (Lab Report Template Builder, Verb Conjugation Reference Poster
Generator, etc.).

## What it does today

- Title/author fields
- Story elements summary: characters, setting, conflict, theme
- Five-stage plot mountain, each stage independently editable
- Print renders the same diagram on one page

## Quick Wins

- **Multiple named saved diagrams**, matching the multi-save convention
  used by most other builder tools in this round — right now one diagram
  per browser, so a class studying two novels back-to-back would overwrite
  the first one's diagram building the second.
- **A live class-discussion mode**: bigger fonts and no visible textarea
  borders in a "presentation" view, versus the current always-editable
  look, since the backlog explicitly calls out projecting this live with a
  class.
- **JSON export/import**, for sharing a completed diagram between class
  periods studying the same novel, or archiving one from a past year.
- **A visual distinction between filled and empty stages** (e.g. a subtle
  highlight) so at a glance a teacher can see which parts of the mountain
  still need class input during a live discussion.

## Major Features

- **Alternate diagram shapes** for non-linear narratives (e.g. a
  circular/cyclical structure, parallel plotlines for a story with two
  protagonists) — the five-stage mountain assumes a classic linear
  Freytag's Pyramid structure, which doesn't fit every novel a class
  studies.
- **Per-chapter/per-section sub-notes** within a stage — right now each
  stage is one free-text box; a novel study spanning many chapters might
  want to log which chapter each plot point happened in.
- **Character arc tracking** layered onto the same diagram — a small
  per-character note at each plot stage (how does this character change
  by the climax vs. the exposition), extending "story elements" into
  something that tracks development over the plot, not just a static
  summary.
- **A class-collaborative fill-in mode** via a share link (this toolkit's
  P3 pattern) — students contribute to the same diagram from their own
  devices during a discussion, instead of one teacher typing at the front.

## Moonshot / North Star

**A plot diagram flexible enough for any narrative structure a class
studies, filled in collaboratively during discussion, and kept as a
searchable record across every novel a class covers in a year.** Alternate
shapes handle non-linear stories the five-stage mountain can't; a
collaborative share-link mode turns "the teacher fills this in" into "the
whole class builds this together"; and multiple named saves mean a year's
worth of novel studies stays organized instead of overwriting itself.

## Platform themes that matter here

- **P3 (share links)** — a collaborative fill-in mode is the single
  biggest opportunity for turning this from a teacher-facing builder into
  an actual class activity tool.
- **P7 (cross-tool)** — multiple named saves and JSON export/import both
  match conventions already established elsewhere in this toolkit.
- **P15 (first run)** — a presentation/discussion mode (bigger text, no
  visible borders) matters more here than on most tools, since this one's
  explicit use case is live projection during class discussion.

## Open Questions

- Is a single alternate "circular/cyclical" shape worth building as a
  second diagram type, or does that add enough UI complexity (shape
  picker, different positioning math) that it's better scoped as its own
  tool sharing this one's story-elements summary component?
- Should character-arc tracking live on this same diagram (adding density
  to an already-busy visual) or as a separate, simpler tool that just
  tracks one character's change across the same five plot stages?
