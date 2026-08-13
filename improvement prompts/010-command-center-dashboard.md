# Improvement Prompts — 010 — Command Center

**Tool file:** `Tools/010-command-center-dashboard.html`
**Support folder:** `Tools/command-center/` — `cc-remote.js` and `remote.html`
for the phone-remote feature (see Status below), plus `test/`

**Current description (from README):** A timer, today's School Calendar Visualizer entry, and a no-repeats roster quick-call, side by side on one projector page.

---

## Status

### 2026-08-13 — the phone remote

Backlog item 2 from Round 1's "where the next round should pick up" list:
*"Remote control from a phone (Major, P9) — the panel registry makes this
tractable now: a paired phone needs to drive four or five named actions..."*

Shipped as a **"Remote control…"** button in the header, opening the same
kind of pairing modal Classroom Timer's **Mirror to a device** already uses —
same QR-and-copy flow, same "on the same Wi-Fi, no server" shape — so a
teacher who has paired one already knows the other. The dashboard is always
the host (it draws the offer code); the phone opens
`Tools/command-center/remote.html`, scans it, and shows its answer back. What
travels over the data channel is new: Classroom Timer's Mirror only ever
pushes a display snapshot one way, but here the phone is the one *sending* —
five named commands — and the dashboard applies each one by calling the
exact function the matching on-screen control already calls:

- **Start / pause the timer** — `timer_toggle` calls `startTimer()` /
  `pauseTimer()`, whichever the current state calls for. Refused (not
  silently ignored) if the Timer panel is switched off, the same guard the
  existing Space-bar shortcut already uses.
- **Call the next student** — `next_student` calls the same `pickStudent()`
  the Pick button drives, against whatever roster is currently loaded.
  Refused if no roster is loaded — a remote command guessing at an empty list
  would be worse than saying no.
- **Sign a student back in** — `sign_in` (with the student's id and section)
  calls the exact `signInFromDashboard()` mirror the Hall Pass panel's own
  button already calls. The phone doesn't ask for a name blind: the
  dashboard pushes down who is currently out on every snapshot, so the
  phone's card is a list of real buttons, one per student, not a text box.
- **Pull up the next period's roster** — `advance_period` is genuinely new
  logic, not a rewire of something that already had a button: nothing on this
  page could move the schedule forward by hand before this. It deliberately
  does **not** touch the live clock/period readout at the top of the page —
  that strip is wall-clock driven by design (see Round 1's decision to own
  the bell schedule outright), and faking "what period it is" would fight
  that decision rather than extend it. What it does do is apply the *next*
  scheduled period's mapped roster immediately, reusing the exact same
  roster-switch `onPeriodChange()` already runs when the real bell reaches
  that period — so a teacher running a few minutes ahead of the printed
  schedule can bring up 3rd period's roster from across the room without
  waiting for the clock, or walking back to the podium to pick it from the
  dropdown.
- **Run the start-of-day reset** — `start_day` calls the same
  `runStartOfDayReset()` the "Start the Day" button calls (pulled out into its
  own function for this). This was the chosen fifth action: the doc's own
  four (timer, next student, sign-in, advance period) didn't leave an
  obviously-missing fifth, so the search was for the cleanest existing
  single-press, zero-parameter action already on the board, and "Start the
  Day" was the only other button on the page that fits that description —
  useful for a teacher greeting students at the door who wants the day
  started without walking back in.

**New files:** `Tools/command-center/cc-remote.js` (the pairing wrapper over
`_shared/webrtc-pair.js`, modeled directly on
`Tools/classroom-timer/ct-mirror.js` — the only existing real integration of
that shared module — but bidirectional: both the host and the join side get
`onMessage`/`send`, where Mirror only ever gave one side a `send`) and
`Tools/command-center/remote.html` (the phone-facing pairing + five-button
page, structured like `Tools/classroom-timer/mirror.html`). `drawQR` is a
second small copy of Mirror's own helper rather than an import across tool
folders — this repo's QR-drawing helpers are already one per tool
(`016-qr-code-generator`, `017-gallery-walk-qr`, `escape-room-builder`,
`classroom-timer`, ...), not a single shared one, so this follows that
existing pattern rather than inventing a new cross-tool dependency for a
~30-line function.

**Testing:** real WebRTC between two headless browser pages isn't what needed
proving — `_shared/webrtc-pair.js` and the pairing UI shape are already
exercised in production by Classroom Timer's Mirror feature. What's new is
the *dispatch*, so `Tools/command-center/test/smoke-remote-commands.mjs`
calls `window.__ccApplyRemoteCommand` directly (the same function the data
channel's `onMessage` calls — exposed on `window` for exactly this) for all
five commands and checks each one against the on-screen path: same click,
same resulting `localStorage`/`sessionStorage` state, same DOM. For
`advance_period`, which has no on-screen button to compare against, the test
instead checks it against the *bell's own* automatic roster-switch —
confirming a remote-advanced period ends up in the identical `rosterName` the
ordinary wall-clock trigger would have produced, just early. 56 checks, 0
console errors. The existing `smoke-seating-panel.mjs` suite (32 checks)
still passes unchanged, and `node Tools/board-check/check-dedupe.mjs` is
clean.

**Known limitations:**

- No fallback for a phone that can neither reach a camera nor easily
  copy/paste an SDP blob — same limitation Mirror already has; not addressed
  here.
- `advance_period`'s scope is deliberately narrow: it moves the *roster*
  forward, not the displayed clock/period. A teacher glancing at the top
  strip after pressing it will still see the real current period until the
  actual bell catches up. This was a deliberate choice to avoid rearchitecting
  the wall-clock-driven period display (used by the now-strip, the seating
  panel, and the Start-the-Day checklist alike) into something with a
  manual-override state, which felt like a separate round's worth of work.
- The phone's five buttons don't disable themselves while a command is
  in flight — there's no ack beyond the next snapshot push (up to 1s away,
  faster in practice since a command triggers an immediate push). A very
  fast double-tap on "Call next student" could in principle fire twice.
  Not seen in testing, but worth watching for.
- Neither new file is in `sw.js`'s `PRECACHE_URLS` yet — left for the
  integration pass per this repo's worktree convention (see boundaries in
  the task this round worked from). Everything it depends on
  (`_shared/webrtc-pair.js`, `_shared/qr-scan.js`, the vendored `qrcode`/
  `jsqr`) was already precached by Classroom Timer's Mirror feature.

