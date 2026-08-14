# Improvement Prompts — 054 — Current Events Discussion Guide Generator

**Tool file:** `Tools/054-current-events-discussion-guide-generator.html`
**Support folder:** `Tools/current-events-discussion-guide-generator/` —
`cedg-readability.js` (the reading-level estimate; pure, no DOM) plus
`test/` (three Playwright suites and one pure-Node suite). The rest of the
tool code is still inline in the one HTML file.

**Current description (from README):** Paste a news article to pull out a summary starter and candidate vocabulary automatically, edit both, add your own questions, and print a discussion guide — or add a second article on the same event for a side-by-side bias/framing comparison guide with shared vocabulary. An optional media literacy kit adds a SIFT source-evaluation checklist, a headline rewrite exercise, and a claim vs. evidence organizer, printable at Academic, Honors, or Honors GT (or all three at once).

---

## Status

**2026-08-14 — Devon-assigned round: the article's own link, and a reading
level (session `c1jqjp`).** Two of the three open Major Features shipped.

**Reading-level estimate.** A new pure module,
`current-events-discussion-guide-generator/cedg-readability.js`, turns the
pasted article into a Flesch–Kincaid grade and a *band* — "reads around
grades 7–9" — shown on the same line that already carried the word count and
read time, for both articles.

- **Flesch–Kincaid because of this site's constraints, not because it is the
  best measure.** It needs only sentence length and syllable count, both
  computable from the text itself: no word list to ship, no network, nothing
  to keep up to date. Its weaknesses are stated in the module header rather
  than hidden — it cannot see vocabulary difficulty or syntactic complexity,
  and an article about a familiar local topic and one about monetary policy
  can score the same and be nothing alike in a classroom.
- **It refuses to answer on short samples.** Under 40 words the line says
  "too short to estimate a reading level" instead of printing a number. A
  confident wrong grade level is worse for a teacher than a blank.
- **It reports a range, never a single grade**, for the same reason: a
  teacher reads "grade 9" as a fact and "around grades 8–10" as the estimate
  it is. The line also shows the average sentence length and long-word
  percentage it came from, so the number can be argued with.
- The syllable counter needed exactly one special case beyond vowel groups
  and the silent final 'e': a final consonant + "le" is its own syllable
  ("ar-ti-cle", "ta-ble"). Without it the counter undercounts a whole class
  of ordinary words — including "article", which this tool is entirely about.

**The article's link.** A real URL field per article, alongside the existing
free-text source line.

- **On paper the URL prints in full and gets a QR code**; on a guide read on
  a screen the same text is a link. Printing the URL as text is the part
  that survives a photocopy, and the QR is the part a phone can use — the
  handout has to work both ways, since this tool's output is usually paper.
- **Only http(s) is accepted**, and a bare domain is upgraded to `https://`
  rather than rejected (that is what pasting from a browser bar produces). A
  `javascript:` or `data:` URL is refused with an explanation and never
  becomes a clickable link in the teacher's page or on the printed sheet —
  asserted in the suite for both the editor and the print output.
- **The QR is skipped, not botched, when a URL is too long to encode** — a
  news URL with a long tracking query can exceed what a QR of this size
  holds, and half a QR code is worse than none.
- **The comparison layout prints both links and no QR codes.** A comparison
  column is about three inches wide and two QRs crowd out the summary beside
  them. Deliberate, and asserted so it doesn't get "fixed" without thought.

**Tests.** `readability.test.mjs` (35 assertions, pure Node): a plain news
story and the same event in dense institutional prose must land in different
bands — the assertion that stops the estimate from being decoration — plus
the refusal on short samples, the clamping, and the syllable rules. New
`smoke-citation.mjs` (28 browser assertions) covers the link end to end,
including the two refused schemes. The two existing suites pass unchanged.

#### Where the next round should pick up

- **The question-set bank is the last open Major Feature** and is now the
  obvious next round: two fixed sets exist (general + comparison), and what
  the idea asks for is a set a teacher can add to and choose between.
