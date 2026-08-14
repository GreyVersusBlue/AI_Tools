# Improvement Prompts — 056 — DBQ / Source Packet Builder

**Tool file:** `Tools/056-dbq-source-packet-builder.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Add text or image sources with a citation and source-specific guiding questions, plus a shared question set, printed as one packet with a cover page and one source per page.

---

## Status

**2026-08-14 — Devon-assigned round: the source library (session
`c1jqjp`).** The last open Major Feature. A teacher who cites the same
document every year now uploads and captions it once.

- **Saved sources live outside every packet**, in one `dbq:bank` array. That
  is the whole design decision, and it is structural rather than a policy:
  if the library lived inside a packet document, deleting an old packet
  would take a year of saved sources with it, and nobody would find out
  until it happened. The suite asserts a packet delete leaves the library
  standing, which is the assertion this feature actually needs.
- **A packet's source carries a `bankId`** when it came from — or was saved
  to — the library. That is what makes "Update in library" possible without
  guessing by title: two different letters from 1776 can share a title, and
  a teacher who renames a source still means the same source. Asserted both
  ways: saving twice updates one entry, and two different sources with
  identical titles stay two entries.
- **What moves is a copy, with fresh ids** — source id and every question id.
  Editing the packet's copy must not silently rewrite the library entry, and
  the same library source added to a packet twice must not collide with
  itself.
- **Removing from the library never touches a packet** built from it, and
  the confirm dialog says so before the teacher commits.
- **Adding to a brand-new packet replaces its blank first source** rather
  than leaving an empty "Source A" above every added one. Small, but it is
  the first thing a teacher would hit.
- **Quota failure is reported, not swallowed.** Images ride as data URLs,
  the same exposure packets already have; if the write fails, the note names
  the source that wouldn't fit and says what to do about it, rather than
  silently not saving.
- Empty sources are refused with a reason, and the library has a search over
  titles and citations, because a library worth having gets long.

**Tests.** New `smoke-source-library.mjs` (32 assertions) covering all of
the above, including the two independence properties (packet delete vs
library, library remove vs packet) that are invisible until they bite. Both
existing suites pass unchanged.

#### Where the next round should pick up

- **The other half of the 028 pairing.** The handoff runs one way — a text
  source becomes a SOAPSTone worksheet in 028. Pulling a source *out* of
  028 into a packet is still unbuilt, and the library is now the obvious
  place for it to land: "add from Primary Source Analysis" alongside "add
  from library".
- **The library holds sources, not packets' worth of them.** There is no
  export/import of the library itself, so it does not move between machines
  the way a packet does (a packet has a share link and a JSON path). If a
  teacher asks to move their library to a new laptop, that is the next
  round, and it should reuse the packet's existing share-link plumbing
  rather than invent a second format.
- Image sources in the library are data URLs in localStorage, which is the
  same quota ceiling packets have — but a library accumulates across years
  in a way a packet doesn't. If teachers hit it, IndexedDB (as
  `046-blank-map-generator.html` already does for map images) is the move.


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

**2026-08-14 — SS demo round 2 (session `vn8trq`) — essay planning
scaffold + rubric page + leveled packets.** The whole scope shipped,
nothing cut.

- **Essay planning organizer** (headline). A new optional closing page:
  a thesis line with a level-appropriate sentence-frame hint, a
  three-body-paragraph planning grid (claim / which documents support it
  / strongest evidence), a counterargument box, and a conclusion line.
  The document slots are built from the packet's *actual* sources, not
  placeholders: the page lists "Source A &mdash; A Factory Inspector's
  Report, Source B &mdash; &hellip;" and every grid row offers that
  packet's own letters as check boxes. It is on by default when the
  packet has an essay prompt, and off for an older packet that has none,
  so nobody's saved packet silently grows a page.
- **Scoring rubric page** (headline). An editable criteria&times;levels
  grid seeded with plain 7th-grade DBQ wording (thesis/claim, use of the
  documents, outside knowledge, organization and writing) across four
  levels. Every header and cell is a live input, criteria can be added or
  removed, and "Reset to the starter rubric" comes back. It prints either
  as the full four-level grid with a total/comments line, or as a
  student-facing checklist built from the "meets" column plus a teacher
  comments block. Opt-in, so it never appears in an existing packet by
  surprise.
- **Differentiation levels** (supporting 1), exactly per the toolkit
  spec: `Academic` / `Honors` / `Honors GT`, defaulting to Honors.
  **Honors output is byte-identical to what this tool printed before
  this round** &mdash; verified by rendering the pre-round file and the
  new one side by side in headless Chromium and string-comparing
  `#printArea.innerHTML` (identical). Academic adds, to the same
  questions, a "before you read" gloss of 2&ndash;3 hard words taken from
  that source's own text, a sentence starter under each question matched
  to how the teacher worded it, the essay prompt chunked into numbered
  steps, and pre-filled paragraph frames in the organizer. Honors GT
  drops the frames and adds an outside-evidence row, a "whose voice is
  missing from this packet?" question, and a so-what push on the essay
  page. "Print all three levels" emits all three class sets in one pass
  (21 pages for the example packet), each page footer-tagged with its
  level; a single-level print stays untagged, which is what keeps the
  Honors baseline unchanged.
