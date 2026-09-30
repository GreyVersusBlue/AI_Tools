"""scene_pieces.py - 080 Virtual Manipulatives' pieces, as one sprite atlas.

    blender -b --factory-startup -t 4 -P Tools/blender-art/scene_pieces.py -- --entry Tools/virtual-manipulatives-board/art/pieces.webp

Every piece the board draws is one cell of one atlas, laid out by the entry's
"cells" (CSS pixels at 1x, origin top left, written by hand in renders.json).
The page reads the same cells, so a piece's CSS background-position and the
place it was rendered cannot drift apart without 080's suite noticing.

The camera is the top-down family's, straight down with +Y up the frame. One
Blender unit is 260 CSS px (one hundred-flat), which keeps the whole atlas
about 2.4 units wide: at that size the rig's area lights, twelve units away,
light every cell the same, so a unit in one corner matches a unit in another.
The atlas is rendered at 2x (the entry's density), so each piece is sharp on
a projector and on a phone.

Why one light atlas and not a light/dark pair: 080's board is a .paper-sheet,
which ink-paper.css keeps light in both themes (the pieces are objects with
fixed colours, and the snapshot paints them on white). A dark atlas would
never be shown. The entry's use is "sheet", which check:art allows without a
twin; BACKLOG.md's row asked for one per theme before anyone had read the
page, and HISTORY.md records the call.

Nothing here is text: the algebra and fraction labels are the page's own
HTML, drawn over the cells that the entry's underText regions measure.
Colour is never the only carrier: a negative algebra tile is red *and*
carries an inset white ring, and every pair a reader must tell apart in
greyscale is measured on the written file and held to the entry's
grey.minRatio (the scene fails before it writes the ledger if one is under).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy          # noqa: E402
import bmesh        # noqa: E402
from mathutils import Matrix  # noqa: E402
import art_common as art  # noqa: E402

PX = 1.0 / 260.0            # Blender units per CSS pixel


# --------------------------------------------------------------------------
# Materials: tokens where a token fits, declared extras where it cannot
# --------------------------------------------------------------------------

_EXTRAS = {}


def extra_material(entry, hex_):
    """A colour that is not an ink-paper token. It must be declared in the
    entry's extraColors with its reason, or the scene refuses it."""
    hex_ = hex_.lower()
    if not any(c.get("hex", "").lower() == hex_ and c.get("why") for c in entry.get("extraColors", [])):
        art.fail("%s is not a token and the entry does not declare it in extraColors with a why" % hex_)
    if hex_ in _EXTRAS:
        return _EXTRAS[hex_]
    mat = bpy.data.materials.new("mat." + hex_)
    if mat.node_tree is None:
        mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = art.hex_to_linear(hex_) + (1.0,)
    bsdf.inputs["Roughness"].default_value = 0.5
    _EXTRAS[hex_] = mat
    return mat


# --------------------------------------------------------------------------
# Geometry. (x, y) arguments are CSS pixels from the atlas's top-left corner;
# z is CSS pixels up from the table.
# --------------------------------------------------------------------------

def _w(x, y):
    """Atlas CSS px to world units (y flips: +Y is up the frame)."""
    return x * PX, -y * PX


def _obj(name, bm, mat, bevel_px):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    if bevel_px > 0:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel_px * PX
        mod.segments = 3
        mod.limit_method = "ANGLE"
        mod.harden_normals = False
    return obj