**Where the next round should pick up:** the timer extraction (P7, still
unstarted, see Round 1's note) and the shared read API are both still open.
The remote's fifth action (Start the Day) could grow a confirmation step on
the phone if a teacher ever fires it by mistake — not seen as a problem yet,
but worth watching once this is used in a real classroom.

### 2026-08-12 — session `r8kq4t` — the seating chart panel

Backlog rank 1. A ninth panel, **Seating Chart**, read-only over
`seating-chart-v1` (owned by `005-Seating Chart Generator.html`) — the third
tool whose storage this page reads and the second it never writes. What it
adds is the thing the generator itself cannot do from here: the chart for the
period you are standing in front of, on the projector, without leaving the
page.

- **Drawn as one SVG, not copied markup.** The generator lays out absolutely
  positioned divs in a 1280×900 coordinate space and leans on most of a
  stylesheet to make them look like desks. Re-creating that here would have
  been exactly the copy-paste drift `CLAUDE.md` exists to stop, and it would
  not have scaled. An SVG in the same coordinate space scales to the panel, to
  projector mode and to paper for nothing, and cannot drift with that
  stylesheet. The bill for it is that SVG text does not wrap, which `fitText`
  pays: a name wider than its desk gets a `textLength` and is squeezed rather
  than spilling over the edge, and a name that already fits is left alone.
- **Which chart to show is remembered per period, not globally.** This was the
  design decision worth the time. Matching a period to a section by name is a
  guess — a section called "3rd Period Academic" and a period labelled
  "Period 3" share no substring — so the panel guesses once (from the roster
  mapped to the period, then the period's label) and then gets out of the way:
  picking a section files that choice under the period id in
  `settings.seatingByPeriod`, and from then on that period comes up right. `-`
  is the bucket for outside any period, so a prep-period glance still
  remembers. Nothing has to be set up for the panel to be useful, and nothing
  has to be re-set every day.
- **Mirroring is done by reflecting the coordinates**, not by flipping the
  drawing. The generator flips the floor and then counter-flips every label to
  keep the writing readable; reflecting `x` about the room instead (and
  negating the rotation with it) gets the same picture with no counter-flip to
  forget. `numbered` and per-student `flag` are honoured too — a flagged desk
  gets a heavier stroke *and* a mark, since a school printer will not show the
  colour.
- The panel is `wide`, because a seating chart in a third of the board is
  decoration. It follows the bell (`onPeriodChange`) and a chart edited in
  another tab (the `storage` listener), and does not sit on the 20-second
  refresh timer — there is nothing on it that changes on its own.
- **New suite:** `Tools/command-center/test/smoke-seating-panel.mjs`, 32
  checks, wired into `npm test` and `npm run test:command-center`. It seeds a
  real chart and builds the bell schedule around the *actual* current time, so
  "the period you are standing in front of" is a real answer rather than a
  fixture that goes stale at 3pm. It covers the auto-choice, the per-period
  override surviving a reload, the empty desk, the flag, the rotation, the
  seat count, the unseated list, the mirror reflecting rather than shifting,
  both empty states, projector mode — and that a corrupt chart leaves the
  panel standing and is never written back over.

**Where the next round should pick up:** the panel is a viewer, and the
obvious next step is the one thing a teacher does while looking at a chart —
marking somebody absent. That would make this the second panel that writes to
another tool's key, and `seating-chart-v1` has no absence field, so it needs
the Seating Chart Generator's own round to decide the shape first. Second:
student photos live in the chart as base64 and are ignored here (see P12) —
worth showing, but not before the generator's own IndexedDB migration.

### Pass 2 — Round 1 — 2026-08-10 — session `yjj7k6`

Picked up item 3 from Round 1's "where the next round should pick up" list:
*"Do Now / agenda strip (Major) — pairs with the Classroom Timer's agenda
mode, which shipped in an earlier round and is not read here yet. That is
the most obvious next panel and it is a small one."* — and it was, thanks
to Round 1's own panel-registry refactor.

Shipped as a new **"Do Now / Agenda"** panel, on by default
(`DEFAULT_PANELS`), reading `004-Classroom Timer.html`'s own storage
**read-only**:

- `ct_running_v1` (the live `{mode, phase}` snapshot Classroom Timer writes
  only while a timer is running or paused) — when `mode === 'agenda'`, shows
  the current segment name large, minutes:seconds remaining, "Next: …" (or
  "Last segment"), and a thin whole-period progress bar computed the same
  way Classroom Timer's own agenda bar is (`agendaElapsedBase` plus progress
  through the current segment, over `agendaTotalMs`).
- `ct_prefs` (the configured plan, whether or not anything is running) — when
  nothing is currently running, falls back to listing the configured agenda
  segments and total time with a "start it in Classroom Timer" hint, rather
  than an empty panel.
- If neither exists, a plain empty-state pointing at Classroom Timer's
  Agenda tab.

Deliberately **read-only**, unlike the Hall Pass panel this tool already
writes to — there's no single obvious action a "sign in" button has here
(pause? skip to next segment? both would need Classroom Timer's own control
functions, not just its storage), so this round didn't invent one. Refreshes
on the same panel-refresh timer (`HALLPASS_REFRESH_MS`, 20s) the Hall Pass
panel already uses.

Verified with a headless-browser pass: seeded a configured-but-not-running
`ct_prefs.agenda.segments` and confirmed the plan-preview list rendered;
then seeded a running `ct_running_v1` (segment index 1 of 3, mid-segment)
and confirmed the live current-segment name rendered correctly. No console
errors in either state, or on the three other pages this round touched.

Everything else on this tool's backlog (extracting the shared timer,
phone-as-remote control, the shared read API, the landing-page question) is
unchanged from Round 1.

