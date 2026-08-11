# CLAUDE.md — repo conventions

This is the East Middle Staff Toolkit (aspermylessonplan.com): a static GitHub
Pages PWA of small, self-contained classroom tools. No build step, no server,
no accounts — every tool runs entirely in the browser and must keep working
offline once the site has been visited. These conventions exist to stop
copy-paste drift across the ~114 tools; follow them for every new tool and
every edit. The deduplication work that established them is tracked in
`REFACTOR_PLAN.md`.

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
- Phases 1 and 1b of `REFACTOR_PLAN.md` have landed: **jsPDF (+ AutoTable),
  SheetJS (`xlsx`), jsQR, qrcode.js, and jszip.min.js now live only in
  `_shared/vendor/`.** Nothing vendored is left duplicated in a per-tool
  `lib/` folder. `_shared/vendor/qrcode/` is the QR *encoder*;
  `_shared/vendor/jsqr/` is the *decoder* — easy to confuse by name.
- When comparing two copies of a library to see whether they're really
  different builds, hash them with line endings normalized (`tr -d '\r'`).
  Raw file sizes differ by CRLF alone and will fool you.

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
- URL-encode spaces in precache paths (`%20`), matching the existing entries.

## New tools link shared boilerplate — don't inline it

Every new tool must reference the shared files instead of pasting its own
copy of the boilerplate:

- `<link rel="stylesheet" href="../_shared/theme.css">` — the site palette /
  dark-mode tokens. Don't invent a new `:root` palette.
- `_shared/theme-toggle.js` — the theme toggle (persists to
  `gvb-tools-theme`, syncs across tabs). Copy the integration pattern from a
  tool that already uses it.
- `_shared/a11y.css` + `_shared/a11y.js` — shared accessibility baseline.
- `<script src="../_shared/sw-register.js" defer></script>` — service-worker
  registration. This file is created in Phase 2 of `REFACTOR_PLAN.md`; if it
  doesn't exist yet, create it (and precache it) containing exactly:

  ```js
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('../sw.js').catch(function () {});
    });
  }
  ```

  rather than inlining that snippet in the tool's HTML.

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
  `npm test` runs all five suites, or `npm run test:<name>` individually.
- `Tools/board-check/harness.mjs` is the shared browser-test harness
  (static server, Playwright launch, offsite-request blocking). It was
  written from scratch in Round 1c — the original board-check folder was
  never committed to this repo (verified with `git log --all`). Its exports
  are shaped to match the existing suites' call sites; don't change its
  signatures without running all three consumers.
- Test suites: schedule, seating-chart (a pure-logic suite and a browser
  suite), name-picker, image-to-pdf. Run them when touching those tools.
  `final-grade-checker` has no `test/` folder, despite older notes claiming
  otherwise. **Known red as of 2026-08-11:** one assertion in
  `Tools/seating-chart/test/drive-seating.mjs` ("the chart is within one
  swipe of the top") fails for real — the toolbar has grown to ~15 controls
  with no mobile cap, so at 375px it wraps to ~380px tall and pushes the
  chart 1052px down. That's a tool bug to fix, not a test to loosen.

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
- `improvement prompts/_platform-themes.md` is read-only reference material;
  `improvement prompts/_tools-touched.md` explains how improvement-round
  sessions claim work. Follow both.
- Nothing leaves the browser: no analytics, no uploads, no external form
  posts. localStorage (or IndexedDB for big blobs) is the persistence layer.
