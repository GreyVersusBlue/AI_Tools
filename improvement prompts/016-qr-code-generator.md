# Improvement Prompts — 016 — QR Code Generator

**Tool file:** `Tools/016-qr-code-generator.html`
**Support folder:** `Tools/qr-code-generator/` — `test/smoke-roster.mjs`. The QR
encoder and jsQR decoder now come from `_shared/vendor/qrcode/` and
`_shared/vendor/jsqr/` (Phase 1/1b of `REFACTOR_PLAN.md`), not from a per-tool
`lib/` folder.

**Current description (from README):** _(Not currently listed in the README tools table — worth adding.)_ A general-purpose QR code generator with typed templates, logo overlay, bulk grids, and camera verification.

---

## Status

**2026-08-11 — Roster-labelled code sheet (backlog rank 1).** Shipped the
"Batch codes from a roster or a spreadsheet" Major Feature. Bulk mode gained a
"Start from a class roster" panel: a roster picker populated read-only from
`np_rosters`, a mode selector (name only / a link with the student's name in
it / one shared link for everyone), and a link field. Filling writes one
labelled line per student into the existing bulk textarea, so the whole
existing pipeline — encoding, jsQR batch verification, Avery label layout,
print — is reused rather than duplicated.

Two things that were not obvious going in:

- **The generated lines must be tab-separated.** `splitBulkLine` prefers a tab
  when one is present and otherwise splits on the first comma, so a roster of
  "Lovelace, Marco" entries written comma-separated would silently label the
  code "Lovelace" and encode ", Marco". This is the single sharpest edge in
  the feature and the test covers it end-to-end.
- **Filling from a roster switches the print layout to Avery 5160**, since a
  per-student sheet is a sheet of stickers — but only when the layout is still
  the plain-paper default. A preset the teacher already picked is left alone.

Named links accept a `{name}` placeholder anywhere in the URL; without one the
name is appended as `student=`, url-encoded, respecting an existing query
string. A `storage` listener repopulates the roster picker when another tab
edits `np_rosters`.

New test: `Tools/qr-code-generator/test/smoke-roster.mjs` (33 assertions,
wired into `npm test` and `npm run test:qr`) — covers roster listing, the
comma-in-a-name case through the real generator, the label-stock switch and
its don't-stomp rule, all three link modes, that `np_rosters` is byte-identical
afterward, and the no-rosters-saved empty state. `npm run check:dedupe` green.

**Where the next round should pick up:** inventory/check-out tracking is still
the biggest open feature here (scanning is now first-class; persisting a local
checked-out/returned record on top of it is not). The roster panel is also the
natural place to hang a "one code per student that opens their seating-chart
photo / portfolio" bridge if P7 work goes that way.

Earlier: reviewed — structural read of the source. Ideas below are
deliberately ambitious and are **not** scoped to a single session.

Note: this tool and `029-prompt-builder.html` are both missing from the README
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
  row, printable, with optional cut lines
- **Avery label sheet presets** (5160/8160 and 5163/8163) that print the bulk
  grid at exact physical inch dimensions, with whole-batch jsQR verification
- **Roster-labelled code sheets** (`readRosters`, `fillBulkFromRoster`): pick a
  roster saved in Name Picker / Class Roster Hub and get one labelled line per
  student in the bulk textarea — the code holding the student's name, a link
  with their name in it, or one shared link
- **Scan mode** — decode any code from the camera or an uploaded image, with
  this tool's own typed formats parsed back into labelled fields
- Download PNG and SVG; recent codes (`qr-code-generator-recent`)
- Uses `_shared/qr-scan.js`; reads `np_rosters` read-only

## Quick Wins

- **Label under each code**, in the single view and in the bulk grid, so a
  printed sheet of thirty codes is identifiable without scanning.
- **Done —** **Cut lines and margins** in the bulk grid, so a printed sheet can actually
  be cut apart. *(Cut lines via a checkbox on the custom grid; exact margins
  via the new Avery preset dimensions — see the Round 4 update below.)*
- **Done —** **More templates**: calendar event (vEvent), SMS, geo location, and a
  plain "Wi-Fi for guests" card layout that prints the network name and
  password beside the code — which is what school open-house nights need.
  *(SMS/geo/calendar shipped as three new templates; the Wi-Fi guest card
  need is covered by the new caption field instead of a dedicated layout —
  see the Round 4 update below.)*
