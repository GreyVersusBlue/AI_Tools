# Improvement Prompts — 014 — Immersion Roleplay Scenario Generator

**Tool file:** `Tools/014-roleplay-scenario-generator.html`
**Support folder:** none — single file

**Current description (from README):** Real-life dialogue scenarios with vocabulary scaffolding cards you fill in for whatever language you teach.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

### Round 3 (2026-08-10) — shipped

- **Roster-backed role assignment (P2).** A new "Roster for this class" row
  loads a saved roster from `np_rosters` (same read-only pattern as the lab
  safety tracker) per roleplay class/session, stored in a new
  `rosterByClass` object (`gvb-roleplay:roster`) parallel to the existing
  `fillsByClass`. "Randomly pair up the class" then Fisher-Yates shuffles
  the whole roster into partner pairs (an odd student out joins the last
  pair as a labeled helper/observer rather than being dropped), randomly
  assigning Role A/B per pair, and displays the pairing in a new "Class
  pairing" box on the stage.
- **Print role cards, one per student.** "Print role cards (one per
  student)" uses that pairing to print one page per student: their own name
  and role prominently, their partner named (but not the partner's private
  role details), plus the shared vocabulary scaffolding and useful-phrases
  grid both partners need. Falls back to an alert asking the teacher to load
  a roster and pair up first if no pairing exists yet.
- **Useful-phrases box.** A fixed set of six generic conversational tools
  ("Could you repeat that?", "I don't understand", "How do you say ___?",
  etc.) with the same language-agnostic fill-in-the-target-language
  mechanic as the per-scenario vocabulary cards, saved once per class
  (`usefulFillsByClass` / `gvb-roleplay:usefulFills`) rather than per
  scenario, and shown on the stage and included in every printed handout
  and role card.
- Rename/Delete class now also move or clear the roster, useful-phrases,
  and in-memory pairing for that class, matching how they already handled
  `fillsByClass` — a rename or delete that left roster data behind under
  the old class name would have been a quiet data leak between classes.

Verified end-to-end in a headless Chromium run: seeded a 5-student roster,
loaded it, paired the class (2 pairs + 1 helper, matching the odd-count
handling), confirmed the useful-phrases box renders and its fill-ins persist
into print output, and confirmed "Print role cards" produces exactly 5 cards
(one per student, including the helper card) with the filled useful phrase
present.

### Challenges

- Deciding what a printed role card should and shouldn't show: showing the
  partner's specific role text felt like it undercuts "each participant
  mainly sees their own side," so the card names the partner but not the
  partner's role. Worth revisiting with actual classroom feedback — some
  teachers may want the full picture on one card for younger or lower-level
  classes.
