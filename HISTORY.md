# HISTORY — what already shipped

Condensed from the planning documents retired on 2026-09-03. This file exists for two
reasons: `CLAUDE.md` cites past decisions and they need somewhere to be true, and the
"what we got wrong" notes have consistently been the most useful prose in this repo.

**Nothing open lives here.** Open work is in `BACKLOG.md`. If you find yourself wanting
to add a to-do to this file, it belongs there instead.

---

## Stage 2 — the platform foundation (2026-09-03 → 2026-09-04, in progress)

Twelve of the fourteen planned phases have shipped: every `_shared/` service on the spine, and
now the two biggest rollouts onto it. The plan itself — the services in dependency order, so
that the tool paths become adoption rounds rather than invention — worked, and Path 3 P3/P4
are the proof: two rounds that invented nothing and changed 31 tool pages.

**CI scoped to the pull request's diff — 2026-09-05.** Every PR had been paying the full
~21-minute suite pass (measured on #187–#189) while most touched one or two tools.
`run-suites.mjs --changed` already existed for sessions; the pull-request job now runs it
with `--base origin/<base branch>` and the push-to-main job still runs the full list, as
the safety net before deploy. Reading `--changed` before trusting it with CI found three
under-selections in the first draft, all fixed in `Tools/board-check/select-suites.mjs`
(the selection logic, moved out of the runner so it can be tested): a `Tools/<folder>/`
edit did not reach the suites that open a *page* importing from that folder (an edit to
`Tools/schedule/` skipped schedule-visualizer's suites, though 035 imports from it; an
edit to `Tools/seating-chart/` skipped the store suite that opens 005); the four suites
that enumerate the tool pages with `readdirSync` (a11y sweep, theme sweep, picker rollout,
registry shape) name no page and so could never be selected by a page edit; and a
workflow-only PR ran nothing, which is the one PR that most needs to prove the pipeline.
`.github/`, `manifest.json` are now site-wide with `_shared/`, `sw.js`, `index.html`,
`package*.json` and `Tools/board-check/`. `Tools/board-check/test/select-suites.test.mjs`
(`npm run test:select-suites`) pins every rule, half of its assertions being about what is
*not* selected. The eleven guards were timed at about twelve seconds in total and left
unscoped. **What was not verified:** a real scoped run on GitHub's runner — the PR that
shipped this touches `Tools/board-check/` and `.github/`, both site-wide, so its own CI
run is a full pass by design; the first genuinely scoped run is the next one-tool PR, and
its log prints the selection and the reason for each suite. **Tradeoff:** a Markdown-only
PR now runs no browser suite at all (the guards still run); and the selector reads a
page's static `src`/`href`/`import`/`fetch` references only — a page that builds a module
path at runtime from a string would not link its folder to its suites.

**Batch size became a rule, not a number — 2026-09-05, same day.** The standing instruction
had been "work the next *two* ranked items", which was right while the top of the list was
quarter-session rows and would have been wrong the moment it reached rank 7 (Path 5 P3, a
rollout that describes itself as "batches of ~6"). It is now "work the next *batch*", sized by
the **Size** column: up to 4 ¼ rows, 2–3 ½ rows, one 1-session row, or a single 2+ row alone.

Three things drove the shape, and they are worth keeping when someone next argues about it:

- **CI is the bottleneck, not the model.** Measured across #187, #188 and #189: 20.4, 21.1 and
  21.2 minutes per pull request, dominated by the 140-suite pass. So rows-per-PR is nearly free
  and PRs-per-session is not — which is why ¼ rows of the same kind may share one PR.
- **A 2+ row is expected to survive its session.** Do one increment, ship it, and leave the row
  in place with its text rewritten to say what is done. Deleting a 2+ row because a session
  touched it is the failure mode on that side; stalling on it is the failure mode on the other.
- **Step 6 after each merge is the rule that breaks first as batches grow**, and it is the one
  with a recorded failure behind it (see the note below about #178/#180 and the hour of
  duplicate work). It is now stated in `CLAUDE.md` as well as `BACKLOG.md`, with that failure
  named, because a rule with its casualty attached survives a rewrite better than a rule
  without one.

**What was not done:** nothing measures whether a session actually obeys the sizing rule, and
nothing ever will — it is a judgement written in prose, like "one phase per PR" above it. The
honest claim is that it is easier to follow than a fixed count, not that it is enforced.

**The working mode changed, 2026-09-05.** Devon's standing instruction is now: *"work the
next two ranked items in `BACKLOG.md`, open a PR, merge to `main`"* — run without anyone
watching, with no time to review. Three changes to `BACKLOG.md` followed, and they are worth
knowing about because they invert an assumption most of this file was written under.

- **`BACKLOG.md` opens with a "How this repo is worked" section** stating the loop and its two
  rules: never stop to ask, and never park work on a person. A judgement call gets made,
  shipped, and recorded in this file so it can be reversed cheaply — not deferred.
- **Rank 1 was removed from the ranked table**, and the table renumbered to a contiguous
  1..181. It was the two live-site checks Stage 1 could never do — the two-deploy update test
  and an OS share into the installed PWA — marked **Devon only**, and Devon has said he is not
  going to run them. A row every session must skip does not belong at the top of a ranked
  list. They are parked under Cross-cutting with the full context, and the Stage 1 entry below
  already says the same thing: **still never verified on the live site.** Parking them does not
  make them done, and if either is ever run the bullet should be deleted rather than left to
  quietly become a wrong "never verified".
- **"Decisions Devon still owes" is now "Standing decisions"**, and every open question has a
  **default applied** — taken from the recommendation a previous session had already written
  into the same row. Nothing in the queue blocks on a person any more. The one that is a real
  product question rather than an implementation one is **OCR: an on-demand, non-precached
  Tesseract download against the offline promise. Defaulted to no**, because "every tool keeps
  working offline once the site has been visited" is the first sentence of `CLAUDE.md` and the
  reason this site has no CDN; the alternative, vendoring a ~10 MB build into the precache, is
  worse. That row (rank 68) should read "out of scope" rather than "pending a decision", and it
  is the first thing to bring to Devon if he ever does want to spend one.
- **Two rank citations in that table were wrong** and were corrected while it was rewritten:
  the 035-theme row had cited "Rank 6 / 21" since it was written, and rank 6 as it then stood
  was the `store.js` adoption row, unrelated to 035.

**What this does not change.** Two things are still not a session's call: promoting anything
student-facing, and re-ranking the list wholesale. Both change what the product is rather than
how it is built. The "don't promote one without Devon saying so" notes scattered through the
per-tool sections stand; the "open question for Devon" notes do not, and now mean *decide it
and write down what you decided*.

**Rank 1 — Path 5 P3, increment 1: six projector pages on native dark, three more stages on
`stage.js`. #198, `CACHE_VERSION` v154.** The first 2+ row to reach the top of the table, and
the first taken under the batch rule: alone, one increment, row left in place. The batch was
the one `npm run path5:next` printed — 010, 021, 015, 072, 023, 024 — and it was taken in
that order rather than from the P3 prose list, which is what the script exists for. Native
dark went from 9 themed pages to 15; the literal count the picker reports went from 1,749
across 74 pages to 1,497 across 68; `_shared/stage.js` from 4 adopters to 7, and the pages
still hand-rolling `requestFullscreen` from 5 to 2 (001 and 004).

**A page converts in three decisions, and the picker's number is only about the first.**
Chrome follows the theme (`#fff` on inputs and button faces → `--card`, hover fills →
`--card-2`, white-on-accent → `--accent-ink`). A projector surface is dark in *both* themes:
021's rotation stage and phone remote and 024's stage were navy with white chalk, and under a
plain token remap they would have come out light-blue with near-black text in dark, because
the accent inverts — so they read a tool-local `--stage-bg`/`--stage-ink`, navy in light and
the near-black their fullscreen views already used in dark. And a sheet of paper stays white:
015's timeline and 023's handout slips carry `paper-sheet`, which ink-paper.css uses to
restore the light tokens *and* re-declare the dark ink inside them, on a `--desk` that goes
dark with the theme. One literal was left on purpose and will keep being counted: 010's day
badges are filled with the calendar's own day-type colours, so their text stays white.

**Five of the six pages now define `--good` and the info/err/warn tint pairs locally, with
001's values.** That is the evidence 001's comment asked for before promoting them to
`ink-paper.css`. It was not done here — a P3 increment is tool pages and no shared file, which
is what lets it run in parallel with anything else — and is a separate ¼ row if anyone wants
it.

**The three new stage adopters were three different shapes.** 010 mounts `<body>` — the whole
board is the stage — and keeps projector mode as the separate persisted display state it was.
015's story overlay is `hidden` and 072's presentation overlay is `display:none` until Present,
and the helper's `enter()` fullscreens the element as it is, so both un-hide and render
*before* asking for fullscreen, route F through their own enter function with
`fullscreenKey: false`, and tear down from `onChange(false)`, the one path that the browser's
Esc, the exit button, F and the fallback's Escape all reach. All three gained, for the first
time, a fallback for a browser that refuses fullscreen and the site-standard F key. #195
predicted that adopted stages would bring their own bugs; **these three did not** — 072's
overlay-first design and 015's `wentFullscreen` bookkeeping both handled a refused request
correctly, they just handled it alone. What they lose is duplicated code, not a defect.

**`Tools/theme/test/smoke-dark-rollout.mjs` is the proof, and it is the first thing on the
site that runs axe in dark.** 97 assertions: every converted page opened with the stored
theme set to dark and again to light — `data-theme` set, no invert filter, `<body>` painted
with ink-paper's dark paper and ink (the computed colours, not the attribute), no visible
piece of chrome still `rgb(255, 255, 255)`, the paper sheets white with dark ink — then the
three new stages by button, F, F-while-typing, the refused fallback and its Escape. The
site-wide sweep only ever runs light, so before this the dark palette's contrast was checked
nowhere. Mutation-tested by turning 072's flag off: four assertions fail. `PAGES` at the top
is the suite's entire idea of which pages are adopted; a converted page left off it is a page
nobody scans in dark.

**Not verified.** No real projector and no Chromebook; the dark screenshots were looked at by
eye (`DARK_SHOTS=<dir>` writes them). Nothing installed the worker — v154 is what
`check:precache --base` agrees with. `npm test` was not run in full locally: every suite for
the six touched tools was, and CI ran the full pass.

**#197 (scoped CI) merged right after #198, and the two never saw each other.** Devon asked
whether CI had been scoped to the touched tools; this session answered "no" from a stale
`main`, then re-fetched and found #197 on top of #198. Reading its `select-suites.mjs`
turned up the one thing its own "not verified" note could not: `sw.js` is `SITE_WIDE`, and
every tool PR bumps `CACHE_VERSION` in `sw.js`, so a tool PR — the case the change was made
for — still runs everything. #198 would have; the "first genuinely scoped run" that note
waits for will be a docs or tooling PR, not a tool one. Recorded as a ¼ row at **rank 2**
(inserted, not appended, because it is what makes #197 a saving), with the fix named: treat
a `sw.js` hunk that touches only the version constant as not site-wide, and pin it in
`select-suites.test.mjs`. Not measured — read off the diff.

**Rank 1 — Path 5 P3, increment 3: six more pages on native dark. #202, `CACHE_VERSION`
v156.** The same 2+ row, taken alone again, one increment, row left in place. The batch was
the one `npm run path5:next` printed, in its order — **006, 020, 056, 019, 039, 009**. Native
dark went from 21 themed pages to 27 (33%); the picker's literal count from 1,396 across 62
pages to 1,225 across 56, ten rounds of six left. `stage.js` did not move again: none of these
six has a stage of its own, and 001 and 004 are still the last two pages hand-rolling
fullscreen. Every conversion again fell into increment 1's three categories, and the two
"not a surface" kinds #200 discovered were both *applied* to a fresh page for the first time
rather than found: a camera viewfinder (006's and 009's device-transfer `<video>`) and a mat
behind a teacher-supplied image (019's station thumbnail, 056's crop frame). They generalise.

**The suite found a real accessibility bug that `test:a11y` structurally cannot see, and that
is the most useful thing this increment produced.** 009's per-tool checkbox in the "what's
saved right now" table carried no label of its own — an axe `label` violation, critical, and
present in **light** as well as dark. The site-wide sweep has never reported it because it
opens 009 with empty storage: no saved data, no rows, no checkboxes to fail on.
`smoke-dark-rollout.mjs` writes `gvb-a11y-prefs` before navigating (that is how it sets the
theme), so the page it scans always has at least one group to list. **Any page whose UI only
appears once storage is non-empty is under-covered by the site-wide sweep in exactly this
way** — that is a general hole, not a 009 quirk, and nothing measures how wide it is. The fix
is in the tool (`aria-label="Include <group> in the backup"`), not in an allowlist.

**Two shipped families of the tint-pair values existed, and they are now one.** #200's note
says to copy 001's values; `lock.html`, shipped in that same PR, actually took 019's
(`--good-bg: #eaf5ec`, `--info-bg: #eef4f8`, `--info-line: #cfe0ea`) where 001 has `#e4f5ea`,
`#eaf1f5`, `#c9dbe3`. Both halves of the escape room are on 001's numbers now, which meant
editing an already-converted page. The differences are imperceptible; the point is that the
eventual promotion of these pairs into `ink-paper.css` has one family to promote rather than
two. `--good-line` (`#c7e2cb` / `#2f5e42`), which 001 has no counterpart for, stays lock.html's
and was copied into 019 and 009. 006's and 009's `--warn-*` triples were also near-misses
(`#fdf5e6`/`#e6d3a8`/`#7a5a12`) and moved to 001's — a small, real change to shipped light-mode
appearance, recorded here so it can be reversed cheaply.

**A token can be hiding under a tool-private name.** 020 called its success colour `--ok`, not
`--good`, so a grep for the standard names finds nothing and the page looks like it has no
semantic tints at all. It had one, with a third value again (`#2e6b3e`). Renamed, and worth
checking for on the next page that appears to define none.

**009 needed one genuinely new pair.** Its `.kind.student` tag — the purple "this row holds
student data" chip — has no precedent anywhere on the site, so `--student-bg/-ink/-line` were
invented (`#f3ecf6`/`#6a3d84`/`#dbc9e4` light, `#2b2133`/`#d9bced`/`#4c3a5c` dark). If a second
tool ever needs it, copy these rather than mixing a third purple.

**039 is the first page whose sheet of paper is built by script.** Its worksheet preview is
`.page`, generated in two template strings, so `paper-sheet` went into the JS rather than the
markup, and the sheet does not exist until a teacher picks the conjugation tab and adds a
verb — a two-click `prep` in `PAGES`, the shape #200 first needed for 048. Its desk
(`--desk: #d9d7cd` / `#0e1014`) is copied from 015 and 023 rather than renamed.

**039 was loading `_shared/a11y.js` and `_shared/a11y.css` twice** — once at the top of
`<head>` and again after `</style>`. Removed: the early `a11y.css` link (so the cascade is
byte-identical to what shipped, the late copy having always won ties) and the late `a11y.js`
tag (so the theme is still applied before first paint). **Two more pages still do it:
`Tools/014-roleplay-scenario-generator.html` and `Tools/033-ssr-log-tracker.html`** — found
with a `git ls-files` sweep, left alone because neither is in this batch and the cascade
question has to be answered per page. That is a new ¼ row in `BACKLOG.md`.

**Not verified.** No real projector, no real phone, nothing with the worker installed — the
third increment in a row. **The `DARK_SHOTS` screenshots of all eighteen adopted pages were written and looked at**,
which #200 skipped and #198 did — the six new ones read correctly in dark and light, and the
light shots confirm the tint moves changed nothing anyone would notice. The
`aria-label` fix was proved positively: axe reported the violation before and reported none
after, in both themes, out of a real browser.

**Rank 1 — Path 5 P3, increment 2: six more pages on native dark. #200, `CACHE_VERSION`
v155.** The same 2+ row, taken alone again, one increment, row left in place. The batch was
the one `npm run path5:next` printed, in its order — **025, `command-center/remote.html`,
`escape-room-builder/monitor.html`, 051, 048, `escape-room-builder/lock.html`**. Native dark
went from 15 themed pages to 21 (25%); the picker's literal count from 1,497 across 68 pages
to 1,396 across 62, eleven rounds of six left. `stage.js` did not move: none of the six had a
stage of its own, and 025 had linked the helper in #195 already.

**This is the first P3 increment that invented nothing** — it applied increment 1's three
rules and no new one. That is the useful result, not a disappointment: the rules generalise
past the projector tools they were written on. Three of the six are *sub-pages* (a phone
remote, a student lock screen, a teacher monitor), one is a big generator, two are label
makers, and every conversion still fell into chrome / paper / deliberately-left-alone.

**What it did add is a fourth category of literal that stays on purpose, and it is two more
kinds of "not a surface".** #198 had one: a user-coloured fill (010's day badges). #200 adds
a **camera viewfinder** (`remote.html`, `monitor.html` — a lens, and a pale frame around a
dark video feed is worse in a dark room) and a **mat behind a teacher-supplied image**
(`lock.html`'s clue image — often a transparent line drawing, which on a dark mat is nothing
at all). Each is left with a comment saying why, because the next session's instinct will be
to "finish" them. The **QR canvases** are a fifth case that will never appear as work: they
draw dark-on-white from inline script, which the picker does not count, and they must stay
that way because that is what a scanner needs.

**A literal can be a token's value in disguise.** 025 painted its eight remove buttons
`#a3372b`, which is `--err-light` byte for byte. Under a naive sweep those would have stayed
a light-mode red on a dark card; read as `var(--err)` they invert. Worth grepping a page's
literals against ink-paper's `-light` values before deciding any of them are bespoke.

**Two pages' `--good` was changed in light, deliberately.** `lock.html` and `monitor.html`
carried `#2f6b3a`; 001's is `#2f7d4f`, and the standing note says copy 001's values rather
than invent new ones, so they were moved. It is a small, real change to shipped light-mode
appearance (5.87:1 → 5.03:1 on white, both AA) and it is recorded here so it can be reversed
cheaply if anyone objects. `lock.html` also needed a `--good-line`, which 001 defines no
counterpart for — it has `--good-bg` but never a border with it — so one was introduced
(`#c7e2cb` light, `#2f5e42` dark) for the next page to copy rather than re-invent. Seven
pages now carry these pairs locally; promoting them to `ink-paper.css` stays a separate ¼ row,
because a P3 increment touching `_shared/` would stop being parallel-safe.

**048's label previews needed a `prep` in the suite, and that is a shape worth knowing.**
`smoke-dark-rollout.mjs` checks that a page's sheet of paper is still white with dark ink, but
048 renders no preview until an entry has a title, so its `PAGES` row adds an entry and fills
it first. A page whose sheet only exists after interaction will need the same. The suite is at
**160 assertions** over twelve pages now, from 97 over six.

**A sub-page's only accessibility coverage is this suite.** The site-wide axe sweep
(`test:a11y`) walks `index.html` and the 86 tool pages; it never descends into a tool folder,
so `remote.html`, `lock.html` and `monitor.html` had no axe coverage at all before #200 put
them in `PAGES`, and what they have now is dark-only-plus-light through that one suite. Worth
knowing before assuming a sub-page is as well covered as its parent.

**Scoped CI's first genuinely scoped run is #201, the step-6 PR for this entry: 43 seconds
green.** #197 shipped `--changed` for pull requests and could not measure it, because its own
PR touched `Tools/board-check/` and `.github/`, both site-wide. #201 touches two Markdown
files, so the selector picked no browser suite and only the eleven guards ran. That is the
tradeoff #197 named — a Markdown-only PR now runs no browser suite at all — observed rather
than predicted, and it is the other half of the #200 measurement below.

**#200 is the measurement rank 2 was waiting for.** That row says #197's scoped CI cannot
help a tool PR because `sw.js` is `SITE_WIDE` and every tool PR bumps `CACHE_VERSION` in it —
written off the diff, with "confirm on a real CI log" attached. #200 is that log: six pages
and one test file changed, and CI ran all 145 suites in 23.4 minutes. The row stands as
written.

**Not verified, and one thing done worse than #198.** No real projector, no real phone, and
nothing installed the worker. **The dark screenshots were not looked at** — #198 wrote them
with `DARK_SHOTS=<dir>` and inspected them by eye; #200 relied on the suite's computed-colour
assertions and axe-in-dark alone, which prove no white chrome and no contrast failure but not
that a page *reads* right. Anyone wanting the stronger check can run the suite with
`DARK_SHOTS` set and look at all twelve. **`npm test` was run in full locally** this time
(145 green, 25.3 min) as well as in CI (23.4 min), so both numbers are measured on this
sandbox and on the runner. One process note that cost time and is worth writing down: this
sandbox's container clock does not advance between turns, so a background suite run makes no
progress while the session is idle — a long local run has to be waited on inside a single
foreground call, and a first attempt here was killed on a misreading of that.

**Ranks 1 and 2 — the Path 5 groundwork: the picker exists, and the last three hand-rolled
stages are gone. #195, `CACHE_VERSION` v153.** Two ½ rows in one PR, the same path's
prerequisites.

**`npm run path5:next` (`Tools/board-check/list-dark-candidates.mjs`) exists.** It was the
third tool this repo documented and never committed, and the one whose invented output a #167
handoff quoted as fact — the reason `check:docs-commands` was built at all. The guard's
`KNOWN_MISSING` entry for it was deleted in the same commit, which is the arrangement working
rather than being worked around: check 3 of that guard fails the day a `KNOWN_MISSING` script
appears, so the exemption could not have outlived the gap. **`KNOWN_MISSING` is empty now, and
empty is its healthy state.** Read-only, shaped like `phase4:next`, exit code always 0.

**It replaces a number this file had already had to delete once.** The #167-era "17–45
hardcoded literals per tool" was removed in #169 rather than corrected, because it swept in
`white-space`, `@media print` blocks and inline script and was about 3× too high. The measured
version: **1,749 colour literals across the 74 pages still on the invert filter — median 17,
range 3–74, none at zero.** A literal counts only in a colour-bearing property, only inside
`<style>`, never inside `@media print`, and never inside a rule that is already dark work
(`[data-theme="dark"]`, `prefers-color-scheme: dark`).

**Both exclusions were checked, not assumed.** 010's 13 were enumerated by hand and matched
the script exactly (1 custom property + 9 `background` + 3 `color`); turning the print
exclusion off took 021 from 67 to 80, so it demonstrably fires. That is the whole reason to
believe the new figure and not the old one.

**Two findings the script produced on its first run that no prose list had.** **004 already
has a native dark palette** — it has since #167 — and the Path 5 P3 rollout list still names
it. And **fourteen live pages load no `a11y.js` at all** (002, 007, 016, 018, 034, 035, 038,
044, 086, `classroom-label-maker/speak.html`, and the four root landing-page variants), so
they get no theme in either direction; **007 is on the P3 list and cannot be converted until
that changes.** That is a different kind of work from a palette conversion and P3 should not
absorb it silently.

**`tokens` vs `scattered` was meant to find a cheap tier and did not.** The split counts
literals in custom-property declarations separately, on the theory that a page with its own
`:root` palette converts in one dark block. **46 of the 74 pages have zero token literals,
only three have five or more, and the median is zero** — these pages inherit ink-paper's
palette and then paint over it in place. So there is no cheap tier: a low total means a small
page, not an easy one. Recording it because the opposite was the expectation.

**`_shared/stage.js` went from one adopter to four.** 021, 023 and 025 lost their own
`requestFullscreen` toggle, `fullscreenchange` listener, label updater and F-key handler —
the three copies the P2 row named and #180 left behind. Every `:fullscreen` CSS rule became
`.is-fullscreen`, which the helper sets for real fullscreen and for its fallback alike, so
one selector now drives both cases where each tool had written the rule for one.

**Two bugs came out of an "adoption" round, and neither was in the row's text.** 023's and
025's toggle buttons live outside the element being fullscreened, where the Fullscreen API
does not render them — a teacher on stage had no visible way out but the F key. They are `hud`
now, moved onto the stage on entry and put back on exit. And **025's F always drove the prompt
stage, even with the Anonymous Responses overlay open on top of it**, so it fullscreened
something the teacher could not see; `enabled` gives F to the overlay while the overlay is up.
The lesson for P3: **a tool that hand-rolled a stage also hand-rolled its bugs**, and the
adoption is where they surface.

**None of the three had any fallback before.** A browser with no Fullscreen API, or one that
refuses the request, left the button doing nothing at all. All three have one now, for free,
because it is the helper's.

`Tools/stage/test/smoke-stage-rollout.mjs` — new, 116 assertions, in `suites.json` and
`test:stage`. It drives all five stages (021, 023 ×2, 025 ×2) in a real browser: real
fullscreen from the button, the rewritten `.is-fullscreen` CSS filling the viewport, the
button staying reachable on stage and returning to its home node, F entering and exiting, F
while typing doing nothing and the letter reaching the box, the refused-fullscreen fallback
and its Escape, 023's two-tab gate, and 025's overlay taking F. **Each on-stage state is
scanned with axe** — a state the site-wide sweep never reaches, which is what rank 2 asked
for. Clean everywhere. 143 suites green locally in 23.3 min and in CI in 22.7.

**Not verified:** no real projector, and no browser that genuinely refuses fullscreen — the
fallback is driven by rejecting `requestFullscreen` from inside the page, which is the
strongest thing available headless. Nothing installed the service worker; v153 is what
`check:precache --base` agrees with, not a measured install. The five pages that still
hand-roll fullscreen (001, 004, 010, 015, 072) were counted and not opened. And
`check:dedupe` was **not** extended to `drawQR` — that is Path 6's verification note, still
open, and #195 did not touch it.

**One deliberate difference between the picker and `smoke-theme.mjs`:** the picker excludes
fixtures under a `test/` folder and `Other Landing Page ideas/`, an unlinked and unprecached
second copy of the four root landing-page variants (rank 87 is to delete it). That is why it
reports 97 live pages where the theme suite reports 102. The root `v1-inbox.html` and its
three siblings ARE linked from `index.html` and ARE precached, and are counted.

**Ranks 1 and 2 — the last non-contrast a11y allowance, and a third of the install. #191,
`CACHE_VERSION` v151.** Two quarter-session rows, shipped as one PR because they are the same
kind of work: a claim in a list that nobody had opened the code to check.

**034's `aria-required-children`.** `.mode` carried `role="tablist"` over six plain buttons,
which is a tablist with no tabs in it — the one non-`color-contrast` line left in
`Tools/a11y-sweep/allowlist.json`, there since the 2026-09-03 baseline. The buttons are now
`role="tab"` with `aria-selected` and a roving `tabindex`, the stage is the one `role="tabpanel"`
they control and is relabelled to whichever tab is selected, and Arrow/Home/End walk the bar and
activate on arrival — the same automatic-activation pattern 035's own `#tab-bar` has used since
Round 51, so the site has one answer rather than two. `brSyncTabs()` does the state, `brWireTabKeys()`
the keys; the allowlist line is deleted and `test:a11y -- --only 034` is clean.

**The fix had to land in three places, not one.** 034 is a *published snapshot* of a browser
that also lives inside 035 and is regenerated by `brBuildPublishedMarkup()` + `brPublishFnList()`.
Fixing only 034 would have been undone by the next Publish, which is exactly the R61–R63 drift
this repo has already recorded once. So 035's in-app copy, its publisher template, and 034 all
carry the same markup, and both helpers are in `brPublishFnList()`.
`Tools/schedule-browser/test/smoke-mode-tabs.mjs` (27 assertions, wired into `suites.json` and
`test:schedule-browser`) asserts the tab state *and* that the mode switch still renders — a page
whose script throws scans clean in axe, so the switch is proved positively — and it drives
`brBuildPublishedMarkup()` in 035 to check the published markup, which is the drift guard.

**jsPDF and SheetJS left the install tier**, `SHELL_URLS` 85 entries / 3.86 MB → 82 / 2.63 MB.
**1.23 MB, a third of what "installed" meant, measured — not estimated.**

**The row's reasoning was half wrong, and the fix is right anyway.** It said "no shell tool uses
them". True of jsPDF: nothing in the ten shell tools references it at all. **Not true of
SheetJS — 001, 006 and 032 all use it** — but all three *inject it on demand* behind an explicit
"import/export a spreadsheet" click, and all five call sites already handle the load failing with
a plain message ("Couldn't load the spreadsheet library. The CSV export works without it."). So
the honest rule is not "no shell tool uses them" but **"a vendored library belongs in the install
tier only when a shell page loads it with a plain `<script src>`"** — jsqr, qrcode.js and jszip do
and stay; jsPDF and SheetJS do not and now arrive with the deferred pass. That rule is written
into `sw.js`'s header.

**The failure mode being accepted, stated plainly:** a teacher who installs the site, goes
offline within the few seconds before the deferred pass finishes, and then imports a spreadsheet
gets that error message instead of an import. Nobody has reproduced it — it needs a real install
and real offline, which is the same thing Stage 1's two live-site checks are parked for.

**`check:precache` grew a sixth always-on check, SHELLDEP**, to keep that rule from being
re-broken in the other direction: every subresource a *shell page* loads eagerly (`<script src>`,
`<link href>`, `<img src>`) must be in `SHELL_URLS` too, or the page is broken rather than slow
for a teacher inside that window. Deliberately narrower than the MISSING scan's `src|href`: an
`<a href>` says nothing about the install tier, and counting it would drag the whole site into
the shell one link at a time. It was proved in both directions before it was committed — clean on
the tree as it stands, and it names `044-Sub Plan Builder.html → jszip.min.js` the moment jszip is
removed from `SHELL_URLS`.

**What was not verified.** The two-tier behaviour was not re-run against a real browser install:
`smoke-sw-tiers.mjs` drives a synthetic staged worker, not this list, so what is proved here is
that the list is internally consistent (`check:precache`, including `--base origin/main` for the
bump) and that nothing eagerly loaded left the shell. The 1.23 MB is `stat` on the three files,
not a measured install. And the site still has **no** suite covering `sw.js`'s real
`PRECACHE_URLS`/`SHELL_URLS` — a wrong entry is caught by a guard, never by a browser.

**And a flake that was not this batch's, found by being the branch that ran into it.** CI went
red at `drive-weighting.mjs`'s "the student who is behind is drawn far more than 1 in 6 (got
40% of 20, ceiling 50%)" on a branch that does not touch the name picker, after all 141 suites
had passed locally. Modelling the exact chain the suite drives — `uniformPick` +
`fairnessWeights` + the no-repeat rule — over 200,000 simulated runs says why: with the behind
student seeded 60 calls back, `weight = max - count + 1` gives her 61/65 of each eligible draw
at the start and 52/56 by the twentieth pick, because her own count climbs while everyone
else's stands still. That is a long-run rate of **~47.9%, not the ~50% ceiling the assertion is
written against**, and `> 0.4` therefore fails **4.4% of runs**. CI drew exactly 8/20.

A second flake sat underneath it and would have surfaced later: `leanRate > flatRate + 0.15`
needs the flat sample below ~35%, and twenty draws of a 1-in-6 chance lands on 7+ hits about
**1 run in 92**.

Both were fixed as budgets, which is what `CLAUDE.md` asks for: the seeded deficit went 60 →
600 (self-correction now negligible over twenty picks — 49.96% mean, that assertion failing 1
run in ~77,000) and the flat measurement got its own `TRIES_FLAT = 40`. Measured over 300,000
simulated runs the suite fails about **1 run in 4,500**, for ~36 seconds of extra wall clock;
each draw is a real ~2s UI roll, which is the only reason those numbers are not larger. **No
assertion was loosened, no `expectedFailures` entry was added, and `Math.random` was not
seeded.** Verified in a browser with `--repeat 3 --only name-picker`: same outcome all three
passes, the lean at 50% each time.

**The transferable part:** model the chain the *page* actually runs before choosing a budget.
The no-repeat rule caps this property at 50%, so an assertion at 0.4 has a quarter of the
headroom it appears to have — and the same suite's own comments show the previous session
reasoning carefully about the flat sample's noise while missing that the lean's ceiling was the
tighter constraint.

**Ranks 2 and 3 — two guards over the claims the documents make. #187, no `CACHE_VERSION`
bump: nothing precached changed, and `check:precache --base` confirmed it.** Both come from the same recurring failure — a document asserting
something nobody checked — and both found real drift on their first run.

<!-- docs-commands: off — this entry's subject is commands that no longer exist; naming them is the point -->

`npm run check:docs-commands` (`Tools/board-check/check-docs-commands.mjs`) fails when a
tracked `.md` writes `npm run <name>` for a script `package.json` does not define, or
`node <path>` for a file that is not in the tree. It exists because **three tools have now
been documented in this repo that were never committed**: `sync-social-tags.mjs`, the original
`board-check` folder, and `list-dark-candidates.mjs`, whose invented output a #167 handoff
quoted as fact and a later session tried to work from. **It caught three on its first run,
all of them survivors of the never-committed `board-check` package:**
`Tools/schedule/README.md` told you to run `npm run social` to put a social block back after
republishing 034 and `npm run social:check` to verify it — neither exists, and no command
does that job, so that section now says the restore is a hand edit out of git history and
points at the read-only `check-social.mjs`; and `Tools/seating-chart/README.md` said the
driver "does not fight `npm run games` for the screen", a dev server that is also gone. The
same file's tree diagram still listed `Tools/schedule/libs/jspdf/`, deleted in Refactor
Phase 1 — fixed in passing, since `_shared/vendor/jspdf/` is where 035 actually loads it
from. `npm run path5:next` is the one name in `KNOWN_MISSING`, because three sentences across
`BACKLOG.md` and `HISTORY.md` exist precisely to say it does not exist; the guard fails if
that script ever appears, so the exemption cannot outlive the gap. *(And it did not: the
script landed on 2026-09-05 and the entry was deleted in the same PR. `KNOWN_MISSING` is
empty now.)* **Deliberately not
checked:** bare backticked file paths. There are 318 of them across the tracked `.md` files
and most are written without a directory prefix (`005-seating-chart.html`), so resolving them
means guessing — measured, then not implemented.

<!-- docs-commands: on -->

`npm run check:adoption` (`Tools/board-check/check-adoption.mjs`) measures the shared-file
adoption row of `BACKLOG.md`'s header — the last number in that table with no script behind
it. It walks the 86 tool pages' real `src`/`href` and `import` references, follows per-tool
modules, and prints the row as pasteable Markdown; `-- --file roster.js` names the adopters,
`-- --check` fails if the header disagrees. **It reproduces the 2026-09-04 header exactly on
all eighteen rows it carried**, which is the only reason to trust it, and that check was run
before the file was committed. It also **disproved a sentence in that same header**:
`student-details.js`'s two consumers are 008 and **007** (via `np-details.js`, which
re-exports it), not "006 and 008" — 006 only names the file in two comments. That is the
identical mistake the row was written to end, one section further down the same document. Two
files the header had simply omitted are now in the row: `sw-register.js` 85 and `a11y.css` 77.
Indirect adopters are reported as `+n via a module` rather than folded into the count, so the
long-running number keeps meaning what it meant.

