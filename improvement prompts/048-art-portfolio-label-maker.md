# Improvement Prompts — 048 — Student Art Portfolio Label & QR Tag Maker

**Tool file:** `Tools/048-art-portfolio-label-maker.html`
**Support folder:** `Tools/art-portfolio-label-maker/lib/qrcode.js` (vendored
offline QR encoder, copied from Gallery Walk QR Codes' own vendored copy).

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

## What it does today

- Per-entry title, optional photo upload (thumbnail), artist statement
- Paste-list bulk import (title + statement per line)
- **Reorder entries** via up/down buttons
- **Live character-count warning** on the artist statement field past
  ~220 characters (QR density heads-up)
- QR code per entry encoding the statement text directly (no hosting)
- Print: label grid (2/3/6/8 per page) with thumbnail, title, QR, statement

## Quick Wins

- **Named/multiple saved portfolios**, matching the multi-save convention
  used by most builder tools in this round — one flat list per browser
  right now, so a teacher with several class sections can't keep separate
  portfolio batches.
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

Named/multiple saved portfolios is the natural next step — it's the same
`RubricStore`-style pattern used elsewhere this batch (see Art Critique
Worksheet Generator's Round 1 for a from-scratch inline implementation of
that exact convention, or Rubric Builder's `rb-store.js` for the reusable
module shape). After that, the roster-bulk-add Quick Win and the shared
`lib/qrcode.js` promotion (P7, now a three-tool duplication) are the
highest-value items left.
