# Upgrade Paths: the top 20 major upgrades, with a phase list for each

Written 2026-09-02 from a fresh survey of the repo: all 86 tool pages, every
`improvement prompts/<tool>.md`, `_site-requests.md`, `_tools-touched.md`'s open
threads, `PLATFORM_PLAN.md`, `REFACTOR_PLAN.md`, `sw.js`, `_shared/`, and the test
tooling under `Tools/board-check/`. Where a claim below is a measured fact it was
checked against the tree on that date; where it is a judgment call it says so.

This file is a **wishlist and phase list**, not a claim. Nothing here is started.
When a path gets picked up, work it the way `PLATFORM_PLAN.md` and
`REFACTOR_ROUNDS.md` already prescribe: one small PR per phase, claim the tools you
touch in `improvement prompts/_tools-touched.md`, bump `CACHE_VERSION` in the same
commit as any file change, run `npm run check:dedupe` before every commit, and record
what was actually verified. Companion docs stay authoritative for what they cover:
`PLATFORM_PLAN.md` (the four original big swings; Paths 3, 5, 6 and 10 below extend
it rather than replace it) and `IDEAS_BACKLOG.md` (the ranked per-tool enhancement
list).

## Baseline (2026-09-02)

| Fact | Value |
|---|---|
| Tool pages under `Tools/` | 86 (`001`–`086`); next free number is **087** |
| `sw.js` | `CACHE_VERSION = 'v131'`, 222 precache entries, ~10.1 MB resolved payload, cache-first, unconditional `skipWaiting()` + `clients.claim()`, no update notification |
| Shared-file adoption (of 86) | `a11y.js` 77 · `ink-paper.css` 71 · `base.css` 68 · `print-area.css` 20 · `state-link.js` 17 · `qr-scan.js` 10 · `webrtc-pair.js` 7 · `theme.css` 5 · `theme-toggle.js` **0** · `duplex-print.js` 1 · `student-details.js` 1 |
| Vendored libs (`_shared/vendor/`) | jsPDF 2.5.2 (+AutoTable 3.6.0), SheetJS 0.18.5, JSZip 3.10.1, qrcode.js, jsQR |
| Rosters | `np_rosters` read by 28 tools (plain name strings); `crh_students_v1` (stable ids, preferred name, pronunciation) written by 006, read by 008, 009 and Name Picker's `np-details.js` only. `_shared/roster.js` from `PLATFORM_PLAN.md` Track R **does not exist yet** |
| Tests | 120 Playwright/Node suites chained with `&&` in one `npm test` string; 62 per-tool `test/` folders; guards `check:dedupe`, `check:social`, `check:tests`. **No CI** (`.github/` does not exist), no linter, no automated a11y check |
| Known red | one assertion in `Tools/seating-chart/test/drive-seating.mjs` (mobile toolbar pushes the chart ~1050 px down at 375 px) |
| Storage | ~206 distinct localStorage keys across 69 writing tools, three naming eras; IndexedDB in 3 places (`bmg-maps`, `rgb-audio`, `stviz-recovery`); quota handled in ~17 files |
| Dead / unlinked | `Tools/Old Designs/`, `Tools/New Designs/`, `index_backup.html`, `Other Landing Page ideas/`. **Correction (2026-09-02): the `v1`–`v4` landing variants are not dead.** They are a reachable chain — `index.html`'s footer links `v1-inbox.html`, which links `v2-subplans.html`, which links `v3-bellboard.html`, which links `v4-riso.html`. None of the four is precached, so all four 404 offline while being reachable. Whether to precache them or cut the chain is a decision for Path 1 P2. |

Concrete defects found during the survey (small, fix opportunistically, listed once
here so they stop being rediscovered):

- `Tools/seating-chart/scg-photo.js` is loaded by `005-Seating Chart Generator.html`
  but is **not in `PRECACHE_URLS`** — bulk photo import breaks offline.
- `v1-inbox.html` is linked from `index.html`'s footer ("Prefer a different look?")
  but is **not precached** — it 404s offline while being advertised.
- **Measured 2026-09-02, during Path 2 P1: the precache gap is 12, not 2.** Beyond
  the two above, four more tool scripts are referenced by a live page and missing
  from `PRECACHE_URLS` — `certificate-award-maker/cam-logo.js` (042),
  `number-talks-board/dot-images.js` (024),
  `vocab-flashcard-generator/vfg-conjdrill-link.js` (040) and
  `writing-prompt-generator/wpg-rubric-link.js` (025) — plus `ideas-backlog.html`
  and the whole `v1`–`v4` landing chain, and both maskable icons, which
  `manifest.json` names and nothing precaches, so the install dialog's icon fails
  offline. The maskable pair
  is a *different class* of miss: the reference lives in JSON, not an HTML
  `src`/`href`, so Path 1 P2's `check-precache.mjs` has to read `manifest.json`
  too or it will not see them. The reverse direction is clean — no listed entry is
  dead or duplicated, which fits: a missing entry is invisible until a teacher is
  offline, while a dead one would surface as a console warning.
- `_ds/industry-…/styles.css` opens with an `@import` of Google Fonts. Five live
  tools (005, 011, 029, 031, 036) make an offsite request on every load and lose their
  typeface offline. `Tools/schedule/fonts/fonts.css` is the self-hosting template.
- `assets/js/gvb-save.js` (save bar + storage probe, used by 005 and 007) is shared
  code living outside `_shared/`, contra `CLAUDE.md`.
- `Tools/seating-chart/fonts/*.woff2` (~167 KB, three faces) appear unreferenced by
  any page and are not precached.
- `Tools/009-backup-restore.html`'s `IDB_NOTES` knows only `bmg-maps`; `rgb-audio`
  (Review Game Board clue audio) and `stviz-recovery` (Schedule Visualizer crash
  recovery) are unlabeled in backups, and `indexedDB.databases()` is unavailable in
  Firefox, so Firefox backups silently omit all IndexedDB content.
- `Tools/schedule/README.md` still documents `Tools/schedule/libs/jspdf/`, deleted in
  Refactor Phase 1.
- The "HTML entity written inside a JS string, then passed through `escapeHtml()`"
  bug has been found six times by luck (050, 069, 072, 073, 076, 079) and never swept.

## Choosing a model per path

Most of this is well-specified implementation work that **Opus 5** handles well:
batch migrations, adopting a shared module across N tools, building a UI to a
written spec, writing smoke tests, bookkeeping. Each path below carries a **Model**
line. A phase is marked **Fable** only where the work is one of:

- a **schema or contract decision with many downstream consumers** where a wrong
  call is expensive to unwind (student identity, storage migration, the service
  worker update flow);
- a **refactor of a very large file with hidden coupling** (the 20k-line Schedule
  Visualizer, whose publisher serializes live functions by name);
- **non-trivial algorithms** where correctness is hard to eyeball (constraint
  solving for seating, perspective correction for scanning, booklet imposition,
  antimeridian-safe geometry, pacing that recomputes around lost days);
- **merging two tools' data models** into one without losing either's behavior.

Everything not marked Fable is Opus by default. Within a Fable-marked path, the
design phase is usually the Fable part; the adoption/rollout phases that follow are
Opus work. Sonnet remains the right choice for purely mechanical batch rounds
(`REFACTOR_ROUNDS.md` already says so).

---

## The list, ranked

Ranked by leverage: how many tools and how many teacher-hours a path touches, and
how much it unblocks. Platform paths come first because most tool paths below
depend on one of them.

| # | Path | Kind | Touches | Default model |
|---|---|---|---|---|
| 1 | Service worker: update UX, precache split, precache guard | platform | all 86 | Fable (P1), Opus |
| 2 | CI, a real test runner, automated a11y and sweeps | platform | repo | Opus |
| 3 | Roster service and stable student identity | platform | 28+ tools | Fable (P1–P2), Opus |
| 4 | Storage primitive, tool registry, media store | platform | 69 tools, 009, 010 | Fable (P1), Opus |
| 5 | Projector mode, real dark mode, shared fullscreen stage | platform | all 86 | Opus |
| 6 | "Share…" everywhere | platform | 17 → ~60 tools | Opus |
| 7 | Print and export kit | platform | 78 printing tools | Fable (P4), Opus |
| 8 | Phone-as-remote and pairing rollout | platform | 7 → ~15 tools | Opus |
| 9 | The school-year spine: calendar, bell schedules, grading periods | cross-tool | 032 → 004, 010, 001, 036, 037, 044, 045 | Fable (P2), Opus |
| 10 | Packet Builder and the sub-day product | cross-tool | 044, 045, 076, new 087 | Opus |
| 11 | Schedule Visualizer: modularize, guard the publisher, route accessibly | tool | 035, 034 | Fable |
| 12 | Question bank hub: one bank, played six ways | cross-tool | 030 → 018, 019, 020, 040, 053, 062 | Opus |
| 13 | Grouping, rotation and bracket engine | cross-tool | 002, 022, 027, 007, 020, 021, 004 | Fable (P1), Opus |
| 14 | Seating Chart: room model, constraint solver, phone toolbar | tool | 005 (+008, 010, 045) | Fable (P3), Opus |
| 15 | Name Picker: split, equity dashboard, themes as data | tool | 007 | Opus |
| 16 | The grades trio and a shared chart engine | cross-tool | 036, 037, 038, 003 | Opus |
| 17 | Image → PDF as a document scanner; a local PDF layer | tool | 011, 031 | Fable (P2, P4), Opus |
| 18 | Escape Room and Scavenger Hunt convergence | cross-tool | 018, 019 | Fable (P1), Opus |
| 19 | Vocabulary hub and conjugation engine | cross-tool | 040, 039, 014, 027, 051, 052 | Opus |
| 20 | Blank Map: live vectors, dropped GeoJSON, shared geometry | tool | 046, 015, 062 | Fable (P3), Opus |

