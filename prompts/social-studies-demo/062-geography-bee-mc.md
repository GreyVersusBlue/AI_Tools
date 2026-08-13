# SS demo round — 062 Geography Bee Quiz — multiple-choice mode

Read `CLAUDE.md`, then `prompts/social-studies-demo/_preamble.md` and follow it
exactly, then `improvement prompts/062-geography-bee-quiz-generator.md`
(Status top-down is the source of truth).

Your tool: `Tools/062-geography-bee-quiz-generator.html` (~486 lines, single
file). Storage keys: `gbq_custom_v1`, `gbq_disabled_v1`, `gbq_settings_v1`.
Three tabs: projector display, printable quiz, question bank (~30 built-in
questions across capitals / landmarks / map skills, `bi<N>` stable ids,
hide-not-delete for built-ins, `question | answer` bulk import).

## Headline — "Multiple-choice quiz mode" (backlog rank 29)

Auto-generate three distractors from same-category answers, for both the
projector display and the printed quiz plus key.

- A quiz-format setting: **Short answer** (today's behavior, default) or
  **Multiple choice**.
- Distractors: for each question, sample 3 wrong answers from OTHER
  questions' answers in the same category. Dedupe (no repeated option, never
  the correct answer, case-insensitive comparison), shuffle option order.
  The sampling pool must respect what the teacher can actually see: exclude
  hidden built-ins and honor the active category filter.
- Determinism: a printed quiz version must be reproducible — seed a small
  PRNG (a ~10-line mulberry32-style function is fine) per generated quiz so
  the printed quiz and its answer key are built from the same sequence, and
  regenerating with the same seed gives the same paper. The Blank Map
  Generator's worksheet-versions approach is the repo precedent.
- Graceful fallback: when a category's pool is too thin for 3 unique
  distractors, use fewer options for that question, or fall back to short
  answer for it — never pad with cross-category nonsense, never crash.
- Projector display: in MC mode show A–D under the question; reveal marks
  the correct letter. Keep the existing prev/reveal/next/shuffle flow.
- Printed quiz: lettered options; answer key prints the correct letter plus
  the answer text.

## Supporting (in order; cut from the bottom)

1. **Grow the built-in bank from ~30 to 60–90** — this is scope-coupled to
   the headline: distractor quality is pool size. Keep the three categories
   balanced, keep the `bi<N>` stable-id scheme intact (append new ids; never
   renumber existing ones — teachers' hidden-question lists reference them),
   keep questions 7th-grade appropriate and world-balanced (not US/Europe
   only). Factually verify every answer.
2. **First smoke test**: `Tools/geography-bee-quiz-generator/test/` (create
   for the test only) asserting: distractor uniqueness and same-category
   sourcing, hidden built-ins excluded from pools, same seed → same quiz,
   key matches the questions, thin-pool fallback works. Add `test:geo-bee`
   to `package.json` and append to the `test` chain.
3. Cheap win if it falls out naturally: persist the format choice in
   `gbq_settings_v1`.

## Non-goals

Blank Map Generator integration (the meta description's "companion" claim is
an unresolved open question — do not guess it into existence); timed bee
mode; team scoring; region/continent tagging; **do not add
`print-area.css`** (the tool prints fine without it; leave its print path
alone); do not rewrite the social meta block.

## Notes

- No new localStorage keys expected (format rides `gbq_settings_v1`);
  register any genuinely new key in `Tools/009-backup-restore.html`.
- New files → `sw.js` `PRECACHE_URLS` + `CACHE_VERSION` bump (test files
  excluded, matching existing handling).
- README row + index.html pitch: mention multiple-choice mode and the bigger
  bank.
