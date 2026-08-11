# Improvement Prompts — 054 — Current Events Discussion Guide Generator

**Tool file:** `Tools/054-current-events-discussion-guide-generator.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Paste a news article to pull out a summary starter and candidate vocabulary automatically, edit both, add your own questions, and print a discussion guide.

---

## Status

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

## Quick Wins

- ~~**A better stopword/heuristic list.**~~ — **done, Round 2** (hand-
  curated expansion, not the vendored-frequency-list approach — see the
  Open Questions note on whether that's still worth doing on top of this).
- **Multiple named saved guides**, matching the multi-save convention in
  Formula Sheet Builder / Rubric Builder — right now there's exactly one
  guide per browser, so last week's article is overwritten by this week's.
- ~~**A "clear and start over" button**~~ — **done, Round 2.**
- ~~**Show word count and read time even before analyzing**~~ — **done,
  Round 2.**

## Major Features

- **A real citation/link field with a "students should read the source
  themselves" framing** — right now "source" is one free-text field; a
  proper URL field with click-through would matter if this is meant to be
  handed out digitally, not just printed.
- **Reading-level flag or estimate** (e.g. average sentence/word length as
  a rough proxy) so a teacher can gauge whether an article fits their
  class before building the whole guide around it.
- **A bank of saved "generic" question sets beyond the 6 built-in ones**
  (e.g. a set skewed toward persuasive-writing follow-up, a set skewed
  toward historical-context articles) that a teacher can swap between,
  instead of one fixed list.
- **Multi-article comparison mode**: two pasted articles on the same topic,
  side by side, with questions specifically about comparing perspectives —
  a natural escalation of the single-article guide.

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
