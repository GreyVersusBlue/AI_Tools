# Improvement Prompts — Exit Ticket / Bell Ringer Generator

**Tool file:** `Tools/exit-ticket-generator.html`
**Support folder:** `Tools/exit-ticket-generator/` — `lib/qrcode.js`

**Current description (from README):** A bank of short warm-up and reflection prompts with a big projector display, plus a printable handout mode for half- or quarter-sheet exit tickets.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Two tabs: **Prompt & Display** (projector) and **Printable Handout**
- Built-in prompt bank by category, plus a **custom prompt bank** the teacher
  adds to (`gvb-exit-ticket:customPrompts`)
- Shuffle / next prompt, "new set of prompts", and a session history of what's
  already been shown today
- **Think time** timer with a chime (30s / 1min / 2min / off)
- Handout printing at 2-per-page (half sheets) or 4-per-page (quarter sheets),
  with either the same prompt on every slip or **a different prompt on each**
- **Quick Tally** counter with reset (`gvb-exit-ticket:tally`)
- QR code support

## Quick Wins

- **Name and date lines on the slips.** An exit ticket you can't attribute is
  an exit ticket you can't use; this should be on by default with a toggle.
- **A response box sized for the prompt**, and lined vs blank as a choice.
- **Print a whole class set** with names pre-printed from `np_rosters` (P2) —
  the same batch pattern Certificate Maker and Permission Slip already have.
- **Tag prompts by subject and by purpose** (recall, reflection, prediction,
  self-assessment) so the bank is browsable rather than only shuffleable.
- **Pin / favourite prompts** and a "don't show me this one again" control.
- **Import a prompt list** from a paste (P13) instead of adding one at a time.
- **Bigger projector type and fullscreen** (P1) — this is a display tool
  without a proper display mode.

## Major Features

- **Digital collection without a server.** Hand out a QR/link (P3), students
  type a response on their device, and it comes back to the teacher's browser
  over `webrtc-pair.js` (P9) or as a scannable code — a live response board
  with nothing stored anywhere but the two browsers. This is the feature that
  would make the tool a daily habit, and it's the most distinctive thing this
  site could build with the pairing module it already has.
- **A real response board.** Collected or hand-tallied responses displayed
  anonymously for discussion — the "show me the class's thinking" move that
  makes exit tickets pedagogically worthwhile.
- **Sorting and triage.** Mark responses as got-it / almost / reteach as you
  read them, and print the reteach list for tomorrow.
- **Bell-ringer sequences.** A prompt per day for a week or a unit, planned in
  advance and advanced automatically by date, rather than shuffled each
  morning.
- **Standards / objective tagging** so the prompt bank can be filtered by what
  you're actually teaching that day.
- **Number Talks and Writing Prompt convergence** (P7). This tool, 
  `number-talks-board.html`, and `writing-prompt-generator.html` are three
  implementations of "bank of prompts + projector display + printable
  handout". They should share the bank format and the display engine even if
  they stay separate front doors.

## Moonshot / North Star

**Formative assessment that closes the loop in one class period.** Show the
prompt, give think time, collect responses on student devices with no
accounts, see the class's thinking anonymously on the projector, sort it into
got-it and reteach while students pack up, and print tomorrow's small-group
list on the way out — all local, all private, all in under five minutes.

## Platform themes that matter here

- **P9 (device pairing)** — the response-collection idea is the standout, and
  the module already exists.
- **P2 (shared roster)** — named class sets and per-student triage.
- **P7 (cross-tool)** — the prompt-bank/display/handout trio it shares with
  Number Talks and Writing Prompt Generator.
- **P1 (projector mode)** — a display tool with no fullscreen.

## Open Questions

- Is collecting student responses — even locally and ephemerally — something
  Devon wants this site doing at all? It crosses from "teacher's tool" into
  "student-facing", which is a meaningful line and worth an explicit decision.
- Should the three prompt-bank tools merge into one with modes, or stay
  separate and share a library?
