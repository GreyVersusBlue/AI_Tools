# Improvement Prompts — 079 — Verb Conjugation Reference Poster Generator

**Tool file:** `Tools/079-verb-conjugation-poster-generator.html`
**Support folder:** `Tools/verb-conjugation-poster-generator/` — test suite only;
the tool itself is still one self-contained file.

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

**2026-08-11 — Round 1 (session `h4rwxn`).** Shipped two of the Quick Wins
below. More starter templates: added 5 — Spanish imperfect, Spanish
future, Spanish irregulars (ser/estar present), French imperfect, French
irregulars (avoir/être present) — bringing the template select from 3 to
8 (plus blank/custom). Conjugations were hand-verified against standard
regular-verb paradigms and the two most commonly taught irregular-verb
pairs per language; not proofread by a native speaker. Conditional tense
and German/Italian are still gaps. Column-count control: a new "Print
layout" card lets a teacher pick 1/2/3 panels per row, applied via an
inline `grid-template-columns` on `.poster-grid` at print time; persisted
separately from the poster itself (`vcp_columns_v1` in localStorage, not
folded into the `vcp_poster_v1` blob, since column count is a print
preference independent of poster content and template-loading replaces
the poster state wholesale). Verified with headless Playwright: loaded
each new template and confirmed panel count and conjugated forms match
what was hand-written above, selected 1 column and confirmed both the
print DOM and the post-reload `<select>` value reflect it.

Multiple named saved posters, per-panel color-coding, irregular-verb
call-out boxes, JSON export/import, shrink-to-fit, and QR-to-audio all
remain unbuilt.

**2026-08-12 — Round 2 (backlog rank 2: per-panel accent colors).** Every
panel now prints with an accent — a colored border plus a tinted heading band
behind the verb-group name — so the -ER panel is findable from the back of
the room without reading it. Six accents ship; a panel left on **Auto** takes
the next one round the palette by position, and a per-panel picker in the
builder head overrides that. One "Color-code panels" checkbox in the Print
layout card turns the whole thing off. The builder mirrors each panel's
accent on its own block (swatch + border), so the poster's look is visible
before anything is printed.

This answers the round-1 Open Question — fixed round-robin palette or a
picker — with **both, cheaply**: round-robin is the default so nobody has to
choose anything, and the picker exists for the teacher who wants -AR to be
red every year. What made that affordable is that "Auto" is a stored value
like any other, not the absence of one, so the two paths are the same code.

Two things worth knowing for next time:

- **Print backgrounds are opt-in.** Browsers drop background fills when
  printing unless the element carries `print-color-adjust: exact`, so the
  tinted heading band silently prints blank without it. That rule is on
  `.poster-panel h3` (and the builder swatch) now.
- **Nothing is encoded in color alone** (P6). The panel name still says
  "-AR: hablar"; the accent is a finding aid on top of it. The six tints are
  spread far enough apart in lightness to stay distinguishable as grays off a
  black-and-white printer.
- **Posters saved before this round** carried neither `colorPanels` nor a
  per-panel `color`. `load()` fills both in with the same defaults a new
  poster gets and writes the result straight back, so an old poster gains
  accents rather than printing plain forever.

Auto assignment counts panel position, not "colors not already claimed by an
override" — pick purple by hand for panel 2 and an Auto panel can land on
purple as well. Left as-is: it takes four panels and a deliberate override to
see it, and the fix (assign Autos around the overrides) costs more than the
collision does.

Verified with a new 25-assertion headless Chromium suite,
`Tools/verb-conjugation-poster-generator/test/smoke-panel-colors.mjs`
(`npm run test:verb-poster`), asserting on the printed DOM rather than the
builder: distinct accents per panel, an override winning over Auto, the
override surviving a reload, the off switch returning every border to plain
black, a newly added panel joining the rotation, and the old-poster upgrade
path — no console errors.

**Next round should pick up** multiple named saved posters (still the top
Quick Win, and now more valuable — a color scheme is one more thing worth
keeping per poster), then the remaining content gaps (conditional tense,
German/Italian starters).

## What it does today

- 8 starter templates (Spanish present/preterite/imperfect/future/
  irregulars, French present/imperfect/irregulars) plus a blank/custom
  option
- Editable subject/person labels, shared across all panels on one poster
- Editable panels (verb group name + one form per person)
- Per-panel accent colors: six-color palette, auto-assigned by panel order,
  overridable per panel, switchable off site-wide for the poster; shown live
  in the builder and printed as a colored border plus tinted heading band
- Print: large-font poster layout sized for a wall, distinct styling from
  the toolkit's worksheet-style print views, with a chooser-controlled
  1/2/3-panels-per-row layout that persists across visits

## Quick Wins

- **Multiple named saved posters**, matching the multi-save convention in
  Formula Sheet Builder / Rubric Builder — right now one poster per
  browser, so a present-tense poster and a preterite poster can't both be
  kept ready.
- **Done — A color-code option per panel** (2026-08-12). Six-color palette,
  auto by panel order with a per-panel override and a global off switch;
  see the Round 2 note above.
- **Conditional tense and German/Italian starter templates**, to close the
  remaining content gaps the first content pass didn't reach.

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

- ~~Is per-panel color-coding worth the complexity of a color picker...~~
  **Resolved 2026-08-12: both, because the picker turned out to be nearly
  free.** Round-robin-by-position is the default and needs no interaction;
  the per-panel select overrides it. Storing "auto" as an explicit value
  rather than as a missing one means one code path serves both.
- Should irregular verbs live as an optional add-on section within the same
  poster/panel model, or does "irregular verb reference" deserve its own
  distinct template type given how differently they're taught (usually
  memorized individually, not by pattern)? **Partially answered this
  round**: the new `es_irregulars`/`fr_irregulars` templates went with
  "own distinct template" (a poster made entirely of irregular-verb panels,
  loaded like any other template) rather than a call-out box grafted onto
  a regular-pattern poster — simpler to build with the existing panel
  model and keeps a teacher's "irregulars" poster separately printable
  from their "regular pattern" one. The Major Features item calling for a
  *combined* poster (regular panels + a small irregular-verb side box on
  the same page) is still open if that's the better pedagogical shape.
