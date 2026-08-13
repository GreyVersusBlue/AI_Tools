# Improvement Prompts — 072 — Story Elements / Plot Diagram Builder

**Tool file:** `Tools/072-plot-diagram-builder.html`
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

**2026-08-11 — Round 2 (session `4o6xmy`).** Fixed a real bug and shipped
two Quick Wins, verified with a headless Chromium smoke test (including a
dedicated migration test seeding the old single-diagram storage key) with
zero console errors:

- **Fixed a real bug**: the print output built `Characters`/`Setting`/
  `Conflict`/`Theme`/stage fallback text using the literal string
  `'&mdash;'` passed through `escapeHtml()`, which escapes `&` into
  `&amp;` — so an empty field would print the literal text `&mdash;`
  instead of an em dash. This is the exact same bug class flagged in
  `069-pe-warmup-circuit-generator.md`'s Status notes as having recurred
  five times already this round across other tools; this makes six.
  Fixed by using the real Unicode em dash character (—) directly instead
  of the entity name.
- **Multiple named saved diagrams**, following the `list` / `data:<name>`
  / `current` localStorage convention already established in Formula
  Sheet Builder (`Tools/formula-sheet-builder/fsb-store.js`) rather than
  inventing a new shape: a "Saved diagrams" card with a select dropdown
  plus New/Rename/Delete. Existing single-diagram data
  (`pdb_diagram_v1`) is migrated automatically into a first named entry
  the first time the page loads post-update, verified in a dedicated
  smoke test that seeds the legacy key and confirms it survives as a
  named, selectable diagram with no data loss.
- **A visual distinction between filled and empty stages**: a filled
  plot-mountain textarea gets a subtle green-tinted background/border,
  updated live on every keystroke and on diagram switch.

**Where the next round should pick up:** the live class-discussion
presentation mode (bigger fonts, borderless textareas) is the next Quick
Win and matters more here than on most tools given the explicit
live-projection use case (P15); JSON export/import is a natural pairing
with the new multi-save feature (export a named diagram, import it into
another browser/section) and should reuse the diagram-shape validation
the migration code already does. The alternate-shapes and
character-arc-tracking Major Features, and the collaborative share-link
Moonshot, remain fully open — see this file's own Open Questions for the
scoping tradeoffs on both.

**2026-08-13 — Presentation view for discussion (backlog item, shipped).**
Added a "Present" button next to Print diagram: a full-viewport, borderless,
read-only render of the current diagram (title, author, story-elements
summary, and the five-stage plot mountain) in large, high-contrast type for
projecting during a class discussion, built from the same `state` object the
Print view already uses so the two can never drift apart. Exit via a visible
"Exit presentation" button, the Escape key, or the browser's own fullscreen
exit. Implementation follows the projector-mode pattern already established
by Number Talks Board (`Tools/024-number-talks-board.html`): a CSS overlay
(`#presentStage.active`, `position: fixed; inset: 0`) that shows the view in
every browser regardless of Fullscreen API support, with `requestFullscreen()`
layered on top only as a bonus (hides the browser chrome too) where the
browser allows it — so the read-only view isn't gated on fullscreen actually
succeeding. Empty fields render as an em dash (real Unicode character, not
the `&mdash;` entity-name bug fixed in Round 2), matching the Print view's
existing convention. The presentation view intentionally keeps its own
hardcoded dark stage background (`#0c0f16`) independent of the page's
ink/paper palette, the same call Number Talks Board made — legibility from
the back of a room matters more than matching the edit-mode theme, and this
tool has no dark-mode variant of `_shared/theme.css`/`theme-toggle.js` wired
in to match against (it uses the more common `_shared/ink-paper.css` +
`_shared/a11y.js` filter-based dark mode instead, the pattern used by 67 of
this toolkit's tools vs. 5 using `theme.css`); swapping that whole token
system was out of scope for this one feature and not something this pattern
requires. No new files were created — everything is inline in
`Tools/072-plot-diagram-builder.html`, so `sw.js`'s `PRECACHE_URLS` needs no
changes for this round.

Verified with a headless Chromium smoke test (fill every field, enter
Present, confirm the read-only view renders the title/author/story
elements/all five stages and contains zero editable `textarea`/`input`/
`select` elements and exactly one `button` — the exit button — confirm exit
via both Escape and the exit button restores the editable view with data
intact, and confirm a brand-new empty diagram presents cleanly with em-dash
placeholders instead of erroring) — zero console errors, zero offsite
requests. `npm run check:dedupe` still passes.

**Where the next round should pick up:** JSON export/import is the
remaining open Quick Win (a natural pairing with the multi-save feature —
export a named diagram, import it into another browser/section, reusing the
migration code's diagram-shape validation). The alternate-shapes,
per-chapter sub-notes, and character-arc-tracking Major Features, and the
collaborative share-link Moonshot, remain fully open — see this file's Open
Questions for the scoping tradeoffs on the first two.

## What it does today

- Title/author fields
- Story elements summary: characters, setting, conflict, theme
- Five-stage plot mountain, each stage independently editable, with a
  subtle highlight on any stage that has content
- Multiple named saved diagrams (New/Rename/Delete, switch via dropdown),
  with automatic one-time migration of any pre-existing single diagram
- Print renders the same diagram on one page, with a real em dash (not
  literal `&mdash;` text) for any empty field
- **Present mode**: a full-viewport, borderless, read-only, large-type
  render of the current diagram for projecting during a class discussion,
  exited via a button, Escape, or the browser's fullscreen exit

## Quick Wins

- **Done — Multiple named saved diagrams.**
- **Done — A live class-discussion presentation mode**: bigger fonts and
  no visible textarea borders in a "Present" view, versus the current
  always-editable look, since the backlog explicitly calls out projecting
  this live with a class.
- **JSON export/import**, for sharing a completed diagram between class
  periods studying the same novel, or archiving one from a past year.
  *(Still open — natural pairing with the new multi-save feature.)*
- **Done — A visual distinction between filled and empty stages.**

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
