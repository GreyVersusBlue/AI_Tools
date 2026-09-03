# Handoff — Stage 2, after Wave A1

*Written 2026-09-03 after PR #167. This is a **delta**, not a replacement:
`HANDOFF_STAGE_2.md` is still the Stage 2 plan and is still ~95% correct. Read
`CLAUDE.md` first, `HANDOFF_STAGE_2.md` second, this third, then the path
section you are about to work.*

*If you are here to run **A2** (the accessibility label round) or **B1**
(`store.js`), nothing below blocks you — skim §5 and §6 and go. Everything else
here is for whoever touches theme again.*

## 1. Where Stage 2 stands

One of the fourteen phases is done.

| Wave | Phase | Status |
|---|---|---|
| A1 | Path 5 P1 — theme architecture | **Shipped**, #167, `CACHE_VERSION` v139 |
| A2 | Accessibility label round | Open. Unblocked, unclaimed, Sonnet. |
| A3 | Live-site checks | Open. Devon only. Now also covers #167. |
| B1 | Path 4 P1 — `_shared/store.js` | Open. Fable. **Nothing blocks it.** |
| B2–B4, C1–C6, D | — | Open, order unchanged |

Numbers as of main `0db1de8`: `CACHE_VERSION` v139, 249 precache entries (77 in
the install tier), **125 suites** green in ~20 min, `expectedFailures` empty, 91
accessibility allowances on 59 pages, lint clean, 86 tools, next free number 087.

Nothing about A1 touched the Wave B/C dependency graph. **B1 is still the
critical path** and is the thing to start if you have a Fable session.

## 2. What A1 actually changed

`_shared/a11y.js` owns theme, site-wide — sole reader/writer of theme state,
sole setter of `data-theme` on `<html>`. Dark arrives one of two ways and never
both: **native** (the page sets `window.A11Y_NATIVE_THEME = true` and ships real
colours) or the **filter** (a11y.css inverts it). `_shared/ink-paper.css` now
carries a real `[data-theme="dark"]` palette for the 74 tools on that palette,
gated on `:not(.a11y-filter-dark)`.

**The gate is the load-bearing part.** Without it, shipping a dark palette would
have re-coloured all 74 ink-paper tools *and* left the filter inverting them on
the same load. With it, #167 changed nothing for the 73 tools that have not
adopted. If you ever find yourself removing that `:not()` to "simplify", the
theme suite will stop you; believe it.

The decision is written in `_shared/ink-paper.css`'s header. That is the file to
read before touching any of this — not this handoff, and not `UPGRADE_PATHS.md`.

## 3. What A1 found that the Stage 2 plan did not anticipate

This is the part worth your time.

### 3.1 P3 is a real rollout, and it is now sized

`HANDOFF_STAGE_2.md` files Path 5 P3 under "rollouts … all Sonnet/Opus batch
work", implying a flag flip. It is not. A tool that sets the flag with white
still hardcoded in its own `<style>` gets **pale ink on white cards** — worse
than the filter it replaced.

`npm run path5:next` (new, `Tools/board-check/list-dark-candidates.mjs`, sibling
of `phase4:next`) prints the ranked backlog. Today:

```
73 unadopted, 1 adopted. 907 literals left, 2-32 per tool, median 10.
56 have an #printArea.
```

`npm run path5:next -- --batch 8` prints the lightest N as a ready batch. The
distribution is friendly — 34 tools are under 10 literals and mostly need the
same four substitutions 001 needed — so **batches of 8–10 of the lightest first**
is the right shape, not the plan's "batches of ~6" by projector-relevance. Save
`021`, `025`, `015`, `046` (28–32 each) for their own PR.

Every number that tool prints is a **floor**: it counts white and near-white
only. Light *tints* (`#eee`, `#e4f5ea`) are extra and need a light/dark pair
each, the way 001's four status tints did.

> **Correction to the record.** #167's own commit message, and this file's
> ancestors, said "17–45 occurrences each". That count included `white-space`,
> `@media print` blocks and inline script, and was about 3× too high. The three
> places it landed have been fixed and now cite `npm run path5:next` rather than
> a frozen number. If you see "17–45" anywhere, it is stale.

### 3.2 Chrome vs. paper is the distinction every adopter has to make

Some literals are chrome that should follow the theme. Some are a **sheet of
paper** — a print preview, a hall pass, a certificate — that must stay white
with dark ink in dark mode. `ink-paper.css` ships `.paper-sheet` for the second
kind, applied automatically to `#printArea` (56 of the unadopted tools have
one), with `.paper-sheet-off` to opt back out.

Adoption order, and it matters: **tokens → mark the paper → set the flag.**
`Tools/001-hall-pass-log.html` is the worked example; copy it.

