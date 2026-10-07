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
- **`npm run check:registry` guards `_shared/tool-registry.js`** — the one record
  of what every tool saves, which 009 Backup & Restore and 010 Command Center now
  read instead of keeping their own lists. It resolves every localStorage call
  site in the tree back to a literal key or prefix and fails on one the registry
  does not declare, so a new tool's keys cannot go missing from backups the way
  four tools' already had. A new tool needs a row: `slug`, `title`, `file` and
  `category` (all four come from its `index.html` row), plus its `keys` and
  `prefixes`. Mark a key `student: true` if it holds student data — that is
  judged **per key, not per tool**, and it is what the year-end rollover deletes.
  `--json` prints the extraction, which is how a row gets seeded; `--tool 019`
  narrows it. It runs in CI.
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
- **`npm run check:inline-sinks` is a ratchet on markup sinks in the pages that
  take link input** (added 2026-09-23). ESLint does not see inline `<script>`, and a
  share link (`share.js`, `state-link.js`, `handoffs.js`) is the first input on this
  site that the person at the keyboard did not type. For every page that references one
  of those files, the check counts the dynamic `innerHTML`/`outerHTML`/`srcdoc`
  assignments and the `insertAdjacentHTML`/`document.write` calls in inline script,
  and compares each count with `Tools/board-check/inline-sinks-baseline.json`. It fails
  when a count goes up, and when a page starts taking link input without a baseline line.
  It also fails when a count goes down, so lower the number in the same commit. Before
  you add or raise a line, read that page's sinks with `--list <tool>` and escape or
  sanitize what reaches them (#250's 066 `sanitizeRich()` is the example). It runs in CI.
- **`npm run check:docs-commands` guards the claims the docs make about
  commands.** It fails when a tracked `.md` writes `npm run <name>` for a script
  `package.json` does not define, or `node <path>` for a file that is not in the
  tree. This exists because three tools have now been documented in this repo
  that were never committed — `sync-social-tags.mjs`, the original `board-check`
  folder, and `list-dark-candidates.mjs`, whose invented output became a
  handoff's rollout plan. (`list-dark-candidates.mjs` was built for real on
  2026-09-05 and is `npm run path5:next`; its `KNOWN_MISSING` entry expired
  with it, exactly as intended, and the list is empty again. The other two are
  still missing.) Placeholders (`npm run test:<name>`) are skipped. A
  document whose *subject* is that a command is absent has two ways to say so: a
  named entry in the script's `KNOWN_MISSING`, with its reason, for a name
  several documents cite (the guard then fails if that script ever appears, so
  the exemption cannot outlive the gap); or, for a whole passage — a
  post-mortem quoting commands that are gone — a muted region, opened by an
  HTML comment reading `docs-commands: off — reason` alone on its line and
  closed by one reading `docs-commands: on`. A marker only counts when it is
  alone on its line, which is why this sentence can name it. The reason is
  required, every region is printed on every run, and a region left open to
  end-of-file fails. Bare backticked file paths are deliberately **not**
  checked — most are written without their
  directory prefix, and a guard that guesses is worse than none. It runs in CI.
- **`npm run check:adoption` measures the shared-file adoption row** of
  `BACKLOG.md`'s header, which was the last number in that table with no script
  behind it and had been re-derived by a different hand grep every session — on
  2026-09-04 that counted a *comment* as a reference and a gitignored build
  output as two adopters. It walks the 86 tool pages' real `src`/`href` and
  `import` references (files from `git ls-files`, so nothing untracked is in
  scope), follows per-tool modules, and prints the row as pasteable Markdown;
  `--file roster.js` names the adopters, `--check` fails if the header
  disagrees. It runs in CI **without** `--check`, because the header is
  legitimately stale between a merge and the step-6 rewrite — run `--check`
  yourself when you write that header. Direct and indirect are reported
  separately (`1 (+1 via a module)`); the plain number is the direct count the
  header has always carried.