**A third wrong number, found while re-ranking.** This file's ranked table has always been
described as "a contiguous 1..189". It has never held more than 185 rows; after #187 removed
three (the two guards and the `Tools/schedule/libs/jspdf/` README row they fixed in passing)
it holds 182. The block boundaries quoted in the "how this order was arrived at" paragraph
were re-measured from the table rather than shifted down by three, because the old text
contained the same class of error it was itself warning about — it said "39 enhancement rows"
then "42 other tools" for a block of 82.

**Why `check:adoption` runs in CI without `--check`.** The header is legitimately stale
between a merge and the step-6 rewrite that follows it, so failing on that by default would
go red during normal work. The CI step proves the script still runs and prints the row; the
verification is opt-in, and step 6 of the definition of done now names it.

**What was not verified.** Neither guard has a test suite — no guard in `Tools/board-check/`
does, and `check-tests.mjs` exempts that folder from ORPHAN. Both were instead proved
positively by hand, per `CLAUDE.md`'s "a guard going quiet is not evidence": a bogus
<!-- docs-commands: off — the same, for the two deliberately-bogus probes below -->
`npm run bogus:script` and `node …/nope.mjs` were pasted into a tracked `.md` and both fired;
<!-- docs-commands: on -->
a `path5:next` script was temporarily added to `package.json` and STALE fired; the
placeholder forms (`npm run test:<name>`, a bare `npm run`) produced no noise; an unclosed
muted region fired UNCLOSED, and a citation placed after a closing marker was still caught
while one inside the region stayed muted. That is reproducible from the header comments but
is not automated, and a future edit to either regex has nothing catching it.