Near misses, recorded so they are not lost: the math generator family (026 + 061 +
066 + 081 sharing one generator module, targeted practice from data, two-step word
problems); Wiki Race (a teacher scoreboard from finish codes, an offline corpus
mode, and a Node suite for its pure seed→matchup logic); Prompt Builder
output-shape presets that emit exactly the CSV/JSON another tool imports; Behavior
Points longitudinal reports and a projected class scoreboard; Hall Pass N-peer
hallway sync; Virtual Manipulatives export and data-driven piece families; a
data-driven `index.html` (86 hand-written rows and three hand-maintained counts).

---

## 1. Service worker: update UX, precache split, precache guard

**Status.** P1 and P2 shipped. P3–P4 open.

**Why.** `sw.js` reaches every teacher on every visit. Today it calls
`skipWaiting()` unconditionally at install and `clients.claim()` at activate, so a
deploy swaps page assets underneath an open tab mid-lesson, with no notice. Every
first visit downloads the entire ~10 MB precache before the worker settles. The
222-line `PRECACHE_URLS` list is hand-maintained and nothing checks it: two gaps
exist right now (`scg-photo.js`, `v1-inbox.html`). A `CACHE_VERSION` bump also
evicts the runtime and Wikimedia caches because all three share the version.

**Current state.** `_shared/sw-register.js` is five lines and reaches 85 tools —
the natural place for an update toast. `Tools/board-check/` already holds four
guard scripts of exactly the shape a precache check needs. Opportunistic runtime
caching of same-origin GETs already works, so an on-demand tier is nearly free.

**Phases.**

- **P1 — Update flow (Fable).** Stop the unconditional `skipWaiting`. Detect a
  `waiting` worker from `sw-register.js`, show one small "A new version is ready —
  reload" bar (styled from `_shared/a11y.css` tokens, dismissible, never modal),
  and only then post `SKIP_WAITING`. Handle `controllerchange` by reloading once,
  guarded against loops. Decide and document the mid-lesson posture: a tool page
  that is fullscreen or has an active timer suppresses the bar until the next load.
  Verify with the harness (`serviceWorkers: 'block'` is the harness default, so
  this needs one explicit allow-SW test) across a v→v+1 bump: old tab keeps working,
  bar appears, reload gets the new version. *Fable because a wrong call here
  breaks every page silently and the failure only shows up on a real second deploy.*

  **Shipped 2026-09-02 (Opus, with the contract decisions called out).**
  `sw.js` drops `skipWaiting()` at install and gains a `SKIP_WAITING` message
  listener; `clients.claim()` stays, because a worker that has been accepted (or
  is the first, with no page to disrupt) should control the page at once.
  `_shared/sw-register.js` goes from 5 lines to the registration + update
  detector. `prepPage` gains an opt-in `serviceWorkers` option, defaulting to
  `'block'` so all 120 existing suites are untouched.

  *Suppression rule, as decided:* the bar is withheld while
  `document.fullscreenElement` is set — the projector case, which covers ten
  tools without one of them changing a line — or while a page sets
  `window.TOOL_BUSY === true`. Suppression is not dismissal: the worker stays
  waiting and the offer returns next load. "Not now" is also per-load and
  persists nothing; a teacher who dismisses once should not stop being offered
  updates. Nothing sets `TOOL_BUSY` yet — it is the hook for the timer tools,
  and forgetting to clear it fails safe (the teacher keeps the version they had).

  *Two real bugs, both found by the new suite rather than by reading:*
  (1) `controllerchange` also fires on a **first** install, when the controller
  goes from null to the first worker — so the first draft reloaded the page on a
  teacher's first ever visit. (2) That spurious reload then consumed the
  rate-limit window, so the teacher's *actual* accepted update took over the
  worker but never reloaded the page — leaving it on old assets under a new
  controller, the precise failure the reload guard was written to prevent. The
  fix separates the three reasons a controller changes: a first claim (do not
  reload), an accepted update (reload, no rate limit — we asked for it), and an
  unsolicited change from another tab (reload, rate-limited). Conflating the
  middle with the last was the bug.

  *A third problem was in the test, not the code:* one check passed or failed
  depending on timing, and adding a diagnostic made it pass. The bar is drawn
  from the `load` handler after `register()` resolves, so a fixed 800 ms wait was
  usually but not always enough. Every assertion is now condition-based,
  including the negative ones — "no bar appears" waits until a worker is
  genuinely waiting, so the offer *could* have been made, before asserting
  absence. A suite that fails one run in five teaches people to re-run instead of
  to read, which would undermine the CI of the previous phase.

  *Verified:* `Tools/service-worker/test/smoke-sw-update.mjs`, 18 assertions,
  three consecutive clean runs, then the full pass — **121 suites, 17.5 min, 120
  green, 1 expected-fail, exit 0**. It stages a scratch site whose `sw.js` bytes
  change between loads, so the version bump is real rather than simulated. Guards
  green. `CACHE_VERSION` v132 → v133 for the `sw-register.js` content change.
  The new suite lives at `Tools/service-worker/test/` — no tool page beside it —
  because `check-tests.mjs`'s orphan scan walks `Tools/<dir>/test/` and exempts
  only `board-check`; putting it under `board-check` would have made it the one
  suite nothing checks is still wired up. Confirmed: it was picked up with no
  guard change.

  *Not done here, deliberately:* the manual two-deploy test on the live site that
  this phase's Verification line asks for. It cannot be done from a session — it
  needs a real deploy, a real second deploy, and a person watching a tab in
  between. Worth doing on the next two merges to `main`.