### Round 1 (Pass 1) — 2026-08-10 — The widget architecture, the bell schedule, the morning
routine, projector mode and an actionable Hall Pass panel all shipped.** The
page was restructured around a panel registry, which is the refactor the
backlog identified as the enabling one, and everything else this round was
built on top of it. Verified with a 33-check Playwright pass.

What shipped, against the backlog below:

- **Widget architecture (Major Feature — the enabling one)** — every panel is
  now an entry in a `PANELS` registry with its own title, "open the real tool"
  link, and `build(el)`. The board renders whatever is in `settings.panels`,
  in that order, skipping anything switched off. Adding a panel is one
  registry entry and one line in `DEFAULT_PANELS`, not surgery on the layout.
  A panel added in a later version is **appended and switched on** for a
  teacher who has never opened the config, rather than being dropped because
  their stored list predates it.
- **Configurable panels (Quick Win)** — a "Panels…" drawer with on/off and
  up/down per panel, persisted. Seven panels ship: Message of the Day, Bell
  Schedule, Start the Day, Timer, Today, Roster & Quick Call, Hall Pass.
- **A clock and the current period (Quick Win)** — a strip across the top with
  a live clock, the period you are in, minutes left (turning red under five),
  and what is next. It is the single most-glanced-at thing in a classroom and
  the page that is meant to be up all day did not have it.