**Path 3 P3 — the saved-roster picker, across 31 tools. #184, `CACHE_VERSION` v149.**
`np_rosters` was read by 25 tool pages through roughly six copy-pasted picker functions, and
they disagreed about everything that matters: five (017, 022, 033, 043, 084) called
`rosters[n].length` with no `Array.isArray` guard inside a `catch` that blanked the whole
control, so **one hand-edited entry hid every roster**; none of the 25 saw a write made in its
own tab and only two heard one from another; and they used four different spellings of the
escaping question. 19 pages now mount `Roster.mountRosterPicker`; six (010, 016, 024, 050,
064, 068) keep a dropdown of their own but read through `Roster.listRosters()`/`getRoster()`,
because each does something the helper does not offer — hiding an empty roster, disabling a
button with an explanation, a datalist of every name on every roster, or a `prompt()`. Six
tools that had no picker at all (021, 058, 060, 073, 075, 077) gained one that fills the names
box and saves nothing. **036 and 044 were on the row's list and deliberately got nothing**:
neither has a student-names field, so a picker there would have had nothing to fill.
`check-registry.mjs` learned to read a `Roster.*` call as a read of `np_rosters`, because
otherwise every adopter dropped out of the storage scan the moment it adopted — the same
silent disappearance `STORE_WRITE_RE` exists to stop one layer down. **What it changed that a
teacher can see:** `readRosters()` trims and drops a blank entry, so a roster the old copies
counted as 5 counts 4; and `mountRosterPicker` always renders a placeholder, so 003's two
dropdowns no longer preselect the first roster. **Not verified:** nothing was driven in a real
browser by hand, and 003, 023 and 025 mount their pickers only behind a mode switch that needs
a saved document first, so those three are covered by the suite's static half rather than its
driven half.

