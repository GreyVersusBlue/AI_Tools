# CLAUDE.md — repo conventions

This is the East Middle Staff Toolkit (aspermylessonplan.com): a static GitHub
Pages PWA of small, self-contained classroom tools. No build step, no server,
no accounts — every tool runs entirely in the browser and must keep working
offline once the site has been visited. These conventions exist to stop
copy-paste drift across the 86 tools; follow them for every new tool and
every edit. The deduplication work that established them is summarised in
`HISTORY.md`.

## Layout

- `Tools/<nnn>-<Tool Name>.html` — each tool's single entry point, directly
  under `Tools/`.
- `Tools/<tool-name>/` — a matching subfolder for anything the tool needs
  beyond inline script (modules, fonts, tests, data files).
- `_shared/` — code shared across tools (theme, a11y, QR, state links,
  WebRTC pairing). Extend this; never invent a parallel shared location.
- `sw.js` — the hand-maintained service worker that precaches the whole site.
- `index.html` + `README.md` — the landing page and tools table; both must be
  updated when a tool is added.

## Vendored third-party libraries

- Vendored libraries live in `_shared/vendor/<name>/<file>` — **one canonical
  copy of each library, site-wide**. Before adding any library, check whether
  it is already there and use that copy via a relative `<script src>`.
- Never add a per-tool copy of a library that belongs in `_shared/vendor/`,
  and never rely on a CDN — the school network can't be trusted, and offline
  must keep working. (A small cdnjs allowlist exists in `sw.js` for legacy
  reasons; don't add to it.)
- If `_shared/vendor/` doesn't have the library yet, put it there (with the
  version visible in the file header if possible), not in the tool's folder,
  and give it a README recording version, source URL, SHA-256, and consumers —
  see `_shared/vendor/README.md`.
- The vendored-library consolidation has landed (`HISTORY.md`): **jsPDF
  (+ AutoTable), SheetJS (`xlsx`), jsQR, qrcode.js, and jszip.min.js now live
  only in `_shared/vendor/`.** Nothing vendored is left duplicated in a per-tool
  `lib/` folder. `_shared/vendor/qrcode/` is the QR *encoder*;
  `_shared/vendor/jsqr/` is the *decoder* — easy to confuse by name.
- When comparing two copies of a library to see whether they're really
  different builds, hash them with line endings normalized (`tr -d '\r'`).
  Raw file sizes differ by CRLF alone and will fool you.
- **Before committing, run `npm run check:dedupe`** (Phase 6 guard;
  `node Tools/board-check/check-dedupe.mjs` directly works too — no
  dependencies needed). It exits nonzero if any of the six vendored library
  filenames exists as a file, or is referenced by a live page's `src`/`href`,
  anywhere outside `_shared/vendor/` — the exact duplication Phases 1/1b
  removed creeping back. Fix the offender it prints; never commit over a red
  check.

## Per-tool folders

- Tool-specific support files that genuinely belong to one tool go in the
  tool's subfolder. If that subfolder needs a nested folder for vendored or
  third-party files, name it `lib/` — **never `libs/`**. (Both exist
  historically; `lib/` is the standard going forward.)

## Service worker / offline (the rule that breaks the site when skipped)

- `sw.js` hand-curates `PRECACHE_URLS`. **Any time a file is added, renamed,
  moved, or deleted, update `PRECACHE_URLS` to match and bump
  `CACHE_VERSION`** (the `const CACHE_VERSION = 'vNN'` at the top). Both, in
  the same commit. A stale list silently breaks offline use for teachers.