- **Done —** **Verify the whole bulk grid**, not just a single code.
- **Done —** **Short display text under the code** for people whose camera doesn't work.
- **Partly done.** **Sizing guidance.** "At this size this code is scannable from about 3
  feet" — a printed classroom code is useless if it's too small, and the
  arithmetic is simple. *(Shipped for the new Avery label presets only,
  where the physical size is actually known; not attempted for single-code
  mode — see the Round 4 update below.)*
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
- **Done —** **Batch codes from a roster or a spreadsheet** (P2/P13) — one code per
  student, labelled with their name, printed as a grid. That's the pattern
  Gallery Walk and Scavenger Hunt each reimplement. *(Roster half shipped
  2026-08-11 — see the Status entry above. A spreadsheet/XLSX import path is
  still open.)*
- **Done —** **Sheet layouts for standard label stock** (Avery-style), so codes can be
  printed onto stickers for lab equipment, library books, or classroom bins.
  *(Two real presets, Avery 5160/8160 and 5163/8163 — see the Round 4 update
  below.)*
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

### Pass 2 — Round 1 — 2026-08-10 — session `v19h3x`

Implemented the **"Scanner mode as a first-class feature"** Major Feature,
entirely inside `Tools/016-qr-code-generator.html` (no support-folder or
library changes — `lib/jsqr.js` and `lib/qrcode.js` untouched):

- **New third mode, "Scan a code"**, alongside the existing Single/Bulk
  toggle. Selecting it hides the generator-only cards (Content's
  single/bulk panes, Appearance, Center Overlay — all newly marked
  `.gen-card`/existing `single-only`/`bulk-only` classes) and shows a
  dedicated scan pane and result cards instead. This is a genuinely
  standalone capability, not the existing "verify your own generated
  code" self-check: it decodes *any* QR code shown to it, independent of
  whatever (if anything) is in the generator's own text field.
- **Camera input**, reusing the same `getUserMedia` + `window.QRScan`
  technique as the existing `verifyScan`/camera-test-scan modal, but as a
  second, separate modal (`#scan-cam-overlay`) that accepts whatever
  `onResult` decodes instead of comparing it against one expected string
  — the key behavioral difference from the existing verify flow.
- **Upload/drop an image file** as an alternative to the camera: a new
  drop zone (`#scan-drop-zone`, sharing the logo drop-zone's `.drop-zone`
  styling) loads the file into an `<img>`, draws it 1:1 onto a scratch
  canvas, and decodes it with `window.jsQR` directly — no camera needed,
  which is both how a teacher with a photo of a code would use this and
  how this feature could be verified headlessly.
- **Decoded content displayed clearly**: plain text as-is; a URL as a
  clickable `target="_blank"` link; and this tool's own typed formats
  (Wi-Fi, vCard, tel, SMS, mailto, geo, calendar event) parsed back into
  the same labeled-field convention the generator's template fields use
  (`scanFieldRows`/`.scan-field`), not a raw string dump — e.g. a scanned
  Wi-Fi code shows "Network (SSID)", "Password", "Security", "Hidden
  network" as separate rows. Parsing reverses the exact escaping the
  generator side uses (`escField`/`icsEscape`) via a small manual
  unescape/split walk (`splitUnescaped`, `unescapeField`, `icsUnescape`)
  rather than a lookbehind regex, to avoid any engine-support risk.
- **"Recently scanned" list, separate from "Recently generated"**: a new
  `sessionStorage` key (`qr-code-generator-scanned`, deliberately
  `sessionStorage` rather than `localStorage` since the ask was scoped to
  "for the session") holds up to 20 entries with kind + source (camera vs.
  upload) icon, so scanning several codes in a row — e.g. checking in a
  stack of returned equipment — keeps every prior result instead of only
  the latest. Clicking an entry re-renders that result; a per-item remove
  button matches the existing recent-generated list's pattern.

### Testing performed (Pass 2 — Round 1)

- `node --check` against both inline `<script>` blocks (extracted to temp
  files) — pass.
