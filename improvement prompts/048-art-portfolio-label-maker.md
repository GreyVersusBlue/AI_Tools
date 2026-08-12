# Improvement Prompts — 048 — Student Art Portfolio Label & QR Tag Maker

**Tool file:** `Tools/048-art-portfolio-label-maker.html`
**Support folder:** `Tools/art-portfolio-label-maker/test/` — test suite only.
(The QR encoder used to live here as `lib/qrcode.js`; Phase 1b of
`REFACTOR_PLAN.md` moved it to the single site-wide copy at
`_shared/vendor/qrcode/qrcode.js`, which is what the tool loads today.)

**Current description (from README):** Add a title, photo, and artist
statement per piece; print portfolio labels with a thumbnail and a QR code
carrying the statement text itself, no hosting needed.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from
the Ideas Backlog. Per-entry title, optional photo upload (stored as a
data URL, shown as a thumbnail on both the on-screen preview and the
printed label), and an artist-statement textarea. The key design call:
since this is a static, server-less site there's nowhere to host a photo
or description for a QR code to *link to* — so the QR code instead
encodes the statement text directly, decodable offline by any QR scanner
with no network round-trip. A blank statement simply prints the label
without a QR code rather than encoding an empty/meaningless code. Paste-
list bulk import (title + statement per line, tab or comma separated) is
included, matching the convention used across this round's builder
tools. Autosaves to `localStorage` (`apl_portfolio_v1`).

Caught one bug during smoke testing: a truncated-description preview
originally passed the HTML entity string `'&hellip;'` through
`escapeHtml()`, which would have double-escaped it into the literal text
"&hellip;" instead of an ellipsis character — this is the same entity-
in-JS-string bug class that showed up four times elsewhere this round.
Fixed by appending a literal `…` character after escaping instead of
before. Verified with a headless Chromium smoke test: three entries (one
with an uploaded photo, all three with statements), confirmed all three
QR canvases render and encode correctly, confirmed print output includes
the photo `<img>` tag and matching QR canvases, confirmed a title-only
entry with no statement correctly shows "no QR" instead of an empty
code, and confirmed deleting the last remaining entry falls back to one
blank row rather than an empty list — no console errors.

**2026-08-11 — Round 1 (session `8vo65u`).** Shipped two of the four Quick
Wins. Reorder entries via up/down buttons (each entry row gained a small
move column, matching the up/down pattern used elsewhere in the toolkit) —
disabled at the top/bottom of the list rather than wrapping. Character-
count warning near the artist statement textarea: shows a live count as
you type, turning red past 220 characters with a note that long
statements make a denser, harder-to-scan QR code — the count updates on
every keystroke without a full re-render so the textarea doesn't lose
focus. Verified with a headless Chromium smoke test: added 3 entries,
moved the first one down and confirmed the fields actually swapped, typed
a 250-character statement into an entry and confirmed the live counter
shows "250 characters" with the warning style applied — no console
errors.

Named/multiple saved portfolios and the roster-bulk-add Quick Win were
not built this round — see "Where the next round should pick up" below.

**2026-08-11 — Round 2 (session `szyio3`), layered on Round 1 above.**
Shipped the remaining named/multiple saved portfolios Quick Win this note
flagged as the natural next step: a portfolio selector with New/Duplicate/
Rename/Delete, each saved portfolio holding its own title, entries,
labels-per-page, and QR error-correction setting. The old single-portfolio
save under `apl_portfolio_v1` migrates automatically into the first entry
of the new `apl_portfolios_v1` store. Built directly on top of Round 1's
reorder buttons and character-count warning (both preserved and re-verified
working together) rather than independently — an earlier attempt to merge
this session's and `8vo65u`'s branches via git's automatic 3-way merge
silently duplicated the reorder buttons and click handlers instead of
combining them cleanly, so the file was rebuilt from `8vo65u`'s merged
main state with this session's portfolio-save layer re-applied by hand
instead of trusting the auto-merge. Verified with a headless Chromium
pass: added a long statement and confirmed the character-count warning
still fires, reordered two entries and confirmed exactly one up-button per
row (not duplicated), created/duplicated/deleted a portfolio, switched
back and confirmed the reordered entries persisted — no console errors.

**2026-08-12 — Round 3 (backlog rank 8: class reference sheet print).** A
second print button, **Print class reference sheet**, emits one compact table
of every piece in the portfolio — number, title, artist, and the *whole*
artist statement. No photos, no codes: it is the teacher's record and the
gallery-signage copy, and it has to fit on a page or two. This is genuinely
something the labels cannot do, because a label truncates the statement to 90
characters.

**It needed an artist field first.** The artist used to be folded into the
title by convention — the placeholder literally read "Self-Portrait — Ava R."
— so there was no attribution to put in a column. Entries now carry an
`artist` string, shown on the label preview, printed under the title on the
label itself, and given its own column on the sheet. `normalize()` fills it in
as an empty string on every existing entry, and **no attempt is made to split
an existing title on the em dash**: guessing a teacher's data apart on a
punctuation heuristic would quietly mangle a title like "Study — after
Hokusai".

Two details worth carrying forward:

- **Bulk import treats tabs and commas differently now.** A tab-separated
  paste with three columns is read as title / artist / statement, because a
  spreadsheet's column boundaries are unambiguous. A comma line still splits
  on its *first* comma only — a statement is prose and is full of commas, and
  reading a second one as a field boundary would silently eat half of it.
