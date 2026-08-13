# Improvement Prompts — 025 — Writing Prompt Generator

**Tool file:** `Tools/025-writing-prompt-generator.html`
**Support folder:** `Tools/writing-prompt-generator/` — `wpg-prompts.js`, `wpg-store.js`

**Current description (from README):** 200 prompts (100 middle school, 100 high school) across five genres, with a big projector-friendly display and a session history.

---

## Status

Reviewed — structural read of the source, followed by a Round 4 implementation
pass (see the Round 4 update below) that shipped Prompt Sets, rubric pairing,
and the Anonymous Response Display. Ideas below that remain unmarked are
deliberately ambitious and are **not** scoped to a single session.

## What it does today

- 200 shipped prompts across five genres and two grade bands
  (`wpg-prompts.js`), with band tabs and genre filtering
- Big projector display with **fullscreen** (`toggleFullscreen`) — one of the
  few tools that has it
- **Print poster** of a single prompt
- **Print half-sheets** (`halfSheetHtml`, `renderHandoutPrintArea`) — the same
  prompt twice on one page with a name/date row and ruled lines at a chosen
  physical spacing (wide 0.42in / normal 0.34in / narrow 0.28in / blank)
- **My Prompts** — teacher-authored prompts with their own genre
  (`gvb-writing-prompts:custom`)
- **Roster assignment sheet** (`buildRosterSheet`, `pickDistinctForRoster`,
  `renderRosterPrintArea`) — assign a different prompt to each student from a
  loaded `np_rosters` roster and print the sheet. This is the tool's most
  distinctive feature and the README doesn't mention it.
- Prompt history with no-repeat logic (`recentTexts`, `uniqueByText`)
- **Prompt Sets** — Random Draw / Planned Sequence modes, a set advanced by
  date with a manual Prev/Next/Jump override (`wpg-store.js`: `loadSets`/
  `saveSets`)
- **Rubric pairing** with Rubric Builder — a read-only bridge
  (`wpg-rubric-link.js`) to attach an existing rubric to a prompt or Prompt
  Set item and open it in Rubric Builder
- **Anonymous Response Display** — up to six pasted student responses shown
  full-screen, one-at-a-time or side-by-side, never persisted to storage
- **Writing Record** — a teacher-typed, per-student log of which prompt a
  student wrote to and the teacher's conference note, with a printable
  per-student page (`gvb-writing-prompts:record`, see the 2026-08-13 round)
- Loads `_shared/a11y.js`

## Quick Wins

- **Done — Pass 2, Round 2.** **A writing timer alongside the prompt** (P7 —
  the timer exists). Timed writing is the standard use of a prompt display.
  *(A self-contained countdown widget with presets, custom minutes, and
  Start/Pause/Reset — see the Pass 2 — Round 2 update.)*
- **Done — Pass 2, Round 2.** **Word-count goal** displayed with the prompt.
  *(A static target, not live tracking — see the Pass 2 — Round 2 update.)*
- **Done — 2026-08-11.** **Print the prompt as a half-sheet with lines** to
  write on, not just as a poster — the handout version of the same thing.
  *(A "Print half-sheets" button beside "Print poster": two identical half
  sheets per page with a cut line, a name/date row, the prompt, the meta
  strip, and ruled lines at a chosen physical pitch. See the half-sheet round
  below.)*
- **Sentence starters and a "if you're stuck" line** with each prompt, which
  is what the students who need the prompt most actually need.
- **Tag prompts by purpose** (quick write, journal, on-demand assessment,
  creative) as well as genre.
- **Import a prompt list** from a paste (P13) instead of one at a time.
- **Done — subsumed.** **Prompt of the day, by date** — a stable sequence
  rather than a shuffle, so a class that writes daily doesn't get randomness
  where it wants routine. *(Built as the Planned Sequence mode of Prompt Sets
  below, rather than as its own feature — see the Round 4 update.)*

## Major Features

- **Done —** **Prompt sets as units.** A two-week narrative sequence, or a set of
  argumentative prompts escalating in complexity, planned in advance and
  advanced by date — rather than a random draw each morning. *(Random Draw /
  Planned Sequence modes, see the Round 4 update.)*
- **Done —** **Rubric pairing** (P7). A prompt without criteria is half an assignment;
  linking a prompt to a rubric from `003-rubric-builder.html` and printing them
  together would close the loop. *(A read-only `wpg-rubric-link.js` bridge —
  see the Round 4 update.)*