### 3.3 Status tints were deliberately left tool-local — P3 decides

001 defines `--err-bg` / `--info-bg` / `--warn-bg` / `--good-bg` and their
border and ink companions in both themes, **in the tool**, not in the shared
file. `_shared/theme.css` has a matching set for the Industry tools, so
promoting them to `ink-paper.css` is probably right — but on a sample of one it
would have been a guess.

**Concrete instruction for P3:** after the first batch of ~8, count how many of
them wanted the same four pairs. If it is most of them, promote the tokens to
`ink-paper.css` in a phase of its own and delete the tool-local copies. If tools
disagree on the tints, leave them local and say so. Do not promote them on the
first tool that asks.

### 3.4 `035-schedule-visualizer.html` is a third theme owner

It does not load `a11y.js` at all and runs its own four-palette `data-theme`
system (`dark`, `green-gold`, `green-gold-dark`). It is **not** double-darkened,
so it is not a bug today — but the site now has two answers to "who sets
`data-theme`", and 035 also *generates* 034, which the repo has already caught
diverging once.

`Tools/theme/test/smoke-theme.mjs` asserts that no page which *does* load
a11y.js writes the attribute itself, so this cannot spread while 035 is
undecided. Deciding it belongs in **Path 5 P4**, which already owns 034/035.

### 3.5 Two things the spec assumed that the tree had already done

- **`theme.css`'s "fold" was not a migration.** All five of its consumers
  already set `A11Y_NATIVE_THEME`. What was actually missing was the *gate* on
  its dark rules — so a sixth page could have linked it, forgotten the flag, and
  been inverted on top of a real palette. That gate is now there.
- **`theme-toggle.js` was not loaded by zero files.** Zero *live* pages, yes —
  but five archived `Tools/New Designs/` prototypes loaded it. It was deleted
  outright (it is in git history) and those five lost the dangling tag.

### 3.6 A light-mode contrast gap, recorded and not fixed

Dark's `--line-strong` clears the 3:1 that WCAG 1.4.11 asks of a control border
(3.00 on card). **Light's does not (1.82).** Raising light's is a restyle of 74
shipped pages and belongs in its own phase — it is not an a11y-round fix and it
is not something to slip into a rollout batch. Note that the axe sweep will not
catch it: `color-contrast` is a text rule.

### 3.7 `gvb-a11y-prefs.theme` can now be `'auto'`

Theme has three stored states, not two. `'auto'` — the default when nothing is
stored — follows `prefers-color-scheme` live and **writes nothing**. `'light'`
and `'dark'` are explicit and stick. Existing users deliberately do not move:
pre-Path-5 prefs always named a literal theme.

**Anything that reads `gvb-a11y-prefs` must expect `'auto'`.** That is a live
concern for **B2** (the tool registry, which describes keys) and **C1** (the
share sheet, if it ever carries prefs). `a11y.js` exports nothing, so read the
value through it, not around it.

## 4. Decisions Devon still owes

`HANDOFF_STAGE_2.md` §4 minus the one A1 answered, plus one new:

| Needed by | Decision | Recommendation |
|---|---|---|
| ~~A1~~ | ~~Who owns theme~~ | **Answered: `a11y.js`. Shipped.** |
| B1 | May a quota error ever be silent? | Never. Visible, names the tool, points at Backup & Restore. |
| B3 | Staff rosters: same namespace or a `Staff —` prefix? | Prefix. Do not fork the store. |
| B3 | Do skill/level values go on the shared student record? | **No.** Keep tool-local. |
| C1 | Link payload policy for images. | Strip by policy, say so in the sheet, offer `.json`. |
| Path 5 P4 | What to do about 035's private theme system: adopt a11y.js, or bless it as an exception and document it? | Bless and document, unless P4 is already opening 035 for other reasons. Adopting it is a re-skin of a 5,500-line tool. |
| Path 8 | Is a paired *student* device ever in scope? | No. |
| Any time | Should CI also run `offline:build` + `offline:verify` on `main`? | Yes, `main` only. |

## 5. New machinery a phase must know about

- **`npm run test:theme`** — `Tools/theme/test/smoke-theme.mjs`, **port 8405**,
  47 assertions. Static sweep of all live pages for a page carrying a native
  palette and the invert filter at once; a check that `ink-paper.css` and
  `theme.css` still carry their gate; then 001 (adopted) and 003 (not adopted)
  driven in a browser. Runs in `npm test` and therefore in CI. **Run it after
  touching anything under `_shared/` that has a colour in it.** New suites after
  this one should take a port above 8405.
- **`npm run path5:next`** — the rollout backlog, described in §3.1. Read-only,
  never fails.
