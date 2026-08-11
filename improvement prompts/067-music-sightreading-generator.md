# Improvement Prompts — 067 — Music Sight-Reading / Rhythm Warm-Up Generator

**Tool file:** `Tools/067-music-sightreading-generator.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Randomized rhythm patterns (4/4,
3/4, or 2/4) or randomized pitch sight-reading on a real treble/bass staff,
for a projector display or printed handout.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from
the Ideas Backlog. Two independent tabs:

- **Rhythm Warm-Up** &mdash; pick a time signature (4/4, 3/4, 2/4), a
  number of measures, and which note/rest values to draw from (quarter,
  beamed eighth pair, half, quarter rest); each measure is filled to
  exactly the right beat count and displayed using the Unicode musical
  symbol block (&#9833; &#9835; &#119134; &#119101;) rather than
  hand-drawn notation, which keeps the renderer simple at the cost of
  depending on font/glyph support for those symbols.
- **Sight-Reading Warm-Up** &mdash; pick treble or bass clef, a note
  range (any two natural notes from C2&ndash;B6), and a note count; notes
  are drawn on a real hand-built SVG staff with correctly computed line/
  space positions, stems, and ledger lines for notes above or below the
  staff, using a generic diatonic-position formula
  (`position = overallDiatonicIndex - clefAnchor`) that works for either
  clef and any octave without per-note lookup tables.

Both modes have independent "new pattern" generation and independent
print output. Only natural notes are used (no accidentals/key
signatures) to keep the pitch math and the visual output simple for a
first version.

Verified with an extensive headless Chromium smoke test: confirmed
every generated rhythm measure's glyphs sum to exactly the selected
time signature's beat count across 4/4 and 3/4 (including after
switching time signature and regenerating); confirmed selecting only
one note/rest type produces that type exclusively, and that
deselecting every checkbox falls back to quarter notes rather than
generating nothing; confirmed switching clefs resets to sensible
per-clef default ranges and re-renders the correct note count;
confirmed the "show note names" toggle re-renders labels correctly;
and specifically verified the ledger-line math by isolating single
notes &mdash; C4 in treble clef (one ledger line below the staff) and
G5 in treble clef (zero ledger lines, since it sits in the space just
above the staff before the first ledger line at A5) both matched
music-theory-correct expectations. Also confirmed both modes' print
output renders correctly. No console errors.

**2026-08-11 — Round 2 (session `9iiyas`).** Shipped the top three Quick
Wins below — the font-availability check (the fourth) is not yet started.
Generation settings now persist to `localStorage`
(`msrg_settings_v1`: time signature, measure count, note/rest pool, tempo
text, clef, note range, note count, show-names, and last-active tab),
restored on boot via a `setSelectIfValid` guard so a corrupted or
missing value never forces a `<select>` into an invalid option; a fresh
pattern is always generated from the restored settings on load — only the
*settings* persist, never the generated notes/measures themselves, per
this tool's own explicit design intent. A per-tab "Lock this pattern for
printing" checkbox snapshots the currently-displayed pattern so generating
a new one for the screen doesn't also change what's about to print; this
required a small refactor so `renderRhythm`/`renderPitches` accept an
optional measures/notes argument instead of always reading the live
module-level array. A "Big single-measure display" toggle on the Rhythm
tab steps through the current pattern one measure at a time (large,
full-width) with Previous/Next controls, for call-and-response clapping
drills. Verified with headless Playwright: settings round-trip across
reload (including a from-empty-storage first load), beat-accuracy held
across 120 freshly-generated measures spanning all three time signatures
(a supplemental spot-check by the reviewing session initially flagged 39
"mismatches" that turned out to be the reviewer's own test script using
the wrong Unicode codepoint for the half-note glyph, not a real bug — every
reported measure summed correctly once re-checked by hand), lock/print
behavior on both tabs, and big-mode Previous/Next boundary behavior — no
console errors.

## What it does today

- Rhythm mode: time signature, measure count, note/rest value pool,
  beat-accurate measure generation, Unicode-glyph display
- Sight-reading mode: clef choice, note range, note count, hand-drawn
  SVG staff with correct line/space positions, stems, and ledger lines
- Generation settings persist across reload (the generated pattern itself
  does not — a fresh one is made from the restored settings on each load)
- A per-tab "lock this pattern for printing" toggle, so a new on-screen
  pattern doesn't overwrite what's about to print
- A big single-measure step-through display for the rhythm tab
  (call-and-response drills)
- Independent print output per mode

## Quick Wins

- **Font-availability check with an SVG fallback** for the rhythm mode's
  Unicode note/rest glyphs &mdash; if the projecting computer's font
  doesn't include the Musical Symbols Unicode block, the glyphs render
  as tofu boxes; a simple canvas-based glyph-support probe could warn
  the teacher or switch to a hand-drawn SVG fallback automatically.
  (Carried over from last round — not yet started.)

## Major Features

- **Accidentals and key signatures**: today's pitch generator is
  natural-notes-only; adding a key signature selector (with the correct
  sharps/flats drawn at the clef) and/or a "chromatic" toggle would make
  this useful for more advanced ensembles, not just a beginner diatonic
  warm-up.
- **Hand-drawn SVG rhythm notation** (proper noteheads, stems, and beam
  bars instead of Unicode glyphs) &mdash; matches the sight-reading tab's
  approach and removes the font-dependency risk called out above
  entirely, at the cost of meaningfully more drawing code.
- **Combined rhythm + pitch mode**: play the sight-reading notes in the
  rhythm generated alongside them (durations assigned per note) for a
  true melodic sight-reading drill instead of two separate, unrelated
  warm-ups.
- **Audio playback**: a Web Audio API metronome click track for the
  rhythm tab (tempo already has a display field with no function behind
  it today) and/or a reference pitch/scale play-through for the
  sight-reading tab, so students can check their own accuracy without a
  teacher at a piano.

## Moonshot / North Star

**A full ensemble warm-up generator that plays what it displays** &mdash;
a metronome-backed rhythm click track, a sung/played reference pitch for
sight-reading, and eventually combined melodic-rhythmic phrases with key
signatures, so the "randomized pattern for a projector" becomes a
self-contained daily warm-up routine a section leader could run without
an instructor physically present.

## Platform themes that matter here

- **P7 (cross-tool)** &mdash; this is the first tool in the toolkit to
  hand-draw musical/geometric notation via computed SVG coordinates
  rather than relying on font glyphs or a vendored drawing library; the
  diatonic-position formula here (works for any clef/octave via one
  generic calculation) is a reusable pattern worth reaching for again if
  a future tool needs staff notation (e.g. a hypothetical "Ear Training"
  or "Interval Drill" tool).
- **P15 (first run)** &mdash; **resolved this round:** generation settings
  now persist to `localStorage`, so a teacher's preferred rhythm pool and
  pitch range survive closing the tab.

## Open Questions

- Is Unicode-glyph rendering for rhythm notation an acceptable permanent
  trade-off (simpler code, projector-dependent font support), or should
  hand-drawn SVG rhythm notation be treated as a near-term priority
  rather than a "someday" major feature, given the sight-reading tab
  already proves out the harder SVG-drawing approach in this same file?
- Should accidentals/key signatures be the very next feature (closing the
  biggest musical-completeness gap), or is a combined rhythm+pitch melodic
  mode more valuable to an actual classroom given the two are currently
  fully separate warm-ups that don't reinforce each other?
