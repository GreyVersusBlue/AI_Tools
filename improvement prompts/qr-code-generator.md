# Improvement Prompts — QR Code Generator

**Tool file:** `Tools/qr-code-generator.html`
**Support folder:** `Tools/qr-code-generator/` — `lib/jsqr.js`, `lib/qrcode.js`

**Current description (from README):** _(Not currently listed in the README tools table — worth adding.)_ A general-purpose QR code generator with typed templates, logo overlay, bulk grids, and camera verification.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

Note: this tool and `prompt-builder.html` are both missing from the README
tools table. Worth fixing whenever someone touches the README.

## What it does today

- **Typed templates**: plain text/link, Wi-Fi network, contact card (vCard),
  email, phone number (`renderTemplateFields`, `escField`)
- Error-correction level selection with plain-English explanations of the
  tradeoff
- **Logo / image overlay** in the code centre (`handleLogoFile`,
  `drawOverlay`, `syncOverlayPanes`), with `effectiveEcLevel` adjusting error
  correction to compensate — a genuinely thoughtful detail
- **Camera verification** (`verifyScan`, `stopCameraScan`, `setScanBadge`) —
  scan your own code to confirm it works before printing
- **Bulk grid generation** (`parseBulkLines`, `generateBulkGrid`) at 2–5 per
  row, printable
- Download PNG and SVG; recent codes (`qr-code-generator-recent`)
- Uses `_shared/qr-scan.js`

## Quick Wins

- **Label under each code**, in the single view and in the bulk grid, so a
  printed sheet of thirty codes is identifiable without scanning.
- **Cut lines and margins** in the bulk grid, so a printed sheet can actually
  be cut apart.
- **More templates**: calendar event (vEvent), SMS, geo location, and a
  plain "Wi-Fi for guests" card layout that prints the network name and
  password beside the code — which is what school open-house nights need.
- **Verify the whole bulk grid**, not just a single code.
- **Short display text under the code** for people whose camera doesn't work.
- **Sizing guidance.** "At this size this code is scannable from about 3
  feet" — a printed classroom code is useless if it's too small, and the
  arithmetic is simple.
- **Confirm before clearing recents** (P11).

## Major Features

- **Become the site's shared QR layer** (P7). Six tools currently vendor their
  own copy of `lib/qrcode.js` — bracket, certificate, class roster hub, escape
  room, exit ticket, field trip, gallery walk, scavenger hunt, name picker.
  A single shared module (plus this tool as its front door) would cut
  duplication substantially and give every tool the logo overlay, error
  correction guidance, and camera verification for free.
- **QR + link shortening for `state-link.js` payloads** (P3). The site's
  share-by-link mechanism produces long URLs that make dense, hard-to-scan
  codes. A shared "is this payload too big for a reliable code?" check
  belongs here.
- **Batch codes from a roster or a spreadsheet** (P2/P13) — one code per
  student, labelled with their name, printed as a grid. That's the pattern
  Gallery Walk and Scavenger Hunt each reimplement.
- **Sheet layouts for standard label stock** (Avery-style), so codes can be
  printed onto stickers for lab equipment, library books, or classroom bins.
- **Scanner mode as a first-class feature.** `jsqr.js` is already vendored;
  a "scan a code and act on it" mode would let this tool serve the check-in
  and collection-tracking flows other tools need (P7).
- **Inventory/labelling mode.** Generate, print, and then scan codes for
  classroom equipment, textbooks, or lab kits with a local record of what's
  checked out to whom.

## Moonshot / North Star

**One QR layer for the whole toolkit, plus a genuinely good standalone
generator.** Every tool that prints codes gets the same reliable generation,
size guidance, error correction, verification, and label-stock layouts; and a
teacher who just needs a code for the Wi-Fi, a Google Form, or a set of
library books has a tool that does it properly — with a scanner on the other
end for check-in and collection workflows.

## Platform themes that matter here

- **P7 (cross-tool)** — nine tools vendoring the same QR library is the
  clearest duplication on the site.
- **P3 (share links)** — QR is how state-links become physical.
- **P6 (print quality)** — cut lines, label stock, and scannable-at-distance
  sizing.
- **P13 (import surfaces)** — bulk generation from a paste or a roster.

## Open Questions

- Should `lib/qrcode.js` move to `_shared/` and every tool load it from
  there? It's a mechanical change touching nine tools plus `sw.js`, and it
  would need care to avoid breaking the precache list.
- Is a scanner/check-in mode this tool's job, or should it be a separate
  "Scan & Check In" tool that several workflows call?
