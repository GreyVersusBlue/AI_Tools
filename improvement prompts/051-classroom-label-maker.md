# Improvement Prompts — 051 — Classroom Label Maker (Target Language)

**Tool file:** `Tools/051-classroom-label-maker.html`
**Support folder:** `Tools/classroom-label-maker/` — `lib/qrcode.js` (vendored, same library used by Gallery Walk QR Codes, QR Scavenger Hunt Builder, etc.), `speak.html` (pronunciation companion page)

**Current description (from README):** Paste a target-word/English vocabulary list and print small labels each with a QR code linking to a browser-text-to-speech pronunciation page, plus a plain reference sheet.

---

## Status

**2026-08-12 — Backlog round: multiple named saved lists shipped (backlog
rank 3).** The tool adopted the New/Duplicate/Rename/Delete multi-save
convention, copied from `047-art-critique-worksheet-generator.html`
(same `listNames`/`saveNamed`/`loadNamed`/`deleteNamed`/`uniqueName`
store shape and the same switcher-select + name-field + three-buttons
card). New keys: `clm_lists_v1` (name list), `clm_list_v1:<name>` (one
blob per list), `clm_current_v1` (last-open). Each list carries its own
words **and its own language** — a Spanish room set and a French unit set
coexist with the right pronunciation each. The old single-list keys
(`clm_words_v1`/`clm_lang_v1`) are migrated on first load into a named
list called "My Labels" (words + saved language both carried over; the
legacy keys are left in place, harmless, in case an old cached page ever
reads them). Rename is the name-field-on-change pattern; deleting the
last list drops you into a fresh empty one; names are uniqued with
" (2)"-style suffixes on collision.

Verified with a headless Chromium test over a local static server:
legacy-key migration (words, count, and fr-FR language all arrive),
new-list isolation (each list keeps its own words and language across
switches), duplicate, rename (old name gone from the switcher), delete,
current-list persistence across reload, the print path still rendering
non-blank QR canvases, and a fresh browser booting to an empty
"New Label List" — zero console errors. Where the next round should pick
up: per-word language override and voice selection are the open ideas.

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from
the Ideas Backlog. The backlog description names a QR-code-to-audio-clip
feature, which sounds like it needs a server to host audio files — this
toolkit has neither a server nor any hosted audio anywhere. Instead, this
build delivers the same end-user outcome entirely client-side: each
label's QR code encodes a link to a tiny companion page
(`classroom-label-maker/speak.html?text=<word>&lang=<code>`) that uses the
browser's built-in `speechSynthesis` API to speak the word aloud when a
phone opens it — no audio files, no server, nothing hosted beyond the
static site itself. A language dropdown (10 common languages) sets the
`lang` code used both for speech synthesis and remembered across visits.
Print output is a grid of small labels (target word + English + QR code)
plus a plain reference sheet of the whole list on a second page. Verified
with a headless Chromium smoke test covering both pages — the main tool
(save a word list, print, confirm QR canvases actually render non-blank
pixels) and the `speak.html` companion (loads with the right word/lang
from query params, play button works) — no console errors on either page.

**A real, load-bearing constraint documented in the tool itself:** the QR
code encodes an absolute URL built from `location.href` at print time. If
someone opens this tool from a local file (`file://...`) instead of the
live hosted site, the QR code will encode a `file://` URL that won't
resolve on a phone scanning it from across the room — this only works
correctly when the site is actually deployed at its live address. A
hint to this effect is shown directly under the language picker.

**2026-08-11 — Round 1 (session `8vo65u`).** Shipped two of the four Quick
Wins. Added a "Test ▶" link in a new third column of the word table, next
to every saved word — opens `speak.html` directly in a new tab with that
word's text and the currently-selected language, so a teacher can check
pronunciation quality before committing to a print run of 30 labels. The
links stay in sync with the language picker (switching languages
re-renders the table so every test link points at the newly-selected
language). Replaced the small under-the-picker hint with an actual
warning banner (red background, bold text) that appears at the top of the
page whenever `location.protocol === 'file:'`, spelling out exactly why
the printed QR codes won't work in that mode — the small hint line stays
too, for the in-context detail once someone's already looking at the
language picker. Verified with a headless Chromium smoke test: saved two
words, confirmed both test links render and point at `speak.html` with
the right `text=` param, and confirmed the warning banner is visible when
the tool is opened via `file://` (as it always is in this environment) —
no console errors.

Per-word language override and multiple named saved word lists were not
built this round — see "Where the next round should pick up" below.

## What it does today

