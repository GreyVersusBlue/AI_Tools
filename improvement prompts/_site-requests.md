# Site-wide requests — shared scratch list

> This file is shared by every agent session working the improvement-prompts
> programme. If you find a problem or an opportunity that affects more than
> one tool — not specific enough to belong in a single tool's own
> `improvement prompts/<tool>.md` — add it here so other sessions see it
> without needing to re-discover it independently.
>
> This is distinct from `_platform-themes.md`, which is read-only reference
> material Devon curates. Add freely here; nothing here is authoritative
> until Devon (or a future round) acts on it.

---

## Shared design-system stylesheet loads Google Fonts over HTTPS — breaks offline/blocked-network use

Found 2026-08-10 while adding an automated smoke test to
`011-image-to-pdf.html` (Pass 2, Round 1, session `v19h3x`).

`_ds/industry-dbdf1714-c448-4b04-9ea3-c77c792b4c8a/styles.css` — a shared
design-system stylesheet referenced by at least 10 tools, including
`011-image-to-pdf.html`, `036-final_grade_checker.html`,
`005-Seating Chart Generator.html`, `031-docx-merger.html`, and others — opens
with:

```css
@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap');
```

In an offline or blocked-network sandbox this `@import` fails outright
(`ERR_CONNECTION_RESET` in headless Chromium here), and it's a render-blocking
`@import` at the top of the stylesheet, not an opportunistically-cached
`<link>`. This is the exact same class of problem as the vendored-CDN-library
issue documented as **P5** in `_platform-themes.md` (three tools used to load
JS libraries from `cdnjs.cloudflare.com`; all three are now fixed by
vendoring), just for a font instead of a script — and it likely affects more
tools than the ten discovered by grepping for the exact stylesheet path,
since other tools may pull the same or a different Google Fonts URL directly
in their own `<head>` rather than through this shared file. Worth a
site-wide grep for `fonts.googleapis.com` the next time someone is doing a
P5-style pass, alongside the existing `cdnjs.cloudflare.com` grep — not just
in this one shared stylesheet.

**Suggested fix**: vendor the Barlow/Barlow Condensed font files locally
(`Tools/schedule/fonts/fonts.css` already does exactly this pattern for a
different font — self-hosted `@font-face` rules pointing at local `.woff2`
files — and would be the template to copy), the same way the three CDN-JS
tools were vendored in earlier rounds. Out of scope for a single tool's own
round since `_ds/` is shared infrastructure, not any one tool's file — flagged
here rather than fixed unilaterally, per this file's purpose.

**Workaround used in the smoke test**: the test blocks non-`file://` network
requests and filters the resulting generic connection-reset console message,
rather than fixing the shared file. This means the smoke test doesn't
actually catch a regression in the font loading itself — just doesn't fail
on the pre-existing problem it isn't scoped to fix.

---

## P12 image-storage risk likely extends beyond the tools already flagged

Found 2026-08-11 while adding image downscaling to
`028-primary-source-analysis-generator.html` (Pass 2, Round 2, session
`mxpfjs`). `_platform-themes.md`'s P12 section already names several
image-bearing tools that base64 uploads straight into `localStorage`; this
round's implementer checked and confirmed only `Tools/timeline-builder/`
and `Tools/seating-chart/` currently have a dedicated downscale-before-store
module to copy from (both accept a max-dimension + JPEG-quality canvas
resize). `028` now has its own copy of that same pattern.

Still worth a dedicated P12 pass across the rest of the image-accepting
tools this round didn't touch: `046-blank-map-generator.html` (already uses
IndexedDB for its map cache, so may already be fine — worth confirming
rather than assuming), `042-certificate-award-maker.html`'s logo upload
(`cam-logo.js`), `080-virtual-manipulatives-board.html`, and
`038-data-chart-builder.html` if it accepts images. A shared
`_shared/downscale-image.js` (extracted from the timeline-builder/
seating-chart/primary-source-analysis copies, which are likely near-identical
by now) would be a reasonable next step rather than a fourth
copy-paste the next time an image-upload tool gets touched.

