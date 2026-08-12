# Improvement Prompts — 039 — Vocab & Conjugation Drill Generator

**Tool file:** `Tools/039-vocab-conjugation-drill.html`
**Support folder:** none — single file

**Current description (from README):** Vocabulary quiz drills (any language) and verb-conjugation tables with editable person/subject labels, each with a printable answer key.

---

## Status

**2026-08-12 — Backlog round: share a drill set by link / QR shipped
(backlog rank 2).** The tool now loads `_shared/state-link.js` and the
vendored QR encoder and grew **🔗 Copy link** and **▦ QR code** toolbar
buttons, copying the `040-vocab-flashcard-generator.html` pattern almost
verbatim (same share-note/overlay markup, same `?param=` consume-on-load
flow; the param here is `?set=`). The payload is the full drill-set state —
words, verbs, person labels, direction/limit/shuffle settings — nothing in
this tool is too big for a URL, though a very large set can outgrow a QR
code, which is caught and reported with the payload size instead of drawing
an unscannable square. Opening a link validates with the existing
`isPlausibleDrillSet()`, saves under a uniqued name (`… (shared)` on
collision), and clears the param so refresh can't double-import;
`loadSetByName()`'s existing field-defaulting covers payloads from older
senders. Verified with a headless Chromium test over a local static server:
copy-link round trip into a fresh browser context (name + vocab arrive,
param cleared, no duplicate on reload), collision uniquing, QR overlay
draw/close, garbled-link error path — zero console errors. Next round:
fill-in-the-blank sentence mode is still the open Quick Win.

**2026-08-11 — Pass 2 round.** Shipped **accent-tolerant answer checking**,
the smaller of the two Quick Wins this file's Pass 1 round left deferred —
scoped to the conjugation self-quiz (`checkQuizAnswers`/
`renderConjugationQuiz`), the only place in this tool that compares typed
text against an answer (the vocab self-check is reveal-on-click, never
typed). A new `answerMatch(typed, correct)` returns `'correct'` /
`'close'` / `'wrong'`: exact match (case/whitespace-insensitive, as
before) is `'correct'`; a match only after `stripDiacritics()` (Unicode
NFD decomposition, stripping the combining-marks block) is `'close'`; a
blank answer is always `'wrong'`, never a false "close" via two empty
strings comparing equal. Scoring stayed strict — only an exact match counts
toward `quizScore`, matching the prompt's framing ("a response rather than
a bare wrong," not free credit for a missed accent) — but the on-screen
mark now reads "≈ close — check your accent (‹answer›)" instead of a bare
✗, with a third `.quiz-row.close` amber state alongside the existing
green/red. Verified with a headless Playwright pass seeding a Spanish verb
with an accented form (está): exact match → correct, accent-stripped match
→ close (with the right message), a blank answer → wrong (not close), and
a wrong word entirely → wrong. No JS console errors.

Not attempted this round: **fill-in-the-blank sentence mode**, the other
deferred Quick Win (it needs an example-sentence field per conjugation
entry plus a blank-generation rule — a bigger addition than this round's
scope), and everything under Major Features/Moonshot.

**2026-08-10 — implementation round.** Shipped all five Quick Wins scoped for
this round: the accented-character helper, both-directions drilling,
shuffle-and-limit, multiple print versions, and irregular-verb flagging.
Storage stayed additive — every new field (`langPreset`, `vocabDirection`,
`vocabLimit`, `printVersions`, and `irregular` per conjugation entry) is
defaulted in `loadSetByName()` for sets saved before this round, and the
`isPlausibleDrillSet()` import validator didn't need to change since it only
checks the fields that already existed.

What shipped, in order of the Quick Wins list:

- **Accented-character input** — a card at the top of the page (visible in
  both modes) with a Language select (Spanish/French/German/Latin, decoupled
  from the person-label presets below it) and a row of that language's
  special characters. Clicking one inserts it at the cursor of whichever
  text field was last focused — tracked via a page-wide `focusin` listener,
  not just the vocab textarea — so it works for the set name, the vocab
  list, and every infinitive/tense/conjugated-form field. This is a UI-only
  addition with no new storage risk beyond the one saved `langPreset` string.
- **Both-directions drill mode** — a Direction select (target→English,
  English→target, or alternate-each-item) drives a new `directedPair()`
  helper that both the printed drill (`vocabDrillPages`) and the on-screen
  self-check (`renderVocabOnScreenCheck`) now call instead of reading
  `item.word`/`item.translation` directly. The listen button deliberately
  still always speaks `item.word` (the target-language term) regardless of
  which side is showing — hearing the English side pronounced in the
  target-language TTS voice would be wrong, and revealing the target word
  audibly during an English→target quiz would give the answer away.
- **Shuffle-and-limit** — a "Limit to N random items" field, honored by a new
  `vocabItemsForRender()`. Limiting draws a random subset; whether that
  subset then keeps its *original relative order* or gets fully shuffled is
  controlled independently by the existing "Shuffle order" checkbox, so
  "which words" and "what order" are two composable knobs rather than one.