**Path 3 P4 — `Roster.trackRenames` and the eight tools that keep history. #185,
`CACHE_VERSION` v150.** Eight tools key per-student history on the NAME STRING, so
re-importing a roster whose gradebook export switched from `Smith, Aiden` to `Aiden Smith`
orphaned all of it — points, hall passes, pairing memory, lab-role recency, novel-circle
roles, reading logs, contact logs, safety contracts — for every student in the class at once.
008 had solved it alone in about forty lines; this is that code generalised into
`trackRenames(rosterName, names, idNames)`, which returns `{idNames, renames:[{id,from,to}]}`
and **moves nothing**: what a rename means to a tool's storage differs in all eight, and 008's
refusal to move a record onto a name that already has one is a judgement about behaviour
records that a contact log answers the opposite way. 008 was ported onto it (its existing
24-assertion suite passes untouched) and 001, 002, 013, 022, 027, 033 and 068 adopted it.
Seven store the `{id: name}` map in the per-class state they already had; 068's roster is a
bare array, so it got one new key, `pcl_idnames_v1`, registered as student data.
**The ceiling, written down rather than papered over:** an id survives a re-spelling whose
sorted tokens match, which is exactly the whole-file flip above, but retyping `Aiden Smith` as
`AJ Smith` mints a new id and nothing can follow it — the alternative is guessing that two
different names are one student. Following that needs Class Roster Hub to offer an explicit
"same student, new name" action; assertion 27b is the marker for whoever adds one.
**The defect this found, and it was already in 008:** every adopter saved the id map only when
something moved, so a boot that *seeded* it never wrote it — and the map is the entire record
of what each id was called last time, so the next rename was invisible. Nothing caught it
because the tool looks fine the whole time. All eight persist unconditionally now.
`registry-shape`'s assertion 9 grew an explicit list of keys created since the 009 migration,
because the old rule could not classify a key that did not exist; a second assertion keeps the
list from excusing anything but student data. **Not verified:** no teacher's real data was
migrated — every rename case is a fixture seeded through `Roster.syncRecords`, which is what
006 itself uses to mint ids — and nothing was driven in a real browser by hand.