- **Done —** **Anonymous sharing on the projector.** A large, well-typeset display the
  teacher types or pastes two or three student responses into — without
  names — for a whole-class revision discussion. The highest-value five
  minutes in a writing classroom, and currently done by squinting at a
  document camera. *(Anonymous Response Display, see the Round 4 update.)*
- **Convergence with the other prompt-bank tools** (P7).
  `023-exit-ticket-generator.html` and `024-number-talks-board.html` have the same
  bank/display/handout architecture. Three implementations exist.
- **A much bigger, better-organized bank**, including prompts tied to
  historical documents and images (P7 — `028-primary-source-analysis-generator.html`
  and `046-blank-map-generator.html` both hold sources worth writing about).
- **Done — 2026-08-13.** **Student writing portfolio.** Which prompts a
  student has responded to over the year, with the teacher's notes — the
  artifact for a conference. *(Shipped as the teacher-typed "Writing Record"
  section — see the Writing Record round below.)*

## Moonshot / North Star

**The writing routine, planned and run.** A sequence of prompts planned across
a unit with rubrics attached, displayed full-screen with a timer and sentence
starters for whoever needs them, printed as lined half-sheets to write on, two
anonymous examples projected for a revision discussion, and a printed record
at the end of the quarter of which prompts each student wrote to and what the
teacher noted about each.

## Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see `_platform-themes.md`). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Response collection from student devices** over a local peer connection.
  The anonymous projection above gets the discussion benefit without it.
- **Student writing portfolio** maintained by students. A teacher-maintained
  record of prompts and notes stays in scope; students maintaining it does not.

## Platform themes that matter here

- **P7 (cross-tool)** — one of three prompt-bank tools; wants the timer and
  the source tools still. **Rubric pairing addressed 2026-08-10** via the
  read-only `wpg-rubric-link.js` bridge.
- **P2 (shared roster)** — already reads `np_rosters` for the assignment
  sheet, which is the pattern other tools should copy.
- **P9 (device pairing)** — teacher-side only: a phone remote for the
  projected prompt display.
- **P1 (projector mode)** — has fullscreen; still needs dark mode.

## Open Questions

- Should the three prompt-bank tools share a bank format and a display engine
  even if they keep separate front doors? The duplication is substantial.
- ~~Is collecting student writing in scope?~~ **Answered: no**, here and in
  the exit ticket tool alike. Students aren't intended users of this site.

## Round 4 update — 2026-08-10

Implemented three of the Major Features in one pass, plus the small
"Prompt of the day, by date" quick win that the first one subsumes.

**1. Prompt sets as units.** New "Prompt Sets" panel and a `Random Draw` /
`Planned Sequence` mode-tab pair above the stage. A set is
`{id, name, startDate, cursor, items:[{id, band, genre, text, rubricName}]}`,
persisted at `gvb-writing-prompts:sets` (`wpg-store.js`: `loadSets`/
`saveSets`); the set being viewed/edited is remembered at
`gvb-writing-prompts:activeSet`. Items are added either as a random pull from
the current band/genre filters (dedup'd against what's already in the set) or
typed by hand, and can be reordered and removed. Giving a set a start date
computes a suggested day-index by counting school days (Mon–Fri) since that
date, offered as a one-click "Jump to today" rather than auto-advancing — a
teacher who was out sick shouldn't have the sequence silently skip a day out
from under them. Prev/Next move the cursor by hand regardless. Deliberately
**does not** write into the existing "Prompt history" list — that log stays
scoped to the random-draw generator's own no-repeat logic, and a set's own
item list is its own record, so the two features don't tangle.

**2. Rubric pairing with Rubric Builder.** New
`writing-prompt-generator/wpg-rubric-link.js` — a small, explicitly
**read-only** bridge that reads Rubric Builder's own storage contract
(`gvb-rubric-builder:list`, `gvb-rubric-builder:data:<name>`) to list and
summarize already-built rubrics, and writes only the `:current` pointer
Rubric Builder already reads on boot to pick a rubric before opening it in a
new tab. A "Rubric" row under the stage (present in both modes) lets a
teacher attach one of their existing rubrics to whatever prompt is showing;
for a Prompt Set item the pairing is persisted on the item itself, and each
set item row also gets its own compact rubric picker. The print poster grows
a one-line "Rubric: <name>" credit when a rubric is attached. Deliberately
**did not** duplicate Rubric Builder's full criteria/level table into the
poster print, and did not add a "generate a starter rubric from here" flow —
both would mean this tool carrying a second, silently-driftable copy of
Rubric Builder's state shape. `_shared/state-link.js` already exists for
exactly that kind of handoff (`003-rubric-builder.html?rubric=<encoded>`) if a
future round wants to build one; picking an *existing* named rubric by
reading the list, the way this round does it, needs no knowledge of that
shape at all and can't go stale.

