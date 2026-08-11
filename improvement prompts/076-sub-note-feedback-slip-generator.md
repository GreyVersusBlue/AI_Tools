# Improvement Prompts — 076 — Sub Note / Feedback Slip Generator

**Tool file:** `Tools/076-sub-note-feedback-slip-generator.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** An editable list of prompts, each printed with blank lines, as repeated half-sheets a substitute fills out by hand before leaving for the day.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: four default prompts (what worked, what didn't, names/notes
for tomorrow, anything else), fully editable (edit/add/remove any prompt),
a copy-count field, and a print view that repeats the slip as half-sheets
(date/class-period/sub-name line at the top of each). Single current prompt
list autosaved to `localStorage` (`snfs_slip_v1`). Verified with a headless
Chromium smoke test (default prompts render correctly including an
apostrophe, add a prompt, print 3 copies) — no console errors.

This is the simplest tool built so far in this batch — deliberately so,
matching how short a real sub note is meant to be.

**2026-08-11 — Round (session `b4zswl`).** Shipped two of the three Quick
Wins: (1) **print layout QA** — the real bug here was that `.slip` used a
fixed `height: 47vh; overflow: hidden` in print CSS, so a prompt list long
enough to overflow half a page got silently clipped, losing content with
no visual sign anything was missing. Fixed by switching to
`min-height: 47vh; overflow: visible` and adding a threshold: with 5 or
fewer filled prompts (the shipped default is 4) the slip still prints two
per page as before; beyond that, `#printArea` gets a `.one-up` class and
each slip gets its own full page instead. This only fixes 076's own
instance — Peer Feedback / Editing Checklist Generator and Art Critique
Worksheet Generator flagged the identical fixed-height-clipping risk in
their own files and are still unfixed; out of scope for this round. (2) A
**"Class/Period" field** next to the copy-count field: when filled in, it
pre-fills that value on the meta-line of every printed copy instead of a
blank line the sub has to hand-write on each one; left blank, it falls
back to the original blank underscore line exactly as before. Did not
attempt "multiple named saved prompt sets" — see Open Questions. Verified
with a headless Chromium/Playwright smoke test: filled in a class/period
and confirmed it appears pre-filled on the printed meta-line; added
prompts past the 5-prompt threshold and confirmed `#printArea` picked up
the `one-up` class; confirmed the default 4-prompt case still prints
without it — zero console errors. `node --check` passed on both inline
scripts.

## What it does today

- 4 default prompts, fully editable (edit text, add/remove)
- Copy-count field; optional Class/Period field that pre-fills every
  printed copy's meta-line
- Print N half-sheets with a date/period/sub-name line; automatically
  switches to one full-page slip per copy instead of clipping once the
  prompt list is long enough to risk overflowing a half-sheet

## Quick Wins

- **Multiple named saved prompt sets** — a general sub note and a
  specialized one (e.g. for a lab day, or a day with a fire drill scheduled)
  could both be worth keeping ready, matching the multi-save convention
  used elsewhere in this toolkit.

## Major Features

- **Direct pairing with Sub Plan Builder and Sub Binder Generator** — this
  slip is explicitly the "end of the day" companion to the "start of the
  day" sub plan packet those tools already build. A link or bundled-print
  option connecting all three (plan going out, note coming back) would
  close a loop the backlog description implies but doesn't yet build.
- **A digital version** for a sub without a working printer, or for a
  teacher who wants the feedback captured in a searchable form rather than
  a paper slip left on the desk — could feed into a simple per-day archive
  (loosely similar to Parent/Guardian Contact Log's history list) instead
  of being a one-time throwaway slip.
- **A "flag for follow-up" checkbox** on print so a sub can mark the slip
  urgent (e.g. "call me about this") versus routine, giving the teacher a
  fast signal on which slips need reading first the next morning.

## Moonshot / North Star

**The sub note that's actually left behind, because it took the sub thirty
seconds and gave the teacher exactly what they need the next morning — tied
directly to the plan that sent the sub in, not a disconnected slip of
paper.** Pairing with Sub Plan Builder/Sub Binder Generator turns "leave a
note" into a natural bookend of the whole sub-day workflow already built
elsewhere in this toolkit.

## Platform themes that matter here

- **P7 (cross-tool)** — the most direct opportunity here: Sub Plan Builder
  and Sub Binder Generator already exist and cover the other half of the
  same day.
- **P6 (print quality)** — this tool's own half-sheet height-cap risk is
  fixed as of this round (see Status); the identical risk still exists in
  Peer Feedback / Editing Checklist Generator and Art Critique Worksheet
  Generator, which share the same `.slip { height: Nvh; overflow: hidden }`
  print pattern and would benefit from the same fix.

## Open Questions

- Should Sub Binder Generator (which already assembles Sub Plan Builder's
  details and a seating chart into one packet) grow to include this slip as
  a blank page at the end, or should this stay a standalone tool a teacher
  prints separately, closer to the door, on the way out?
- Is a digital/archived version worth building given this toolkit's
  deliberately lightweight, throwaway framing for sub notes, or does
  "a slip on the desk" stay the right permanent shape for this specific
  tool?
