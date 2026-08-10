# Improvement Prompts — Vocab & Conjugation Drill Generator

**Tool file:** `Tools/vocab-conjugation-drill.html`
**Support folder:** none — single file

**Current description (from README):** Vocabulary quiz drills (any language) and verb-conjugation tables with editable person/subject labels, each with a printable answer key.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Two modes: **vocabulary drill** and **conjugation tables**
- Language presets (Spanish, French, German, Latin) with **editable
  person/subject labels** (`applyPersonsPreset`, `renderPersonsList`) — the
  mechanism that makes it work for any language
- Verb/tense rows added freely (`renderConjugationEditor`, `renderConjList`)
- **On-screen quiz modes**: vocabulary self-check
  (`renderVocabOnScreenCheck`) and conjugation quiz
  (`renderConjugationQuiz`, `buildQuizOrder`, `checkQuizAnswers`,
  `nextQuizVerb`, `restartQuiz`)
- **Text-to-speech** (`speak`, `populateTtsLangSelect`, `listenButtonHtml`) —
  one of only two tools using `speechSynthesis`
- Printable drills and answer keys; saved sets
  (`gvb-vocab-conj:list` / `:data:*`) with import/export
- Loads `_shared/a11y.js`

## Quick Wins

- **Accented character input.** Typing á, ñ, ü, ç, ß on a US keyboard is the
  single biggest friction in this tool for both teacher and student. A click
  row of the target language's special characters solves it in a few lines.
- **Accent-tolerant answer checking**, with a "close — check your accent"
  response rather than a bare wrong.
- **Both directions.** Target→English and English→target are different skills
  and the drill should be able to do either or alternate.
- **Shuffle and limit** — 20 random items from a 100-word set, so one set
  generates many quizzes.
- **Multiple versions of the same quiz** in a different order, for a class
  where students sit close together.
- **Irregular-verb flagging**, so a conjugation table can highlight the forms
  that don't follow the pattern — which is the entire point of teaching them.
- **Fill-in-the-blank sentence mode** instead of bare conjugation tables,
  which is closer to how the skill is assessed.

## Major Features

- **Shared vocabulary store** (P7). This tool, 
  `vocab-flashcard-generator.html`, and `roleplay-scenario-generator.html`
  each hold vocabulary in their own format. One entered word list should
  produce flashcards, word wall cards, drills, a roleplay scaffold, and review
  game questions. This is the clearest content-reuse win on the site.
- **Spaced repetition for students.** A share link (P3) opens the set on a
  student device with a simple review schedule, progress stored locally on
  their machine. That's the mechanism that actually builds vocabulary, and it
  requires no server.
- **Conjugation pattern engine.** Given a verb and its type, generate the
  regular conjugation automatically and let the teacher correct the
  irregulars — rather than typing every form of every verb. For Spanish and
  French the regular patterns are entirely mechanical.
- **Audio for every item** (already possible via `speechSynthesis`) plus a
  listening quiz — hear the word, write it — which no other free tool offers
  offline.
- **Grammar reference sheets.** The conjugation tables are already a reference
  sheet; formalizing that output (and connecting it to
  `formula-sheet-builder.html`'s layout engine, P7) would give language
  classes the equivalent of a math formula sheet.
- **Progress tracking per student**, for the teacher — which words the class
  consistently misses, printable as a reteach list.

## Moonshot / North Star

**One word list, every practice format, in any language.** Type the vocabulary
once and get flashcards, word wall cards, printed drills in both directions
with answer keys, a conjugation table with the irregulars highlighted,
listening practice with real audio, a spaced-repetition review on the
student's own device, and review game questions — for Spanish, French, Latin,
ASL glossing, or a language the tool has never heard of, because the teacher
supplies the words and the person labels.

## Platform themes that matter here

- **P7 (cross-tool)** — a shared vocabulary store serving four tools is the
  headline opportunity.
- **P3 (share links)** — student-side spaced repetition with no accounts.
- **P4 (accessibility)** — TTS is already here; it's an accessibility asset
  worth extending across the site.
- **P6 (print quality)** — drills and answer keys.

## Open Questions

- What shape should a shared vocabulary record take (term, definition, part of
  speech, gender, example sentence, audio hint, image)? Designing it once
  across the four vocabulary-adjacent tools is the prerequisite for everything
  above.
- Is `speechSynthesis` voice quality and language availability reliable enough
  on school machines to build a listening quiz on, or does it need a fallback?
