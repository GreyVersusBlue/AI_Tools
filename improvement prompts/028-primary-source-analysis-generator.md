# Improvement Prompts — 028 — Primary Source Analysis Worksheet Generator

**Tool file:** `Tools/028-primary-source-analysis-generator.html`
**Support folder:** none — single file

**Current description (from README):** Builds a printable OPTIC or SOAPSTone worksheet around a described or pasted-in source, with an answer key from your own notes.

---

## Status

**2026-08-14 — SS demo round 2 (session `kx9rtm`): Differentiation levels —
this tool is the reference implementation of the site-wide three-level
switch.** Devon teaches Academic, Honors, and Honors GT sections of the same
course; tools 054 and 056 copy this pattern, so the spec-visible parts
(option names, the Honors default, the footer tags) are exactly as the round
prompt states.

- A **Level selector** (`Academic` / `Honors` / `Honors GT`, `state.level`,
  default `honors`) stored with the worksheet. **Honors is the untouched
  baseline** — at that level not one line of the new markup renders, so a
  plain worksheet prints byte-for-byte what it printed before this round.
  That is the first assertion block in the new suite, not an assumption.
- **Academic** adds support around the *same* questions, never fewer or
  lower-level ones: every multi-part prompt is split into lettered steps
  (`a.`, `b.`, `c.` — the OPTIC Overview step really is an instruction
  followed by a question, and now reads that way), each part that a student
  actually answers gets a **sentence starter derived from the question's own
  words**, and hard words from the teacher's own source text are glossed in
  plain language in a **Words to know** box.
- Starters are generated, not canned. `sentenceStarterFor()` finds the
  operative question (the last sentence ending in `?`) and runs an ordered
  rule table over it, so "What is the overall scene or setting?" becomes
  "The overall scene or setting is ___ / I can tell because ___". Two
  grammar bugs were caught by reading the actual printed output rather than
  the DOM: a rule that reassembled "What does it reveal about…?" into "It
  reveal about ___" (deleted — only the `what is the <noun phrase>` shape can
  be safely reassembled, everything else takes the generic frame), and
  imperative tasks like "Identify two or three details" getting no starter at
  all because they don't end in a question mark. Both are now asserted
  against.