**3. Anonymous Response Display.** New "Anonymous Response Display" section:
add up to six response textareas (no name field exists at all — anonymity
isn't a display option, there's nothing identifying to strip), then
"Project" opens a full-screen overlay reusing the same fullscreen affordance
as the prompt stage. Two view modes: "One at a time" (large centered text,
Prev/Next, arrow-key navigation) for walking a class through responses one
by one, and "Side by side" (a card grid) for a quick compare. The view-mode
toggle is duplicated into the overlay's own bar — the overlay is
`position: fixed; inset: 0`, so the page's copy of that control is covered
and unclickable while projecting, which an early Playwright pass caught.
Responses are **intentionally not persisted** to localStorage; they exist in
memory for the current page session only, so nothing a student wrote lingers
in browser storage after class. "Clear all" wipes them without a confirm
dialog, matching their transient/low-stakes nature.

**Not done, left for a future round:**
- Sentence starters / "if you're stuck" lines (Quick Win) — would need
  genuinely per-prompt authored content across all 200 bank prompts to be
  worth shipping, not generic filler; too large for this round.
- The bigger, source-tied prompt bank and the student portfolio (Major
  Features) — untouched, per the round's 2–4-idea scope.
- Convergence with `023-exit-ticket-generator.html` / `024-number-talks-board.html`
  — not attempted this round (both were being worked on in parallel by
  someone else). Worth flagging concretely now that this round exists: the
  "prompt sets as a sequenced unit, advanced by date with a manual
  Prev/Next override" pattern built here is generic enough that all three
  bank tools could plausibly share it verbatim, and the read-only
  cross-tool bridge pattern in `wpg-rubric-link.js` (read the other tool's
  own storage contract, write only its "open this one" pointer) is probably
  the right template for any future bank tool that wants to hand off to a
  companion tool without coupling to its internals.
- Dark mode / P1 projector polish — not addressed; the new overlay and
  seq-nav UI reuse the existing CSS variables so they inherit whatever
  theming the tool has today (i.e., none beyond `_shared/a11y.js`'s filter
  fallback), but nothing new was done here.

**Testing:** `node --check` on `wpg-store.js`, `wpg-rubric-link.js`,
`wpg-prompts.js`, and both inline `<script>` blocks extracted from the HTML.
A throwaway Playwright script (Chromium, `file://`) exercised: generating a
random prompt; switching to Planned Sequence with no sets; creating a set,
adding random and manual items, reordering guards (first item's "up" button
disabled); Prev/Next/Jump navigation and its persistence across a reload;
attaching a rubric (seeded a fake Rubric Builder entry in localStorage) and
confirming the summary line, the poster's rubric credit, and the set item's
persisted `rubricName`; the "Open in Rubric Builder" handoff end-to-end,
including that the opened tab read back the `:current` pointer this tool
wrote and loaded with zero console errors; deleting a set and confirming the
sequence stage falls back cleanly; and the anonymous response flow including
the one-at-a-time/grid toggle and Next navigation. Zero console errors on
either page throughout. The test script was thrown away after use.

## Pass 2 — Round 2 update — 2026-08-11 (session `mxpfjs`)

Shipped the two still-open Quick Wins named in that section: the writing
timer and the word-count goal.

