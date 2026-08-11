# Platform Plan: the four Platform-Wide Big Swings

Goal: implement the four "Platform-Wide — Big Swings" rows of `IDEAS_BACKLOG.md` —
Bulk CSV Roster Import Hub, Custom Theme / Branding Pass, Voice Command / Speech-to-Text
Input, and Printable "Cheat Sheet" Bundle Export — without breaking the live PWA
(offline precache), print layouts, or any existing tool's behavior. Everything stays
within static-hosting limits: no server, no accounts, no database, and (with one
explicitly disclosed exception in Track V) nothing leaves the browser.

Modeled on `REFACTOR_PLAN.md`: each phase is one or more small PRs, verification is
actually performed and recorded, and the sw.js / Backup & Restore bookkeeping happens in
the same commit as the change it covers.

Status key: [ ] not started · [~] in progress · [x] done

---

## Baseline (2026-08-11)

- 81 numbered tool pages directly under `Tools/`; next free tool number is **082**.
- `sw.js` at `CACHE_VERSION = 'v65'`. No `.md` files are precached (docs-only commits
  need no sw.js changes).
- Shared-file adoption: `_shared/sw-register.js` 81/81 · `_shared/a11y.js` +
  `_shared/a11y.css` 73/81 · `_shared/ink-paper.css` 67/81 · `_shared/base.css` 64/81 ·
  `_shared/print-area.css` 16 · `_shared/state-link.js` 6 · `_shared/theme.css` 5
  (the legacy Industry `_ds` palette tools: 005, 011, 029, 031, 036) ·
  `_shared/theme-toggle.js` 0 (superseded by a11y.js).
- Rosters: `np_rosters` (`{rosterName: string[]}`) is the shared source of truth, written
  by 006 + 007, read by 23 tools via ~20 copy-pasted `populateRosterSelect`-style
  functions; only 010 listens for cross-tab `storage` events. Sidecar `crh_students_v1`
  (ids, preferred names, pronunciation) is roster-hub-only today.
- Print: 74 tools call `window.print()`; 53 have `#printArea`; 50 index.html rows are
  tagged `printable`. Sub Binder (045) is the proven cross-tool bundling pattern:
  read other tools' localStorage → re-render paper-friendly HTML → `#printArea` →
  `window.print()`. No iframes anywhere in the repo.
- Speech: zero `SpeechRecognition` usage (greenfield); `speechSynthesis` in a11y.js
  read-aloud + 4 tools; mic/permission prior art in `_shared/qr-scan.js`.

## Build order and parallelization

Four tracks. Recommended landing order **R → B → P → V**, but R, B, and P are
deliberately independent and can run as parallel sessions from day one, claiming work per
`improvement prompts/_tools-touched.md`. The only shared touch points are `sw.js`
(`CACHE_VERSION` bumps are one line — merge conflicts resolve as "take max + 1") and
`Tools/009-backup-restore.html`'s registries (append-only edits). V starts once R1 lands
(voice feeds student names from `_shared/roster.js`).

| Track | Swing | Why this position |
|---|---|---|
| **R — Roster** | Bulk CSV Roster Import Hub | Highest payoff (23 consumer tools + 8 unwired), lowest novelty risk — extends proven code in 006. Its shared module is the only cross-swing dependency. |
| **B — Brand** | Custom Theme / Branding Pass | Smallest surface: one shared-file change reaches 73 tools via a11y.js with zero per-tool edits in v1. Fully independent. |
| **P — Packet** | Cheat Sheet Bundle Export | New standalone tool; touches no existing tool's behavior (read-only localStorage consumers, the 045 pattern). Independent. |
| **V — Voice** | Voice Command Input | Highest risk (privacy tradeoff, browser-support cliff, genuinely greenfield). Smallest v1 on purpose. Soft-depends on R1. |

---

## Phase 0 — Conventions (one small PR, shared by all tracks)

