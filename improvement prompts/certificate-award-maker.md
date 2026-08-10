# Improvement Prompts — Certificate & Award Maker

**Tool file:** `Tools/certificate-award-maker.html`
**Support folder:** `Tools/certificate-award-maker/` — `cam-borders.js`, `cam-logo.js`, `cam-store.js`, `lib/qrcode.js`

**Current description (from README):** Five templates × four decorative borders, editable name/title/reason/date/signature with a live preview, and a batch mode that prints one certificate per name for a whole class.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Five title presets (Certificate of Achievement, Student of the Month,
  Most Improved, Perfect Attendance, Outstanding Effort) plus Custom
- Decorative borders (`cam-borders.js`) and theme swatches, with live preview
- Editable name / title / reason / date / signature; uploadable logo
  (`cam-logo.js`), removable
- Named presets saved and switchable (`gvb-certificate-maker:list` / `:data:*`)
- **Batch mode** — one certificate per name for a whole class
- QR code support; Print / Save as PDF

## Quick Wins

- **Load a roster** (P2). Batch mode is the headline feature and it can't
  read `np_rosters` — so the class list gets pasted in by hand every time.
- **Per-student reason in batch mode.** Right now a class set shares one
  reason; the certificates people actually keep say something specific. Accept
  a two-column paste (`name, reason`) — the tool already has the parsing
  vocabulary elsewhere on the site (P13).
- **Signature image**, not just a typed name — an uploaded or drawn signature
  makes the output look official.
- **Landscape and portrait**, and a **two-per-page** layout for smaller awards
  and "caught being kind" slips.
- **Print alignment guides / bleed check** so pre-printed certificate paper
  lines up. Teachers buy certificate stock; this is the format it needs.
- **More templates that aren't end-of-year awards** — hall pass of honour,
  homework pass, birthday certificate, reading milestone, "good news from
  school" postcard home.
- **Undo / confirm on Delete preset** (P11).

## Major Features

- **Award tracking across the year.** Who has received what, so the same three
  students don't get everything and so "perfect attendance, Q1–Q4" is
  computable rather than remembered. Pairs naturally with
  `behavior-points-tracker.html` and `ssr-log-tracker.html`, both of which
  already know who has earned something (P7).
- **Data-driven batch generation.** Pull from another tool: everyone above a
  reading-goal threshold, everyone with a positive behavior trend, everyone
  who finished the novel study — and generate that certificate set in one pass.
- **A real template system.** Templates as data (fonts, layout boxes, border,
  colours) rather than code, so a new design is a small JSON object. This
  makes seasonal and subject-specific designs cheap, and would let a teacher
  build their own.
- **Full-page design surface.** Drag text blocks, resize, choose fonts — the
  step from "fill in five fields" to "make the certificate look how I want."
- **Postcards and notes home.** Same engine, different output: a printable
  postcard with a positive message, addressed and ready to mail, which is one
  of the highest-impact and lowest-adoption things a teacher can do.

## Moonshot / North Star

**Recognition at scale, personal at the point of delivery.** Print thirty
certificates that each say something true and specific about that student,
assembled from what the toolkit already knows about the year, in the time it
currently takes to print thirty identical ones. Plus a design surface good
enough that the result doesn't look like a form.

## Platform themes that matter here

- **P2 (shared roster)** — batch mode without the shared roster is the
  clearest single gap in this tool.
- **P6 (print quality)** — margins, bleed, and pre-printed stock alignment
  matter more here than anywhere else on the site.
- **P12 (storage)** — the uploaded logo is base64 in `localStorage`; it needs
  downscaling and a size warning.
- **P13 (import surfaces)** — two-column name/reason paste.

## Open Questions

- Is there interest in shipping a small set of licensed-clear decorative
  fonts, or should the tool stay with system fonts for reliability?
- Should the QR code on a certificate point at anything in particular
  (a shareable link, a portfolio), or is it currently a solution looking for
  a problem?