- Since v138 the precache is **two tiers** (Path 1 P3): `SHELL_URLS` — the
  landing page, `_shared/`, icons/manifest, and ten front-of-room tools with
  their support files — is cached at install; everything else in
  `PRECACHE_URLS` is fetched by a deferred pass that `_shared/sw-register.js`
  asks for a few seconds after load (`PRECACHE_REST`), and `index.html` shows
  "Offline: N of 86 tools ready" from the worker's `PRECACHE_PROGRESS`
  messages. A new file goes in `PRECACHE_URLS`; add it to `SHELL_URLS` **too**
  only if it belongs to one of those ten tools or to `_shared/`. `SHELL_URLS`
  must stay a subset of `PRECACHE_URLS` — `check:precache` fails otherwise.
  The Wikimedia map cache (`aplp-wiki`) has no version on purpose and survives
  a bump; the precache and same-origin runtime cache do not, on purpose.
- `manifest.json` names shortcuts, screenshots and a `share_target` (Path 1
  P4). Every tool page links it (`<link rel="manifest" href="../manifest.json">`
  after the viewport meta) — keep that on a new tool. The share target is a
  POST that `sw.js` answers itself (there is no server), parking the shared
  file in the `aplp-share` cache for Class Roster Hub to collect; the two
  halves are covered by `test:sw-tiers` and `test:roster-hub`. Regenerate the
  screenshots with `node Tools/board-check/make-manifest-screenshots.mjs` after
  a visible redesign.
- URL-encode spaces in precache paths (`%20`), matching the existing entries.
- **Three more read-only sweeps run in CI (Path 2 P4)** and should run before
  a commit that touches a page: `npm run check:entities` (an HTML entity in a
  JS string that reaches a text sink — `textContent`, a placeholder, `alert`,
  a same-file helper that writes `textContent`; use the character itself),
  `npm run check:hidden-flex` (an element toggled with `hidden` whose own class
  sets `display`, on a page with no `[hidden]{display:none!important}` rule —
  add that rule to the page's `<style>`; `DEBUG_HIDDEN_FLEX=1` shows every
  toggle it resolves), and `npm run check:print-clip` (a fixed `height` /
  `max-height` plus `overflow:hidden` inside `@media print` — size print boxes
  with `min-height` and let overflow be visible). Each is a floor: it reports
  only what it can see statically, and everything it prints is real.
- **`npm run lint`** (ESLint, Path 2 P5) covers `_shared/*.js`, the per-tool
  modules, `sw.js`, the tooling and every suite — not inline `<script>` in the
  tool pages. Rules that matter: `no-undef`, `no-unused-vars`, `eqeqeq`. A new
  `_shared/` global is declared once in `eslint.config.js`'s `SITE_GLOBALS`; a
  tool-private page global a suite reads inside `page.evaluate()` is declared
  at the top of that suite with `/* global name -- why */`. It runs in CI.
- **`npm run check:precache` enforces this.** It fails if a live page's
  `src`/`href`, or a local file `manifest.json` names, is missing from
  `PRECACHE_URLS`, or if a listed URL is dead or duplicated. It runs in CI.
  The `CACHE_VERSION` bump is checked only on request, because it needs a
  base to compare against: `npm run check:precache -- --base origin/main`
  fails if any precached file (or the list itself) changed since the
  merge-base of that ref and HEAD without `CACHE_VERSION` changing too. The
  merge-base is what keeps it from crying wolf on a branch that bumped two
  commits ago; a ref git cannot resolve is an error, not a pass. CI runs it
  in the pull-request job only (full history, known base branch). Without
  `--base` the bump is not checked and the guard says so.

## New tools link shared boilerplate — don't inline it

Every new tool must reference the shared files instead of pasting its own
copy of the boilerplate:

- `<link rel="stylesheet" href="../_shared/ink-paper.css">` — the site palette
  and, since Path 5 P1, its `[data-theme="dark"]` counterpart. Don't invent a
  new `:root` palette, and don't hardcode `#fff` where `var(--card)` is meant:
  a literal is what stops a tool adopting dark. (`_shared/theme.css` is the
  older Industry-design-system palette, used by five tools only; new tools use
  ink-paper.)