- Headless Chromium via Playwright (`/opt/pw-browsers`, package from the
  global npm install): loaded the file over `file://`, generated a plain
  URL code with the tool's own single-code generator, pulled the canvas
  as a PNG via `toDataURL`, saved it to disk, switched to the new Scan
  mode, confirmed the generator-only cards were actually hidden and the
  scan pane visible, fed that saved PNG into the new upload input, and
  confirmed the decoded text round-tripped byte-for-byte back to the
  original URL and rendered as a clickable link. Repeated the same
  round-trip with a Wi-Fi template code (SSID + password) to confirm
  field-parsing renders "Network (SSID)"/"Password"/"Security"/"Hidden
  network" correctly rather than raw `WIFI:...` text — this needed
  bumping the render size to 600px first, since the existing jsQR
  self-check already flagged the same payload as unverified at the
  default 400px (a pre-existing, documented characteristic from the
  Round 4 notes, not something this round introduced). Also confirmed two
  sequential scans (URL then Wi-Fi) both remain in the "recently scanned"
  list rather than the second overwriting the first. Zero console or page
  errors in every pass.

### Things noticed but deliberately left alone (Pass 2 — Round 1)

- Did not touch `_shared/qr-scan.js` — it already exposes
  `scanQRFromCamera(videoEl, {onResult, onError})` generically (it
  doesn't compare against an expected string itself; only this tool's own
  `verifyScan` caller does that comparison), so the new scan mode's camera
  path calls it directly with a different `onResult` handler rather than
  needing any change to the shared helper.
- Did not attempt to reuse the *existing* `#cam-overlay` modal for the new
  scan mode — added a second, separate modal (`#scan-cam-overlay`)
  instead. The existing modal's status text and close handlers are
  wired specifically to the single-code verify flow; sharing it would
  have meant threading a mode flag through code that's simple and correct
  as two small, independent instances of the same modal markup/CSS.
- Did not build an "Inventory/labelling mode" (the other open Major
  Feature in this file) — scanning is now a first-class capability this
  tool exposes, but persisting a local checked-out/returned record on top
  of it is a distinct, larger feature and was left for its own round per
  the existing Open Questions note about scope.
- Only decode formats already produced by this tool's own generator
  (seven typed templates) get the labeled-field treatment; any other QR
  content (a Google Form URL, an arbitrary app deep link, etc.) correctly
  falls through to the plain-text/link rendering, which is the intended
  behavior, not a gap.

### Where the next round should pick up

- **Inventory/check-out tracking mode** is the natural next step now that
  scanning is a first-class capability: pair it with a local
  checked-out/returned record (who has what, scanned in/out timestamps)
  per the remaining Major Feature idea in this file.
- Real-camera testing (as opposed to the headless upload-path proof used
  here) on an actual phone/tablet camera against printed codes in varied
  lighting would be the strongest validation of the new camera-scan path
  — a headless browser has no real camera, so that path is only exercised
  by code inspection and by the pattern match against the already-proven
  `verifyScan`/`stopCameraScan` camera technique, not by an end-to-end
  automated test.
- If a future round wants scanned Wi-Fi/vCard/etc. content to be
  *actionable* (e.g. a "connect" button, an "add to contacts" download),
  that's a reasonable next layer on top of the display-only parsing shipped
  here.

## Round 4 update — 2026-08-10

Implemented four of the Major Features from this file in one pass, all inside
`Tools/016-qr-code-generator.html` (no support-folder or library changes needed):

- **Three new typed templates**: SMS (`sms:` URI, with optional body), map
  location (`geo:` URI with an optional place name in the `q=` param), and
  calendar event (a full `BEGIN:VCALENDAR`/`VEVENT` block from a
  `datetime-local` picker, with all-day support and sensible 1-hour/1-day
  defaults when only a start time is given). Templates now total seven:
  Wi-Fi, vCard, phone, SMS, email, geo, and calendar event.
- **Caption under the code** (single-code mode): a new optional text field
  that bakes a short caption into the bottom of the generated PNG/SVG/print
  output (extends the canvas height rather than overlaying it on the code
  itself, so it never touches error correction). Every "Insert into code"
  template action auto-suggests a sensible caption (SSID + password for
  Wi-Fi, contact name, phone number, event title, etc.) *only* if the field
  is still empty, so a manual edit is never clobbered. This covers both the
  "short display text under the code" quick win and the "Wi-Fi guest card"
  idea from Quick Wins/Major Features — a teacher can print a Wi-Fi code
  with the network name and password spelled out underneath for open-house
  night. Caption is now also carried through Save-to-Recent/reload.
