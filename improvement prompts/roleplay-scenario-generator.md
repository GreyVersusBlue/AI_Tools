# Improvement Prompts — Immersion Roleplay Scenario Generator

**Tool file:** `Tools/roleplay-scenario-generator.html`
**Support folder:** none — single file

**Current description (from README):** Real-life dialogue scenarios with vocabulary scaffolding cards you fill in for whatever language you teach.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

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

- **Load a roster for role assignment** (P2). Random role assignment currently
  has no access to `np_rosters`.
- **Print role cards, one per student**, rather than one handout with all
  roles on it — a roleplay works better when each participant only sees their
  own side.
- **Useful-phrases box** per scenario (greetings, asking for clarification,
  polite disagreement) that the student can lean on — the scaffolding that
  makes a nervous student attempt the conversation at all.
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
