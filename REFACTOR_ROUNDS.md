# Refactor Rounds: model + prompt per session

Companion to REFACTOR_PLAN.md. Run rounds in order, one Claude Code session each.
Set the model with /model before pasting the prompt.

**One-time setup before Round 1:** the merge step needs the GitHub CLI.
Install it once (`winget install GitHub.cli`, restart the terminal, then
`gh auth login` — do the auth yourself, it opens a browser sign-in). If a
round finds gh missing or unauthenticated, it must push the branch, open the
PR, report the PR URL, and stop for you to merge manually on GitHub — never
push directly to main as a workaround.

**Workflow rule: every round ends by opening a PR and merging it to main.** The
next round always starts from an up-to-date main, so nothing runs in parallel —
every round touches sw.js CACHE_VERSION and REFACTOR_PLAN.md, and parallel
branches would conflict constantly. Every prompt below begins with a sync check
(stop if the previous round isn't merged) and ends with the merge.

If you'd rather personally review a given round's PR before it lands, delete the
final "merge it" sentence from that prompt and merge manually on GitHub — the
next round's sync check will simply wait for you. Worth considering for the
Sonnet batch rounds, since a merge to main deploys the live site immediately.

Why the models differ: Sonnet is fast and cheap and excellent at precisely
specified repetitive edits; Opus/Fable are for rounds that require judgment
(choosing library versions, deciding what's "close enough" to migrate, writing
conventions). Rounds are marked accordingly.

Standard closing for every round (already included in each prompt):

> When verification passes, commit on a new branch, push, open a PR, and merge
> it to main with a squash merge (gh pr merge --squash --delete-branch).
> Confirm the merge completed before ending.

---

## Round 0 — Conventions + generator prompts — ✅ DONE 2026-08-11

Phase 0 is checked off in REFACTOR_PLAN.md (CLAUDE.md created, all 14
prompts/*.md updated, improvement-round workflow pointed at CLAUDE.md).

## Round 1 — Vendored library consolidation (Model: Opus, 1 PR)

```
Run git checkout main && git pull. If REFACTOR_PLAN.md shows a phase marked
in-progress by another round, stop and say so. Then read REFACTOR_PLAN.md and
execute Phase 1. Consolidate the duplicate vendored libraries (xlsx, jspdf,
jsqr — locations and byte-size evidence are in the plan's audit table) into
_shared/vendor/, one canonical build each: compare version strings in the file
headers and prefer the newest. Update the <script src> paths in every affected
tool, and delete image-to-pdf's duplicate copy (it has both lib/ and libs/).
For any tool that was on an older build, open it in the browser and exercise
its export feature against the canonical build; if it breaks, keep its old
build locally and note why in the plan. Run the existing smoke tests under
Tools/*/test/ for schedule, image-to-pdf, final-grade-checker. Update sw.js
PRECACHE_URLS and bump CACHE_VERSION. Check off the Phase 1 boxes in
REFACTOR_PLAN.md. When verification passes, commit on a new branch, push, open
a PR, and merge it to main with a squash merge (gh pr merge --squash
--delete-branch). Confirm the merge completed before ending.
```

## Rounds 2a–2f — Service-worker registration extraction (Model: Sonnet, ~6 PRs)

~83 files at ~15 per round; repeat the same prompt until a round reports zero
files left.

```
Run git checkout main && git pull. Then read REFACTOR_PLAN.md and continue
Phase 2. If _shared/sw-register.js doesn't exist yet, create it containing
exactly the 5-line serviceWorker registration snippet found inline in the tools
(grep Tools/*.html for "serviceWorker" and confirm the snippet is byte-identical
across files first — set aside any file whose snippet differs and list it in
the plan instead of editing it). Then take the next 15 tools (alphabetical)
that still have the inline snippet, replace it with
<script src="../_shared/sw-register.js" defer></script>, and open each one in
the browser to confirm it loads with no console errors. Add the new file to
sw.js PRECACHE_URLS (first round only) and bump CACHE_VERSION. Note in
REFACTOR_PLAN.md how many files remain. When verification passes, commit on a
new branch, push, open a PR, and merge it to main with a squash merge
(gh pr merge --squash --delete-branch). Confirm the merge completed before
ending.
```

## Round 3-audit — Theme variance audit (Model: Opus or Fable, 1 PR, no tool edits)

```
Run git checkout main && git pull. Then read REFACTOR_PLAN.md and execute the
first Phase 3 checkbox only (the variance audit). Diff each tool's :root CSS
variable block against _shared/theme.css and bucket every tool into: (a)
identical → straight swap, (b) superset → link shared css + small local
override, (c) genuinely different palette → leave alone. Write the three bucket
lists (filenames) into REFACTOR_PLAN.md under Phase 3. Also record the
integration pattern the 16 existing _shared-using tools follow for
theme-toggle.js, as a spec for the migration rounds. No tool file edits this
round. Commit the updated plan on a new branch, push, open a PR, and merge it
to main with a squash merge (gh pr merge --squash --delete-branch). Confirm
the merge completed before ending.
```

## Rounds 3a–3x — Theme migration batches (Model: Sonnet, several PRs)

Repeat until buckets (a) and (b) in the plan are empty.

```
Run git checkout main && git pull. Then read REFACTOR_PLAN.md Phase 3,
including the bucket lists and the theme-toggle integration spec recorded
there. Migrate the next 12 tools from bucket (a), then bucket (b) when (a) is
empty: link ../_shared/theme.css (and theme-toggle.js per the spec), remove the
now-redundant inline :root block (for bucket (b), keep the tool-specific extra
variables in a small local override block). For every migrated tool: open it in
the browser, verify no console errors, toggle the theme both ways, and check
print preview still looks right. Bump sw.js CACHE_VERSION. Strike migrated
filenames from the bucket lists in the plan. When verification passes, commit
on a new branch, push, open a PR, and merge it to main with a squash merge
(gh pr merge --squash --delete-branch). Confirm the merge completed before
ending.
```

## Round 4-setup — Shared base.css (Model: Opus, 1 PR)

```
Run git checkout main && git pull. Then read REFACTOR_PLAN.md and start
Phase 4. Create _shared/base.css containing the verbatim-identical rules
duplicated across tools (.card, .app-header, .toolbar, and the #printArea
@media print block — verify each rule really is identical across files with
grep before including it; anything with variants stays out). Migrate the first
10 tools that contain all of these rules verbatim: link base.css, delete the
duplicated rules. For each: browser check, and print preview — print is the
risk area, teachers print these. Add base.css to sw.js PRECACHE_URLS, bump
CACHE_VERSION, record remaining candidate files in the plan under Phase 4.
When verification passes, commit on a new branch, push, open a PR, and merge
it to main with a squash merge (gh pr merge --squash --delete-branch). Confirm
the merge completed before ending.
```

## Rounds 4a–4x — base.css adoption batches (Model: Sonnet, several PRs)

```
Run git checkout main && git pull. Then read REFACTOR_PLAN.md Phase 4 and its
remaining-candidates list. Migrate the next 12 tools to _shared/base.css,
deleting only rules that are byte-identical to base.css — if a tool's version
of a rule differs at all, leave that rule inline and note the file in the plan.
Browser check and print preview every migrated tool. Bump sw.js CACHE_VERSION,
update the candidate list in the plan. When verification passes, commit on a
new branch, push, open a PR, and merge it to main with a squash merge
(gh pr merge --squash --delete-branch). Confirm the merge completed before
ending.
```

## Round 5 — JS utility extraction (Model: Fable or Opus, 1 PR, may conclude "skip")

```
Run git checkout main && git pull. Then read REFACTOR_PLAN.md and execute
Phase 5. Evaluate the three candidates (localStorage save/load wrapper, CSV
export, print-area show/hide) against the bar stated there: extract only where
10+ tools share near-identical code and extraction forces no behavior change.
It is an acceptable outcome to extract none of them — if so, document why in
the plan and close the phase. For anything you do extract: _shared/util.js,
migrate only the tools whose code matches near-identically, browser-test each
(save → reload → state persists, CSV export downloads, print works). Bump
CACHE_VERSION. When verification passes, commit on a new branch, push, open a
PR, and merge it to main with a squash merge (gh pr merge --squash
--delete-branch). Confirm the merge completed before ending.
```

## Round 6 — Sweep + regression guard (Model: Sonnet, 1 PR)

```
Run git checkout main && git pull. Then read REFACTOR_PLAN.md and execute
Phase 6. Re-run the duplication measurement (count of verbatim-identical long
lines across Tools/*.html, and any vendored library filenames outside
_shared/vendor/) and record before/after numbers in the plan. Write
Tools/board-check/check-dedupe.mjs that exits nonzero if a known vendored lib
filename (xlsx.full.min.js, jspdf.umd.min.js, jsqr.js) exists outside
_shared/vendor/, and wire a note into CLAUDE.md to run it before committing.
Commit on a new branch, push, open a PR, and merge it to main with a squash
merge (gh pr merge --squash --delete-branch). Confirm the merge completed
before ending.
```

---

Total: roughly 15–20 sessions/PRs, run strictly one at a time. After each merge,
GitHub Pages redeploys the live site — occasionally hard-refresh
aspermylessonplan.com so the new service worker takes over, and spot-check a
tool or two.
