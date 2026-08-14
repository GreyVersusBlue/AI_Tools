# SS demo round 2 — 064 Trading Card Maker — review game + subject theme packs

Read `CLAUDE.md`, then `prompts/social-studies-demo-2/_preamble.md` and
follow it exactly, then
`improvement prompts/064-historical-trading-card-maker.md` (Status
top-down; round 1 just shipped deck share links, the np_rosters batch-add
dropdown, the Founding-Figures sample deck, and `smoke-share.mjs`).

Your tool: `Tools/064-historical-trading-card-maker.html` +
`Tools/historical-trading-card-maker/` (7 modules, 3 test suites, ~199
assertions total). The renderer freeze from round 1 is **partially
lifted**: you may make additive changes where this scope requires them
(new theme definitions, a game view that reuses the card renderer), but
existing themes/frames/foils and export output for existing decks must be
pixel-stable — the suites enforce card geometry, so keep them green after
every feature.

## Headline — Review game mode (the stat bars finally earn their keep)

A teacher-run, projector-friendly class review game played with the current
deck's cards and stats — top-trumps style.

- Setup: pick a deck (4+ cards with at least one stat), 2–6 named teams.
- A round: two face-down cards are drawn (no repeats until the deck
  cycles); the teacher reveals Team A's card, the team picks a stat, both
  cards flip, higher value wins the round and a point — and the teacher
  gets a "why it matters" beat: the card's facts are on screen for a
  10-second talking point. Ties re-draw.
- The pedagogical hook, not just the game: before the stat comparison
  resolves, the display shows the card's fact lines with the key question
  "what do you remember about this figure?" — the game is a review
  vehicle, and the teacher-facing copy should frame it that way.
- Scoreboard, round counter, end-of-deck standings. Teacher-operated
  (clicks/keys), no timers required. Reuse the existing card renderer for
  the big projected cards; do not fork it.
- Persist an in-progress game so an accidental reload doesn't lose the
  score (new key → register in `Tools/009-backup-restore.html`).
- Works out of the box with the round-1 sample deck (its cards have stats)
  so it demos in two clicks.

## Supporting (in order; cut from the bottom)

1. **Subject theme packs**: 3–4 new card themes aimed at other subjects so
   every teacher in Devon's presentation sees their class in this tool —
   e.g. Science/elements (lab-clean look), Math concepts (blueprint/grid
   look), Literature/character (bookish look), plus a neutral "Vocabulary"
   look. Additive theme definitions in `htcm-themes.js` following the
   existing structure; existing themes untouched. Update each new theme's
   default stat labels to fit (e.g. elements: atomic number, melting
   point).
2. **Sample deck per new theme**: one small (3–4 card) sample deck per new
   theme pack behind the existing "Load sample deck" flow (a picker if
   more than one sample exists), so the cross-subject pitch demos
   instantly.
3. **Extend the smoke suites**: game draws without repeats, stat
   comparison scores correctly, game state survives reload, new themes
   render without breaking card geometry (the existing card-size
   assertions must stay green), theme-pack sample decks load.

## Non-goals

Student-operated play; timers; the large 3.5×5 reference card; flag
library; `_shared/image-import.js` extraction; any change to existing
themes/frames/foils or to export output for existing decks.

## Notes

- All three existing suites green before you start and after every
  feature — they are your regression net on the renderer.
- New files → `sw.js` `PRECACHE_URLS` next to the `htcm-*.js` entries +
  `CACHE_VERSION` bump.
- README row + index.html pitch: mention the review game and cross-subject
  themes.
