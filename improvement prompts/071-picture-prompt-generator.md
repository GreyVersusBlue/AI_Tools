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

## What it does today

- Multi-file image upload, thumbnail management with delete
- Editable task-prompt bank (6 generic defaults)
- Projector mode: random image + random prompt, no-repeat-until-cycled,
  visible progress counter, manual reset
- Print: grid of image + prompt cards

## Quick Wins

- **Fix an a11y/UX gap in the no-repeat counter**: right now "Reset" sets
  a text message but doesn't re-render through the normal `renderStage()`
  path, so the counter text after a manual reset is slightly
  inconsistently worded versus the counter shown after a normal pick —
  worth unifying into one render path for consistency.
- **A "pin this prompt to this image" option**, since right now every
  "new random image" click re-randomizes the prompt too, which means the
  same image could get a different prompt each time it's shown across
  multiple rounds — sometimes useful (variety), sometimes undesirable (a
  teacher wants a fixed image-prompt pairing for a specific activity).
- **Image size/storage warnings**: large uploaded photos (a full-resolution
  phone photo can be several MB) risk hitting localStorage's size limit
  quickly across even a modest batch; a client-side downscale-on-upload
  (draw to a canvas, re-export at a reasonable max dimension) would both
  reduce storage risk and speed up the print/display path.
- **Settings persistence for print-set-size** (currently always prints
  every uploaded image; a count field to print a subset would match other
  generator tools' pattern).

## Major Features

- **Image downscaling on upload** (see above) is significant enough to
  also be a Major Feature depending on how much friction real usage
  reveals — this could be the difference between the tool working
  smoothly with 30 photos vs. hitting storage limits.
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

- Should image downscaling happen silently on every upload (simplest,
  but removes the option to keep a full-resolution copy for some other
  use), or should it be an opt-in toggle ("compress for storage" vs.
  "keep full quality, may hit storage limits sooner")?
- Is pinning specific prompts to specific images worth the added UI (an
  explicit image-prompt pairing table) given the random-pairing default
  already covers the more common "any prompt works with any image" case?