**Path 4 P3 — `_shared/media-db.js`, the media store and the one downscaler. #182,
`CACHE_VERSION` v148.** Nine tools (005, 015, 019, 028, 041, 042, 056, 071, 080) base64 an
image into localStorage and share a ~5 MB ceiling with every roster and setting on the site;
a data URL is ~33% larger than the bytes it carries, so the encoding is part of the problem.
Exactly one tool had it right — 046's `bmg-map-cache.js`, cited across the planning notes as
"the pattern" by tools that then wrote a data URL anyway — and this is that file,
generalised. `window.MediaDB`: `put/get/getBlob/list/remove/clear/usage` over **one**
database, `gvb-media`, one store, `blobs`, with tools sharing it through a **namespace
prefix on the record id** rather than a database each. One database is one registry row,
which is one thing 009 can name, back up and clear at year end; nine would be nine chances to
forget one. `store({db, store})` takes a database of its own and has exactly one caller,
`bmg-maps`, whose database name, store name and keyPath are a contract with what is already
on a teacher's disk. **Records are flat** (`{id, blob, size, type, savedAt, ...meta}`)
precisely so the records written before this module are still valid records — the obvious
`{id, blob, meta:{…}}` envelope would have needed a migration carried forever. A failed write
is never silent, exactly as store.js has it: `put()` rejects with a message meant to be
shown and `err.quota === true` when the browser is full, while reads degrade to "nothing
stored" so a tool whose photos are gone still opens. `downscaleImage(file, {maxDim, quality,
type, as})` replaces the three copies (tlb-photo 480 px, scg-photo 160 px, 028 inline
1600 px) and returns a Blob, or a data URL for a tool still saving into localStorage.
046 was the single adopter — `bmg-map-cache.js` is a ~50-line adapter now. `gvb-media` is
declared in the registry with a new per-database `backupByDefault`, so 009 ticks the store
nothing can re-download and leaves the map cache unticked; before this, everything in
IndexedDB defaulted to unticked, under a comment still saying the site had one database.
`check-registry.mjs` learned to read `MediaDB.store({db})`, because an adopter contains no
`indexedDB.open()` at all and would otherwise have dropped out of the scan — the same
disappearance `STORE_WRITE_RE` exists to stop one layer down. **What the suite caught on the
way in:** `get()` rewrote `id` on the record it was handed, stripping the namespace prefix
from the stored object so the next `list()` filtered out its own record. It is invisible in a
browser, where IndexedDB returns a structured clone, and was only visible because the Node
suite's fake store hands back the same object; it returns a copy now. **Also learned:**
`prepPage()` gives every page its own browser context and IndexedDB does not cross one, so
the "009 lists and ticks it" section failed for a reason that had nothing to do with 009 until
it opened the backup page in the same context. **Not verified:** no teacher's real cache was
migrated — "the old records need no migration" is proven by seeding a legacy-shaped record and
reading it back through 046's own adapter, in both suites, not by opening a browser that has
had 046 in use for a year. `gvb-media` has no records yet; it is declared, empty and exercised
only by the suite, which is safe because 009 opens a declared-but-absent database, finds it
storeless and deletes it again. `downscaleImage` has no adopter — one adopter per new module,
and migrating the three copies is P4.

**Path 14 P2 — `_shared/seating-read.js`, one reader of the seating chart. #182,
`CACHE_VERSION` v148 (same bump).** Four files read `seating-chart-v1` and no two shared a
line: 010's inline SVG panel, 008's `behavior-points-tracker/seating-layout.js` — whose own
header says it is copying 010's approach so the two "don't quietly disagree about what a
chart means" — 045's printed desk table, and 007's roster peek. `window.SeatingRead` is
`parse`/`read`/`onChange`, `pickSection`, `placeDesks`/`bounds`/`toPercent`,
`unseatedNames`/`fill`/`deskRows`, read-only permanently because 005 owns the key. Desk size
(106×70) is `ROOM.deskW/deskH` over there and was hardcoded separately in 010 and 008; it is
one constant now. `onChange` listens to `storage` alone and says why: 005 writes through
`gvb-save.js`, not `store.js`, so `Store.onChange`'s same-tab half would never fire for this
key and wiring it would imply a guarantee the key does not have. **The three disagreements
were recorded, not harmonised** — which section to show (010 remembers per period, 008 per
its own section, 045 shows `active` and nothing else), what the bounding box is drawn around
(010 measures every desk, 008 only the desks it matched to its roster, which also moves its
mirror axis), and whether a rotated desk's `(w-h)/2` overhang is allowed for (010 yes, 008
no, 045 draws no room). Two of those change what a teacher sees, so they belong to 008's and
045's own rounds; `bounds()` measures whatever it is handed so a migrating caller keeps its
behaviour, and the header names 010's as the one to converge on. 010 was the single adopter —
the tool all of it was copied *from* — and its 34-assertion panel suite is green unchanged,
now also pinning the rendered `viewBox` to numbers worked out by hand from its fixture, which
is what says the page draws the same room after the maths moved. **Not verified:** nothing was
looked at on a projector, and 008's and 045's copies are still there — this phase removed one
of four, not three of four.

**Path 5 P2 — `_shared/stage.js`, the fullscreen/projector helper. #180, `CACHE_VERSION`
v147.** Eight projector-first tools each hand-rolled a fullscreen stage and disagreed about
the fallback when the browser refuses or has no API (only 024 had one), about Escape (the
browser's key in real fullscreen, nobody's in the fallback) and about whether hotkeys work off
stage; the platform notes record the "only the fullscreened subtree renders" wrinkle being
rediscovered four times. `Stage.mount(el, {…})` owns all of it: `is-fullscreen` on the element
in both the real and the fallback case (so one selector styles both — 024 had every rule
three times), `stage-fallback` alongside in the fallback, `hud` elements moved inside the
stage while on and put back exactly where they were, Escape out of the fallback,
`stage-presenting` on `<body>`, one stage active at a time, `enabled()` for a page with two
stages on two tabs, and the site-standard key guard. 024 was the single adopter — the row
said "adopt in 023, 024, 025, 021", the definition of done says at most one adopter, and the
Path 4 P1 precedent decided it; the other three are a backlog row. The browser suite drives
**real** fullscreen: headless Chromium grants `requestFullscreen` from a click, which was
checked before the suite was written. **Bug found by the new on-stage axe scan:** 024's
category tags kept the page's muted-on-paper colours on the dark stage (2.6:1). The
site-wide sweep never scans a state behind a click, so every projector tool's on-stage
contrast is unmeasured until its adoption round scans it. **What went wrong:** the first
version of the suite pressed Space on a randomly drawn prompt, and a single-expression prompt
leaves nothing to reveal — the hotkey had fired, the assertion was wrong; it now types a
four-line string first. A Playwright `Escape` does not leave real fullscreen (that is the
browser's own key), so that path is driven through the Exit button. **Not verified:** nothing
was seen on a projector; the fallback was exercised only by stubbing `requestFullscreen` to
reject, not on a browser that genuinely lacks the API.

**Path 6 P1 — `_shared/share.js` + `_shared/qr-draw.js`, the share sheet and the QR budget.
#178, `CACHE_VERSION` v146.** Seventeen tools share state through `state-link.js` and each
grew its own share UI: a copy-link button, sometimes a QR modal with its own `drawQR`
(**twelve** copies site-wide), sometimes `navigator.share`, and in four tools (028, 050, 056,
064) a hand-written "too long for a QR" fallback that fires only when the encoder throws past
version 40. A version-40 code at 264 CSS px is 1.4 px per module; no phone reads it, the tool
just looks broken. `qr-draw.js` draws every module at an integer number of device pixels (the
fractional-seam bug `ct-mirror.js` had fixed for its pairing codes and the other eleven copies
never got) and carries a budget that is **measured, not guessed**: `Tools/share/test/
qr-draw.test.mjs` renders codes of every version through the same loop, blurs them the way a
camera does, and decodes them with the vendored jsQR — at 2 px per module nothing decodes, at
3 it fails under heavier blur, at 4 it holds — so `MIN_PX_PER_MODULE` is 4, a 480 px sheet
takes up to version 23 (~1.1 KB) and a 320 px one up to version 13, and the suite asserts the
constant against its own measurement. `share.js` is one dialog: Copy link, Show QR code
(greyed with the reason when over budget), Download file (a `.json` of the *full* state that
names its tool and param), Share… where the browser has it. *Images never ride in a link, by
policy*: `stripImages()` drops every `data:image/` and `blob:` string before the URL is built
and the sheet says so. 064 was the single adopter; its download now carries photos.
**What went wrong on the way:** the first measurement rendered at fractional px per module
and produced nonsense — misses at version 9 and successes at version 30 — which is the seam
bug itself showing up in the measuring instrument; the second pass at integer px is the one
the suite keeps. Version 40 at 4 px is marginal under the heaviest blur (2 of 3 payloads), so
the floor is asserted over versions the budget can actually draw (≤ 24), and the header says
so. **Found and recorded, not fixed:** jsQR misses version 23 specifically, at every size and
blur, on payloads every other version decodes; teachers scan with phones, not jsQR, so it is a
documented decoder quirk in the suite, not a renderer bug. **Not verified:** no code was
scanned with a real phone from a real screen or projector; the budget is the decoder's floor
plus a margin, not a field measurement. `check:dedupe` was **not** extended to `drawQR`,
because it would fail today on the eleven remaining copies — that belongs with P2. **On step 6:** #178 merged before its session had written this entry — it was
mid-way through #180 and meant to write both at once — so for about an hour its row was still
in `BACKLOG.md`'s table, where the parallel roster session found it and removed it (#179).
Both rewrites were merged by hand afterwards. Write step 6 after each merge, not after the
batch.

**Path 3 P1 — `_shared/roster.js`, the roster service and the identity layer. #176,
`CACHE_VERSION` v144.** `np_rosters` — `{ "Period 3": ["Aiden Smith", …] }` — is read by
**28 tool pages** through roughly **six** distinct copy-pasted picker functions. Measured:
most parse the key twice per interaction, only two (050, 064) listen for the cross-tab
`storage` event, **none of the 28** sees a write made in its own tab, and five (017, 022,
033, 043, 084) call `rosters[n].length` with no `Array.isArray` guard inside a `catch` that
blanks the whole control — so one hand-edited entry hides *every* roster. `roster.js` is
`window.Roster`: the roster CRUD, the identity layer (`getStudents`, `resolve`, `matchName`,
`reconcile`, and `diffNames` added in P2), the parsing lifted out of 006, and
`mountRosterPicker`, whose options are built with `createElement` — which is why the file
has no escape helper at all. The four different escaping spellings across the six variants
were four answers to a question that only existed because they concatenated markup.

*The finding this phase turned on:* **reading `np_rosters` through `Store` is fine; writing
it through Store's envelope is catastrophic.** It would put `{"v":1,"data":{…}}` on disk and
all 28 readers would show a teacher an empty roster list with nothing to say why — and the
Name Picker *silently*, because `np-store.js`'s sanitizer walks the envelope's own keys,
drops both, and returns `{}`. So `store.js` gained `set(key, value, {raw: true})`: a bare
write for the handful of keys whose on-disk shape is a contract with tools that still
`JSON.parse` them directly, keeping the quota report, the same-tab announce and the blocked
fallback. Such a payload is legacy version 0 by store.js's own rule 2, so it round-trips
through an identity `migrate`. `crh_students_v1` is the same case. **Assertion 1 of
`Tools/roster/test/roster.test.mjs` is that guard, and it is the reason the suite exists.**

006 was the single adopter and got smaller: twelve `saveAll(all)` call sites became
`setRoster`/`removeRoster`/`renameRoster`/`replaceAll`, and 279 lines came out. Two
pre-existing bugs went with them — `loadRecords()` **discarded** any `crh_students_v1` whose
`version` was not 1, so a teacher who opened a newer build and then an older one lost every
preferred name and pronunciation silently; and `syncRecords`/`adoptNames` were two
hand-written copies of one matcher that had already drifted (only one guarded a non-string
name). `getStudents()` returns `id: null` for a name the sidecar has never seen: readers do
not mint, only 006 does, because two readers minting separately would be two different ids
for one student. `check-registry.mjs`'s wrapper detection learned `Store.set` alongside
`localStorage.setItem` — 006 both wraps its keys and adopts store.js, and without that all
three `crh_*` keys, every one student data, went STALE. **Adoption must never be the thing
that drops a tool out of that guard.**

**What this phase got wrong on the way.** The port introduced a real bug: "Move to another
roster" mutates two rosters and relied on one `saveAll` to persist both, so replacing that
one call dropped the destination silently. Nothing caught it, because **none of 006's twelve
write paths had a suite at all** — the two existing roster-hub suites only *read*
`np_rosters`. `smoke-roster-writes.mjs` (23 assertions, port 8407) was written for that, and
mutation-tested against exactly that bug. A NUL byte also reached the picker's
"type names manually" sentinel and survived every passing assertion until a test was written
for the option model. **Not verified:** nothing was seen on a real projector, a Chromebook
or a phone, and no screenshot pass was run.

**Path 3 P2 — bulk import in Class Roster Hub. #177, `CACHE_VERSION` v145.** 006 could
**export** a workbook and could not read one, and a six-period gradebook export had to be
imported six times by hand. Now: `.xlsx` through the existing lazy `loadXlsx()` injector
with each *sheet* its own table; many files at once, dropped anywhere on the page, walked
one at a time with a "2 of 6" label and each becoming a roster named after its file or
sheet; splitting one timetable export by its Period column into N rosters under an editable
`Period {value}` template; and a **diff before anything is written** — "1 new, 1 no longer on
it, 2 renamed, 0 unchanged" — from a new pure `Roster.diffNames`. The rename half is what
earns that function: a gradebook that switches to "Last, First" produces a rename for *every*
student, and without matching them the same import reads as "28 new, 28 left" and a teacher
reasonably concludes the file is wrong.

**`gvb-roster:meta.v1` was not built, on purpose** — Track R2 specifies it, but 006 already
stored period/subject/term on `crh_students_v1.rosters[<name>].meta`, so `source` and
`importedAt` joined them there rather than becoming a second answer to "what period is this
roster", plus a registry row and a backup surface. Rename-propagation, also listed under R2,
stayed deferred: nothing but 008 reads the id sidecar yet, so there is nothing to propagate
*to*. `BACKLOG.md`'s R2 text is struck and corrected rather than left to mislead.

**Two bugs caught by tooling rather than by eye, both in code written minutes earlier.**
`check:hidden-flex` found that `.map-row { display: flex }` beats the `hidden` attribute on
the new split controls — they would have been permanently visible; 006 had no `[hidden]`
rule. And mutation-testing the rename detection printed "**3 news, 0 unchangeds**":
`plural()` was being handed adjectives. Every passing assertion had accepted it, because
they regex-matched fragments; the diff text is now pinned in full. **Not verified:**
drag-and-drop is covered only through the file input, never through a real OS drag.

**A process note worth more than either feature.** A background task reported "completed,
exit 0" for a full-suite run that had been killed at suite 9 of 131 — the exit code was the
shell wrapper's, not the suite's. Reading the log rather than the notification is what
caught it. Two full runs were also thrown away and restarted because the tree was edited
after they began; a run is only evidence for the tree it started on.

**Ranks 1 and 2 — the last two storage eras, and gvb-save's silent writes. #193, `CACHE_VERSION` v152.**
Two ½ rows in one PR, both follow-ups Path 4 P1 left behind, and between them they close the
storage era: `_shared/store.js` has reached **all three key-naming eras** it was written for
and has 36 adopters.

**063 and `scv-store.js` adopted the primitive, from opposite directions.** 063's custom story
was `{v: 1, text: "..."}` — the hand-rolled version stamp that nothing dispatches on, and the
payload the row named. It is **not** a Store envelope: rule 1 wants a numeric `v` *and* an own
`data` property, and this shape has only the first, so it reads as legacy version 0 and a
`migrate` turns it into the bare string the envelope now carries. `envelope.test.mjs` had
already recorded that spelling as "the one case a reader will expect to go the other way";
there is now a browser assertion for it too. `scv-store.js` went the other way and writes with
`raw: true`, because 010 Command Center reads `scv_calendar_v1` with a plain `JSON.parse` —
the bytes on disk are what they were. Its own `isValid`/`migrate` still run in the tool on
**every** load rather than only on a load Store judged to be behind, which is what Store's
version machinery would have skipped for a current-version blob.

**`assets/js/gvb-save.js` moved to `_shared/gvb-save.js`** — it was a second shared-code
location, contra `CLAUDE.md`; `assets/` now holds only icons and screenshots. That also closed
a duplicate row further down the ranked table saying the same thing, which is why #193 removed
three rows for two shipped.

**Its `save()` stopped swallowing failed writes.** It was a bare `return false` inside a bare
catch, and neither consumer read the return value on every path. Two routes now, because
gvb-save owns a `storage` object its callers inject and so cannot simply become a Store
caller: when the slot's storage **is** the page's own localStorage (005), the write is handed
to `Store.set(…, {raw: true})` — identical bytes, plus the quota banner and the same-tab
change event; when it is an injected storage (007's boxing wrapper, a suite's Map), the write
stays in gvb-save and the failure is reported through a new `Store.reportWriteFailure(err)`,
the same never-silent surface `set()` uses. Keeping the injection is what keeps 007's four
array-valued keys their exact shape on disk, which is why the two modules did not merge.

**What we got wrong, found, or did not verify.**

- **The row said gvb-save's consumers were 005, 007 and 064. 064 is not one.** Its
  `htcm-store.js` says "discipline modeled on gvb-save.js" and imports nothing from it. The
  real two are 005 (directly, plus `seating.mjs`) and 007 (through `np-store.js`). The Tier 2
  bullet in `BACKLOG.md` carried the same error and is corrected.
- **`__gvb_save_probe__` was the one write on this site `check:registry` had never heard of.**
  `defaultStorage()` wrote it as `ls.setItem(probe, '1')` on a local alias, and the guard's
  call-site scan matches `localStorage.setItem` — so the key was invisible in both directions:
  never demanded, and free to vanish without a word. The probe is spelled out in full now and
  declared on the registry's `shared` row. **The general lesson is that the guard's floor is
  lower than it reads: a storage write through any alias is invisible to it, and nobody has
  swept for others.**
- **`np-store.js` carried a note asking for a fix that had already happened** — that gvb-save's
  `load()` calls `store.getItem(key)` bare. `readRaw()` wraps it in a try/catch; all three
  storage touches in that module are guarded. Corrected rather than left to send the next
  session after a bug that is not there.
- **`_shared/seating-read.js`'s reason for not using `Store.onChange` changed** and is restated
  in the file. It used to be that 005 wrote through gvb-save rather than Store, so the same-tab
  half could never fire; that write goes through Store now, so it *would* fire — for 005 and
  nothing else. The `storage` listener stays, because the key is read raw by four tools.
- **`Tools/Old Designs/` and `Tools/New Designs/` import `../assets/js/gvb-save.js`, and that
  was already dead before the move**: from those folders it resolves to `Tools/assets/js/`, a
  directory that has never existed. Verified before writing it down. Do not read it as
  breakage from this round.
- **The new suite was negative-probed.** `Tools/grammar-mad-libs/test/smoke-storage.mjs` (17
  assertions) was run once with `migrateStory` deliberately broken, and section 1 went red —
  which is the only evidence that a sweep-driven round has not gone green by breaking the page.
  Worth doing every time; it cost two minutes.
- **Not verified: no real full disk, and no real install.** The banner assertions fill
  localStorage for real in headless Chromium and read the rendered element back, which is the
  strongest thing available here, but the four browser spellings of a quota error are still
  only covered by `isQuotaError`'s unit test. `CACHE_VERSION` v152 covers a rename in both
  precache tiers that `check:precache --base origin/main` agrees with; nothing installed the
  worker.
- **One silent-ish path is left, on purpose.** With no store.js on the page, a failed gvb-save
  write falls back to `console.error`. Both consumers link store.js, and the module says so;
  nothing guards it.

**Path 4 P1 — `_shared/store.js`, the storage primitive. #173, `CACHE_VERSION` v142.**
The site had ~234 distinct localStorage key literals across 86 tools, each hand-rolling
the same three guards and getting them subtly different. `store.js` is `window.Store`:
a `{v, data}` envelope, a `migrate(fromV, data)` hook, `onChange` that fires in the tab
that wrote (the `storage` event never does, which is why all six hand-rolled listeners
missed their own writes), `estimate()`, and a write that can never fail silently.
*The migration contract is the deliverable*, and it is in the file header rather than
inferred from the code: an object with a numeric `v` **and** an own `data` property is an
envelope; anything else on disk is legacy at version 0, except a payload with a numeric
`__v`, which is an `assets/js/gvb-save.js` save read at its own version so the two modules
can share a key; a refusal returns the caller's default and **leaves the payload on disk**
rather than destroying data it cannot read; and no key is ever renamed, so there is no flag
day. Quota is detected with all four spellings browsers use — `035` had two *non-identical*
predicates in two places, neither checking both. `configure({onQuota})` re-renders the
message in a tool's own style and a handler that throws still falls back to the banner:
there is deliberately no way to suppress it. One adopter, 019, whose silent-catch
`loadStore`/`saveStore` is the same idiom in 017 and 001. Its student-facing `lock.html`
was left alone on purpose — "open Backup & Restore" is teacher advice, and that page runs
on a student's device.

**Path 4 P2 — `_shared/tool-registry.js` + `check-registry.mjs`. #174, `CACHE_VERSION` v143.**
87 rows covering 217 keys and 32 prefixes across 107 files, replacing 009's `KNOWN_GROUPS`
(76 rows) and `STUDENT_KEYS`/`STUDENT_PREFIXES`. **Thirty-eight tools had no label at all**
and were appearing in teachers' backups as unnamed "Other saved data" — which also meant
they were classified as settings and survived the end-of-year clear. 009 and 010 read it;
010's five hardcoded tool filenames became `ToolRegistry.href()`, one of which had an
unencoded space the other four had escaped. 009's IndexedDB scan now enumerates
registry-declared databases instead of `indexedDB.databases()`, which **Firefox has never
implemented** and where the page used to give up entirely and leave a teacher's whole
IndexedDB out of every backup; `rgb-audio` and `stviz-recovery` are labelled for the first
time. The guard and the extractor are one script on purpose, given this repo's history of
documenting commands that were never committed.

**Wave A1 — Path 5 P1, the theme architecture decision. #167, `CACHE_VERSION` v139.**
`a11y.js` is now the only thing on the site that reads or writes theme state or sets
`data-theme` on `<html>`. Dark arrives one of two ways and never both: **native**, for a
page that sets `window.A11Y_NATIVE_THEME = true` and ships real colours, or the
**filter**, `a11y.css`'s invert, for a page that has not. `ink-paper.css` gained a
`:root[data-theme="dark"]:not(.a11y-filter-dark)` block — *the gate is the point*, because
without it, shipping a dark palette would have re-coloured all 74 ink-paper tools **and**
left the filter inverting them on the same load. With it, the phase changed nothing for
the 73 tools that had not adopted, which is what made it safe to ship the palette and the
rollout separately. Two tokens were added and deliberately only two: `--card-2` and
`--accent-ink` (white in light, near-black in dark, because `#fff` cannot survive the
accent inverting). Theme now has three stored states, `'auto'` being the default that
follows the OS live and writes nothing; existing users do not move, because pre-Path-5
prefs always named a literal theme. One bug was fixed on the way through in *both*
mechanisms: a teacher who left dark mode on and hit Print got a dark page — print is now
on paper regardless of the screen. `001-hall-pass-log.html` was the single adopter, and
its QR canvas was an unplanned win: under the filter it had been inverted and
counter-inverted, and now renders true. `Tools/theme/test/smoke-theme.mjs`
(`npm run test:theme`, 47 assertions) guards the whole mechanism and was mutation-tested
both ways. **Not verified:** nothing was seen on a real projector or a Chromebook, and no
screenshot pass was run.