- [ ] **0.1** Document in `CLAUDE.md` the storage-key convention for all new platform
  keys, resolving `improvement prompts/_platform-themes.md` P8's drift *going forward*:
  **`gvb-<area>:<thing>.v1`** — the `gvb-<tool>:` prefix family is already the largest
  and most recent era in 009's `KNOWN_GROUPS`, and the trailing `.v1` matches
  `subPlanBuilder.standingDetails.v1`. Every JSON payload carries an internal `"v": 1`
  stamp so schema changes can migrate rather than destroy. **No renames of existing
  keys** — `np_rosters` and `crh_students_v1` stay exactly as they are (23 read-only
  consumers make a rename a site-wide breaking change for zero user value).
- [ ] **0.2** Document that new shared modules follow the established `_shared/` shape:
  ES5-style IIFE, one `window.<Name>` global (never an ES module — half the tools are
  classic scripts; see `state-link.js`'s header for the rationale), `try/catch` around
  every `localStorage` access, `storage`-event tab sync where state is shared, and a long
  "why" header comment recording rejected alternatives.

Verification: docs only — `npm run check:dedupe` still green; no sw.js change
(`CLAUDE.md` is not precached).

---

## Track R — Bulk CSV Roster Import Hub

New keys introduced by this track:

| Key | Shape | Registered in |
|---|---|---|
| `np_rosters` *(existing, unchanged)* | `{rosterName: string[]}` | already in 009 `KNOWN_GROUPS` + `STUDENT_KEYS` |
| `gvb-roster:meta.v1` *(new, R2)* | `{v:1, rosters:{[name]:{period?, source?:'csv'\|'xlsx'\|'manual', importedAt?}}}` | 009 `KNOWN_GROUPS` (Class Roster Hub group) + `STUDENT_KEYS`; 006 `TOOL_KEYS` |

### R1 — `_shared/roster.js` (one PR, no consumer-tool edits yet)

- [ ] Create `_shared/roster.js`, IIFE exposing `window.Roster`:

  ```js
  window.Roster = {
    listRosters: function () {},          // sorted keys of np_rosters; [] on parse failure
    getRoster: function (name) {},        // string[] copy, never a live reference
    setRoster: function (name, names) {}, // writes np_rosters + fires same-tab notify
    removeRoster: function (name) {},
    getStudentMeta: function () {},       // read-only view of crh_students_v1
    onChange: function (fn) {},           // returns unsubscribe; wraps BOTH the 'storage'
                                          // event (cross-tab) and a same-tab CustomEvent
                                          // (storage events don't fire in the writing tab)
    mountRosterPicker: function (selectEl, opts) {},
    // opts: { persistKey, emptyLabel, includeManualOption, onChange: fn(name, names) }
    // returns { refresh, getSelected, getNames, destroy }
    parseDelimited: function (text) {},   // CSV/TSV → rows; ported from 006
    flipLastFirst: function (s) {}        // ported from 006
  };
  ```

- [ ] Port `splitCells` / `parseTable` / `flipLastFirst` out of
  `Tools/006-class-roster-hub.html` into the module verbatim; 006 switches to calling
  `window.Roster.*` in the same PR (the source of truth becomes the first consumer,
  proving the port).
- [ ] Module header documents the write-contention contract: three writers exist after
  this (006, 007, roster.js) — all must read-modify-write the whole `np_rosters` object;
  last-writer-wins across tabs is the existing, accepted behavior.
- [ ] Bookkeeping: `PRECACHE_URLS` += `_shared/roster.js`; bump `CACHE_VERSION`.
- [ ] Verify: 006 single-roster import round-trips a pasted CSV identically pre/post
  (manual + ad-hoc Playwright via `Tools/board-check/harness.mjs`);
  `npm run test:name-picker` stays green (007 owns `np_rosters`); `npm run check:dedupe`.

### R2 — Bulk import + export in 006 (one PR, 006 + 009 only)

- [ ] **Bulk import UI**: a "Bulk import" entry alongside the existing `openImportModal`
  flow. Accepts multiple files (`<input type="file" multiple>` + drag-drop) in
  `.csv`/`.tsv`/`.txt`/`.xlsx`. XLSX via lazy-load of
  `_shared/vendor/xlsx/xlsx.full.min.js`, copying 036's `handleImportFile()`
  on-demand-script pattern exactly (never a static `<script>` tag — the file is ~881 KB).
- [ ] **Period-column splitting**: in the reused column-mapping dialog, a "Split into
  rosters by column" option — pick the Period/Class column and one file becomes N rosters
  named from its distinct values (editable name prefix, e.g. "Period {value}");
  sheet-per-roster for multi-sheet xlsx. Reuses `flipLastFirst` and the existing mapping
  UI; collisions get the same replace/merge choice the single-roster path already offers.
- [ ] **Export**: per-roster CSV download + "Export all rosters" single CSV with a
  `Period` column whose shape round-trips through the bulk importer (the file a teacher
  carries between machines and school years).
- [ ] Write `gvb-roster:meta.v1`; register it in 009 (`KNOWN_GROUPS`, `STUDENT_KEYS`) and
  006's `TOOL_KEYS` in the same PR. Bump `CACHE_VERSION` (006 + 009 content changed).
- [ ] Verify: one 4-period CSV → 4 rosters; a 3-file batch; a real .xlsx;
  export-all → wipe → re-import is lossless; 009's backup export captures the new key;
  `npm run test:name-picker`; `check:dedupe`.

### R3 — Picker adoption/migration rounds (2–3 PRs, batched, parallelizable)

- [ ] **R3a — wire the 8 unwired tools first** (biggest user payoff): 021, 036, 044,
  058 (staff), 060, 073, 077, 075 (staff). Each gets a small "Load from roster" control
  via `Roster.mountRosterPicker` that fills the existing names textarea
  (non-destructive: fills, doesn't lock — the textarea stays the tool's source of truth).
  060/073/077 share an identical `#rosterInput` template, so one worked example applies
  three times. 058/075 are *staff* lists: give them the picker collapsed/optional, since
  `np_rosters` holds student rosters. Each page adds
  `<script src="../_shared/roster.js"></script>` (after a11y.js, before the tool script).
- [ ] **R3b / R3c — migrate the ~20 copy-pasted picker functions** across the 23
  existing consumers to `Roster.mountRosterPicker`, in batches of ~10–12 per round —
  **incremental, never big-bang** (the Phase 2/3 refactor rounds are the precedent).
  Hash-compare the copy-pasted functions first (the Phase 2 discipline): variants that
  don't match the standard shape get reviewed individually. Rules per tool: keep the
  tool's existing remembered-selection localStorage key as `persistKey` (zero data
  migration); delete the local function; any picker too custom for the mount helper stays
  on direct `Roster.listRosters`/`getRoster` calls — still a dedupe win. Every migrated
  tool gains live cross-tab refresh for free (today only 010 has it).