- `_shared/a11y.css` + `_shared/a11y.js` — shared accessibility baseline, and
  the **only** owner of theme on this site. a11y.js writes `data-theme` on
  `<html>` from `gvb-a11y-prefs` and syncs across tabs; never write that
  attribute yourself and never add a second theme key. A page with real dark
  colours sets `window.A11Y_NATIVE_THEME = true` in an inline `<script>` before
  the a11y.js tag, which switches it from a11y.css's CSS-filter invert to its
  own palette; a page that hasn't done the token work leaves the flag off and
  keeps the filter. `Tools/theme/test/smoke-theme.mjs` fails the build if a
  page ends up with both, or opts in with no palette to show.
  (`_shared/theme-toggle.js`, a second toggle on its own `gvb-tools-theme`
  key, was deleted in Path 5 P1 — its key is still migrated once by a11y.js.
  Read `_shared/ink-paper.css`'s header before touching any of this.)
- `<script src="../_shared/sw-register.js" defer></script>` — service-worker
  registration. It exists and is precached; link it rather than inlining
  its body, which is exactly:

  ```js
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('../sw.js').catch(function () {});
    });
  }
  ```

Remember: every shared file a new tool references must already be in
`PRECACHE_URLS` (the `_shared/` files above are), and the new tool's own
files must be added there too.

## Test tooling

- The repo has a root `package.json` for **dev-only** test dependencies
  (currently just Playwright). This was a deliberate tradeoff, decided in
  Round 1c: the alternative was a documented global install
  (`npm i -g playwright`), which keeps the repo npm-free but pins nothing —
  every machine drifts to whatever version it happens to have, and a fresh
  clone gets a MODULE_NOT_FOUND stack instead of instructions. A committed
  lockfile gives reproducible versions, and `npm ci` is one line. The site
  itself is unaffected: there is still no build step, nothing is served from
  `node_modules` (it's gitignored), and **`node_modules` and `package.json`
  must never appear in `sw.js` `PRECACHE_URLS`.** Keep `dependencies` empty
  forever — anything a tool ships must be vendored in `_shared/vendor/`.
- One-time setup: `npm ci && npx playwright install chromium`. Then
  `npm test` runs every suite, or `npm run test:<name>` individually.
- **`npm test` is `Tools/board-check/run-suites.mjs`, reading its ordered suite
  list from `Tools/board-check/suites.json`** — not an `&&`-joined string any
  more. It runs every suite even after one fails and names all the failures at
  once; the old chain stopped at the first, which meant the assertion that has
  been red since 2026-08-11 (position 95 of 120) hid the last 25 suites from
  every run. Adding a suite means adding it to `suites.json` **and** giving it a
  `test:<name>` shortcut — `npm run check:tests` fails if either is missing, or
  if a suite exists on disk that the list forgets. `--only <tool>` runs one
  tool's suites; `--changed` runs the suites covering your working-tree diff.
- A known-red assertion goes in `suites.json`'s `expectedFailures` with its exact
  text and a reason — **never** by loosening the assertion. The runner prints
  every expected failure on every run, still goes red if the same suite fails a
  *second* way, and goes red if an expected failure starts passing, so the entry
  cannot outlive the bug.
- **A suite that fails sometimes is a measurement problem before it is a fix.**
  `node Tools/board-check/run-suites.mjs --repeat N [--only <tool>]` runs the
  selection N times back to back and names every suite whose outcome differed
  between passes, with the assertion. Then decide by kind:
  - A *property assertion over randomised tool behaviour* (every pair shares a
    group at least once; the spread stays under a bound) fails at some real
    rate. Measure that rate against the parameters read off the *running page*
    (the pairing-history flake was misdiagnosed once by simulating the wrong
    group shape), then **raise the budget** (rounds, draws, samples) until the
    property is deterministic in practice. Never loosen the assertion — that
    deletes the test. Don't seed `Math.random` in a page-driven suite either:
    it turns a property test into a single-path test. Pure-logic suites that
    take an rng as a parameter (name-picker's) may and do seed.
  - A *crash* (exit 1, no FAIL line — the runner now prints the suite's last
    stderr lines under its name) or a *timing race* is a harness or tool bug to
    root-cause; a re-run is not a diagnosis. The 2026-09-02 `ECONNRESET` crash
    was the harness's keep-alive socket race, fixed in `harness.mjs`.
  - A *fixture built around the real clock* (a bell schedule as HH:MM offsets
    from "now") is deterministic given the time of day and fails only in a
    window nobody tests in — both command-center suites failed after 23:20
    local, when a `+40 min` end time wraps past midnight. `--repeat` cannot
    find this one; run the suite under a `TZ` that puts local time in the
    window (`TZ=UTC` at 23:41 reproduced both). Fix it by pinning the page's
    clock (`page.clock.setFixedTime`) and deriving every fixture time from that
    same instant, never by widening the offsets.
  - When the failing property is one a *teacher* would notice — "new code
    word" handing back the same word 1 time in 28 — the fix is in the tool,
    with a `CACHE_VERSION` bump, not in the test.
- **Environment notes that have cost sessions time.** Suites bind fixed
  localhost ports, so never run two copies of a suite at once — a collision
  reports failures that are not real; if a suite exits 1 with no FAIL line,
  check for a leftover `node`/`chrome` process before believing it. If
  `npx playwright install chromium` can't reach its download host, run browser
  suites with `PW_CHROMIUM_EXECUTABLE=<path to a chrome binary>`; that browser
  may be older than the pinned Playwright's, and that difference has caught real
  bugs both ways, so CI is the authority. (The Claude Code web sandbox is one
  such machine: `/opt/pw-browsers/chromium` is present but not the build the
  pinned Playwright wants, and `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` makes
  `playwright install` a no-op — `PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium`
  is the fix there.) A full `npm test` is ~20 minutes; run it in the background.
- **`npm run test:a11y` is the site-wide axe-core sweep (Path 2 P3):**
  `Tools/a11y-sweep/test/smoke-a11y-sweep.mjs` opens index and all 86 tool
  pages and fails on any serious/critical violation that
  `Tools/a11y-sweep/allowlist.json` does not allow for that page, and fails
  again when an allowed rule stops firing (so the list only shrinks). The
  allowlist was written by `--baseline` on 2026-09-03: 59 pages, 91 page-rule
  pairs, mostly unlabeled `<select>`s and inputs and muted-text contrast. A new
  tool must come in clean — do not add it to the allowlist; when you fix an
  allowed violation in a tool, delete its line. `harness.mjs` exports
  `a11yScan(page, {impact})` for a per-tool suite that wants to scan a state
  behind a click. `--only 046` scans one page; `--all-impacts` also prints
  moderate/minor as advisory.
- **`npm run test:theme` guards the one theme mechanism (Path 5 P1).**
  `Tools/theme/test/smoke-theme.mjs` sweeps every live page statically for the
  combination Path 5 calls out — a page painting a real dark palette while
  a11y.js is also inverting it — checks that the dark blocks in
  `_shared/ink-paper.css` and `_shared/theme.css` still carry their
  `:not(.a11y-filter-dark)` gate, and then drives two pages: 001, which has
  adopted native dark, and 003, which has not and must still get the filter
  with its light values untouched. Run it after touching anything under
  `_shared/` that has a colour in it, and after adopting a tool.
- `Tools/board-check/harness.mjs` is the shared browser-test harness
  (static server, Playwright launch, offsite-request blocking, `a11yScan`). It was
  written from scratch in Round 1c — the original board-check folder was
  never committed to this repo (verified with `git log --all`). Its exports
  are shaped to match the existing suites' call sites; don't change its
  signatures without running all three consumers.
- Test suites: schedule, seating-chart (a pure-logic suite and a browser
  suite), name-picker, image-to-pdf. Run them when touching those tools.
  `final-grade-checker` has no `test/` folder, despite older notes claiming
  otherwise. **The one known-red assertion was fixed on 2026-09-03** (Path 14
  P1): `drive-seating.mjs`'s "the chart is within one swipe of the top" had
  failed since 2026-08-11 because the toolbar's ~25 controls wrapped to 460px
  at 375px and pushed the chart 1132px down. The fix was in the tool (the
  phone toolbar folds its desk-building and printing groups behind a More
  button; `CACHE_VERSION` v136), the assertion was not touched, and
  `suites.json`'s `expectedFailures` is empty again. Keep it that way.

## The backlog — start and end every phase here

- **`BACKLOG.md` is the entry point.** Read `CLAUDE.md` first and that second,
  before the section you are about to work. Its header carries the current
  state, what to start and any live blocker; Tier 1 is the ranked index of every
  open item; Tier 2 carries each idea in full. `HISTORY.md` is what already
  shipped and what past phases got wrong — read it for the detail behind a
  claim, and add to it when you ship. There is no other planning file, and there
  should not be one: the last time planning sprawled it reached ~130 files and
  the same work appeared in four of them with different ranks.
- **Claim your row in `BACKLOG.md` before you write any code**, in the Claimed
  column, pushed by itself — that table is the concurrency mechanism two
  parallel sessions use to avoid collision, and it has already failed once when
  it was skipped. See "How to work this list".
- **A phase is not done until you have rewritten `BACKLOG.md`'s header and
  re-ranked,** after your PR is merged and the merge is confirmed — not before,
  so it records what landed rather than what you hoped would. Mark your item
  shipped with its `CACHE_VERSION`, refresh the numbers, say what the next
  session should start and anything you found or got wrong, delete the rows that
  shipped and renumber so ranks stay a contiguous 1..N. Add the `HISTORY.md`
  entry in the same commit, and merge that too.
- **Write down what did not work.** The most valuable line in any of these
  documents has consistently been the one recording a tool that was never
  committed, a number that was 3× too high, or a check that would have passed on
  a broken page. State what you did not verify, too. A handoff that only lists
  wins hands the next session your mistakes instead of your knowledge.
- **Do not let a handoff cite something the repo does not contain.** This has
  happened three times (`sync-social-tags.mjs`, the original `board-check`
  folder, `list-dark-candidates.mjs` — the last one with its output quoted as
  fact). If you name a command, run it once before you write it down.

## Other guardrails

- Social/OG meta blocks in tool HTML (marked `gvb:social:start`) claim to be
  generated by `Tools/board-check/sync-social-tags.mjs`, but **that generator
  was never committed to this repo** (verified with `git log --all` in Round
  1c) — the blocks are hand-maintained until it is rebuilt from a real spec.
  They have already drifted into two generations (an older greyversusblue.com
  branding with a guild-board og:image, a newer AsPerMyLessonPlan.com branding
  with no image) plus one hybrid; 41 tools have no block at all.
  `node Tools/board-check/check-social.mjs` (read-only, rewrites nothing)
  validates internal consistency and prints the drift — run it before and
  after touching any head section. Rebuilding the generator means first
  deciding which branding/image policy is correct; don't guess it into
  ~114 files.
- `_shared/base.css` holds layout rules that were duplicated byte-identically
  across tools (`.card`, `.app-header`, `.toolbar`); `_shared/print-area.css`
  holds the `#printArea` screen/print pair. **base.css is safe for any tool;
  print-area.css is not** — it blanks the page on print and restores only
  `#printArea`, so linking it from a tool without that element, or one that
  has its own `@media print` block, breaks printing. Both files' headers spell
  this out. `npm run phase4:next` (read-only) lists which tools still have
  duplicated rules and flags the ones that must not get print-area.css.
- The site-wide platform themes **P1–P15** are a section of `BACKLOG.md`, and
  the per-tool sections cite them by ID. Do not renumber one; the IDs are
  load-bearing. Add a new theme at the end.
- Nothing leaves the browser: no analytics, no uploads, no external form
  posts. localStorage (or IndexedDB for big blobs) is the persistence layer.
