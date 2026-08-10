# Improvement Prompts — 049 — Book Tasting Menu Generator

**Tool file:** `Tools/book-tasting-menu-generator.html`
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

Nothing below has been started.

## What it does today

- Add/delete books with title, author, genre, blurb, optional cover image
- Print as a two-column menu (grouped flat, not by genre)
- Print as table tents (mirrored top/bottom halves for fold-and-stand)

## Quick Wins

- **Group the menu by genre** as actual menu "courses" (e.g. "Appetizers:
  Mystery," "Entr&eacute;es: Fantasy") instead of one flat two-column list
  — the backlog explicitly frames this as a restaurant-menu conceit, and
  genre-as-course-name would lean into that harder.
- **Cover images on the menu print**, not just visible in the on-screen
  list — right now covers only show in the editable list, not the printed
  menu or table tents, which is a missed opportunity for a visual browsing
  activity.
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

## Open Questions

- Is genre-as-menu-course purely cosmetic (just a section header) or
  should it change layout (e.g. one genre per printed page/section) —
  the latter is nicer for browsing but uses more paper for a large library.
- Should cover images be required for the table-tent print mode
  specifically (since visual browsing matters more there than in a
  text-forward menu), with a placeholder/blank spot when no image was
  uploaded, or should tents stay text-only unless an image happens to
  exist?