- The reading level is computed for each article separately. In comparison
  mode, the *difference* between the two is arguably the more useful number
  ("these two articles are three grades apart — that is why the comparison
  is hard"), and nothing surfaces it yet.
- `cedg-readability.js` is general — any tool that takes pasted text could
  use it. It is one consumer today, so it stays in the tool's folder; a
  second consumer earns it a move to `_shared/`.


**2026-08-14 — SS demo round 2: media literacy kit + differentiation levels
shipped (session `mk3jq7`).** Devon-assigned round 2 ahead of the live teacher
presentation (see `prompts/social-studies-demo-2/054-media-literacy-kit.md`
and `_preamble.md`). Full scope shipped, nothing cut:

- **Three optional printable kit pages**, each toggled per guide from a new
  "Media literacy kit" card, all rendered inside the existing `#printArea`
  (no new `@media print` block, `print-area.css` untouched):
  - **Source evaluation checklist (SIFT)** — the four moves (Stop; Investigate
    the source; Find better coverage; Trace the claim) with write-in lines
    under each. In two-article mode every move splits into two columns headed
    with the two real headlines. Move 3 says outright that the sheet cannot
    look up other coverage and asks students to plan the search instead — the
    honest version of the offline constraint rather than a fake one.
  - **Headline rewrite exercise** — quotes the teacher's real headline(s) back,
    then three tasks: rewrite it neutrally, rewrite it slanted the other way,
    and name the exact words that were doing the work. With two articles it
    adds a five-row matching block (which headline does what, answered A / B /
    both / neither, plus the words that tipped you off).
  - **Claim vs. evidence organizer** — claim / evidence / "fact, opinion, or
    spin?" table, gaining a fourth "Article" column when comparing. The
    teacher can pre-fill any cell from a row editor (ticking the box seeds
    three blank rows to show the shape); anything left blank prints as
    writing space.
- **Differentiation levels** per the round-2 preamble spec: a Level selector
  with exactly `Academic` / `Honors` / `Honors GT`, defaulting to Honors,
  affecting print output only (the editing UI never changes). Academic adds
  sentence starters on the SIFT lines, the headline reflection and the open
  discussion questions, chunks the long prompts into numbered steps, prints a
  plain-language gloss of the six words the kit itself introduces, and gets
  three writing lines instead of two — more scaffolding, never fewer or
  easier questions. Honors GT swaps in more open prompt wording, drops the
  pre-structure, adds the "find and summarize a third source's framing"
  extension under SIFT, a "write a headline with no slant at all — is that
  even possible?" task, a "which claim matters most?" prompt under the
  organizer, and a closing **So What?** synthesis section.
- **Print all three levels** — one button emits all three class sets in one
  pass, Academic → Honors → Honors GT, each set opening with a level banner,
  closing with a `Level: … — <guide name>` footer, and carrying a small level
  chip on every section heading. Sets are separated with `page-break-before`
  declared in the tool's normal `<style>` (page-break properties are inert on
  screen), so no competing print block was needed.
- **Everything rides the existing guide object** (`level`, `kitSift`,
  `kitHeadline`, `kitClaims`, `claimRows`) — no new localStorage key, so
  `009-backup-restore.html` needed no change, and `normalizeGuide` defaults
  every new field. A guide saved or a link shared before this round opens at
  level Honors with the kit off and prints exactly the sheet it always did;
  verified in the suite rather than assumed.
