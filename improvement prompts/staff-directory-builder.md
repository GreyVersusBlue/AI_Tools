# Improvement Prompts — Staff Directory / Quick-Reference Builder

**Tool file:** `Tools/staff-directory-builder.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Add staff one at a time or paste a whole list from a spreadsheet, sort and search, print a clean one-page directory (name, room, extension, subject) for the workroom wall or a new teacher's binder.

---

## Status

**2026-08-10 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: an add-one-row form, a paste-a-whole-list bulk importer
(tab- or comma-separated), an inline-editable sortable/searchable table, and
a one-page print view. Single directory, autosaved to localStorage
(`sdb_directory_v1`). Verified with a headless Chromium smoke test (single
add, bulk add, column sort) — no console errors.

Nothing below has been started — this is deliberately the minimum useful
version.

## What it does today

- Add one person via a form, or paste many at once (spreadsheet columns)
- Inline-editable table: click into any cell to fix a typo in place
- Sort by clicking any column header (name/room/ext/subject), search across
  all fields
- Print a clean table sized for one page

## Quick Wins

- **CSV/JSON export and import**, matching the pattern most other builder
  tools in this toolkit already have (Formula Sheet Builder, Rubric
  Builder) — right now there's no way to get a directory out of the browser
  at all, which is risky for something meant to last all year.
- **Photo column** (optional headshot per person) for a "who is that" wall
  reference, not just a phone-book.
- **Group/sub-header by department** in both the on-screen table and the
  print view (Math staff together, then Science, etc.) instead of one flat
  alphabetical list.
- **Duplicate-detection on bulk paste** — pasting the same list twice right
  now just doubles every row silently.
- **"Copy as plain text" button** for pasting a quick phone list into an
  email without needing to print first.

## Major Features

- **Multiple saved directories** (e.g. "Teaching Staff" vs "Support Staff"
  vs "Front Office"), the way Formula Sheet Builder and Rubric Builder
  support multiple named saves — right now it's a single flat list for the
  whole building.
- **QR code per entry linking to an extension-dial or email**, printed next
  to the row, for a phone-mounted or wall-mounted quick-reference version —
  a natural pairing with this site's existing QR Code Generator/Gallery
  Walk QR patterns.
- **Wallet-card / lanyard-insert print layout** as an alternate to the
  full-page table, for a personal quick-reference card instead of a
  workroom wall poster.
- **Import from the shared roster system** other tools use (Class Roster
  Hub's storage), if staff lists ever get maintained there — though staff
  and student rosters are different enough this may not be worth forcing
  together.

## Moonshot / North Star

**The one directory a school actually keeps up to date, because updating it
is as easy as fixing a typo in a spreadsheet cell.** Multiple views from one
data set — printable wall poster, personal wallet card, searchable on-screen
list, exportable spreadsheet — so it's worth maintaining once instead of
retyping into three different formats every August.

## Platform themes that matter here

- **P6 (print quality)** — the wallet-card and department-grouped layouts
  are print-format work on top of an already-functional table.
- **P15 (first run)** — the bulk-paste importer already lowers first-run
  friction a lot; export/import would close the loop for reuse next year.
- **P7 (cross-tool)** — QR-per-entry connects naturally to QR Code
  Generator/Gallery Walk QR's existing batch-QR code.

## Open Questions

- Is a single flat directory the right default, or should "departments as
  separate saved lists" be the starting shape given how differently a math
  department list and a whole-building directory get used?
- Worth reusing the shared roster storage pattern at all for staff, or is
  keeping this fully separate from student-roster tools (Name Picker, Class
  Roster Hub) the right call given they serve different audiences?