---

## Fullscreen-stage duplication has now reoccurred a fourth time, with a new wrinkle

Found 2026-08-11 across three tools worked in the same round (Pass 2, Round
2, session `mxpfjs`): `023-exit-ticket-generator.html`,
`024-number-talks-board.html`, and `025-writing-prompt-generator.html`.
`_tools-touched.md`'s "Threads left open across rounds" section already
tracks this exact duplication (fullscreen-stage wiring independently built
in at least four tools: `021`, `023`, `024`, `025`), so this is not new
information — but this round surfaced a specific new wrinkle worth
recording for whoever eventually builds the shared module:

The Fullscreen API only renders the fullscreened element's own DOM
subtree. `025-writing-prompt-generator.html` needed to add a *live,
interactive* writing timer (Start/Pause/Reset buttons, not just a bigger
font) that stays usable while `.stage` is fullscreened — the same
constraint that already forced the Round 4 Anonymous Response Display
into an overlay reparented inside the fullscreened element. A shared
`_shared/fullscreen-stage.js` helper, whenever someone builds it, needs to
account for *interactive controls living inside the fullscreened subtree*
(timers, reveal buttons, response toggles), not just static display
content (bigger prompt text, dark background) — the four independent
implementations so far have all discovered this the hard way rather than
having a documented contract for it.

---

## HTML entity written as literal text in a JS string, later passed through `escapeHtml()` — six confirmed instances, worth a dedicated sweep

Found again 2026-08-11 in `072-plot-diagram-builder.html` (Pass 2, session
`4o6xmy`), fixed as part of that tool's own round.

The bug shape: a JS string literal contains an HTML entity written as text
(e.g. `'&mdash;'`, `'&deg;'`) instead of the actual Unicode character (—,
°), and that string is later passed through the toolkit's standard
`escapeHtml()` helper before being inserted via `innerHTML`. `escapeHtml()`
escapes the leading `&` into `&amp;`, so the entity never resolves — the
page (or, worse, the printed output) shows the literal text `&mdash;`
instead of an em dash.

This is now confirmed **six times** across the toolkit, each caught by
chance during a different tool's own round rather than by a systematic
search:

1. Verb Conjugation Reference Poster Generator (`079-...html`)
2. Sub Note / Feedback Slip Generator (`076-...html`)
3. Science Fair Project Tracker (`073-...html`)
4. Government/Civics Simulation Role Card Generator (`050-...html`)
5. PE Warm-Up Circuit Card Generator (`069-...html`, in a station's
   instructions text)
6. Story Elements / Plot Diagram Builder (`072-...html`, in the print
   view's empty-field fallback text — `'&mdash;'` used four times)

Six independent hits by accident is a strong signal there are more. Worth
a dedicated site-wide grep the next time someone has a round to spare:
search every `Tools/*.html` for entity-name patterns (`&mdash;`, `&ndash;`,
`&deg;`, `&hellip;`, `&rsquo;`, `&lsquo;`, `&ldquo;`, `&rdquo;`, `&trade;`,
etc. — not `&amp;`/`&lt;`/`&gt;`/`&quot;`/`&#39;`, which are the
legitimately-escaped ones) appearing *inside a JS string literal* (i.e.
inside `'...'` or `"..."` in a `<script>` block, not inside literal HTML
markup where entities are correct as-is) rather than waiting for the next
tool's smoke test to catch instance seven by luck. The fix each time has
been the same one-line swap: replace the entity name with the actual
Unicode character in the source string.

---

## Fixed-height, `overflow: hidden` half-sheet print CSS silently clips content

Found/fixed 2026-08-11 in `076-sub-note-feedback-slip-generator.html` (session
`b4zswl`). The print CSS for a "two half-sheets per page" layout used
`.slip { height: 47vh; overflow: hidden; }` — if the content inside a slip
(a long prompt list, in this case) grows taller than 47vh, it gets silently
clipped with no visual sign anything is missing. This is worse than an
overflow that just looks bad, because a teacher has no way to know content
was cut off from the printed page.

**The fix applied to 076**: switch to `min-height: 47vh; overflow: visible`
and add a content-length threshold — under the threshold, keep the original
"two per page" layout (`page-break-after: always` every 2nd `.slip`); over
it, give each item its own full page instead
(`page-break-after: always` every 1st `.slip`), so nothing clips regardless
of how much content is in a single slip.

This tool's own file (`076-sub-note-feedback-slip-generator.md`, prior
Status entries) already flagged that **Peer Feedback / Editing Checklist
Generator** (`070-peer-feedback-checklist-generator.html`) and **Art Critique
Worksheet Generator** (`047-art-critique-worksheet-generator.html`) share the
identical `.slip`/half-sheet fixed-height print pattern and the identical
risk — neither has been fixed yet. Worth applying the same pattern (min-height
+ overflow: visible + a one-up fallback) the next time either tool gets a
round, rather than re-discovering the bug independently.