- Class-wide pairing is intentionally in-memory only (`classPairs`, not
  persisted), matching the existing precedent set by `roleFlips` in the same
  file — both reset on reload. This means reloading mid-class loses the
  pairing (roster and fill-ins survive; the pairing doesn't). Flagged rather
  than fixed, since persisting it raises the same "is this still valid
  today" staleness question the file's other per-scenario state already
  sidesteps by not persisting.

### Where the next round should pick up

- **Sentence-frame layer**, **difficulty variants**, and **success-criteria
  strip** (Quick Wins) are still open and are independent of everything
  shipped this round.
- **Audio via `speechSynthesis`** (Major Feature, code already exists one
  file away in `039-vocab-conjugation-drill.html`) is the highest-value Major
  Feature left unbuilt.
- The **shared per-language vocabulary store** Open Question is now more
  pressing: this round added a *second* class-scoped fill-in store (useful
  phrases) parallel to the scenario-specific one, which strengthens the case
  for unifying vocabulary storage across this tool,
  `039-vocab-conjugation-drill.html`, and `040-vocab-flashcard-generator.html` rather
  than letting each tool keep growing its own.

### Pass 2 — Round 1 — 2026-08-10 — session `v19h3x`

- **Audio via `speechSynthesis`.** A small "&#128266; Speak" button now sits
  next to every vocabulary fill-in textarea, every new sentence-frame
  textarea, and every useful-phrases textarea. Clicking one reads that
  field's current value aloud with `window.speechSynthesis`, ported from the
  same pattern already used in `039-vocab-conjugation-drill.html` (cancel any
  in-flight utterance, wrap `speak()` in try/catch so a blocked or missing
  API never throws). A "Pronunciation" language `<select>` (the same
  ~20-language BCP-47 list as the conjugation drill tool: es-ES, fr-FR,
  de-DE, it-IT, pt-PT, la, en-US, zh-CN, ja-JP, ko-KR, ru-RU, ar-SA, hi-IN,
  nl-NL, el-GR, he-IL, vi-VN, pl-PL, tr-TR, sv-SE) sits in the class toolbar
  row and is saved **per class** in a new `ttsLangByClass` object
  (`gvb-roleplay:ttsLang`), parallel to `fillsByClass`/`rosterByClass`, so
  switching classes switches the speak voice along with the roster and
  fill-ins. Rename/Delete class now also move or clear this new store, same
  as the existing per-class stores. If `'speechSynthesis' in window` is
  false, the language `<select>` and every "Speak" button render `disabled`
  rather than the click throwing.
- **Sentence-frame layer.** Each vocabulary scaffolding card now has a second,
  optional "Sentence frame" textarea beneath the existing vocabulary
  textarea — teacher-authored, target-language, with a `___` blank marker
  (e.g. "Je voudrais ___, s'il vous plaît."). Stored in a new
  `framesByClass` object (`gvb-roleplay:frames`), same
  `{ className: { scenarioId: [text, ...] } }` shape as `fillsByClass`, so it
  rides along with the same per-class/per-scenario indexing and array-length
  padding logic (`framesFor()` mirrors `fillsFor()`). Empty by default —
  existing scenarios and existing saved classes show a blank frame field and
  nothing else changes. Renders on the stage and, only when a frame has text
  (skipped entirely when blank, matching how empty vocab fills already print
  as a blank line), in both `handoutHtml()` (the plain print handout) and
  `roleCardHtml()` (the per-student role cards), styled as an italic line
  above the vocabulary fill-in row via a new `.h-frame` print rule. Custom
  scenario deletion now also purges that scenario's entries out of
  `framesByClass` for every class, matching the existing `fillsByClass`
  cleanup.

Verified in a headless Chromium (Playwright) run: (1) filled in a vocab
field, a sentence-frame field, and a useful-phrase field, set the
pronunciation language to es-ES, clicked each of the three "Speak" buttons,
and captured the actual `speechSynthesis.speak()` calls — each fired with
the correct text and `lang: "es-ES"`, with zero console/page errors; (2)
reloaded and confirmed both the vocab and sentence-frame text persisted;
(3) confirmed "Print this scenario" produces a `.h-frame` block containing
the sentence-frame text in the print output; (4) seeded `localStorage`
directly with a Round-3-shaped legacy class (`gvb-roleplay:fills`,
`:usefulFills`, `:roster`, `:current`, `:currentClass` present, but
deliberately **no** `gvb-roleplay:frames` and **no** `gvb-roleplay:ttsLang`
keys at all — simulating a class saved before this round) and reloaded:
the app booted with zero errors, the existing scenario/vocab/useful-phrase
fills all rendered correctly, the new sentence-frame field rendered empty,
and the pronunciation select defaulted to `es-ES`.

#### Challenges (Pass 2 — Round 1)

- Deciding whether "Speak" buttons belonged on the sentence-frame field too,
  since the two Quick Wins were listed as separate items and the ask only
  explicitly named the vocabulary fields and the useful-phrases box. Added
  it anyway — a sentence frame is target-language text a student needs to
  hear just as much as the vocabulary word, and the marginal cost was one
  more `speakBtnHtml()` call using the same generic click-dispatch handler
  keyed by `data-kind`. Worth revisiting if a future round wants the frame
  row visually/functionally quieter than the vocabulary row it scaffolds.
- The per-class TTS language store adds a fourth parallel `...ByClass`
  object (after fills, roster, useful-fills) alongside a fifth for frames —
  the rename/delete class handlers are now five near-identical
  move-or-delete blocks in a row. This further strengthens the case (see the
  Open Question below) for consolidating all of this class-scoped state
  into one object keyed by class name instead of five separate
  `localStorage` keys that must each be threaded through rename/delete by
  hand.

#### Where the next round should pick up (Pass 2 — Round 1)

- **Difficulty variants of one scenario** and **success criteria /
  self-assessment strip** (Quick Wins) are still open and independent of
  everything shipped this round.
- **Undo on Delete custom scenario** (P11, Quick Win) is still open.
- The **Assessment layer**, **culture and context notes**, **chain scenarios
  into a unit**, and **convergence with the other language tool** (Major
  Features) are all still open; audio was the one Major Feature this round
  picked up.
- Now that both this tool and `039-vocab-conjugation-drill.html` have their
  own copy of the same ~20-entry TTS language list and the same
  `speak()`/try-catch pattern, the case for a shared `_shared/tts.js` (voice
  list + speak helper) alongside the existing `_shared/a11y.js` is
  concrete, not hypothetical — two tools already duplicate it verbatim.

## What it does today

- Scenario bank browsable by **category** and **level**, with prev/next and
  shuffle; filters persisted (`gvb-roleplay:filter`, `:levelFilter`)
- **Teacher-authored custom scenarios** (`gvb-roleplay:custom`) with a full
  add form and a managed list
- **Per-class vocabulary fills** (`gvb-roleplay:fills`, `:currentClass`) — the
  language-agnostic mechanism: you supply the target-language vocabulary for
  whatever language you teach, saved per class
- **Random role assignment** to students
- **Handout set builder** — select several scenarios and print them together
  (`renderSetList`, `handoutHtml`, "print selected handouts")
- Loads `_shared/a11y.js`

## Quick Wins

- **Done —** **Load a roster for role assignment** (P2). Random role assignment currently
  has no access to `np_rosters`. *(Shipped as the "Roster for this class" row
  plus "Randomly pair up the class" — see Round 3 above.)*
- **Done —** **Print role cards, one per student**, rather than one handout with all
  roles on it — a roleplay works better when each participant only sees their
  own side.
- **Done —** **Useful-phrases box** per scenario (greetings, asking for clarification,
  polite disagreement) that the student can lean on — the scaffolding that
  makes a nervous student attempt the conversation at all. *(Shipped saved
  once per class rather than per scenario — see Round 3 above.)*
- **A sentence-frame layer** beneath the vocabulary layer: "I would like ___,
  please" is more supportive than a word list.
- **Difficulty variants of one scenario** — a supported version with frames
  and a challenge version with only a goal, printed together for a
  differentiated class.
- **Success criteria / self-assessment strip** on the handout, so students
  know what a good attempt looks like.
- **Undo on Delete custom scenario** (P11).

## Major Features

- **Assessment layer.** Speaking is the hardest thing to assess in a language
  classroom. A quick rubric tap per pair during a roleplay, with a printable
  record, would be genuinely valuable — and `003-rubric-builder.html` already has
  scoring machinery to reuse (P7).
- **Audio.** `039-vocab-conjugation-drill.html` already uses `speechSynthesis`
  with a language selector; hearing the target-language prompts spoken would
  serve pronunciation directly, and the code already exists one file away.
- **Culture and context notes** per scenario — the register, the customs, what
  would be rude — which is what separates a language lesson from a phrasebook.
- **Chain scenarios into a unit.** Ordering, paying, complaining, and
  returning an item are one restaurant unit; a sequence with growing
  complexity is more useful than a shuffle.
- **Convergence with the other language tool** (P7).
  `039-vocab-conjugation-drill.html` holds vocabulary sets per language; this tool
  holds vocabulary fills per class. They should share one vocabulary store.

## Moonshot / North Star

**A speaking curriculum for any language, in the teacher's own vocabulary.**
Scenarios sequenced into units, each with role cards per student, sentence
frames and useful phrases for the students who need them, spoken audio for
pronunciation, culture notes for context, a rubric the teacher taps while
circulating, and a printed record of every student's speaking progress — all
language-agnostic, because the teacher supplies the words.

## Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see `_platform-themes.md`). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Role cards on student devices** by link/QR instead of printing. Printing
  thirty half-sheets is the teacher-facing path.

## Platform themes that matter here

- **P7 (cross-tool)** — a shared vocabulary store with the conjugation drill
  tool, and the rubric engine for speaking assessment.
- **P2 (shared roster)** — role assignment and per-student records.
- **P6 (print quality)** — per-student role cards are the deliverable.
- **P3 (share links)** — sending a scenario set to a colleague who teaches the
  same language.

## Open Questions

- Should the vocabulary fills live in a shared per-language store that
  `039-vocab-conjugation-drill.html` and `040-vocab-flashcard-generator.html` also
  read? That would let one entered word list serve drills, flashcards, and
  roleplays.
- How much shipped scenario content is worth writing, versus making the
  custom-scenario authoring so good that teachers build their own?
