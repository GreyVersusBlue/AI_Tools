# Improvement Prompts — 079 — Verb Conjugation Reference Poster Generator

**Tool file:** `Tools/079-verb-conjugation-poster-generator.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Spanish, French, or blank starter templates of verb-group conjugation panels with editable subject/person labels, printed as a large-font wall poster.

---

## Status

**2026-08-10 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: three starter templates (Spanish present tense, Spanish
preterite, French present tense), each with editable subject/person labels
(reusing the same 6-row default person list as Vocab & Conjugation Drill
Generator) and editable "panels" (one per verb group/tense, e.g. "-AR:
hablar"), rendered on print as a large-font, high-contrast, multi-panel wall
poster distinct from the drill worksheets. Single current poster autosaved
to `localStorage` (`vcp_poster_v1`). Verified with a headless Chromium smoke
test (template swap with confirm-dialog accepted, add a panel, print) — no
console errors. One bug was caught and fixed during the build: template
titles originally used the literal HTML entity text `&mdash;` inside a
JS string destined for an `<input>` value (not HTML-parsed there), which
would have displayed as literal "&mdash;" instead of an em dash — fixed by
using the actual em dash character in the JS string literals.

Nothing below has been started.

## What it does today

- 3 starter templates (Spanish present, Spanish preterite, French present)
  plus a blank/custom option
- Editable subject/person labels, shared across all panels on one poster
- Editable panels (verb group name + one form per person)
- Print: large-font, two-column poster layout sized for a wall, distinct
  styling from the toolkit's worksheet-style print views

## Quick Wins

- **More starter templates** — irregular verbs (ser/estar, avoir/être),
  more tenses (imperfect, future, conditional), and other commonly-taught
  languages (German, Italian) are the highest-value next content addition.
- **Multiple named saved posters**, matching the multi-save convention in
  Formula Sheet Builder / Rubric Builder — right now one poster per
  browser, so a present-tense poster and a preterite poster can't both be
  kept ready.
- **Column-count control** (1, 2, or 3 panels per row) since the print
  layout is fixed at 2 columns regardless of how many panels exist — a
  single-panel poster and a 6-panel poster both want different layouts.
- **A color-code option per panel** (e.g. one accent color per verb
  ending group) to make the poster easier to scan from across a room,
  which is the whole point of a wall reference.

## Major Features

- **Irregular verb call-out boxes** — a small side panel per poster
  listing 3&ndash;5 common irregular verbs in that tense, since regular
  patterns are only half of what a wall reference needs to be useful.
- **JSON export/import**, for sharing a built poster with another teacher
  on the same team, or backing one up before a school year ends.
- **A "shrink to fit one page" print mode toggle** — right now font sizes
  are fixed; a poster with many panels could benefit from auto-scaling
  instead of manual tuning, while a single-panel poster might want to go
  even bigger for genuine across-the-room legibility.
- **Audio pronunciation via QR code per panel**, reusing the pattern the
  backlog's separate Classroom Label Maker idea calls for (QR &rarr;
  text-to-speech clip) — would make this poster double as a
  self-check pronunciation reference, not just a visual one.

## Moonshot / North Star

**A wall-poster library for every tense and irregular-verb group a language
teacher needs, colour-coded for at-a-glance scanning, that survives year to
year as named saves.** More starter templates close the content gap fastest;
irregular-verb call-outs make a "regular pattern" poster into a genuinely
complete reference; and saved named posters mean building once and reusing
every year the same unit comes around.

## Platform themes that matter here

- **P7 (cross-tool)** — shares subject/person-label conventions with
  Vocab & Conjugation Drill Generator; QR-to-audio would share ground with
  the backlog's Classroom Label Maker idea and this toolkit's existing
  QR Code Generator / Gallery Walk QR patterns.
- **P6 (print quality)** — column-count control and shrink-to-fit are both
  pure print-layout work on an already-functional poster.
- **P15 (first run)** — more starter templates lower the barrier for a
  teacher who doesn't want to type six conjugated forms per panel by hand.

## Open Questions

- Is per-panel color-coding worth the complexity of a color picker in the
  builder UI, or would a small fixed palette (assign colors round-robin by
  panel position, no picker needed) get most of the visual-scanning benefit
  for much less UI?
- Should irregular verbs live as an optional add-on section within the same
  poster/panel model, or does "irregular verb reference" deserve its own
  distinct template type given how differently they're taught (usually
  memorized individually, not by pattern)?