- Paste `target: english` vocabulary pairs, one per line
- **Multiple named saved lists** (`clm_lists_v1` / `clm_list_v1:<name>` /
  `clm_current_v1`) with New/Duplicate/Rename/Delete, each list keeping
  its own words and language; the pre-multi-save single list migrates in
  automatically as "My Labels"
- Language picker (10 common languages) drives pronunciation, saved per list
- **"Test ▶" link per word**, opening the pronunciation companion page
  directly so a teacher can check it before printing
- **Prominent `file://` warning banner**, in addition to the existing hint
  line, when the QR-code pronunciation feature won't work as printed
- Print: label grid (word + English + QR code) + a plain reference sheet
- QR codes link to a same-site companion page that speaks the word aloud
  via the browser's built-in text-to-speech, entirely client-side

## Quick Wins

- **Per-word language override** — right now one language applies to the
  whole list; a classroom sometimes mixes vocabulary from two related
  languages or wants to spot-check a word in a dialect variant.
- **Done — 2026-08-12.** **Multiple named saved word lists**, matching the
  multi-save convention used by most builder tools in this round. *(Shipped
  with per-list language and legacy migration — see Status.)*

## Major Features

- **Voice selection**, not just language code — `speechSynthesis` exposes
  multiple voices per language on most systems (different accents,
  genders), and letting a teacher pick a specific voice (with a live
  preview) would improve pronunciation quality noticeably over the
  browser's default choice for that language code.
- **Bulk QR-sheet printing at scale**: for a whole-classroom labeling
  project (20+ objects), verify and if needed adjust the print layout to
  handle larger lists gracefully across multiple pages (the grid should
  already paginate via normal CSS grid wrapping, but this hasn't been
  stress-tested past a handful of words).
- **Cognates & False Friends Reference List Builder integration** — the
  Ideas Backlog lists that as a separate, related World Language tool;
  sharing the paste-a-vocabulary-list UI pattern (or even letting one
  feed the other) would avoid rebuilding similar input UI twice.
- **Offline-capable pronunciation fallback**: detect when `speechSynthesis`
  has no voice installed for the requested language (common on some
  Android/Chrome OS setups) and show a clear message rather than silently
  speaking in the wrong accent or not at all.

## Moonshot / North Star

**A classroom label system where every physical object's QR code reliably
speaks the word in a good voice, works the instant the site's real URL is
known, and warns clearly the one time it can't (local file mode).** Voice
selection with a live preview closes the biggest quality gap (browser
default voices vary a lot); a prominent file:// warning turns a silent
failure into an actionable one; and multiple saved lists mean this tool
scales from "a dozen objects in Spanish 1" to "every classroom vocabulary
unit all year," in every language a program teaches.

## Platform themes that matter here

- **P7 (cross-tool)** — potential overlap with Cognates & False Friends
  Reference List Builder's vocabulary-input UI; reuses the QR-drawing
  pattern already established across Gallery Walk QR Codes, QR Scavenger
  Hunt Builder, and QR Code Generator.
- **P6 (print quality)** — untested at larger word-list sizes; worth a
  deliberate check once real classroom-sized lists (20-40+ objects) are
  tried.
- **P15 (first run)** — the file:// constraint is the single biggest
  first-run trap for this specific tool, more so than most tools in this
  toolkit, precisely because it depends on the site's own hosted identity
  to function at all. **Partially addressed in Round 1** with the
  prominent warning banner; the "print anyway or block it" question below
  is still open.

## Open Questions

- Is voice selection (not just language code) worth the UI complexity of
  enumerating `speechSynthesis.getVoices()` (which loads asynchronously
  and varies significantly by browser/OS), given the language-code
  approach already produces a functional, if not always ideal-sounding,
  result?
- Should the file:// detection actively disable/grey out the print button
  with an explanation, or is a visible warning (current approach) combined
  with letting the teacher print anyway (e.g. for local reference use
  without QR functionality) the more flexible default? Round 1 kept the
  "warn but don't block" approach — the banner is prominent now, but
  printing is still always allowed.

## Where the next round should pick up

Multiple named saved word lists is the natural next step (same pattern as
Art Critique Worksheet Generator's Round 1, or Rubric Builder's
`rb-store.js`). Per-word language override is the other open Quick Win.
Also worth folding in when either of those is touched: this tool's
`buildQR`/`drawQR` are now duplicated across three tools (this one,
Gallery Walk QR Codes, Art Portfolio Label Maker) — see 048's Round 1 note
on promoting them into a shared `lib/qrcode.js`.
