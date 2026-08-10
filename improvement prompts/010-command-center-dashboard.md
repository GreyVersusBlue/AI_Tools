# Improvement Prompts — 010 — Command Center

**Tool file:** `Tools/010-command-center-dashboard.html`
**Support folder:** none — single file

**Current description (from README):** A timer, today's School Calendar Visualizer entry, and a no-repeats roster quick-call, side by side on one projector page.

---

## Status

**2026-08-10 — The widget architecture, the bell schedule, the morning
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
3. **Do Now / agenda strip (Major)** — pairs with the Classroom Timer's agenda
   mode, which shipped in an earlier round and is not read here yet. That is
   the most obvious next panel and it is a small one.
4. **More panels, now that they are cheap**: behaviour totals for the current
   period, the day's exit-ticket prompt, the number talk of the day, the
   current seating chart.
5. **The shared read API (second open question)** — still worth doing, and now
   with a concrete write case to design against rather than a hypothetical.
6. The **landing-page question** below is untouched and still Devon's call.

## What it does today

- Reads four other tools' storage keys and composes them on one page:
  `np_rosters` (roster), `scv_calendar_v1` (today's calendar entry),
  `hall-pass-log-sections` (who's currently out), plus its own settings
- **Timer** panel with quick durations (5/10/15/20m), Set, Start, Reset, and
  alert sounds (Bell / Buzzer / Chime / None, with Test)
- **Quick-call** roster panel with no-repeats exclusion, persisted per roster
  (`gvb-command-center:excluded:*`), and Reset turns
- Live **hall pass** readout of who is out right now

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
