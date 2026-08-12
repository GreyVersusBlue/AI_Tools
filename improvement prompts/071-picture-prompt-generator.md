# Improvement Prompts — 071 — Picture-Prompt Speaking/Writing Task Generator

**Tool file:** `Tools/071-picture-prompt-generator.html`
**Support folder:** `Tools/picture-prompt-generator/` — test suite only; the tool
itself is still one self-contained file.

**Current description (from README):** Upload images, pair each with a random editable task prompt, step through no-repeats-until-cycled for a projector display, or print a set of image + prompt cards.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from
the Ideas Backlog. No external image API or search is used — this
toolkit's local-only philosophy means a teacher uploads their own images
(stored as data URLs, the same pattern used elsewhere for user-supplied
photos), rather than pulling from an internet image source. Six default
generic task prompts (describe, narrate, imagine-you're-inside, etc.) ship
editable/addable/removable, so the tool works for any target language a
teacher writes prompts in. "New random image" picks without repeats until
every uploaded image has appeared once (matching Name Picker's
established no-repeat convention in this toolkit), with a visible "N of M
shown" counter and a manual reset. Print mode builds a grid of image +
random-prompt cards for station work. Verified with a headless Chromium
smoke test using real uploaded image files (not mocked) — upload two
images, confirm no-repeat behavior across two consecutive picks, print,
confirm matching card count — no console errors.

Nothing below has been started.

**2026-08-11 — Round 2 (session `4o6xmy`).** Cleared the entire Quick Wins
list — all four items shipped, verified with a headless Chromium smoke
test using a real generated 2000×1500 PNG upload (not mocked) plus two
sequential uploads to exercise the no-repeat cycle:

- **Fixed the reset-hint inconsistency.** Both the normal pick path and
  "Reset (allow repeats)" now go through a single `usedHintText()`
  function instead of the reset handler hand-writing its own string, so
  the wording is guaranteed consistent between the two paths.
- **Pin this prompt to this image.** A "📌 Pin this prompt to this image"
  button appears under the task text on the stage; toggling it stores
  `pinnedPromptId` on that image (persisted in `localStorage`, so it
  survives a reload) and future picks of that image use the pinned prompt
  instead of a new random one — confirmed the same task text recurs across
  a full pick-cycle in the smoke test. Print mode respects the pin too.
- **Image downscaling on upload.** Every uploaded image is now drawn to a
  canvas and re-encoded as JPEG (quality .82) if either dimension exceeds
  1400px, before being stored as a data URL — confirmed in the smoke test
  that a 2000×1500 source image is stored at exactly 1400px on its long
  edge. Falls back to the original data URL if canvas access throws for
  any reason (e.g. a locked-down environment), so upload never hard-fails.
- **Print-set-size setting.** A "Cards to print" number field (blank =
  all, matching the previous default) persists across reloads and caps how
  many of the uploaded images get printed, taking the first N.

This clears every Quick Win **and** folds the most-called-out Major
Feature (image downscaling) into the same round — see the Moonshot note
below for what that unblocks.

**2026-08-12 — Round 3 (backlog rank 1: prompt sets by target language).**
The prompt bank is now a set of named banks instead of one flat list, and
seven starter libraries ship: English, Spanish, French, German, Italian,
Latin, and a Newcomer/ESL English set written at a much simpler level. The
active set drives everything downstream — the projected task text, the pin,
and the printed cards — so the wording a class sees is the language it is
working in. A teacher can also add their own named set ("Spanish 2 — past
tense"), and any starter set can be put back to the shipped wording with
"Restore starter prompts" after it has been edited.

What was actually hard here was the two schema migrations, not the prompt
copy:

- `ppg_prompts_v1` (one flat list) is read once on first load of the new
  build, then retired. If the stored list is byte-identical to the six
  English defaults it is recognised as the English starter set rather than
  cloned into a duplicate eighth set; if it has been edited at all it is
  kept whole as "My prompts (from before)" and left as the active set, so a
  teacher's own prompts are what they still see after the upgrade.
- Pins were a single `pinnedPromptId` per image, which only made sense when
  there was one list. They are now `pinnedPrompts: { setId: promptId }`, and
  the old single value is rehomed onto whichever set the migration put the
  teacher on. This is the right shape, not just a compatible one: the same
  photo can carry a different pinned prompt per language.

Deleting a set also sweeps that set's pins off every image, so no image
keeps a dangling reference.

Verified with a new 37-assertion headless Chromium suite,
`Tools/picture-prompt-generator/test/smoke-prompt-sets.mjs` (registered as
`npm run test:picture-prompt`), covering a real PNG upload, per-set pinning
in both directions, the printed card text following the active set, an edit
staying inside its own set across a reload, custom set create/delete,
starter restore, and both migration paths — no console errors.

**Next round should pick up** the two remaining Major Features below.
Multiple named saved *image* sets is the natural pair to this round's named
prompt sets and is now the only thing keeping a family-vocabulary library
and a school-vocabulary library from coexisting; note it is a bigger storage
question than prompt sets were, since image sets are the megabyte-scale
data here (P12).

## What it does today

- Multi-file image upload with automatic downscale to ≤1400px on the long
  edge (JPEG re-encode), thumbnail management with delete
- Named prompt sets, switchable from one picker: seven starter libraries
  (English, Spanish, French, German, Italian, Latin, Newcomer/ESL English),
  plus teacher-created sets; each independently editable, starters
  restorable to their shipped wording
- Projector mode: random image + random prompt from the active set,
  no-repeat-until-cycled, visible progress counter, manual reset (consistent
  wording on both paths)
- Pin a specific prompt to a specific image, per prompt set, so the pin
  recurs on every pick of that image in that language, on both the stage and
  in print
- Print: grid of image + prompt cards in the active set's language, with an
  optional cap on how many cards print

## Quick Wins

- **Done — Fix an a11y/UX gap in the no-repeat counter.**
- **Done — A "pin this prompt to this image" option.**
- **Done — Image size/storage warnings**, via silent downscale-on-upload
  rather than a warning (see Open Questions below — this resolves the
  opt-in-vs-silent question in favor of silent, since a teacher shouldn't
  need to know what "downscale" means to avoid hitting a storage wall).
- **Done — Settings persistence for print-set-size.**

## Major Features

- **Done — Image downscaling on upload** (see above) — resolved as part of
  this round rather than deferred, since the storage-risk story below is
  strong enough that the difference between "smoothly with 30 photos" and
  "hitting storage limits" only needed one round's worth of canvas code.
- **Multiple named saved image sets**, matching the multi-save convention
  used by most builder tools in this round — one flat image library per
  browser right now, so a "family vocabulary" set and a "school vocabulary"
  set can't coexist.
- **Done — Per-target-language prompt sets** (2026-08-12). Seven starter
  libraries plus teacher-created named sets; see the Round 3 note above.
- **A student-facing timer/response mode** via a share link (this
  toolkit's P3 pattern) — students see the image and prompt on their own
  device with a countdown, for a timed speaking-prep or writing-sprint
  activity.

## Moonshot / North Star

**A picture-prompt bank that scales to a real photo library without
storage risk, offers timed student-facing practice, and can pair specific
images with specific prompts when a teacher wants that control.** Image
downscaling on upload is the foundation everything else depends on (a
tool that silently fails past 20-30 full-resolution photos isn't durable);
a student-facing timed mode turns a teacher-led activity into independent
practice; and pinned image-prompt pairs give a teacher precise control
when the activity calls for it, while random pairing stays the flexible
default.

## Platform themes that matter here

- **P15 (first run)** — image downscaling directly affects whether a
  first-time user with a real photo library hits storage problems; this
  matters more here than almost any other tool in this round given how
  much larger photos are than any other localStorage content in this
  toolkit.
- **P3 (share links)** — a timed student-facing practice mode is a
  natural fit.
- **P7 (cross-tool)** — none of this round's other tools deal with
  bulk user-photo storage at this scale; any downscaling utility built
  here could become a reusable pattern for future image-heavy tools.

## Open Questions

- ~~Should image downscaling happen silently on every upload...~~
  **Resolved this round: silent.** Downscale-on-upload now always runs
  (≤1400px long edge, JPEG .82) with no toggle — a teacher who genuinely
  needs full-resolution copies for some other purpose should keep their
  own originals outside this tool, since this tool's storage is
  browser-local and not meant as an archive. Revisit only if real usage
  shows a case where 1400px is insufficient (e.g. printing very large
  cards).
- Is pinning specific prompts to specific images worth the added UI (an
  explicit image-prompt pairing table) given the random-pairing default
  already covers the more common "any prompt works with any image" case?
  **Resolved this round, lightly:** built as a single per-image pin toggle
  on the currently-displayed image/prompt pair rather than a full pairing
  table — no dedicated UI, reuses the existing stage. Revisit if a teacher
  wants to pre-pin many pairs before ever seeing them projected, which
  would need the table after all.