- **`npm run check:art` guards the Path 21 art ledger** (added 2026-09-25).
  Blender runs only on Devon's machines, his Windows box and (since 2026-09-29) huginn;
  a row that needs the full feature set on a GPU says "Windows machine only"
  (`Tools/blender-art/README.md` has the pin, 5.2 LTS, and the command lines), so CI never
  re-renders anything. What it
  checks is that `Tools/blender-art/renders.json` matches the tree: every output
  present, under its byte cap, with the ledger's SHA-256 and dimensions, made by the
  pinned LTS line; family totals and the 2 MB / 250 KB-shell budget; an on-screen
  raster has a dark twin; an SVG icon is `currentColor` with no fill or literal
  colour; contrast under declared text holds 4.5:1; no art file under `assets/art/`
  or `Tools/*/art/` is missing from the ledger; and an `<img>` of an art file has
  the right `alt`. A new render gets its spec written into the ledger first; the
  scene script fills in the record. Since Path 21 P2 it also checks that the icon
  sprite (`assets/art/icons/tools.svg`, a *derived* entry with `sources` and no
  seed or Blender of its own) is exactly what `node Tools/blender-art/build-sprite.mjs`
  assembles, and lists every icon; that an icon's stroke is at least 1.5 px at the
  landing page's 32 px; and that a `use: "manifest"` PNG (the shortcut icons) is
  named by `manifest.json`. Since #306 it also checks the PWA app mark (`assets/icons/`, family
  `appmark`): a maskable PNG with any non-background pixel outside the 40% safe circle fails
  **SAFE**. Since Path 21 P3 (the landing hero) an `<img>` of an entry that declares a
  `density` must carry its 1x `width`/`height`, its `srcset` must name same-theme entries at
  the right sizes, and a page showing one theme's picture must show its twin (**IMG**).
  `check:precache` reads `srcset` too, since the hero's 2x files are named nowhere else.
  Since Path 21 P4 (080's pieces) a `use: "sheet"` entry, art drawn only on a
  `.paper-sheet`, is light-only with no twin; `underText` may be a list of named regions; and an entry
  declaring `grey` pairs must record each pair's greyscale contrast at its `minRatio` (**GREY**).
  **Add a tool icon, then re-run `build-sprite.mjs`.** The
  offline zip inlines the sprite into its landing page, because Chrome draws nothing
  for an external `<use>` under `file://`. Its test is `npm run test:blender-art`. Keep art
  out of any folder named `test/`: `make-offline-copy.mjs` drops every such path
  from the offline zip, which is why the P1 test tile is not in it. It runs in CI.
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
  registration, the update bar, the deferred precache pass, and (since v180) the
  request for persistent storage. It exists and is precached; link it rather than
  inlining it. Its core was once exactly:

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
  tool's suites; `--changed` runs the suites covering your working-tree diff
  and commits since `origin/main` (`--base <ref>` picks another base).
- **CI runs `--changed` on pull requests and the full list on a push to
  `main`** (`.github/workflows/ci.yml`, since 2026-09-05). The full pass is
  ~21 minutes and was the measured bottleneck of every PR while most PRs touch
  one or two tools; the push-to-main run is the safety net that catches
  anything the selector under-selected before the site deploys. Which suites
  cover which files is decided by `Tools/board-check/select-suites.mjs`, four
  rules its header spells out: `_shared/`, `sw.js`, `index.html`,
  `manifest.json`, `package*.json`, `Tools/board-check/` and `.github/` run
  everything; a `Tools/<folder>/` edit runs that folder's suites **and** the
  suites that open any page importing from that folder; a page edit runs the
  suites that name it; and any page edit also runs the sweeps that list the
  pages themselves (a11y, theme, picker rollout, registry shape). **Rule 1 has
  one exemption, and it is read off the hunk rather than the filename: a
  `sw.js` diff whose only changed lines are the `CACHE_VERSION` assignment is
  not site-wide** — it runs the `service-worker` suites, which are the ones a
  version bump exercises, and lets the rest of the PR decide the selection.
  Every tool PR bumps that line, so before this landed the scoped job never
  fired on one. Anything else in `sw.js` (a precache URL, a comment, the fetch
  handler) is site-wide as before, and so is a `sw.js` change whose diff the
  runner cannot produce — not knowing what changed has to select more, never
  less. The step prints every touched file and the reason for every selected
  suite.
  `Tools/board-check/test/select-suites.test.mjs` (`npm run test:select-suites`,
  pure Node) pins each rule against the real tree, including what must *not*
  be selected. **Anyone touching the diffing in `run-suites.mjs` or the rules
  in `select-suites.mjs` keeps both callers working** — a session's bare
  `--changed` against `origin/main`, and CI's `--base origin/<base branch>` —
  and adds the case to that test. The guards are not scoped: all eleven
  together take about twelve seconds, so there is nothing to save.
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
  (static server, Playwright launch, offsite-request blocking, `a11yScan`, and
  `downloadText`, which a suite calls to read a file the page downloads instead of patching
  `URL.createObjectURL` itself). It was
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

- **The standing instruction is "work the next batch of ranked items in `BACKLOG.md`, open
  a PR, merge to `main`."** It runs unattended; Devon is not reviewing these rounds
  (2026-09-05). **Size the batch by the Size column, never by a count**: up to 4
  quarter-session rows (they may share one PR), 2–3 half-session rows, one 1-session row,
  or a single 2+ row on its own. A 2+ row will not finish in one session — do one
  increment, ship it, and leave the row in place with its text rewritten to say what is
  done. Never mix a 2+ row into a batch with others. `BACKLOG.md`'s "How big a batch" has
  the table and the reasoning. So, also: **never stop to ask.** If a row needs a judgement call, take the
  default from `BACKLOG.md`'s "Standing decisions" if one is written, and otherwise decide
  it yourself, ship it, and record the call and its reasoning in `HISTORY.md` so it can be
  reversed cheaply. An "open question for Devon" note left in a Tier 2 section from an
  earlier era means *decide it and write down what you decided*. The two things that are
  still not a session's call: promoting anything **student-facing**, and **re-ranking the
  list** wholesale. Read `BACKLOG.md`'s "How this repo is worked" for the rest.
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
- **The `BACKLOG.md` header is a current-state summary, capped at ~80 lines.** The story
  of an increment goes in `HISTORY.md`. The header grew to ~1,900 lines of handoffs before
  it was cut on 2026-09-23, and its numbers table carried each figure's history in the
  cell. Replace a number; don't append "before it…" to it.
- **A phase is not done until you have rewritten `BACKLOG.md`'s header and
  re-ranked,** after your PR is merged and the merge is confirmed — not before,
  so it records what landed rather than what you hoped would. **This happens after
  *each* merge, never saved for the end of a batch** — it is the rule most likely to be
  dropped as batches grow, and the one with a recorded failure behind it: a session
  working two phases meant to write both handoffs at the end, its first PR merged with
  its row still in the table, and the next session spent an hour building what already
  existed. Mark your item
  shipped with its `CACHE_VERSION`, refresh the numbers, say what the next
  session should start and anything you found or got wrong, delete the rows that
  shipped and renumber so ranks stay a contiguous 1..N. Add the `HISTORY.md`
  entry in the same commit, and merge that too.
- **End every session by writing the next session's prompt** (Devon, 2026-09-29). After your
  PR and its step-6 follow-up are both merged, write a self-contained prompt for the next
  session: the row and why, what to read first, the traps you hit, the machine setup, and the
  instruction that it too ends with a PR, a merge and a prompt of its own. Put it in your final
  message and in the step-6 PR's body. `BACKLOG.md`'s "Definition of done" step 7 has the rest.
- **Write down what did not work.** The most valuable line in any of these
  documents has consistently been the one recording a tool that was never
  committed, a number that was 3× too high, or a check that would have passed on
  a broken page. State what you did not verify, too. A handoff that only lists
  wins hands the next session your mistakes instead of your knowledge.
- **Do not let a handoff cite something the repo does not contain.** This has
  happened three times (`sync-social-tags.mjs`, the original `board-check`
  folder, `list-dark-candidates.mjs` — the last one with its output quoted as
  fact; it exists now, but the numbers that handoff quoted were still
  invented). If you name a command, run it once before you write it down.

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
  across tools (`.card`, `.app-header`, `.toolbar`, the header title/subtitle/back link, `.card h2`,
  and since AI-08 `.share-note` on `ink-paper.css`'s info/err tints); `_shared/print-area.css`
  holds the `#printArea` screen/print pair. **base.css is safe for any tool;
  print-area.css is not** — it blanks the page on print and restores only
  `#printArea`, so linking it from a tool without that element, or one that
  has its own `@media print` block, breaks printing. Since v229 it also takes everything but
  `#printArea` out of the flow, so `#printArea` must be a direct child of `<body>`. Both files' headers spell
  this out. `npm run phase4:next` (read-only) lists which tools still have
  duplicated rules and flags the ones that must not get print-area.css.
  `_shared/print-kit.css` + `print-kit.js` (Path 7 P1, v221) are the shared print layouts and
  the `PrintKit` helper: `pk-` classes for sheets, half and quarter sheets, card grids and
  ink-safe output, and one/class-set/blank rendering from a template. Unlike print-area.css the
  kit is opt-in by class and safe to link anywhere; a new printing tool uses it instead of
  writing another `@media print` block. It sizes with `min-height` and never clips. 076 and 070 (half sheets, `renderSet` with `cut: true`), 077
  (a card grid: `PrintKit.renderCards` with a preset), 043 (a class set with the footer), 023 (half and quarter sheets), 042 (a fixed-size certificate: `setPage()`, `.pk-page` and `.pk-paper` only), 074 (labels with a height of their own: `PrintKit.renderCards(..., { cols }, ...)`, which 077 also calls, with a preset name), 051 (the same, with a reference sheet after the grid and a QR canvas on each label, so its sheet is kept current and not drawn on `beforeprint`) and 040 (exact-size cards on a grid of its own, `{ cols, perPage }`, with the tool's page frame put round each grid after `renderCards()`, and the preview drawn by the same call) and 064 (an exact-size trading card that keeps its own `height` and clipping; fronts and mirrored backs in one `renderCards()` call, each card the shared renderer's string parsed in a `<template>`) and 018 (six print buttons as six areas inside one `#printArea`, the shown one `.active`; cards a share of the width and as tall as their content; the station sheet, which has QR canvases, kept current for Ctrl+P) and 017 (five print buttons the same way, with no area `.active` at rest: `#printArea:not(.sheet-asked)` shows the QR codes for Ctrl+P; packets as `.pk-page`s) and 016 (three sheets as areas chosen by the tab that is showing; label stock as `{ cols, perPage }` with exact labels and `setPage({ margin: 'top side' })`, two lengths, since v242) print through it, each with `print-area.css` to hide the editor and, since v233, `class="pk-paper"` on `#printArea` for a white sheet and black text from either theme; `BACKLOG.md`'s Path 7 P3 has the recipe the next one follows. Its suites
  are `npm run test:print-kit`; nothing in it has been checked on paper.
  Since v258 the kit has the print preview, `PrintKit.preview({ trigger, onPrint })` (Path 7 P5): a modal dialog
  showing the built sheet in `#printArea` one page at a time, at the page `setPage()` wrote, without calling
  `print()`. It finds the breaks by copying the sheet into an iframe whose body is a multi-column box the size
  of the printable page, with the page's own print rules applied there (`flipMedia`), so the page itself is
  never changed. Do not write a second preview and do not measure breaks by height (that was tried and
  miscounts). 074 was the first adopter (`npm run test:safety-label-preview`, which pins the dialog itself); since v259 076, 077,
  051, 042, 064 and 043 have it too, and since v263 070, 023, 040, 018, 017 and 016: every page that prints through the kit.
  The next adopter adds a "Preview pages" button in front of its print button,
  renders its sheet, calls `preview()`, and gets an entry in `Tools/print-kit/test/smoke-preview-adopters.mjs`'s `TOOLS`
  (`npm run test:preview-adopters`), which holds the preview's count to Chromium's PDF in every state. A page with
  several print buttons gets a Preview button in front of each (043; `BACKLOG.md`, Path 7 P5, "Point 4"). A page that
  keeps several sheets inside one `#printArea` shows the asked-for one before `preview()` and passes `onClose` to put
  the at-rest one back (018 is the example: the Preview button presses its Print button with `previewFor` set, so the
  refusals and the sheet cannot differ). A Print button builds its sheet and prints; Ctrl+P presses none, so a page
  whose `#printArea` is filled only by buttons builds its main sheet on `beforeprint` unless a button just built one
  (043 and 040; not a sheet with a canvas on it, which is kept current, as on 051).
  `_shared/export.js` (Path 7 P4, v243) is `ExportKit`, the export layer: booklet, N-up and duplex imposition for
  either edge the paper turns on, sheet geometry, flow pagination, and `toPdf(pages, opts)` on the vendored jsPDF
  for pages a tool draws (a canvas, an image, a draw function; not a DOM element). A tool that needs a card's back
  behind its front, a booklet's page order or a PDF's page breaks calls it and does not write the arithmetic again.
  Since v244 it also has the file helpers: `toCsv` (which puts an apostrophe before a typed cell a spreadsheet would
  run as a formula), `toXlsx` and `toZip` on the vendored SheetJS and JSZip, `download` and `filename`. A tool that
  saves a table or a zip calls these and does not write another `csvCell()` or anchor click. 064's Download PDF is
  the first adopter (`npm run test:trading-card-pdf`) and 040's double-sided cards the second (`npm run
  test:vocab-imposition`, v245, when `_shared/duplex-print.js` was deleted) and 011's booklet and pages-per-sheet
  layouts the third (`npm run test:image-to-pdf-impose`, v248: a tool records each page as drawing steps and hands
  the pages to `toPdf` with `impose`; `compress: true` and, for a two-sided N-up, `flip` came with it). Since v249
  003, 008, 018, 033, 068 and 075 save their CSV through `toCsv` and `download` (`npm run test:csv-adopters`; a new
  one gets a row in `Tools/export/test/_csv-adopters.mjs`, hands a computed number over as a number so the guard
  leaves it alone, and, if it imports its own file, takes the apostrophe off as 075's `unguardCsv()` does). Since v252
  060 does too, and 001, 006, 030 and 036 save their files through `toCsv` and `toXlsx` (`npm run test:sheet-adopters`;
  a workbook adopter gets an entry in `Tools/export/test/_sheet-adopters.mjs`, keeps its own lazy load of SheetJS and
  passes `{ name, rows, widths }`). Since v255 035's groups template does too, the last: no page writes its own CSV.
  Its suites are `npm run test:export`; no booklet has been printed or folded, and no file opened in a spreadsheet.
  `npm run path7:next` (`Tools/board-check/audit-print.mjs`, Path 7 P2, read-only, a browser
  sweep of about 12 minutes on port 8464, not in CI) is the runtime half of `check:print-clip`:
  it opens every tool in print media, empty and seeded, before and after its print buttons, in
  light and dark, and reports clipped and fixed boxes, scroll boxes, controls on paper, blocks a
  page break may split, dark ink on paper and (TAIL, since v227) blank pages after the sheet. TAIL
  is what `body * { visibility: hidden }` leaves: the hidden editor keeps its height. A new print
  block takes the screen UI out with `display: none` (`npm run test:print-tail` reads Chromium's PDF for
  the fifteen pages fixed in v228 and those that print through `print-area.css`, fixed there in v229 (twenty then, 076, 070, 051, 064, 018, 017 and 016 since); a page fixed later joins its table), and a page with dark tokens of its own puts
  them back in print itself (`npm run test:theme` checks 004, 009 and 010). It reaches a sheet through saved state
  (`Tools/a11y-sweep/seeds.mjs`, which the a11y sweep's seeded pass reads too), through a tab whose
  label says "print", which it opens itself, and through `Tools/board-check/print-audit-prep.mjs` for
  what neither reaches (a student to pick, text that is never saved); a tool whose sheet needs data
  gets a seed, and a prep entry only if the seed is not enough. Its closing lists are work too:
  "Blank sheets" is a print button that left the paper empty (061 did, until v225), and "Print
  buttons that never printed" is a sheet nothing reaches yet. Run `--only <tool>` after touching a tool's print
  CSS, and lower `print-audit-baseline.json` in the commit that fixes a page. A fixed height with
  `overflow: hidden` in a *screen* rule that also styles the printed sheet is the same bug as the
  one inside `@media print`, and only this finds it (077).
  `npm run path5:next` (`Tools/board-check/list-dark-candidates.mjs`, also
  read-only) is the same kind of picker for Path 5: the pages still on
  a11y.css's invert filter, the colour literals each would have to tokenize
  (counted outside `@media print` and outside inline script, which is what
  made an earlier hand-derived figure about 3× too high), which pages load no
  `a11y.js` at all, and whether each still hand-rolls fullscreen instead of
  linking `_shared/stage.js`.
- **Questions live in one bank, `_shared/question-bank.js`** (`QuestionBank`, Path 12 P1, v265): the key
  `gvb-question-bank`, a versioned list of `{ id, prompt, answer, choices?, media?, unit, standard, difficulty,
  tags, points }`, with 030 as the page a teacher edits it on and, so far, its only reader. A tool that needs
  questions reads `QuestionBank.list()` and does not keep a bank of its own; one that brings questions in calls
  `importQuestions()`, which adds and updates and never deletes. A field the module does not know is kept, so
  add one without changing the version. Since v267 a tool's **built-in** questions are a read-only *seed set*:
  its data file (`Tools/cultural-trivia-card-generator/ctcg-bank.js`, `Tools/geography-bee-quiz-generator/gbq-bank.js`)
  holds the one copy of the list, the tool reads `items()` from it, and it calls `QuestionBank.registerSet()` on a
  page that has the module. A set is in memory only, its ids are `seed:<set>:<the tool's id>`, and nothing stores
  a seed id: a copy into the bank is a new question with `copiedFrom`. The next tool with built-in questions does
  the same and does not load the module itself (`npm run test:seed-sets`; `BACKLOG.md`, Path 12 P2).
  Since v271 040 is the second page with the module, and the model for **a page that reads the bank and is not its
  editor**: it reads with `QuestionBank.peek()`, which writes nothing (`list()` moves 030's old bank on first load),
  lists what a teacher can choose from with `sources({ peek: true })` and `sourceLabel()` (030's chooser calls the same
  two; do not write a third wording), and stores only through `importQuestions()` after showing what it would do.
  Its mapping is `Tools/vocab-flashcard-generator/vfg-bank.js`; the next tool that turns its own records into
  questions gives them ids made from its own stable names, as that file does, so sending twice adds nothing
  (`npm run test:vocab-bank`, `npm run test:vocab-bank-logic`).
  Since v269 a tool **sends** a teacher's questions to the bank by link: an entry in `_shared/handoffs.js` whose
  transform returns `{ v, from, name, questions }`, opened by 030 at `?questions=` (053 is the one sender).
  `QuestionBank.fromLink()` is the only reader of that link and takes no id from it, and 030 stores an arrival
  only when the teacher presses Add; a new sender follows 053's entry, `maxLink` included
  (`npm run test:received-questions`).
  Since v276 030's bank tab edits everything a question holds (`Tools/review-game-board/rgb-bank-editor.js`): the
  right choice is the one whose text is the answer, so marking one writes the answer and no field was added; a Save
  from a form sends only the fields the form shows, with the id, so the rest of the question stays; and **a file is
  shown before it is stored** (`importPlan()`, the bank's own `merge()` over a copy), which the next import route
  does too (`npm run test:bank-editor`, `npm run test:bank-editor-core`).
  Since v278 020 is the third page with the module, and the model for **a tool that plays from the bank and keeps
  no question**: its academic-tournament mode (`Tools/bracket-tournament-generator/bt-academic.js`) reads with
  `peek()` and never writes the bank, stores question **ids** on its own record (a seed, the settings, ids and marks in
  one `academic` field of the bracket), reads the words from the source each time, and cleans that field when it
  arrives by link. It decides a match by filling the page's own score boxes, so it added no second rule. A bracket
  without the field is unchanged (`npm run test:bracket-academic`, `npm run test:bracket-academic-core`).
  Since v281 030 has its first two **play modes** (Path 12 P3; `Tools/review-game-board/rgb-play.js`): every-team-answers,
  an opt-in field on a board (`everyTeam`, and `marks` on a clue scored in it; a board without them is the one-team
  game, held by 32 hashes in `Tools/review-game-board/test/_old-game.mjs`), and the printed practice quiz with its key
  and the study guide, from a board or the bank tab's list, built from elements. Since v284 it has the final wager round
  and quiz-bowl too: one field each on the board (`final`, `quizBowl`, the quiz-bowl log holding question ids), the
  bank read with `peek()` and never written, both played on one overlay (`#roundOverlay`) and each with its own
  take-back button. Since v285 it has spin-the-wheel, the last of the modes: one `wheel` field, and **the
  spin is never chance at play time** (it is worked out from a seed stored on the board and the spin's number, and saved
  before the picture turns; do not call `Math.random` for a spin). A later mode is opt-in the same way, adds its fields only once used, and runs
  `_old-game.mjs`, `_every-team-game.mjs` and `_rounds-game.mjs` unchanged (`npm run test:play-rounds` holds the second, `npm run test:play-wheel` the third). **030
  does not print through the print kit**: its sheets go into its own `#printArea`, the new ones with `printing-sheet`
  on `<body>` so the screen is out of the flow (`npm run test:play-modes`, `npm run test:play-modes-core`).
  030's old key (`gvb-review-board-bank:entries`) is read on every load
  and never written or removed: do not delete it or its registry line, which is what keeps an older page and an
  older backup working. The module's header has the migration, the ids and the file formats. Its suites are
  `npm run test:question-bank` (pure Node) and `smoke-bank-file.mjs` in `npm run test:review-board`; no file it
  writes has been opened in a spreadsheet.
- **A WebRTC pairing code is drawn with `QrDraw.fit(canvas, text)`** (`_shared/qr-draw.js`,
  AI-10, v223), which takes the size from the room the canvas's parent has, draws whole px per
  module and never under 4, and puts a note on the page when there is not room. Do not write
  another renderer, do not give a pairing canvas a `max-width` in px, and show its wrapper
  *before* drawing: a hidden parent measures 0. The text comes from `_shared/webrtc-pair.js`,
  whose compact code (`o…`/`a…`) is lossless by its own check and falls back to the full SDP.
  `npm run test:pairing-qr` measures every pairing on a board and a phone; a new one gets a
  line in its `PAIRINGS`. No real phone has scanned one (`BACKLOG.md`, parked check 4).
- The site-wide platform themes **P1–P15** are a section of `BACKLOG.md`, and
  the per-tool sections cite them by ID. Do not renumber one; the IDs are
  load-bearing. Add a new theme at the end.
- Nothing leaves the browser: no analytics, no uploads, no external form
  posts. localStorage (or IndexedDB for big blobs) is the persistence layer.
