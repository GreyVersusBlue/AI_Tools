# Improvement Prompts — PE Warm-Up Circuit Card Generator

**Tool file:** `Tools/pe-warmup-circuit-generator.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** A default 8-station calisthenics
circuit (or build from scratch), each with an emoji, duration/reps, and
instructions, printed as large station cards.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from
the Ideas Backlog. Closes out the Ideas Backlog's per-tool "coming soon"
list entirely — every idea that was on the board across two rounds of
building has now shipped.

A default 8-station warm-up circuit (jumping jacks, high knees, butt
kicks, arm circles, walking lunges, push-ups, plank hold, bodyweight
squats), each with an emoji, a name, a duration/rep count, and
instructions/cues, or a blank template to build a custom circuit from
scratch. Fully editable station list (add/remove/edit any field), and
print produces large station cards (2/4/6/8 per page) meant to be posted
around the gym before students rotate through.

Caught and fixed one real bug during smoke testing, the same class of
bug found five times elsewhere this round: the built-in "Push-Ups"
station's instructions used the HTML entities `&mdash;` and `&deg;` as
literal text inside a JS string, which would have been double-escaped
into literal "&mdash;"/"&deg;" text everywhere that instruction is
displayed (the editable textarea, the live preview, and the printed
card) since all three pass the string through `escapeHtml()`. Fixed by
using the actual Unicode em dash (—) and degree (°) characters in the
source instead. Verified with a headless Chromium smoke test: default
template loads 8 stations with the corrected instructions text
rendering as real characters (not escaped entity text) in the textarea,
the preview, and the printed output; added a custom 9th station and
removed a default one, confirming the edited list persists correctly to
`localStorage`; switched to the blank template (with the destructive-
replace confirm dialog accepted) and back to the default template,
confirming both transitions work; and confirmed print output includes
all expected cards with no console errors.

Nothing below has been started.

## What it does today

- Default 8-station calisthenics circuit, or a blank starting point
- Per-station emoji, name, duration/reps, and instructions, fully editable
- Add/remove stations; confirm-gated template switching
- Print: station card grid (2/4/6/8 per page)
- Autosaves to `localStorage` (`pe_circuit_v1`)

## Quick Wins

- **Reorder stations** via up/down buttons, matching the pattern used
  throughout this toolkit (Gallery Walk QR Codes, several tools this
  round) — station order matters for a circuit's flow and there's no way
  to fix a misordered list today short of deleting and re-adding.
- **A simple emoji picker** (a small palette of common exercise-related
  emoji to click, alongside the free-text field) instead of requiring a
  teacher to know how to type or paste an emoji character.
- **Multiple named saved circuits**, matching the multi-save convention
  used by most builder tools in this round — one flat circuit per
  browser right now, so a teacher running different circuits for
  different units/sports can't keep them separate.
- **Duplicate a station** (for building near-identical stations quickly,
  e.g. "Push-Ups — Beginner" and "Push-Ups — Advanced" with slightly
  different rep counts) instead of retyping every field.

## Major Features

- **A "run the circuit" live projector/timer mode**, following the
  pattern already proven in Gallery Walk QR Codes: a rotation timer that
  counts down per station and signals when it's time to rotate, so this
  tool could drive the actual circuit live in addition to printing the
  station signage beforehand.
- **Difficulty tiers per station** (e.g. beginner/standard/advanced rep
  counts for the same exercise) so one circuit card set serves a mixed-
  ability class without printing three separate circuits.
- **A roster-linked station rotation chart**: given a class roster and a
  station count, auto-generate which student/group starts at which
  station and in what order they rotate — turns this from "signage only"
  into a full circuit-management tool.
- **Exercise image/diagram support** (like a photo per station, similar
  to Student Art Portfolio Label & QR Tag Maker's photo upload) for
  exercises that are easier to demonstrate visually than to describe in
  text, especially for stations run without direct teacher supervision.

## Moonshot / North Star

**A complete PE circuit-running tool**: build the stations once, print
the signage, then run the actual rotation live on a projector with a
timer and an auto-generated roster rotation chart — closing the loop
between "the cards on the wall" and "who's where, doing what, for how
long" without a teacher needing to track it by hand.

## Platform themes that matter here

- **P1 (milestone)** — this tool closes the Ideas Backlog's original
  per-tool list; the next "batch" of work is either newly-added ideas or
  the Platform-Wide big-swing ideas that were deliberately excluded from
  this two-round sprint since they touch the whole site rather than
  adding one new tool page.
- **P7 (cross-tool)** — the "run the circuit" timer described above
  would directly reuse Gallery Walk QR Codes' rotation-timer pattern
  (round count, minutes/seconds per round, sound-on-rotate, pause/
  resume/reset) rather than inventing a new one.
- **P12 (data integrity)** — the `&mdash;`/`&deg;`-through-`escapeHtml()`
  bug found here is the fifth instance of this exact bug class this
  round (Verb Conjugation Reference Poster Generator, Sub Note/Feedback
  Slip Generator, Science Fair Project Tracker, Government/Civics Role
  Card Generator, and now this one); this is a strong signal that a
  dedicated sweep for "HTML entity written as literal text in a JS
  string literal, later passed through escapeHtml()" across every tool
  in the toolkit would find more instances than the ones caught by
  chance during smoke testing.

## Open Questions

- Is a live-run timer mode a natural fit for this tool specifically, or
  should the toolkit instead have one shared, reusable rotation-timer
  component that Gallery Walk QR Codes and this tool (and any future
  station-rotation tool) all reference, rather than three independent
  copy-pasted implementations?
- Should difficulty tiers be a per-station field (three rep counts
  stored on one station) or three entirely separate saved circuits
  (beginner circuit, standard circuit, advanced circuit) — the former is
  more compact to build once, the latter is simpler to print/post
  separately per class section?
