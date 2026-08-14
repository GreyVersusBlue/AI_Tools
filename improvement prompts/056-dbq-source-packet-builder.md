# Improvement Prompts — 056 — DBQ / Source Packet Builder

**Tool file:** `Tools/056-dbq-source-packet-builder.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Add text or image sources with a citation and source-specific guiding questions, plus a shared question set, printed as one packet with a cover page and one source per page.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: a packet title and historical-context/task field, an
editable list of "shared" guiding questions asked after every source, and
a list of sources — each with a title, type toggle (text vs. image),
citation, and its own source-specific guiding questions. An image source
uploads as a data URL and stores locally, the same pattern used in Book
Tasting Menu Generator and Image &rarr; PDF Assembler. Print output is one
packet: a cover page (title, context, name/date line), then one page per
source (auto-lettered Source A, B, C&hellip;) with its citation, body
(text or image), and every applicable question (its own + the shared set)
each with a blank line. Autosaves to `localStorage`
(`dbq_packet_v1`). Verified with a headless Chromium smoke test (fill
context, add a text source, add a second source, print, confirm the right
number of pages and that both source text and shared questions appear) —
no console errors.

**2026-08-11 — Round 2 (session `qer21r`).** Two Quick Wins shipped:

- **Reorder sources via up/down buttons** — each source block now has
  Move up / Move down controls (disabled at the ends); since couplet-
  style lettering (Source A, B, C&hellip;) is derived from array
  position and per-source `leadsTo`-style references don't exist here
  (shared/per-source questions don't reference other sources), reordering
  is a plain array swap with no cross-reference bookkeeping needed.
- **A dedicated final synthesis/essay prompt field** — a new textarea on
  the packet-setup card, separate from the historical-context field, that
  prints as its own closing page (with four blank lines for a written
  response) after the last source, addressing the "mixed in with
  background" gap this file called out.

Both verified with a headless Chromium smoke test (moving the second
source up reorders it to the front, essay prompt text survives a reload)
plus a separate print-path check confirming the essay page renders with
the right heading and text — zero console errors in either pass.

**2026-08-13 — Image size/crop control (Quick Win).** Each image source
now stores a non-destructive `{ crop: {x, y, w, h}, widthPct, imgW,
imgH }` alongside the untouched original upload data URL (`src.image`
itself is never rewritten): `crop` is a normalized top-left rect (`x, y,
w, h` all 0&ndash;1) instead of Historical Trading Card Maker's centered
`{x, y, scale}` shape, since a DBQ source photo needs an arbitrary
sub-rectangle (a specific paragraph or clipping out of a scanned page),
not just a centered zoom; `widthPct` (20&ndash;100%, a range slider) caps
how much of the print column width the image is allowed to fill, so a
small clipping doesn't get blown up to full page width by default.

The editor shows the full original photo in a `.crop-tool` box; dragging
on it rubber-bands a new crop rect (pointer events, delegated so it
survives re-renders; a `< 4%` drag is treated as a stray click and
ignored) with a "Reset crop" button back to the full image. A "Preview
at print size" box directly beneath it renders the same crop+scale the
print output will use, so there's no surprise between editor and paper.

Both the live preview and the print packet render the crop as a real
foreground `<img>` inside an `overflow:hidden` container sized via CSS
`aspect-ratio` (computed from the crop rect against the image's natural
pixel dimensions, captured once via a probe `Image()` on upload) —
deliberately **not** a `background-image`, because most browsers hide
background graphics on print by default unless the user opts in via
"print background graphics," which would have made cropped source
photos silently vanish from printed packets. The width slider updates
the DOM directly (not through a full `renderSources()`) so dragging the
`<input type="range">` isn't interrupted by an innerHTML rebuild
mid-drag.

Verified with a headless Chromium smoke test: upload a real (non-1&times;1)
PNG, confirm natural width/height get probed and stored, drag a crop
rect and confirm the stored `{x,y,w,h}` matches, move the width slider
to 40% and confirm both the live preview and `#printArea`'s
`.crop-frame` reflect the narrower width and the offset/scaled `<img>`,
reload and confirm crop/width survive, and exercise Reset crop — zero
console errors throughout. (Old saved packets without `crop`/`widthPct`
default to the full image at 100%, matching the prior stretch-to-column
behavior exactly, so existing autosaved packets aren't affected.)

**Not started this round:** multiple named saved packets, the Primary
Source Analysis Worksheet Generator integration, a source bank/library,
JSON export/import, scaffolding/differentiation levels. See Major
Features/Moonshot below — the Primary Source Analysis Worksheet
Generator integration is still the clearest named opportunity (it's an
explicit backlog pairing, per Platform theme P7) and hasn't been
touched.

**2026-08-13/14 — SS demo round (session `xo4v63`) — share a packet by
link (backlog rank 23).** Shipped in full, sequenced exactly as scoped
(multi-save first, since a shared link needs somewhere to land):

- **Multiple named saved packets.** Replaced the single `dbq_packet_v1`
  blob with the triple-key convention the Historical Trading Card
  Maker's `htcm-store.js` established: `dbq:list` (names),
  `dbq:data:<name>` (one document each), `dbq:current` (last-open
  packet). A "Saved packets" card (new/duplicate/delete/rename, same
  interaction shape as 054's guide library) sits above the
  packet-setup card. The old blob is read once on first load, migrated
  in as the first named packet under its own title (or "My Packet"),
  and left in place untouched as a one-release backup, never deleted.
  `Tools/009-backup-restore.html`'s `KNOWN_GROUPS` entry for this tool
  now also matches the `dbq:` prefix, not just the legacy key.
- **Share a packet by link + QR**, copying the pattern from
  028-primary-source-analysis-generator.html: `_shared/state-link.js`
  encodes the whole packet (minus each image source's pixel data) into
  a `?packet=` URL, with a QR-code overlay via
  `_shared/vendor/qrcode/qrcode.js`. Crop and width-percent metadata
  still ride along for when an image is re-uploaded. The share note
  names exactly which sources kept their images on the sending device
  (by letter and title), so the "identical packet" promise stays
  honest instead of silently dropping images. A packet whose encoded
  size overflows what a QR code can hold (a long, text-heavy packet)
  falls back to a clear size message pointing at "Copy link" instead
  of drawing an unscannable code, same failure mode as 028. An
  incoming `?packet=` link always saves as a NEW packet under a
  uniqued name (never overwrites), even when the name collides with a
  packet already on the receiving device.
- **JSON export/import** (first supporting item): downloads the full
  packet, images included, as a named `.json` file, the honest "send
  everything" path the share note points recipients at when images
  matter. Import validates the shape and saves under a uniqued name.
- **Load example packet** (second supporting item, P15): a 3-source
  Industrial Revolution child-labor mini-DBQ (a factory inspector's
  report, a mill owner's response, a child worker's testimony, each a
  short composite/adapted account under 150 words; citations say
  "adapted for classroom use" so nothing is misattributed as a
  verbatim archival quote) with guiding questions and an essay prompt.
  A brand-new install with nothing saved anywhere now opens on this
  example instead of a blank shell, so a first look or a live demo
  shows a real packet. A "Load example packet" button lets a teacher
  reload it into the current packet at any time, confirming first if
  that packet already has real content in it.
- **First smoke test** (third supporting item):
  `Tools/dbq-source-packet-builder/test/smoke-share.mjs` (`npm run
  test:dbq`, appended to the root `test` chain) asserts the migration
  keeps a pre-existing `dbq_packet_v1` packet and its legacy key, a
  share link round-trips text sources/citations/questions exactly, the
  image source's pixel data is absent from the payload while its
  width-percent metadata survives, the share note names the withheld
  image by letter and title, and an incoming link with a name
  collision saves under a uniqued name without touching the receiving
  device's existing packet. 32 assertions, zero console errors, zero
  offsite requests.

Non-goals held for a later round, as scoped: the Primary Source
Analysis Worksheet Generator integration, a source bank/library,
scaffolding levels, image compression changes, PDF export.

**Hardest part:** the boot sequence originally called `renderAll()`
unconditionally after the import-or-load branch, which silently wiped
the "opened from a shared link" note that `importSharedPacket()` had
just set (its own trailing `renderAll()` already rendered everything,
including a temporary blank note; the real message was set right
after). Fixed by only calling the outer `renderAll()` on the
non-import boot path. Caught by the new smoke test, not by manual
clicking, a good argument for keeping this suite green going forward.

**Where the next round should pick up:** the Primary Source Analysis
Worksheet Generator integration (still unbuilt, still the clearest
named opportunity per P7) and a source bank/library are the two
biggest remaining items; both are now easier to reach since the
multi-save plumbing this round built (triple-key store, share/export
serializers) is a pattern the next round can extend rather than
invent from scratch.

## What it does today

- Multiple named saved packets (new/duplicate/delete/rename), migrated
  automatically from the old single-packet save
- Share a packet with a teammate by link or QR code (text, citations,
  and questions travel; each image source's pixel data stays on the
  sending device, named explicitly in the share note; an incoming link
  always lands as a new, uniquely-named packet)
- JSON export/import of a full packet, images included
- A worked example packet (Industrial Revolution child labor) a
  brand-new install opens on, reloadable at any time
- Packet title, historical context/task
- Shared guiding questions asked of every source
- Sources: text or image, citation, source-specific questions,
  auto-lettered (A, B, C&hellip;)
- Image sources: drag-to-crop box (arbitrary rectangle, non-destructive
  against the original upload) plus a 20&ndash;100% print-width slider,
  applied identically in the editor preview and the printed packet
- Print: cover page + one page per source with all applicable questions

## Quick Wins

- ~~**Reorder sources** via up/down buttons~~ — **done, Round 2.**
- ~~**A final synthesis/essay prompt field**~~ — **done, Round 2** (shipped
  as a closing page, not on the cover page, so it doesn't compete for
  space with the historical context and name/date line).
- ~~**Multiple named saved packets**~~ — **done, SS demo round
  (`xo4v63`)**, matching the multi-save convention used by most
  builder tools in this round.
- ~~**Image size/crop control** on upload~~ — **done, 2026-08-13** (a
  drag-to-select crop box plus a 20&ndash;100% print-width slider, stored
  non-destructively per source and applied in both the editor preview and
  the print output).
- ~~**Share a packet by link + QR**~~ — **done, SS demo round
  (`xo4v63`)** (backlog rank 23).

## Major Features

- **Direct integration with Primary Source Analysis Worksheet Generator**,
  which the backlog explicitly names as a pairing — e.g. generate an
  OPTIC/SOAPSTone-style analysis worksheet per source directly from a
  packet, instead of building the two documents independently.
- **A source bank/library**: save individual sources (not whole packets)
  to a personal library, so a source used across multiple DBQ packets
  (e.g. a frequently-cited primary document) doesn't need re-uploading
  and re-captioning every time.
- ~~**JSON export/import**~~ — **done, SS demo round (`xo4v63`)**, for
  sharing a built packet with another social studies teacher on the
  same team or across a department.
- **Difficulty/scaffolding levels per source** — e.g. a vocabulary gloss
  or a simplified-language version alongside the original text, for
  differentiating the same DBQ packet across ability levels.

## Moonshot / North Star

**A DBQ packet builder backed by a reusable source library, tightly
integrated with Primary Source Analysis Worksheet Generator, that produces
differentiated packets for the same source set without rebuilding from
scratch for each ability level.** A source library removes the biggest
recurring cost (re-uploading and re-captioning the same historical
documents across units and years); the Primary Source Analysis
Worksheet Generator integration delivers on the backlog's explicit
pairing; and per-source scaffolding turns one packet into several
appropriately-leveled versions without duplicated authoring work.

## Platform themes that matter here

- **P7 (cross-tool)** — the explicit backlog pairing with Primary Source
  Analysis Worksheet Generator is the clearest opportunity in this tool;
  a source library would also benefit any future tool needing
  reusable historical-document content.
- **P6 (print quality)** — image size/crop control (shipped 2026-08-13)
  mattered here more than most tools, since source images vary enormously
  in size and aspect ratio.
- **P15 (first run)** — a source library reduces the single biggest
  recurring cost of using this tool (finding and uploading the same
  sources again and again).

## Open Questions

- Should a source library be scoped per-browser (matching this toolkit's
  local-only philosophy) even though that means it can't be shared between
  a teacher's home and school computers, or is that an acceptable
  trade-off given every other tool in this toolkit makes the same choice?
- Is scaffolding/differentiation worth building as a first-class feature
  here, or does it belong as general guidance (a teacher builds two
  separate packets by hand) given how much source-specific judgment
  "simplify this historical document" actually requires?