- [ ] Bookkeeping per round: `CACHE_VERSION` bump (no PRECACHE changes after R1).
- [ ] Verify per round: every touched tool loads with zero console errors; picker lists
  the same rosters as before; selection persists across reload; a roster edit in a second
  tab refreshes the picker; `npm test` suites for any suite-bearing tool in the batch;
  `node Tools/board-check/check-social.mjs` before/after (head edits add a script tag).

### R risks / open questions

- **Write contention**: documented in R1; acceptable, not new.
- **Staff vs student rosters** (058/075): does one shared namespace suffice, or does a
  staff list pollute Name Picker's roster dropdown? Cheapest answer is a naming
  convention ("Staff — …" prefix), not a second store. Decide in R3a.
- **Roster size**: a 6-period school in one xlsx is ~200 names — no quota risk, no
  IndexedDB needed.

---

## Track B — Custom Theme / Branding Pass

**Decision: extend `_shared/a11y.js` — do not create a separate `brand.js`.** a11y.js is
already the site's presentation-prefs owner: synchronous pre-paint execution on 73/81
tools, prefs persistence, storage-event tab sync, an injected floating settings widget,
and precedent for per-tool opt-out flags (`A11Y_NATIVE_THEME`). A separate file would buy
concern separation at the cost of ~73 head edits (a full mechanical migration phase)
before the first tool showed a brand color. Keep the brand code in a clearly fenced
section (`/* === brand === */`) so it can be extracted later if the file grows unwieldy.

