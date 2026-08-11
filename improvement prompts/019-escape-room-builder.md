# Improvement Prompts — 019 — Digital Escape Room / Puzzle Lock Builder

**Tool file:** `Tools/019-escape-room-builder.html`
**Support folder:** `Tools/escape-room-builder/` — `lock.html`, `monitor.html`,
`test/smoke-test-run.mjs`. The QR encoder comes from `_shared/vendor/qrcode/`
now, not a per-tool `lib/`.

**Current description (from README):** Chain QR-code puzzle stations into a linear or branching escape room — scanning one out of order sends a student back instead of giving away the clue.

---

## Status

**2026-08-11 — Teacher test-run mode (backlog rank 7).** Shipped the Quick
Win. A "Test run" button beside the print buttons opens a modal holding the
**real** `lock.html` in an iframe, loaded with the room as it currently
stands, so a teacher can walk the whole chain typing answers as a student
would before a single code is printed.

The decision that matters is that it runs the actual player rather than
reimplementing the matching in the builder. A second copy of
`normalizeTextAnswer` would drift, and the day it drifted the test run would
start certifying rooms that don't work. Everything the student gets — the
forgiving text comparison, digit locks, cipher decoding, hint costs, attempt
lockouts, the countdown, branching `next` — is exercised for free, and stays
correct without maintenance.

Isolation is done by stamping the test room's id with `::test`. `lock.html`
derives `PROGRESS_KEY` from `room.id`, so the rehearsal writes somewhere no
real player ever reads, and the key is cleared before each run. Two bugs found
building this, both caught by the test:

- The clear-before-run built its key from the *unsuffixed* id, producing
  `…::test::test` and clearing nothing — so a second test run resumed on the
  finish screen.
- Assigning the same `src` does not reload an iframe, so "Start over" on an
  unchanged room did nothing even once the key was cleared. It now reloads
  explicitly when the URL is unchanged.

Closing removes the `src` so a countdown isn't left ticking behind the modal.

**Noticed, not fixed:** the comment above `normalizeTextAnswer` in `lock.html`
claims `"It's a KEYBOARD!"` matches an accepted answer of `"a keyboard"`. It
doesn't — normalization strips the apostrophe to give `its a keyboard`, which
matches neither `keyboard` nor `a keyboard`. Either the comment is wrong or a
possessive/contraction rule was intended. Worth a look, but it's the player's
matching semantics, not this row.

New test: `Tools/escape-room-builder/test/smoke-test-run.mjs` (23 assertions,
wired into `npm test` and `npm run test:escape-room`) — drives the real player
inside the iframe: wrong answer refused, forgiving-but-correct answer accepted,
chain advancing to the finish, only a `::test` progress key written, a genuine
player's progress for the same room surviving, "Start over" really starting
over, and Escape unloading the frame.

**Where the next round should pick up:** the non-QR short-code fallback and a
payload-size warning are still the open items here. A test run is also the
natural place to hang a "this room's QR is too dense to scan" check, since it
already builds the same payload.

