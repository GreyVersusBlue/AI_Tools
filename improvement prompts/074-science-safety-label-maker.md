# Improvement Prompts — 074 — Science Safety Symbol & Equipment Label Maker

**Tool file:** `Tools/074-science-safety-label-maker.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Ten hazard/equipment icons, custom label text and copy counts, printed as a grid of storage-bin labels.

---

## Status

**2026-08-12 — Backlog round: reorder the label queue shipped (backlog
rank 10).** Each queued label row grew ↑/↓ buttons (before the existing
Edit/Duplicate/Delete, disabled at the ends, same pattern as Science Fair
Tracker's milestone list), swapping adjacent queue entries. Since the
printed grid is generated straight from the queue array, the print order
now follows the on-screen order — a teacher can arrange the queue in
shelf order before spending the ink. Order persists with the existing
`sslm_queue_v1` save (no schema change; array order was already what got
stored). Verified with a headless Chromium test: end buttons disabled,
two moves reorder correctly, order survives reload, the printed cards
come out in the reordered sequence, and edit/duplicate/delete still work
— zero console errors. Still open: two symbols per label (its own
backlog row) and named multi-save.

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

Icons are simplified/stylized, not official GHS pictograms — see Open
Questions.

**2026-08-11 — Round (session `b4zswl`).** Shipped three of the Quick
Wins (edit, duplicate, and label-size were bundled together since they all
touch the same queue-row UI; queue reordering was left for a future round —
see Open Questions): (1) edit an existing queued label — an "Edit" button per queue row
loads that label's symbol/text/qty back into the top form, highlights the
form with an outline and a "Save changes" label on the button (with a
Cancel link), and updates the existing queue entry in place instead of
adding a duplicate; (2) a "Duplicate" button per queue row clones the
entry with a new id, for the "same symbol, different bin number" case
named in the prompt; (3) a label-size control (small/4-per-row,
medium/3-per-row — the prior fixed default, large/2-per-row) that changes
both the print grid's column count and each card's physical height,
persisted alongside the queue. Storage shape changed from a bare array to
`{queue, labelSize}`; `load()` handles both shapes so an existing saved
queue from before this round still loads correctly. Did not attempt
"combine two symbols on one label" — see Open Questions, it's a genuinely
different data shape (multi-symbol labels) rather than a quick tweak.
Verified with a headless Chromium/Playwright smoke test: added a label,
duplicated it (queue count 1→2), clicked Edit and confirmed the editing
UI appears, saved an edited label text and confirmed the queue text
updated in place (not duplicated), switched to the "large" size and
printed, confirming the print grid picked up `size-large` and rendered the
right card count — zero console errors. `node --check` passed on both
inline scripts.

## What it does today

- 10 hazard/equipment icons, color-coded
- Custom label text + copy count per queued label; edit, duplicate, or
  **reorder (up/down)** any queued label — the printed grid follows the
  queue's order
- Label size control (small/medium/large — 4/3/2 per row)
- Print: label-grid sized per the chosen size, each card matching

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
- ~~Still open from the Quick Wins list: **reordering the queue**~~ —
  **done, 2026-08-12** (see Status). Still open: **combining two symbols
  on one label**, which
  would need the queue item shape to hold an array of symbols instead of
  one and touches the print-card rendering, the edit form, and the
  duplicate logic all at once — sizeable enough to deserve its own round
  rather than being folded in here.