- **Honors GT** adds extension: a per-step open-ended **"Go further:"** prompt
  (`GT_EXTENSIONS`, 28 hand-written entries keyed by step key, which the six
  frameworks share heavily, plus a label-derived fallback), the closing
  **synthesis question** ("So what? Why does this source matter beyond its
  moment?"), and less pre-lined space (`answerLineCount()` drops by two).
- Works in **both single-source and corroboration modes** — the level is
  applied in `stepQuestionsHtml()`, which both shapes route through, the
  comparison block gets Academic starters, and the glossary scans Source B's
  text too. Verified for both.
- The **answer key** gains a `.level-note` describing what a complete answer
  looks like at the level in force, and the synthesis teacher-note field is
  always editable (not only when the level happens to be GT) so
  print-all-three never hands back a GT key with an empty synthesis section.
- **Print all three levels** (`state.printAllLevels`) renders Academic,
  Honors, and Honors GT back to back, each on a fresh page, each tagged with
  a `.level-tag` chip at the top and a `.level-footer` at the bottom. It
  works for the answer key as well as the student worksheet. The live preview
  shows all three when it is on, which is also the clearest way to demo the
  feature. **Tradeoff worth knowing:** the tag is per *set*, not per physical
  *page* — Chrome supports neither `@page` margin-box content nor a reliable
  repeating footer inside this tool's `position: absolute` print root, so a
  set that runs to three sheets carries its level on the first and last of
  them, not all three. Good enough to sort piles; worth revisiting if anyone
  complains.
- The **share link** carries the level automatically (the payload copies all
  state keys). The validator was made *more* permissive, not less:
  `level` / `callouts` / `synthesisNotes` are optional and loosely typed, and
  an unrecognized level normalizes to the Honors baseline at load rather than
  rejecting the whole worksheet. Round-1-format links (no level field at all)
  and 056-generated links both keep working, asserted with a hand-built
  legacy payload and a payload carrying the display name `"Honors GT"`.

Supporting items, all three shipped:

1. **Tagged source library** (`gvb-primary-source:library`) — save Source A or
   B on its own with free-text tags, filter the list by tag, and pull an entry
   into Source A or Source B of any worksheet instead of retyping it. Images
   are the already-downscaled ones (1600px long edge, JPEG); a quota-exceeded
   write is reported instead of silently losing the source, and the panel
   warns once the library passes ~2.5MB. **No change was needed in
   `009-backup-restore.html`** — it registers the whole `gvb-primary-source:`
   prefix, so the new key is already backed up.
2. **Annotation callouts** — up to four teacher-chosen excerpts get a numbered
   marker spliced into the printed source text and a matching numbered
   "look closely" question underneath, with a real default question when the
   teacher leaves it blank and a "(line N)" pointer when line numbering is on.
   Markers are spliced into the *escaped* string so an excerpt containing
   `&` or `"` still matches, and with no callouts the output is identical to
   `escapeHtml(text)` — the no-callouts path is the old path.
3. **Extended smoke suite** — new
   `Tools/primary-source-analysis-generator/test/smoke-levels.mjs`, 106
   assertions, appended to `test:primary-source`.

Also fixed on the way: **Source B's type dropdown was never populated.**
`buildSourceTypeSelect()` only ever filled Source A's select, so the
corroboration Source B "Type" control rendered empty. Printing was unaffected
(it reads `state.sourceBType`, not the DOM), which is why it survived a round.
Both selects are built from the same list now.

What was hard: nothing structural, but two things are worth passing on.
First, **the DOM being right is not the same as the worksheet reading right** —
both starter bugs above passed every structural assertion and only showed up
when the printed text was dumped and read as a teacher would. Second, the
round-1 suite selected the comparison notes block positionally
(`steps[steps.length - 1]`), which broke the moment a synthesis block was
appended; the notes editor blocks now carry `data-note-block` /
`data-step-key` hooks and both suites address them by attribute.
`sw.js` needed no change again — only a `test/` folder was added, which the
precache list excludes for every tool — and so `CACHE_VERSION` was not bumped.

**Where a future round should pick up:** the DBQ / multi-source packet is
*still* the biggest lever and is now genuinely tool 056's territory, so the
real question is whether this tool should hand off to it rather than grow.
Nearer term: the level tag is per-set rather than per-page (above); the source
library has no export/import of its own, so a teacher moving machines has to
carry it through 009's whole-site backup; and image crop/zoom with a detail
callout is the natural next step now that numbered callouts exist for text.
A **cross-tool extraction opportunity**: `normalizeLevel` / `LEVELS` /
`withLevel` and the level tag and footer CSS are the parts 054 and 056 will
copy verbatim — once all three have shipped, that is a real candidate for
`_shared/levels.js`, and nothing was extracted this round only because
`_shared/` is off limits to a parallel session.

**2026-08-13 — SS demo round (session `qzmvhx`): Corroboration mode shipped
(backlog rank 3).** Two sources, one worksheet — stays inside the existing
single-worksheet shape rather than becoming a multi-source list (that's the
DBQ / Source Packet Builder's territory, tool 056):

- A **"Compare with a second source"** checkbox (`corroborationMode`) reveals
  a Source B card: title, type, description, pasted text, image URL/upload
  (same downscale-and-warn path as Source A), and its own citation
  (author/date/origin). Off by default — a plain worksheet is byte-for-byte
  unchanged from before this round.
- **On, the print worksheet changes shape**: both sources render side by side
  (`.sources-row`, two `.source-box`es, each labeled "Source A" / "Source B");
  every framework step keeps its shared questions once, then prints **two**
  answer areas side by side (`.dual-answer-row`) — one per source — instead
  of one; and a fixed **comparison block** closes the sheet: where the
  sources agree, where they disagree, which is more reliable and why. None of
  this is framework-specific, so it works under any of the six frameworks.
- The **answer key** mirrors this: per-step teacher notes are now tracked
  separately per source (`state.notes` for A, a new `state.notesB` for B),
  both printing side by side on the key, plus a **comparison key** section
  (`state.comparisonNotes`) for the three closing questions. The notes editor
  UI grows a second textarea per step and a closing "Comparing the sources"
  block only when corroboration mode is on.
- **Load Boston Massacre example** (P15): one click loads a real two-source
  pair (a description of Paul Revere's 1770 engraving vs. a paraphrased
  British soldier's account of the shooting, both written for this tool, not
  reproduced verbatim from any source), turns corroboration mode on, and
  picks the HIPP framework (works for a text+visual pair, unlike SOAPSTone or
  OPTIC alone). Asks for confirmation first if the current worksheet already
  has source content or notes worth losing.
- The **share link** carries every corroboration field except the two
  possible uploaded images (`imageDataUrl` and the new `sourceBImageDataUrl`)
  — consistent with how Source A's image already stayed off the link.
  `isPlausibleWorksheet()` now also accepts (but doesn't require) `notesB`
  and `comparisonNotes`, so old exports/links without them still import.
- **First automated test**: `Tools/primary-source-analysis-generator/test/smoke-corroboration.mjs`
  (new `test:primary-source` npm script, appended to the main `test` chain).
  42 assertions: mode off by default still prints exactly one source and no
  comparison block; on, both sources + dual answer rows + comparison block
  render in the print DOM on both the blank worksheet and the answer key
  (with real per-source and comparison teacher notes verified in the printed
  key text); the example button's confirm-before-replace gate; and a full
  share-link round trip carrying Source B's text/citation and the
  comparisonNotes teacher key content to a second browser context. Zero
  console errors, nothing left the site.

What was hard: nothing structural, mostly careful additive design — the
biggest risk was accidentally changing what a *non*-corroboration worksheet
prints, so `sourceBoxHtml()`/`stepBlockHtml()` branch explicitly on
`state.corroborationMode` and the "off" path is untouched code, verified by
the first assertion block in the new test. No new localStorage keys were
needed (everything lives inside the existing per-worksheet blob), so
`009-backup-restore.html` needed no changes. `sw.js` also needed no changes —
no new production file was added, only a `test/` folder, which the precache
list already excludes for every other tool.

**Where a future round should pick up:** the DBQ / multi-source packet
(three or more sources) is still the single biggest lever and was explicitly
left alone this round per scope; a source library and image crop/zoom are
also still open. If corroboration mode gets used a lot, the biggest
follow-up is probably real page-space testing with two large uploaded images
at once — this round's side-by-side layout caps each image at 2in tall in
`.sources-row` but hasn't been checked against a genuinely tall two-image
pairing under `@page` letter-portrait print margins.

**2026-08-12 — Backlog round: share worksheet by link / QR shipped (backlog
rank 1).** The tool now loads `_shared/state-link.js` and the site's vendored
QR encoder (`_shared/vendor/qrcode/qrcode.js`) and grew two toolbar buttons —
**🔗 Copy link** and **▦ QR code** — copying the pattern already shipped in
`040-vocab-flashcard-generator.html` almost verbatim (same payload/notes/
overlay shapes, same `?param=` consume-on-load flow):

- The share payload is the whole worksheet state **minus `imageDataUrl`** — an
  uploaded image is base64'd and can run past a megabyte, far beyond what a
  URL or QR carries. When an uploaded image exists, the share note says
  explicitly that the image stays behind and points at Export worksheet for
  the send-everything path. `imageUrl` (a mere reference) travels fine.
- Opening a `?worksheet=` link validates with the existing
  `isPlausibleWorksheet()`, saves under a uniqued name (`… (shared)` when the
  name collides), loads it, and calls `StateLink.clearParam()` up front so a
  refresh can't double-import. A garbled link shows a friendly error and the
  tool boots normally.
- QR overflow (long pasted sources) is caught and reported with the payload
  size rather than drawing an unscannable code.

What was hard: nothing structural — the tool already had saved-worksheet
plumbing and an import validator, so this was wiring, not surgery. Verified
with a headless Chromium test over a local static server: copy-link round
trip into a fresh browser context (name, source text, framework, citation all
arrive; param cleared; reload doesn't duplicate), name uniquing on a second
import, QR overlay drawing and Escape-to-close, and the bad-payload error
path — zero console errors. Next round picks up where the last one said:
the DBQ / multi-source packet is still the biggest open lever.

**2026-08-10 — Round 5 (PR #56): four Quick Wins shipped, plus one
pre-existing bug fixed.** Found that **APPARTS and 5 W's frameworks already
existed** in the source (this file was stale on that point) — this round
added two more: **HIPP** (Historical Context / Intended Audience / Purpose /
Point of View — the AP/IB sourcing framework) and **See-Think-Wonder** (a
visible-thinking routine for younger students or a first look at a visual
source), bringing the total to six frameworks.

- **Done — Source citation block.** Three new optional fields (author/
  creator, date created, where it's from) print as a single italic citation
  line under the source box — modeling real citation practice, which was
  entirely absent before.
- **Done — Line numbering.** A checkbox switches the pasted source text from
  a plain block to a numbered-gutter layout (one number per line), so a
  class can reference "line 12" when discussing a document together.
- **Done — Vocabulary / glossary box.** A new textarea (same tolerant
  `word: definition` parsing used elsewhere on the site, e.g.
  `027-novel-study-circles-manager.html`'s vocab log) renders a small glossary
  box under the source.
- **Fixed — stale framework whitelist.** `isPlausibleWorksheet()` (the import
  validator) only accepted `framework === 'optic' || 'soapstone'`, silently
  rejecting valid exports using the already-shipped APPARTS/5 W's frameworks
  (and would have rejected HIPP/STW too). Now checks membership in the live
  `FRAMEWORKS` object instead of a hardcoded pair.

Verified with a headless Chromium smoke test: citation line, numbered-line
source text, and vocab box all render correctly together; all six framework
radio options present; HIPP and See-Think-Wonder both render their real step
labels and questions when selected. No console errors.

**Where a future round should pick up:** the DBQ / multi-source packet idea
(Major Features below) is the single biggest lever left in this tool and is
untouched — this round deliberately stayed inside the single-source shape
rather than take on that larger restructuring. Reading-support variant,
image cropping/zoom, a source library, and projected analysis mode are also
all still open.

## Pass 2 — Round 2 update — 2026-08-11 (session `mxpfjs`)

Two more Quick Wins shipped, both additive and fully wired:

- **Done — Reading-support version.** A new "Reading support (optional)" card
  adds an off-by-default checkbox that reveals two teacher-typed fields: a
  short **summary** (prints as a highlighted callout near the top of the
  worksheet, before the source box) and a **simplified paraphrase** of the
  source text (prints in its own box directly under the original source
  text). When the checkbox is off, the worksheet prints exactly as it did
  before this round — nothing renders even if the fields have saved text.
  The existing line-numbering checkbox is reused as-is (a hint next to the
  new toggle points teachers to it) rather than duplicated, since it already
  does the "text references" job this Quick Win asked for.
- **Done — Downscale and warn on image size (P12).** Uploaded source images
  are now run through a canvas resize (capped at 1600px on the long edge,
  re-encoded as JPEG at quality 0.82, matching the pattern already used by
  `Tools/timeline-builder/tlb-photo.js` and `Tools/seating-chart/scg-photo.js`)
  before being stored as the worksheet's `imageDataUrl`, instead of storing
  the raw uploaded file. A visible warning banner appears under the image
  preview if the resulting stored payload is still large (over ~1.5MB, a
  sizeable share of localStorage's ~5MB cap once the rest of the worksheet's
  data is counted) rather than failing silently later. This is the scoped
  "downscale + warn" fix, not the bigger IndexedDB migration P12 ultimately
  wants — that's still open.

**Testing:** `node --check` on both extracted inline `<script>` blocks.
Headless Chromium (`/opt/pw-browsers/chromium`) smoke test via `file://`
covering: reading-support fields hidden by default and only rendering when
the toggle is on; summary and paraphrase boxes appear correctly in both the
live preview and the actual print output; line numbering renders correctly
alongside the paraphrase box; toggling reading-support back off removes the
printed markup again. Separately: a normal-sized (800×600) uploaded PNG is
re-encoded to JPEG with no size warning; a large (4000×3000) uploaded PNG is
downscaled to a 1600×1200 JPEG; a high-entropy 1600×1600 PNG (resists JPEG
compression, to reliably exceed the warning threshold) triggers the visible
size warning, which then clears when the image is removed. Zero console
errors throughout. No test scripts were left in the repo.

**What remains open:** the DBQ / multi-source packet idea (still explicitly
deferred — it's the single biggest lever left and deliberately out of scope
for a scoped round), a source library, image cropping/zoom with a detail
callout, projected analysis mode, and corroboration exercises. See Major
Features below for the current, accurate list.

Ideas below are deliberately ambitious and are **not** scoped to a single
session. This is a social-studies-teacher's tool written by a social studies
teacher, and it has the most room to grow of any content tool on the site.

## What it does today

- **Framework picker** (`renderFrameworkPicker`) — OPTIC / SOAPSTone
  scaffolds, with per-step blocks (`stepBlockHtml`)
- Source block: pasted text, a description, or an **uploaded image**
  (`sourceBlockHtml`, `buildSourceTypeSelect`)
- **Teacher notes per step** (`renderNotesEditor`) that become an answer key
- Configurable answer line counts (`answerLineCount`)
- Print **student worksheet (blank)** and **answer key (with notes)**
  separately
- Saved worksheets (`gvb-primary-source:list` / `:current`) with
  import/export and validation (`isPlausibleWorksheet`)
- **Share by link / QR** (`_shared/state-link.js` + vendored qrcode encoder):
  copy a `?worksheet=` URL or show a scannable QR; opening one saves a
  uniquely-named copy. Uploaded images deliberately don't ride the link
  (size), with a visible note saying so
- **Corroboration mode** (`state.corroborationMode`): an optional Source B
  (text/description/image/citation) prints side by side with Source A under
  shared framework questions (`sourceBoxHtml`, dual answer areas via
  `stepBlockHtml`), plus a fixed comparison block (`comparisonBlockHtml`) —
  agree / disagree / more reliable — with its own answer-key section
  (`state.notesB`, `state.comparisonNotes`). A **Load Boston Massacre
  example** button fills a real two-source pair to try it immediately.
- **Differentiation levels** (`state.level`: `academic` / `honors` /
  `honorsgt`, default Honors). Academic chunks multi-part prompts into
  lettered steps, hangs a generated sentence starter under each
  (`sentenceStarterFor`, `starterLinesHtml`), and glosses hard words from the
  teacher's own source (`PLAIN_GLOSSARY`, `wordsToKnowHtml`). Honors GT adds a
  per-step "Go further" prompt (`GT_EXTENSIONS`) and a closing synthesis
  question (`synthesisBlockHtml`), with less ruled space. Applies in both
  single-source and corroboration modes and on the answer key, which states
  the expected depth for the level. **Print all three levels**
  (`state.printAllLevels`, `allLevelsHtml`) prints three tagged class sets in
  one flow.
- **Tagged source library** (`gvb-primary-source:library`): save a source on
  its own with free-text tags, filter by tag, and pull it into Source A or B
  of any worksheet.
- **Annotation callouts** (`state.callouts`, up to four): numbered markers
  spliced into the printed source text plus matching "look closely" questions,
  with a "(line N)" pointer when line numbering is on.

## Quick Wins

- **Partly done.** **More frameworks.** APPARTS and 5 W's already existed (this file
  was stale — they were built in an earlier round not reflected here); HIPP
  and See-Think-Wonder shipped this round. Still open: the NARA document
  analysis worksheets and a dedicated Corroboration/Sourcing/Contextualization
  set for historical thinking skills.
- **Done —** **Source citation block** — author, date, origin, where you found it —
  printed on the worksheet. Modelling citation is half the point of the
  exercise and it's currently absent.
- **Done —** **Vocabulary / glossary box** for a hard text, since primary sources are
  usually above grade reading level.
- **Done — Pass 2, Round 2.** **Reading-support version**: the same source with a summary
  sidebar, a simplified paraphrase field, or line numbers for text references.
- **Done —** **Line numbering** on pasted text — the single most useful formatting
  feature for discussing a document with a class.
- **Image cropping and zoom** for the uploaded source, plus a
  "detail callout" that prints an enlarged region next to the whole image.
- **Done — Pass 2, Round 2.** **Downscale and warn on image size** (P12).

## Major Features

- **Multi-source packets (DBQ).** `IDEAS_BACKLOG.md` lists a DBQ / Source
  Packet Builder as a separate tool; it is this tool with several sources and
  a shared set of guiding questions plus a synthesis prompt. Building it here
  is far less work than building it separately, and this tool's framework
  machinery is exactly what it needs.
- **Done — SS demo round 2, session `kx9rtm`.** ~~A source library.~~ Teacher-built collections of frequently-used
  sources, tagged by unit / topic / era, so building a worksheet starts from a
  source rather than a blank paste. Still open from the original idea: a
  *shipped* starter collection, and searching public-domain material
  in-browser the way `046-blank-map-generator.html` handles Wikimedia (P7).
- **Projected analysis mode.** The source shown large with the framework's
  questions revealed one at a time, for working through a document together
  as a class — the no-copier fallback, driven from the teacher's machine.
- **Done — SS demo round, session `qzmvhx`.** ~~Corroboration exercises.~~ Two sources on the same event, side by side,
  with "where do they agree, where do they conflict, why" — the actual
  historical thinking skill, and a natural extension of a two-source packet.
- **Timeline and map handoff** (P7). A source has a date and a place;
  `015-timeline-builder.html` and `046-blank-map-generator.html` both want them.
- **Answer key with sample student responses**, not just teacher notes — what
  a proficient answer looks like, which is what makes the key useful to a
  substitute or a co-teacher.

## Moonshot / North Star

**Turn any document into a full lesson in ten minutes.** Drop in a source —
text, image, cartoon, map, photograph — pick the analysis framework, and get a
scaffolded student worksheet with line numbers and vocabulary support, a
reading-support variant, a teacher key with sample responses, a multi-source
DBQ packet when you want one, and a projected walk-through version for the day
the copier is down. With the source's date and place flowing into the class
timeline and map.

## Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see `_platform-themes.md`). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Student-device worksheet.** A link or QR opening the source and questions
  on a student device with responses staying local. The projected analysis
  mode above covers the no-copier case.

## Platform themes that matter here

- **P7 (cross-tool)** — the DBQ builder on the backlog belongs here, and
  timeline/map handoff is natural for social studies.
- **P12 (storage/images)** — uploaded source images base64'd into
  `localStorage`.
- **P6 (print quality)** — line-numbered text, image detail callouts, and a
  worksheet that leaves the right amount of writing space.
- **P3 (share links)** — sharing a worksheet with a colleague or a co-teacher.

## Open Questions

- Should the DBQ builder be built here as a "multi-source" mode, or stay a
  separate backlog tool? Building it here is cheaper and keeps one place to
  look; a separate tool is more discoverable from the landing page.
- Is there a public-domain source library worth shipping (Commons, Library of
  Congress, National Archives are all searchable and free), and does searching
  them in-browser stay within the offline-first constraint the way
  `046-blank-map-generator.html` handles Commons?