New keys (both registered in 009 `KNOWN_GROUPS`, settings-class, not student data):

| Key | Shape |
|---|---|
| `gvb-brand:settings.v1` | `{v:1, accent:'#rrggbb', accent2:'#rrggbb', schoolName?, updatedAt}` |
| `gvb-brand:logo.v1` | bare data-URL string (PNG, ≤200px long edge, hard cap ~100 KB) |

The logo lives in its own key so accent tweaks never rewrite the blob and storage-event
handlers can tell the two apart.

### B1 — Brand engine in a11y.js (one PR)

- [ ] Pre-paint (same code path that applies the saved theme): read
  `gvb-brand:settings.v1`; if present,
  `document.documentElement.style.setProperty('--accent', …)` and `--accent-2` — this
  cascades over `_shared/ink-paper.css` on the 67 majority tools — **plus** derived
  Industry aliases for the 5 `_ds` tools: set `--color-accent-600` to the accent and
  derive the neighboring steps with small HSL lighten/darken adjustments in JS
  (approximate is accepted; no second palette file).
- [ ] Opt-out flag `window.BRAND_OPT_OUT = true`, checked before applying (the
  `A11Y_NATIVE_THEME` precedent). Set it inline in `007-Name Picker.html` — its own
  11-theme `np_theme` system owns its accents; a site accent stomping a chosen Name
  Picker theme is a bug, not a feature. Audit whether other own-palette tools (004, 035,
  002/016/018) even resolve `--accent`; if they don't consume it, setting it is a
  harmless no-op and they need no flag.
- [ ] Logo injection: post-DOMContentLoaded, if `gvb-brand:logo.v1` exists and the page
  has the shared `.app-header`, insert `<img class="brand-logo" alt="">` before the
  `h1` (67 tools); silently no-op otherwise. `.brand-logo` sizing CSS goes in
  `_shared/a11y.css` (already precached), including
  `@media print { .brand-logo { display: none } }` — printed output doesn't change
  layout in v1.
- [ ] Expose `window.Brand = { get, set(settings), setLogo(dataUrl), reset, onChange }`
  from inside the IIFE, and extend the existing storage-event listener so accent/logo
  changes propagate live to open tabs.
- [ ] Verify: with no brand keys set, screenshot-diff 3 representative tools pre/post —
  must be pixel-identical (brand is strictly additive); set an accent → visible on an
  ink-paper tool and an Industry tool (005 or 036), and *not* on 007; dark mode + accent
  together (the a11y CSS-filter dark will shift the hue — observe and document, don't
  fight it); `npm test` name-picker + seating-chart suites; `check:dedupe`. Bump
  `CACHE_VERSION`.

### B2 — Settings UI (one PR)

- [ ] Add a "School branding" section to the existing a11y floating widget: accent
  `<input type="color">`, optional accent-2 override (auto-derived by default), logo file
  input, and a **Reset to default** button that removes both keys and clears the inline
  properties live (no reload).
- [ ] Logo pipeline: reuse the `Tools/certificate-award-maker/cam-logo.js`
  `downscaleImage` approach — canvas downscale to ≤200px, PNG data URL (transparency
  survives). Enforce the ~100 KB post-encode cap with a visible, explanatory rejection
  message (P12: no silent quota failures), and surface `QuotaExceededError` from
  `setItem` as "storage is full — export a backup from Backup & Restore, then clear old
  tool data".
- [ ] Contrast guard: compute WCAG contrast of the chosen accent vs `--paper`/#fff in the
  widget and show a warning — warn, don't block.
- [ ] Verify: set accent+logo in one tab → a second tab updates without reload; reset
  restores the stock look; an oversized image is rejected with the message; 009
  export/import restores branding on a clean profile. Bump `CACHE_VERSION`.

### B3 (optional, later) — coverage of the last 8 tools

- [ ] The 8 tools without a11y.js get it (desirable independent of branding) — fold into
  a normal improvement round, not this track.