- **Avery-style label sheet layouts for the bulk grid** (Major Feature):
  a new "Print layout" selector alongside the existing custom column grid,
  with two real presets — Avery 5160/8160 (30/sheet address labels, 1in x
  2.63in) and Avery 5163/8163 (10/sheet shipping labels, 2in x 4in). Picking
  a preset switches the print output to exact physical inch dimensions
  (label size, pitch, and sheet margins all taken from the vendor spec and
  checked to sum to exactly 8.5in x 11in) via a dynamically-injected `@page`
  margin rule plus inline-styled label boxes — the on-screen preview grid is
  untouched (still a fluid N-column CSS grid) since it's only ever a rough
  preview. A sizing-guidance line ("expect reliable scans from about X away")
  is shown for presets only, since it needs a known physical size to be
  non-speculative — deliberately not attempted for single-code mode, where
  the print size is browser-scaled and unknown. The custom grid keeps its
  original behavior and gained an optional "Add cut lines" checkbox for
  plain-paper sheets.
- **Whole-batch verification**: every bulk-generated code is now decoded
  with jsQR immediately after rendering (same technique as the existing
  single-code `verifyScan`), not just checked for generation errors. Codes
  that render fine but can't be confirmed scannable get a distinct amber
  "unverified" badge (separate from the existing red "generation failed"
  state), and the summary line reports both counts plus, for a label-sheet
  preset, how many physical sheets the batch needs.

### Testing performed

- `node --check` against both inline `<script>` blocks (extracted to temp
  files) and against the two vendored library files — all pass.
- Headless Chromium via Playwright (already present at
  `/opt/pw-browsers`, package resolved from the global npm install since
  it isn't in this repo's `node_modules`): loaded the file over `file://`,
  watched for `console.error`/`pageerror`, and drove the actual UI —
  filled and inserted all three new templates, set a caption and confirmed
  the canvas grew and still verified as scannable, switched to bulk mode,
  generated a custom grid, switched to the Avery 5160 preset and confirmed
  the injected `@page` margin, the exact-inch print item sizing, and the
  sheet-count arithmetic, and forced an intentionally dense bulk entry to
  confirm the new "unverified" badge actually triggers (not just always
  green). Zero console errors in any pass.

### Things noticed but deliberately left alone

- Rendering the new calendar-event template at the default 400px single-code
  size sometimes lands in the existing "could not verify a scan" state —
  this isn't a regression, it's the app's pre-existing jsQR-based
  self-check correctly reporting that a longer payload needs either a
  bigger render or a higher error-correction level at that size (confirmed
  by decoding the identical payload successfully at 500px+). The existing
  warning copy already tells the user what to do about it.
- CSS Grid pagination across multiple physical pages (e.g. printing 90
  labels = 3 sheets of Avery 5160) is only verified in Chromium here.
  Multi-page break behavior inside CSS Grid has historically been uneven
  across browser engines; worth a real print test in Firefox/Safari before
  calling the label-sheet feature fully cross-browser solid.
- Did not add a third label preset (e.g. a small return-address size like
  5167) — its real-world margins/pitch weren't ones I could verify with
  confidence, and a wrong-by-a-few-millimeters preset is worse than not
  offering it. A future round could add more presets once the exact vendor
  specs are confirmed against a source.
- Did not touch the px-based "sizing guidance" quick win for single-code
  mode (only implemented it for label-sheet presets, where the physical
  size is actually known) — the on-screen size slider doesn't correspond to
  a physical print size, so any "scannable from N feet" claim there would
  be a guess dressed up as a fact.
- Did not add a "confirm before clearing recents" quick win — there is
  currently no "clear all" action on the Recent list to confirm before
  (only per-item remove), so this quick win doesn't yet apply; it becomes
  relevant only if a future round adds a bulk-clear button.
- Left the cross-tool consolidation ideas (shared QR layer, state-link
  integration, inventory/check-out tracking, scanner-mode-as-a-first-class-
  feature) untouched — all of them reach outside this tool's own files, or
  are large enough to deserve their own round.

### Where the next round should pick up

- A general-purpose "scan a code and act on it" mode (distinct from the
  existing verify-your-own-code camera check) is still open, per the
  "Scanner mode as a first-class feature" idea and the open question about
  whether it belongs here or in a separate tool.
- If another label preset is wanted, confirm exact label/pitch/margin specs
  before adding it — the two implemented here were cross-checked against
  the 8.5in x 11in page arithmetic as a sanity test, which is worth doing
  for any addition.
- Real inkjet/laser print tests against physical Avery 5160/5163 stock
  would be the strongest possible validation of the label-sheet math above
  and beyond what a headless browser can confirm.