**1. Writing timer.** A self-contained "Writing Timer" widget now lives
inside `.stage` itself — countdown display, four duration presets (3/5/10/15
min), a custom-minutes box (1–180, Enter or "Set"), and Start/Pause/Reset —
following the same setup-then-start pattern as `004-Classroom Timer.html`
(a preset or custom value fills in the duration; Start begins the countdown
separately) and the same audible-chime approach already used for
`023-exit-ticket-generator.html`'s think-time countdown (a short WebAudio
oscillator beep, doubled here into two beeps so it reads as a distinct
"time's up" cue against the single think-time beep). Being a child of
`.stage` rather than a sibling control row was the deliberate choice: the
Fullscreen API only renders descendants of the fullscreened element, and this
tool fullscreens `.stage` specifically (not the whole page), so Start/Pause/
Reset had to live inside it to stay clickable once a teacher goes fullscreen
— the same reasoning already applied to the Anonymous Response Display
overlay's duplicated view-mode toggle in the Round 4 pass. The countdown uses
an epoch (`Date.now()`-based `endAt`), not a decrementing per-tick counter, so
a backgrounded or throttled tab can't drift the displayed time. The chosen
duration persists across reloads (`settings.timerMinutes`); the running
state/remaining time deliberately does not, so a stale mid-countdown state
never survives a reload. The timer is independent of which prompt is
showing and of draw-vs-sequence mode — it keeps running (or keeps its
paused/reset state) across `generate()` calls and Prev/Next sequence
navigation, since a teacher restarting a countdown every time they change
prompts would defeat the point of a writing timer.

**2. Word-count goal.** A new "Word-count goal" number input (with a Clear
button) sets `settings.wordGoal`, persisted and displayed as "Aim for
`<n>`+ words" on a dedicated line inside `.stage`, just under the prompt —
so it fullscreens with the prompt the same way the timer does. This is
explicitly a static target the teacher sets, not live word-count tracking of
anything typed — there is no student input anywhere in this teacher-facing
display tool for it to track. Printing the poster (`renderPosterPrintArea`)
now includes an "Aim for `<n>`+ words" line (`.poster-goal`) whenever a goal
is set, alongside the existing rubric credit line.

Both features were added without touching `renderDrawStage` /
`renderSequenceStage`'s ownership of prompt content: the stage's inner markup
was split into a persistent `#stagePrompt` child (which those two functions
still fully own and overwrite on every render) plus sibling `#wordGoalDisplay`
and `#stageTimer` children that are rendered independently and never touched
by prompt re-renders — so generating a new prompt or stepping a sequence
can no longer clobber a running timer or the goal display, which a naive
"rebuild `.stage`'s innerHTML" implementation would have done.

**Not done, left for a future round (unchanged from the Round 4 update,
confirmed still accurate):**
- Sentence starters / "if you're stuck" lines (Quick Win) — still needs
  genuinely per-prompt authored content across all 200 bank prompts, not
  generic filler.
- The bigger, source-tied prompt bank and the student portfolio (Major
  Features) — untouched.
- Convergence with `023-exit-ticket-generator.html` /
  `024-number-talks-board.html` (P7, cross-tool) — not attempted this round
  either. Worth reflagging now that a *second* generic, shareable pattern
  exists: this round's "the fullscreened element must contain its own live
  controls, not just its own display" constraint (first hit by the Anonymous
  Response Display overlay in Round 4, now hit again by the writing timer)
  is a real, recurring shape any of the three bank tools' fullscreen-stage
  code would need to handle identically. Combined with Round 4's note about
  the prompt-sets-as-sequence pattern and the read-only cross-tool-bridge
  pattern, that's now three independently-discovered shared shapes across
  two rounds — a concrete case for a shared display-engine module if a
  future round wants to take it on, rather than three copies drifting apart.
- Dark mode / P1 projector polish — still not addressed; the new timer and
  goal widgets reuse the existing CSS variables so they inherit whatever
  theming the tool has today, same caveat as Round 4.

**Testing:** `node --check` on `wpg-prompts.js`, `wpg-store.js`,
`wpg-rubric-link.js`, and both inline `<script>` blocks extracted from the
HTML — all clean. A throwaway Playwright script (Chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, `file://`) exercised:
generating a prompt; setting a word-count goal and confirming it renders on
stage, confirming it appears in the printed poster's HTML (`.poster-goal`
with the number), clearing it and confirming the display empties, then
reloading and confirming both the input value and the stage display restore
from storage; the timer's default 5:00 state; each of the 3/5/10/15-minute
presets and a custom "7" applied correctly; starting a 1-minute countdown and
confirming Start/Pause button visibility toggles correctly and the displayed
time actually decreases after ~1.2s; pausing and confirming the display
freezes across a further 1s wait and the buttons toggle back; resetting and
confirming the full duration returns; monkey-patching
`AudioContext.prototype.createOscillator` to detect the chime, then using
Playwright's virtual clock to fast-forward past a 1-minute countdown and
confirming the display reached exactly `0:00`, the `.timer-done` flashing
class applied, and the chime fired; and confirming `.stage` genuinely
granted fullscreen in this headless run and that `#stagePrompt`,
`#wordGoalDisplay`, and `#stageTimer` are all still descendants of `#stage`
(so all three remain visible/operable once fullscreened). Zero console or
page errors throughout. The test script and extracted inline-script files
were deleted after use.

