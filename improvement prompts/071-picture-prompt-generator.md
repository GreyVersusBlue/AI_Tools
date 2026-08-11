# Improvement Prompts — 071 — Picture-Prompt Speaking/Writing Task Generator

**Tool file:** `Tools/071-picture-prompt-generator.html`
**Support folder:** none yet — everything is inline in the one file.

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

## What it does today

- Multi-file image upload with automatic downscale to ≤1400px on the long
  edge (JPEG re-encode), thumbnail management with delete
- Editable task-prompt bank (6 generic defaults)
- Projector mode: random image + random prompt, no-repeat-until-cycled,
  visible progress counter, manual reset (consistent wording on both paths)
- Pin a specific prompt to a specific image so it recurs on every pick of
  that image, on both the stage and in print
- Print: grid of image + prompt cards, with an optional cap on how many
  cards print

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
- **Per-target-language prompt sets**: since the default prompts are
  written in English (as instructions to the teacher, describing what
  students should do in the target language), a teacher might want the
  instructions themselves also translated/localized per language taught —
  worth a small library of prompt sets by language as starter content.
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