**Wave A2 — the accessibility label round. #168, `CACHE_VERSION` v140.** The 41
`select-name` and 23 `label` allowances in `Tools/a11y-sweep/allowlist.json` were fixed —
an accessible name each, then the line deleted — taking the allowlist from 91 page-rule
pairs on 59 pages to **22 on 22**, all but one of them `color-contrast`. The round's own
finding was that "one `aria-label` each" was wrong in kind, not just in size: a constant
`aria-label` on a repeated row passes axe and helps nobody, so names had to be derived
from row content. It shipped no new scripts, deliberately.

**#169 — two figures corrected.** The "17–45 hardcoded literals per tool" citation for
Path 5 P3 was removed rather than replaced: it swept in `white-space`, `@media print`
blocks and inline script, and was about 3× too high. The correction was made by deleting
the false precision, not by substituting a number nobody had measured.

---

## Stage 1 — infrastructure (2026-09-02 → 2026-09-03)

Both platform paths are complete. Stage 1 is what makes the shared-module work of Stage 2
safe to attempt at all.

**Path 1 — service worker. #161, #162, #164, #165.** An update bar replaced the
unconditional `skipWaiting()`, so a deploy no longer swaps assets under an open tab
(P1). `check-precache.mjs` fails when a live page's `src`/`href`, or a local file
`manifest.json` names, is missing from `PRECACHE_URLS`, or when a listed URL is dead or
duplicated (P2) — the survey had estimated the precache gap at 2; **measured, it was
12**, and two of the twelve were the maskable icons, whose reference lives in JSON rather
than an HTML attribute, so the guard had to learn to read `manifest.json`. The precache
split into two tiers (P3): `SHELL_URLS` at install, the rest fetched by a deferred pass a
few seconds after load, with `index.html` showing "Offline: N of 86 tools ready" — a first
visit installs ~3.6 MB rather than ~10.8 (v151 took that to ~2.6 MB — see the ranks 1 and 2 entry above). `manifest.json` gained shortcuts, screenshots
and a share target that `sw.js` answers itself with a 303 into Class Roster Hub (P4).
**Never verified on the live site:** the two-deploy update test and an OS share into the
installed app. Both are still open in `BACKLOG.md`.

