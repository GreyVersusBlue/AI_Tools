# Improvement Prompts — Cultural Trivia Card Generator

**Tool file:** `Tools/cultural-trivia-card-generator.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** A 30-question built-in bank across Hispanic World, Francophone World, and Global Culture categories, filterable, projected one at a time or printed as matching front/back trivia cards.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from
the Ideas Backlog: a 30-question built-in bank (10 per category:
Hispanic World, Francophone World, Global Culture), a category filter, a
projector display with shuffle/reveal, a printable trivia-card mode that
prints matching front (question) and back (answer) card grids in the same
order — reusing the front/back print pattern from Historical Figure /
Country Trading Card Maker built earlier in this round — and a
teacher-editable custom question bank layered on the built-ins. Custom
questions persist in `localStorage` (`ctcg_custom_v1`). Verified with a
headless Chromium smoke test (default question, reveal, category filter,
print and confirm matching front/back card counts) — no console errors.

Nothing below has been started. Category choice ("Hispanic World" /
"Francophone World" / "Global Culture" rather than naming specific target
languages) was a deliberate scoping decision — see Open Questions.

## What it does today

- 30 built-in trivia questions across 3 categories
- Category filter applies to projector display, print, and bank view
- Projector mode: shuffle, reveal
- Print: matching front/back trivia-card grids
- Custom question bank layered on built-ins

## Quick Wins

- **More categories for other commonly-taught languages** (e.g. German-
  speaking World, Lusophone/Portuguese-speaking World, Sinophone World) —
  the current 3-category split covers only two of the languages most
  commonly taught in U.S. middle schools; adding more is pure content
  work.
- **More built-in questions per category** — 10 each will repeat with
  regular use, the same gap flagged on other bank-based generators built
  this round.
- **Settings persistence** for the category filter and card count, unlike
  most sibling generators built earlier in this round.
- **Hide/disable individual built-ins**, matching the same gap flagged on
  other custom-bank tools in this round.

## Major Features

- **Direct export/feed into Review Game Board**, which the backlog
  explicitly names as a pairing ("feeding into the Quiz / Review Game
  Board") — Review Game Board already imports Category/Points/Question/
  Answer from a spreadsheet; a one-click "download as .xlsx for Review
  Game Board" button would deliver on that named integration instead of
  leaving it as a manual copy-paste.
- **Bulk import a custom bank** from a pasted list, matching the pattern
  proven in Staff Directory Builder, Review Game Board, and Math "Find the
  Mistake" Warm-Up Generator.
- **Difficulty tiers per question** (easy/medium/hard), letting a teacher
  build a review game board with graduated point values straight from
  this bank.
- **Image support per card** (a flag, a landmark photo) for a richer
  printed card, matching the visual richness already built into
  Historical Figure / Country Trading Card Maker.

## Moonshot / North Star

**A cultural trivia bank deep enough across every commonly-taught
language, exportable in one click straight into a review-game point
board.** The Review Game Board export is the most direct, named
integration opportunity in the entire backlog description — closing that
loop turns "print some cards" into "build today's whole-class review game
from the same content, with no retyping."

## Platform themes that matter here

- **P7 (cross-tool)** — the explicit Review Game Board pairing is the
  standout opportunity; bulk import reuses a pattern proven multiple times
  this round.
- **P6 (print quality)** — image support per card is the main print-
  quality gap versus this round's other card-printing tools.
- **P15 (first run)** — settings persistence is the recurring small gap
  versus sibling generators.

## Open Questions

- Should categories be organized by broad cultural region (current
  approach: Hispanic World, Francophone World, Global Culture) or by
  specific country, given "for whatever language you teach" spans many
  programs with very different needs? Region-level categories are easier
  to maintain as a fixed built-in set; per-country tagging scales better
  but needs many more built-in questions to feel populated per country.
- Is a direct .xlsx export matching Review Game Board's exact expected
  column format worth building now, or does that create a maintenance
  dependency between two tools that would need to stay in sync if either
  one's import/column format changes later?
