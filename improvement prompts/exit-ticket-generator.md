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

- **Paper triage that's actually fast.** The teacher reads the paper slips
  and taps each student got-it / almost / reteach on a class grid, then
  prints the reteach list for tomorrow and the small-group split. The
  reading is unavoidable; the sorting, counting, and list-making are what
  currently eat the prep period.
- **A projected discussion board the teacher types into.** Transcribe two or
  three anonymous responses onto the projector for a whole-class
  conversation — the "show me the class's thinking" move — driven entirely
  from the teacher's machine.
- **Tally by response category**, not just a raw count, so the existing Quick
  Tally can capture "12 got it, 9 partial, 7 confused" and chart it over time.
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
prompt, run the think time, collect the paper slips, and then triage a class
set in the time it takes students to pack up — tapping got-it / almost /
reteach down a grid, projecting two anonymous responses for a thirty-second
whole-class discussion, and printing tomorrow's small-group list on the way
out. All local, all private, all from the teacher's machine.

## Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see `_platform-themes.md`). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Digital response collection.** A QR/link students type a response into on
  their own device, returned to the teacher's browser over `webrtc-pair.js`.
  Technically the most distinctive thing the site could build with the pairing
  module, and out of scope regardless. Paper slips plus the fast triage grid
  above are the teacher-facing answer.
- **Live student response board** fed by those submissions.

## Platform themes that matter here

- **P9 (device pairing)** — teacher-side only: a phone remote for advancing
  prompts and running think time while circulating.
- **P2 (shared roster)** — named class sets and per-student triage.
- **P7 (cross-tool)** — the prompt-bank/display/handout trio it shares with
  Number Talks and Writing Prompt Generator.
- **P1 (projector mode)** — a display tool with no fullscreen.

## Open Questions

- ~~Is collecting student responses something this site should do?~~
  **Answered: no.** The site is teacher-facing; students aren't intended users.
  Paper collection plus fast teacher-side triage is the direction.
- Should the three prompt-bank tools merge into one with modes, or stay
  separate and share a library?