**Path 2 — CI, the test runner, and the sweeps. #159, #160, #163, #165.** `npm test`
became `run-suites.mjs` reading an ordered list from `suites.json`, running every suite
even after one fails (P2) — the old `&&`-joined string stopped at the first failure,
which meant one assertion red since 2026-08-11 had been hiding the last 25 suites from
every run. GitHub Actions runs 9 guards, lint and every suite on each pull request (P1).
Suite-reliability tooling followed after CI's first day (P6), including the fix for an
`ECONNRESET` that was the harness's own keep-alive socket race, not a flake. The axe-core
sweep with a dated allowlist (P3), three read-only sweep guards — `check:entities`,
`check:hidden-flex`, `check:print-clip` (P4) — and ESLint (P5) landed together in #165.
Each sweep guard is a floor: it reports only what it can see statically, and everything it
prints is real.

**Path 14 P1 — the Seating Chart phone toolbar. #164, v136.** The site's one known-red
assertion, failing since 2026-08-11 because the toolbar's ~25 controls wrapped to 460px at
375px wide and pushed the chart 1132px down the page. Below 900px the toolbar is now one
sideways-scrolling row of the controls a teacher uses standing in the room, with a **More**
button that unfolds the desk-building and printing groups. Folded, the chart sits 740px
down an 812px screen. **The fix was in the tool; the assertion was not touched**, and
`suites.json`'s `expectedFailures` has been empty since.

**Also in #164:** the six Barlow faces used by five `_ds` tools were vendored to
`_shared/vendor/barlow/`, closing the last offsite font request, and the harness stopped
stripping a Google Fonts import out of served CSS — an offsite font request is now a
finding like any other.

---

## The `_shared/` deduplication (2026-08-10 → 2026-08-11)

The refactor plan's six phases, all closed.

**Phase 1 and 1b — vendored libraries.** jsPDF (+AutoTable), SheetJS, jsQR, qrcode.js and
jszip.min.js each became one canonical copy under `_shared/vendor/`, with a README
recording version, source URL, SHA-256 and consumers. No per-tool duplicate of any of the
six remains. The lesson that keeps costing time: **when comparing two copies of a library,
hash them with line endings normalized** (`tr -d '\r'`) — raw file sizes differ by CRLF
alone and will fool you.

**Round 1c — the test suites.** The suites were made runnable at all, and
`Tools/board-check/harness.mjs` (static server, Playwright launch, offsite-request
blocking) was written from scratch, because the original board-check folder **had never
been committed to this repo** — verified with `git log --all`. A root `package.json` for
dev-only test dependencies was a deliberate tradeoff: a committed lockfile and `npm ci`
against a documented global install that pins nothing. `dependencies` stays empty forever.

**Phase 2 — service-worker registration** extracted to `_shared/sw-register.js` across
~83 files.

**Phase 3 — theme adoption.** The variance audit's headline finding was that a literal
diff against `_shared/theme.css` is the wrong comparison, and the audit proved it. 38/38
of bucket (a) and 29/29 of bucket (b) migrated. The phase's original text claimed theme
toggling came from `_shared/theme-toggle.js`, "already used by 16 tools" — **both claims
were false**; the file was loaded by zero live pages and was deleted outright in Path 5 P1.
The rest of Phase 3 was superseded by Path 5.

**Phase 4 — common layout CSS.** `_shared/base.css` took the byte-identical `.card`,
`.app-header` and `.toolbar` rules; `npm run phase4:next` reports 0 remaining candidates,
with 68 tools linking it and 11 correctly never migrated because they have only per-tool
variants. Two things must survive from this phase. First, **`base.css` is safe for any
tool; `print-area.css` is not** — it blanks the page on print and restores only
`#printArea`. Second, **the cascade trap**: the migrated tools all had *two* `#printArea`
rules, `display: none` mid-stylesheet and the `@media print` block last, both at
specificity (1,0,0), so the print block only won by coming last. Moving just the print
block into a stylesheet that loads first would have made every one of those tools print a
blank page while looking fine on screen. Both rules moved together, in order, and the
negative control (reintroducing the inline `display: none`) was checked to confirm the
guard had teeth.

**Phase 5 — JS utility extraction: closed with nothing extracted.** A deliberate outcome,
not an abandonment.

**Phase 6 — the guard.** `npm run check:dedupe` fails if any of the six vendored library
filenames exists as a file, or is referenced by a live page, anywhere outside
`_shared/vendor/`.

---

## The improvement-prompts programme (2026-08-10 → 2026-08-14)