- **Bell schedule and period awareness (Major Feature)** — an editable list of
  periods (name, start, end, and the roster that belongs to it), seedable from
  a seven-period day. When the bell rings the page **brings up that period's
  roster automatically** — but only if the teacher has not chosen a roster by
  hand since the page loaded, because yanking the roster away mid-question is
  worse than being helpful. **Resolved by deciding to own the schedule
  outright** rather than reading it from another tool: the School Calendar
  Visualizer models day types and pacing, not bell times, and inventing a
  dependency on a shape that does not exist yet is exactly the brittleness the
  open question below warns about. Six rows of times is small enough to own.
- **Morning setup routine (Major Feature)** — a "Start the Day" panel that
  reports what needs attention before the first bell (today's calendar entry,
  anyone still signed out from a *previous* day, whether the message of the
  day is set, which period is next and whether it has a roster mapped) and one
  button that resets turn order and today's exclusions. It never changes
  anything without being pressed.
- **Panels are actionable, not just readable (Quick Win)** — the Hall Pass
  panel now lists who is out, how long they have been gone, flags anyone past
  their destination's overtime limit, and **signs them back in from here**.
  That write mirrors `001-hall-pass-log.html`'s own `signInStudent()` field for
  field — same log row shape, same 300-entry cap — so the Hall Pass Log sees a
  perfectly ordinary sign-in.
- **Projector mode and fullscreen (Quick Win, P1)** — a display state, not a
  separate page: chrome, editors, hints and the roster list drop away, and the
  clock, period, message, picked name and timer all scale up. Escape leaves
  it, `F` toggles fullscreen, space starts and pauses the timer (P10).
- **State survives a refresh (Quick Win)** — the timer now stores a wall-clock
  end time, so a stray reload picks the countdown back up where it was instead
  of resetting to five minutes, and a backgrounded tab (which browsers
  throttle to one tick a minute) shows the right number the instant it comes
  back. Turn order and today's exclusions moved into `sessionStorage` too, so
  a reload no longer restarts the round and calls on the same four students.
  A timer that ran out while the page was closed shows 00:00 and does **not**
  fire the alert ten minutes late.
- **Cross-tab awareness** — a `storage` listener means signing a student in
  from the Hall Pass Log in another tab, or saving a roster in Class Roster
  Hub, updates this page without a refresh.

**Challenges hit:**

- **The panel body element outlives its contents**, so the delegated listeners
  on the Bell Schedule panel stacked a fresh copy every time a keystroke
  redrew it. Guarded with a `dataset.bound` flag. Any future panel that
  re-renders itself in place needs the same care — the ones that rebuild from
  `innerHTML` and bind to the new nodes are fine.
- Writing to another tool's key is a real coupling and this round took it on
  deliberately for exactly one panel, because "see who is out but not sign
  them in" was the clearest instance of the read-only complaint. It is written
  to mirror the Hall Pass Log's own function rather than to be clever, and it
  leaves anything it does not recognise untouched. **This is the second open
  question below, answered in practice rather than in principle** — and it
  makes the case for the shared read/write API stronger, not weaker.
- The timer is still this page's own simplified one rather than the Classroom
  Timer's. Extracting the real timer into `_shared/` is still the right
  answer and is still not done; this round only stopped it forgetting itself.

**Where the next round should pick up:**

1. **Extract the timer (Quick Win, P7)** — the remaining duplication. Both
   this page and `004-Classroom Timer.html` now have agenda-ish and persistence
   behaviour that has been implemented twice.
2. **Remote control from a phone (Major, P9)** — the panel registry makes this
   tractable now: a paired phone needs to drive four or five named actions
   (start/pause the timer, pick the next student, sign someone in, advance the
   period), not mirror a whole page. `_shared/webrtc-pair.js` is waiting.
3. ~~**Do Now / agenda strip (Major)**~~ — **done Pass 2 Round 1**; see the
   note at the top of Status. Read-only for now — advancing/pausing the
   agenda from here, not just watching it, is a reasonable follow-up.
4. **More panels, now that they are cheap**: behaviour totals for the current
   period, the day's exit-ticket prompt, the number talk of the day, the
   current seating chart.
5. **The shared read API (second open question)** — still worth doing, and now
   with a concrete write case to design against rather than a hypothetical.
6. The **landing-page question** below is untouched and still Devon's call.

## What it does today

