I'm Devon Moore, a 7th grade Social Studies teacher. I run the East Middle Staff
Toolkit (GitHub Pages, AsPerMyLessonPlan.com) — ~81 single-file HTML classroom
tools. No server, no accounts, no build step, nothing leaves the browser, and
everything must keep working offline once the site has been visited.

Your job this session: work down the ranked enhancement backlog and actually
build the top items.

## Read first, in this order

1. `CLAUDE.md` — repo conventions. Authoritative; if anything below conflicts
   with it, it wins.
2. `IDEAS_BACKLOG.md`, the "Existing Tools — Enhancement Ideas" table. Rank 1
   is the highest priority. Ranks are contiguous 1..N with no gaps or ties, so
   "the top" is well defined no matter how many previous sessions have run.
3. `improvement prompts/_platform-themes.md` — the site-wide themes P1–P15.
   Read-only reference; never edit it.
4. For each tool you touch: `improvement prompts/<nnn>-<slug>.md` — that tool's
   history, what already shipped, and what was deliberately deferred.

If the ranked table is empty, tell me — don't invent work.

## Pick a batch

Take rows from the top of the ranked table. Aim for roughly 6–10, but stop
earlier if they turn out to be large. Finishing five properly beats half-doing
ten. If a row turns out to be already shipped, impossible within the static-only
constraint, or simply a bad idea once you're in the code, skip it, say so, and
move to the next one.

## Build each one

Follow `CLAUDE.md`. The rules that bite hardest:

- Link the `_shared/` boilerplate (theme, a11y, sw-register, base.css) instead
  of inlining a copy.
- Vendored libraries come from `_shared/vendor/<name>/` — one canonical copy
  site-wide. Never a per-tool copy, never a CDN.
- A nested vendor folder inside a tool's subfolder is `lib/`, never `libs/`.
- **Any file added, renamed, moved, or deleted means updating `PRECACHE_URLS`
  in `sw.js` and bumping `CACHE_VERSION` — both, in the same commit.** A stale
  list silently breaks offline use.
- `_shared/print-area.css` is only safe for tools that use an `#printArea`
  element and have no conflicting `@media print` block of their own.
- When you change a localStorage schema, migrate the existing data. Don't
  orphan a teacher's year of records.

## Verify before moving on

- `npm run check:dedupe` must exit 0. Never commit over a red check.
- A headless smoke test of the actual feature you built, with no console errors.
- If the tool has a `test/` folder under `Tools/<tool>/`, run it.
- Playwright setup: `npm ci`, then `npx playwright install chromium`. If that
  download is blocked, launch with `executablePath` pointed at the chromium
  already under `/opt/pw-browsers/`.
- Known-red and not yours: one assertion in
  `Tools/seating-chart/test/drive-seating.mjs` ("within one swipe of the top")
  fails for real. It's the mobile-toolbar bug, tracked as the "Phone-Sized
  Layout Pass" platform row. Fix it only if you're taking that row — never
  loosen the test.

## Bookkeeping for every row you ship

1. Delete its row from `IDEAS_BACKLOG.md` **and** `ideas-backlog.html`.
2. Renumber the remaining rows so ranks are contiguous from 1 again, in both
   files, kept in sync with each other.
3. Update that tool's `improvement prompts/<nnn>-*.md`: add a dated Status entry
   saying what shipped, what was hard, and where the next round should pick up,
   and refresh its "What it does today" section.
4. No `index.html` or `README.md` changes — these are enhancements to tools
   already listed there, not new tools.

If you notice something during the work that deserves to be on the backlog,
add it at whatever rank it merits and renumber accordingly.

## Commits and scope

Commit each row (or each tool) separately, with a message that explains the
change, and push to this session's branch.

**Do not open a pull request and do not merge.** I'll tell you when I'm ready to
move on. Keep working on this branch until then.

Assume you're the only session working this repo, so skip the 🔒 CLAIMED tagging
in the backlog and the claim protocol in `improvement prompts/_tools-touched.md`
— both exist for parallel sessions and both require pushing to `main` before
implementing, which doesn't fit this workflow. If I tell you another chat is
running at the same time, follow those protocols instead.

## When you stop

Tell me: which rows shipped, which you skipped and why, what the top of the
backlog looks like now, and anything you added to it.
