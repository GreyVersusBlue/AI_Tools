# SS demo round 2 — 062 Geography Bee — map questions + tournament mode

Read `CLAUDE.md`, then `prompts/social-studies-demo-2/_preamble.md` and
follow it exactly, then
`improvement prompts/062-geography-bee-quiz-generator.md` (Status top-down;
round 1 just shipped multiple-choice mode with seeded reproducible
versions and grew the bank to 90 questions, `bi0`–`bi89`).

Your tool: `Tools/062-geography-bee-quiz-generator.html` (single file) +
`Tools/geography-bee-quiz-generator/test/`. Its meta description has always
claimed it is "the quiz-format companion to the Blank Map Generator" —
this round finally makes that true.

## Headline — Map-based questions (real 046 integration, read-only)

A fourth question type: an outline map with one region highlighted, asking
"Which country/state is this?"

- Render small outline-map snippets from the Blank Map Generator's vendored
  TopoJSON at `Tools/blank-map-generator/data/` (world countries 110m, US
  states 10m). **Read 046's `data/` and modules; never write any file under
  `Tools/blank-map-generator/`** — another session owns that folder this
  round. Follow round 1 of the Timeline Builder (015), which successfully
  reused `bmg-vector.js` via a guarded dynamic import; if that is too
  entangled for snippet rendering, a small local outline renderer against
  the same data is acceptable (it worked for 015 as a ~100-line fallback).
- A generated map question shows the region filled/highlighted within its
  continent or national context, drawn offline onto a canvas/SVG.
- Works everywhere questions work: projector display (big map), printed
  quiz (inline map images per question), answer key, and both formats —
  short answer and round 1's multiple choice (distractors = same-category
  region names; reuse the seeded PRNG so printed versions stay
  reproducible).
- Ship a curated starter set of map questions (a mix of US states and
  world countries a 7th grader should know) as a new built-in category
  `maps`, with stable ids continuing the `bi<N>` scheme (append after
  `bi89`; never renumber).
- Teachers can also generate map questions in bulk: pick "US states" or
  "world countries" and N, and the tool samples regions into new custom
  questions.

## Supporting (in order; cut from the bottom)

1. **Team tournament mode** on the projector tab: 2–6 named teams, a
   visible scoreboard, alternating turns, +points on reveal (teacher
   clicks right/wrong), a final standings screen. Teacher-operated, no
   timers required. Persist an in-progress game in `gbq_settings_v1` or a
   new key (if new, register it in `Tools/009-backup-restore.html`).
2. **Extend the smoke suite**: map question renders a snippet (canvas/SVG
   non-empty, correct region distinct from context), map MC distractors
   are same-category, printed quiz embeds the snippet and the key matches,
   tournament scoring adds up and survives reload.

## Non-goals

Writing to any 046 file; buzzer hardware or WebRTC pairing (note it in
Status as the natural round-3 extension); timed rounds; student-operated
play; touching the social meta block; adding `print-area.css`.

## Notes

- New files → `sw.js` `PRECACHE_URLS` + `CACHE_VERSION` bump (test files
  excluded). If you reuse 046's modules dynamically, they are already
  precached — no sw.js change for them.
- README row + index.html pitch: mention map questions and tournament mode
  (and the "companion" claim finally being true).