Earlier: reviewed — structural read of the source, before Round 4 (PR #55, see below)
shipped hints-with-a-cost, two new puzzle types, and the meta-puzzle letter
collection. Ideas below are deliberately ambitious and are **not** scoped to
a single session; items confirmed shipped are tagged **Done** below.

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
- **Teacher test run** (`startTestRun`) — the real `lock.html` in a modal
  iframe, on a `::test`-suffixed room id so it can never touch a student's
  saved progress
- Multiple saved rooms (`escape-room-builder:rooms`)

## Quick Wins

- **Done — Round 4.** **Hints with a cost.** A "stuck?" button that reveals a graded hint is the
  standard escape-room affordance and the main thing that keeps a struggling
  group from giving up. *(Shipped as a per-station `hintCost`; a costed hint
  no longer auto-reveals after two misses and is gated behind a manual "Show
  a hint (−N pts)" button instead.)*
- **Attempt limits and feedback.** "Not quite — check your spelling" versus
  "wrong" changes the experience considerably; so does a lockout after N
  wrong answers.
- **Answer matching that forgives.** Case, whitespace, and punctuation
  tolerance, plus optional numeric-answer matching with a tolerance.
- **Non-QR fallback.** A printed short code students type into `lock.html` on
  a shared device — QR requires every student to have a camera, which is not
  a safe assumption.
- **Done — 2026-08-11.** **Preview / test-run mode** for the teacher, walking the chain without
  printing anything. *(See the Status entry at the top of this file.)*
- **Skipped — Round 4 considered this and passed.** **Estimated payload size warning.** The whole room rides in the QR; a room
  with several images will silently produce an unscannable code (P3). *(The
  new per-station fields are all a few bytes and omitted when unused, so the
  existing try/catch QR-generation error remains the only size guard.)*
- **Station numbering that survives reordering**, so a reprint doesn't
  invalidate the codes already taped to the wall.

## Major Features

- **Done — already existed.** **Team progress tracking.** `018-qr-scavenger-hunt-builder.html` already has
  live teams, a timer, and a leaderboard; this tool has none. The two are
  siblings and should share that engine (P7). *(Turned out this was already
  fully built — WebRTC device pairing + a live roster in `monitor.html` — by
  an earlier, undocumented round; this section predated it. Round 4 only
  added a Score column to that existing roster.)*
- **Done — partial, Round 4.** **Puzzle types beyond text answers.** A digit lock, a directional lock, a
  cipher (Caesar / substitution) with an auto-generated key, a jigsaw of a
  clue image, a "collect four letters to spell the word" meta-puzzle. The
  meta-puzzle in particular is what makes an escape room feel like an escape
  room rather than a worksheet with QR codes. *(Shipped: digit lock, Caesar
  cipher, and the meta-puzzle letter collection. Still open: directional
  lock, jigsaw.)*
- **Skipped — deferred, Round 4.** **Branching that matters.** The next-station rule already supports jumps;
  building on it — different paths for different answers, optional side
  stations, a required set in any order — would make genuinely different runs
  for different groups. *(Real scope, not attempted this round.)*
- **Content from elsewhere** (P7). Pull questions from
  `030-review-game-board.html`'s bank or vocabulary from
  `040-vocab-flashcard-generator.html` so building a room for Friday doesn't mean
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

## Round 4 update — 2026-08-10 (PR #55)

Implemented three of the Major Features in one pass, all inside
`019-escape-room-builder.html`, `escape-room-builder/lock.html`, and
`escape-room-builder/monitor.html`. `qr-scavenger-hunt-builder` was not
touched.

**What shipped:**

- **Puzzle types beyond text.** Each station now has a `type`: Text (default,
  unchanged), **Digit lock** (student enters the code into per-digit boxes
  with auto-advance/backspace nav instead of a free-text field — same
  matching underneath), and **Caesar cipher** (teacher types a plain secret
  message and a shift 1–25; `lock.html` shows only the encoded ciphertext,
  student must decode and type the plaintext). `type`/`cipherShift` are
  omitted from the payload when unused, so a plain-text room's link is
  byte-for-byte what it was before this round.
- **Meta-puzzle letter collection.** Any station can optionally award a
  single letter on success (`awardLetter`). `lock.html` tracks earned letters
  in progress and shows a persistent "Letters collected: F _ O _" strip
  (blanks for stations not yet solved) on every clue screen and the finish
  screen — this is what makes a final "unscramble your letters" station
  actually work without students having to write anything down.
- **Hints with a cost.** Each station's hint can carry a point cost
  (`hintCost`, default 0/free). Cost-0 hints behave exactly as before
  (auto-reveal after 2 misses). Any hint with a cost > 0 is gated behind a
  "Show a hint (−N pts)" button — it no longer auto-reveals on misses, since
  a hint that's free after two wrong guesses isn't actually costing anything.
  Score is `100 × stations solved − cost of every hint actually spent`,
  computed client-side from `progress.solved`/`progress.hintsUsed` (both new,
  migrated in for old saved progress). Score only appears at all — on the
  clue screen, the finish screen, and now a **Score column in the teacher
  monitor roster** (`monitor.html`, sent over the existing WebRTC progress
  channel) — when at least one station in the room actually has a nonzero
  hint cost, so a plain riddle-chain room's UI is untouched.
- Answer key (on-screen and print) grew a "Letter" column and now shows
  puzzle-type detail per station — the cipher's shift, its literal encoded
  ciphertext, and the decoded plaintext side by side, so a teacher can
  proofread a cipher station without opening the student page.

**Note on team progress tracking:** this was already fully built (WebRTC
device pairing + live roster in `monitor.html`) by an earlier, undocumented
round — the "What it does today" section above predates it and is stale.
This round only added the Score column to that existing roster; the pairing
mechanism itself wasn't touched.

**Deliberately skipped / left for next round:**

- Branching on *which* answer was given (right now branching is per-station,
  not per-answer) and "required set in any order" — real scope, not attempted
  here.
- Attempt limits/lockouts, numeric-tolerance matching, and non-QR short-code
  fallback (Quick Wins list) — none touched.
- No payload-size warning UI was added. The new per-station fields are all a
  few bytes (a type string, a small int, one char) and are omitted when
  unused, so the existing try/catch around QR generation (which already
  reports "could not build a QR code for Station N") remains the only size
  guard. Worth revisiting if a room combines many cipher/digit stations with
  station images.
- Digit-lock box count is derived from the first accepted answer's string
  length (preserves leading zeros); a station with accepted-answer codes of
  different lengths will size boxes off the first one only — edge case, not
  handled.
- Cipher ciphertext is generated from only the *first* accepted answer if a
  teacher enters several comma-separated acceptable phrases for a cipher
  station; the others are accepted on submit but never shown encoded.
- No CDN dependencies added; no changes to the vendored `lib/qrcode.js` or
  `lib/jsqr.js`.

**Testing performed:** `node --check` on every inline `<script>` block
extracted from all three HTML files (all passed). A throwaway Playwright
(Chromium, headless) script built a 3-station room in the builder (text+
hint-cost+award-letter, digit lock, cipher), walked it end-to-end through
`lock.html` — confirmed the costed hint does *not* auto-reveal after two
misses, confirmed it reveals and deducts points on manual click, solved all
three stations, confirmed the final screen shows the correct score (290) and
the collected letter — then separately confirmed a legacy-format room
payload (no new fields at all) still renders with the pre-existing free-hint
auto-reveal behavior and no score/letters UI. A third script drove the print
Answer Key and QR Code views. All checks passed; scripts were deleted after.

## Pass 2 — Round 1 — 2026-08-10 — session `v19h3x`

Picked up the three items Round 4 explicitly left open, all inside
`019-escape-room-builder.html` and `escape-room-builder/lock.html`.
`monitor.html`, `lib/qrcode.js`, and `lib/jsqr.js` were not touched.

**What shipped:**

- **Attempt limits and feedback (Quick Win).** Each station now has an
  optional "Attempt limit before lockout" field in the builder
  (`maxAttempts`, blank = unlimited, omitted from the payload when unset).
  In `lock.html`, once a student's consecutive wrong guesses on a station
  reach that limit, they're locked out of guessing again for 30 seconds — a
  ticking countdown replaces the answer form (the clue, image, and hint stay
  visible) and resets automatically when it expires, clearing that station's
  miss counter so they get a fresh run at it. Progress persists the lockout
  (`progress.lockUntil`), so a reload or re-scan during a cooldown doesn't
  reset it early. This is orthogonal to puzzle type — it applies the same way
  to text, digit-lock, and cipher stations.
- **Near-miss feedback (Quick Win, overlaps with the item below).** A wrong
  text answer within a couple of edits (Levenshtein distance, scaled a little
  for longer answers) of an accepted answer now shows "So close — check your
  capitalization, spacing, and spelling, then try again." instead of the
  generic "Not quite — try again." Digit-lock and cipher wrong answers keep
  the generic message; a typo in a decoded cipher phrase or a fat-fingered
  digit doesn't get the same treatment since forgiving didn't make sense
  there either (see below).
- **Forgiving text-answer matching (Quick Win).** Text-type stations now
  compare answers after stripping *all* punctuation (not just the small set
  `normalizeAnswer` already handled) in addition to case and whitespace, via
  a new `normalizeTextAnswer`. Digit-lock and cipher stations deliberately
  keep using the original `normalizeAnswer` unchanged — those aren't
  free-typed answers, so loosening them further wasn't the ask. Text stations
  also gained an optional **numeric tolerance** (`numericTolerance`, e.g. an
  accepted answer of "3.14" with tolerance "0.05" also accepts "3.1"–"3.19")
  as a second, independent way to match, tried only after the exact/loose
  text match fails.
- **Edge case (b) — cipher with multiple accepted phrases — actually fixed.**
  `lock.html`'s cipher display and the builder's answer-key `typeDetail` both
  now encode and show *every* comma-separated accepted phrase, one per line,
  instead of only the first. A teacher who lists "open sesame, opensesame" as
  alternate acceptable phrasings now sees both correctly rendered as
  ciphertext for the student, and both correctly documented in the answer
  key — previously the second phrase was accepted silently on submit but
  never actually shown encoded anywhere.
- **Edge case (a) — digit-lock box count from the first answer only —
  validated/warned, not restructured.** A real fix would mean either forcing
  a single explicit "code length" field independent of the accepted-answer
  strings, or redesigning how fixed per-character boxes reconcile with
  variable-length accepted codes — real scope, not attempted. Instead, the
  builder now shows a live inline warning under the "Correct code" field
  whenever a digit-lock station's comma-separated accepted codes have
  inconsistent lengths ("⚠ These codes are different lengths (3, 4 digits) —
  the student will see boxes sized to the first code only (3). Use codes that
  are all the same length…"), so a teacher catches the mismatch before
  printing rather than discovering it when a team's correct-looking code
  won't fit the boxes. `lock.html`'s box-sizing behavior itself (first
  answer's length) is unchanged.
- Builder's answer-key `typeDetail` also grew a "locks out after N misses"
  note (any type) and a "(numeric match within ±N)" note (text type), so the
  printed/on-screen answer key documents both new fields per station.

**Data model additions (all optional, all omitted from the room payload when
unset, so a plain room without any of this is byte-for-byte unchanged):**
`station.maxAttempts` (int ≥ 1) and `station.numericTolerance` (number ≥ 0,
text stations only). `progress.lockUntil` (an object keyed by station index,
same shape as `progress.misses`/`progress.hintsUsed`) was added to
`lock.html`'s saved progress shape, migrated in for old saved progress the
same way `hintsUsed`/`letters` were in Round 4.

**Deliberately left as documented edge cases / not attempted:**

- Non-QR short-code fallback, preview/test-run mode, and station numbering
  surviving reordering (remaining Quick Wins) — not touched.
- Branching on *which* answer was given, and the rest of the Major Features
  list — not touched.
- Directional lock and jigsaw puzzle types — not touched.
- No payload-size warning UI added (unchanged reasoning from Round 4 — the
  new fields are a small int and a small number, omitted when unused).

**Testing performed:** `node --check` on the inline `<script>` blocks in both
changed files (both passed). A Playwright (Chromium, headless) script drove
the builder UI to build a 3-station room — a text station ("keyboard"/"a
keyboard", attempt limit 3), a digit-lock station with intentionally
mismatched-length accepted codes ("482, 4820", to exercise edge case (a)),
and a cipher station with two comma-separated accepted phrases ("open
sesame, opensesame", to exercise edge case (b)) — then walked the generated
player link end-to-end through `lock.html`: confirmed the builder's inline
digit-length warning appears and is visible; confirmed a plain wrong answer
("mouse") gets the generic message while a one-typo near-miss ("keybord")
gets the "So close" message; confirmed a third consecutive miss trips the
30-second lockout screen with a live countdown, persisted through a reload;
confirmed a correct answer that differs only by case, doubled whitespace,
and trailing punctuation ("A  Keyboard.") is now accepted; confirmed the
digit-lock still solves via the first accepted code's length (3 boxes);
confirmed the cipher station's box shows *both* accepted phrases correctly
encoded on separate lines and that decoding the *second* one (not just the
first) solves the station and finishes the room. Two smaller follow-up
Playwright scripts separately verified numeric-tolerance matching (accepts
within tolerance, rejects outside it) and that the builder's answer-key
preview text surfaces both the new attempt-limit and numeric-tolerance
details. All scripts were throwaway, run from the sandbox scratchpad
directory, not committed.

**Where the next round should pick up:** the still-open Quick Wins above
(non-QR fallback, preview/test-run mode, stable station numbering) are the
smallest remaining scoped items. If edge case (a) is revisited for a real
fix rather than a warning, the cleanest path is probably an explicit
`digitLength` field the teacher sets directly (defaulting to the first
answer's length for backward compatibility) rather than continuing to infer
box count from accepted-answer strings.

## Open Questions

- Should this and `018-qr-scavenger-hunt-builder.html` merge? They differ mainly
  in whether stations are ordered and whether teams are tracked.
- Given that students aren't intended users of this site, how much should the
  existing `lock.html` player page be leaned on at all? The printed paper
  packet and a typed short code on one shared classroom device are the
  teacher-facing alternatives, and it's worth deciding whether they become the
  primary path.
