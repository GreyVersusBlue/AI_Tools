# ASSET-WISHLIST: what to generate with Nano Banana Pro and Veo

Written 2026-10-03 from a read of the repo at local `main` (v225). No code was changed.
This is a shopping list and an integration brief, not a plan of record: nothing here is a
`BACKLOG.md` row until you make it one.

**The short version.** This site already has an art director, and it is a Python script.
Path 21 gave it 130 ledgered, seeded, byte-capped Blender renders in one style, read
straight from `_shared/ink-paper.css`. Generated art should not compete with that. It earns
its place only where Blender is expensive per picture: **busy scenes with people in them,
and soft photographic backgrounds.** That is three image sets, 30 files, about 1.1 MB.
**Video has no place in the shipped site.** One off-site clip is defensible and optional.

The most visible visual defect in the repo needs no credits at all: `og:image` is a 404
on every page that names one (section 4).

---

## 1. Style anchor

The site looks like a school office memo that someone cared about: system sans for
headings, monospace for metadata ("RE:", "TO / FROM / CC", "87 / 87 PRESENT"), a red
"REVIEWED" rubber stamp, a gradebook table instead of a card grid. The colour is ink on
warm off-white paper with one navy-to-blue accent ramp and one brick red, used sparingly.
The art is small matte isometric dioramas on a thick pale slab: flat untextured materials,
soft contact shadows, peg-doll people with no faces, and no text anywhere (a sign is a
shape). The tone is dry and practical; nothing is cute, glossy or "edtech". Dark mode is
"chalk on slate", not a negative.

Palette to quote in prompts (from `_shared/ink-paper.css` and `index.html`):

| Role | Light | Dark |
|---|---|---|
| Paper / background | `#FAFAF8` (landing page: `#F6F7F9`) | `#14171C` |
| Ink | `#1F2430` | `#E9E7E0` |
| Navy accent | `#1F3550` | `#7FB2E5` |
| Blue accent | `#2E6B8F` (landing: `#27649F`) | `#A8CDF2` |
| Brick red | `#A3372B` | `#EF8F84` |
| Warm greys | `#F1F0EA`, `#DCDAD2`, `#8C897F` | `#262C34`, `#363C45` |

Extras the existing scenes already use: grass green, sand, mid-brown wood, mustard yellow,
three skin tones, two hair colours.

### Reusable style prefix (paste first, every time)

```
Isometric 3D diorama, true orthographic camera, viewed from above at a three-quarter
angle. Matte clay-and-painted-wood look: flat, untextured, solid-colour materials, slightly
rounded edges, no gloss, no reflections, no outlines. One soft daylight key from the upper
right, gentle soft-edged shadows falling toward the lower left, no dramatic contrast. The
scene sits on a thick pale warm-grey rectangular slab floating on a perfectly flat, uniform
off-white background, hex #FAFAF8, with nothing else in the frame and generous empty margin
on all sides. Limited palette: deep navy #1F3550, slate blue #2E6B8F, brick red #A3372B,
warm greys, off-white, with small accents of mustard yellow, leaf green and mid-brown wood.
People are simple toy peg figures: cylinder body, sphere head, NO faces, no facial features,
fully clothed in plain solid colours, a mix of skin tones. Absolutely no text, letters,
numbers, logos, brand marks, flags or signage wording anywhere; any sign, book cover, poster
or screen is a blank coloured shape. Clean, calm, uncluttered, like a wooden toy playset
photographed in a studio.
```

**Always attach references.** Upload `Tools/picture-prompt-generator/art/market.webp`,
`kitchen.webp` and `assets/art/hero/classroom-2x-light.webp` with every image prompt and add
"match the attached images' style, camera angle, figure design and lighting exactly". The
prefix alone drifts toward glossy Pixar-ish renders; the references are what hold it. (If
the upload refuses WebP, convert to PNG first.)

The prefix does **not** apply to item 2 (the Class Screen backgrounds), which has its own.

---

## 2. Nano Banana Pro list, ranked by impact per effort

### 2.1 071 Picture Prompt Generator: starter pack 2 (twelve busier scenes)

