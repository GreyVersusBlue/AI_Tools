# Improvement Prompts — Immersion Roleplay Scenario Generator

**Tool file:** `Tools/roleplay-scenario-generator.html`
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
  file away in `vocab-conjugation-drill.html`) is the highest-value Major
  Feature left unbuilt.
- The **shared per-language vocabulary store** Open Question is now more
  pressing: this round added a *second* class-scoped fill-in store (useful
  phrases) parallel to the scenario-specific one, which strengthens the case
  for unifying vocabulary storage across this tool,
  `vocab-conjugation-drill.html`, and `vocab-flashcard-generator.html` rather
  than letting each tool keep growing its own.

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
  record, would be genuinely valuable — and `rubric-builder.html` already has
  scoring machinery to reuse (P7).
- **Audio.** `vocab-conjugation-drill.html` already uses `speechSynthesis`
  with a language selector; hearing the target-language prompts spoken would
  serve pronunciation directly, and the code already exists one file away.
- **Culture and context notes** per scenario — the register, the customs, what
  would be rude — which is what separates a language lesson from a phrasebook.
- **Chain scenarios into a unit.** Ordering, paying, complaining, and
  returning an item are one restaurant unit; a sequence with growing
  complexity is more useful than a shuffle.
- **Convergence with the other language tool** (P7).
  `vocab-conjugation-drill.html` holds vocabulary sets per language; this tool
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
  `vocab-conjugation-drill.html` and `vocab-flashcard-generator.html` also
  read? That would let one entered word list serve drills, flashcards, and
  roleplays.
- How much shipped scenario content is worth writing, versus making the
  custom-scenario authoring so good that teachers build their own?