**Update, 2026-08-11: both are now fixed, independently and concurrently
with this note being written.** Art Critique Worksheet Generator switched
to `min-height`/no-`overflow:hidden` — shipped independently by both
session `szyio3` and session `8vo65u` in the same round (PR #74, merged
first; confirmed present on `main`). Peer Feedback / Editing Checklist
Generator picked up the same `min-height` fix plus an on-screen size
warning and two-tier print font/spacing scaling in session `4o6xmy`'s
round. 076's own fix (a content-length threshold that falls back to
one-slip-per-page past a certain size) is a third, slightly more
sophisticated variant of the same underlying idea — worth comparing all
three approaches the next time any print-clipping issue turns up
elsewhere, rather than picking one arbitrarily.

---

## Same-minute claims in `_tools-touched.md` are invisible to each other

Found 2026-08-11 when session `szyio3` (assigned tools 047–052) and session
`8vo65u` (assigned tools 047–051) were both directly instructed to start
work at essentially the same moment. Both read the "Currently claimed"
table while it was empty and pushed their own claim row in the same UTC
minute (01:29), so neither could see the other's claim before starting —
the claim system's "check before you build" step only works when a claim
actually lands before the next session reads the table, and two claims in
the same 60-second window race past each other. The result was five tools
(047, 049, 050, 051, and partial overlap on 048) built independently and
in parallel by two sessions, discovered only at merge time as real PR
conflicts, not just a tracker-file conflict — one file's automatic 3-way
merge silently duplicated UI elements and event handlers instead of
combining two genuinely complementary features cleanly, which would have
shipped a visibly broken double-button row if merged without a human (or
agent) actually reading the merged output. See
`_tools-touched.md`'s "Held-out batch — Round 2" entry for the full
resolution.

**This isn't hypothetical anymore — it happened once and could happen
again**, especially whenever Devon assigns overlapping tool ranges to two
sessions in the same message/moment (as happened here: 047–051 and
047–052). Nothing about the claim table's mechanics can fully close a
same-minute race, but two things would reduce the odds and the damage:

- **Before opening a PR**, re-fetch `main` and check whether another
  session has since merged work touching the same tool files, not just
  whether they're still in "Currently claimed" — a claim disappears the
  moment the other session finishes its round, well before that session's
  own PR merges.
- **On a real merge conflict in a tool's own `.html`/`.md` files** (as
  opposed to just the shared tracker file), never trust an automatic
  3-way merge result at face value — diff the conflicting file against
  the other session's already-merged version first to check whether the
  two rounds picked the same Quick Win (redundant, discard one side) or
  different ones (complementary, needs a careful hand-merge, not a
  git-automatic one) before resolving.

## Cross-tool vector map rendering wants a home in `_shared/`

Found while shipping the map + timeline print for `015-timeline-builder.html`
(social studies demo round, session `mq7fkd`).