- **What and where.** 071 ships twelve starter pictures for language-class "describe the
  picture" work (`STARTER_PICTURES` in `Tools/071-picture-prompt-generator.html`). They are
  good but sparse: two to four figures each, because every figure was modelled by hand in
  `scene_prompts.py`. A describe-the-picture prompt gets better with more going on. This is
  the one job on the site where a generator plainly beats the Blender pipeline per hour
  spent, and the pictures are *content* (like a teacher's own photo), so byte-identical
  re-rendering matters least here.
- **Set of 12, consistent.** Chosen to cover vocabulary the first twelve do not (travel,
  shopping, city, school life, home, weather):
  `airport`, `train-station`, `supermarket`, `clothes-shop`, `street-crossing`,
  `cafeteria`, `playground`, `living-room`, `garden`, `zoo`, `campsite`, `snowy-day`.
- **Aspect, size, files.** Generate 4:3 at 2K; downscale to **960×720** WebP, quality about
  70, **≤ 35 KB each** (the existing ones are 10–17 KB because they are flat-shaded; a
  generated one will be heavier, which is why the prompt insists on flat materials). Save
  as `Tools/picture-prompt-generator/art/<name>.webp`.
- **Background.** Opaque. It must be exactly `#FAFAF8` so a printed card has no grey box.
  The model will give you roughly that colour with noise in it; the cleanup is a code step
  (flood the connected near-background region from the four corners to the exact hex before
  encoding), not a prompt problem. No transparency, no chroma key.
- **Prompt template** (prefix first, then one of these):

```
[STYLE PREFIX]
Scene: an airport departure hall. A check-in desk with an agent behind it, a short queue
of three travellers with wheeled suitcases of different colours, a child sitting on a
suitcase, a row of four seats with one person asleep, a large window showing the tail of
one aeroplane, a luggage trolley, a potted plant. Eight to ten figures in total, each
clearly doing one different thing. Every object is separated from its neighbours so each
can be pointed at and named.
```

  Scene lines for the other eleven:

  - `train-station`: a platform with a blue-and-white train with open doors, a conductor
    with a raised arm, a person running with a bag, a family of three with a pushchair, a
    bench with someone eating a sandwich, a round clock with no numerals, a ticket machine
    as a blank box, a pigeon.
  - `supermarket`: two aisles of shelves with coloured boxes and tins, a fruit display, a
    shopper pushing a trolley with a toddler in the seat, a shopper comparing two boxes, a
    worker stacking a shelf from a crate, a checkout with a cashier and a customer packing
    a bag, a dropped carton of eggs on the floor.
  - `clothes-shop`: racks of shirts and coats, a mirror, a person trying on a hat, a person
    holding two jumpers, a child hiding inside a coat rack, a shop assistant folding
    clothes at a counter, a curtained fitting room with feet showing below the curtain,
    shoe boxes stacked.
  - `street-crossing`: a zebra crossing, a red car and a yellow bus waiting, a cyclist with
    a helmet, a crossing guard holding a round blank paddle, three children with
    backpacks crossing, a dog on a lead, a traffic light, a bakery front with a striped
    awning, a person watering window boxes above.
  - `cafeteria`: a serving counter with a cook holding a ladle, a queue of four students
    with trays, two long tables with students eating, one student carrying a tray very
    carefully, a spilled drink with a mop and bucket beside it, a fruit bowl, a bin.
  - `playground`: a slide, two swings (one in motion with a child on it), a climbing frame
    with a child at the top, a sandpit with two children and a bucket, an adult on a bench
    with a pushchair, a child tying a shoe, a ball stuck in a small tree.
  - `living-room`: a sofa with two people watching a blank television, a child building a
    block tower on a rug, a grandparent in an armchair knitting, a cat on the windowsill,
    a bookshelf, a floor lamp, a coffee table with mugs, rain visible through the window.
  - `garden`: a vegetable patch in rows, a person kneeling and planting, a person watering
    with a green can, a child picking tomatoes into a basket, a wheelbarrow, a shed with
    its door open, a washing line with clothes, a bird on the fence, a rake on the ground.
  - `zoo`: three low enclosures (two giraffes, three penguins by a small pool, an elephant),
    a path, a family pointing, a keeper carrying a bucket, a child with an ice cream, a
    person taking a photo, a bench, a balloon seller. Animals as simple toy shapes.
  - `campsite`: two tents (one being put up by two people), a campfire ring with a pot, a
    person chopping vegetables at a folding table, a child with a torch, a canoe by a small
    lake, a person fishing, pine trees, a backpack, boots outside a tent.
  - `snowy-day`: a snow-covered street corner, two children building a snowman, a person
    shovelling a path, a child on a sledge pulled by an adult, a person slipping, a dog in
    a coat, a house with a smoking chimney, bare trees, a postbox as a plain red shape.
    Everyone in coats, hats and scarves.

- **Review each picture for:** a face that crept in, any glyph-like marks, six-fingered
  props, and whether it still reads printed in greyscale (the row's original rule).

### 2.2 087 Class Screen: six built-in projector backgrounds

- **What and where.** 087's Background menu offers Dots, Grid, Lines, Plain, three tints,
  and "Picture…" which opens a file dialog (`#bgSelect`, `renderBackground()`). The tool it
  imitates is known for its backgrounds; a teacher at 7:55 will not go find a wallpaper.
  Six good ones, built in, is the cheapest way to make this tool feel finished on a
  projector. This is where a generator's soft photographic look is right and Blender's
  flat dioramas are wrong.
- **Set of 6, consistent in softness, not in subject.** Four light, two dark:
  `bg-window.webp`, `bg-desk.webp`, `bg-meadow.webp`, `bg-paper.webp`, `bg-slate.webp`,
  `bg-night.webp`.
- **Aspect, size, files.** 16:9 at 2K; downscale to **1920×1080** WebP, quality about 60,
  **≤ 70 KB each**. They compress that far only because they are soft and low-detail; that
  is a design requirement, not just a byte one, since widgets sit on top. Save in
  `Tools/class-screen/art/`.
- **Background.** Full-bleed opaque. Nothing to cut out.
- **Background-set prefix** (use instead of the main prefix):

```
A calm, minimal, softly out-of-focus background image for a classroom projector, 16:9.
Very low detail and low contrast, large areas of smooth even tone, no sharp edges, no
focal subject in the centre: the middle 70% of the frame is quiet and empty because
interface panels will sit on top of it. Any recognisable objects are kept to the outer
edges and corners. Muted natural colour, no saturated hues. No people, no text, no
letters, no numbers, no logos, no screens. Photographic soft-focus look with gentle grain
removed, even exposure, nothing blown out.
```

  Then one line each:

  - `bg-window`: morning sunlight through an unseen window casting soft diagonal bars of
    warm light across a pale off-white painted wall, hex #FAFAF8 dominant, the faint shadow
    of a plant leaf at the far left edge.
  - `bg-desk`: top-down view of a pale birch desk surface, evenly lit, with the tips of a
    few navy and brick-red pencils, a pink eraser and the corner of a ruler just entering
    at the top-left and bottom-right corners; the rest empty wood.
  - `bg-meadow`: a low horizon of soft grey-green hills under a wide pale overcast sky with
    a faint blue tint, hex #2E6B8F desaturated; sky fills the top three quarters.
  - `bg-paper`: a sheet of warm off-white handmade paper filling the frame, extremely subtle
    fibre texture, a soft shadow along one edge as if lit from the upper right.
  - `bg-slate`: a clean dark slate chalkboard, hex #14171C to #262C34, with faint wiped
    chalk haze, slightly lighter toward the centre, a wooden frame edge just visible along
    the bottom with one stub of white chalk at the far right.
  - `bg-night`: a deep navy night sky, hex #1F3550 darkening to #14171C at the top, a
    sparse scatter of small soft stars, a faint paler glow along the bottom edge, no moon.

### 2.3 071: three picture-story sequences (four panels each)

- **What and where.** A second kind of starter for 071: the same characters across four
  pictures, for "first / then / after that / finally" and past-tense retelling. Single
  scenes cannot do this. Character consistency across images is the thing Nano Banana Pro
  is best at and the thing that would cost a full session per story to model in Blender.
- **Set of 12 (3 stories × 4 panels), strictly consistent within a story.**
  - `seq-morning-1..4`: a child in a red jumper wakes in bed as an alarm clock rings;
    eats breakfast at a kitchen table while a parent packs a lunchbox; runs for a yellow
    bus with one shoelace undone; arrives at a classroom door as the others are sitting.
  - `seq-lost-dog-1..4`: a child in a yellow coat walks a small brown dog in a park and the
    lead slips; the child looks behind a bench and a tree while the dog's tail shows behind
    a bin; the child pins a blank sheet with a brown dog-shaped blob to a post while a
    neighbour points; the dog runs back and the neighbour holds the lead.
  - `seq-cake-1..4`: two children in blue and green aprons lay out flour, eggs and a bowl;
    they mix and flour goes everywhere, including on a grey cat; they watch the oven
    through its glass door; the cake is on the table, lopsided, with one slice gone and
    the cat looking guilty.
- **Aspect, size, files.** 4:3 at 2K; downscale to **800×600** WebP, **≤ 25 KB each**.
  `Tools/picture-prompt-generator/art/seq-<story>-<n>.webp`.
- **Background.** Same as 2.1: opaque, exact `#FAFAF8` after the corner-flood cleanup.
- **How to prompt.** Generate panel 1 with the prefix and the panel's line. Then, **in the
  same conversation**, for each later panel: "Same characters, same clothes, same
  proportions, same slab size, same camera and lighting as the previous image. New moment:
  …". Do not start a fresh chat per panel. Regenerate a panel rather than accept a
  changed jumper colour; a student will notice and describe it.

```
[STYLE PREFIX]
Panel 1 of a four-picture story with the same characters in every picture. A child's
bedroom: a child with dark hair in a red jumper sitting up in bed, arms stretched, a round
alarm clock on the bedside table with small motion lines as shapes above it, a school
backpack on the floor, morning light through the window. Two figures at most. Leave the
scene simple so the same room and child can be redrawn exactly.
```

### 2.4 One wide key-art plate (off-site only)

- **What and where.** A 16:9, 2K version of the classroom diorama with life in it (a
  teacher, six students, the same room as the hero), with the **left 55% empty paper** for
  a headline set in code. It is used in three places that are *not* the precached site: a
  richer social card (`assets/og/toolbook.png`, replacing the free version in section 4),
  the top of `README.md`, and the GitHub repository's social preview (Settings, uploaded by
  hand). It is also the first frame for the one Veo clip.
- **One image.** `assets/og/keyart-2k.png` as the master (not referenced by any page),
  cropped to 1200×630 for the card. Background opaque `#F6F7F9`, the landing page's paper,
  not ink-paper's.
- **Do not put it on the landing page.** The hero there is the Blender render, in both
  themes, at 65 KB for four files. Two versions of the same room on one site is worse than
  one.

```
[STYLE PREFIX, but change the background hex to #F6F7F9]
Wide 16:9 composition. The diorama sits entirely in the right 45% of the frame; the left
55% is completely empty flat background for a headline to be added later. Scene: a small
classroom cut-away with two walls. A teacher's desk with a red apple and a pencil pot, a
dark navy chalkboard with a few plain white lines as shapes, a round wall clock with no
numerals, a bookshelf with a globe, a window. Eight white desks with slate-blue chairs, six
of them occupied by seated peg-figure students, one with a raised hand; a peg-figure
teacher standing at the board holding a pointer. Match the attached classroom image's room
exactly: same walls, same furniture, same colours.
```

---

## 3. Veo

**For the site itself: nothing. Skip it.** The reasons are structural, not taste:

- Every file a page references must be in `PRECACHE_URLS` (`check:precache` fails
  otherwise), and every teacher's browser then downloads it. The whole site is 12.7 MB
  across 314 files. One compressed 8-second 1080p loop is 1.5–3 MB: a tenth to a quarter of
  the site, for decoration.
- A video that is *not* precached is a hole on the page offline, which is this site's
  one promise.
- No page plays video today (the `<video>` tags in 001, 004, 006, 010 and others are
  camera viewfinders for QR scanning). `a11y.js` and both front-of-room pages honour
  reduced motion; a looping backdrop behind a timer on a projector is the thing a teacher
  turns off.

### 3.1 The one clip worth considering: a README / share clip (optional)

- **What and where.** An 8-second slow orbit of the classroom diorama, for the top of
  `README.md` and for sending colleagues the link. It never enters the repo's served tree
  or the precache. Worth the credits **only if** you are actually going to show the site
  to other staff; otherwise the key-art still (2.4) does the same job.
- **Prompt** (image-to-video, first frame = `keyart-2k.png` cropped to the diorama):

```
Image-to-video from the attached frame. A miniature isometric classroom diorama made of
matte painted wood and clay sits on a pale slab against a flat off-white background. The
camera makes one very slow, smooth 20-degree orbit to the right around the diorama at a
constant height and constant speed, no zoom, no tilt, no handheld shake, then comes to
rest. Soft even studio daylight from the upper right, soft shadows, lighting does not
change. Almost nothing moves: the second hand of the wall clock ticks, one seated figure's
raised arm lowers once. No new objects appear, nothing morphs, no text, no people's faces.
Silent. Duration 8 seconds, 16:9, 24 fps.
```

- **Loop.** It does not need to loop; let it play once and hold the last frame. If you want
  a loop, use first-and-last-frame mode with the *same* image for both and change the
  motion to "the camera drifts 5 degrees right and returns"; otherwise build the loop in
  the edit by playing it forward then reversed (a 16-second ping-pong hides the seam
  because the motion is an orbit).
- **Format.** 16:9, downscale to 1280×720, H.264 MP4, CRF about 28, audio track removed
  (Veo adds one): **about 0.8–1.5 MB**. Upload it by dragging it into the README editor on
  github.com so it is hosted as an attachment; a repo-relative `.mp4` path does not embed.
  Export one frame as the poster.

### Clips considered and rejected: make a still instead

| Idea | Verdict |
|---|---|
| Animated hero loop on the landing page | **Still.** The hero is in the shell tier, which has a 250 KB art cap and 141 KB already spent. A loop is 10× that. The CSS "ink" fade-in already there is enough. |
| Animated backgrounds for 087 Class Screen (rain, clouds, fireplace) | **Still** (item 2.2). Six loops would be 10–18 MB precached, more than the whole site, and motion behind a countdown is a distraction a teacher has to switch off. |
| Product demo / trailer of the tools | **Do not generate.** Veo invents interfaces. A demo must be a screen recording of the real pages. |
| Animated 071 picture stories | **Stills** (item 2.3). The activity is describing a frozen moment; four panels teach sequencing better than a clip that plays past. |
| Celebration clip for 007 Name Picker / 030 Review Board | **Code.** Confetti is a canvas loop; 007 is in the shell tier. |

---

## 4. Don't generate

- **The social card, version 1.** `index.html` and `Tools/019-escape-room-builder.html` name
  `assets/og/toolbook.png`; the folder does not exist. Eleven more pages point at
  `greyversusblue.com/assets/og/guild-board.png`, on another domain, and 28 declare
  `summary_large_image` with no image at all (`npm run check:social` prints this). Every
  shared link to the site is a blank card today. Fix it in code first: a Playwright script
  in the style of `Tools/board-check/make-manifest-screenshots.mjs` that lays the headline
  beside the existing `classroom-2x-light.webp` and screenshots 1200×630. Zero credits,
  on-brand by construction. Item 2.4 is the upgrade, not the fix.
- **Tool icons, favicons, the app mark, shortcut icons.** They are `currentColor` line SVGs
  exported from meshes; `check:art` fails an icon with a fill or a literal colour, and the
  sprite is a derived build. A raster icon cannot follow the theme and cannot pass.
- **The landing hero.** It exists in four files, both themes, transparent, 65 KB, and is
  reproducible. A generated replacement would be heavier, opaque, and single-theme.
- **Manifest screenshots and any "preview thumbnail".** They are claims about the real UI
  (`assets/screenshots/`); they stay Playwright captures.
- **Certificate borders, seals, ribbons (042); trading-card frames (064); review-board
  tiles (030); manipulatives (080).** Already procedural SVG or ledgered renders, tuned for
  print ink and measured contrast. Generated versions would be heavier and unmeasured.
- **Maps, flags, relief (046, 062).** Geography must be correct. 046's relief comes from a
  NOAA elevation model for that reason.
- **Portraits of historical figures (064, 028, 056).** Likeness and accuracy risk, and
  those tools take the teacher's own cited image on purpose.
- **Classroom label pictograms (051), safety symbols (074).** 074's are standardised hazard
  symbols; 051's want line icons that print in one ink. Both are SVG work.
- **Textures, gradients, dot grids, paper noise.** CSS. 087's dots, grid and lines already
  are.
- **Anything with words in it.** Award titles, signs, headlines, UI. The site serves every
  language and the text changes; type is set in code.
- **Spot-the-difference pairs for 071.** A good use of an editing model, cut anyway: it
  needs a new side-by-side mode in 071 and the art budget is nearly spent after 2.1–2.3.
  Revisit if those land well.
- **Per-tool empty-state illustrations, seasonal hero variants, a mascot.** Filler. The
  site's voice is a memo, not a character.

---

## 5. Constraints check

**Page weight and the art budget.** This is the binding constraint.

| | Now | After 2.1 + 2.2 + 2.3 |
|---|---|---|
| Ledgered art (`renders.json` budget: 2,097,152 B) | 492,651 B | about 1.63 MB (+420 KB, +420 KB, +300 KB) |
| Shell-tier art (cap 256,000 B) | 140,806 B | unchanged: none of this goes in `SHELL_URLS` |
| Precache total | 12.73 MB, 314 files | about 13.9 MB, 344 files |

That leaves roughly 450 KB of art budget. Hold the per-file caps above; if a file will not
fit, lower the quality or simplify the prompt, do not raise the cap. The existing `prompts`
family (491,520 B total, 157,454 B used) cannot absorb 24 more files at these sizes, so the
new pictures need their own families (section 7).

**GitHub Pages.** 1 GB site, 100 MB per file, 100 GB/month soft bandwidth: none of this is
close. The real limit is self-imposed: the service worker downloads everything to every
visitor, on a school network.

**Single-file HTML.** Do not inline any of this as data URIs. The tool pages are already
large single files, and base64 adds a third. Per-tool art goes in `Tools/<folder>/art/` and
is referenced by path, as 071 and 042 already do. (The offline zip is the one place that
inlines, and only the icon sprite.) Keep art out of any folder named `test/`: the offline
copy drops those.

**Video.** Nothing ships, so no lazy-loading or poster work in the site. The README clip
needs a poster frame and no audio.

**Student-facing.** `BACKLOG.md`'s scope rule: students do not operate the site, and
promoting anything student-facing is your call, not a session's. You authorized 071's
starter pictures once (2026-09-25) for the Path 21 rows only. Items 2.1 and 2.3 are the
same kind of thing and need the same sentence from you, recorded in `HISTORY.md`. Item 2.2
is projected by the teacher, which the 087 section already allows. Content rules for all
of it: faceless peg figures, fully clothed, no injuries (the "slipping" and "spilled"
moments are comic, not harmful), no weapons, no alcohol or smoking in the café or campsite
scenes, no religious or national symbols, a visible mix of skin tones and of who does which
job (do not let every cook be one gender and every doctor another; regenerate if it drifts).
The existing `beach` scene set the precedent of figures in ordinary clothes; keep to it.

**Copyright and likeness.**

- The prompts name **no artist, studio, film, game or brand**, and should stay that way. Do
  not add "in the style of" anything; the attached references are your own renders.
- No real people, no real school name or mascot, no real company liveries (the bus is
  "yellow", the train "blue-and-white", the aeroplane a tail with no markings).
- Check every output for accidental logos and pseudo-text; models add both to shop fronts,
  book spines, tickets and screens.
- Google's generators embed an invisible SynthID mark. As far as I know, images made in the
  Gemini app on the Pro tier also carry a small **visible** mark in a corner, which AI
  Studio and Flow outputs do not; I have not verified the current rule. Either generate
  where there is none, or rely on the "generous empty margin" in the prefix and crop it
  off. Do not ship a picture with a visible mark.
- Record provenance in the ledger (section 7) so the repo says plainly which files are
  generated. `Tools/blender-art/README.md` currently promises every file is reproducible
  from a script; these are not, and the ledger should not pretend otherwise.

**Accessibility.** Every 071 picture needs real alt text describing who is doing what (the
existing twelve are the model); `check:art`'s ALT rule enforces presence. 087 backgrounds
are decorative. Nothing here sits under text except the 087 backgrounds, and widgets there
are opaque cards; check that by eye on the two dark ones.

**What I did not verify.** I did not run a generation, so the byte targets are estimates
from the existing files and from how soft or flat each prompt is. I did not confirm that
087's widgets are all opaque over a picture background, that 071's sets keep their order,
or the current Pro-tier quotas and watermark rules.

---

## 6. Batching plan: three sessions

Each session is one consistent set, generated in one sitting with the same references, so
the style does not wander between days. Expect two or three attempts per keeper.

| Session | Generate | Files | Why this order |
|---|---|---|---|
| **1** | 2.1, 071 pack 2 | 12 scenes | Highest impact, most reuse of one prompt shape, and it proves whether the style prefix plus references holds. If it does not hold here, stop and fix the prefix before spending more. |
| **2** | 2.2, 087 backgrounds; then 2.4, the key-art plate | 6 + 1 | Different style, low risk, quick wins. The plate is one image and unlocks the better social card. |
| **3** | 2.3, the three story sequences; then, only if you want it, the Veo clip (3.1) | 12 + 1 clip | The sequences are the hardest (character consistency), so they come once you know the prefix. The clip is last because it depends on 2.4 and is the only optional item. |

**Veo verdict.** One clip, optional, and only for the README. Every other video idea in
section 3's table should be a still or code. If credits are tight, spend none on Veo.

**Before session 1, with no credits:** build the code-only social card (section 4) and get
your one-line authorization for the student-facing items into `HISTORY.md`.

---

## 7. Integration notes (for handing back)

Nothing below has been done. Each is a described change. All of them are a normal backlog
increment: claim a row, bump `CACHE_VERSION`, update `PRECACHE_URLS` (not `SHELL_URLS`), and
run `npm run check:art`, `npm run check:precache`, `npm run check:docs-commands` and the
suites named.

### 7.0 First, once: teach the ledger about generated files

`check:art` will fail any file under `assets/art/` or `Tools/*/art/` that
`Tools/blender-art/renders.json` does not list (**ORPHAN**), and fails an entry with no
`script`, `seed` or pinned `blender` (**LEDGER**, **PIN**). The precedent for a non-Blender
entry is the derived sprite. The change:

- Add a third entry kind beside rendered and derived: **generated**. It has no `script`,
  `seed`, `samples` or `blender`; it carries `generator` (the model name as shown in the
  product), `generated` (date), `prompt` (the full text, prefix included), `references`
  (the repo paths attached), and the usual `path`, `family`, `width`, `height`, `cap`,
  `theme: "light"`, `use: "content"`, `sha256`, `bytes`.
- `validate-art.mjs`: accept that kind; keep **MISSING**, **CAP**, **HASH**, **SIZE**,
  **ORPHAN**, **ALT** on it; skip **PIN** and **TOKEN**; fail a generated entry that has a
  `seed` or `blender`, or lacks `prompt`. Add the fixture cases to
  `Tools/blender-art/test/validate-art.test.mjs` (`npm run test:blender-art`).
- Three new families in `families`: `scenes` (entryCap 35,840; total 430,080),
  `sequences` (entryCap 25,600; total 307,200), `backgrounds` (entryCap 71,680; total
  430,080).
- A small Node import script in `Tools/blender-art/` that takes a downloaded PNG, crops,
  resizes, normalises the background to the exact hex by flood from the corners (071 files
  only), encodes WebP, and writes the entry's record. It needs an encoder; `dependencies`
  must stay empty, so either use `cwebp` from PATH on huginn, as Blender is used, or do the
  encode in Playwright's Chromium via canvas. Decide which and record it.
- Update `Tools/blender-art/README.md` and `CLAUDE.md`'s `check:art` paragraph: the
  "everything is reproducible from a script" claim gains its one exception.

### 7.1 071 pack 2

- Files: `Tools/picture-prompt-generator/art/{airport,train-station,supermarket,clothes-shop,street-crossing,cafeteria,playground,living-room,garden,zoo,campsite,snowy-day}.webp`.
- `Tools/071-picture-prompt-generator.html`: twelve more rows in `STARTER_PICTURES`, each
  with alt text written from the *actual* picture, not from the prompt. Decide whether
  pack 2 is on by default with pack 1 or is a second checkbox; `starterOn()` and
  `freshStarterSets()` are where that lives.
- `sw.js`: twelve `PRECACHE_URLS` lines beside the existing twelve.
- Suites: `npm run test:picture-prompt-starters` (it counts and checks the starters),
  `npm run test:picture-prompt`, `npm run test:a11y -- --only 071`. Print one card in
  greyscale and look at it.

### 7.2 087 backgrounds

- Files: `Tools/class-screen/art/bg-{window,desk,meadow,paper,slate,night}.webp`.
- `Tools/087-class-screen.html`: six `<option>`s in `#bgSelect` above "Picture…", in an
  `<optgroup label="Pictures">`; six CSS rules of the form
  `#board[data-bg="pic-window"]{background-image:url(class-screen/art/bg-window.webp)}`
  sharing the `cover` / `center` declarations `data-bg="image"` already has.
  `renderBackground()` needs no new branch: any value other than `image` is already written
  straight to `data-bg`. Check `cs-core.js` for a whitelist of valid `bg` values when a
  saved screen is loaded or imported, and add the six there. `remote.html` mirrors the
  board; check whether it paints the background too.
- The two dark pictures under a light-theme board (and the reverse): confirm widget chrome
  stays legible; widgets are cards, so it should.
- `sw.js`: six lines. Suites: `npm run test:class-screen`, `npm run test:a11y -- --only 087`.

### 7.3 071 sequences

- Files: `Tools/picture-prompt-generator/art/seq-{morning,lost-dog,cake}-{1,2,3,4}.webp`.
- `Tools/071-picture-prompt-generator.html`: a second starter list, grouped by story, each
  story becoming one set of four pictures in order, with a default prompt set suited to
  retelling ("What happened first?", "What happened next?", "How did it end?") in the
  page's existing prompt structure. Whether a set preserves order, and whether the print
  layout can put four panels on one sheet (`_shared/print-kit.css` has the quarter-sheet
  class), are the two things to read before estimating. This is the largest code change
  on the list; size it as a half-session row at least.
- `sw.js`: twelve lines. Same suites as 7.1, plus `npm run path7:next -- --only 071` if the
  print layout changes.

### 7.4 Social card and key art

- Version 1 (no credits): a new script beside `make-manifest-screenshots.mjs` writes
  `assets/og/toolbook.png` (1200×630, PNG, aim under 300 KB). It is **not** added to
  `PRECACHE_URLS`: it is named only in a `<meta content>`, which `check:precache` does not
  read, and no visitor's browser should download it. `assets/og/` is outside `check:art`'s
  two guarded folders.
- Version 2: the same script composites `assets/og/keyart-2k.png` instead of the hero.
  Update `og:image:alt` in `index.html` and 019 to describe what the card now shows.
- The 11 pages on the old `greyversusblue.com` image and the 28 with no image: pointing
  them all at the one card is a branding decision `CLAUDE.md` says not to guess into the
  tree. It is yours; when made, it is a mechanical edit that `npm run check:social` checks.
- `README.md`: the key art at the top as a normal Markdown image. The GitHub social
  preview is uploaded by hand in the repository settings.

### 7.5 The Veo clip

- No repo file. Drag the MP4 into `README.md`'s editor on github.com; commit the resulting
  attachment URL. If you would rather keep it in the tree, put it outside any path a page
  references and confirm `make-offline-copy.mjs` excludes it.
