# Improvement Prompts — 062 — Geography Bee / Map Skills Quiz Generator

**Tool file:** `Tools/062-geography-bee-quiz-generator.html` (the question
banks and all the UI logic are still inline in the one file).
**Support folder:** `Tools/geography-bee-quiz-generator/` —
`gbq-map.js` (the outline-map snippet renderer, added 2026-08-14) and
`test/`.

**Current description (from README):** A 120-question built-in bank across capitals, landmarks, map-reading skills, and outline-map &ldquo;which country/state is highlighted?&rdquo; questions drawn offline from the Blank Map Generator&rsquo;s own map data &mdash; filterable by category, projected one at a time or printed as a quiz with an answer key, short answer or multiple choice with same-category distractors and a seeded, reprintable quiz version, plus a 2&ndash;6 team tournament scoreboard for the projector.

---

## Status

**2026-08-14 — Devon-assigned round: region tagging (session `c1jqjp`).**
The previous round called this one "cheaper now than it was" because the map
questions come tagged for free; the other 90 were the work, and they are
done.

- **A second filter axis.** Category says what *kind* of question this is;
  region says what part of the world it is about — the axis a teacher
  covering a unit actually plans along. They filter independently and
  combine with AND, so "map questions about Africa" and "everything about
  Africa" are both one dropdown pair away.