`Tools/blank-map-generator/bmg-vector.js` turns out to be a genuinely
reusable, app-state-free vector map renderer: `renderBaseMapCanvas(preset,
{style, borders})` reads only `preset.bounds` and `preset.dataset`, resolves
its own data directory from `import.meta.url`, and returns a canvas plus the
calibration that describes it. Timeline Builder now calls it directly, with a
synthetic preset built from an auto-fitted extent, and gets a correct map with
no duplicated code.

That is the right call for one consumer — the alternative was a second
plate-carrée renderer, and the only real content of one would have been
re-deriving `unwrapRing`/`drawableRings`, the antimeridian handling that stops
a naive render of this data drawing full-width lines across the South Pacific
and northern Siberia. Getting that subtly wrong is a bug that survives a
visual check.

But it leaves a coupling nothing enforces: **a tool outside
`Tools/blank-map-generator/` now breaks at print time if that module's
signature changes**, and only Timeline Builder's own smoke test would notice.
Two things worth doing when someone has the room:

- Move the renderer (and the `data/` GeoJSON it reads) into `_shared/`, with
  both tools importing from there. Neither could be done this round:
  `_shared/` was off limits to all eight parallel sessions, and
  `Tools/blank-map-generator/` was owned by a concurrent one.
- Give `renderBaseMapCanvas` an optional output-size argument. It always
  renders at a 4000px long side, which is right for the map tool's poster
  exports and well past what a timeline's map panel needs — Timeline Builder
  currently downscales to 2× its print box and releases the big buffer by
  hand, which a size argument would make unnecessary for both tools.

Related, and cheaper: `Tools/blank-map-generator/bmg-label-sets.js` already
carries hundreds of curriculum place names with coordinates. Timeline Builder
shipped its own ~145-entry gazetteer in `Tools/timeline-builder/tlb-places.js`
because reaching into another tool's data for *content* felt like a bigger
commitment than reaching into it for a *renderer*. If a third tool ever wants
"a list of places a middle school course names", that data should be shared
rather than hand-grown a third time.
## Two-column pasted data is now parsed in at least three places

Raised by the Blank Map Generator's choropleth round (2026-08-13, session
`q4wmxz`), which needed to turn pasted `name, value` rows into numbers and
deliberately did **not** reach into `_shared/` (the round rules forbid it,
for good reason with 8 sessions running).

What now exists independently:

- `Tools/blank-map-generator/bmg-choropleth.js` — `parseDataRows()`:
  tabs / semicolons / pipes / commas, thousands separators, `$` and `%`,
  blank lines, header-row detection, and the awkward case of a *name* that
  contains the delimiter (`Congo, Dem. Rep., 95000000`).
- `Tools/038-data-chart-builder.html` — its own pasted-table parsing.
- `Tools/blank-map-generator/bmg-label-sets.js` — `parseCoordLine()`, the
  same shape of problem for `name, lat, lon`.

None of these is wrong, and none should be ripped out on spec. But a third
independent implementation is the point at which it's worth someone deciding
whether `_shared/paste-table.js` should exist, with one documented set of
rules about delimiters, headers and thousands separators. That decision needs
a quiet moment and one owner, not a parallel round.

A second, smaller candidate from the same work: a grayscale-safe sequential
colour ramp plus a WCAG relative-luminance helper (`RAMPS`,
`relativeLuminance()` in `bmg-choropleth.js`). Any tool that shades something
by an ordered value — the grade distribution visualizer is the obvious one —
wants exactly this, and "does it survive the photocopier" is a property worth
asserting in one place rather than re-arguing per tool.

## Antimeridian-safe GeoJSON ring drawing now exists in three places (from 062, SS demo round 2)

`unwrapRing()` / `drawableRings()` — the pair of functions that stop a plate
carrée render of Natural Earth from ruling a stray line clean across the map
every time a country's ring is clamped to ±180 (Fiji, Chukotka, Antarctica's
closing edge) — now exists three times:

- `Tools/blank-map-generator/bmg-vector.js` — the original, with the best
  comments.
- `Tools/timeline-builder/tlb-places.js` — delegates the render, but carries
  its own copy of the projection maths for pin placement.