- **Send a source to Primary Source Analysis** (supporting 2) &mdash; the
  P7 pairing the backlog has named since the first build, finally built.
  Text sources get an "Analysis worksheet &rarr;" button that encodes
  028's own round-1 `?worksheet=` payload with the same
  `_shared/state-link.js` encoder 028 uses, on 028's SOAPSTone framework
  (its written-source framework; OPTIC is for visuals and only text comes
  through here), and opens 028 in a new tab. Title, text, and citation
  travel; image pixels stay behind, matching both tools' share rules.
- **Extended smoke suite** (supporting 3):
  `Tools/dbq-source-packet-builder/test/smoke-essay-levels.mjs`
  (`npm run test:dbq`, appended to the root `test` chain) &mdash; 78
  assertions covering page order, the organizer naming real sources,
  the rubric appearing/vanishing/printing edits/printing as a checklist,
  gloss and starters present at Academic and absent at Honors, the GT
  extras, the 21-page footer-tagged all-levels run, level and toggles
  surviving a reload, and the 028 handoff URL both decoding as a valid
  028 payload *and* actually opening in 028 with the source text in it.

**Round-1 links keep working.** The share payload gained `level`,
`organizerEnabled`, `rubricEnabled`, and `rubric`; the validator treats
all four as optional-but-shaped, the same way 028's worksheet validator
handles its own additive fields. A round-1 link (none of those keys) is
asserted in the suite to still import, land on Honors, default the
organizer on because it has an essay prompt, and leave the rubric off.

**Hardest part:** deciding what "Honors is the baseline, unchanged"
actually has to mean once footer tags exist. Tagging every printed page
with its level is the obviously useful thing, and it would also have
quietly changed every existing packet's output. Splitting it &mdash;
tags only in the all-levels run, never in a single-level print &mdash;
keeps both promises, and the byte-comparison against the pre-round file
is what proved it rather than eyeballing a PDF.

**Shared-code note:** the level selector, the three exact level names,
and the footer-tag pattern are going to exist in several tools after
this round (028 built its own in parallel). That is a real
`_shared/` extraction candidate &mdash; a tiny `levels.js` with the
names, the default, and a `levelTag()` helper &mdash; but `_shared/` is
off-limits during a parallel round, so it is logged here and in
`_site-requests.md` instead. The word glossary in this tool
(~60 social-studies terms) is the other obvious candidate: any tool that
wants an Academic-level vocabulary gloss will want the same list.

**Where the next round should pick up:** the source bank/library is now
the last big unbuilt item from the Moonshot, and it is the one that
would remove the biggest recurring cost (re-uploading the same documents
every year). With 028 gaining a library this round, the cleaner move may
be a *cross-link* rather than a second library here: pull a source out
of 028's library into a packet, reusing the link format this round
already speaks in the other direction. Smaller follow-ons worth a
backlog row: an organizer with a teacher-set number of body paragraphs,
and letting the rubric ride into 028 alongside a source.

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
- An optional essay planning organizer page (thesis, a three-paragraph
  planning grid built from the packet's own source letters and titles,
  counterargument, conclusion), on by default when there is an essay
  prompt
- An optional scoring rubric page: an editable criteria&times;levels
  grid seeded with 7th-grade DBQ wording, printable as the full grid or
  as a student checklist
- Three levels (Academic / Honors / Honors GT) that change the printed
  packet, not the editing screen: Academic adds a word gloss, sentence
  starters, chunked prompt steps, and organizer frames; Honors GT drops
  the frames and adds outside evidence, a missing-voice question, and a
  so-what push. "Print all three levels" runs all three class sets in
  one go, footer-tagged
- Send any text source to Primary Source Analysis as a full SOAPSTone
  worksheet in one click
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

- ~~**Direct integration with Primary Source Analysis Worksheet
  Generator**~~ — **done, SS demo round 2 (`vn8trq`)**: a text source
  becomes a full SOAPSTone worksheet in 028 in one click, via 028's own
  share-link format. The remaining half of the pairing is the other
  direction (pull a source *out* of 028's library into a packet).
- ~~**A source bank/library**: save individual sources (not whole packets)
  to a personal library~~ — **done, 2026-08-14** (session `c1jqjp`). Stored
  under its own key, deliberately outside every packet document; a packet's
  source records which library entry it came from, so a later edit updates
  that entry instead of making a second one. See the Status entry.

No Major Features remain open. The clearest remaining work is the reverse
direction of the 028 pairing — see "Where the next round should pick up"
under the 2026-08-14 entry.
- ~~**JSON export/import**~~ — **done, SS demo round (`xo4v63`)**, for
  sharing a built packet with another social studies teacher on the
  same team or across a department.
- ~~**Difficulty/scaffolding levels**~~ — **done, SS demo round 2
  (`vn8trq`)**, and the Open Question below is answered: it was worth
  building as a first-class feature, because "same questions, more
  support" turned out to be generatable from the teacher's own text (a
  glossary hit on their words, a starter matched to their question
  wording) without the tool ever rewriting a historical document. What
  was *not* built, deliberately, is a simplified-language version of a
  source — that really does need source-specific human judgment.

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
