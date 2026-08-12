# Improvement Prompts — 075 — Staff Directory / Quick-Reference Builder

**Tool file:** `Tools/075-staff-directory-builder.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Add staff one at a time or paste a whole list from a spreadsheet, sort and search, print a clean one-page directory (name, room, extension, subject) for the workroom wall or a new teacher's binder.

---

## Status

**2026-08-12 — session `r8kq4t`.** Shipped the Quick Win the previous round
listed and skipped: **group by department**, on screen and in print.

- A checkbox in the directory toolbar, off by default — the flat list is what
  this tool has always been and a teacher who wants it should keep it. The
  choice persists.
- **Where the preference lives mattered more than the feature.**
  `sdb_directory_v1` holds a bare array of people, and that array is exactly
  what Export JSON writes and Import reads. Wrapping it in an object to make
  room for one checkbox would have broken every file a teacher has already
  exported, so the preference went into its own `sdb_prefs_v1` instead. The
  suite asserts the directory key is still a bare array afterwards.
- **Three things a naive grouping gets wrong, all handled:**
  - *The people with no department.* They get a block of their own at the
    end, labelled, rather than being dropped. A directory that quietly hides
    the four staff whose Subject column is blank is how a substitute ends up
    with no phone number.
  - *The same department typed twice.* "Science" and "science", entered a year
    apart, are one department; splitting them into two blocks would be a worse
    answer than not grouping at all. Keys are case-insensitive.
  - *Which spelling to show.* The obvious rule — first one seen — makes the
    heading change when the teacher sorts by room, which reads like a bug.
    `departmentLabels()` picks the spelling used by the most people, ties
    going to whoever was added first, and computes both from the full
    `people` list rather than the filtered view, so a heading never moves
    because of a search or a sort.
- **The print path is a separate renderer and is the one that matters** — the
  page goes on the workroom wall. Grouped, it drops the Subject column (it
  would repeat the heading on every row) and gives the width back to name and
  room, counts the departments in the subtitle, prints headings in grey rather
  than colour for a black-and-white workroom printer, and carries
  `page-break-after: avoid` so a heading is never stranded at the foot of a
  page.
- **New suite:** `Tools/staff-directory-builder/test/smoke-departments.mjs`,
  28 checks, wired into `npm test` and `npm run test:staff-directory` — the
  first automated coverage this tool has had.

**Where the next round should pick up:** grouping makes the wallet-card /
lanyard print layout (still on the ranked backlog) more useful than it was —
a per-department card is a realistic thing to hand somebody. The other
untouched Quick Win, "copy as plain text", is now a five-line job that should
respect the same grouping.

**2026-08-10 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: an add-one-row form, a paste-a-whole-list bulk importer
(tab- or comma-separated), an inline-editable sortable/searchable table, and
a one-page print view. Single directory, autosaved to localStorage
(`sdb_directory_v1`). Verified with a headless Chromium smoke test (single
add, bulk add, column sort) — no console errors.

This was deliberately the minimum useful version at first build.

**2026-08-11 — Round (session `b4zswl`).** Shipped two of the five Quick
Wins — the two the file itself flagged as most important ("risky for
something meant to last all year" and "doubles every row silently"):
(1) **CSV and JSON export/import.** Export writes either a CSV (name,
room, ext, subject — quoted per RFC4180 where a field contains a comma,
quote, or newline) or a full JSON dump (including ids) via a downloaded
`Blob`; Import accepts either format back (sniffed by file extension, then
by content — a leading `[`/`{` is treated as JSON), with a hand-rolled
quoted-field CSV line parser (no library) and a header-row skip when the
first line starts with `name,`. (2) **Duplicate-detection on bulk paste**
(and reused for CSV import) — a pasted or imported row is skipped, not
added twice, if a person with the same name and room (case-insensitive)
already exists; the bulk-add and import handlers report "Added N, skipped
M duplicates" so nothing silently vanishes without the teacher knowing.
Single-row add via the form is intentionally left duplicate-check-free —
a teacher retyping an existing name into the one-at-a-time form is a
deliberate edit, not an accidental double-paste. Did not attempt photo
column, department grouping, or "copy as plain text" this round — see
Open Questions. Verified with a headless Chromium/Playwright smoke test:
bulk-pasted 3 rows (one an intentional duplicate) and confirmed "Added 2,
skipped 1 duplicate"; exported CSV and JSON and confirmed both files'
contents; cleared the directory and re-imported the exported CSV,
confirming both rows came back and the header row was skipped correctly —
zero console errors. `node --check` passed on both inline scripts.

## What it does today

- Add one person via a form, or paste many at once (spreadsheet columns) —
  bulk paste skips duplicates (same name + room) and reports how many were
  added vs. skipped
- Inline-editable table: click into any cell to fix a typo in place
- Sort by clicking any column header (name/room/ext/subject), search across
  all fields
- **Group by department** (optional, persisted): sub-headers with a per-block
  headcount on screen and in print, the unassigned staff in a block of their
  own at the end, and case-variant spellings of the same department collapsed
  into one block
- Export the directory as CSV or JSON; import either format back in
  (with the same duplicate-skip behavior as bulk paste)
- Print a clean table sized for one page

## Quick Wins

- **Photo column** (optional headshot per person) for a "who is that" wall
  reference, not just a phone-book.
- **Done — 2026-08-12.** **Group/sub-header by department** in both the
  on-screen table and the print view (Math staff together, then Science, etc.)
  instead of one flat alphabetical list. *(See Status.)*
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
- Next round: department grouping is probably the highest-value remaining
  Quick Win — it touches both the on-screen table and the print view, so
  it's a bit bigger than "photo column" or "copy as plain text," but it's
  the one the file's own Moonshot section leans on most.
