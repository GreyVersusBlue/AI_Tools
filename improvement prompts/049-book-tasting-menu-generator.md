# Improvement Prompts — 049 — Book Tasting Menu Generator

**Tool file:** `Tools/049-book-tasting-menu-generator.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Add books with title, author, genre, blurb, and an optional cover image, then print a two-column menu or fold-in-half table tents.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: a form to add books (title, author, genre, blurb, optional
cover image via file upload stored as a data URL, following the same
local-only pattern as Image &rarr; PDF Assembler), an editable list with
delete, and two print modes — a two-column restaurant-style menu, and
table tents (each book printed twice per card, the top half rotated 180&deg;
so the card reads correctly from either side once folded and stood up).
Books persist in `localStorage` (`btmg_books_v1`). Verified with a headless
Chromium smoke test (add two books, print as menu, switch to table tents,
print again) — no console errors.

**2026-08-11 — Pass 2, directed round (session `szyio3`).** Shipped two
Quick Wins: the printed **menu is now grouped by genre as actual menu
"courses"** (a genre header per section, purely cosmetic — same flat
two-column layout inside each section, not a page-per-genre split), and
**cover images now appear in both print modes**, not just the on-screen
editable list — a small thumbnail next to each menu entry and a larger one
above each table-tent half. Books with no genre fall into a "More
Selections" section rather than being dropped. Verified with a headless
Chromium pass: four books across two genres plus one with no genre, printed
as menu (confirmed 3 course headers, correct book-per-course counts) and as
table tents — no console errors.

Nothing else below has been started.

## What it does today

- Add/delete books with title, author, genre, blurb, optional cover image
- Print as a two-column menu (grouped flat, not by genre)
- Print as table tents (mirrored top/bottom halves for fold-and-stand)

## Quick Wins

- ~~Group the menu by genre~~ — **shipped 2026-08-11** as a plain genre
  header per section (cosmetic grouping, not a page-per-genre split — see
  the Open Question below on whether that's the right call long-term).
- ~~Cover images on the menu print~~ — **shipped 2026-08-11**, in both the
  menu and table-tent print modes.
- **Reorder books** (drag or up/down buttons) so the print order can match
  a deliberate table arrangement instead of insertion order.
- **A student response slip** alongside the menu (small "my first course
  choice: ___, second choice: ___" card) to close the loop on the actual
  activity outcome, not just the browsing material.

## Major Features

- **CSV/spreadsheet import** for a whole list of books at once (title,
  author, genre, blurb columns), matching the bulk-import pattern already
  used in Staff Directory Builder and Review Game Board — typing books one
  at a time doesn't scale to a real classroom library cart.
- **QR code per book linking to a longer review/trailer/Goodreads-style
  page**, reusing this toolkit's QR Code Generator pattern, for browsing
  beyond the blurb.
- **Multiple named saved menus** (e.g. "Fall Book Tasting" vs "Spring Book
  Tasting"), matching the multi-save convention used elsewhere in this
  toolkit — right now it's one flat list per browser.
- **A genre-balance check**: warn if one genre dominates the list, useful
  for a teacher trying to build a deliberately varied tasting menu.

## Moonshot / North Star

**A book tasting that runs itself: genre-grouped like a real menu, covers
visible on the printed page, imported in bulk from a library cart list,
and closing with a response slip that captures what a class actually
picked.** Genre grouping and visible cover art turn this from "a list of
blurbs" into something that actually reads like a menu; bulk import removes
the biggest friction point (retyping an entire cart of books); and a
response slip gives the activity a measurable outcome.

## Platform themes that matter here

- **P7 (cross-tool)** — bulk import (Staff Directory Builder pattern) and
  QR-to-review-page (QR Code Generator pattern) are both directly
  transferable.
- **P6 (print quality)** — covers-on-print and genre grouping are pure
  print-layout work on an already-functional base.
- **P15 (first run)** — bulk import is the single highest-leverage
  friction reduction for a teacher setting this up for the first time with
  a real classroom library.

**Where the next round should pick up:** reorder books (up/down buttons,
same pattern used in 048/050/052 this round) is the cheapest remaining
Quick Win; CSV/spreadsheet bulk import under Major Features is the highest-
leverage item for a teacher with a real classroom library cart.

## Open Questions

- Is genre-as-menu-course purely cosmetic (just a section header) or
  should it change layout (e.g. one genre per printed page/section) —
  the latter is nicer for browsing but uses more paper for a large library.
  **2026-08-11 note:** shipped this round as purely cosmetic (a header only,
  no layout/page change), the lower-risk of the two options; revisit if a
  future round wants the page-per-genre version.
- Should cover images be required for the table-tent print mode
  specifically (since visual browsing matters more there than in a
  text-forward menu), with a placeholder/blank spot when no image was
  uploaded, or should tents stay text-only unless an image happens to
  exist?