- **Every built-in carries its region as data**, a fourth column on
  `BUILTIN_RAW`, rather than being classified at runtime. `gbq-map.js`'s own
  header is the argument: an algorithm that decides where a place belongs is
  confidently wrong often enough (it puts Iraq in Africa and Russia in
  Europe) that shipping one across 90 questions would mean a teacher
  filtering to Africa gets Baghdad. The tags were *proposed* from that
  module's continent lists and then read one by one; six had no country in
  them at all (the Nile, the Himalayas, Denali, the Sahara, Table Mountain,
  the Amazon's ocean) and were assigned by hand.
- **`global` is a real answer, not a missing one.** The 30 map-skills
  questions — latitude, scale, contour lines — belong to no continent, and
  a teacher can filter *to* them. The suite asserts the regions sum to the
  whole bank, which is what would catch an untagged question: it would
  otherwise vanish from every region filter and only show up as an Africa
  quiz coming three questions short.
- **Two transcontinental judgement calls, stated rather than buried.**
  Russia and Turkey are filed under Europe, because a teacher filtering for
  a Europe unit expects Moscow and Ankara. That is a *filter* decision and
  it does not touch the map crop data, where Russia is still drawn on a
  world map because its geometry wraps the antimeridian.
- **Custom questions can be tagged too** — from the form, or from a pasted
  column that may sit on either side of the category column, since a
  spreadsheet's column order belongs to the teacher. A trailing token is
  only consumed if it really is a region or a category, so
  `Iguazu Falls … | Brazil | Argentina` keeps its two-part answer.
- **Named `area` in the code, not `region`.** This file already uses
  "region" for the state or country a map question highlights
  (`item.map.region`, `REGION_LABELS`) — and the first draft of this round
  did collide with it: the new labels object silently shadowed the map one
  through `var` hoisting, and the bank printed `[undefined]`. Caught by the
  new suite before it went anywhere. The UI still says "Region", which is
  what a teacher calls it.

**Tests.** New `smoke-regions.mjs` (33 assertions), including the
regions-sum-to-the-bank check, hand-verified spot checks, the combination
with the category filter, and that the filter reaches the printed sheet and
not just the projector. Both existing suites pass unchanged.

**Not built this round: the timed "bee" mode.** It is the one open idea here
that contradicts a decision this tool made deliberately two rounds ago — the
team tournament's header says "Teacher-operated on purpose: no timers, no
buzzers, no student devices", and a sudden-death countdown is exactly a
timer. A real geography bee does run on a clock, so the idea is not wrong;
it is a call about what this toolkit is, and it wants Devon's answer before
90 lines of countdown UI, not after. Buzz-in from student devices is the
same shape of question and stays out for the same reason.

#### Where the next round should pick up

- **The timed bee mode / buzz-in pair**, once the timer question above is
  answered either way. If the answer is "yes, opt-in", the shape is a mode
  toggle on the tournament rather than a fourth tab: the scoring, turn
  order and reload-survival are already there.
- **Region tagging earns two things it doesn't have yet**: a count per
  region beside each dropdown option (so a teacher sees "Oceania (7)"
  before building a quiz that comes up short), and region-aware map
  question generation — the generator samples any region, so an Oceania
  filter plus "generate 10 map questions" can still hand back Peru.
- The distractor logic for multiple choice matches on category only. Now
  that questions carry a region, a same-region distractor ("which of these
  four African capitals") would be a harder and better question than a
  same-category one.


**2026-08-14 — SS demo round 2: map questions + team tournament, session
`gmq7xr`.** The headline and both Supporting items shipped; nothing cut.
This is the round that finally makes the tool's own meta description true —
it has claimed to be "the quiz-format companion to the Blank Map Generator"
since it was built, while sharing nothing with 046 but a colour scheme.

- **Map questions (new built-in category `maps`, 30 questions,
  `bi90`–`bi119`).** An outline map with one region shaded, asking "which
  country / US state is highlighted?". 15 US states (Maryland first) and 15
  world countries, ids appended after `bi89` and never renumbered.
- **New module `Tools/geography-bee-quiz-generator/gbq-map.js`.** Reads 046's
  vendored Natural Earth GeoJSON in `Tools/blank-map-generator/data/` and its
  `BASE_MAP_PRESETS` crops (guarded dynamic `import()` of `bmg-vector.js`,
  same trick as `tlb-places.js`), and **writes nothing under
  `Tools/blank-map-generator/`** — another session owned that folder this
  round. Draws to a canvas and hands back a PNG data URL.
- **Why the drawing is local rather than 046's `renderBaseMapCanvas()`:**
  that function always renders a 4000 px long side because it is building a
  poster-quality base map for IndexedDB. A quiz wants a 320 px thumbnail next
  to question 7, and a printed quiz wants ten of them. Rendering ten 4000 px
  continents and throwing 99% of each away is the wrong trade on a Chromebook,
  and the snippet needs styling the base map has no concept of. The prompt
  file explicitly blessed this fallback and 015 had already proven it. What is
  genuinely shared is the geometry and the crops.
- **Crops are data, not an algorithm.** A "smallest preset whose bounds
  contain the region" rule gets most countries right on its own, but it puts
  Iraq and Saudi Arabia on an *Africa* map (both fit inside that crop) and
  Russia on *Europe* (its geometry wraps the antimeridian, so its bounding box
  is the whole world). Rather than ship known-wrong answers on a demo day, the
  crop is stated per region in `gbq-map.js`'s pool; the algorithm survives only
  as the fallback for anything not listed.
- **Small regions get a locator ring.** Rhode Island on a lower-48 map is
  about four pixels wide. Anything under 7% of the canvas's long side gets a
  circle drawn round it. Verified by eye: Rhode Island, Delaware, Hawaii ring;
  Maryland and Texas don't need to.
- **Works everywhere questions work.** Projector display (460 px map above the
  options), printed quiz (inline data-URL image per question), and the answer
  key, which repeats each map as a 90 px thumbnail — grading twenty "which
  country is this?" papers against a list of bare names means counting down
  the page and hoping. The key thumbnail is asserted to be the *identical*
  image the student got, not a second render that could drift.
- **Map multiple choice.** Distractors for a map question come from the region
  pool of the same dataset, not from other questions' answers: "which state is
  highlighted?" wants three other state names, and a teacher with four map
  questions in rotation would otherwise get the same three every time. Nothing
  leaks by naming a region with no question of its own — the answer *is* the
  place name. A state question can never be offered a country (asserted across
  all 30). Still drawn from the one seeded rng stream, so a printed map quiz
  reprints identically, pictures and all.
- **Bulk generation.** Bank tab: pick US states or world countries and N, and
  the tool samples regions that don't already have a map question, so running
  it twice gives twenty different states rather than the same ten again.
- **Team tournament** on the projector tab: 2–6 named teams, configurable
  points per question, a live scoreboard with the current team ringed,
  alternating turns, and a final standings screen with ties handled. Scoring
  is locked until Reveal — it's the click that ends the guessing, and it stops
  a stray tap awarding points to a team that hasn't answered. Marking a
  question advances the turn *and* the question, because those always happen
  together. An in-progress game persists in the new `gbq_tournament_v1` and
  reopens itself on load; the projector laptop does get closed at lunch.
  Registered in `Tools/009-backup-restore.html` along with `gbq_disabled_v1`
  and `gbq_settings_v1`, which had never been registered and so were silently
  missing from teachers' backups.
- **New suite `test/smoke-map-tournament.mjs`** (74 checks, wired into
  `npm run test:geo-bee` and the end of the root `test` chain). The map half
  is deliberately paranoid: rather than checking an `<img>` exists, it projects
  two known lat/lons through the same plate carrée the renderer uses and reads
  the pixels back — a point in Texas must come out highlight-coloured and a
  point in California, on the same image, must not. It also draws all 30
  built-ins (a typo in "Dem. Rep. Congo" would otherwise only surface the day
  a teacher landed on it) and checks that two regions on one crop don't produce
  the same PNG. The existing 29-check MC suite still passes unchanged.
  Verified headless: zero console errors, zero offsite requests.

**Where round 3 should pick up:** buzzer hardware / WebRTC pairing for the
tournament was an explicit non-goal here and is the natural extension — the
site already has a WebRTC pairing layer in `_shared/` that
`021-pe-tournament-stations` and `004-classroom-timer` use, so student devices
could buzz in without this tool growing a server. A timed bee mode and
region/continent tagging are still unbuilt, and region tagging is now much
cheaper than it was: `gbq-map.js` already groups every region by continent
crop, so a "South America only" filter is mostly plumbing. Worth a backlog row
rather than guessing: whether map questions should also be able to ask the
*reverse* ("shade in Egypt on this blank map"), which is really a Blank Map
Generator worksheet and probably belongs there.

**2026-08-14 — SS demo round: multiple-choice quiz mode shipped (backlog
rank 29), session `mee9kj`.** The headline feature from
`prompts/social-studies-demo/062-geography-bee-mc.md`, done in full:

- A quiz-format setting (**Short answer** / **Multiple choice**) next to the
  category filter, persisted in `gbq_settings_v1` and applied immediately on
  change — no separate "apply" step, unlike the category filter.
- For each question, 3 distractors are sampled from OTHER questions'
  answers in the *same category*, drawn only from `filteredQuestions()` —
  i.e. whatever the teacher can currently see (hidden built-ins excluded,
  active category filter honored). Case-insensitive dedupe, never repeats
  the correct answer, shuffled option order. When a category has fewer than
  1 usable distractor left (checked live, not assumed), the question falls
  back to short answer rather than crashing or padding with a wrong-category
  answer — verified with a bank artificially thinned down to one visible
  question.
- Projector display: A&ndash;D options render under the question as soon as
  it's shown (this is a multiple-choice quiz, so the choices aren't a
  secret); Reveal highlights the correct option in green and adds a
  "Correct answer: B) Tokyo"-style line for anyone too far back to see the
  highlight. Prev/Next/Shuffle all still work as before and regenerate a
  fresh option set (Math.random-seeded — no reproducibility requirement on
  the live display, only on the printed paper below).
- Printed quiz: lettered options print under each question; the key states
  the letter and the answer text ("3. B &mdash; Tokyo"), and is guaranteed
  to match what's on the paper because both are built from one pass over a
  single seeded rng stream (recomputing distractors a second time for the
  key, from a fresh rng call, would silently desync the two — the
  implementation computes each question's options exactly once and reuses
  them for both the problem and the key).
- **Determinism**: a small mulberry32 PRNG (copied from the Blank Map
  Generator's worksheet-versions pattern, the repo's existing precedent for
  this) is seeded from a teacher-facing "Quiz version" number. Same version
  + same filter/count/bank state always regenerates the identical paper —
  useful for reprinting a lost copy or handing two class periods the same
  quiz. A "New version" button bumps the number and rebuilds for a fresh mix.
- **Built-in bank grown from 30 to 90** (scope-coupled to the headline per
  the prompt file — distractor quality depends on pool size): 30 per
  category, kept balanced, `bi30`&ndash;`bi89` appended after the untouched
  original `bi0`&ndash;`bi29`. The additions deliberately pull in more of
  Europe/Southeast Asia/the Middle East/South America than the original set
  had, without tipping the whole bank US/Europe-only (capitals: Germany,
  Spain, India, Indonesia, Nigeria, Argentina, Turkey, Thailand, Vietnam,
  the Philippines, and more; landmarks: Petra, Angkor Wat, Ha Long Bay,
  Victoria Falls, the Gobi Desert, Iguazu Falls, Table Mountain, and more;
  map skills: cardinal/intermediate directions, absolute vs. relative
  location, physical/political/topographic map types, the Tropics,
  International Date Line, parallels/meridians, and more). Every answer was
  checked against known geography, not generated and trusted.
- New smoke test `Tools/geography-bee-quiz-generator/test/smoke-multiple-choice.mjs`
  (`npm run test:geo-bee`, appended to the end of the root `test` chain) —
  29 checks covering distractor uniqueness/same-category sourcing (via a
  new test-only `window.__gbqTestHooks` following this repo's existing
  `window.__` convention), hidden-built-in exclusion from both rotation and
  MC pools, same-seed-same-quiz, key-matches-paper, the thin-pool fallback,
  format persistence across reload, and bank balance (30/30/30). Verified
  headless: zero console errors, zero offsite requests.

Cut from this round: nothing — the full headline plus every listed
Supporting item shipped. **Where the next round should pick up:** the Blank
Map Generator integration is still the single highest-value Major Feature
and the Open Questions below are still genuinely open — this round
deliberately didn't guess at an answer, per its own scope file's Non-goals.
A timed bee mode and region/continent tagging also remain unbuilt.

**2026-08-12 — Backlog round: bulk import a custom bank shipped (backlog
rank, then #5).** Identical shape to the same-day feature in
`053-cultural-trivia-card-generator.html` (built together, shared smoke
test): a "Bulk import a custom bank" card on the bank tab takes
`question | answer | category` lines, tab- or pipe-separated (no comma
splitting — geography questions are full of commas), extra pipe fields
folding into the answer. The optional category token is tolerant
(`capital…`, `landmark…`, `map skills`/`map`/`mapskills`); lines without
one use the Category picker above the form. Imports append to
`gbq_custom_v1` without touching built-ins, hidden built-ins, or existing
custom questions; the note reports added/skipped counts and quotes
unparseable lines; the textarea clears only on success. Verified with a
headless Chromium test: pipe and tab lines with/without category tokens,
comma-in-question survival, skip reporting, persistence, and bank-count
growth — zero console errors. **Where the next round should pick up:**
multiple-choice quiz mode (its own backlog row) and more built-ins per
category are the open items.

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from
the Ideas Backlog — closes out the Social Studies section for now. A
30-question built-in bank split evenly across three categories (Capitals,
Landmarks, Map Skills), a category filter that applies to projector
display, print, and bank view alike, shuffle, reveal-answer toggle, a
printable quiz + answer key built from a random subset, and a
teacher-editable custom bank that layers on top of the built-ins —
following the same reveal/shuffle/tabs/custom-bank pattern established
earlier in this round for Daily Editing / DOL Warm-Up Generator and Math
"Find the Mistake" Warm-Up Generator. Custom questions persist in
`localStorage` (`gbq_custom_v1`). Verified with a headless Chromium smoke
test (default question, reveal, category filter, add a custom question,
build a printable quiz) — no console errors.

**2026-08-11 — Round 2 (session `kq3g3h`).** Shipped two Quick Wins.

- **Done — Settings persistence.** The category filter and the printable-
  quiz question count now persist to `localStorage` (`gbq_settings_v1`)
  and restore on load, matching sibling generators. Saved on "Apply
  filter" and on "Build quiz" rather than on every keystroke/selection
  change, so a half-typed count doesn't get persisted mid-edit.
- **Done — Hide/disable individual built-ins.** Each built-in question got
  a stable id (`bi0`&ndash;`bi29`); the Question Bank tab gained a
  Hide/Show toggle per built-in row (built-ins still can't be deleted,
  only hidden) alongside the existing per-custom-question Delete. Hidden
  built-ins are excluded from the projector display, shuffle order, and
  printable quiz pools, but still listed (grayed out, marked "hidden") in
  the bank itself so a teacher can find and re-enable one. The bank-count
  header now reads "N active of M" once anything is hidden, instead of
  just a flat count that no longer matched what's actually in rotation.
- Verified with a headless Chromium smoke test: filtered to Capitals,
  built a 5-question quiz, hid the "capital of France" built-in, confirmed
  it no longer appears anywhere in the projector rotation, reloaded and
  confirmed both the filter/count settings and the hidden state persisted.

Not started this round: more built-in questions per category, multiple-
choice mode, the Blank Map Generator integration (still the single
highest-value item per the Moonshot section), timed bee mode, region/
continent tagging, and bulk import. Both Open Questions (map-jump
integration depth; whether a timed bee mode is worth building) remain
unresolved.

**Where the next round should pick up:** bulk import (pasted list →
custom bank) is the next Quick Win and is pure content-entry tooling, no
architecture change — reuses the pattern already proven in Staff
Directory Builder and Review Game Board. The Blank Map Generator
integration is the highest-value Major Feature but needs an explicit
decision from the Open Questions first (jump-to-location vs a simple
link) before implementation.

## What it does today

- 120 built-in questions, 4 categories (Capitals, Landmarks, Map Skills,
  Map Questions), 30 each, world-balanced
- **Map questions**: an outline map with one region shaded, drawn offline
  from the Blank Map Generator's vendored Natural Earth data by
  `geography-bee-quiz-generator/gbq-map.js` — on the projector, on the
  printed quiz, and as a thumbnail on the answer key
- Category filter applies across all three views, and persists across
  page loads along with the printable-quiz question count
- **Quiz format**: Short answer or Multiple choice, persisted, applied to
  both the projector display and the printed quiz. Map questions draw their
  distractors from other regions in the same dataset
- Projector mode: shuffle, reveal (in MC mode, reveal highlights the
  correct A&ndash;D option and states it in text)
- **Team tournament**: 2&ndash;6 named teams, live scoreboard, alternating
  turns, teacher-marked right/wrong, final standings, survives a reload
- Print: randomized quiz subset + matching answer key, either short-answer
  blanks or lettered MC options with a letter+text key; a "Quiz version"
  number reseeds the same reproducible paper on demand
- Custom question bank layered on the built-ins; individual built-ins can
  be hidden/shown without deleting them
- **Bulk import** (tab/pipe lines, optional tolerant category token) that
  appends to the custom bank, and **bulk map-question generation** that
  samples regions not already covered

## Quick Wins

- ~~**More built-in questions per category**~~ — **done, 2026-08-14** (SS
  demo round; grown 30 &rarr; 90, see Status).
- ~~**Multiple-choice mode**~~ — **done, 2026-08-14** (SS demo round,
  headline feature; see Status).
- ~~**Settings persistence**~~ — **done, 2026-08-11** (Round 2; see
  Status).
- ~~**Hide/disable individual built-ins**~~ — **done, 2026-08-11** (Round
  2; see Status).

No Quick Wins remain open as of this round. A future round should look to
Major Features below, or find a genuinely new gap.

## Major Features

- ~~**Direct integration with Blank Map Generator**~~ — **done, 2026-08-14**
  (SS demo round 2, headline; see Status). Answered the first Open Question
  below in a third way neither option anticipated: not a link and not a
  cross-page state handoff, but reading 046's data and crops directly and
  drawing the map *inside* the question. Nothing is passed between pages, so
  the toolkit still has no cross-tool navigation state anywhere.
- **Buzz-in from student devices** — the tournament's natural next step, and
  the explicit non-goal of round 2. `_shared/` already has the WebRTC pairing
  layer that 021 and 004 use, so this needs no server.
- **A timed "bee" mode**: sudden-death elimination format with a visible
  countdown per question, matching how an actual geography bee competition
  runs (as opposed to the current self-paced practice format).
- ~~**Region/continent tagging** beyond the current four categories~~ —
  **done, 2026-08-14** (session `c1jqjp`). Every question carries a region
  as data; a second dropdown filters on it and combines with the category
  filter. See the Status entry, including the two transcontinental calls.
- ~~**Bulk import a custom bank** from a pasted list~~ — **done,
  2026-08-12** (backlog round; see Status).
- ~~**Multiple-choice quiz mode**~~ — **done, 2026-08-14** (SS demo round;
  see Status).

## Moonshot / North Star

**A geography practice bank deep enough to run an actual competitive bee
(timed, elimination-format, region-filterable) that also connects directly
to Blank Map Generator so a question about a place shows that place.** The
Blank Map Generator integration is the single most on-brief improvement
given the backlog explicitly frames this tool as its "quiz-format
companion" — right now the two tools have no connection beyond a shared
theme.

## Platform themes that matter here

- **P7 (cross-tool)** — the explicit Blank Map Generator pairing is the
  clearest opportunity in this tool; bulk import (Staff Directory Builder,
  Review Game Board) is a second, smaller one.
- **P15 (first run)** — settings persistence is the most obvious first-run
  gap versus sibling generators built earlier in this round.

## Open Questions

- ~~Should Blank Map Generator integration be "jump to that location on a
  map" or a lighter-weight link?~~ — **resolved 2026-08-14**: neither. The
  map is drawn inside the question from 046's own data, so no state crosses
  a page boundary and there is nothing to click away to.
- Is a timed competitive-bee mode worth building as a mode within this
  tool, or does the self-paced practice format already cover the more
  common classroom use case (individual/small-group practice) well enough
  that a full competition mode is lower priority than more content? Round 2
  narrowed this: the team tournament covers "run it as a game" without any
  timing, so what's actually left open is whether *timing* adds anything a
  teacher wants, not whether competition does.
- Should map questions be able to run in reverse — "shade in Egypt on this
  blank map" — or is that a Blank Map Generator worksheet that belongs in
  046 rather than here? Worth a backlog row before anyone builds it.
