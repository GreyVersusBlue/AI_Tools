# Improvement Prompts — 051 — Classroom Label Maker (Target Language)

**Tool file:** `Tools/051-classroom-label-maker.html`
**Support folder:** `Tools/classroom-label-maker/` — `lib/qrcode.js` (vendored, same library used by Gallery Walk QR Codes, QR Scavenger Hunt Builder, etc.), `speak.html` (pronunciation companion page)

**Current description (from README):** Paste a target-word/English vocabulary list and print small labels each with a QR code linking to a browser-text-to-speech pronunciation page, plus a plain reference sheet.

---

## Status

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

**2026-08-11 — Pass 2, directed round (session `szyio3`).** Shipped both
Quick Wins the file's own "biggest first-run trap" note pointed at:
a **"Test pronunciation" link per word** in the editable table (opens
`speak.html` in a new tab with that word's actual QR-encoded URL, so a
teacher can verify pronunciation quality before printing 30 labels), and a
**prominent file:// warning banner** replacing the small hint line — now a
full-width amber banner that appears only when `location.protocol ===
'file:'`, explaining plainly that every QR code on the page will encode a
dead link in that mode. Verified with a headless Chromium pass: confirmed
the banner is hidden when served normally and shown when opened via
`file://` (the same protocol this repo's own smoke tests run under), and
confirmed each word row's test link resolves to the correct
`speak.html?text=...&lang=...` URL — no console errors.

## What it does today

- Paste `target: english` vocabulary pairs, one per line
- Language picker (10 common languages) drives pronunciation
- Print: label grid (word + English + QR code) + a plain reference sheet
- QR codes link to a same-site companion page that speaks the word aloud
  via the browser's built-in text-to-speech, entirely client-side

## Quick Wins

- ~~A "test this QR code" link/button~~ — **shipped 2026-08-11.**
- **Per-word language override** — right now one language applies to the
  whole list; a classroom sometimes mixes vocabulary from two related
  languages or wants to spot-check a word in a dialect variant.
- **Multiple named saved word lists**, matching the multi-save convention
  used by most builder tools in this round — one flat list per browser
  right now.
- ~~A visible warning banner~~ — **shipped 2026-08-11**, replacing the
  small hint line with a full-width amber banner shown only when
  `location.protocol === 'file:'`.

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
  to function at all.

**Where the next round should pick up:** multiple named saved word lists is
the remaining Quick Win and matches this round's pattern used in 047/048/052
(worksheet/portfolio/list selector with New/Duplicate/Rename/Delete) closely
enough to copy directly; voice selection under Major Features is the
biggest remaining quality gap.

## Open Questions

- Is voice selection (not just language code) worth the UI complexity of
  enumerating `speechSynthesis.getVoices()` (which loads asynchronously
  and varies significantly by browser/OS), given the language-code
  approach already produces a functional, if not always ideal-sounding,
  result?
- Should the file:// detection actively disable/grey out the print button
  with an explanation, or is a visible warning (current approach) combined
  with letting the teacher print anyway (e.g. for local reference use
  without QR functionality) the more flexible default?