- `Tools/geography-bee-quiz-generator/gbq-map.js` — added this round, adapted
  from bmg-vector for snippet-sized renders.

Three copies is the usual threshold. The natural extraction is a small
`_shared/geo-project.js` holding the projection, its inverse, `unwrapRing`,
`drawableRings` and a `traceFeature(ctx, …)` — deliberately *not* a renderer,
since each consumer wants different paint and a different output size.
`_shared/` is out of bounds during a parallel round, so this is a note rather
than a change.

Worth knowing before anyone does it: the three copies are not interchangeable.
bmg-vector traces a whole FeatureCollection into one path; gbq-map has to be
able to trace one named feature on its own, so a highlighted country's holes
cancel against its own rings and not its neighbours'. A shared version needs
both entry points, which is why the suggestion above is `traceFeature` rather
than `traceFeatures`.

## `_shared/levels.js` — one home for the three teaching levels (from 056, round 2)

Round 2 asked several tools to implement the same differentiation spec: a
selector with exactly `Academic` / `Honors` / `Honors GT`, defaulting to
Honors, affecting printed output only, plus a "print all three levels" run
whose pages carry a level footer tag. 056 (DBQ / Source Packet Builder) and
028 (Primary Source Analysis) both built it independently in the same round,
and more tools will want it.

The duplicated part is small but exactly the kind that drifts: the three
label strings, the default, and the footer-tag markup. If two tools ever
disagree on a label ("Honors GT" vs "Honors-GT") the feature stops reading as
one coherent thing across the toolkit, which was the whole point of
specifying it centrally. A `_shared/levels.js` exporting the ordered list,
`levelLabel(key)`, `isLevel(key)`, and a `levelTag(key, title)` markup
helper would cost almost nothing and pin all of it.

A second, larger candidate from the same work: 056 ships a ~60-entry
plain-language glossary of social-studies vocabulary, used to build the
Academic-level "before you read" gloss from the teacher's own source text,
with an honest "check these words with a partner" fallback when nothing
matches. Any tool that wants a vocabulary support line — 028, the vocab
flashcard generator, the writing prompt generator — wants that same list, and
a shared one can grow over time instead of three tools each hand-rolling
sixty definitions. Worth one owner deciding where it lives before a third
copy exists.

## Point-in-polygon picking, and a list-to-sentence formatter (from 046, SS demo round 2)

Two more small generic pieces written locally in `Tools/blank-map-generator/`
because the round rules forbid touching `_shared/`. Neither is urgent; both
are recorded so a third occurrence isn't written from scratch a third time.

- `bmg-hittest.js` — even-odd point-in-polygon over a set of projected rings,
  with bounding-box rejection, plus ring compaction for storage. It is written
  against GeoJSON-shaped data, but the geometry itself has nothing to do with
  maps: anything that has to turn a click into "which shape is this" wants it.
  **The one thing worth carrying over if it ever moves:** the module
  deliberately imports its projection from the *renderer* rather than owning a
  copy, because a hit test that disagrees with what was drawn fails silently
  and is very hard to notice. Whatever shape a shared version takes, it should
  keep taking the transform as an argument rather than defining one.
- `regionGroupCaption()` in `bmg-legend.js` — "A", "A and B", "A, B and C",
  "A, B, C and 4 more". Small, but several tools on the site build that
  sentence by hand and none of them agree about the Oxford comma or the
  cut-off. A shared version would at least make the site consistent with
  itself.

Also worth noting for whoever picks up the `_shared/paste-table.js` question
above: `bmg-choropleth.js` now has a **second** parser next to
`parseDataRows()` — `parseDataTable()`, for several value columns — and the
two make a genuinely instructive pair. The single-column one can afford to be
relaxed about commas, because a value has to run to the end of the line, so
`6,200,000` can only be one number. The multi-column one cannot: once there
are three value columns, `Rhode Island, 69,000, 148,000` is truly ambiguous.
It prefers tabs (which every real spreadsheet paste supplies) and *reports*
the rows it can't read rather than guessing at them. Any shared version has to
answer that, not paper over it.