- **Multiple print versions** — a "Print versions" count next to the Print
  button. At 1 (the default) nothing changes from before. Above 1, each
  version gets its own fresh random draw/order (via the new
  `vocabItemsForVersion()`, which ignores the shuffle checkbox since
  randomizing is the entire point) and its own "Version N" kicker line on
  the printed page, for both vocab and conjugation content and in combined
  mode. Version 1 of a single-version vocab print reuses exactly the items
  currently on screen (cached as `lastPreviewVocabItems`) so print always
  matches the live preview.
- **Irregular-verb flagging** — a checkbox on each conjugation entry
  (`entry.irregular`) that bolds/colors the verb heading and adds a small
  "IRREGULAR" tag, in both the printed conjugation table (`conjCardHtml`)
  and the on-screen quiz mode (`renderConjugationQuiz`). The flag is
  per-entry (a whole verb+tense row), not per individual form — that matches
  how the editor already models a "row."

Also built this round: the lightweight **cross-tool bridge** to Vocabulary
Flashcard & Word Wall Generator (see the Open Questions section below for
the shape and what's not yet bridged).

Not attempted this round, and explicitly out of scope per the task: **Accent-
tolerant answer checking** and **Fill-in-the-blank sentence mode** (both
Quick Wins in the backlog below, left for a future round), and everything
under Major Features / Moonshot.

## What it does today

- Two modes: **vocabulary drill** and **conjugation tables**
- Language presets (Spanish, French, German, Latin) with **editable
  person/subject labels** (`applyPersonsPreset`, `renderPersonsList`) — the
  mechanism that makes it work for any language
- **Accented-character helper** (`ACCENT_SETS`, `renderAccentRow`,
  `insertAtCursor`) — a per-language click row that inserts at the cursor of
  whichever field was last focused
- **Direction control** (`directionForIndex`, `directedPair`) — target→English,
  English→target, or alternating, for both the printed drill and the
  on-screen self-check
- **Shuffle-and-limit** (`vocabItemsForRender`) and **multiple print versions**
  (`vocabItemsForVersion`, the `printVersions` field) for anti-copying
- Verb/tense rows added freely (`renderConjugationEditor`, `renderConjList`),
  each optionally flagged **irregular** (`entry.irregular`), highlighted in
  the printed table and the quiz
- **On-screen quiz modes**: vocabulary self-check
  (`renderVocabOnScreenCheck`) and conjugation quiz
  (`renderConjugationQuiz`, `buildQuizOrder`, `checkQuizAnswers`,
  `nextQuizVerb`, `restartQuiz`) — the conjugation quiz's typed-answer
  check is **accent-tolerant** (`answerMatch`/`stripDiacritics`): exact
  match scores correct, an accent-only mismatch is flagged "close" rather
  than a bare wrong, and scoring stays strict either way
- **Text-to-speech** (`speak`, `populateTtsLangSelect`, `listenButtonHtml`) —
  one of only two tools using `speechSynthesis`
- Printable drills and answer keys; saved sets
  (`gvb-vocab-conj:list` / `:data:*`) with import/export
- **Share by link / QR** (`_shared/state-link.js` + vendored qrcode encoder):
  a `?set=` URL or scannable QR carries the whole set; opening one saves a
  uniquely-named copy on the receiving machine
- **Read-only import bridge** from Vocabulary Flashcard & Word Wall
  Generator's saved word lists (`listFlashcardSets`, `getFlashcardItems`)
- Loads `_shared/a11y.js`

## Quick Wins

- **Done —** **Accented character input.** Typing á, ñ, ü, ç, ß on a US keyboard is the
  single biggest friction in this tool for both teacher and student. A click
  row of the target language's special characters solves it in a few lines.
  *(Shipped as a Language select + character row, tracking whichever field
  was last focused across both modes.)*
- **Done — 2026-08-11.** **Accent-tolerant answer checking**, with a "close — check your accent"
  response rather than a bare wrong. *(A three-state `answerMatch()` —
  correct / close / wrong — on the conjugation self-quiz; scoring stays
  strict (only exact counts), the feedback message is what changed. See
  Status.)*
- **Done —** **Both directions.** Target→English and English→target are different skills
  and the drill should be able to do either or alternate. *(Added a Direction
  select — fixed either way, or alternating per item — feeding a shared
  `directedPair()` helper used by both the printed drill and the on-screen
  check.)*
- **Done —** **Shuffle and limit** — 20 random items from a 100-word set, so one set
  generates many quizzes. *(A "limit to N random items" field, composable
  with the existing shuffle checkbox: limit picks which words, shuffle picks
  the order.)*
- **Done —** **Multiple versions of the same quiz** in a different order, for a class
  where students sit close together. *(A "print versions" count; each
  version beyond the first gets a fresh random draw/order and its own
  "Version N" kicker on the page, for vocab, conjugation, and combined
  print.)*
- **Done —** **Irregular-verb flagging**, so a conjugation table can highlight the forms
  that don't follow the pattern — which is the entire point of teaching them.
  *(A per-entry checkbox; highlighted in both the printed conjugation card
  and the on-screen quiz header.)*
- **Skipped — deferred.** **Fill-in-the-blank sentence mode** instead of bare conjugation tables,
  which is closer to how the skill is assessed. *(Not part of this round's
  scoped list — it needs an example-sentence field per conjugation entry and
  a blank-generation rule, which is a bigger addition than the five items
  above; a natural next Quick Win.)*

## Major Features

- **Partially done — lightweight bridge shipped, full hub deferred.**
  **Shared vocabulary store** (P7). This tool, 
  `040-vocab-flashcard-generator.html`, and `014-roleplay-scenario-generator.html`
  each hold vocabulary in their own format. One entered word list should
  produce flashcards, word wall cards, drills, a roleplay scaffold, and review
  game questions. This is the clearest content-reuse win on the site.
  *(A full shared hub was explicitly out of scope for this round. Instead,
  this tool and `040-vocab-flashcard-generator.html` each got a small read-only
  bridge to the other's saved lists, copying the pattern
  `025-writing-prompt-generator.html`'s `wpg-rubric-link.js` established: no
  shared library, no format negotiation, just one tool reading the other's
  own localStorage keys and converting on the way in. See Open Questions
  below for the exact shape and what's still not bridged — that's where a
  future round building the real hub should pick up.)*
- **Spaced-repetition scheduling for printed drills.** The tool tracks which
  items the class has seen and when, and weights each new printed drill
  toward the words that are due for review — the retrieval-practice benefit,
  delivered on paper by the teacher.
- **Conjugation pattern engine.** Given a verb and its type, generate the
  regular conjugation automatically and let the teacher correct the
  irregulars — rather than typing every form of every verb. For Spanish and
  French the regular patterns are entirely mechanical.
- **Audio for every item** (already possible via `speechSynthesis`) plus a
  listening quiz — hear the word, write it — which no other free tool offers
  offline.
- **Grammar reference sheets.** The conjugation tables are already a reference
  sheet; formalizing that output (and connecting it to
  `041-formula-sheet-builder.html`'s layout engine, P7) would give language
  classes the equivalent of a math formula sheet.
- **Progress tracking per student**, for the teacher — which words the class
  consistently misses, printable as a reteach list.

## Moonshot / North Star

**One word list, every practice format, in any language.** Type the vocabulary
once and get flashcards, word wall cards, printed drills in both directions
with answer keys, a conjugation table with the irregulars highlighted, a
projected listening exercise with real audio, printed drills automatically
weighted toward the words due for review, and review game questions — for
Spanish, French, Latin, ASL glossing, or a language the tool has never heard
of, because the teacher supplies the words and the person labels.

## Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see `_platform-themes.md`). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Student-device spaced repetition.** A share link opening the set on a
  student's own device with a review schedule stored locally. Scheduling the
  *printed* drills instead keeps the retrieval-practice benefit teacher-side.

## Platform themes that matter here

- **P7 (cross-tool)** — a shared vocabulary store serving four tools is the
  headline opportunity.
- **P3 (share links)** — sharing a drill set with another language teacher.
- **P4 (accessibility)** — TTS is already here; it's an accessibility asset
  worth extending across the site.
- **P6 (print quality)** — drills and answer keys.

## Open Questions

- **Resolved 2026-08-10 — partially, with a lightweight answer.** What shape
  should a shared vocabulary record take (term, definition, part of speech,
  gender, example sentence, audio hint, image)? Designing it once across the
  four vocabulary-adjacent tools is the prerequisite for everything above.
  — This round didn't design the full shared shape, but it did establish a
  concrete small one for the one bridge it built: `{term, definition,
  partOfSpeech, example, pronunciation}`, borrowed from
  `040-vocab-flashcard-generator.html`'s own storage format (which gained
  `partOfSpeech` and `pronunciation` fields this same round — see that
  tool's improvement file). This tool's own vocab format is still just
  `{word, translation}` — it has no fields for part of speech, example
  sentence, or pronunciation, so the bridge (`getFlashcardItems` here,
  `VfgConjDrillLink` in the flashcard tool's folder) only carries
  term/definition in *either* direction; everything else is silently
  dropped on import, by design (documented in-code at both bridge
  functions, not invented on the receiving end). **Not yet bridged:**
  `014-roleplay-scenario-generator.html`'s vocabulary log; any of
  part-of-speech/example/pronunciation/gender/audio/image; a write-back
  path (both bridges are strictly read-only, one-time-copy imports, not a
  live sync). A future round building the real shared hub should start from
  that five-field shape, decide whether this tool's conjugation-drill
  format should grow matching fields or stay minimal-by-design (a drill set
  is arguably not the place for a Frayer-model's worth of metadata), and
  decide whether the hub owns canonical records with every tool reading
  through it, or whether more pairwise bridges like this one are good
  enough. This round deliberately didn't decide that — it only proved the
  pairwise-bridge pattern works for a second pair of tools.
- Is `speechSynthesis` voice quality and language availability reliable enough
  on school machines to build a listening quiz on, or does it need a fallback?
  *(Still open — not investigated this round.)*
