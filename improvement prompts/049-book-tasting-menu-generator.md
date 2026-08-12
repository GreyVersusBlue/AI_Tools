# Improvement Prompts — 049 — Book Tasting Menu Generator

**Tool file:** `Tools/049-book-tasting-menu-generator.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Add books with title, author, genre, blurb, and an optional cover image, then print a two-column menu or fold-in-half table tents.

---

## Status

**2026-08-12 — Backlog round: printable tasting response slips shipped
(backlog rank 8).** A third print mode ("Print response slips") alongside
menu and table tents. Each slip is a half-sheet (two per page, dashed cut
line) a student fills in as they taste: a name/class/date line, a table
with one row per course — the row labels are "First course", "Second
course", … and, where the menu has genres, each row carries the matching
genre name in order, so the slip mirrors the printed menu's course
headings — with write-in columns for the book tasted and first
impressions, a circle-a-number 1–5 rating, a Y/N "read more?", and a
"book I most want to check out" line at the bottom. Selecting the slips
tab reveals a small options card: courses per slip (rows, defaulting to
the menu's genre count clamped 3–8) and number of slips to print
(default 10, max 40), persisted under a new `btmg_slips_v1` key — the
books key is untouched, so no migration needed. Slips can print even with
an empty book list (the slip is generic by design — students write titles
in). Verified with a headless Chromium test: options card shows/hides
with the tab, genre-derived default rounds, six slips × four rows print
with ordinals and genre labels, settings persist across reload, and the
existing menu print still renders — zero console errors. Next round:
reorder books and CSV import (its own backlog row) are the open ideas.

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

**2026-08-11 — Round 1 (session `8vo65u`).** Shipped two of the four Quick
Wins. Menu print now groups books into genre-named sections (a
`<h2 class="menu-course-heading">` per genre, with its own two-column
sub-layout) instead of one flat two-column list across the whole
collection — resolving the "cosmetic vs layout" open question in favor of
layout: each genre gets its own section rather than just a label prefix,
since it reads more like an actual menu that way. Books with no genre set
land in a "More Books" section rather than being dropped. Cover images
now render in both print modes — a small thumbnail beside each menu entry,
and a larger one above the title on each table-tent half — not just in
the on-screen editable list as before. Verified with a headless Chromium
smoke test: added 3 books across 2 genres, printed as menu, confirmed both
genre headings appear and the right book count lands under each — no
console errors.

Reorder books and the response slip Quick Wins were not built this round
— see "Where the next round should pick up" below.

## What it does today

- Add/delete books with title, author, genre, blurb, optional cover image
- Print as a **genre-grouped menu** (each genre its own "course" section)
  with cover thumbnails
- Print as table tents (mirrored top/bottom halves for fold-and-stand),
  now including the cover image
- Print **tasting response slips**: half-sheet per-student rating slips,
  one row per course (labels mirror the menu's genre courses), with a 1–5
  circle rating, Y/N "read more?", and a "most want to check out" line;
  rows/copies configurable and persisted (`btmg_slips_v1`)

## Quick Wins

- **Reorder books** (drag or up/down buttons) so the print order can match
  a deliberate table arrangement instead of insertion order — also useful
  now for controlling which order genre sections print in, since that's
  currently first-appearance order.
- **Done — 2026-08-12.** **A student response slip** alongside the menu, to
  close the loop on the actual activity outcome. *(Shipped as the third
  print mode — see Status.)*

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

- ~~Is genre-as-menu-course purely cosmetic (just a section header) or
  should it change layout~~ **Resolved in Round 1**: each genre gets its
  own section with a heading, not just a label prefix — no page-per-genre
  split, since that seemed like too much paper for a small library, but
  worth revisiting if a future round hears otherwise from real use.
- Should cover images be required for the table-tent print mode
  specifically (since visual browsing matters more there than in a
  text-forward menu), with a placeholder/blank spot when no image was
  uploaded, or should tents stay text-only unless an image happens to
  exist? **Still open** — Round 1 just renders the cover when one exists
  and shows nothing when it doesn't, no placeholder.

## Where the next round should pick up

Reorder books is the natural next step, doubling as genre-section
ordering control now that the print output is grouped. After that, CSV
import (Major Features) is flagged as the single highest-leverage item
for a teacher's first real setup with a full classroom library cart.