## Half-sheet round — 2026-08-11 (backlog rank 1)

Shipped **"Print the prompt as a half-sheet with lines"**.

- **"Print half-sheets"** sits next to "Print poster" in the header and follows
  the same enable/disable rule (both need a prompt on the stage). It renders
  two identical half sheets on one page, separated by a dashed cut line: a
  name/date row, the prompt at 14pt, a small meta strip (band · genre · set day
  · word goal · rubric name — everything the poster shows, in one line), and
  ruled lines filling the rest.
- **Line spacing is a physical measurement, not a t-shirt size**: wide 0.42in,
  normal 0.34in, narrow 0.28in, or no lines at all. 7th-grade handwriting
  genuinely needs about 0.42in and a teacher knows their own class. The name
  line is a separate toggle. Both persist in the existing settings blob, and
  both are defaulted in `loadSaved()` so older saved settings load unchanged.
- **The line count is derived, not fixed.** The prompt block's height is
  estimated from its length and subtracted from the sheet, so a long prompt
  costs lines instead of pushing them off the bottom. Half height is 4.9in so
  two halves plus the 0.5in `@page` margins can never tip onto a third page.
- **Found and fixed while printing this:** `_shared/a11y.css` had no `@media
  print` rule, so the floating accessibility button printed in the corner of
  every handout on every tool whose print CSS hides `.wrap > *` rather than
  `body *`. One rule in the shared file fixes it site-wide.

New suite `Tools/writing-prompt-generator/test/smoke-half-sheet.mjs` (26 checks)
as `npm run test:writing-prompt`. It runs under `emulateMedia('print')` — the
layout only exists in print CSS — and measures real inches: the 4.9in half, the
10in page total, the exact 0.42/0.34/0.28in line pitch, the line count moving
the right way with spacing, the blank option, the optional name row, twelve
consecutive real prompts with zero overflow, persistence across a reload, the
untouched poster path, and the a11y-button fix.

### Where the next round should pick up

- **Sentence starters / "if you're stuck"** is now the most valuable remaining
  Quick Win, and it has an obvious home: the half sheet has the room for it,
  directly under the prompt.
- **Tag prompts by purpose** and **paste-import a prompt list** (P13) are still
  open and unchanged.
- The half sheet deliberately prints the *current* prompt twice. A per-student
  version — the roster assignment sheet's prompts, one half sheet each — is a
  natural next step and would reuse `halfSheetHtml()` as-is.

## Writing Record round — 2026-08-13

Shipped the **Student writing portfolio** Major Feature, scoped exactly as
the "Deferred — student-facing" clarification already drew the line:
teacher-typed and teacher-maintained, not a student submission system. New
**"Writing Record"** section between the Roster Assignment Sheet and the
Anonymous Response Display.

- **Student picker.** A text input (`#recordStudentInput`) with a live
  `<datalist>` — type a name, or pick one already offered. The datalist is
  fed two ways: "Load a saved roster…" (`#recordRosterLoadSelect`) reads
  `np_rosters` exactly the way the Roster Assignment Sheet already does
  (read-only — confirmed by the new test), and any name that already has a
  logged entry is always offered too, so a student who was hand-typed once
  (no roster, a mid-year transfer, a make-up assignment) doesn't have to be
  retyped from scratch next time. There's deliberately no separate "view"
  vs. "add" control — typing or picking a name both shows that student's
  existing entries and sets who the next "Add to record" targets.
- **Logging an entry.** A prompt field, a date (defaults to today, editable),
  and a note field. **"Use the prompt on stage"** copies the exact text of
  whatever the generator is currently showing, but typing or pasting a
  different prompt by hand is just as valid — a teacher backfilling a
  conference record from a stack of graded papers isn't necessarily looking
  at a matching prompt on screen right now. An entry only tags itself with
  band/genre/rubric when its prompt text exactly matches `currentPrompt`
  (i.e. came from "Use the prompt on stage"); a hand-typed prompt is logged
  with `band`/`genre`/`rubricName` all `null` rather than guessed at.