def slab(name, mat, x, y, w, h, z0, z1, bevel=2.0):
    """A box covering CSS rect (x, y, w, h), from height z0 to z1."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    (wx, wy) = _w(x + w / 2, y + h / 2)
    bmesh.ops.transform(bm, verts=bm.verts, matrix=Matrix.Translation((wx, wy, (z0 + z1) / 2 * PX))
                        @ Matrix.Diagonal((w * PX, h * PX, (z1 - z0) * PX, 1.0)))
    return _obj(name, bm, mat, min(bevel, w / 3, h / 3, (z1 - z0) / 2.5))


def prism(name, mat, pts, z0, z1, bevel=2.0):
    """A flat polygon (CSS px, clockwise on screen) extruded from z0 to z1."""
    bm = bmesh.new()
    verts = [bm.verts.new((*_w(px, py), z0 * PX)) for px, py in pts]
    face = bm.faces.new(verts)
    bmesh.ops.recalc_face_normals(bm, faces=[face])
    if face.normal.z > 0:
        face.normal_flip()
    ext = bmesh.ops.extrude_face_region(bm, geom=[face], use_keep_orig=True)
    top = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=top, vec=(0, 0, (z1 - z0) * PX))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, mat, bevel)


def disc(name, mat, cx, cy, r, z0, z1):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=r * PX, radius2=r * PX, depth=(z1 - z0) * PX)
    wx, wy = _w(cx, cy)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(wx, wy, (z0 + z1) / 2 * PX))
    obj = _obj(name, bm, mat, 0.0)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


# --------------------------------------------------------------------------
# The pieces, one function per cell kind. Each fills its cell exactly: a unit
# is 26x26 CSS px because the board's grid is, and ten of them are a rod.
# --------------------------------------------------------------------------

UNIT = 26.0
BLOCK_H = 14.0      # base-ten blocks: tall enough for the bevel to read as a cube
TILE_H = 5.0        # algebra and fraction tiles: flat


def base_ten(name, mat, x, y, cols, rows):
    if cols * rows > 1:
        # A backing plate, so the corners where four bevelled cubes meet show
        # the block's own colour and not the board through a pinhole.
        slab(name + ".plate", mat, x + 1, y + 1, cols * UNIT - 2, rows * UNIT - 2, 0, BLOCK_H - 3, bevel=0.0)
    for r in range(rows):
        for c in range(cols):
            slab("%s.%d.%d" % (name, r, c), mat, x + c * UNIT, y + r * UNIT, UNIT, UNIT, 0, BLOCK_H, bevel=2.5)


def algebra(name, mat, ring, x, y, w, h):
    slab(name, mat, x, y, w, h, 0, TILE_H, bevel=2.0)
    if ring is not None:
        # The negative tile's second carrier: a white ring inset from the edge,
        # so "negative" survives greyscale, a colour-blind reader and a
        # black-and-white printer without anyone reading the sign.
        inset, t, z = 4.0, 1.6, TILE_H
        # Four bars that meet end to side and never overlap: overlapping
        # coplanar faces rendered as dark specks at the corners.
        for i, (rx, ry, rw, rh) in enumerate((
                (x + inset, y + inset, w - 2 * inset, t),
                (x + inset, y + h - inset - t, w - 2 * inset, t),
                (x + inset, y + inset + t, t, h - 2 * inset - 2 * t),
                (x + w - inset - t, y + inset + t, t, h - 2 * inset - 2 * t))):
            slab("%s.ring.%d" % (name, i), ring, rx, ry, rw, rh, z - 0.2, z + 0.4, bevel=0.0)


PIPS = {
    1: [(0, 0)],
    2: [(-1, -1), (1, 1)],
    3: [(-1, -1), (0, 0), (1, 1)],
    4: [(-1, -1), (1, -1), (-1, 1), (1, 1)],
    5: [(-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)],
    6: [(-1, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (1, 1)],
}


def die(name, body, pip, face, x, y, w, h):
    slab(name, body, x, y, w, h, 0, w * 0.6, bevel=7.0)
    cx, cy, step = x + w / 2, y + h / 2, w * 0.26
    for i, (dx, dy) in enumerate(PIPS[face]):
        disc("%s.pip.%d" % (name, i), pip, cx + dx * step, cy + dy * step, w * 0.085, w * 0.6 - 0.3, w * 0.6 + 0.2)


def pattern(name, mat, kind, x, y, w, h):
    s = 52.0                          # one pattern-block edge: two grid cells
    r3 = math.sqrt(3) / 2
    shapes = {
        # flat top and bottom, points left and right
        "hex": [(0, h / 2), (s / 2, h / 2 - s * r3), (s * 1.5, h / 2 - s * r3), (2 * s, h / 2),
                (s * 1.5, h / 2 + s * r3), (s / 2, h / 2 + s * r3)],
        "trapezoid": [(s / 2, 0), (s * 1.5, 0), (2 * s, h), (0, h)],
        "rhombus": [(s / 2, 0), (w, 0), (w - s / 2, h), (0, h)],
        "thin": [(w - s, 0), (w, 0), (s, h), (0, h)],
        "square": [(0, 0), (w, 0), (w, h), (0, h)],
        "triangle": [(w / 2, 0), (w, h), (0, h)],
    }
    pts = [(x + px, y + py) for px, py in shapes[kind]]
    prism(name, mat, pts, 0, 8.0, bevel=2.0)


def build(entry, pal):
    tok = lambda t: art.token_material(pal, t, roughness=0.5)
    ex = lambda h: extra_material(entry, h)
    colours = entry["pieceColors"]
    mat = lambda key: tok(colours[key]) if colours[key].startswith("--") else ex(colours[key])
    c = entry["cells"]

    def cell(key):
        if key not in c:
            art.fail("the entry has no cell " + key)
        return c[key]

    base_ten("unit", mat("unit"), *cell("unit")[:2], 1, 1)
    base_ten("ten", mat("ten"), *cell("ten")[:2], 10, 1)
    base_ten("hundred", mat("hundred"), *cell("hundred")[:2], 10, 10)
    x, y, w, h = cell("frac-fill")
    slab("frac-fill", mat("frac-fill"), x, y, w, h, 0, TILE_H, bevel=2.0)
    x, y, w, h = cell("frac-empty")
    slab("frac-empty", mat("frac-empty"), x, y, w, h, 0, TILE_H, bevel=2.0)
    ring = mat("neg-ring")
    for term in ("1", "x", "x2"):
        algebra("alg-pos" + term, mat("alg-pos"), None, *cell("alg-pos" + term))
        algebra("alg-neg" + term, mat("alg-neg"), ring, *cell("alg-neg" + term))
    for face in range(1, 7):
        die("die-%d" % face, mat("die"), mat("pip"), face, *cell("die-%d" % face))
    for kind in ("hex", "trapezoid", "rhombus", "thin", "square", "triangle"):
        pattern("pb-" + kind, mat("pb-" + kind), kind, *cell("pb-" + kind))


# --------------------------------------------------------------------------
# Measuring the written file
# --------------------------------------------------------------------------

def mean_luminance(img_px, width, height, channels, region):
    """Mean WCAG relative luminance over region [x, y, w, h] (file pixels,
    origin top left), opaque pixels only."""
    x0, y0, rw, rh = region
    total, n = 0.0, 0
    for y in range(y0, y0 + rh):
        row = height - 1 - y
        for x in range(x0, x0 + rw):
            i = (row * width + x) * channels
            if channels == 4 and img_px[i + 3] < 0.5:
                continue
            total += art.relative_luminance_srgb(img_px[i], img_px[i + 1], img_px[i + 2])
            n += 1
    return total / n if n else 0.0


def cell_core(entry, key, inset=7):
    """A cell's interior in file pixels, clear of its bevel and of a negative
    tile's ring: the pair has to differ on its base colour alone."""
    d = entry["density"]
    x, y, w, h = entry["cells"][key]
    return [int(round((x + inset) * d)), int(round((y + inset) * d)),
            int(round((w - 2 * inset) * d)), int(round((h - 2 * inset) * d))]