- **Load two-article example now demos the whole kit in one click** — it turns
  all three pages on and pre-fills three claims lifted from the skate-park
  articles. The first two contradict each other on purpose ("the lot has sat
  mostly empty" vs. "the lot gets full on weekends as it is"), which puts the
  entire lesson in two table rows. Evidence and the fact/opinion/spin tag are
  left blank, so it demos teacher pre-fill without doing the students' work.
- **Fixed a real pre-existing CSS bug found while screenshotting the print
  path:** `.q-row input { flex: 1 }` was written for the custom-question text
  box but also matched the preset question checkboxes, stretching each one
  across its row and shoving every question's text against the right edge of
  the card. One scoped rule (`.q-row label input[type="checkbox"]`) fixes it;
  the Guiding Questions and Comparing These Two Articles lists now read as
  normal left-aligned checklists.
- **New suite** —
  `Tools/current-events-discussion-guide-generator/test/smoke-media-literacy.mjs`
  (102 assertions): kit pages appear only when their own box is ticked, all
  four SIFT moves print, SIFT goes two-column with the real headlines as
  column heads once Article B has text, pre-filled claim cells print as-is
  while untouched ones print as blank writing space, Academic really does add
  starters/steps/gloss/more lines while Honors adds none and GT adds the
  extension and synthesis instead, "Print all three levels" emits three
  banner-and-footer-tagged sets in order, level and kit survive a reload,
  a share link round-trips all of it, a pre-round link still opens at the old
  defaults, and Load Example brings up the whole kit. Wired into
  `npm run test:current-events` alongside the round-1 suite and appended to
  the end of the main `test` chain.

Verified with `npm run check:dedupe` (clean), `npm run check:social` (byte-for-
byte the same pre-existing drift as before — this tool's `<head>` was not
touched), both of this tool's suites green before starting (38 baseline) and
after every step (38 + 102), and a manual headless pass that rendered the
printed sheet at all three levels plus the all-three stack and inspected the
screenshots, which is what turned up both the checkbox bug and two wording
collisions (three separate headings called "So what?" on one GT sheet).

**Where the next round should pick up:** `sw.js` needed no edit this round —
the only file added is a test file, and test folders are deliberately not
precached — so `CACHE_VERSION` was intentionally left alone. The per-page
level tag is a banner at the top of each set, a chip on each section heading
and a footer at the end of each set, rather than a true repeating per-page
footer: a `position: fixed` print footer would repeat on every page in
Chrome, but three of them in one document all repeat at once, so the tag
lands on section boundaries instead. Worth revisiting if a teacher reports
mixing piles up in practice. Still open from the lists below: the
reading-level estimate, a real question-set library a teacher can add to
(there are now three fixed sets — general, comparison, and the kit's own
prompts), and the AI-assisted-mode Open Question. The claim organizer is
currently one shared table across both articles with an A/B column rather
than one table per article; that was the deliberate choice (it halves the
teacher's setup and makes cross-article contradictions visible in adjacent
rows) but it is a boundary someone could reasonably want moved.

**2026-08-14 — SS demo round: two-article comparison guide shipped (backlog
rank 21, session `qfx7mz`).** Devon-assigned round ahead of a live teacher
presentation (see `prompts/social-studies-demo/054-current-events-comparison.md`
and `_preamble.md`). Full scope shipped, nothing cut:

- **Optional Article B** — new `titleB` / `sourceB` / `articleTextB` /
  `summaryB` / `comparisonChecked` fields on the existing named-guide
  object (no new localStorage key; older guides migrate for free by
  treating the fields as absent, matching `normalizeGuide`'s existing
  pattern). A "+ Add Article B (compare two articles)" button reveals a
  second Article card; "Remove Article B" clears it back down (confirms
  first if there's content to lose).
- **Comparison analysis** — with Article B present, "Pull out vocabulary +
  summary starters" runs the same heuristic on both articles, seeds both
  summary boxes, and merges the two candidate-word lists into one
  suggestion list (capped at 20) with words found in **both** articles
  sorted first and marked with a star. The vocabulary list itself (however
  words got added — suggestion chip, typed by hand) is flagged live by a
  small "Both" badge whenever a term's word-boundary match is found in both
  raw article texts — this is computed at render time from the actual
  article text, not from suggestion-time state, so it stays honest even
  after manual edits.
- **A 6-question bias/framing preset set** ("What does each headline
  emphasize?", "What did one article include that the other left out?",
  "Which article would you trust more, and why?", etc.), shown only once
  Article B is added, with its own checkbox state
  (`state.comparisonChecked`) alongside the existing 6 general questions.
- **Comparison print layout** — the printed guide switches to a two-column
  side-by-side header (headline/source/summary per article) when Article B
  has real text, a single shared vocabulary table with "core" tags on the
  both-articles words, the existing Discussion Questions section, and a new
  "Comparing These Two Articles" section for the checked bias questions.
  Still entirely inside `#printArea`, no new `@media print` block.
- **Load two-article example (P15)** — one click seeds two ~195-word
  fictional articles about a town council voting to convert a parking lot
  into a skate park: one framed around teens finally getting a safe place
  to skate, the other around lost parking and worried business owners, same
  facts throughout so the bias questions land visibly. Confirms before
  overwriting a guide that already has content.
- **Share by link / QR (P3)** — copied the pattern from
  `028-primary-source-analysis-generator.html` (`_shared/state-link.js` +
  `_shared/vendor/qrcode/qrcode.js`, already vendored/precached, no new
  files). An incoming `?guide=` link always saves as a new uniquely-named
  guide on the recipient's side rather than overwriting whatever they had
  open.
- **First automated test** —
  `Tools/current-events-discussion-guide-generator/test/smoke-comparison.mjs`
  (38 assertions): Article B fields survive a reload, shared vocabulary is
  flagged correctly (and non-shared terms are not), the printed guide
  renders the side-by-side layout with both headlines and the comparison
  question section, the Load Example flow populates both articles and
  flags shared words, and a share link round-trips a comparison guide to a
  fresh tab/guide without touching the sender's own copy. Wired in as
  `npm run test:current-events` and appended to the main `test` chain.
  Zero console errors, zero offsite requests, across every page the suite
  drives.

Verified with `npm run check:dedupe` (clean) and `npm run check:social`
(same pre-existing state as before touching `<head>` — this tool still has
no `gvb:social` block, no new drift introduced) plus a manual headless pass
confirming Load Example seeds both summary boxes and flags 8 words as
shared between the two example articles.

**Where the next round should pick up:** the reading-level estimate and a
question-set library beyond the two built-in sets (general + comparison)
are both still open from the Major Features list below; the AI-assisted-mode
Open Question is also still unresolved. The comparison feature only compares
two articles at a time — a three-or-more-article mode was explicitly out of
scope for this round and isn't requested anywhere else in the backlog either,
so it's not flagged as a gap, just noted as a boundary.

**2026-08-12 — Backlog round: multiple named saved guides shipped (backlog
rank 4).** Adopted the New/Duplicate/Rename/Delete multi-save convention,
copied from `047-art-critique-worksheet-generator.html` (same
`listNames`/`saveNamed`/`loadNamed`/`deleteNamed`/`uniqueName` store shape
and the switcher-select + name-field + three-buttons card, placed above the
Article card). New keys: `cedg_guides_v1` (name list), `cedg_guide_v1:<name>`
(one blob per guide), `cedg_current_v1` (last-open). The old single-guide
key `cedg_guide_v1` is migrated on first load into a named guide (named
after its headline, or "My Guide" when the headline is blank; migration
only fires when the legacy guide actually has content, so a fresh browser
doesn't grow a junk entry). "Clear & start over" now clears the current
guide's content but keeps its slot and name, instead of nuking the only
save. Verified with a headless Chromium test over a local static server:
legacy migration (headline-derived name, vocab, unchecked preset, custom
question all arrive), guide isolation across switches, analyze-summary
persistence, duplicate/rename/delete, clear-keeps-slot, current-guide
restore on reload, and the printed guide rendering the right guide's
content — zero console errors. Where the next round should pick up:
reading-level presets for the question bank, or the two-article comparison
guide idea (which is a separate backlog row).

**2026-08-10 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog. This toolkit is static-hosted with no server and no AI
backend, so "turn a pasted article into a discussion guide" is built as
**heuristics, not summarization**: pasting text and clicking "Pull out
vocabulary + summary starter" (1) seeds the summary box with the article's
first two sentences (regex sentence-split) for the teacher to edit into a
real summary, and (2) surfaces up to 12 candidate vocabulary words (7+
letters, deduped, a short stopword list filtered out) as clickable chips
that add to an editable term/definition list. Six generic critical-thinking
discussion questions are pre-checked and can be unchecked, plus custom
questions can be added. Everything autosaves to one localStorage key
(`cedg_guide_v1`). Verified with a headless Chromium smoke test (analyze,
add a suggested word, add a custom question, print) — no console errors.

The gap between "vocabulary suggestions" and "actual summarization" is
real and worth being explicit about with whoever picks this up next —
see Open Questions.

**2026-08-11 — Round 2 (session `qer21r`).** Three Quick Wins shipped:

- **A much larger curated stopword list** — grew from 20 entries to
  roughly 100, covering common long words (`yesterday`, `different`,
  `however`, `government`, `important`, `information`, `continued`,
  `community`, `students`, `problem`, `develop`, `become`, `believe`,
  and their inflections, among others) that were previously surfacing
  as "vocabulary" alongside genuinely useful words. Not a frequency-list
  vendoring exercise (that's still an Open Question below) — this is a
  hand-curated addition scoped to the kind of words that showed up in
  quick manual testing.
- **Live word count and read-time estimate** while pasting/typing, not
  only after clicking "Pull out vocabulary" — `updateWordCount()` now
  runs on every `articleText` input, and `analyzeArticle()` calls the
  same function instead of duplicating the calculation.
- **A "Clear & start over" button** (with a confirm prompt) that resets
  every field and the underlying `localStorage` state in one click,
  instead of requiring a teacher to manually clear title/source/text/
  summary/vocab/questions one at a time.

All three verified with a headless Chromium smoke test (live count shows
before analyzing, stopword-filtered words like "yesterday"/"different"
don't appear as suggestion chips, clear button empties the title field)
plus a separate print-path check — zero console errors in either pass.

**Not started this round:** multiple named saved guides, reading-level
estimate, a question-set library, multi-article comparison mode, the
AI-assisted-mode Open Question. See Major Features/Moonshot below —
multiple named saved guides is the natural next pickup, since it's the
most-repeated pattern flagged on sibling builder tools this round and
this file explicitly calls it out as the biggest remaining first-run
friction (one guide per browser, still overwritten week to week).

## What it does today

- Paste title/source/article text; word count + reading-time estimate
- One-click vocabulary suggestions (heuristic: long, deduped, filtered)
  as click-to-add chips
- Auto-seeded (first two sentences) editable summary box
- 6 preset discussion questions (checkbox toggle) + custom questions
- Prints a guide: summary, vocabulary table (with definitions if filled
  in, blank if not), discussion questions with blank answer lines
- **Multiple named saved guides** (`cedg_guides_v1` / `cedg_guide_v1:<name>`
  / `cedg_current_v1`) with New/Duplicate/Rename/Delete; the pre-multi-save
  single guide migrates in automatically, named after its headline
- **Optional Article B for a two-article comparison guide** — "+ Add
  Article B" reveals a second headline/source/text card; analyzing runs
  the heuristic on both articles, flags vocabulary that appears in both as
  the event's shared "core" vocabulary (live badge on screen, "core" tag
  in print), and unlocks a 6-question bias/framing preset set. Print
  switches to a side-by-side two-article layout automatically once Article
  B has real text.
- **Load two-article example** — one click seeds a fictional, same-event,
  different-framing pair of articles (a town skate park vote) and runs the
  analyzer on both, for demoing the comparison feature without hunting for
  real source text.
- **Share a guide by link or QR code** (`_shared/state-link.js` +
  `_shared/vendor/qrcode/qrcode.js`); an incoming shared link always saves
  as a new guide rather than overwriting whatever the recipient had open.
- **Media literacy kit** — three optional printable pages, ticked per guide:
  a SIFT source-evaluation checklist (two columns when comparing), a headline
  rewrite exercise (neutral, then slanted the other way, then "what did you
  change?", plus a headline-to-framing matching block in comparison mode),
  and a claim vs. evidence organizer with a fact/opinion/spin tag per row
  that the teacher can pre-fill or leave blank.
- **Three class levels** — `Academic` / `Honors` / `Honors GT`, stored with
  the guide and carried by share links. Academic adds sentence starters,
  chunked steps, a plain-language gloss of the kit's own vocabulary and more
  writing space; Honors is the unchanged baseline; Honors GT opens the
  prompts up and adds a third-source extension and a closing synthesis
  question. "Print all three levels" prints all three class sets in one pass,
  each banner- and footer-tagged so the piles sort.

## Quick Wins

- ~~**A better stopword/heuristic list.**~~ — **done, Round 2** (hand-
  curated expansion, not the vendored-frequency-list approach — see the
  Open Questions note on whether that's still worth doing on top of this).
- ~~**Multiple named saved guides**~~ — **done, 2026-08-12** (backlog round;
  see Status — shipped with legacy migration and a slot-preserving Clear).
- ~~**A "clear and start over" button**~~ — **done, Round 2.**
- ~~**Show word count and read time even before analyzing**~~ — **done,
  Round 2.**
- ~~**Multi-article comparison mode**~~ — **done, 2026-08-14** (SS demo
  round; see Status — two-article comparison, side-by-side print, shared
  vocabulary flagging, bias/framing question set).
- ~~**Share a guide by link/QR**~~ — **done, 2026-08-14** (SS demo round;
  same `_shared/state-link.js` pattern as `028-primary-source-analysis-generator.html`).

## Major Features

- ~~**A real citation/link field with a "students should read the source
  themselves" framing**~~ — **done, 2026-08-14** (session `c1jqjp`). A URL
  field per article: click-through in the editor, the URL in full plus a QR
  code on the printed sheet, http(s) only. See the Status entry.
- ~~**Reading-level flag or estimate**~~ — **done, 2026-08-14** (session
  `c1jqjp`). Flesch–Kincaid in `cedg-readability.js`, reported as a band
  rather than a grade, and withheld entirely on samples under 40 words.
- **A bank of saved "generic" question sets beyond the 6 built-in ones**
  (e.g. a set skewed toward persuasive-writing follow-up, a set skewed
  toward historical-context articles) that a teacher can swap between,
  instead of one fixed list — now two sets exist (general + comparison),
  both still fixed rather than a real bank a teacher could add to.

## Moonshot / North Star

**A discussion guide that gets smarter about the specific article pasted
in, not just templated around any article.** The honest ceiling for a
static, server-less, no-AI tool is heuristics — better stopword filtering,
reading-level estimates, topic-aware question sets — rather than genuine
summarization or vocabulary judgment. Getting those heuristics as good as
they can get, plus letting a teacher build a personal library of
saved/reusable question sets and past guides, is the realistic "as good as
this gets without a server" version of this tool.

## Platform themes that matter here

- **P7 (cross-tool)** — the multi-save pattern from Formula Sheet Builder /
  Rubric Builder applies directly; a "question set library" is the same
  shape at a different granularity.
- **P15 (first run)** — live word-count feedback while pasting, and a
  clear/reset button, both reduce first-use friction.

## Open Questions

- **Is a genuine AI-assisted mode ever in scope for this toolkit?** The
  backlog and README both describe this tool in terms ("summary box,"
  "pull vocabulary") that read as AI-summarization to a teacher, but the
  actual toolkit constraint (GitHub Pages, static hosting, "no data leaves
  your browser") rules out a server-side LLM call by design. Worth deciding
  explicitly whether this tool's ceiling is "as good as heuristics get" or
  whether a future version could optionally call a user-supplied API key
  against a model directly from the browser (still no toolkit-run server,
  but a meaningfully different privacy posture the "nothing leaves your
  browser" framing would need to caveat).
- Is a curated stopword list worth hand-maintaining, or is there a
  reasonably small built-in "top 1000 common English words" list that could
  be vendored once and reused (this tool, and potentially others) instead
  of ad-hoc filtering?
