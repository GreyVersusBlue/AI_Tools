# Tools/blender-art: the Path 21 art pipeline

Blender scene scripts, the art ledger, and the validator CI runs over it. This folder is
**not a tool** and is never linked, precached or shipped: `make-offline-copy.mjs` excludes
it, like `Tools/board-check/`. The art it makes lives in `assets/art/` (site-level) and
`Tools/<tool-folder>/art/` (per-tool). `BACKLOG.md`'s Path 21 section is the spec; this
file is how to run it.

## The pin

| | |
|---|---|
| Blender | **5.2 LTS** (made with 5.2.2 LTS, build `d13f752e3b9c`, 2026-09-15). The line is named once, in `renders.json`'s top-level `"blender"`; every scene script exits 2 if the running Blender is another line, not LTS, or not a release build. Each entry records the exact version that made it. |
| Where | Devon's Windows machine, the Steam install at `C:\Program Files (x86)\Steam\steamapps\common\Blender\`. **It is not on PATH**; put it there for the session with `$env:Path += ";C:\Program Files (x86)\Steam\steamapps\common\Blender"`. Steam updates it silently, so a new *patch* release keeps working and a new *line* stops the scripts until the pin moves (its own increment: re-render everything and read the hash diffs). **Also huginn**, Devon's Linux box, since 2026-09-29: `blender` on PATH is a symlink in `~/.local/bin` to a 5.2.2 LTS tarball in `~/.local/blender/`. |
| Add-ons | **None.** The Freestyle SVG Exporter is not bundled with 5.2.2 (only the SVG *importer*, `io_curve_svg`, is in `addons_core`); it is an extension on extensions.blender.org and is not installed. Icons use the fallback Path 21 names instead, a line exporter in `art_common.py` (see below). If the extension is ever adopted, record its version here and do not commit it. |
| Render | Cycles on CPU, seed from the ledger, `use_animated_seed` off, fixed samples, adaptive sampling off, OIDN on CPU, `Standard` view transform, every metadata stamp off. |

## Commands

Run from the repo root. Always `--factory-startup`, so no user preference or add-on can
reach a render.

```
blender -b --factory-startup -P Tools/blender-art/scene_icons.py -- --entry assets/art/icons/t007.svg
blender -b --factory-startup -P Tools/blender-art/scene_tile.py -- --entry assets/art/test/tile-256-light.webp
blender -b --factory-startup -P Tools/blender-art/scene_tile.py -- --entry assets/art/test/tile-256-dark.webp
blender -b --factory-startup -P Tools/blender-art/scene_icons.py -- --entry assets/art/shortcuts/t007-96.png
blender -b --factory-startup -P Tools/blender-art/scene_icons.py -- --entry assets/icons/icon-maskable-512.png
node Tools/blender-art/build-sprite.mjs
node Tools/blender-art/validate-art.mjs
node Tools/blender-art/test/validate-art.test.mjs
```

A scene script renders one ledger entry, writes it to the entry's path, and rewrites that
entry's record (`blender`, `sha256`, `bytes`, `tokens`, and `underText.lumMin/lumMax`). Add
`--out <file>` to write somewhere else and leave the ledger alone; that is how an entry is
rendered twice and compared.

## Files

- `art_common.py`: the scene template. It holds the pin check, the palette parser, the
  cameras (`icon`: orthographic three-quarter; `iso`: true isometric; `topdown`), the one
  light rig, the world, the render settings, WebP/PNG output, luminance sampling under text,
  the SVG line exporter, and the ledger writer. Scene scripts import it and nothing else of
  their own.
- `scene_icons.py`: the icon family, one function per tool keyed by the entry's `subject`.
  Its header states the set's style (one stroke, auto-framing, what draws as a line). An
  `.svg` entry is the line icon; a `.png` entry is the same scene's lines drawn as tubes
  of `--ink` on `--paper` and rendered at 96×96 for a `manifest.json` shortcut.
- `build-sprite.mjs`: assembles `assets/art/icons/tools.svg`, one `<symbol id="tNNN">` per
  icon, from the entries its ledger entry lists in `sources`. Plain Node, no Blender.
  **Run it after rendering or re-rendering any icon**; `check:art` fails if the sprite is
  not exactly what this assembles or if an icon is missing from it.
- `scene_tile.py`: the 256-px light/dark test tile (top-down family), which proves the
  raster path end to end: palette in both themes, WebP out, luminance under a declared text
  band.
- `renders.json`: the ledger. The spec half (path, script, subject, family, seed, samples,
  quality, width, height, cap, theme, use, twin, decorative, `underText.region/token/large`)
  is written by hand *before* a render. The record half is written by the script.
- `validate-art.mjs`: the read-only guard. Its header lists every rule.
- `test/validate-art.test.mjs`: pure Node, no Blender. It breaks each rule in a fixture tree.

## The palette

`art_common.palette(theme)` reads `_shared/ink-paper.css` at render time: light from the
top-level `:root` (resolving its `var(--x-light)` references), dark from the **top-level**
`:root[data-theme="dark"]:not(.a11y-filter-dark)` block. The same selector also appears
inside `@media print` and in front of `#printArea`; those re-assert the *light* values and
are skipped by only reading rules at brace depth 0. Materials are named `mat.--token`, and
the tokens a render used are recorded on its entry. The validator has its own copy of the
parser in JavaScript and asserts the tokens exist.