- **P2 — `check-precache.mjs`.** Walks the tree, diffs against `PRECACHE_URLS`,
  fails on: any file referenced by a live page's `src`/`href` that isn't listed
  (this catches `scg-photo.js`); any listed URL that doesn't resolve; any listed
  entry whose content changed since the last tagged version without a
  `CACHE_VERSION` bump (compare against `git show main:sw.js`). Wire as
  `npm run check:precache`; add to Path 2's CI. Fix the two known gaps in the same
  PR (add `scg-photo.js`; either precache `v1-inbox.html` or drop the footer link).

  **Shipped 2026-09-02 (#162).** `Tools/board-check/check-precache.mjs`, wired as
  `npm run check:precache` and as a fourth `if: '!cancelled()'` guard step in
  `.github/workflows/ci.yml`, and all twelve gaps closed in `sw.js` at
  `CACHE_VERSION` v134 (222 → 234 entries).

  *The gap was 12, not the 2 this file recorded.* Beyond `scg-photo.js` and
  `v1-inbox.html`: four more per-tool scripts a live page loads
  (`certificate-award-maker/cam-logo.js` 042, `number-talks-board/dot-images.js`
  024, `vocab-flashcard-generator/vfg-conjdrill-link.js` 040,
  `writing-prompt-generator/wpg-rubric-link.js` 025), the rest of the landing
  chain (`ideas-backlog.html`, `v2-subplans.html`, `v3-bellboard.html`,
  `v4-riso.html`), and both maskable icons. Total added payload 173 KB — 140 KB
  of it the landing chain and the backlog page, ~1.4% of the ~10 MB precache.
  **Devon's decision:** precache all four `v1`–`v4` variants plus
  `ideas-backlog.html` rather than cut `index.html`'s "Prefer a different look?"
  footer link. Reversible either way; nothing else links them.

  *The maskable icons are the interesting miss.* They are named by
  `manifest.json`, not by an HTML `src`/`href`, so the obvious
  scan-the-pages guard would never have seen them — which is exactly how they
  went missing in the first place. MANIFEST is a separate check for that reason,
  reading `icons`, `screenshots` and `shortcuts[].icons`. Path 1 P4 adds
  `shortcuts`, and this guard will demand their icons be precached on the day
  they are added.

  *The reverse direction was already clean* — no DEAD entry, no DUPLICATE — which
  fits: a dead entry logs a warning at every install, so it gets noticed, while a
  missing one is invisible until a teacher is offline.

  *Deliberately not built, and raised rather than shipped:* the phase brief's
  fourth check, "a precached file's content changed without a `CACHE_VERSION`
  bump", by diffing against `git show main:sw.js`. It cannot be made honest in
  that shape — it fires when you *did* bump, two commits ago; it is wrong on a
  first push; and CI's clone would need full history for it. A guard that cries
  wolf gets ignored, which costs more than the check buys. If it is wanted, the
  honest shape is a separate opt-in check taking an explicit base ref. Left as a
  TODO in the guard's header. Until then this remains a code-review
  responsibility, as `CLAUDE.md` already states.

  *Verified:* all four checks fired by name against deliberately broken copies of
  the finished `sw.js` (a bogus entry → DEAD, a repeated entry → DUPLICATE, a
  removed `scg-photo.js` → MISSING, a removed maskable icon → MANIFEST), then
  green on the real tree at 234 entries. `check:dedupe`, `check:tests`,
  `check:social` green; `npm test` 121 suites, 19.6 min, 120 green, 1
  expected-fail (the known-red seating assertion, now measuring 1132px), exit 0.

  *CI then found a second thing, which is the phase paying for itself.* The run
  went red on `group-team-generator/test/smoke-pairing-history.mjs` — a suite this
  PR cannot reach — while passing 12/12 locally on the same commit. It is a real
  flake with a measurable rate, not noise: `splitValue` 4 in `count` mode means
  *four* groups, so that 8-name roster shuffles into 4 pairs and each generation
  covers only 4 of the 28 possible pairs. `assignCoverage` is greedy over a
  shuffled pool with randomised tie-breaks, so over 200,000 simulated trials of
  the real shape, 20 generations leaves a pair uncovered 0.276% of the time
  (~1 run in 362, always landing on exactly 27 of 28 — what CI reported), while
  30 and 40 generations were complete in 200,000 of 200,000. Fixed by giving the
  strategy 30 rounds instead of 20; the assertion itself is untouched, since
  relaxing it to 27 would delete the test. 30 over 40 because the neighbouring
  `spread <= 6` assertion has to keep holding, and the spread never exceeded 6 at
  either count. Two hypotheses were tested and discarded first — a weak algorithm
  (it converges once the group shape is read off the live page) and dropped clicks
  (cutting the settle from 220ms to 30ms still lands all 20 generations).

  **Was red on `main` (run #8), root-caused and fixed 2026-09-02:**
  `exit-ticket-generator/test/smoke-prompt-sets.mjs` failed with "exited 1
  without printing a FAIL line (crashed, or a setup step threw)" and passed 8/8
  locally. The run's own log had the answer a thousand lines above the summary:
  `route.fetch: read ECONNRESET` on `GET /_shared/ink-paper.css`, thrown inside
  the harness's CSS-rewriting route handler — an unhandled rejection, which
  Node exits on before the suite's reporter runs. Mechanism, measured rather
  than guessed: `harness.serve()` answered keep-alive, Playwright's
  `route.fetch()` pools its connections on a keep-alive agent that never closes
  them itself, and Node's http server destroys an idle keep-alive socket about
  6 s after its last response (`keepAliveTimeout` 5 s plus a second of grace —
  6006 ms observed). The suite's `page.reload()` landed on that instant: first
  stylesheet load 19:24:18.4, crash 19:24:24.41. Reproduced deterministically
  by issuing a request in the same event-loop iteration as the server's idle
  close (5 of 5 `ECONNRESET` against the old harness, 0 of 5 after the fix).
  Any suite that re-requests a stylesheet ≥6 s after its last one is exposed —
  most of the 75 that reload or navigate — but the window is one loop
  iteration, hence rare and unreproducible by rerunning. Fixed in the harness,
  not the suite: every response now carries `Connection: close`, so no pooled
  socket exists to lose the race on; the CSS fetch retries once on a fresh
  connection; and no route-handler failure can escape as an unhandled
  rejection — it is recorded on `page.__errs`, where the suite's own "no
  page/console errors" assertion turns it into a named FAIL. `run-suites.mjs`
  now repeats the last lines of a crashed suite's stderr under its name in the
  summary, so the next crash explains itself in the CI tail. Two different
  non-deterministic failures in three consecutive CI runs remains the finding
  for Path 2: now that P1 runs all 121 suites on every push, suite reliability
  is a live problem, and nobody has measured the rate for anything but the
  pairing-history suite.
- **P3 — Split the precache into tiers.** Shell tier (index, `_shared/*`, vendor,
  icons, manifest) plus the top ~10 tools by daily use, precached at install.
  Everything else stays in `PRECACHE_URLS` but is fetched by a *second*, deferred
  pass that runs after activation and never blocks install (a `precacheRest`
  message from `sw-register.js` once the page is idle). Offline still covers the
  whole site after the deferred pass completes; a "N of M tools cached for offline"
  readout on `index.html` makes the state visible. Give runtime and Wikimedia caches
  stable names so a version bump doesn't evict them.
- **P4 — Manifest polish.** `shortcuts` for Name Picker, Timer, Seating Chart,
  Command Center; `rel="manifest"` on tool pages (currently only `index.html`);
  `screenshots` for the install dialog; a `share_target` that lands a shared CSV in
  Class Roster Hub (pairs with Path 3).

**Verification.** Harness runs for P1/P3 that actually register the worker; `npm
run check:precache` green; a manual two-deploy test on the live site recorded in
this file.

**Risks / decisions for Devon.** P3 changes the "visit once, everything works
offline" promise to "visit once, wait a minute in the background" — acceptable, but
the readout must exist. Decide the mid-lesson suppression rule in P1.

---

## 2. CI, a real test runner, automated a11y and sweeps

**Status.** P2 shipped (#159), P1 shipped (#160) — in that order; see the P1 note
for why they swapped. P6 (suite reliability, added after CI's first day) shipped
2026-09-02. P3–P5 open.

**Why.** 120 suites and three guard scripts exist and are designed to be
sandbox-safe, and nothing runs them unless a session remembers. The `&&` chain
means the first failure hides every suite after it (`check-tests.mjs` exists
*because* a missing file silently killed the chain for days). The a11y widget is on
77 tools with no automated check behind it. Several bug classes recur across rounds
and have only ever been found by luck.

**Phases.**

- **P1 — GitHub Actions.** One workflow on PR and on `main`: `npm ci`, `npx
  playwright install --with-deps chromium`, then the guards (`check:dedupe`,
  `check:tests`, `check:social`, `check:precache` from Path 1) and `npm test`.
  Cache `node_modules` and the Playwright browser. Upload screenshots/traces on
  failure. Mark the one known-red seating assertion as expected-fail *by name* in
  the runner (never by loosening the assertion), so CI is green on day one and the
  bug stays visible.

  **Shipped 2026-09-02 (#160), after P2.** The order swapped for a measured
  reason: `drive-seating.mjs` — the known-red suite — is position **95 of 120** in
  the `&&` chain, so a workflow running that chain would have stopped there and
  never executed the last 25 suites. CI reporting less than a local run is worse
  than no CI. P1's own instruction to mark the assertion expected-fail "in the
  runner" presumes P2, so P2 went first and this landed on top of it.

  `.github/workflows/ci.yml`, on `pull_request` and `push: main`. Every guard step
  and the test step carry `if: always()`, so one failing guard does not hide the
  others — the same reasoning as the runner itself. The browser cache is keyed on
  the *resolved* Playwright version so a bump misses the cache rather than reusing
  a stale browser; a cache hit still runs `install-deps`, because the system
  libraries Chromium links against live outside `~/.cache` and change with the
  runner image. `check:precache` is not wired yet — it does not exist until Path 1
  P2, which adds it here.

  *Surprise:* `check:social` was already red, so CI would have been red on its
  first run. `019-escape-room-builder.html` had a partial `og:image` group missing
  only `og:image:alt`. Fixed by transcribing the alt text `index.html` already uses
  for the same `toolbook.png` — not the branding decision `CLAUDE.md` warns against
  guessing at. The generation-drift report (11 tools old branding, 29 new, 46 with
  no block) still prints as information and still waits on a real decision.

  *Verified:* full local run 120 suites / 19.4 min / 119 green / 1 expected-fail /
  exit 0; all three guards green; `ci.yml` parses, 12 steps; `timeout-minutes: 60`
  sized from that 19.4 minutes plus install. CACHE_VERSION v131 → v132 for the 019
  content change.

  *Left open:* whether CI should also run `offline:build` + `offline:verify` on
  `main`. Deferred deliberately — it belongs after Path 1 P3 changes precache
  tiering, which would invalidate any baseline established now.
- **P2 — `run-suites.mjs`.** Replace the one-line `&&` chain with a runner that
  reads the suite list from a JSON file, runs every suite, reports all failures at
  once, supports `--only <tool>` and a `--changed` mode that maps touched
  `Tools/<x>/` paths to their suites. Keep the `test:<name>` shortcuts. Update
  `check-tests.mjs` to validate the JSON instead of the string.

  **Shipped 2026-09-02 (#159), first.** `Tools/board-check/suites.json` +
  `run-suites.mjs`; `npm test` now points at the runner and all 66 `test:<name>`
  shortcuts are unchanged, plus a new `test:changed`. Suites stay serial and in the
  existing order — several bind fixed localhost ports (`drive-seating.mjs` takes
  8146), so concurrency would make them fight; that is a correctness property, not
  laziness. `check-tests.mjs` keeps MISSING/ORPHAN/UNSCRIPTED and gains a CONFIG
  check over the JSON (shape, duplicate paths, and `expectedFailures` entries that
  name an unlisted suite or omit their assertion text or reason).

  Known-red assertions live in `expectedFailures` by exact assertion text plus a
  reason. Three properties keep that from becoming a place to hide bugs, all three
  verified with fixtures rather than assumed: matching is on the *assertion*, so a
  second unrelated failure in the same suite still turns the run red; every
  expected failure prints on every run with its reason; and an expected failure
  that starts passing fails the run, so the entry cannot outlive the bug.

  *Surprises:* (1) The known-red seating bug has got **worse** — `CLAUDE.md`
  recorded 1052px on 2026-08-11, it measures **1132px** now; the toolbar is still
  growing. (2) `--changed` was silently broken by git quoting any path containing a
  space, which is half the tool pages here (`Tools/005-Seating Chart
  Generator.html`); fixed with `-z` on both `diff` and `status`. (3) The 25 suites
  the chain had been skipping are all green — the reassuring answer, but not one
  anybody had.

  *Verified:* full run 120 suites / 19.4 min / 119 green / 1 expected-fail / exit 0;
  `check:tests` and `check:dedupe` green; `--changed` maps a touched
  `005-Seating Chart Generator.html` to exactly the three suites that open that page
  and correctly leaves out the pure-logic one. No `PRECACHE_URLS`/`CACHE_VERSION`
  change: `Tools/board-check/` is dev tooling and is not precached.
- **P3 — axe-core in `prepPage`.** Inject a vendored axe build into the harness
  (dev-only, under `node_modules`, never precached) and add an `a11yScan(page)`
  helper. Add one site-wide smoke that opens all 86 tools and fails on serious
  violations, with a per-tool allowlist file so adoption can be incremental.
- **P4 — Sweeps as guards.** `check-entities.mjs`: HTML entity names inside JS
  string literals in `<script>` blocks. `check-hidden-flex.mjs`: elements toggled
  with `hidden` whose class sets `display:flex|grid` without a `[hidden]` rule
  (found in 046). `check-print-clip.mjs`: `height:` + `overflow:hidden` inside
  `@media print` (the half-sheet clipping bug, fixed three different ways in 047,
  070, 076). Each prints offenders; fix them in the same PR.
- **P5 — Lint.** A minimal ESLint config for `_shared/*.js`, `Tools/*/*.js` and the
  `.mjs` tooling (no-undef, no-unused-vars, eqeqeq) — not for inline `<script>` in
  HTML, which would be a much larger fight.
- **P6 — Suite reliability.** Added after P1's first day: 121 suites started
  running on every push and two different ones failed non-deterministically
  within three runs. Three deliverables — a crashed suite reports why it
  crashed, a way to measure which suites are non-deterministic and at what
  rate, and a written policy for property-style assertions over randomised tool
  behaviour.

  **Shipped 2026-09-02.** (1) `run-suites.mjs` prints the last lines of a
  crashed suite's stderr under its name in the summary; the first crash it
  would have explained (`route.fetch: read ECONNRESET`, run #8) was the
  harness's own keep-alive socket race, root-caused and fixed in `harness.mjs`
  — see Path 1 P2's note for the mechanism and the deterministic reproduction.
  (2) `run-suites.mjs --repeat N [--only <tool>]` runs the selection N times
  back to back and tallies, per suite, which passes it failed in and on which
  assertion; a suite with different outcomes in different passes is listed as
  NON-DETERMINISTIC by name, an expected failure that comes and goes is
  reported as its own bug, and a suite red in every pass is separated out as
  deterministic. Verified with flaky, green and always-red fixtures. (3) The
  policy is in `CLAUDE.md` ("Test tooling"): measure the rate against the
  parameters read off the running page, then raise the budget until the
  property holds — never loosen the assertion, never seed `Math.random` in a
  page-driven suite (pure-logic suites that take an rng parameter, like
  name-picker's, already seed and are deterministic by construction).

  *Inventory.* Reading every suite for assertions that are probabilistic over
  the tool's own randomness finds one page-driven case — the pairing-history
  coverage and spread pair (budget raised to 30 rounds in #162, measured
  complete in 200,000 of 200,000 simulated trials) — and a handful of
  pure-logic ones in name-picker's suite (first-pick uniformity over 28,000
  rounds, 9:1 weighting over 20,000 draws), all driven by a seeded rng.
  Everything else asserts on deterministic DOM state, so the remaining
  non-determinism to expect is the harness/timing kind, which `--repeat` still
  catches and which is a bug to root-cause rather than a rate to tolerate.

  *Measured:* five back-to-back full passes of all 121 suites on this
  container's Chromium (2026-09-02, 17.8–18.1 min each). Passes 1–4 were
  identical: 120 green, 1 expected-fail. Pass 5 failed three suites, and none
  of the three was random:

  - `command-center/test/smoke-seating-panel.mjs` and
    `smoke-remote-commands.mjs` build their bell-schedule fixtures as HH:MM
    offsets around the real clock. Suite 45 of 121 landed at 23:28 UTC, where
    a `+40 min` end time wraps past midnight, sorts before its own start, and
    no period is current. Deterministic given the wall clock — `TZ=UTC` at
    23:41 reproduced every failure line on demand — invisible at any other time
    of day, and a real CI hazard: a push at 23:30 UTC is 4:30 pm Pacific. Fixed
    by pinning the page's clock to 10:00 today (`page.clock.setFixedTime`,
    timers keep running) and deriving every fixture time from that instant;
    verified green under `TZ=UTC` inside the failing window, `Etc/GMT+1` and
    `Asia/Kathmandu`.
  - `qr-scavenger-hunt-builder/test/smoke-paper-mode.mjs`: "regenerating
    Library's code word changed it (was MERIDIAN, now MERIDIAN)" — the same
    assertion CI run #6 failed with HOLLOW. That one is the tool, not the
    test: 018's regenerate handler removed the station's own word from the
    exclusion list before drawing, so a four-station hunt got the same word
    back 1 time in 27 and the button looked dead. Fixed in 018 (the current
    word stays excluded; only a hunt using all 30 words falls through to
    STATIONn), `CACHE_VERSION` v134 → v135. Measured by clicking regenerate 200
    times on a three-station hunt: 7 unchanged on the previous tool, 0 on this
    one; `--repeat 30 --only smoke-paper-mode` 30/30 green. (A first 20-pass
    run showed one failure while a separate check had the tool file stashed
    mid-run — the same "never two things on one suite at once" rule, in a new
    shape; the clean run is the number.)

  So the five-pass number is: 121 suites, 605 suite-runs, 3 failures, all
  three root-caused and fixed, none by loosening an assertion. Two were
  clock-of-day, which `--repeat` only finds if a pass happens to straddle the
  window; the policy in `CLAUDE.md` now names that kind. Five passes bound the
  random-flake rate at roughly "no worse than 1 in 5 per suite", which would
  not catch a 1-in-362 flake like pairing-history's; a suspect suite gets a
  high-N single-tool run (`--repeat 20 --only <tool>`, ~10 min).

**Model.** Opus throughout.

**Verification.** A deliberately broken PR (one missing precache entry, one
failing suite) turns CI red with a readable summary; a clean PR is green.

**Decision.** Whether CI should also run `offline:build` + `offline:verify` on
`main` (slow, but it's the only end-to-end check of the `file://` copy).

---

## 3. Roster service and stable student identity

**Why.** This is `PLATFORM_PLAN.md` Track R, extended. `np_rosters` is read by 28
tools via ~20 copy-pasted picker functions; only Command Center listens for
cross-tab changes. Every tool that keeps per-student history (Behavior Points,
Hall Pass, Group Generator's `pairHistory`, Lab Roles' recency, Novel Circles, SSR
Log, Parent Contact Log, Lab Safety) keys it on the **name string**, so a roster
edit orphans history everywhere. Class Roster Hub already writes the fix
(`crh_students_v1`: stable ids, preferred names, pronunciation) and only three
readers exist. Six tool files independently name stable ids as the debt that costs
them data.

**Phases.**

- **P1 — `_shared/roster.js` (Fable).** As specified in `PLATFORM_PLAN.md` R1
  (`listRosters`, `getRoster`, `setRoster`, `onChange`, `mountRosterPicker`,
  `parseDelimited`, `flipLastFirst`), **plus** the identity layer this plan adds:
  `getStudents(rosterName)` returning `{id, name, preferred, say}` records joined
  from `crh_students_v1`, `resolve(nameOrId)` with the same normalization
  `student-details.js` uses today, and `matchName(spoken, students)` (exact →
  unique first name → small edit distance; returns `null` below threshold — this is
  also what Track V's voice commands need). 006 becomes the first consumer in the
  same PR. `np_rosters`' wire shape does not change. *Fable for the identity
  contract: what an id is, how renames and merges propagate, what "same kid" means
  across "Smith, John" and "John Smith". Everything after is adoption.*
- **P2 — Rename, merge and roster diff in 006 (Fable for the merge rules, Opus for
  the UI).** Import a fresh export and get "3 new, 1 left, 2 renamed — apply?";
  apply a rename across every tool that has adopted ids (P4) in one confirmed step;
  archive a departed student rather than deleting. Bulk CSV/XLSX import with
  period-column splitting per `PLATFORM_PLAN.md` R2, and export-all that
  round-trips.
- **P3 — Picker adoption rounds.** Wire the 8 unwired tools, then migrate the
  ~20 copy-pasted pickers in batches of ~10 (R3a–R3c as written). Each migrated
  tool gains cross-tab refresh for free. Sonnet-grade batch work once the first
  batch has set the pattern.
- **P4 — Identity adoption in the history-keeping tools.** In priority order:
  008 Behavior Points (most data at stake), 001 Hall Pass, 002 pair history, 022 role
  recency, 027, 033, 068, 013. Each: store `id` beside `name`, back-fill ids on load
  by exact-name match, key new history on id, keep name as display only. One
  migration helper in `roster.js` so eight tools don't write eight.
- **P5 — Photos and flags (needs Path 4's media store).** Move Seating Chart's
  photo storage to the shared record so every tool can render a face sheet; add the
  small flag set the platform themes list (absent today, do-not-cold-call,
  accommodation note) with Name Picker's Data tab as the wipe-it model.
- **P6 — Year rollover.** "Start next year": archive this year's rosters and every
  id-keyed history to a Backup & Restore file, clear student data, keep setup. Owned
  jointly with 009.

**Verification.** `npm run test:name-picker` and `test:roster-hub` green each
phase; a Playwright test that renames a student in 006 and sees Behavior Points and
Hall Pass history follow; 009 export captures every new key.

**Decisions.** Staff rosters (058, 075) in the same namespace or a `Staff —` prefix
convention; whether skill/level values (002's balancing) belong on the shared
record at all — the platform themes call this the most sensitive thing the site
would store.

---

## 4. Storage primitive, tool registry, media store

**Why.** ~206 localStorage keys across 69 tools, each hand-rolling parse guards and
(in ~17 cases) quota handling; three key-naming eras; a `"v":1` convention with no
migration mechanism. Backup & Restore's `KNOWN_GROUPS`/`STUDENT_KEYS` and Command
Center's panel readers are hand-maintained registries that go stale silently —
four tools' keys have already been found missing from backups after the fact
(050, 062, 064 and others). Image-bearing tools base64 into localStorage and hit
the ~5 MB ceiling (005, 015, 019, 028, 041, 042, 056, 071, 080); `bmg-map-cache.js`
is the IndexedDB pattern everyone cites and nobody has extracted.

**Phases.**

- **P1 — `_shared/store.js` (Fable).** IIFE, `window.Store`: `get(key, {default,
  migrate})`, `set(key, value)` with `QuotaExceededError` surfaced as a visible,
  explanatory message (never silent), `remove`, `onChange(key, fn)` wrapping the
  `storage` event plus a same-tab `CustomEvent`, `estimate()` via
  `navigator.storage.estimate()` where available, and a versioned envelope
  (`{v, data}`) with a `migrate(fromV, data)` hook. Adopt in 3 tools of different
  eras in the same PR to prove the shape. **No renames of existing keys.** *Fable
  for the migration contract and for deciding how legacy unversioned payloads are
  read without a flag day.*
- **P2 — `_shared/tool-registry.js`.** One data file: `{slug, title, file,
  localStorageKeys|prefixes, idbDatabases, studentData: bool, category}` for all 86
  tools. Consumers: 009 (replaces `KNOWN_GROUPS`, `STUDENT_KEYS`, `IDB_NOTES`), 010
  (panel sources), Path 10's Packet Builder, and a new `check-registry.mjs` that
  greps each tool for its declared keys and fails when a tool writes a key the
  registry doesn't know. This is the single change that makes backups complete by
  construction.
- **P3 — `_shared/media-db.js`.** Extract `bmg-map-cache.js` into a generic
  IndexedDB blob store (`put(id, blob, meta)`, `get`, `list`, `remove`, `usage()`),
  plus a shared `downscaleImage(file, {maxDim, quality})` lifted from the three
  near-identical copies (timeline-builder, seating-chart, 028). Register the
  database in the registry so 009 backs it up; make 009's IndexedDB path work on
  Firefox by enumerating registry-declared databases instead of
  `indexedDB.databases()`.
- **P4 — Migrate the image-bearing tools** to `media-db.js`, one or two per PR,
  keeping JSON export portable (export inlines blobs as data URLs on the way out;
  import rehydrates). Order by risk: 005 photos, 019 station images, 056/028 source
  libraries, 042 logo/signature, 015, 041, 071, 080 snapshots, 030 clue images
  (which currently live in localStorage while clue audio is already in IndexedDB).
- **P5 — 009 upgrades that fall out of the above.** Restore preview/diff ("3
  rosters replaced, 2 added, 1 untouched") built on registry metadata; per-tool
  restore as a shared control any tool can host; a storage-usage readout on
  `index.html`; an optional passphrase-encrypted backup (WebCrypto, local) — the
  files contain student names.

**Model.** Fable for P1; Opus for the rest.

**Verification.** `test:backup` green; a seeded profile with every registered key
round-trips through export → clear → import byte-identically; a full-quota
simulation shows the explanatory message in every migrated tool.

---

## 5. Projector mode, real dark mode, shared fullscreen stage

**Why.** `_shared/theme-toggle.js` is loaded by zero tools; the only dark mode
teachers get is `a11y.js`'s CSS-filter invert, which shifts every hue and looks
wrong on canvases and photos. Projector-first tools (Timer, Name Picker, Number
Talks, Exit Ticket, Writing Prompt, PE Stations, Review Game Board, Command Center)
each hand-rolled a fullscreen stage; the platform notes record the same wrinkle
being rediscovered four times (the Fullscreen API only renders the fullscreened
subtree, so live controls must live inside it).

**Phases.**

- **P1 — Decide the theme architecture (short, but it's a decision).** Keep
  `a11y.js` as the owner (it already persists prefs and syncs tabs). Add a real
  `data-theme="dark"` token set to `_shared/ink-paper.css` (the 71-tool palette) so
  tools on ink-paper get native dark by adding one attribute; keep the filter
  fallback only for tools that opt out. Retire `theme-toggle.js` (archive it; it's
  dead) and fold `theme.css`'s Industry tokens into the same mechanism for the five
  `_ds` tools. Respect `prefers-color-scheme` on first visit.
- **P2 — `_shared/stage.js`.** One fullscreen/projector helper: `Stage.mount(el,
  {controls, hud, hotkeys})` that fullscreens a container, keeps a teacher HUD
  (answer key, next/prev, timer) inside the subtree, exposes a "presentation" body
  class that hides chrome and enlarges type, and wires the site-standard keys
  (Space start/pause, N next, F fullscreen, Esc exit) guarded by the existing
  input-focus checks. Adopt in 023, 024, 025 and 021 first (the four known copies),
  deleting their local stage code.
- **P3 — Rollout.** Every projector-facing tool adopts `stage.js` and native dark:
  004, 007, 010, 030 (a projector-first tool with neither today), 001's projector
  view, 062, 064, 046's quiz mode, 055, 066, 081, 086. Batches of ~6.
- **P4 — Landing page and hallway tools.** `index.html` already has a native dark
  palette; 034 (a phone tool "that's always white") gets one too; the offline copy
  generator's stale theme-link pattern is re-checked.

**Model.** Opus. Sonnet for the rollout batches.

**Verification.** Screenshot both themes for every migrated tool via the harness;
a Playwright check that no tool ships the invert filter *and* a native palette at
once; keyboard-only run-through of one stage.

---

## 6. "Share…" everywhere

**Why.** `state-link.js` works and is in 17 tools; `PLATFORM_PLAN.md` Track P and
the platform themes both want it universal. Every adopter independently
re-discovered two failure modes: QR payload overflow on long states (028, 050, 056,
064 all fall back to copy-link by hand) and images that can't travel. Twelve files
carry their own `drawQR`. `navigator.share` is used by 3 tools. Nothing offers
download-as-file as the third option.

**Phases.**

- **P1 — `_shared/share.js` + `_shared/qr-draw.js`.** `Share.mount(button, {
  getState, tool, title, filename })` opens one consistent sheet: Copy link, Show
  QR (with a *measured* payload budget — grey the QR out above the reliable
  scan size and say why), Download `.json`, and `navigator.share` where available.
  `qr-draw.js` is the ~40-line canvas sizing helper that replaces the twelve copies.
  Strip images from link payloads by policy and say so in the sheet.
- **P2 — Adopt in the 17 existing `state-link` tools**, deleting their local QR and
  share code; then wire the receiving side (`?state=`) through the same helper so
  "open from link" behaves identically everywhere.
- **P3 — Extend to the builders that don't share yet.** From the improvement
  notes: 044, 045, 047, 052, 057, 065, 070, 072, 073, 079, 081, plus every
  "generator" tool with a saved configuration. Batches of ~8.
- **P4 — Cross-tool "Send to…".** The same sheet grows a "Send to <tool>" row
  driven by the tool registry (Path 4): map places → timeline (exists), rubric →
  grade distribution (exists), roster → groups → lab roles → seating, trivia →
  review board, vocab → flashcards. Each handoff is a declared
  `{from, to, param, transform}` entry, not an ad-hoc key read.

**Model.** Opus.

**Verification.** A shared Playwright helper that round-trips a state through
link, QR (decoded with the vendored jsQR) and file for every adopter; `check:dedupe`
extended to `drawQR`.

---

## 7. Print and export kit

**Why.** Print output is the product: 78 tools call `window.print()`, 63 carry
hand-written `@media print` blocks, 20 use `print-area.css`. The same problems are
re-solved per tool: page margins, a class/date header, "N of M" footers, never
splitting a card or a student's block across pages, grayscale-safe output, and the
three variants of "print one / a class set / blanks". jsPDF, SheetJS and JSZip are
vendored but only 5, 6 and 4 tools use them, so most tools' data is trapped in
localStorage with no file export.

**Phases.**

- **P1 — `_shared/print-kit.css` + `print-kit.js`.** Opt-in classes for the
  recurring layouts (`.pk-page`, `.pk-keep`, `.pk-half`, `.pk-quarter`, `.pk-card
  grid` with Avery-ish presets), a header/footer helper (`PrintKit.setHeader({class,
  date, title})`), and a "print set" helper that renders one/class-set/blank from a
  single template plus a roster (Path 3). Grayscale guidance: a `.pk-ink-safe`
  utility set (hatching, borders, labels) for anything currently encoded in color.
- **P2 — Print reliability audit.** With Path 2's `check-print-clip.mjs`, sweep the
  63 hand-written blocks for the fixed-height clipping bug, `page-break-inside`
  on things that must not split, and tools linking `print-area.css` without a
  `#printArea`. Fix in batches.
- **P3 — Adoption.** Move the class-set/blank tools (042, 043, 023, 070, 076, 077)
  onto the shared set helper first; then the card-grid tools (016, 017, 018, 040,
  051, 064, 074).
- **P4 — Export layer (Fable for the PDF pagination and imposition math).**
  `_shared/export.js`: `toPdf(printArea, {paper, orientation})` built on the
  vendored jsPDF for tools that want a file rather than a dialog; `toCsv/xlsx(rows)`
  via SheetJS for every tool holding tabular data; `toZip(files)` for multi-sheet
  generators. Booklet/N-up/duplex imposition lives here too (extends
  `duplex-print.js`, which still has a second copy in `vfg-layout.js`).
- **P5 — A real print preview.** A shared "Preview" mode that renders the print
  DOM into an in-page paged view (CSS `@page` size emulation) so a teacher sees
  page breaks before the dialog, instead of after.

**Model.** Opus, except P4's imposition math.

**Verification.** `emulateMedia('print')` screenshots per adopter checked into the
tool's test folder; one physical print run on the school's black-and-white copier
recorded here (the notes say real paper has never been validated for Avery stock,
6-per-page cards, or the calibration page).

---

## 8. Phone-as-remote and pairing rollout

**Why.** `_shared/webrtc-pair.js` is a serverless, LAN-only WebRTC channel with QR
signaling — an unusual capability for a static site, used by 7 tools. The platform
notes call "phone as a remote" the single strongest use of it, and empirical
testing (021) proved `BroadcastChannel` cannot do this across devices. Existing
pairing has to be redone when the connection drops (004), and each adopter
(`ct-mirror.js`, `cc-remote.js`, `br-pair.js`, `sv-handoff.js`, `monitor.html`)
re-implements the host/join/QR dance.

**Phases.**

- **P1 — `_shared/remote.js`.** On top of `webrtc-pair.js`: `Remote.host({commands,
  state})` and a generic `remote.html` join page that renders a command pad from
  the host's declared command list and shows host state. Persist the last pairing
  and auto-re-offer on drop; heartbeat and "reconnecting…" UI; the one-QR-per-side
  flow captured once. Migrate `cc-remote.js` and `ct-mirror.js` onto it as proof.
- **P2 — Rollout.** Name Picker (pick, undo, mark absent), Review Game Board
  (reveal, award, next), PE Stations (next rotation, pause), Timer (already a
  mirror; becomes a remote), Exit Ticket / Writing Prompt / Number Talks (next
  prompt, reveal), Hall Pass (sign back in), Command Center two-way status.
- **P3 — Second display.** The inverse: `Remote.display()` for a tool that wants
  the *room* to see one thing and the teacher another (Review Board answers, Number
  Talks strategies, Seating Chart with photos hidden).
- **P4 — Device-to-device data.** Generalize `br-transfer.js`'s chunked transfer
  so any tool can "send this project to the device next to me" — schedule, bracket,
  roster, room layout — via the Share sheet (Path 6).

**Model.** Opus.

**Verification.** `test:command-center` and `test:timer` already drive two peers
in one browser; extend that pattern into a shared `pairTwo(page)` harness helper.

**Decisions.** Whether a paired student device is ever in scope — the platform
themes say no, and this path deliberately stays teacher-device-only.

---

## 9. The school-year spine: calendar, bell schedules, grading periods

**Why.** School Calendar Visualizer is "the spine of the school year", read today
by two tools (010, 045) and only for day type. Bell schedules exist only inside the
Schedule Visualizer's data model, so the Timer cannot answer "how long is 3rd period
today?", the Hall Pass report cannot correlate trips with periods, and the Final
Grade Checker treats "remaining quarter" as a manual input. Pacing shipped with
fixed unit dates; the valuable half (a unit defined by instructional days that
*recomputes* around a snow day) did not.

**Phases.**

- **P1 — Bell schedules per day type in 032.** Add `bell` to `scv_calendar_v1`
  (versioned via `scv-store.js`'s existing `migrate()`), with an importer from
  035's `_bellDayRows` so schools that already built it in the visualizer don't
  retype. Expose `_shared/school-day.js`: `today()`, `periodAt(date, time)`,
  `gradingPeriodOf(date)`, `daysRemaining(gradingPeriod)`, all reading the calendar
  read-only.
- **P2 — Pacing that recomputes (Fable).** Units by instructional-day count, flowed
  automatically around holidays/half days/testing windows; "you are N days behind"
  against the plan; rebinding when a day is lost. *Fable for the placement
  algorithm and its interaction with the existing bump/adjustment model.*
- **P3 — Consumers.** 004 Timer: "rest of this period" one click, half-day aware;
  010: current/next period, auto-advancing board; 001: period on every trip and in
  the long-range report; 036/037: grading window from the calendar; 044/045: "is
  tomorrow a grading deadline" and today's lesson code pre-filled; 032 itself:
  multi-course pacing side by side.
- **P4 — Calendar import/export.** `.ics` import (district calendars are published
  as ICS) and pasted-table import replacing the hard-coded 2026–27 preset that
  expires; `.ics` export of the pacing. A one-page year wall calendar print.

**Model.** Fable for P2; Opus otherwise.

**Verification.** `test:school-calendar` extended with a snow-day recompute
fixture; one Playwright test per consumer asserting it reads the shared module and
degrades gracefully with no calendar saved.

**Decision.** Whether bell schedules are owned by 032 or 035 (035 already has the
data; 032 is the better public owner). This plan says 032 owns, 035 imports/exports.

---

## 10. Packet Builder and the sub-day product

**Why.** `PLATFORM_PLAN.md` Track P (the Packet Builder, a new tool `087`) is the
general engine; separately, Sub Plan Builder (044) and Sub Binder (045) are two
tools for one job, joined by six literal key reads and no shared code, and 045's own
notes say the handoff interface question is "due, not deferred". The "evergreen
emergency binder" is the most-requested version and doesn't exist. Sub Note
Feedback Slip (076) prints prompts the binder ignores, and nothing captures what
the sub wrote back.

**Phases.**

- **P1 — Packet Builder `087` with the section-provider registry**, exactly per
  `PLATFORM_PLAN.md` P1/P2 (`Tools/packet-builder/sections.js`, evaluate/render
  providers, presets, live preview, seating section via `seating.mjs`), but with
  providers declared in the tool registry (Path 4) instead of a private list.
- **P2 — 045 re-based on the providers.** Sub Binder keeps its one-button UX but
  sources every section from `sections.js`; its six raw key reads go away. Add the
  076 feedback prompts as the binder's feedback page.
- **P3 — Emergency binder.** A permanently maintained no-notice packet built only
  from date-independent sections, with a staleness reminder on `index.html` and in
  Command Center; one click prints it. Standing details get a version stamp (a
  September plan must notice an October room change).
- **P4 — Sub Plan Builder pulls instead of being typed.** With Path 9: today's
  unit/lesson code from the calendar, the do-now from the prompt banks, the
  seating chart, so a plan is mostly drafted before the teacher types. One rendering
  model for both the `.docx` and the printed output (today they are two independent
  renderers that drift).
- **P5 — Round trip.** Share the plan by link/QR (Path 6) so a sick teacher at
  home can send it to the office; a per-date "what the sub said" field; optionally a
  QR on the feedback page that opens a three-field form on the sub's phone and
  hands the result back by link.

**Model.** Opus.

**Verification.** `test:sub-plan` and `test:sub-binder` green; a seeded profile
prints a combined seating + sub plan + hall pass packet with correct pagination
(`emulateMedia('print')` screenshot).

**Decision.** `.docx` vs PDF as 044's primary output (open in its notes for three
rounds).

---

## 11. Schedule Visualizer: modularize, guard the publisher, route accessibly

**Why.** `035-schedule-visualizer.html` is 936 KB and ~20,000 lines of hand-written
code (428 top-level functions in one script; 68 titled sections), four times the
next largest tool. Its publisher builds `034-schedule-browser.html` by
`.toString()`-ing 26 live functions named in `brPublishFnList()`, so any refactor
silently changes published output, and drift has already happened once (R61–R63).
Its own notes say the split is "the main thing standing between this tool and
further progress". It also has the site's most complete undo/history system and
a real pathfinder that the published browser never exposes.

**Phases.**

- **P1 — Publisher drift guard (Fable).** Before touching anything: a test that
  regenerates the browser from the Northwind fixture and diffs it against
  `test/publish.mjs`'s baseline, plus a check that every function in
  `brPublishFnList()` still exists and that the published head block matches the
  newer social branding. Only after this is green does extraction start. *Fable
  because the coupling is by string name and by closure, and the failure is a
  silently wrong published file that teachers rely on.*
- **P2 — Extract the pure engines to `Tools/schedule-visualizer/`** in this order:
  schedule model, pathfinding (`astar`, `computeTravelTimes`), multi-floor graph,
  evacuation routes, congestion, playback renderer, publisher. Each extraction is
  one PR with a Node unit suite for the pure part (today all coverage is Playwright).
  Fold the two folders (`schedule/` and `schedule-visualizer/`) into one and fix the
  stale README. Target: the HTML under ~300 KB.
- **P3 — Accessibility routing.** Wheelchair/elevator-weighted routes over the
  existing graph, per-student route sheets, and "which rooms can't be reached
  without stairs" as a printable report — the notes call this "a real legal and
  human need that nobody has a tool for".
- **P4 — Safety printing.** Multi-floor batch evacuation cards, lockdown maps,
  per-teacher door-sign sets, published map packs as PDFs.
- **P5 — Master-schedule assistance.** Constraint checks (a teacher with three
  rooms in three consecutive periods, a room double-booked), congestion as a printed
  argument (top-ten pinch points with what-if deltas), multi-year comparison.
- **P6 — Published browser.** Runtime-swappable `PUBLISHED_DATA` (one browser file,
  many buildings), expose the pathfinder as "how do I get from here to there", and
  sub coverage marked and returned by link (Path 6).

**Model.** Fable for P1–P2 and P5's constraint work; Opus for P3, P4, P6.

**Verification.** `test:schedule` and `test:schedule-visualizer` green after every
extraction; the publish diff is byte-identical until a phase intentionally changes
it, and then the baseline is regenerated in that PR.

---

## 12. Question bank hub: one bank, played six ways

**Why.** Review Game Board's `rgb-bank-store.js` already holds questions with
unit/standard/difficulty metadata and the site's best import (XLSX plus a template
download). Its notes call "one bank, played six ways" the highest-leverage change
available and name four tools that need questions and cannot get them: Scavenger
Hunt, Escape Room, Flashcards, Bracket (academic tournament). Cultural Trivia (053)
and Geography Bee (062) ship their own banks in incompatible shapes.

**Phases.**

- **P1 — `_shared/question-bank.js` + 030 as the front door.** Lift the bank store
  to a shared, versioned schema (`{id, prompt, answer, choices?, media?, unit,
  standard, difficulty, tags}`), keep 030's editor and importer as its UI, register
  the keys (Path 4), and give it export/import so a bank can be a department
  resource.
- **P2 — Read-side adopters.** 053 and 062 publish their built-in banks into the
  shared shape (read-only seed sets); 040 flashcards ↔ bank (term/definition is a
  question); 018 and 019 pull station questions from the bank; 020 gets an
  academic-tournament mode fed by it.
- **P3 — Play modes in 030.** Every-team-answers mode, quiz-bowl, spin-the-wheel,
  the final wager round, and a printed practice quiz/study guide with an answer key
  — all reading the same bank.
- **P4 — Media.** Clue images move to the media store (Path 4) beside the existing
  clue audio; media travels in export as data URLs.

**Model.** Opus.

**Verification.** `test:review-board` green; a bank round-trips 030 → export → 018
→ 019 with ids preserved.

---

## 13. Grouping, rotation and bracket engine

**Why.** Group formation exists four times (002, 022, 027, Name Picker's Groups
mode); role rotation with recency memory twice; the bracket algorithm is
"line-for-line the same" in 020 and 021; the station-rotation timer exists in 004's
round-robin mode, 021, 017 and 069. 002's `pairHistory` keeps two generations, so
"everyone has worked with everyone this year" is unanswerable. 020 still lacks
double elimination, pools and Swiss scheduling, tie handling and re-deciding a
match; 021 silently overwrites a saved unit on a name collision (a real bug).

**Phases.**

- **P1 — `Tools/_engines/` or `_shared/grouping.js` (Fable for the API).** One
  pure, tested module: `formGroups(students, {count|size, balanceBy, keepApart,
  keepTogether, seatingAware})`, `rotateRoles(groups, roles, history)`, and a
  history model keyed on student ids (Path 3) with a retention policy that is a
  setting, not a constant. *Fable for reconciling four tools' constraint semantics
  into one API without changing any tool's results for existing inputs.*
- **P2 — Adopt in 002, 022, 027, 007** one PR each, deleting local engines. Add
  seating-aware grouping (groups that are physically possible given
  `seating-chart-v1`) and project-team mode (longer-lived named teams with a
  printable contract) to 002 once the engine is shared.
- **P3 — `_shared/bracket.js` + `_shared/rotation.js`.** Extract 020's bracket and
  scheduling code and 021's rotation timer; 004's round-robin mode and 017/069's
  station timers adopt rotation. Fix the 021 overwrite bug in the same PR.
- **P4 — Bracket completeness.** Double elimination, pools, Swiss (a scheduler
  that copes with match counts unknown up front), ties/draws, re-deciding a decided
  match, consolation bracket, team rosters, and a real second-display mode via
  Path 8.

**Model.** Fable for P1; Opus for the rest.

**Verification.** `test:groups`, `test:lab-groups`, `test:novel-study`,
`test:bracket`, `test:pe-stations` green; golden-file tests that the shared engine
reproduces each tool's previous output for a seeded input.

---

## 14. Seating Chart: room model, constraint solver, phone toolbar

**Why.** It is read by 10 files and rendered by four independent readers (its own
`seating.mjs`, 010 inline, 008's `seating-layout.js`, 045). Its constraints are
pairwise only; teachers need front-of-room accommodations, near-the-door,
vision/hearing, and a solver that explains which soft constraints it broke. It
stores photos in localStorage. Its toolbar (~15 controls) is the site's one
currently-failing test. And its undo stack is "the best on the site" and
un-extracted.

**Phases.**

- **P1 — Fix the phone toolbar.** Overflow menu or sticky action bar so the chart
  is within one swipe at 375 px; turn the known-red assertion green without
  loosening it. Small, first, and overdue.
- **P2 — `_shared/seating-read.js`.** One read-only renderer/reader of
  `seating-chart-v1` used by 010, 008, 045 and Path 10's packet section, replacing
  three copies. Photos move to the media store (Path 4).
- **P3 — Constraint solver (Fable).** Hard constraints (front row, near door,
  keep apart, keep together, needs partner) and soft ones (seat history, front-row
  once a quarter), a scored auto-assign that reports which soft constraints it
  broke and why, and enforcement across a *sequence* of charts rather than the
  single-shot 800-attempt loop. *Fable for the solver and its explanation output.*
- **P4 — The room, not the grid.** A room layer (doors, windows, teacher desk,
  benches, projector wall, obstacles) shared across period-specific assignments,
  so one physical room is drawn once. Reuse 035's tile editor where sensible;
  decide whether the room model lives here or in a shared "my classroom" store 035
  also writes.
- **P5 — Live mode + undo extraction.** Project the chart; tap a seat to mark
  absent, award a point (008), or start a pass (001). Extract the undo stack into
  `_shared/undo.js` and adopt it in the tools whose undo is a single in-memory
  snapshot (002, 003, 018, 020, 021, 022, 024, 027, 043).

**Model.** Fable for P3; Opus otherwise.

**Verification.** All four `test:seating` suites green including the currently
red one; a solver fixture with a known-feasible constraint set and a known-infeasible
one asserting the explanation.

---

## 15. Name Picker: split, equity dashboard, themes as data

**Why.** 2,830 lines with 100+ top-level functions and five modules already
extracted; the picker UI, the 11-theme skin system, sound engine, and each pick
mode are still inline. The 500-entry participation history cap now underpins an
equity feature teachers may be asked to defend. The equity math
(`np-equity.js`, `np-seat-equity.js`) already exists for the current roster and
day; the cross-week, cross-period view teachers actually want does not.

**Phases.**

- **P1 — Split.** `np-themes.js` (themes as JSON data, not code), `np-sound.js`,
  one module per pick mode, `np-ui.js`. No behavior change; `test:name-picker`
  green.
- **P2 — History.** Replace the flat 500-entry cap with a per-day rollup that
  survives trimming; key history on student ids (Path 3) so nickname/preferred-name
  matching stops under-reporting via `unmatched`.
- **P3 — Equity dashboard.** Who hasn't been called on in three weeks, distribution
  by seat position, per period and across periods, printed as a one-page artifact.
  A "Data" front door with an erase button, matching the site's privacy posture.
- **P4 — Question-attached picks.** A pick is `{student, question}` when a prompt
  bank is loaded (Exit Ticket, Number Talks, the question bank of Path 12), logged
  together.
- **P5 — Artifacts and remotes.** Team Draft hands off to Group Generator and the
  bracket (Path 13) instead of ending in a board; phone remote via Path 8; theme
  packs importable as JSON so a unit-themed board is a file.

**Model.** Opus.

**Verification.** `test:name-picker` (both suites) green; a fixture with 600
picks across three weeks asserts the rollup and the dashboard counts.

---

## 16. The grades trio and a shared chart engine

**Why.** Final Grade Checker (036), Grade Distribution Visualizer (037) and Data
Chart Builder (038) were each given independent rounds and never share code: two
SVG chart engines, two SVG→PNG rasterizers, two palettes with two rationales, two
parsers for the same gradebook paste, two histogram bucketings. 038 skips the a11y
baseline entirely while 037 next door does hatching, contrast labels and live-region
announcements well. Per-question item analysis, the thing 037's notes call the most
valuable thing a teacher can learn from a test, is unbuilt. 036 never persists
grades by policy — keep that.

**Phases.**

- **P1 — `_shared/chart-svg.js`.** Axes, scales, bar/line/pie/scatter/box/histogram,
  037's accessibility patterns (hatching, contrast-aware labels, `<title>/<desc>`,
  announcements), one grayscale-safe sequential ramp (the `RAMPS` +
  `relativeLuminance()` pair from `bmg-choropleth.js`), one rasterizer, one
  copy/download helper. 037 and 038 adopt it; 038 gets the a11y baseline.
- **P2 — `_shared/paste-table.js`.** One parser for pasted spreadsheet regions
  (tabs/commas/semicolons/pipes, header detection, thousands separators, names
  containing the delimiter, a "rows I couldn't read" report rather than guesses),
  extracted from the three implementations the site requests already list
  (`bmg-choropleth.js`, 038, 036's `splitRow`). 036, 037, 038, 006 and 075 adopt it.
- **P3 — Item analysis in 037.** Per-question scores in, a "which questions did the
  class miss" chart, a printed reteach priority list; section-vs-section comparison
  (3rd vs 6th period); trend across a quarter as small multiples; a plain-language
  "what this says" page for a PLC binder.
- **P4 — 036 modelling.** Parameterize term count and column layout (trimesters,
  semester exams, other districts' exports); scenario modelling (drop lowest,
  curve, re-weight) with a before/after distribution drawn by P1; grading window
  from Path 9; roster join so missing students are flagged and triage lists flow to
  085/068. Still no grade persistence without an explicit, visible opt-in.
- **P5 — 038 for science.** Regression with R², log axes, multi-series scatter,
  annotation layer (arrows, callouts, shaded regions), multiple charts per printed
  page; handoffs to 065 and 073.

**Model.** Opus.

**Verification.** `test:final-grade`, `test:grade-dist`, `test:chart-builder`
green; golden SVG snapshots for each chart type in both themes.

---

## 17. Image → PDF as a document scanner; a local PDF layer

**Why.** Its notes call document-scanner mode "the single most-wanted capability in
this category" (the copier's scanner is always broken): edge detection,
perspective correction, thresholding — all canvas math, no library. PDF in / PDF out
(merge, insert, extract, rotate) combined with Word Doc Merger (031) gives the site
a complete local document-assembly story. Print-shop presets (booklet imposition,
N-up with cut marks) are something teachers need that no free local tool does well.

**Phases.**

- **P1 — Reorder and crop.** Thumbnail-grid reordering (the list is unusable at 40
  photos), crop/straighten per page, and real-photo validation of the existing
  `compact`/`min` retry presets, which have only ever been tested against synthetic
  fixtures.
- **P2 — Scanner mode (Fable).** Auto-detect the page quadrilateral (edge/contour
  on a downscaled canvas), draggable corner handles, perspective warp, adaptive
  threshold / grayscale / color modes, per-page and batch. *Fable for the CV math
  and its failure handling on low-contrast phone photos.*
- **P3 — PDF in.** Accept PDFs as input (render pages via a vendored `pdf.js` —
  a new `_shared/vendor/` entry with the README, SHA and precache bookkeeping;
  weigh its size against the precache in Path 1), so merge/insert/extract/rotate
  work on existing PDFs. 031 gains "PDF export of the merged docx" via the same
  layer where feasible.
- **P4 — Imposition (Fable).** Booklet (saddle-stitch page order), N-up with cut
  marks, two-sided presets, in the shared export layer of Path 7 so every printing
  tool can use them.
- **P5 — OCR (decision first).** Searchable PDFs need a vendored Tesseract build
  (tens of MB). Decide whether an on-demand, non-precached download is acceptable
  under the offline promise before any code.

**Model.** Fable for P2 and P4; Opus otherwise.

**Verification.** `test:image-to-pdf` (three suites) extended with a
photographed-page fixture and a page-count assertion for contact sheets; a
16-page booklet printed and folded once, recorded here.

---

## 18. Escape Room and Scavenger Hunt convergence

**Why.** Each tool is missing exactly what the other has and they print the same
station cards: 019 has branching, images, answer validation, a `lock.html` player
and a WebRTC `monitor.html`; 018 has teams, timing, hints-with-penalty and a
leaderboard. 018's last round "only widened the gap between the two station data
shapes". 019's most valuable open item is a non-QR fallback (not every student has a
working camera); the whole room rides in a QR with no payload-size warning.

**Phases.**

- **P1 — One station schema (Fable).** Design the shared station/room/hunt model
  that both tools can read (`{stations[{id, prompt, answers[], digitLength,
  branches: byAnswer, media}], teams, timing, hints}`), with a migration from each
  tool's current shape and explicit, stable station ids that survive reordering so
  a reprint doesn't invalidate codes already taped to the wall. *Fable for merging
  two divergent models without losing either tool's behavior.*
- **P2 — Both tools on the schema**, plus the payload budget from Path 6 (Share
  sheet) and a printed short-code fallback typed into `lock.html`.
- **P3 — Feature parity.** 019 gains teams/timing/hints/leaderboard; 018 gains
  per-answer branching, "a required set in any order", station images, and the
  player page. Questions come from the bank (Path 12).
- **P4 — The debrief.** Post-hunt print: per-team path, time per station, misses,
  a reflection page — "where the learning actually happens". Annotated floor-plan
  map via 046 or 035's building map.
- **P5 — Decide the product.** Two entry points on one engine, or one tool with a
  mode switch. Either is fine; decide after P3 with real usage.

**Model.** Fable for P1; Opus otherwise.

**Verification.** `test:escape-room` and `test:scavenger-hunt` green; a fixture
room built in 019 opens in 018 and back with ids intact.

---

## 19. Vocabulary hub and conjugation engine

**Why.** The notes call a shared vocabulary store "the clearest content-reuse win
on the site". Today 040 → 039 is a read-only bridge carrying term/definition only
(part of speech, example, pronunciation, gender, audio, image are silently
dropped) with no write-back; 014's scenario vocabulary and 027's vocabulary log are
unbridged; 051 and 052 hold word lists in their own shapes. Regular Spanish/French
conjugation is entirely mechanical and 039 makes teachers type every form.

**Phases.**

- **P1 — `_shared/word-list.js`.** Versioned store of named lists of
  `{term, definition, partOfSpeech, example, pronunciation, gender?, tags}`, with
  paste import (Path 16's `paste-table.js`), export, and the template-download
  pattern from 030. Decide the owner: this plan says a small "Word Lists" hub UI
  inside 040 (the hub pattern that 006 uses for rosters), not a new tool number.
- **P2 — Adopters.** 040 reads/writes; 039 reads the full record and writes back
  edits; 014 pulls scenario vocabulary; 027 logs to it; 051 and 052 read. Delete
  `vfg-conjdrill-link.js`.
- **P3 — Conjugation pattern engine.** Given an infinitive and verb class, generate
  the full regular table for Spanish and French (present, preterite/passé composé,
  imperfect, future, conditional, subjunctive present), with irregular overrides
  stored on the word record; 079's posters and 039's drills both consume it.
- **P4 — Printables.** Frayer model page; spaced-repetition scheduling for printed
  drills (which list, which day); fill-in-the-blank sentence mode; a word wall as a
  system (cards by unit, printable index, retire a unit).
- **P5 — Audio.** TTS on study mode and labels via the existing `speechSynthesis`
  helper; teacher-recorded pronunciations via MediaRecorder into the media store
  (Path 4) for 051 when no target-language voice exists.

**Model.** Opus.

**Verification.** `test:vocab-share` green; a golden table for a dozen regular and
irregular verbs per language.

---

## 20. Blank Map: live vectors, dropped GeoJSON, shared geometry

**Why.** The most modular tool on the site (16 ES modules) and the one whose
pieces others are already importing: Timeline Builder calls `bmg-vector.js`
directly, Geography Bee copied it, and `unwrapRing`/`drawableRings` (the
antimeridian handling that stops stray lines across the Pacific) now exists in
three places. The rendered map is still a raster, so zoom quality has a ceiling;
base maps are four bundled datasets; time-slice *annotations* (a border that moves
in 1803) need a per-slice store; `bmg-commons.js` fetches from Wikimedia at
runtime, the one content fetch that leaves the browser.

**Phases.**

- **P1 — `_shared/geo-project.js`.** Projection and inverse, `unwrapRing`,
  `drawableRings`, `traceFeature(ctx, feature)` (per-feature, so a highlighted
  country's holes cancel against its own rings), and an output-size argument for
  `renderBaseMapCanvas`. 046, 015 and 062 import it; the copies go. Move the
  `data/` GeoJSON alongside. Also lift `bmg-hittest.js` (point-in-polygon taking
  the transform as an argument) and the curriculum gazetteer that 015 duplicated.
- **P2 — Dropped GeoJSON/TopoJSON.** Accept a dropped file as a base map (district
  boundaries, watersheds, historical borders), with the same calibration path as
  the bundled sets; store in the media store (Path 4).
- **P3 — Live vector viewer (Fable).** Render the base map as vectors in the
  viewer (SVG or canvas re-render on zoom) so zoom is sharp, keeping the raster
  path for poster export and the print pipeline. *Fable for keeping hit-testing,
  labels and the tiled poster print consistent between the two render paths.*
- **P4 — Time slices for annotations.** Per-slice labels/lines/regions with a
  scrubber; small-multiple print; a two-way, selective handoff with 015 (send
  selected labels *and* markers; come back from a timeline into a map project).
- **P5 — Quiz memory and the network question.** Persist which labels a class
  missed across sessions (the reteaching signal); make the Wikimedia lookup an
  explicit, disclosed, online-only action with its cache shown, or drop it.

**Model.** Fable for P3; Opus otherwise.

**Verification.** All five `test:blank-map` suites plus `test:timeline` and
`test:geo-bee` green after P1; a Fiji/Chukotka/Antarctica fixture asserting no
stray full-width lines from the shared module.

---

## Running a path

A session picking up a phase should:

1. `git checkout main && git pull`; read this file's path section, the tool's
   `improvement prompts/<tool>.md`, and `CLAUDE.md`.
2. Claim the tools it will touch in `improvement prompts/_tools-touched.md` and push
   that alone first. `_shared/` changes are single-owner work: never run two
   `_shared/`-touching phases in parallel (the site requests file records why).
3. Do one phase per PR. Bump `CACHE_VERSION` and update `PRECACHE_URLS` in the same
   commit as any file add/rename/delete or content change to a precached file.
   Register new storage keys in 009 (or, after Path 4 P2, in the registry).
4. Run `npm run check:dedupe`, `check:tests`, `check:precache`, `check:social`
   (the last for head edits), and the `test:<name>` suites of every touched tool.
   Record what was actually verified in the phase's write-up here,
   `REFACTOR_PLAN.md` style.
5. Update this file: tick the phase, note surprises, and move anything cut to the
   tool's improvement file so it isn't lost.

Suggested session prompt (fill in the path and phase):

```
Run git checkout main && git pull. Read UPGRADE_PATHS.md and execute Path <N>,
Phase <P> only. Follow CLAUDE.md conventions (one canonical vendored copy, lib/ not
libs/, link _shared/ boilerplate, sw.js PRECACHE_URLS + CACHE_VERSION in the same
commit). Claim touched tools in improvement prompts/_tools-touched.md first. Run
npm run check:dedupe, check:tests, and the test suites for every touched tool;
record what you verified under the phase in UPGRADE_PATHS.md. Commit on a new
branch, push, open a PR, and merge it to main with a squash merge. Confirm the
merge completed before ending.
```