- **Storage.** New `gvb-writing-prompts:record` key
  (`{ [studentName]: [{id, date, promptText, band, genre, rubricName, note}] }`),
  via `wpg-store.js`'s new `loadRecord`/`saveRecord` — same validate-on-load
  pattern as every other key in this file (drops malformed entries rather
  than trusting a hand-edited localStorage blob). Deliberately its own key
  and its own array per student, not folded into the existing "Prompt
  history" list (which is un-attributed and scoped to the random-draw
  generator's no-repeat logic) or into Prompt Sets (which are the teacher's
  plan, not the record of who wrote what) — same separation-of-concerns
  reasoning Round 4 gave for keeping a set's item list out of history.
- **Editing and removing.** Each logged entry's note is an inline `<textarea>`
  that saves on every `input` (same live-binding pattern as the Anonymous
  Response Display's textareas) — no separate "save" step, since a teacher
  typing conference notes shouldn't lose one to a missed click. The prompt
  text and date are not editable in place; a wrong one is removed and
  re-added, matching the simplicity level of "My Prompts" and the Anonymous
  Response Display's own remove-only list items. Removing a student's last
  entry deletes that student's key entirely rather than leaving an empty
  array parked in storage.
- **Print.** "Print this student's record" builds a full-page, dated list —
  each entry as date + band/genre/rubric meta + the prompt (bold) + the
  teacher's note — reusing the generic `.print-only h1` / `.print-meta` /
  `ol`/`li` rules the Roster Assignment Sheet's print area already
  established (same page-break-inside: avoid per entry), plus a handful of
  new rules for the meta line, the bold prompt, and the note paragraph. This
  is a full printed report, not a half-sheet — it wasn't built on
  `halfSheetHtml()`, which is specifically the "same prompt twice, ruled
  lines to write on" handout shape and doesn't fit a variable-length list of
  past entries.

**Not done, left for a future round:**
- No dedicated export/import for this record — but `009-backup-restore.html`
  needs no change: it iterates every localStorage key generically
  (`Object.keys(localStorage)`), so the new `gvb-writing-prompts:record` key
  is already covered by a full backup/restore without any tool-specific
  wiring. Verified by reading its source; not re-tested end-to-end this
  round.
- No cross-linking from the Roster Assignment Sheet's per-run list back into
  the Writing Record (e.g. a one-click "log this assignment for everyone" at
  build time) — logging stays a deliberate, one-student-at-a-time teacher
  action for now rather than a bulk one, since a conference note is
  necessarily written per student anyway.
- Sentence starters / "if you're stuck", tag-by-purpose, and paste-import
  (Quick Wins/P13) — untouched, unchanged from prior rounds.
- Convergence with `023-exit-ticket-generator.html` /
  `024-number-talks-board.html` (P7) and dark mode (P1) — untouched, same
  caveats as every prior round.

**Testing:** `node --check` on `wpg-store.js` and the extracted inline
`<script>` block — clean. `node Tools/board-check/check-dedupe.mjs` — clean.
Extended the existing Playwright suite with a new
`Tools/writing-prompt-generator/test/smoke-writing-record.mjs` (40 checks,
`node Tools/writing-prompt-generator/test/smoke-writing-record.mjs`) covering:
the record key starting empty; a saved `np_rosters` roster feeding the
student datalist by name and size, and coming back byte-for-byte unchanged
(read-only); picking a student with no entries; adding a hand-typed entry and
confirming it lands in storage verbatim with `band`/`genre` both `null`;
generating a stage prompt, using "Use the prompt on stage," and confirming
the resulting entry's `band`/`genre` are populated from the matching stage
prompt; a student logged with no roster at all still showing up in the
datalist on a later lookup; two entries for one student appending (not
overwriting) and rendering newest-first; editing a note textarea in place and
confirming storage updates without a re-add; removing one entry among several;
removing a student's last entry dropping their key entirely from the record
object; the print button's disabled state tracking whether the currently
viewed student has any entries; the printed page's heading, entry count,
exact prompt text, and note text; and persistence across a reload. Both
suites (`smoke-half-sheet.mjs`, `smoke-writing-record.mjs`) pass together,
26 + 40 checks, zero console errors, nothing left the site.
`npm run test:writing-prompt` still runs only the half-sheet suite — wiring
the new suite into `package.json` and `sw.js`'s `PRECACHE_URLS` (this file
doesn't need precaching, being test-only) is left to the orchestrating
session's integration pass per this repo's worktree conventions.