## The icon exporter (instead of Freestyle)

`export_svg_lines` takes every mesh edge that is a **boundary**, a **silhouette** (one
adjacent face toward the camera, one away) or a **crease** (both toward it, over 35°
apart). It samples points along each edge, keeps the ones a ray cast toward the
orthographic camera does not block, and projects them with `world_to_camera_view`. Then it
chains the runs into polylines, simplifies them (Ramer–Douglas–Peucker, 0.3 px), and rounds
to one decimal. The file is one `<path>` with `stroke="currentColor"`, `fill="none"` and LF
line endings, so dark mode costs nothing. There is no render and no add-on, so the output is
arithmetic on the mesh.

**Modelling for it:** a surface you want outlined should be a single flat face (a craft
stick is one n-gon, whose boundary is its outline), and a container should be open (a cup's
rim is a boundary, so it draws). A closed box draws its silhouette plus any crease over 35°.
A **loose edge** (no face) is a *wire* and draws as it is: marks on a surface, such as a
checklist's lines or a calendar's grid, are wires rather than faces, so each mark is one
stroke and not an outline of two.

**The stroke (decided in P2).** The landing page draws icons at a fixed **32 CSS px**, and
the set's stroke is **2.25** on the 48-unit viewBox: exactly 1.5 px there, the Path 21
floor. The ledger's icon family carries `displayPx: 32` and `minStrokePx: 1.5`, and
`check:art` fails an icon below it. Drawing icons smaller than 32 px means raising the
stroke first. (The stroke is written with two decimals; one decimal once turned 2.25 into
2.2, which is 1.47 px.)

**Shortcut PNGs.** Blender's PNG writer has no palette mode, and its RGB output of a 96×96
line icon was 5.5–6.9 KB against the 4 KB cap. `art_common.write_two_tone_png` re-writes
the render as a 16-colour indexed PNG whose palette is exact blends of `--paper` and
`--ink`, recovering each pixel's coverage from linear luminance. The results are 0.8–1 KB.
Pure stdlib (`zlib`, `struct`), so there is nothing to install.

## The app mark (Path 21 P2's last call, 2026-09-29)

`manifest.json`'s four icons, `assets/icons/icon-192`/`-512` and `icon-maskable-192`/`-512`
(and `index.html`'s `apple-touch-icon`, which is `icon-192`), are the `appmark` family,
rendered by `scene_icons.py` from subject `"app"`: a dog-eared page in the icon camera with
"A+" in single strokes, circled by `index.html`'s own red-pen `.grade` path (`PEN_LOOP`). It
is "A+" and not "A" because a monoline A in a hand-drawn red circle is the anarchy sign.

- **Two inks.** The loop's material is `--err`; everything else draws in `--ink`. The entry's
  `inks` lists them, `line_layers()` exports each ink's lines separately (the others still
  occlude), and `art_common.write_tone_png` writes an indexed PNG whose palette is `--paper`
  plus exact blends toward each ink. Each pixel is assigned to the ink whose `--paper`→ink
  line in linear RGB passes closest to it; luminance alone cannot tell two inks apart.
- **`fit`.** `"any"` draws the icon as the landing page frames it (its longer side 80% of the
  square). `"maskable"` shrinks it until every stroke, cap included, lies inside the circle
  of radius 39% of the width; the safe zone is 40%. `check:art`'s **SAFE** rule decodes each
  maskable PNG and fails any non-background pixel outside 40%.
- **`stroke`** is the set's 2.25 on the 48-unit icon: 2.25 px when an `any` icon is shown at
  48 px, 1.66 px for a maskable one. Each render prints both numbers.
- Full-bleed `--paper`, no transparency: the platform masks the square.
- **Favicons stay.** At 16 px the page, loop and "A+" merge into grey. The per-page data-URI
  favicons (the old ring-and-A) remain the tab mark.

## Determinism, measured 2026-09-25

Each of the three entries was rendered three times on this machine (once into the tree,
twice with `--out`): **all three renders of each entry were byte-identical**. That covers
the Cycles/OIDN/WebP path for both tiles and the exporter for the icon. That is one
machine, one Blender build and one CPU. Nothing here promises another machine reproduces
the bytes; the ledger's hash checks that the ledger matches the tree, not that a re-render
would.

P2 repeated it: `t004.svg` and `t010-96.png` rendered twice more with `--out`, and the
sprite built twice. **All matched the committed files byte for byte** (Cycles CPU and the
indexed PNG writer included). Same machine and build as above.

**Across machines, 2026-09-29.** Blender 5.2.2 LTS (build `d13f752e3b9c`, the same build) on
Devon's Linux box, huginn, re-rendered the four shortcut PNGs and `t001`, `t007`, `t032` and
`t087.svg` **byte for byte** against the Windows renders. The line exporter and the flat
emission path are portable. **The lit test tile is not:** `tile-256-light.webp` came out
1,050 bytes against the committed 1,054, differing by at most 6/255 on 2.4% of its pixels
(Cycles lighting with OIDN on a different CPU). A lit raster re-rendered on another machine
will show a hash diff that is noise, not a change.