- Reads six other tools' storage keys and composes them on one page:
  `np_rosters` (roster), `scv_calendar_v1` (today's calendar entry),
  `hall-pass-log-sections` (who's currently out), `ct_prefs` / `ct_running_v1`
  (the Classroom Timer's agenda, live), `seating-chart-v1` (the room), plus
  its own settings. Only the hall-pass key is ever written back.
- A **panel registry**: nine panels, each switchable and reorderable from the
  "Panels…" drawer, with a new one arriving switched on for a teacher who has
  never opened it
- A live **clock and period strip**, and a bell schedule that brings up the
  period's roster when the bell rings — unless the teacher has chosen one by
  hand since the page loaded
- **Timer** panel with quick durations (5/10/15/20m), Set, Start, Reset, and
  alert sounds (Bell / Buzzer / Chime / None, with Test)
- **Quick-call** roster panel with no-repeats exclusion, persisted per roster
  (`gvb-command-center:excluded:*`), and Reset turns
- **Seating chart** panel: the current period's chart drawn read-only from
  `seating-chart-v1`, full board width, with flagged seats marked, empty
  desks dashed, and the section choice remembered per period
- Live **hall pass** readout of who is out right now, one tap from signing
  somebody back in
- **Projector mode** as a display state on the same page, not a second one

## Quick Wins

- **Done —** **It's a read-only composite; make the panels actionable.** Currently you
  can see who's out but not sign someone in, and see the calendar but not edit
  it. Every panel should be one tap from doing the thing. *(The Hall Pass
  panel now signs a student back in from here — see Status.)*
- **Done —** **Fullscreen / projector mode** (P1). This is explicitly a projector page
  and has neither fullscreen nor the shared theme. *(Shipped as a display
  state, not a separate page — see Status.)*
- **Done —** **A clock and the current period.** The most-glanced-at information in a
  classroom, and this page — which is the one meant to be up all day — doesn't
  show it.
- **Done —** **Configurable panels.** Let the teacher choose which panels appear and in
  what order; a PE teacher and an English teacher want different dashboards.
- **Done —** **Remember panel state across a refresh** so an accidental reload doesn't
  reset the timer and the turn order.
- **Reuse the real timer.** This page reimplements a simplified timer
  (`startTimer`, `tick`, `playAlert`) that duplicates `004-Classroom Timer.html`.
  Extract the timer into `_shared/` or embed the real one (P7).

## Major Features

- **A true classroom home screen.** Today's agenda, the current period's
  timer, the bell schedule, who's out, today's do-now prompt, the current
  seating chart, and the day's calendar note — assembled from the tools that
  already hold each piece, on one page you leave projected all day.
- **Done —** **Widget architecture.** Panels as small, self-registering modules so adding
  a new one (exit ticket prompt, number talk of the day, SSR timer, behavior
  totals) is cheap. This is the enabling refactor for everything else here,
  and it's what turns this from a fixed trio into the site's front door.
- **Done —** **Period-aware.** With bell schedules (see School Calendar Visualizer), the
  page can automatically switch to 3rd period's roster and seating chart at
  10:15 without being told. *(The bell schedule is owned outright by this
  tool rather than read from School Calendar Visualizer — see Status.)*
- **Remote control from a phone** (P9). Start the timer, call the next
  student, sign someone back in — while walking the room, with the projector
  showing the result.
- **Do Now / agenda strip.** A slim always-visible band with the day's agenda
  and the current segment highlighted, pairing with the Classroom Timer agenda
  idea.
- **Done —** **Morning setup routine.** One button that, at the start of the day, pulls
  today's calendar entry, resets turn order, archives yesterday's hall passes,
  and tells you what needs attention.

## Moonshot / North Star

**The screen that's on from bell to bell.** A teacher opens one tab in the
morning and never opens another: it knows what period it is, what's planned,
who's in the room, who's out of it, how long is left, and what's next — all
composed from local data the other tools already keep, all private, all
working with the wifi down. This is the tool that makes the toolkit feel like
a product rather than a directory of pages.

## Platform themes that matter here

- **P7 (cross-tool composition)** — this tool *is* the theme; it reads four
  keys already and is the natural consumer of every future handoff.
- **P1 (projector mode)** — highest-value adopter after Classroom Timer.
- **P9 (phone as remote)** — a dashboard you can't reach from across the room
  is a dashboard you stop using.
- **P10 (keyboard-first)** — the whole page should be operable without
  precision clicking.

## Open Questions

- Should this become the site's landing page for a logged-in-feeling
  experience, with `index.html` remaining the public directory?
- Reading other tools' storage keys directly is fast but brittle — if any of
  those four tools changes shape, this page breaks silently. Is it worth
  defining a small shared read API first (P7/P8)?
