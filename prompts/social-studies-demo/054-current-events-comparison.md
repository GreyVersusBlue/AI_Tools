# SS demo round — 054 Current Events Guide — two-article comparison

Read `CLAUDE.md`, then `prompts/social-studies-demo/_preamble.md` and follow it
exactly, then
`improvement prompts/054-current-events-discussion-guide-generator.md` (Status
top-down is the source of truth — the named multi-guide library shipped
2026-08-12).

Your tool: `Tools/054-current-events-discussion-guide-generator.html`
(~511 lines, single file). Storage keys: `cedg_guides_v1`, `cedg_guide_v1`
prefix, `cedg_current_v1`. Links `print-area.css` (prints via `#printArea`).
The "analysis" is an honest local heuristic (stopword-filtered vocabulary +
first-sentences summary seed); keep that honesty — the UI already says "edit
into a real summary".

## Headline — "Two-article comparison guide" (backlog rank 21)

Paste two articles on the same event and generate a side-by-side guide with
bias and framing contrast questions and a shared vocabulary list.

- A guide may optionally carry an **Article B** (title / source / body).
  Fits inside the existing named-guide store — just new optional fields on
  the guide object; migrate older guides by treating the fields as absent.
- With Article B present: the analyzer runs on both articles; the print
  becomes a side-by-side (or cleanly stacked, if side-by-side fights the page
  width) comparison guide; vocabulary merges into one shared list with words
  appearing in BOTH articles flagged (those are the event's core vocabulary).
- Add a preset question set that only appears in comparison mode, focused on
  bias and framing, e.g.: What does each headline emphasize? What did one
  article include that the other left out? How does each describe the people
  involved? Which article would you trust more, and why? Write these well —
  they carry the feature. Keep the existing checkbox + custom-question
  machinery.
- All print output stays inside `#printArea`; no new `@media print`.

## Supporting (in order; cut from the bottom)

1. **Load example** (P15) — the demo centerpiece of this tool. Write two
   short articles (150–220 words each) covering the SAME event with different
   framing. Use a fictional but believable local story (e.g. a town council
   voting to convert a parking lot into a skate park: one article leads with
   teens finally getting a safe place, the other with lost parking and
   business owners' worries). Same facts, different emphasis — so the bias
   questions land visibly. 7th-grade reading level, no real names or
   politics. One click loads both articles and runs the analyzer; confirm
   before replacing unsaved work.
2. **Share link + QR** (P3): guides are pure text. Copy the pattern from
   `Tools/028-primary-source-analysis-generator.html` (~line 1091;
   `_shared/state-link.js` + `_shared/vendor/qrcode/qrcode.js`). An incoming
   link saves as a new uniquely-named guide via the existing library.
3. **First smoke test**: `Tools/current-events-discussion-guide-generator/test/`
   (create for the test only, like 050) asserting: Article B fields persist,
   comparison print renders both articles + contrast questions, shared vocab
   flags both-article words, share link round-trips. Add `test:current-events`
   to `package.json` and append to the `test` chain.

## Non-goals

Fetching article URLs (offline constraint); reading-level estimates; any
AI/API-key mode; a question-set library; changing the analyzer beyond running
it twice; vendoring a stopword list.

## Notes

- No new localStorage keys expected (new fields ride the existing guide
  objects); register any genuinely new key in `Tools/009-backup-restore.html`.
- New files → `sw.js` `PRECACHE_URLS` + `CACHE_VERSION` bump (test files
  excluded, matching existing handling).
- README row + index.html pitch: mention two-article comparison and bias
  questions.
