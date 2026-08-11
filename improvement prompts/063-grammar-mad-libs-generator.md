# Improvement Prompts — 063 — Grammar Mad Libs Generator

**Tool file:** `Tools/063-grammar-mad-libs-generator.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Four built-in story templates (or write your own with {tag} placeholders), a "fill randomly" demo reveal, and a printable worksheet with a word-bank suggestion box per blank type.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: four built-in story templates using a simple `{tag}`
placeholder syntax (noun, plural-noun, verb, verb-ed, adjective, adverb,
place, name, number, exclamation, color, animal, food, body-part,
subject-area), a custom-story textarea that accepts the same tag syntax, a
"fill randomly" button that swaps every blank for a random word bank pick
(for a projector demo of the finished silly story), and a print view with
labeled blanks plus a word-bank suggestion box per part-of-speech tag used.
State doesn't persist across reloads (custom stories aren't saved) — a
deliberate MVP cut. Verified with a headless Chromium smoke test (blank
count per template, random fill, clear, template switch, custom story,
print) — no console errors. One piece of dead/misleading code was caught
and removed during the build: an unused per-occurrence caching mechanism
for random fills that never actually cached anything (each blank was
already independently randomized via the regex replace callback,
regardless of the dead cache-key lookup) — removed for clarity, no
behavior change.

**2026-08-11 — Round 2 (session `9iiyas`).** Shipped the top three Quick
Wins below: custom stories now autosave to `localStorage`
(`gmlg_custom_story_v1`, debounced 300ms) and restore on load, without the
built-in-template select ever clobbering the saved/typed custom text; a
visible, always-on tag-reference chip row now sits above the custom-story
textarea (derived from `Object.keys(WORD_BANK)` so it can't drift out of
sync with the actual tag list) — clicking a chip inserts that tag at the
cursor position; and 3 new built-in templates ("The Science Fair Disaster,"
"Space Mission Log," "Weekend at Grandma's House") joined the original 4,
for 7 total. Verified with headless Playwright: reload-persistence,
chip-click insertion, and per-template blank counts for all 7 templates —
no console errors. The per-tag word-count-control Quick Win below is the
one item from this round's original four not yet done.

## What it does today

- 7 built-in templates + custom story input, both using `{tag}` syntax
- Custom story autosaves to `localStorage` and survives a reload
- A visible, click-to-insert tag reference row next to the custom-story
  textarea
- 14 word-bank categories with 6 sample words each
- "Fill randomly" demo reveal for the projector
- Print: labeled blanks + word-bank suggestion box

## Quick Wins

- **Per-tag word count control** — right now every tag has a fixed 6-word
  bank; letting a teacher add their own words to a category (matching this
  toolkit's paste-a-list convention) would make the suggestion box richer
  and topic-specific. (Carried over from last round — not yet started.)

## Major Features

- **Multiple named saved custom stories**, matching the multi-save
  convention used elsewhere in this toolkit, once custom stories persist
  at all.
- **A guided "pick one word of each type" flow** for actually playing Mad
  Libs as a class activity (not just generating a worksheet) — ask for a
  noun, then an adjective, etc., one at a time, building suspense the way
  the game is traditionally played out loud, then reveal the finished
  story.
- **Curriculum-tied word banks**: let a teacher swap the default silly
  word bank for a content-specific one (e.g. current vocabulary unit
  words), turning this into vocabulary reinforcement disguised as a game.
- **JSON export/import** for a built custom story + its word choices, so
  a particularly good one can be shared between teachers.

## Moonshot / North Star

**A Mad Libs generator deep enough in templates and word banks that it
doubles as vocabulary practice, played the traditional out-loud way (ask
for each word, then reveal) instead of just producing a worksheet.** The
guided one-word-at-a-time flow is the biggest gap between "generates a
fill-in-the-blank sheet" and "actually plays Mad Libs with a class," and
curriculum-tied word banks turn a novelty activity into something with
real vocabulary-reinforcement value.

## Platform themes that matter here

- **P15 (first run)** — a visible tag reference and persisted custom
  stories both remove real first-use friction.
- **P7 (cross-tool)** — curriculum-tied word banks could pull from the
  same vocabulary lists Vocabulary Flashcard & Word Wall Generator already
  manages, instead of maintaining a separate word list per tool.

## Open Questions

- Is the guided "ask for each word, then reveal" play mode worth building
  as a third mode alongside Preview and Print, or does it belong as a
  separate lightweight tool given how different its interaction model
  (one word at a time, suspense-driven) is from the current
  generate-then-print flow?
- Should custom word-bank additions be per-story (saved with that specific
  custom story) or global (shared across every template), given a teacher
  might want "space vocabulary" words available for several different
  stories at once?