### B risks / open questions

- **Dark-mode interaction**: the CSS-filter dark fallback shifts the school accent's hue.
  Probably acceptable (it already shifts the stock accents); verify and document in B1.
- **Industry derivation**: derived `--color-accent-*` steps won't perfectly match the
  hand-tuned `_ds` scale. Accepted — those 5 tools are the minority.
- **Open question (for Devon)**: should printed output eventually include the logo as
  letterhead? Deferred; print exclusion is the v1 default.

---

## Track P — Printable Cheat-Sheet Bundle Export ("Packet Builder")

**Decision: a new tool `Tools/082-packet-builder.html` with a central section-provider
registry in `Tools/packet-builder/sections.js`; 045 stays untouched.**

- *Why a new tool, not extending 045*: Sub Binder is a curated product ("everything a sub
  needs today") with a fixed section list; this swing is *arbitrary combination*.
  Grafting reordering/presets onto 045 risks its working print output. 082 generalizes
  the architecture; 045 keeps its one-button job.
- *Why a central registry, not per-tool contribution*: tools are self-contained pages,
  not loadable modules, and there are no iframes in the repo — per-tool providers would
  mean inventing a module system. The proven precedents are 045's loaders, 010's
  `PANELS`/`DEFAULT_PANELS` registry, and 009's `KNOWN_GROUPS`. Cost: the registry must
  track source-tool schema changes — mitigated by each provider declaring its
  `storageKeys` and a one-line comment next to each source tool's save function
  ("rendered by Tools/packet-builder/sections.js — keep shape or bump key version"), the
  same social contract 045 already has implicitly.

Registry API (`sections.js`, IIFE, `window.PacketSections`):

```js
window.PacketSections.register({
  id: 'seating-chart',
  title: 'Seating Charts',
  sourceTool: '005-Seating Chart Generator.html',  // linked in the UI as "set this up"
  storageKeys: ['seating-chart-v1'],               // the schema contract
  evaluate: function () { return { available: true, status: '3 charts, updated Mon' }; },
  render: function (targetEl, opts) { /* builds print DOM into targetEl */ }
});
```

This mirrors 045's `loadXxx()/evalXxx() → {available, status}` shape, so a later 045
unification (P3) is mechanical. Sections render **live at open** (matching 045) — no
stored snapshots, avoiding stale-data confusion and quota use.

### P1 — Tool + registry + first four sections (one PR)

- [ ] Build 082 per the CLAUDE.md new-tool boilerplate (ink-paper + a11y stack,
  `_shared/print-area.css` — as a new file it's written to comply with its no-local-print
  -rules constraint): checkbox list of registered sections with `evaluate()` status lines
  (unavailable sections greyed with a link to the source tool), drag-to-reorder, live
  preview into `#printArea`, Print button (`window.print()`), page breaks via `.page` +
  `page-break-before: always` (045's pattern).
- [ ] v1 sections (the confirmed re-renderable state): **hall pass log**
  (`hall-pass-log-sections`), **sub plan** (`subPlanBuilder.standingDetails.v1` /
  `.history.v1`), **school calendar** (`scv_calendar_v1`), and **class rosters**
  (`np_rosters` + `crh_students_v1` preferred names — a plain per-period name-list page).
- [ ] Saved presets: `gvb-packet:presets.v1` —
  `{v:1, presets:[{name, sectionIds:[…], order:[…]}]}`.
- [ ] Full new-tool bookkeeping: `index.html` row + record counts/memo/changelog per DEV
  NOTES item 6; `README.md` table row; `PRECACHE_URLS` += 2 files (URL-encode any
  spaces); `CACHE_VERSION` bump; 009 `KNOWN_GROUPS` += Packet Builder; social/OG block
  consistent with `check-social`; remove the idea's row from `IDEAS_BACKLOG.md` and
  `ideas-backlog.html` per "Picking one up".
- [ ] Verify: with a seeded localStorage fixture, each section renders; an empty profile
  shows all-unavailable gracefully; print preview paginates (Playwright
  `emulateMedia('print')` + screenshot); `check-social`; `check:dedupe`.

### P2 — Seating-chart section (one PR)

- [ ] Seating is the highest-value section and the only one with an existing exported
  renderer: `Tools/seating-chart/seating.mjs` exports `buildPrintPage(s, opts)` /
  `printSubExport`. Load it from 082 via a page-level `<script type="module">` (the
  ES5-IIFE rule governs `_shared/` window-global libraries, not tool pages). Register the
  provider with `render` delegating to `buildPrintPage`.
- [ ] Verify: `npm run test:seating-chart` (both suites — the pre-existing known-red
  drive-seating mobile assertion must not be joined by new reds); a packet combining
  seating + sub plan + hall pass prints as one correctly paginated document.
  Bump `CACHE_VERSION`.

### P3 (stretch — explicit go/no-go decision, not default work)

- [ ] 045 keeps its curated UX but sources section renderers from
  `packet-builder/sections.js`. Only worth doing if a schema change actually bites both
  files; don't refactor preemptively.

### P risks / open questions

- **Schema drift** is the structural risk: a source tool changes its save shape and a
  packet section silently renders garbage. Mitigations: the `storageKeys` contract, the
  source-tool comments, and `evaluate()` returning `available:false` on parse failure
  rather than throwing.
- **Cross-tool print CSS**: each source tool's print layout was tuned in isolation;
  combined pagination needs real print-preview time budgeted in P1/P2 verification.

---

## Track V — Voice Command Input

**Privacy stance (decided 2026-08-11):** the browser's `SpeechRecognition` (Chrome)
ships microphone audio to the vendor's servers for transcription — a real exception to
"nothing leaves the browser," and it needs connectivity. Voice therefore ships
**strictly opt-in, per device, with plain-language disclosure**: off by default; a
one-time consent dialog stating that "your browser sends microphone audio to its vendor's
speech service while listening"; a persistent on-screen listening indicator;
push-to-talk only (`continuous: false`), never an open mic; feature-detected so the mic
UI never renders where unsupported (e.g. Firefox). Everything else on the site stays
local. Chrome-on-laptop is the only supported v1 target.

New key: `gvb-voice:settings.v1` — `{v:1, enabled:false, consentAt:ISO|null,
lang:'en-US'}`, registered in 009 `KNOWN_GROUPS` (settings-class).

### V1 — `_shared/voice.js` + Name Picker (one PR; requires R1)

- [ ] Create `_shared/voice.js` (IIFE, `window.Voice`):

  ```js
  window.Voice = {
    supported: function () {},        // !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    enabled: function () {},          // consent flag from gvb-voice:settings.v1
    requestEnable: function (cb) {},  // disclosure dialog -> persists consent -> cb(bool)
    disable: function () {},
    create: function (opts) {},       // -> { start, stop, listening, destroy }
      // opts: { commands: [ { template: 'call on {name}',
      //                       slots: { name: function () { /* current roster */ } },
      //                       action: function (slots, transcript) {} } ],
      //         onState: fn('idle'|'listening'|'error'),
      //         onNoMatch: fn(transcript) }
    matchName: function (spoken, names) {}  // -> {name, score} | null
  };
  ```

  Design points: mic error handling copies `_shared/qr-scan.js` (including surfacing the
  recognition `network` error as a friendly "voice needs internet" message); the returned
  handle follows the site's `{stop}`/`{destroy}` convention; command grammar is JS
  template-string parsing against the transcript — no `SpeechGrammarList` (Chrome ignores
  it); a visible mic button per tool plus one hold-key shortcut, guarded by the same
  input-focus checks as the tools' existing `keydown` handlers (don't hijack typing);
  `matchName` normalizes (lowercase, strip punctuation), then exact → unique-first-name →
  Levenshtein ≤ 2 on the first token; below threshold it returns null — never guess
  wildly at a student's name. Name slots feed from `Roster.getRoster` plus preferred
  names via `Roster.getStudentMeta`.
- [ ] Wire `007-Name Picker.html`: "pick a name" → `pickName()`; "undo" →
  `undoLastPick()`; "mark {name} absent" / "{name} is back" →
  `toggleAbsent(name, bool)`; "call on {name}" → a **new `pickSpecific(name)`** (small
  addition reusing the existing pick-animation/stats path — `chooseWinner` currently
  picks internally, so a targeted pick needs this entry point).
- [ ] Bookkeeping: `PRECACHE_URLS` += `_shared/voice.js`; `CACHE_VERSION` bump; 009 key
  registration; script tag added to 007 (`check-social` before/after).
- [ ] Verify: `npm run test:name-picker` stays green (especially around `pickSpecific`);
  manual Chrome mic session for each command including a mispronounced name (fuzzy match)
  and gibberish (`onNoMatch` feedback, no action taken); Firefox shows no mic UI at all;
  the consent-declined path constructs zero recognition objects; disclosure wording
  reviewed by Devon.

### V2 — Behavior Points Tracker (one PR)

- [ ] Wire `008-behavior-points-tracker.html`: "point to {name}" →
  `applyTap(name, el, {skipNotePrompt: true})` with the currently armed chip;
  "point to everyone" → `awardMany()`; "undo" → `undoLogEntry(id)` of the newest log
  entry. All feedback through the existing `showMsg()` channel; same push-to-talk button
  placement as 007 for consistency.
- [ ] Verify: manual Chrome session mid-simulated-lesson (the actual use case: award a
  point without touching the laptop); `CACHE_VERSION` bump.

### Explicitly NOT in scope (so future rounds don't drift)

- No always-on / continuous listening, no wake words.
- No free-form dictation into text fields (OS dictation already does that better).
- No voice in more than these 2 tools until both survive a month of real classroom use —
  each addition re-runs the privacy calculus.
- No local/offline speech models, no vendored recognition engine, no audio storage of
  any kind.

### V risks / open questions

- **Recognition quality on real names** is unknowable until tried; `matchName`'s
  threshold will need a tuning round against real rosters.
- **iPad/Safari** `webkitSpeechRecognition` support is inconsistent — out of scope for
  v1; `supported()` gates it.
- **Spoken student names go to the vendor's speech service.** This is inherent to the
  API and is exactly what the consent dialog discloses. If that tradeoff stops being
  acceptable, this track is cut cleanly — nothing else depends on it.

---

## Bookkeeping checklist (every phase, every track)

Each phase's PR must include, in the same commit:

1. **sw.js**: `PRECACHE_URLS` updated for any added/renamed/deleted file (URL-encode
   spaces as `%20`), and `CACHE_VERSION` bumped — including when only the *contents* of
   already-precached files changed. Currently v65.
2. **`Tools/009-backup-restore.html`**: any new localStorage key added to `KNOWN_GROUPS`
   (and `STUDENT_KEYS` if it holds student data — roster meta yes; brand/voice/packet
   settings no).
3. **`Tools/006-class-roster-hub.html` `TOOL_KEYS`**: any new roster-adjacent key.
4. **Checks**: `npm run check:dedupe` before every commit;
   `node Tools/board-check/check-social.mjs` before/after any `<head>` edit; `npm test`
   suites for touched suite-bearing tools (name-picker for 007, seating-chart for
   005/seating section, schedule for 034/035, image-to-pdf for 011) — the one
   pre-existing known-red drive-seating assertion must not be joined by new reds.
5. **Browser verification** via `Tools/board-check/harness.mjs` conventions, recorded in
   this file's phase write-up in the REFACTOR_PLAN style: what was actually exercised.
6. **On completing each swing's final phase**: delete its row from `IDEAS_BACKLOG.md`
   § "Platform-Wide — Big Swings" *and* from `ideas-backlog.html`. The Packet Builder is
   the only swing producing a new tool page and additionally follows the full
   new-tool checklist (`index.html` DEV NOTES item 6, `README.md`).
7. **Session claiming**: parallel sessions claim tracks/rounds per
   `improvement prompts/_tools-touched.md`; `CACHE_VERSION` merge conflicts resolve as
   "take max + 1".