- **One print area, two documents.** The labels grid and the reference sheet
  share `#printArea`, switched by a `mode-labels` / `mode-sheet` class that
  the print stylesheet uses to hide the other one. The failure this guards
  against is a stray page of labels appearing inside a printed reference
  sheet; the suite asserts the class that is actually in place at the moment
  `window.print()` is called, not just afterwards.

Verified with a new 21-assertion headless Chromium suite,
`Tools/art-portfolio-label-maker/test/smoke-reference-sheet.mjs`
(`npm run test:art-portfolio`) — the full statement on the sheet against the
truncated one on the label, the mode switch at print time, the artist reaching
storage and both outputs, both import paths, and a portfolio saved before the
artist field existed opening and printing unchanged. No console errors.

**Noticed but not fixed:** an untouched blank portfolio counts as one valid
entry, because `validEntries()` defaults a missing title to "Entry 1" — so the
preview claims "1 label ready" and both print buttons are live before anything
has been typed. Long-standing, harmless, and out of this round's scope; worth
a line of work next time.

**Next round should pick up** the roster-driven bulk add (the remaining Quick
Win) — now more valuable, since a roster would fill the new artist column
directly.

## What it does today

- Per-entry title, artist, optional photo upload (thumbnail), artist
  statement
- Paste-list bulk import (title + statement per line; three tab-separated
  columns adds the artist)
- **Reorder entries** via up/down buttons
- **Live character-count warning** on the artist statement field past
  ~220 characters (QR density heads-up)
- **Named/multiple saved portfolios** (New/Duplicate/Rename/Delete)
- QR code per entry encoding the statement text directly (no hosting)
- Print: label grid (2/3/6/8 per page) with thumbnail, title, artist, QR,
  truncated statement
- Print: class reference sheet — one compact table of every piece with its
  artist and full statement, no photos or codes

## Quick Wins

- ~~Named/multiple saved portfolios~~ — **shipped 2026-08-11 (Round 2).**
- **CSV import including a photo column** isn't feasible without file
  paths, but a **bulk "add these students" from a saved roster** (like
  Gallery Walk QR Codes' roster-hub dropdown) would let a teacher
  populate all the titles at once before adding photos and statements one
  at a time.

## Major Features

- **Photo cropping/rotation** before it's baked into the label, since a
  phone photo uploaded as-is may be sideways or need cropping to the
  artwork itself — today the raw uploaded image prints as-is.
- **Export/import entries as JSON**, so a title/statement list built here
  could be reused as the starting point for a Gallery Walk QR Codes
  gallery (or vice versa) without retyping every title by hand.
- **Print a companion class reference sheet** (title + full statement in
  plain text, one per row) the way Gallery Walk QR Codes prints a
  reference sheet alongside its QR codes — handy for a teacher's own
  binder copy without needing to scan every code.
- **Bulk photo import**: select a whole folder of photos at once and
  match them to existing entries by filename or by upload order, instead
  of clicking "Add photo" once per entry.

## Moonshot / North Star

**A gallery-quality, zero-setup portfolio labeling workflow that goes
from "roster + a folder of photos" to "a printed sheet of labels" in
under a minute, each one scannable offline for the full artist
statement.** Multiple named portfolios and roster integration close the
gap between this and Gallery Walk QR Codes' more mature save/import
conventions; bulk photo matching and a reference-sheet export are what
would make a whole-class batch genuinely fast instead of one row at a
time.

## Platform themes that matter here

- **P7 (cross-tool)** — this tool and Gallery Walk QR Codes share a
  vendored QR library and near-identical `buildQR`/`drawQR` functions
  copy-pasted between them; **a third QR-based tool now exists**
  (Classroom Label Maker, `051-classroom-label-maker.html`, also built
  from the Ideas Backlog this same batch) with its own vendored copy and
  near-identical `buildQR`/`drawQR` — worth promoting into one shared
  `lib/qrcode.js` module referenced by relative path from `Tools/` next
  time any of the three gets touched, rather than a fresh vendored copy
  per tool folder.
- **P12 (data integrity)** — the `&hellip;`-through-`escapeHtml()` bug
  found here is the same shape as four other entity-in-JS-string bugs
  found this round; worth a dedicated sweep across every tool for the
  pattern "an HTML entity written as literal text inside a JS string
  literal" before it causes a real user-visible garbled character.

## Open Questions

- Is "the QR encodes the statement text directly" the right long-term
  answer, or would a future version of this toolkit's Bulk CSV Roster
  Import Hub (platform-wide idea) eventually make it reasonable to host
  photos somewhere real, at which point the QR could link to an actual
  hosted image instead of just carrying text?
- Should very long statements be silently truncated before encoding (to
  keep the QR code scannable and simple) rather than just warned about,
  trading completeness for a code that's guaranteed easy to scan from a
  few feet away on a bulletin board?

## Where the next round should pick up

All Quick Wins are now shipped. The roster-bulk-add idea under Major
Features and the shared `lib/qrcode.js` promotion (P7, now a three-tool
duplication) are the highest-value items left — the file hasn't cleared
its Major Features/Moonshot sections, so it stays out of `stable tools/`
for now.