- **`.paper-sheet` / `.paper-sheet-off`** — §3.2.
- **`--card-2` and `--accent-ink`** — the two tokens added to `ink-paper.css`.
  `--accent-ink` is text drawn *on* a saturated fill (an accent button, an
  `--err` chip): white in light, near-black in dark, because the fill inverts
  and a literal `#fff` cannot stay. If you write `color: #fff` on a filled
  element in a new tool, you have made that tool un-adoptable.
- **Claiming a platform phase.** `improvement prompts/_tools-touched.md` is
  written for tool rounds. A `_shared/` phase claims a row for the shared area
  *and* a row per adopter tool, and its round entry says it is a path-assigned
  phase rather than a free pick. #167 is the precedent; copy that shape.

## 6. What A1 learned that the next phase should not relearn

Everything in `HANDOFF_STAGE_2.md` §6 still holds. Four to add:

- **Measure with a script, commit the script.** The "17–45 literals" figure came
  from a one-off `grep` that silently matched `white-space` and print blocks. A
  frozen wrong number in three files is worse than no number. If a phase quotes
  a count, ship the thing that produced it (`path5:next`) so the next session
  gets today's answer instead of last month's.
- **A new guard's first run is a finding, not a failure.** `smoke-theme.mjs`
  went red on its first execution, on `035-schedule-visualizer.html`. That was a
  *false positive* — 035 loads no `a11y.js`, so it cannot be double-darkened —
  and the right fix was to narrow the assertion and record 035 as a real
  architectural finding, not to "fix" 035. Look at the page before you believe
  the guard. (`HANDOFF_STAGE_2.md` §6 says the same about the sweep guards; it
  is true of new suites too.)
- **Mutation-test a new guard, both directions.** `smoke-theme.mjs` was checked
  by removing 001's flag (4 assertions went red) and by removing the gate from
  `ink-paper.css` (2 went red, one static and one in the browser). A guard you
  have not seen fail is not yet evidence.
- **Contrast is arithmetic — do the arithmetic.** Every value in the dark
  palette was chosen against a WCAG ratio computed in a scratch script, not by
  eye, and one (`--line-strong`) was tuned specifically to clear 3:1. Two of the
  pairs came in at 4.76 and 5.78, close enough to the 4.5 line that eyeballing
  would plausibly have shipped a failure. `index.html`'s palette comment sets
  this precedent; keep it.

## 7. Paste-ready prompts

`HANDOFF_STAGE_2.md` §7's three prompts are unchanged and still correct. Two
additions:

**Rollout batch (Path 5 P3 — Sonnet):**

```
Run git checkout main && git pull; export
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium. Read CLAUDE.md, the header of
_shared/ink-paper.css (the whole thing — it is the spec), and section 3 of
HANDOFF_STAGE_2_A1.md. Run `npm run path5:next -- --batch 8` and take that
batch. For each tool, in this order: swap chrome literals for tokens
(var(--card), var(--card-2), var(--accent-ink)), mark any print preview or
paper simulation .paper-sheet (skip if it is already #printArea), then add
window.A11Y_NATIVE_THEME = true before the a11y.js tag. Copy
Tools/001-hall-pass-log.html exactly; do not invent new tokens, and do not
touch _shared/. Any status tint you need gets a tool-local light/dark pair like
001's — then report how many of the batch needed the same four pairs, because
that is what decides whether they get promoted. Claim the batch in improvement
prompts/_tools-touched.md first. After each tool: npm run test:theme, its own
test:<name> if it has one, and test:a11y -- --only <nnn>. After the batch: every
guard, check:precache -- --base origin/main, one CACHE_VERSION bump, one PR.
```

**Phase that only touches `_shared/` colour (any wave):**

```
...as the build-to-spec prompt in HANDOFF_STAGE_2.md, plus: run npm run
test:theme before you commit. If it reports a page carrying both a native
palette and the invert filter, that is a real bug in that page, not a broken
test — read _shared/ink-paper.css's header before changing either.
```

## 8. Files to know (new or changed in #167)

- `_shared/ink-paper.css` — **the decision, in its header.** Read this first.
- `_shared/a11y.js` — theme owner; `'auto'` / `prefers-color-scheme`.
- `_shared/a11y.css` — the filter fallback, and now a print reset.
- `_shared/theme.css` — the five Industry tools, gated the same way.
- `_shared/theme-toggle.js` — **deleted.** In git history if you need it.
- `Tools/001-hall-pass-log.html` — the reference adopter. Copy it.
- `Tools/theme/test/smoke-theme.mjs` — `npm run test:theme`, port 8405.
- `Tools/board-check/list-dark-candidates.mjs` — `npm run path5:next`.
- `UPGRADE_PATHS.md` §5 — the full phase record, including what was *not*
  verified (nothing has been seen on a real projector or Chromebook, and no
  cross-tool screenshot pass was run — that belongs with P3).
