# Improvement Prompts — 019 — Digital Escape Room / Puzzle Lock Builder

**Tool file:** `Tools/019-escape-room-builder.html`
**Support folder:** `Tools/escape-room-builder/` — `lock.html`, `lib/qrcode.js`

**Current description (from README):** Chain QR-code puzzle stations into a linear or branching escape room — scanning one out of order sends a student back instead of giving away the clue.

---

## Status

**2026-08-13.** Shipped **"Printable non-digital version"** (Major Features,
below) — the paper-packet fallback for the day the Chromebooks aren't
charged, all inside `019-escape-room-builder.html`; no other file touched.

- A new "Paper packet (no devices)" card sits next to the QR/answer-key print
  buttons. **Print Paper Packet** builds `buildRoomPayload(validStations())`
  — the same source of truth as the QR codes, the on-screen preview, and the
  test run — into cut-apart station cards followed by a teacher-key page, so
  the packet can't say something different from the digital room built from
  the same stations.
- Each card shows the clue, the station's image, and a type-appropriate
  answer area (blank lines for text, per-digit boxes sized off the first
  accepted code for a digit lock, only the *ciphertext* for a cipher — never
  the plaintext). A costed or free hint prints upside-down under a dashed
  rule, the paper stand-in for the on-screen "spend N points" click. A
  station that awards a meta-puzzle letter prints an empty box, not the
  letter — the letter only appears in the teacher key, so a curious team
  can't read every card and skip solving the meta-puzzle.
- The teacher key reuses `answerRowHtml` — the exact same per-station row
  markup as the existing Print Answer Key — so there is one source of truth
  for "what does a teacher need to see per station," whether the room runs by
  QR or by paper.
- Every valid station gets a card, reachable or not; clicking Print Paper
  Packet runs `unreachableStations(buildRoomPayload(valid))` first and warns
  in `#msg` (by station number, printing anyway) if the chain has an orphan —
  the same check the test run already surfaces, now also on the print path.
- "Cards per printed page" (1 or 2) is a saved-state option
  (`state.packetCardsPerPage`, defaults `'2'`), following the existing
  `cardsPerPage`/QR pattern; the printed grid gets a `pk-1`/`pk-2` class that
  drives page-break placement so cards don't split across a page.
- No new files, so no `sw.js` change — everything lives inside the one HTML
  file that was already precached.

**Testing performed:** `Tools/escape-room-builder/test/smoke-test-run.mjs`
grew from 39 to 84 assertions covering the packet specifically: extends the
existing 3-station branching room with a digit-lock station (costed hint,
awarded letter) and a cipher station, re-routes the chain's old end into the
new stations (leaving the original orphan still orphaned) to exercise
ordering and branching together, then asserts — one card per valid station
in order; the digit code never appears on the card but the right number of
boxes do; the hint text and its point cost are on the card but the awarded
letter is not; the cipher card shows the ciphertext and never the plaintext;
the `#msg` warning names the still-orphaned station and explains why;
`packetKeyBody` has one row per station with the digit code, the awarded
letter, and both the cipher's ciphertext and decoded plaintext present — full
answer-key completeness; and that switching "cards per page" actually
changes the grid's class on reprint. `npm run test:escape-room`: 84 passed, 0
failed. `node Tools/board-check/check-dedupe.mjs`: clean.

**2026-08-12 — session `r8kq4t`.** Backlog rank 2, "answer matching for
contractions", filed as a live bug. **The bug it named was not real, and two
adjacent ones in the same function were.** Worth recording exactly, because
the row is the sort of thing a future session would take at face value.

- **The reported case works and always did.** `normalizeTextAnswer` deletes
  apostrophes rather than spacing them, so `it's` has collapsed to `its` since
  the function was written; a student typing either against an accepted answer
  written with the other has always been let through. The row's example —
  typing `it's a keyboard` against an accepted `a keyboard` — is not an
  apostrophe question at all. Those are two different answers, and the only
  rule that would join them is "accept anything containing the accepted
  answer", which also accepts `I don't know` at a station whose answer is
  `no`. Left refused on purpose; the accepted-answers field is a
  comma-separated list, so a teacher who wants the sentence adds the sentence.
- **What was actually broken, and both from one line.** `replace(/[^a-z0-9
  ]/g, '')` deleted *every* mark, and ran after whitespace had already been
  collapsed:
  - `well-known` became `wellknown`, which matches nothing a teacher would
    have typed. A hyphen separates words; deleting it glued them.
  - any mark with spaces around it left a **double space** behind. `1 / 2`
    normalized to `1  2`, and nothing else normalizes to that, so an answer
    written with spaces around a slash or a dash could not be got right by
    anybody, including the teacher who wrote it.