def grey_record(entry, out_path):
    img = bpy.data.images.load(out_path, check_existing=False)
    w, h = img.size
    px = list(img.pixels)
    ch = img.channels
    bpy.data.images.remove(img)
    g = entry["grey"]
    measured, lums = {}, {}
    for a, b in g["pairs"]:
        for k in (a, b):
            if k not in lums:
                lums[k] = mean_luminance(px, w, h, ch, cell_core(entry, k))
        hi, lo = max(lums[a], lums[b]), min(lums[a], lums[b])
        measured["%s|%s" % (a, b)] = round((hi + 0.05) / (lo + 0.05), 2)
    for k in sorted(lums):
        print("blender-art: %-12s mean luminance %.4f" % (k, lums[k]))
    for pair, r in measured.items():
        print("blender-art: grey %-24s %.2f:1 (floor %s)" % (pair, r, g["minRatio"]))
    return measured


def main():
    a, ledger, entry, version, out_path = art.begin("scene_pieces.py")
    if entry["theme"] != "light" or entry["use"] != "sheet":
        art.fail("080's pieces sit on a .paper-sheet: theme light, use sheet")
    d = entry["density"]
    cw = max(x + w for x, y, w, h in entry["cells"].values())
    ch = max(y + h for x, y, w, h in entry["cells"].values())
    if cw > entry["width"] / d or ch > entry["height"] / d:
        art.fail("the cells reach %gx%g CSS px, past the %dx%d atlas at %dx" % (cw, ch, entry["width"], entry["height"], d))
    scene = art.reset_scene()
    pal = art.palette("light")
    build(entry, pal)
    aw, ah = entry["width"] / d, entry["height"] / d
    art.add_camera(scene, "topdown", entry["width"], entry["height"],
                   target=(aw / 2 * PX, -ah / 2 * PX, 0.0), ortho_scale=max(aw, ah) * PX)
    art.add_light_rig(scene)
    art.set_world(scene, pal)
    art.set_render(scene, entry)
    scene.render.film_transparent = True
    art.render_to(scene, out_path)

    regions = entry["underText"]
    for r in regions:
        r["lumMin"], r["lumMax"] = art.luminance_under(out_path, r["region"])
        print("blender-art: under %-10s %s luminance %.4f-%.4f" % (r["name"], r["token"], r["lumMin"], r["lumMax"]))
    measured = grey_record(entry, out_path)
    low = [p for p, v in measured.items() if v < entry["grey"]["minRatio"]]
    if a["no_ledger"]:
        print("blender-art: wrote %s (ledger untouched)" % out_path)
        return
    entry["grey"]["measured"] = measured
    tokens = art.used_tokens()
    art.finish_entry(ledger, entry, out_path, version, tokens)
    if low:
        art.fail("in greyscale, %s under %s:1" % (", ".join(low), entry["grey"]["minRatio"]))


if __name__ == "__main__":
    main()
