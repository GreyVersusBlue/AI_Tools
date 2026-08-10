# Improvement Prompts — 054 — Current Events Discussion Guide Generator

**Tool file:** `Tools/current-events-discussion-guide-generator.html`
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

Nothing below has been started. The gap between "vocabulary suggestions"
and "actual summarization" is real and worth being explicit about with
whoever picks this up next — see Open Questions.

## What it does today

- Paste title/source/article text; word count + reading-time estimate
- One-click vocabulary suggestions (heuristic: long, deduped, filtered)
  as click-to-add chips
- Auto-seeded (first two sentences) editable summary box
- 6 preset discussion questions (checkbox toggle) + custom questions
- Prints a guide: summary, vocabulary table (with definitions if filled
  in, blank if not), discussion questions with blank answer lines

## Quick Wins

- **A better stopword/heuristic list.** The current 7-letter-plus filter
  will surface a lot of ordinary long words (e.g. "yesterday",
  "different") alongside genuinely useful vocabulary. A curated exclusion
  list or a simple frequency-based common-words filter would raise the
  suggestion quality a lot for very little added complexity.
- **Multiple named saved guides**, matching the multi-save convention in
  Formula Sheet Builder / Rubric Builder — right now there's exactly one
  guide per browser, so last week's article is overwritten by this week's.
- **A "clear and start over" button** — right now the only way to start a
  fresh guide is to manually clear every field.
- **Show word count and read time even before analyzing** (live as the
  teacher pastes/types), not only after clicking the analyze button.

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