- **Rewritten as four ordered passes** with the order documented in the file,
  since the order is where the bugs lived: strip accents (`café` = `cafe`,
  which a language classroom will hit), delete apostrophes in all five shapes
  a keyboard or Word produces, delete a `.` or `,` **between two digits** so
  `1,000` still equals `1000` and `3.14` stays one token, then turn every
  other run of non-alphanumerics into a single space.
- `normalizeAnswer` — the light one, for digit locks and ciphers — now strips
  curly quotes alongside the straight ones it already handled. A teacher
  drafting a cipher phrase in Word gets U+2019 whether they ask for it or not,
  and a Chromebook keyboard gives the student U+0027; the two have to
  normalize together or the same phrase passes on one device and fails on the
  other.
- The builder's own hint text claimed "ignore case, extra spaces, and
  punctuation" while the code did something narrower. It now describes what
  the matcher does and says plainly that a longer answer is still a different
  answer.
- `test/smoke-test-run.mjs` grew from 7 shared-matcher cases to 16 (57
  assertions, from 39), each new one a case that used to fail a correct
  student. Every case still runs through **both** pages, so the builder's test
  run and `lock.html` cannot drift apart.

Reviewed — structural read of the source, before Round 4 (PR #55, see below)
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
- **Teacher test run** (`startTestRun`, `renderTestRun`, `unreachableStations`)
  — walk the chain in the builder, answering as a student would, with the
  answer key one click away and unreachable stations named at the end
- **Shared answer matcher** (`escape-room-builder/er-match.js`) used by both
  `lock.html` and the builder's test run, so the two cannot disagree. Text
  answers ignore case, spacing, punctuation, hyphenation and accents, treat an
  apostrophe as inside a word rather than between two, keep number separators
  glued (`1,000` = `1000`), and optionally accept a numeric answer within a
  per-station tolerance. They are not substring matches.
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
- **Done — 2026-08-11.** **Preview / test-run mode** for the teacher, walking
  the chain without printing anything. *(A "Test run (no printing)" button
  opens a modal that walks the real payload through the real matcher, ending
  with any station the chain can never reach. See the test-run round below.)*
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
- **Done — 2026-08-13.** **Printable non-digital version** — the same puzzle
  chain as a paper packet, for the day the Chromebooks aren't charged. *(A
  "Print Paper Packet" button builds cut-apart station cards plus a teacher
  key from `buildRoomPayload(validStations())`; see the Status entry above.)*

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

## Test-run round — 2026-08-11 (backlog rank 1)

Shipped **"Preview / test-run mode for the teacher"**.

**"▶ Test run (no printing)"** sits with the print buttons and enables under
exactly the same condition they do. It opens a modal that walks the chain the
way a student meets it — one station at a time, the real clue, the real image,
the ciphertext a cipher station actually shows, the hint behind its own button
with its point cost, the same near-miss wording, and the same branching.

Three decisions worth keeping:

- **It walks the real payload.** The modal runs `buildRoomPayload(validStations())`
  — byte-for-byte what gets encoded into the QR — rather than reading the
  editor rows. A test run against the editor's raw state would not catch the
  index remapping that happens when a blank row is dropped, which is precisely
  the class of bug worth catching.
- **One matcher, extracted.** Answer checking moved out of `lock.html` into
  `escape-room-builder/er-match.js`, loaded by both pages. A test run using a
  second implementation of "is this correct" would be testing the wrong thing,
  and the two would drift. The suite asserts both pages agree case by case.
- **It ends by naming unreachable stations.** A breadth-first walk from station
  1 over the `next` rules finds stations nothing ever routes to — a real
  authoring bug that the answer key cannot show you, because every station
  looks fine on its own row.

It is a dry run: nothing is written to storage, unlike opening the player link,
which starts real progress for that room on that device. Reopening starts clean.

New suite `Tools/escape-room-builder/test/smoke-test-run.mjs` (39 checks) as
`npm run test:escape-room`: seven matcher cases asserted identical in the
builder and in `lock.html`, then a real three-station room whose first station
jumps past the second — the walk, the branch, the miss counter, the near-miss
message, the hint, the teacher answer reveal, the finish summary naming the
orphaned station, no storage written, and a clean reopen.

`sw.js`: `er-match.js` added to `PRECACHE_URLS` (lock.html now depends on it
offline), `CACHE_VERSION` v90 → v91.

### Where the next round should pick up

- **Non-QR fallback** (a printed short code students type into `lock.html`) is
  now the most valuable open Quick Win — QR assumes every student has a working
  camera, which is not safe.
- **Attempt limits and feedback** partly shipped earlier (`maxAttempts`); the
  test run displays it but does not simulate the lockout cooldown, since the
  cooldown is wall-clock and a teacher proofreading a room should not be made
  to wait it out. If that turns out to matter, simulate it with a fake clock
  rather than a real one.
- The test run does not simulate scoring or the countdown timer. Both are
  observable on the real player link and neither affects whether the chain is
  correct, which is what this mode is for.