Eighty-one per-tool wishlists, worked in rounds by parallel sessions claiming tools in a
shared tracker. Pass 1 covered 46/46 tools across Rounds 1–10 (PRs #51–#65). Pass 2 reset
the list and ran a much larger set of concurrent sessions across roughly PRs #71–#89,
including several Devon-assigned batches, two ranked-backlog batches worked straight down
`IDEAS_BACKLOG.md`, and two social-studies demo rounds against tools 015, 028, 046, 050,
054, 056, 062 and 064. **441 of the ~1,320 recorded per-tool ideas were shipped** over
that fortnight; 880 remain open and are carried in full in `BACKLOG.md`.

Things worth not relearning:

- **Two sessions can claim in the same minute and never see each other.** On 2026-08-11
  two sessions were started in the same message, both read an empty claim table at 01:29
  UTC, and five tools were built twice. It surfaced at merge time as real conflicts in tool
  source, not just in the tracker, and one automatic 3-way merge silently duplicated UI
  elements and event handlers — it would have shipped a visibly broken double-button row if
  merged without someone reading the output. The mitigations are in `BACKLOG.md`'s claiming
  section.
- **A bug found six times by luck is a sweep waiting to happen.** An HTML entity written
  as text inside a JS string, then passed through `escapeHtml()`, shows the literal
  `&mdash;` on screen and in print. It was found by accident in 050, 069, 072, 073, 076 and
  079 before anyone swept for it; `check:entities` now does.
- **A fixed `height` plus `overflow: hidden` in a print block silently clips content**,
  which is worse than an overflow that looks bad, because the teacher has no way to know.
  Found in 047, 070 and 076; three slightly different fixes were shipped independently, and
  `check:print-clip` now finds the pattern.
- **`hidden` loses to `display: flex`.** A Blank Map Generator toolbar control had been
  visible whenever it shouldn't be. `check:hidden-flex` now finds this.
- **`BroadcastChannel` is same-device only** — proved empirically by 021's remote-control
  feature. Cross-device control needs WebRTC pairing.
- **A generator and the thing it generates drift.** 035's Publish button produced a
  034 with undefined helpers, and separately one missing three feature generations' worth of
  code. If a tool on this site builds a second artifact from a first, check they have not
  diverged before trusting the generator.
- **The multi-save convention is `list` / `data:<name>` / `current`** — named first in
  Formula Sheet Builder's `fsb-store.js`, copied by Plot Diagram Builder with a one-time
  migration from the old single-document key. Any tool moving from one document per browser
  to several should copy that shape rather than invent a new one.

---

## What we got wrong, collected

The most valuable paragraphs in the retired documents. Every one of these cost a session.

- **Three tools have been documented that were never committed.**
  `Tools/board-check/sync-social-tags.mjs` (which the social/OG meta blocks still claim
  generates them — they are hand-maintained, and have drifted into two branding
  generations plus one hybrid, with 41 tools carrying no block at all); the original
  `board-check` folder; and `list-dark-candidates.mjs` / `npm run path5:next`, which a
  handoff said shipped in #167 **and quoted the output of as fact**. A document that names
  a command is making a claim — run it once before you write it down. A guard that walks
  the tracked `.md` files for `` `npm run <x>` `` and fails on anything `package.json` does
  not define is thirty lines and would have caught all three; it is rank 12 in `BACKLOG.md`.
- **A handoff chain four documents deep, with one link that lived only as a file passed
  between sessions.** That is how a Wave A1 handoff came to describe a tool that does not
  exist and to claim a correction it had not made, with nothing in the tree able to
  contradict either. Hence one current file, in the repo.
- **A sweep-driven round can go green by breaking the page.** If a JS row template throws,
  the controls never render, axe reports the page clean, and every allowance comes out on a
  green suite. A guard's *silence* is not a pass; read the result back out of a browser.
- **Measure with a script, and commit the script.** A frozen wrong number in three files
  is worse than no number.
- **A flaky suite is a measurement problem before it is a fix.** Sort it by kind first: a
  property assertion over randomised behaviour fails at a real rate and needs its *budget*
  raised, never its assertion loosened; a crash or a timing race is a bug to root-cause,
  and a re-run is not a diagnosis; a fixture built around the real clock fails only in a
  window nobody tests in — both command-center suites failed after 23:20 local, and
  `--repeat` cannot find that one. And when the failing property is one a *teacher* would
  notice — "new code word" handing back the same word 1 time in 28 — the fix is in the
  tool.
- **A guard can be green because it cannot see the thing it is guarding.**
  `check-registry.mjs`'s first draft resolved localStorage call sites and looked
  complete: 203 keys, no unresolved sites. It was wrong four ways, and every one was
  found by *disagreeing with 009's old list*, never by reading the code. A tool that
  wraps localStorage in its own `readJson`/`writeJson` hides every key behind a
  parameter (006, and its three `crh_*` keys are all student data). `gvb-save.js`'s
  `createSaveSlot({key})` hid all fourteen Name Picker keys and made `np_rosters` look
  as though only 006 wrote it. A folder attributed to the first page that mentions it
  gave `name-picker/` to 006, which links there once, instead of to 007, which *is* the
  Name Picker. And `Store.get/set/remove` had to be followed, or every tool adopting
  `store.js` would have dropped out of the guard silently as adoption spread — the exact
  failure the guard exists to prevent, arriving through the front door. **Cross-check a
  new measurement against the stale thing it replaces; the disagreements are the
  findings.**
- **The same rule then invented a key that does not exist.** Reading `key:` alone made
  `np_bundle` a fifteenth Name Picker localStorage key; it is an export-only slot on a
  memory stub — "given a memory stub so it can never become a real key". A claim about
  it had already been written into 009's comment and the guard's header before the
  source was read. Both were corrected. An extractor over-reporting is as wrong as one
  under-reporting, and much easier to believe.
- **A browser test can pass while the feature is broken.** The first
  `smoke-quota-banner.mjs` filled localStorage with 512 KB chunks until one threw, then
  asserted the banner. It passed — because the first big write to fail still leaves room
  for a small one, and because overwriting an existing key with something no larger fits
  on a full disk. It now steps the chunk size down to one character and adds a station
  through the tool's own button, so the payload has to *grow*.
- **Two tools already have a private object called `Store`** (028 and 039, each with its
  own save/load/remove over a data prefix). They must rename before they can adopt
  `_shared/store.js`. Worth knowing before Path 4 P4 reaches them.
- **009's `gvb-command-center:excluded:` student-data rule could never have fired.**
  010 keeps that in `sessionStorage`, which dies with the tab and no backup has ever
  contained. It is the single classification difference between the old lists and the
  registry, and the registry suite asserts it stays the only one.
- **"Backups complete by construction" was the wrong claim.** BACKLOG said Path 4 P2
  would make backups complete; 009's own comment says it "backs up every localStorage key
  regardless". What was incomplete was the labelling, the student/settings split, and
  IndexedDB. Corrected rather than repeated.
- **Claims in these documents rot quietly.** `IDEAS_BACKLOG.md` insisted `index.html`
  carried "coming soon" rows that must be kept in sync; the convention had been retired and
  there were none. The platform themes were written when the site had 46 tools and still
  said so at 86. Verify a claim before you carry it forward.

---

## What was retired on 2026-09-03, and where it went

**#171, `CACHE_VERSION` v141.** One documentation consolidation replaced ~130 files and
34,614 lines with `BACKLOG.md` (open work, in full) and this file. Everything below is in
git history at `94dc004` and earlier.

The version bump was not cosmetic: pointing `ideas-backlog.html`, `index.html` and four
tool-page comments at the surviving files changed six precached pages, and
`check:precache -- --base origin/main` fails without it. Of the ~1,320 recorded per-tool
ideas, 904 came across and 417 were dropped as already shipped — 24 of those 417 turned
out to describe residual open work inside a bullet whose lead said "Done", and were kept
in place instead. **What was not done:** those 417 were classified by their own status
marker, cross-checked against the code only where the claim was structural (the missing
`list-dark-candidates.mjs`, the deleted `theme-toggle.js`, `phase4:next` reporting zero,
the absent `assets/fonts/`, the retired `.row.soon` rows). If one of them turns out to be
open after all, it is in git history, and this is the paragraph that says where to look.

**One item was already lost and recovered this way, within the hour.** The survey's
Baseline table carried a "Dead / unlinked" row — `index_backup.html`, `Tools/Old Designs/`,
`Tools/New Designs/`, `Other Landing Page ideas/`, ~590 KB unreferenced by anything. The
consolidation extracted the survey's *path sections* and hand-copied its *defect bullets*,
and missed that one row of the table sitting between them. Devon spotted the files in a
directory listing and asked why they still existed; it is now rank 104. The lesson is not
"be more careful" — it is that a table row above a bulleted list is exactly the shape an
extraction pass skips, and that the recovery worked because the originals are still in git.

| Retired | What it was | Where it went |
|---|---|---|
| `improvement prompts/` (84 files, 1.8 M) | 81 per-tool wishlists plus the platform themes, the site-wide request list and the round tracker | Open ideas → `BACKLOG.md` Tier 2 per-tool sections; themes → its Platform themes section; site requests and the tracker's open threads → its cross-cutting section; the round tracker's own history → above |
| `UPGRADE_PATHS.md` (104 K) | The top-20 ranked upgrade paths with phase lists | Open phases → `BACKLOG.md` Platform paths; Paths 1, 2 and 14 P1 → above |
| `REFACTOR_PLAN.md` (100 K) | The `_shared/` dedupe phases | Complete; summarised above, with the one open leftover in `BACKLOG.md` |
| `PLATFORM_PLAN.md` (28 K) | The four platform-wide big swings, Tracks R/B/P/V | `BACKLOG.md` Platform Plan tracks — all four, since Path 3 P1 and Path 10 P1 cite R1 and P1/P2 by name |
| `IDEAS_BACKLOG.md` (20 K) | The ranked per-tool enhancement table and the unbuilt-tool lists | The 39 ranked rows are `BACKLOG.md` ranks 110–148, in their existing order; the unbuilt-tool sections were all empty — every row had shipped |
| `REFACTOR_ROUNDS.md` (12 K) | Per-session prompts for the refactor plan | Superseded; the plan it drove is complete |
| `HANDOFF_NEXT.md`, `HANDOFF_STAGE_2.md`, `_A1.md`, `_A2.md`, `HANDOFF_2026-09-03.md` (72 K) | Five overlapping state handoffs | State → `BACKLOG.md`'s header; findings → above |
| `prompts/` (33 files, 192 K) | Paste-ready session prompts | Every tool they described has shipped, and several cited conventions that are now wrong (`_shared/theme-toggle.js`, `libs/`). The one reusable process prompt is replaced by `BACKLOG.md`'s "How to work this list" |
