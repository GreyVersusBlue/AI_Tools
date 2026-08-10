# Improvement Prompts — Classroom Timer

**Tool file:** `Tools/Classroom Timer.html`
**Support folder:** `Tools/classroom-timer/` — `ct-app.js`, `lib/jsqr.js`, `lib/qrcode.js`

**Current description (from README):** Big-digit projector timer: countdown, transition presets, random-interval surprise cues, stopwatch, and round-robin stations.

---

## Status

Reviewed — structural read of the source. The ideas below are deliberately
ambitious and are **not** scoped to a single session. A future agent should
pick what fits the session and leave the rest for later.

## What it does today

- Five modes: Countdown, Transition (one-click 1/2/5 min), Random Interval,
  Stopwatch (with Lap), Round-Robin stations
- Quick-duration buttons (5m/10m/15m/20m/30m) and "Save as preset"
- Alert sounds: Bell, Buzzer, Chime, None, with a Test button
- Fullscreen presentation mode
- **Mirror to a device** — serverless WebRTC pairing with QR-code offer/answer
  exchange, so a second screen or a student tablet shows the same timer
- Persists preferences (`ct_prefs`) and a running timer (`ct_running_v1`)
- Loads `_shared/a11y.js`, `_shared/state-link.js`, `_shared/webrtc-pair.js`,
  `_shared/qr-scan.js`

## Quick Wins

- **Screen Wake Lock.** Request `navigator.wakeLock` while a timer runs. A
  projector-connected laptop dimming or sleeping thirty seconds before the
  timer ends is the single most annoying failure this tool can have.
- **Drift-proof ticking.** Drive the display from `Date.now()` deltas rather
  than accumulated `setInterval` counts. Background tabs throttle to once a
  second or worse, and a 20-minute timer can end visibly wrong.
- **Colour-state thresholds.** Green → amber (last 25%) → red (last 10%), so
  a student who glances up reads the urgency without reading the digits.
  Make the thresholds configurable; make the colours colour-blind safe.
- **Silent/visual alert mode.** A full-screen flash or border pulse instead of
  a sound — for testing days, quiet rooms, and rooms where the laptop audio
  goes through the projector and is either muted or deafening.
- **Volume slider and per-sound preview**, remembered per sound choice.
- **Mirror the remaining time into the tab title** so it's readable from a
  taskbar when the tool is behind slides.
- **Custom end-of-timer message.** "Pencils down." "Line up." "Switch." Shown
  huge at zero instead of a bare 00:00.
- **Overtime count-up.** After zero, keep counting *up* in red rather than
  stopping — teachers want to know they're four minutes over.
- **Keyboard shortcuts**: space start/pause, R reset, F fullscreen, 1–9 to
  fire saved presets, Esc to leave fullscreen. Print them in a help overlay.
- **Named presets with an icon/colour**, not just a duration — "Do Now",
  "Turn and Talk", "Clean Up" read faster than "5:00".

## Major Features

- **Agenda / segmented timer.** Chain several named segments into one run:
  Do Now 5m → Notes 15m → Practice 20m → Exit Ticket 5m. Projector shows the
  current segment large, the next segment small, and a slim progress bar for
  the whole period. This is the feature most likely to change how the tool is
  used daily, and it subsumes Round-Robin as a special case.
- **Count down to a wall-clock time.** "Until 10:42" rather than "17 minutes."
  Teachers think in bell times; the conversion is a small tax paid many times
  a day.
- **Bell-schedule awareness.** Read the School Calendar Visualizer's day type
  (`scv_calendar_v1`) and/or a stored bell schedule so the timer can offer
  "rest of this period" as a one-click duration and know that today is a half
  day. See P7.
- **Multi-timer board.** Two to four independent timers side by side on one
  projected page — for stations, for differentiated group work, or for a lab
  with staggered steps.
- **Sound design that survives a school laptop.** Ship several vendored
  alert sounds (not just three tones), allow a locally-chosen audio file, and
  fall back to Web Audio synthesis when a file won't play.
- **Reconnecting mirror.** `webrtc-pair.js` pairing currently has to be
  redone if the connection drops. Persist the pairing and auto-reoffer, and
  let the paired device act as a *remote* (start/pause/next-segment from a
  phone while walking the room), not just a passive mirror. See P9.
- **Ambient period bar.** A thin always-visible strip showing how much of the
  period is left, designed to sit at the top of a projected slide deck rather
  than take the whole screen.

## Moonshot / North Star

**The lesson conductor.** The timer stops being a stopwatch and becomes the
thing that runs the period. It knows the day's agenda (typed here, or handed
over from Sub Plan Builder / the Calendar), drives the projector, mirrors to
the teacher's phone as a remote and to a student screen as a display, chimes
the transitions, and afterwards can show — and print — where the time
actually went versus where it was planned to go. A substitute could open one
link and have the whole period paced for them.

## Platform themes that matter here

- **P1 (dark/projector mode)** — this is the most-projected tool on the site
  and still does not load `theme-toggle.js`. It should be the first adopter.
- **P9 (device pairing)** — one of only two tools using `webrtc-pair.js`; the
  patterns proven here should be lifted into other projector tools.
- **P10 (keyboard-first)** — a timer that needs a mouse mid-lesson has failed.
- **P4 (accessibility)** — `prefers-reduced-motion` for any flashing alert,
  and a live region announcing state changes.

## Open Questions

- Should Round-Robin remain here, or move to / merge with the rotation engine
  in `pe-tournament-stations.html`? Two implementations of the same idea
  currently exist.
- How much of the agenda idea belongs here versus in a new tool that this one
  consumes?
- Is a microphone-based noise meter something worth having, given the strict
  local-only rule? (It can be done entirely in-browser with no recording, but
  it needs a very clear explanation to the teacher.)
