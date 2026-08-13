# Social Studies Demo Round — shared rules for all 8 sessions

You are one of 8 parallel Claude Code sessions upgrading Devon's social studies
tools ahead of a live presentation to teachers (~10 days out). Each session owns
exactly one tool. This file is binding for every session in the round; your own
prompt file names your tool and scope. Read the repo root `CLAUDE.md` first —
it is authoritative for all conventions. Then read
`improvement prompts/<NNN>-<your tool>.md`; its **Status** section, top-down,
is the source of truth for what has already shipped (some older Quick Win
bullets below it are stale).

All 8 tools are in `_tools-touched.md` "Already done". That is fine: this is a
**Devon-assigned round**, which overrides the "don't repick done tools" rule.

## Setup

- You are in a git worktree of the repo. If `node_modules` is missing, run
  `npm ci`. Playwright's Chromium is cached machine-wide; run
  `npx playwright install chromium` only if a test launch fails.
- Create your branch as `claude/ssdemo-<nnn>-<code>` where `<nnn>` is your tool
  number and `<code>` is a random 5–6 char lowercase suffix you generate. The
  suffix is your session code everywhere below.

## Claim before you build

1. Append one row to the **Currently claimed** table in
   `improvement prompts/_tools-touched.md`:
   `| <Tool Name> | \`<code>\` | <output of date -u +"%Y-%m-%d %H:%M UTC"> | \`<branch>\` |`
2. Commit that change **alone** and push it to main so the other 7 sessions see
   it: `git push origin HEAD:main`. If rejected, `git pull --rebase origin main`
   and retry until it lands. Do not write implementation code before the claim
   is on origin/main.

## Finish bookkeeping (goes in your branch / PR, not pushed to main)

- Remove your claim row.
- Log the round in **Already done** under a header of the form:
  `### Devon-assigned round — tool <NNN> — <UTC timestamp> — session <code>`
  with a short list of what shipped.
- Update your tool's `improvement prompts/<NNN>-*.md`: dated Status entry (what
  shipped, what was hard, where the next round should pick up) and refresh its
  "What it does today" section. State explicitly which `IDEAS_BACKLOG.md` row
  (rank + idea name) your round shipped or found stale — Devon runs one
  bookkeeping pass over the backlog after all branches merge.

## Files you may and may not touch

Safe (yours alone): your tool's `Tools/<NNN>-*.html`, its `Tools/<slug>/`
subfolder, its `improvement prompts/<NNN>-*.md`.

Hot files — 8 sessions edit these concurrently; keep every edit minimal and
additive (single lines where possible):

- `sw.js` — any file you add/rename/delete goes in `PRECACHE_URLS`
  **adjacent to your tool's existing entries** (URL-encode spaces as `%20`),
  and bump `CACHE_VERSION` (`const CACHE_VERSION = 'vNN'`, ~line 27), both in
  the same commit. If you hit a merge conflict: take the **union** of all
  precache entries and the **highest** version number, then bump once more.
  Never touch `CDN_ALLOWLIST`. Never precache `node_modules` or `package.json`.
- `package.json` — append a `test:<name>` script and append your suite to the
  **end** of the long `test` chain. Union on conflict.
- `Tools/009-backup-restore.html` — if (and only if) you introduce a NEW
  localStorage key, register it in `KNOWN_GROUPS` / `STUDENT_KEYS` there.
  Additive lines only.
- `index.html` — only your tool's card, only its `.pitch` / `data-tags`, and
  only if your headline feature changes the one-liner. Do not touch stagger
  delays, Per numbers, or other rows.
- `README.md` — only your tool's row description.
- `improvement prompts/_tools-touched.md` — claim + round log as above.

Never edit:

- `IDEAS_BACKLOG.md` / `ideas-backlog.html` — 8 parallel renumberings of one
  ranked table cannot merge. Report; don't edit.
- `improvement prompts/_platform-themes.md` — read-only reference.
- Anything under `_shared/` — two sessions inventing overlapping shared code
  can't merge. Copy the pattern you need locally into your tool (the repo has
  precedent for this) and note the extraction opportunity in your Status entry.
- Other tools' files. Reading them for patterns is encouraged; writing is not.

Cross-tool discoveries go in `improvement prompts/_site-requests.md` as one new
appended `##` section at the end of the file.

## Ground rules

- Nothing leaves the browser: no CDN, no analytics, no uploads, no external
  form posts. localStorage, or IndexedDB for big blobs.
- `_shared/print-area.css` blanks the whole page on print and restores only
  `#printArea`. Only keep/use it in tools that already have that element, and
  never add a competing `@media print` block alongside it.
- If you change a saved-data schema, migrate existing saves. Never orphan a
  teacher's stored work.
- Vendored libraries only from `_shared/vendor/` via relative `<script src>`.
  Never add a per-tool library copy. Nested vendor folders are `lib/`, never
  `libs/`.

## Verification (required)

- `npm run check:dedupe` must exit 0 before every commit.
- If you touch anything in your tool's `<head>`, run `npm run check:social`
  before and after. Do not fix pre-existing drift; do not add new drift; do not
  add a social block to a tool that lacks one.
- Your tool's existing test suites green **before you start** (baseline) and
  after. Your new/extended smoke test green. Use the shared harness
  `Tools/board-check/harness.mjs` like the existing suites do.
- Drive the shipped headline feature in headless Chromium: zero console
  errors, zero offsite network requests.
- Do NOT run the full `npm test` chain as a gate. One seating-chart assertion
  (`Tools/seating-chart/test/drive-seating.mjs`, "within one swipe of the
  top") is known-red repo-wide. It is not yours; never fix or loosen it.

## Scope discipline

Ship the headline feature first and completely, then supporting items in the
listed order. If time runs short, cut supporting items from the bottom — never
ship half a headline. If the headline proves impossible as scoped, say so and
ship the listed demo cut instead.

## Content voice

Sample/demo content must be real and teacher-credible, and legible to a
general teacher audience (the presentation room is not all social studies
teachers). Warm, plain language. No em dashes in user-facing copy, no
corporate AI-speak, age-appropriate for 7th grade.

## When you are done

Commit per feature with messages that explain why. Push your branch, then open
a PR (do **not** merge it):

- `gh` is installed at `C:\Program Files\GitHub CLI\gh.exe` but not on PATH —
  call it by full path, or fall back to the GitHub REST API.
- Title: `SS demo round: <tool name> — <headline feature>`.
- Body: what shipped (headline + supporting), which backlog row it covers,
  what was cut, verification results. End the body with:
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

Your final message should summarize shipped items vs. your prompt's scope,
list anything cut, and give the PR URL.
