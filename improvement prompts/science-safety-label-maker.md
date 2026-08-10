# Improvement Prompts — Science Safety Symbol & Equipment Label Maker

**Tool file:** `Tools/science-safety-label-maker.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Ten hazard/equipment icons, custom label text and copy counts, printed as a grid of storage-bin labels.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: ten hand-drawn inline-SVG hazard/equipment icons
(flammable, corrosive, toxic/poison, biohazard, electrical hazard, sharp
objects, eye protection required, hot surface, fragile, plus a plain
"equipment, no symbol" option), each color-coded for quick visual sorting.
A teacher picks a symbol, types label text, sets a copy count, and queues
it; the queue prints as a 3-column grid of label cards sized for storage
bins. Queue persists in `localStorage` (`sslm_queue_v1`). Verified with a
headless Chromium smoke test (pick a symbol, add a label with quantity 3,
print, confirm exactly 3 cards render) — no console errors.

Nothing below has been started. Icons are simplified/stylized, not
official GHS pictograms — see Open Questions.

## What it does today

- 10 hazard/equipment icons, color-coded
- Custom label text + copy count per queued label
- Print: 3-column grid of label cards, each sized for a storage bin

## Quick Wins

- **Reorder the queue** and **edit an existing queued label** (currently
  delete-and-re-add is the only way to fix a typo) — small quality-of-life
  gaps versus other list-builder tools in this toolkit.
- **A "duplicate this label" button** for quickly making a near-identical
  label (same symbol, different bin number) without re-picking the symbol
  each time.
- **Label size options** (small/medium/large) since a 2-inch card that
  fits a bin lid might be too big for a narrow shelf edge or too small for
  a wall-mounted station sign.
- **Combine two symbols on one label** (e.g. "Flammable + Corrosive" for a
  mixed-hazard storage cabinet) — right now each label carries exactly one
  symbol.

## Major Features

- **Multiple named saved label sets** (e.g. "Chem Storage Room," "Bio Lab
  Stations"), matching the multi-save convention used by most builder
  tools in this round — right now one flat queue per browser.
- **Direct integration with Lab Safety Contract Tracker**, which the
  backlog explicitly names as a pairing — e.g. a shared hazard/equipment
  vocabulary, or a link from one tool to the other, rather than two
  entirely separate tools that happen to be thematically related.
- **Official GHS pictogram fidelity** — the current icons are simplified
  originals in this toolkit's house style, not the standardized GHS
  (Globally Harmonized System) hazard pictograms used on real chemical
  labeling. A school with formal chemical safety compliance requirements
  might need labels that match the actual standard exactly.
- **A QR code per label** linking to an SDS (Safety Data Sheet) reference
  or a longer safety procedure, reusing this toolkit's QR Code Generator
  pattern — turns a static hazard label into a quick-reference gateway.

## Moonshot / North Star

**A lab safety labeling system that matches real chemical-safety standards
where it matters (GHS pictograms) and links straight to the safety
information behind each label (SDS via QR), tied into the same safety
data as the Lab Safety Contract Tracker.** GHS fidelity matters for any
school taking chemical safety compliance seriously; QR-to-SDS turns a
static label into an actual safety resource; and tying into Lab Safety
Contract Tracker means "storage labeled X" and "students signed off on
handling X" live in the same mental model instead of two disconnected
tools.

## Platform themes that matter here

- **P7 (cross-tool)** — the explicit backlog pairing with Lab Safety
  Contract Tracker, plus QR-to-SDS reusing QR Code Generator's pattern,
  are both direct opportunities.
- **P6 (print quality)** — label size options matter more here than on
  most tools, since the physical bins/stations these labels go on vary a
  lot in size.

## Open Questions

- Is GHS pictogram accuracy a real requirement for this toolkit's
  audience (a middle school classroom, generally lower compliance burden
  than a research lab), or does the current simplified/stylized icon set
  serve the actual use case well enough that formal-standard fidelity is
  low priority?
- Should SDS-via-QR link to an external hosted SDS database (a real safety
  resource, but a dependency this toolkit doesn't currently have anywhere
  else) or to a teacher-authored local page/note per hazard (simpler,
  fully local, but less authoritative)?
