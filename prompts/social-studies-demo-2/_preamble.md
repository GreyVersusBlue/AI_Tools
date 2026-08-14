# Social Studies Demo Round 2 — shared rules for all 8 sessions

You are one of up to 8 parallel Claude Code sessions running round 2 of
Devon's social studies upgrades, ahead of a live presentation to teachers.
Round 1 shipped each tool's ranked backlog idea plus share links, sample
data, and first test suites (PRs #133–#140, all merged). Round 2 pushes each
tool toward its bigger ideas. Each session owns exactly one tool; your own
prompt file names your tool and scope.

Read the repo root `CLAUDE.md` first — it is authoritative for all
conventions. Then read `improvement prompts/<NNN>-<your tool>.md`; its
**Status** section, top-down, is the source of truth for what already
shipped (round 1's entries are at the top).

This is a **Devon-assigned round** — all 8 tools are in `_tools-touched.md`
"Already done", and that's expected; the direct assignment overrides the
"don't repick done tools" rotation rule.

## Setup

- If `node_modules` is missing, run `npm ci`. Playwright's Chromium is
  cached machine-wide; run `npx playwright install chromium` only if a test
  launch fails.
- Branch: `claude/ssdemo2-<nnn>-<code>` where `<nnn>` is your tool number
  and `<code>` is a random 5–6 char lowercase suffix you generate. The
  suffix is your session code everywhere below.

## Claim before you build

1. Append one row to the **Currently claimed** table in
   `improvement prompts/_tools-touched.md` (replace the `*(none)*` row if
   it is the only one there):
   `| <Tool Name> | \`<code>\` | <output of date -u +"%Y-%m-%d %H:%M UTC"> | \`<branch>\` |`
2. Commit that change **alone** and push it to main so concurrent sessions
   see it: `git push origin HEAD:main`. If rejected, `git pull --rebase
   origin main` and retry until it lands. No implementation code before the
   claim is on origin/main.

## Finish bookkeeping (goes in your branch / PR)

- Remove your claim row (restore `| *(none)* | | | |` if the table would be
  empty).
- Log the round in **Already done** under:
  `### Devon-assigned round 2 — tool <NNN> — <UTC timestamp> — session <code>`
- Update your tool's `improvement prompts/<NNN>-*.md`: dated Status entry
  (what shipped, what was hard, where round 3 should pick up) and refresh
  "What it does today".
- Do **not** edit `IDEAS_BACKLOG.md` / `ideas-backlog.html` — round 2
  features are new work, not backlog rows, and parallel edits to the ranked
  table cannot merge. If you think something belongs on the backlog, say so
  in your Status entry instead.

## Files you may and may not touch

Safe (yours alone): your tool's `Tools/<NNN>-*.html`, its `Tools/<slug>/`
subfolder, its `improvement prompts/<NNN>-*.md`.

Hot files — concurrent sessions edit these; keep edits minimal and additive:

- `sw.js` — any file you add/rename/delete goes in `PRECACHE_URLS` adjacent
  to your tool's existing entries (URL-encode spaces as `%20`) and bump
  `CACHE_VERSION` (`const CACHE_VERSION = 'vNN'`, ~line 27; v113 as this
  round begins), both in the same commit. Merge conflict: union of all
  precache entries, highest version, bump once more. Never touch
  `CDN_ALLOWLIST`; never precache `node_modules` or `package.json`. Test
  files are NOT precached — match how existing `test/` folders are handled.
- `package.json` — append or extend your `test:<name>` script and append
  new suites to the **end** of the long `test` chain. Union on conflict.
- `Tools/009-backup-restore.html` — register every NEW localStorage key in
  `KNOWN_GROUPS` / `STUDENT_KEYS`. Additive lines only.
- `index.html` (only your tool's card `.pitch` / `data-tags`, only if the
  one-liner changed), `README.md` (only your tool's row),
  `improvement prompts/_tools-touched.md` (claim + round log as above).

Never edit: `IDEAS_BACKLOG.md` / `ideas-backlog.html`,
`improvement prompts/_platform-themes.md` (read-only), anything under
`_shared/` (copy patterns locally, note the extraction opportunity in your
Status entry), other tools' files (reading them for patterns and data is
encouraged; writing is not).

Cross-tool discoveries go in `improvement prompts/_site-requests.md` as one
new appended `##` section at the end.

## The differentiation spec (for tools whose prompt includes it)

Devon teaches three levels and this must feel like one coherent feature
across tools, so implement it exactly like this:

- A **Level** selector with three options, named exactly: `Academic`,
  `Honors`, `Honors GT`. Default `Honors` (the baseline — today's output,
  unchanged).
- `Academic` adjusts the **printed output** toward more support: sentence
  starters on open questions, key vocabulary glossed in plain language,
  longer prompts chunked into steps. Same content, more scaffolding — never
  a dumbed-down version, and never fewer or lower-level questions.
- `Honors GT` adjusts toward extension: open-ended prompts, a
  synthesis/so-what question, less pre-structured space.
- A **"Print all three levels"** option that produces the three class sets
  in one go, each page footer-tagged with its level so a teacher can sort
  the piles.
- The level affects print output (and answer keys where relevant), not the
  teacher's editing UI. Store the selection with the document. Scaffolding
  text is generated from the teacher's own content where possible, and
  honest generic support where not.

## Ground rules

- Nothing leaves the browser: no CDN, no analytics, no uploads. localStorage
  or IndexedDB for big blobs. Migrate any storage schema you change; never
  orphan saved teacher work.
- `_shared/print-area.css` blanks the page on print and restores only
  `#printArea`. Only for tools already using it; never add a competing
  `@media print` block. Never use fixed `height` + `overflow: hidden` on
  print sheets (it silently clips); use `min-height`.
- Vendored libraries only from `_shared/vendor/` via relative `<script src>`.
  Nested vendor folders are `lib/`, never `libs/`.
- Sample/demo content: real, teacher-credible, legible to a general teacher
  audience, age-appropriate for 7th grade. Warm plain language, no em dashes
  in user-facing copy, no AI-speak.

## Verification (required)

- `npm run check:dedupe` green before every commit.
- `npm run check:social` before/after touching any `<head>`; don't fix
  pre-existing drift, don't add new, don't add a social block where none
  exists.
- Your tool's existing suites green **before you start** (baseline) and
  after every feature. New/extended smoke tests green, built on
  `Tools/board-check/harness.mjs` like the existing suites.
- Drive the shipped headline feature in headless Chromium: zero console
  errors, zero offsite network requests.
- Do NOT run the full `npm test` chain as a gate. One seating-chart
  assertion (`Tools/seating-chart/test/drive-seating.mjs`, "within one
  swipe of the top") is known-red repo-wide; it is not yours; never fix or
  loosen it.

## Scope discipline

Headline first and complete, then supporting items in listed order; cut from
the bottom; never ship half a headline. If the headline proves impossible as
scoped, say so and ship the listed demo cut instead.

## When you are done: PR, then merge it yourself

`gh` is at `C:\Program Files\GitHub CLI\gh.exe` (not on PATH — call by full
path, or fall back to the GitHub REST API).

1. Push your branch and open a PR. Title:
   `SS demo round 2: <tool name> — <headline feature>`. Body: what shipped,
   what was cut, verification results, ending with:
   `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
2. **Sync before merging** (other round-2 sessions may have merged while
   you worked): `git fetch origin && git merge origin/main` on your branch.
   Resolve conflicts by the union rules above (sw.js: union entries,
   highest version, bump once more; package.json: union scripts and chain;
   `_tools-touched.md`: keep all round sections, claim table keeps only
   still-active claims). Re-run `npm run check:dedupe` and your tool's
   suites after any conflict resolution, and push the branch again.
3. Merge the PR with a merge commit (not squash), e.g.
   `& "C:\Program Files\GitHub CLI\gh.exe" pr merge <number> --merge --delete-branch`.
4. Verify: `git checkout main && git pull`, `npm run check:dedupe`, and your
   tool's suite green on main. If main is broken, fix forward immediately —
   do not leave main red.

Your final message should summarize shipped items vs. scope, anything cut,
the PR URL, and confirmation that it merged and main is green.
