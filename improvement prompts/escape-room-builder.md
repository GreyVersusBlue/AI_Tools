# Improvement Prompts — Digital Escape Room / Puzzle Lock Builder

**Tool file:** `Tools/escape-room-builder.html`
**Support folder:** `Tools/escape-room-builder/` — `lock.html`, `lib/qrcode.js`

**Current description (from README):** Chain QR-code puzzle stations into a linear or branching escape room — scanning one out of order sends a student back instead of giving away the clue.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Build a room as a chain of **stations**, each with a prompt, an answer (or
  several accepted answers via `splitAnswers`), an optional image, and a
  **next-station rule** — auto (next in order), jump to a specific station, or
  end the room. That branching rule is the tool's real cleverness.
- Encodes the whole room into the QR payload (`encodeRoom`, `buildRoomPayload`)
  so `lock.html` can validate an answer with no server
- Station images with automatic downscaling (`downscaleStationImage`)
- Print **station QR codes** at 1–8 per page with selectable error correction
- Print a separate **answer key**; live chain preview
- Multiple saved rooms (`escape-room-builder:rooms`)

## Quick Wins

- **Hints with a cost.** A "stuck?" button that reveals a graded hint is the
  standard escape-room affordance and the main thing that keeps a struggling
  group from giving up.
- **Attempt limits and feedback.** "Not quite — check your spelling" versus
  "wrong" changes the experience considerably; so does a lockout after N
  wrong answers.
- **Answer matching that forgives.** Case, whitespace, and punctuation
  tolerance, plus optional numeric-answer matching with a tolerance.
- **Non-QR fallback.** A printed short code students type into `lock.html` on
  a shared device — QR requires every student to have a camera, which is not
  a safe assumption.
- **Preview / test-run mode** for the teacher, walking the chain without
  printing anything.
- **Estimated payload size warning.** The whole room rides in the QR; a room
  with several images will silently produce an unscannable code (P3).
- **Station numbering that survives reordering**, so a reprint doesn't
  invalidate the codes already taped to the wall.

## Major Features

- **Team progress tracking.** `qr-scavenger-hunt-builder.html` already has
  live teams, a timer, and a leaderboard; this tool has none. The two are
  siblings and should share that engine (P7).
- **Puzzle types beyond text answers.** A digit lock, a directional lock, a
  cipher (Caesar / substitution) with an auto-generated key, a jigsaw of a
  clue image, a "collect four letters to spell the word" meta-puzzle. The
  meta-puzzle in particular is what makes an escape room feel like an escape
  room rather than a worksheet with QR codes.
- **Branching that matters.** The next-station rule already supports jumps;
  building on it — different paths for different answers, optional side
  stations, a required set in any order — would make genuinely different runs
  for different groups.
- **Content from elsewhere** (P7). Pull questions from
  `review-game-board.html`'s bank or vocabulary from
  `vocab-flashcard-generator.html` so building a room for Friday doesn't mean
  writing eight new questions.
- **Printable non-digital version** — the same puzzle chain as a paper packet,
  for the day the Chromebooks aren't charged.

## Moonshot / North Star

**A review activity students ask for, built in a planning period.** Pick a
topic, pull questions the toolkit already has, choose a puzzle mix and a
difficulty, and get a printed set of station cards, a teacher answer key, a
live team leaderboard, and a fallback paper packet — with branching so groups
don't bottleneck, hints so nobody stalls out, and a finish that feels earned.
No accounts, no uploads, works with the wifi down.

## Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see `_platform-themes.md`). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Single-link student run.** One link/QR that opens the whole chain on a
  student device with progress kept locally, rather than a scan per station.

Note: this tool already ships `lock.html`, a student-operated player page, and
the printed QR codes are scanned by students by design. That's existing
behaviour and isn't being reclassified — but new work should favour the
printed/teacher-run paths (the paper packet, the typed short code on a shared
classroom device) over deepening student-device use.

## Platform themes that matter here

- **P3 (state in the URL)** — the whole design rests on it; payload size is
  the binding constraint and deserves an explicit budget.
- **P7 (cross-tool)** — shares a problem with the scavenger hunt builder and
  a content need with the review game board.
- **P12 (storage/images)** — station images are base64 in `localStorage` and
  also inflate the QR payload.
- **P6 (print quality)** — station cards get handled, taped, and re-scanned;
  error correction and print size are functional decisions here.

## Open Questions

- Should this and `qr-scavenger-hunt-builder.html` merge? They differ mainly
  in whether stations are ordered and whether teams are tracked.
- Given that students aren't intended users of this site, how much should the
  existing `lock.html` player page be leaned on at all? The printed paper
  packet and a typed short code on one shared classroom device are the
  teacher-facing alternatives, and it's worth deciding whether they become the
  primary path.
