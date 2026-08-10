# Improvement Prompts — Certificate & Award Maker

**Tool file:** `Tools/certificate-award-maker.html`
**Support folder:** `Tools/certificate-award-maker/` — `cam-borders.js`, `cam-logo.js`, `cam-store.js`, `lib/qrcode.js`

**Current description (from README):** Five templates × four decorative borders, editable name/title/reason/date/signature with a live preview, and a batch mode that prints one certificate per name for a whole class.

---

## Status

**2026-08-10 — Quick Wins mostly implemented; Major Features deferred.**
Storage stayed additive: `settings.orientation`/`settings.perPage` are new
keys with a `normalizeSettings()` fallback (landscape, 1-per-page) for any
preset saved before they existed, and every other field is untouched — a
returning preset loads and prints exactly as before unless the teacher
opts into the new layout controls.

What shipped, in the order of the backlog:

- **Load a roster** — batch mode gained a roster-select + Load row
  (`populateRosterSelect()`/`camLoadRosterBtn`) identical in shape to the
  pattern already used by `behavior-points-tracker.html` and
  `field-trip-permission-slip.html`: `np_rosters` is read as
  `{ "Roster Name": ["Student A", ...] }` and the chosen roster's names are
  dropped straight into the batch textarea.
- **Per-student reason in batch mode** — `batchEntriesList()` was rewritten
  to parse each line as `Name`, `Name, Reason`, or `Name<TAB>Reason` (tab is
  what pasting two columns straight from a spreadsheet produces — the same
  convention `vocab-flashcard-generator` and `exit-ticket-generator` already
  use), with an optional trailing `| Custom Title` to also override the
  award title for just that one certificate. This is a **deliberate change in
  meaning**, not a strict addition: the old syntax used a bare comma for a
  *title* override ("Alex Rivera, Most Improved"); the doc explicitly asked
  for a name+reason two-column paste, so the comma slot now means reason,
  and title override moved to the `| Title` suffix (or a third tab column).
  Nothing forces a rewrite of already-saved batch text — old text still
  parses, just as a reason instead of a title, which is the intended
  outcome.
- **Landscape/portrait + two-per-page** — new "Layout" card
  (`#orientTabs`/`#perPageTabs`) driving `certDims()`, which both `.cert`
  themselves (inline `aspect-ratio`) and the thumbnail grid
  (`renderGrid()`/`scaleThumbs()`) read. Printing now groups certificates
  into `.print-page` sheets holding one or two `.cert-slot`s
  (`buildPrintArea()`), with a dashed cut guide between the two halves in
  2-per-page mode. The `@page` size itself is injected dynamically into a
  `<style id="camPageSizeStyle">` tag (`updatePageSizeStyle()`) since it has
  to flip between `letter landscape` and `letter portrait` — a static
  `@page` rule can't do that.
- **Three new templates** — Homework Pass, Reading Milestone, and Good News
  Note Home, added to the existing award-title dropdown. Homework Pass and
  Good News Note Home also get a different kicker line above the name
  (`KICKER_MAP`/`kickerFor()`: "This pass entitles" / "Great news about")
  since neither is really "awarded to" a student the way the achievement
  templates are; Reading Milestone reuses the default phrasing since it
  *is* an award. This is intentionally the small version of "more templates"
  — a phrasing/label change, not new layout boxes.
- **Confirm-before-delete on presets** — **already existed** (a `confirm()`
  before `CertificateStore.deletePreset()`). This round adds the "or undo"
  half of the ask: a 10-second undo bar (`showDeleteUndo()`/
  `hideDeleteUndo()`, holding exactly one deleted preset) appears in the
  toolbar after a confirmed delete and restores it via
  `CertificateStore.savePreset()`.
- **Skipped — deferred.** Signature image upload, and print alignment
  guides / bleed marks for pre-printed certificate stock. Both are real,
  scoped asks that just didn't fit in this round's five-item list; a
  signature image would reuse `CertificateLogo.downscaleImage()` almost
  as-is, and bleed guides are a CSS-only addition to the print stylesheet.

**Where a future round should pick up:** everything in Major Features below
(all deferred), the signature-image and bleed-guide Quick Wins above, and a
genuine drag-and-drop design surface if there's ever appetite for it — the
current template system is still "five fixed text fields in a fixed layout,"
just with more label/kicker variety than before.

## What it does today

- Five original title presets (Certificate of Achievement, Student of the
  Month, Most Improved, Perfect Attendance, Outstanding Effort) plus three
  new ones (Homework Pass, Reading Milestone, Good News Note Home) plus
  Custom — the newer three also swap the kicker line above the name
- Decorative borders (`cam-borders.js`) and theme swatches, with live preview
- Editable name / title / reason / date / signature; uploadable logo
  (`cam-logo.js`), removable
- Named presets saved and switchable (`gvb-certificate-maker:list` / `:data:*`),
  with confirm-before-delete and a 10-second undo
- **Batch mode** — one certificate per name for a whole class, with an
  optional **roster loader** pulling from `np_rosters`, and a **per-student
  reason** (and optional per-student title) via two-column paste
- **Orientation (landscape/portrait) and 1- or 2-per-page** print layout,
  with a dynamically-injected `@page` size and a cut guide for 2-per-page
- QR code support; Print / Save as PDF

## Quick Wins

- **Done —** **Load a roster** (P2). Batch mode is the headline feature and it can't
  read `np_rosters` — so the class list gets pasted in by hand every time.
- **Done —** **Per-student reason in batch mode.** Right now a class set shares one
  reason; the certificates people actually keep say something specific. Accept
  a two-column paste (`name, reason`) — the tool already has the parsing
  vocabulary elsewhere on the site (P13). *(Comma now means reason, not the
  old per-line title override — see Status for why that's a deliberate
  change and how title override still works via `| Title`.)*
- **Skipped — deferred.** **Signature image**, not just a typed name — an uploaded or drawn signature
  makes the output look official. *(Didn't fit this round's scope; would
  reuse `cam-logo.js`'s downscaling almost unchanged.)*
- **Done —** **Landscape and portrait**, and a **two-per-page** layout for smaller awards
  and "caught being kind" slips.
- **Skipped — deferred.** **Print alignment guides / bleed check** so pre-printed certificate paper
  lines up. Teachers buy certificate stock; this is the format it needs.
- **Done —** **More templates that aren't end-of-year awards** — homework
  pass, reading milestone, "good news from school" note home shipped.
  *(Skipped hall pass of honour and birthday certificate — the three shipped
  already covered the "not an end-of-year award" gap the doc called out; a
  future round can add more from the same list.)*
- **Done —** **Undo / confirm on Delete preset** (P11). *(Confirm already existed;
  added a 10-second undo bar on top of it.)*

## Major Features

- **Skipped — deferred.** **Award tracking across the year.** Who has received what, so the same three
  students don't get everything and so "perfect attendance, Q1–Q4" is
  computable rather than remembered. Pairs naturally with
  `behavior-points-tracker.html` and `ssr-log-tracker.html`, both of which
  already know who has earned something (P7).
- **Skipped — deferred.** **Data-driven batch generation.** Pull from another tool: everyone above a
  reading-goal threshold, everyone with a positive behavior trend, everyone
  who finished the novel study — and generate that certificate set in one pass.
- **Skipped — deferred.** **A real template system.** Templates as data (fonts, layout boxes, border,
  colours) rather than code, so a new design is a small JSON object. This
  makes seasonal and subject-specific designs cheap, and would let a teacher
  build their own. *(This round's three new templates are still code, just
  with a configurable kicker string — a real step toward this would be
  layout-as-data, not layout-as-markup.)*
- **Skipped — deferred.** **Full-page design surface.** Drag text blocks, resize, choose fonts — the
  step from "fill in five fields" to "make the certificate look how I want."
- **Skipped — deferred.** **Postcards and notes home.** Same engine, different output: a printable
  postcard with a positive message, addressed and ready to mail, which is one
  of the highest-impact and lowest-adoption things a teacher can do.
  *("Good News Note Home" template is a small down payment on this — same
  certificate layout with different phrasing, not the postcard-specific
  layout/addressing this item actually describes.)*

## Moonshot / North Star

**Recognition at scale, personal at the point of delivery.** Print thirty
certificates that each say something true and specific about that student,
assembled from what the toolkit already knows about the year, in the time it
currently takes to print thirty identical ones. Plus a design surface good
enough that the result doesn't look like a form.

## Platform themes that matter here

- **P2 (shared roster)** — **addressed 2026-08-10**: batch mode now reads
  `np_rosters` via a roster-select + Load button.
- **P6 (print quality)** — margins, bleed, and pre-printed stock alignment
  matter more here than anywhere else on the site. Orientation/2-per-page
  landed this round; bleed/alignment guides for pre-printed stock did not.
- **P12 (storage)** — the uploaded logo is base64 in `localStorage`; it needs
  downscaling and a size warning. (Downscaling already existed via
  `cam-logo.js`; the size-warning half is still open.)
- **P13 (import surfaces)** — **addressed 2026-08-10**: two-column
  name/reason paste (tab or comma) via the rewritten `batchEntriesList()`.

## Open Questions

- Is there interest in shipping a small set of licensed-clear decorative
  fonts, or should the tool stay with system fonts for reliability?
- Should the QR code on a certificate point at anything in particular
  (a shareable link, a portfolio), or is it currently a solution looking for
  a problem?
