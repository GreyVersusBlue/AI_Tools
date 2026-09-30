"""scene_prompts.py - 071's starter pictures: twelve scenes to describe.

    blender -b --factory-startup -t 4 -P Tools/blender-art/scene_prompts.py -- --entry Tools/picture-prompt-generator/art/market.webp

Twelve ledger entries share this script, one per scene, keyed by the entry's
"subject". Each is a small isometric diorama in the hero's style (the iso
camera, the one rig, a slab the scene stands on) with people in it, because
the prompts 071 ships ask who is in the picture and what they are doing.

What these pictures are for, so a redraw keeps it: a student describes them
in a language they are learning, so each scene is a place everyone can name
(a market, a kitchen, a beach), with enough going on to make five sentences
(people doing different things, objects to count, colours to name), and no
text anywhere: a sign is a shape, never a word, so one picture serves every
language. They are content, like a teacher's photo: light only, no dark
twin, drawn on --paper so a printed card has no grey box around the scene,
and legible in greyscale because a school printer is black and white.

The background is --paper exactly: camera rays see the world at strength 1
and in 'Standard' that displays as the token itself, while every other ray
sees it dim, as in every other family, so the lighting is the rig's.

Colours: tokens where one fits; a content picture of a real place also needs
grass, sand, wood and skin, which ink-paper.css has no tokens for, so those
are extras the entry declares with a reason (the scene refuses any other).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy          # noqa: E402
import bmesh        # noqa: E402
from mathutils import Vector, Matrix  # noqa: E402
import art_common as art  # noqa: E402

MARGIN = 0.04


# --------------------------------------------------------------------------
# Materials
# --------------------------------------------------------------------------

class Mats:
    def __init__(self, entry, pal):
        self.entry, self.pal, self.cache = entry, pal, {}
        self.extras = {c["hex"].lower(): c for c in entry.get("extraColors", []) if c.get("why")}

    def __call__(self, key, rough=0.6):
        if key.startswith("--"):
            return art.token_material(self.pal, key, roughness=rough)
        name = self.entry["colors"].get(key, key).lower()
        if name.startswith("--"):
            return art.token_material(self.pal, name, roughness=rough)
        if name not in self.extras:
            art.fail("%s (%s) is not a token and the entry does not declare it in extraColors" % (key, name))
        if name not in self.cache:
            mat = bpy.data.materials.new("mat." + name)
            if mat.node_tree is None:
                mat.use_nodes = True
            bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            bsdf.inputs["Base Color"].default_value = art.hex_to_linear(name) + (1.0,)
            bsdf.inputs["Roughness"].default_value = rough
            self.cache[name] = mat
        return self.cache[name]


# --------------------------------------------------------------------------
# Primitives
# --------------------------------------------------------------------------

def _obj(name, bm, mat, bevel=0.0, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    if bevel > 0:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
    return obj


def box(mat, x0, y0, z0, x1, y1, z1, bevel=0.015, name="box"):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)
    bmesh.ops.transform(bm, verts=bm.verts,
                        matrix=Matrix.Translation(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
                        @ Matrix.Diagonal((sx, sy, sz, 1.0)))
    return _obj(name, bm, mat, bevel=min(bevel, sx / 3, sy / 3, sz / 3))


def cyl(mat, r, z0, z1, x, y, segments=24, r2=None, name="cyl"):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=r,
                          radius2=r if r2 is None else r2, depth=z1 - z0)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(x, y, (z0 + z1) / 2))
    return _obj(name, bm, mat, smooth=True)


def rod(mat, a, b, r, segments=12, name="rod"):
    """A cylinder from point a to point b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=r, radius2=r, depth=d.length)
    rot = d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    bmesh.ops.transform(bm, verts=bm.verts, matrix=Matrix.Translation((a + b) / 2) @ rot)
    return _obj(name, bm, mat, smooth=True)


def ball(mat, r, x, y, z, sz=1.0, name="ball"):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=r)
    bmesh.ops.transform(bm, verts=bm.verts, matrix=Matrix.Translation((x, y, z)) @ Matrix.Diagonal((1, 1, sz, 1)))
    return _obj(name, bm, mat, smooth=True)


def roof(mat, x0, y0, x1, y1, z0, h, name="roof"):
    """A gable roof over (x0..x1, y0..y1), its ridge along x."""
    bm = bmesh.new()
    ym = (y0 + y1) / 2
    v = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, ym, z0 + h), (x1, ym, z0 + h))]
    for f in ((0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)):
        bm.faces.new([v[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, mat, bevel=0.02)


def place(parts, x, y, turn=0.0, scale=1.0, z=0.0):
    """Move parts built around the origin to (x, y, z), turned by `turn` degrees."""
    m = Matrix.Translation((x, y, z)) @ Matrix.Rotation(math.radians(turn), 4, "Z") @ Matrix.Scale(scale, 4)
    for p in parts:
        p.matrix_world = m @ p.matrix_world
    return parts


# --------------------------------------------------------------------------
# People and furniture, built at the origin facing -y, then placed
# --------------------------------------------------------------------------

def person(M, x, y, turn=45.0, shirt="--accent-2", pants="--accent", skin="skin1", hair="hair1",
           scale=1.0, sit=0.0, reach=(0.0, 0.0), hat=None):
    """A figure whose feet (or seat) are at (x, y); `turn` degrees from facing
    -y (45 faces the camera). `sit` is the seat height, 0 for standing.
    `reach` raises the (left, right) arm forward, in degrees from hanging."""
    p = []
    hip = sit if sit else 0.8
    if sit:
        for sx in (-0.1, 0.1):
            p.append(box(M(pants), sx - 0.07, -0.45, sit - 0.02, sx + 0.07, 0.05, sit + 0.14, bevel=0.03))
            p.append(box(M(pants), sx - 0.06, -0.45, 0.0, sx + 0.06, -0.33, sit, bevel=0.03))
    else:
        for sx in (-0.1, 0.1):
            p.append(box(M(pants), sx - 0.07, -0.07, 0.0, sx + 0.07, 0.07, hip + 0.05, bevel=0.03))
    p.append(box(M(shirt), -0.21, -0.12, hip, 0.21, 0.12, hip + 0.58, bevel=0.07))
    for i, sx in enumerate((-0.27, 0.27)):
        a = math.radians(reach[i])
        top = Vector((sx, 0.0, hip + 0.52))
        end = top + Vector((0.0, -math.sin(a) * 0.55, -math.cos(a) * 0.55))
        p.append(rod(M(shirt), top, end, 0.055))
        p.append(ball(M(skin), 0.06, end.x, end.y, end.z))
    head = hip + 0.58 + 0.2
    p.append(ball(M(skin), 0.15, 0.0, 0.0, head))
    p.append(ball(M(hair), 0.155, 0.0, 0.035, head + 0.035, sz=0.9))
    if hat:
        p.append(cyl(M(hat), 0.1, head + 0.12, head + 0.36, 0.0, 0.03, r2=0.0))
    return place(p, x, y, turn, scale)


def table(M, x, y, w, d, h=0.74, top="wood", leg="wood-dark", round_=False):
    parts = []
    if round_:
        parts.append(cyl(M(top), w / 2, h - 0.05, h, 0, 0, segments=32))
        parts.append(cyl(M(leg), 0.05, 0.0, h - 0.05, 0, 0))
        parts.append(cyl(M(leg), w / 4, 0.0, 0.03, 0, 0))
    else:
        parts.append(box(M(top), -w / 2, -d / 2, h - 0.06, w / 2, d / 2, h, bevel=0.02))
        for lx in (-w / 2 + 0.06, w / 2 - 0.06):
            for ly in (-d / 2 + 0.06, d / 2 - 0.06):
                parts.append(box(M(leg), lx - 0.03, ly - 0.03, 0, lx + 0.03, ly + 0.03, h - 0.06, bevel=0.0))
    return place(parts, x, y)


def chair(M, x, y, turn, seat="wood", leg="wood-dark"):
    parts = [box(M(seat), -0.22, -0.2, 0.42, 0.22, 0.2, 0.47),
             box(M(seat), -0.22, 0.16, 0.6, 0.22, 0.2, 0.9)]
    for lx, ly in ((-0.19, -0.17), (0.19, -0.17), (-0.19, 0.17), (0.19, 0.17)):
        parts.append(box(M(leg), lx - 0.02, ly - 0.02, 0.0, lx + 0.02, ly + 0.02, 0.9 if ly > 0 else 0.42, bevel=0.0))
    return place(parts, x, y, turn)


def slab(M, key, x0, y0, x1, y1, top=0.0, depth=0.25):
    box(M("--line-strong"), x0, y0, top - depth, x1, y1, top - 0.02, bevel=0.03)
    box(M(key), x0, y0, top - 0.02, x1, y1, top, bevel=0.0)


def walls(M, x0, y0, x1, y1, h=2.4, key="wall", t=0.12):
    """The two far walls of a cut-away room (left: x = x0, back: y = y1)."""
    box(M(key), x0 - t, y0, 0.0, x0, y1, h, bevel=0.0)
    box(M(key), x0 - t, y1, 0.0, x1, y1 + t, h, bevel=0.0)


def window(M, wall_x, y0, y1, z0, z1):
    """A window on the left wall: a frame, a cross and pale glass."""
    box(M("sky"), wall_x + 0.005, y0, z0, wall_x + 0.02, y1, z1, bevel=0.0)
    # Uprights stand proud of the rails, so no two faces share a plane (shared
    # planes rendered as dark specks where the bars crossed).
    ym, zm = (y0 + y1) / 2, (z0 + z1) / 2
    for (a, b, c, d, t) in ((y0, y0 + 0.06, z0, z1, 0.06), (y1 - 0.06, y1, z0, z1, 0.06), (ym - 0.03, ym + 0.03, z0, z1, 0.06),
                            (y0 + 0.06, y1 - 0.06, z0, z0 + 0.06, 0.045), (y0 + 0.06, y1 - 0.06, z1 - 0.06, z1, 0.045),
                            (y0 + 0.06, y1 - 0.06, zm - 0.03, zm + 0.03, 0.045)):
        box(M("--card"), wall_x, a, c, wall_x + t, b, d, bevel=0.0)


def tree(M, x, y, h=2.2, r=0.7):
    cyl(M("wood-dark"), 0.1, 0.0, h * 0.55, x, y, segments=12)
    ball(M("leaf"), r, x, y, h * 0.55 + r * 0.7)
    ball(M("leaf"), r * 0.7, x + r * 0.45, y - r * 0.2, h * 0.55 + r * 0.35)


def wheel(M, x, y, r):
    """A wheel standing on the ground, its axle along y."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=r, radius2=r, depth=0.16)
    bmesh.ops.transform(bm, verts=bm.verts, matrix=Matrix.Translation((x, y, r)) @ Matrix.Rotation(math.pi / 2, 4, "X"))
    _obj("wheel", bm, M("--ink"), smooth=True)


def fruit_crate(M, x, y, fruit, rng):
    box(M("wood"), x - 0.22, y - 0.16, 0.74, x + 0.22, y + 0.16, 0.86, bevel=0.01)
    for i in range(6):
        fx = x - 0.14 + (i % 3) * 0.14
        fy = y - 0.06 + (i // 3) * 0.12
        ball(M(fruit), 0.065, fx + rng.uniform(-0.01, 0.01), fy, 0.9)


# --------------------------------------------------------------------------
# The twelve scenes
# --------------------------------------------------------------------------

def market(M, rng):
    slab(M, "--line", -3.0, -1.6, 3.0, 2.3)
    for i, (sx, fruits, stripe) in enumerate(((-1.8, ("red", "yellow", "orange"), "--err"),
                                               (0.6, ("green", "orange", "red"), "--accent-2"))):
        table(M, sx, 1.1, 1.8, 0.8, h=0.74)
        for j, f in enumerate(fruits):
            fruit_crate(M, sx - 0.55 + j * 0.55, 1.1, f, rng)
        for px in (sx - 0.85, sx + 0.85):
            for py in (0.75, 1.5):
                cyl(M("wood-dark"), 0.03, 0.0, 1.9, px, py, segments=8)
        for k in range(6):
            col = M(stripe) if k % 2 == 0 else M("--card")
            box(col, sx - 0.95 + k * 0.317, 0.6, 1.9, sx - 0.95 + (k + 1) * 0.317, 1.65, 1.96, bevel=0.0)
        person(M, sx + 0.2, 1.85, turn=180 + 20, shirt="--card" if i == 0 else "yellow", pants="--muted",
               skin="skin2" if i == 0 else "skin1", hair="hair1", reach=(40, 0))
    # A shopper with a bag, and a child holding a balloon.
    person(M, -1.4, 0.05, turn=200, shirt="--accent-2", pants="--accent", skin="skin3", hair="hair1", reach=(0, 50))
    box(M("--card-2"), -1.2, -0.35, 0.55, -0.95, -0.2, 0.9, bevel=0.02)
    person(M, 1.9, -0.9, turn=30, shirt="--err", pants="--accent", skin="skin1", hair="hair2", scale=0.65, reach=(150, 0))
    rod(M("--muted"), (1.75, -0.95, 1.2), (1.6, -1.0, 2.2), 0.008)
    ball(M("yellow"), 0.2, 1.6, -1.0, 2.35, sz=1.15)
    box(M("wood"), 2.3, 0.6, 0.0, 2.8, 1.1, 0.35)
    for i in range(4):
        ball(M("green"), 0.1, 2.4 + (i % 2) * 0.2, 0.75 + (i // 2) * 0.2, 0.43)


def kitchen(M, rng):
    slab(M, "--card-2", -2.6, -2.2, 2.6, 2.2)
    walls(M, -2.6, -2.2, 2.6, 2.2)
    window(M, -2.6, -0.8, 0.6, 1.1, 2.0)
    # Counter along the back wall, with a sink, a stove and a fridge.
    box(M("wood"), -2.6, 1.6, 0.0, 1.4, 2.2, 0.9, bevel=0.02)
    box(M("--card"), -2.62, 1.58, 0.9, 1.42, 2.22, 0.96, bevel=0.01)
    box(M("--line-strong"), -1.9, 1.75, 0.8, -1.3, 2.1, 0.97, bevel=0.01)
    box(M("--muted"), -0.2, 1.62, 0.0, 0.6, 2.2, 0.97, bevel=0.02)
    for bx in (0.0, 0.4):
        cyl(M("--ink"), 0.12, 0.97, 0.99, bx, 1.8)
    cyl(M("--err"), 0.15, 0.99, 1.2, 0.0, 1.8)
    box(M("--card"), 1.6, 1.5, 0.0, 2.4, 2.2, 2.0, bevel=0.04)
    box(M("--line-strong"), 1.6, 1.48, 1.2, 2.4, 1.5, 1.22, bevel=0.0)
    # Someone stirring the pot, and a child at the table with a glass of milk.
    person(M, 0.0, 1.05, turn=180, shirt="--err", pants="--accent", skin="skin2", hair="hair1", reach=(70, 0))
    table(M, 0.3, -0.9, 1.4, 0.9)
    for cx, turn in ((-0.1, 0), (0.7, 0)):
        chair(M, cx, -1.6, turn)
    person(M, -0.1, -1.6, turn=180, shirt="yellow", pants="--accent-2", skin="skin1", hair="hair2", scale=0.72, sit=0.47 / 0.72)
    cyl(M("--card"), 0.05, 0.74, 0.92, -0.05, -1.05, segments=16)
    ball(M("red"), 0.07, 0.6, -0.8, 0.81)
    ball(M("yellow"), 0.07, 0.72, -0.9, 0.81)
    cyl(M("--accent-2"), 0.18, 0.74, 0.8, 0.66, -0.85, r2=0.22)


def park(M, rng):
    slab(M, "grass", -3.2, -2.6, 3.2, 2.6)
    box(M("sand"), -3.2, -0.4, 0.0, 3.2, 0.4, 0.01, bevel=0.0)
    cyl(M("sky"), 1.1, 0.0, 0.02, 1.8, 1.4, segments=40)
    for dx, dy in ((1.5, 1.2), (2.0, 1.6)):
        ball(M("yellow"), 0.08, dx, dy, 0.1)
        ball(M("yellow"), 0.05, dx + 0.07, dy - 0.05, 0.18)
    for tx, ty in ((-2.4, 1.8), (-1.2, 2.1), (2.6, 2.0)):
        tree(M, tx, ty)
    # A bench with someone reading, a dog, and two children with a ball.
    box(M("wood"), -1.9, 0.6, 0.42, -0.5, 1.05, 0.48, bevel=0.02)
    box(M("wood"), -1.9, 1.0, 0.5, -0.5, 1.06, 0.9, bevel=0.02)
    for lx in (-1.8, -0.6):
        box(M("--ink"), lx - 0.03, 0.62, 0.0, lx + 0.03, 1.04, 0.42, bevel=0.0)
    person(M, -1.2, 0.85, turn=0, shirt="--accent-2", pants="--muted", skin="skin3", hair="hair1", sit=0.48, reach=(80, 80))
    box(M("--err"), -1.35, 0.25, 0.9, -1.05, 0.32, 1.1, bevel=0.01)
    box(M("wood"), 0.6, -1.4, 0.2, 1.2, -1.15, 0.45, bevel=0.06)
    ball(M("wood"), 0.14, 1.28, -1.28, 0.55)
    for lx in (0.65, 1.1):
        for ly in (-1.38, -1.18):
            box(M("wood"), lx - 0.03, ly - 0.03, 0.0, lx + 0.03, ly + 0.03, 0.22, bevel=0.0)
    person(M, -0.8, -1.6, turn=60, shirt="--err", pants="--accent", skin="skin1", hair="hair2", scale=0.68, reach=(60, 60))
    person(M, 0.9, -0.5, turn=250, shirt="yellow", pants="--accent-2", skin="skin2", hair="hair1", scale=0.7, reach=(50, 0))
    ball(M("--accent-2"), 0.14, 0.1, -1.1, 0.14)


def classroom(M, rng):
    slab(M, "wood", -2.8, -2.4, 2.8, 2.4)
    walls(M, -2.8, -2.4, 2.8, 2.4, key="--card")
    window(M, -2.8, -1.2, 0.8, 1.0, 2.0)
    box(M("--line-strong"), -1.4, 2.35, 0.9, 1.8, 2.4, 2.1, bevel=0.0)
    box(M("green"), -1.35, 2.33, 0.95, 1.75, 2.36, 2.05, bevel=0.0)
    for i, (mx, mz, ml) in enumerate(((-1.1, 1.8, 1.1), (-1.1, 1.55, 0.8), (0.4, 1.8, 1.0), (0.4, 1.55, 0.6), (0.4, 1.3, 0.9))):
        box(M("--card"), mx, 2.31, mz - 0.025, mx + ml, 2.33, mz + 0.025, bevel=0.0)
    ball(M("--card"), 0.22, 2.3, 2.3, 1.9)
    # The teacher points at the board; four students at desks face it.
    person(M, 2.0, 1.6, turn=110, shirt="--accent", pants="--muted", skin="skin2", hair="hair1", reach=(0, 100))
    shirts = ("--err", "yellow", "--accent-2", "green")
    skins = ("skin1", "skin3", "skin2", "skin1")
    for i, (dx, dy) in enumerate(((-1.3, 0.3), (0.3, 0.3), (-1.3, -1.3), (0.3, -1.3))):
        table(M, dx, dy, 1.0, 0.6, h=0.7, top="--card", leg="--muted")
        chair(M, dx, dy - 0.55, 0, seat="--accent-2", leg="--muted")
        person(M, dx, dy - 0.55, turn=180, shirt=shirts[i], pants="--accent", skin=skins[i],
               hair="hair2" if i % 2 else "hair1", scale=0.75, sit=0.47 / 0.75, reach=(60, 0) if i == 1 else (0, 0))
        box(M("--card"), dx - 0.2, dy - 0.15, 0.7, dx + 0.2, dy + 0.13, 0.72, bevel=0.0)


def bus_stop(M, rng):
    slab(M, "--muted", -3.2, -2.6, 3.2, 2.6)
    box(M("--line"), -3.2, 0.4, 0.0, 3.2, 2.6, 0.12, bevel=0.0)
    for i in range(5):
        box(M("--card"), -3.0 + i * 1.4, -1.1, 0.0, -2.4 + i * 1.4, -0.95, 0.01, bevel=0.0)
    # The shelter: two posts, a glass back and a roof, with a bench.
    for px in (-1.6, 0.6):
        box(M("--ink"), px - 0.04, 1.9, 0.12, px + 0.04, 1.98, 2.3, bevel=0.0)
    box(M("sky"), -1.6, 1.92, 0.4, 0.6, 1.96, 2.1, bevel=0.0)
    box(M("--accent"), -1.75, 1.2, 2.3, 0.75, 2.1, 2.38, bevel=0.02)
    box(M("wood"), -1.4, 1.6, 0.55, 0.4, 1.9, 0.6, bevel=0.02)
    person(M, -0.9, 1.75, turn=10, shirt="green", pants="--accent", skin="skin3", hair="hair1", sit=0.6, reach=(70, 70))
    box(M("--card"), -1.05, 1.2, 0.95, -0.75, 1.25, 1.15, bevel=0.0)
    # The sign: a post and a round plate, no words.
    cyl(M("--ink"), 0.03, 0.12, 2.2, 1.3, 0.8, segments=8)
    box(M("--err"), 1.2, 0.76, 1.95, 1.4, 0.84, 2.35, bevel=0.03)
    person(M, 1.8, 0.9, turn=160, shirt="--err", pants="--muted", skin="skin1", hair="hair2", reach=(0, 30))
    person(M, 2.3, 1.3, turn=200, shirt="yellow", pants="--accent-2", skin="skin2", hair="hair1", scale=0.7)
    # The bus pulling in.
    box(M("yellow"), -2.8, -1.8, 0.35, 1.6, -0.5, 1.9, bevel=0.1)
    # Windows and a door on the side facing the kerb... and the camera.
    for i in range(5):
        box(M("sky"), -2.6 + i * 0.68, -1.82, 1.1, -2.1 + i * 0.68, -1.78, 1.7, bevel=0.0)
    box(M("--ink"), 0.85, -1.82, 0.45, 1.35, -1.78, 1.75, bevel=0.0)
    box(M("sky"), 1.58, -1.7, 1.0, 1.62, -0.6, 1.75, bevel=0.0)
    for wx in (-2.1, 0.9):
        for wy in (-1.82, -0.48):
            wheel(M, wx, wy, 0.32)


def doctor(M, rng):
    slab(M, "--card-2", -2.6, -2.2, 2.6, 2.2)
    walls(M, -2.6, -2.2, 2.6, 2.2, key="--card")
    window(M, -2.6, -1.0, 0.4, 1.1, 2.0)
    # The exam bed with a patient sitting on it, and the doctor in a white coat.
    box(M("--muted"), -1.9, 0.5, 0.0, 0.1, 1.3, 0.55, bevel=0.03)
    box(M("sky"), -1.9, 0.5, 0.55, 0.1, 1.3, 0.72, bevel=0.06)
    box(M("--card"), -1.9, 0.6, 0.72, -1.4, 1.2, 0.8, bevel=0.04)
    person(M, -0.6, 0.6, turn=20, shirt="yellow", pants="--accent", skin="skin1", hair="hair2", scale=0.75, sit=0.72 / 0.75)
    person(M, 0.7, 0.0, turn=100, shirt="--card", pants="--accent-2", skin="skin3", hair="hair1", reach=(80, 0))
    rod(M("--ink"), (0.6, -0.15, 1.35), (0.55, -0.2, 1.05), 0.015)
    # A desk with a screen, a cabinet with a red cross, a height chart.
    table(M, 1.5, 1.6, 1.4, 0.7, top="--card", leg="--muted")
    box(M("--ink"), 1.3, 1.75, 0.74, 1.9, 1.8, 1.15, bevel=0.01)
    box(M("sky"), 1.33, 1.74, 0.78, 1.87, 1.75, 1.12, bevel=0.0)
    box(M("--card"), -2.6, -1.8, 0.0, -2.1, -1.2, 1.6, bevel=0.02)
    box(M("--err"), -2.1, -1.58, 0.95, -2.07, -1.42, 1.45, bevel=0.0)
    box(M("--err"), -2.09, -1.75, 1.12, -2.07, -1.25, 1.28, bevel=0.0)
    chair(M, 1.5, 1.05, 180, seat="--accent-2", leg="--muted")
    ball(M("green"), 0.3, 2.2, -1.5, 0.55)
    cyl(M("--err"), 0.2, 0.0, 0.3, 2.2, -1.5, r2=0.25)


def beach(M, rng):
    slab(M, "sand", -3.2, -2.6, 3.2, 2.6)
    box(M("sky"), -3.2, 0.8, 0.0, 3.2, 2.6, 0.03, bevel=0.0)
    box(M("--card"), -3.2, 0.8, 0.03, 3.2, 0.9, 0.04, bevel=0.0)
    # A sailing boat out on the water.
    box(M("--card"), 1.6, 1.7, 0.03, 2.8, 2.2, 0.25, bevel=0.1)
    rod(M("wood-dark"), (2.2, 1.95, 0.25), (2.2, 1.95, 1.7), 0.025)
    bm = bmesh.new()
    v = [bm.verts.new((2.25, 1.95, 0.4)), bm.verts.new((2.25, 1.95, 1.65)), bm.verts.new((2.95, 1.95, 0.4))]
    bm.faces.new(v)
    _obj("sail", bm, M("--err"))
    # An umbrella over a towel with someone lying in the sun.
    cyl(M("--card"), 0.03, 0.0, 2.1, -1.2, -0.2, segments=8)
    for k in range(8):
        a0, a1 = k / 8 * 2 * math.pi, (k + 1) / 8 * 2 * math.pi
        bm = bmesh.new()
        v = [bm.verts.new((-1.2, -0.2, 2.25)),
             bm.verts.new((-1.2 + 1.1 * math.cos(a0), -0.2 + 1.1 * math.sin(a0), 1.85)),
             bm.verts.new((-1.2 + 1.1 * math.cos(a1), -0.2 + 1.1 * math.sin(a1), 1.85))]
        bm.faces.new(v)
        _obj("umbrella.%d" % k, bm, M("--err") if k % 2 else M("--card"))
    box(M("--accent-2"), -2.2, -0.9, 0.0, -0.6, 0.1, 0.02, bevel=0.0)
    person(M, -1.2, -0.25, turn=30, shirt="green", pants="--accent", skin="skin2", hair="hair1", sit=0.12, reach=(60, 60))
    box(M("--card"), -1.45, -0.72, 0.62, -1.15, -0.68, 0.82, bevel=0.0)
    # A sandcastle, a bucket, and a child building it; a beach ball.
    for cx, cy, r, h in ((1.0, -1.2, 0.35, 0.4), (0.7, -1.4, 0.15, 0.65), (1.3, -1.0, 0.15, 0.65)):
        cyl(M("sand"), r, 0.0, h, cx, cy, segments=16)
        cyl(M("sand"), r, h, h + 0.2, cx, cy, segments=16, r2=0.0)
    cyl(M("--err"), 0.14, 0.0, 0.3, 1.8, -1.6, r2=0.18)
    person(M, 1.7, -0.9, turn=160, shirt="yellow", pants="--accent-2", skin="skin1", hair="hair2", scale=0.65, reach=(60, 60))
    ball(M("yellow"), 0.2, 2.3, 0.2, 0.2)
    person(M, 0.6, 1.4, turn=40, shirt="--err", pants="--accent", skin="skin3", hair="hair1", scale=0.9, reach=(120, 0))


def cafe(M, rng):
    slab(M, "wood", -2.8, -2.4, 2.8, 2.4)
    walls(M, -2.8, -2.4, 2.8, 2.4, key="wall")
    window(M, -2.8, -1.4, 0.6, 1.0, 2.0)
    # The counter with a coffee machine and cups; a waiter carrying a tray.
    box(M("wood-dark"), -1.0, 1.7, 0.0, 2.8, 2.4, 1.0, bevel=0.03)
    box(M("--card"), -1.02, 1.68, 1.0, 2.8, 2.42, 1.05, bevel=0.01)
    box(M("--muted"), 1.6, 1.9, 1.05, 2.3, 2.3, 1.6, bevel=0.04)
    for i in range(4):
        cyl(M("--card"), 0.06, 1.05, 1.17, -0.6 + i * 0.25, 2.0, segments=16)
    person(M, 0.4, 2.05, turn=190, shirt="--accent", pants="--ink", skin="skin1", hair="hair1", reach=(30, 0))
    person(M, 1.2, 0.2, turn=150, shirt="--card", pants="--ink", skin="skin3", hair="hair1", reach=(85, 0))
    box(M("--muted"), 1.35, -0.4, 1.33, 1.75, -0.05, 1.36, bevel=0.0)
    cyl(M("--card"), 0.05, 1.36, 1.46, 1.55, -0.2, segments=12)
    # Two friends at a table with drinks and a cake; an empty table.
    table(M, -1.2, -0.6, 1.0, 1.0, round_=True)
    for turn, (cx, cy) in ((270, (-1.9, -0.6)), (90, (-0.5, -0.6))):
        chair(M, cx, cy, turn)
    person(M, -1.9, -0.6, turn=270, shirt="--err", pants="--accent", skin="skin2", hair="hair2", sit=0.47, reach=(70, 0))
    person(M, -0.5, -0.6, turn=90, shirt="yellow", pants="--accent-2", skin="skin1", hair="hair1", sit=0.47, reach=(0, 70))
    for cx in (-1.45, -0.95):
        cyl(M("--card"), 0.06, 0.74, 0.86, cx, -0.6, segments=16)
    cyl(M("pink"), 0.12, 0.74, 0.86, -1.2, -0.35, segments=20)
    table(M, 0.9, -1.6, 0.8, 0.8, round_=True)
    chair(M, 0.9, -2.1, 0)
    tree(M, 2.3, -1.7, h=1.2, r=0.35)


def library(M, rng):
    slab(M, "--card-2", -2.8, -2.4, 2.8, 2.4)
    walls(M, -2.8, -2.4, 2.8, 2.4, key="wall")
    tokens = ("--err", "--accent-2", "--accent", "green", "yellow", "--muted", "orange")
    # Two tall bookcases on the back wall and one on the left.
    def case(x0, x1, y0, y1, along_x):
        box(M("wood"), x0, y0, 0.0, x1, y1, 2.0, bevel=0.02)
        for z in (0.1, 0.55, 1.0, 1.45):
            pos = (x0 if along_x else y0) + 0.08
            end = (x1 if along_x else y1) - 0.08
            while pos < end - 0.12:
                t = rng.uniform(0.07, 0.13)
                h = rng.uniform(0.3, 0.4)
                mat = M(tokens[int(rng.random() * len(tokens))])
                if along_x:
                    box(mat, pos, y0 - 0.02, z, pos + t, y0 + 0.25, z + h, bevel=0.008)
                else:
                    box(mat, x1 - 0.25, pos, z, x1 + 0.02, pos + t, z + h, bevel=0.008)
                pos += t + 0.01
    case(-2.4, -0.4, 2.05, 2.4, True)
    case(0.2, 2.2, 2.05, 2.4, True)
    case(-2.8, -2.45, -1.8, 1.0, False)
    # A reading table with a lamp and a reader; someone taking a book down.
    table(M, 0.4, -0.4, 1.8, 0.9)
    cyl(M("--ink"), 0.08, 0.74, 0.77, 0.9, -0.2)
    rod(M("--ink"), (0.9, -0.2, 0.77), (0.8, -0.3, 1.2), 0.015)
    cyl(M("green"), 0.05, 1.12, 1.3, 0.8, -0.35, r2=0.16)
    chair(M, 0.0, -1.05, 0)
    person(M, 0.0, -1.05, turn=180, shirt="--accent-2", pants="--accent", skin="skin3", hair="hair2", sit=0.47, reach=(75, 75))
    box(M("--err"), -0.18, -0.68, 0.8, 0.18, -0.62, 1.05, bevel=0.01)
    person(M, 1.2, 1.45, turn=190, shirt="yellow", pants="--muted", skin="skin1", hair="hair1", reach=(0, 150))
    box(M("green"), 1.1, 1.75, 1.75, 1.2, 1.95, 2.05, bevel=0.01)
    for i in range(3):
        box(M(tokens[i]), 0.2 + i * 0.06, -0.3, 0.74 + i * 0.05, 0.5 + i * 0.03, -0.1, 0.78 + i * 0.05, bevel=0.005)
    cyl(M("--ink"), 0.12, 0.0, 0.05, 2.2, -1.5)
    cyl(M("--ink"), 0.015, 0.05, 0.9, 2.2, -1.5, segments=8)
    ball(M("sky"), 0.25, 2.2, -1.5, 1.1)


def party(M, rng):
    slab(M, "wood", -2.8, -2.4, 2.8, 2.4)
    walls(M, -2.8, -2.4, 2.8, 2.4, key="wall")
    # Bunting along the back wall.
    for i in range(10):
        x = -2.5 + i * 0.5
        bm = bmesh.new()
        v = [bm.verts.new((x, 2.38, 2.1)), bm.verts.new((x + 0.4, 2.38, 2.1)), bm.verts.new((x + 0.2, 2.38, 1.8))]
        bm.faces.new(v)
        _obj("flag.%d" % i, bm, M(("--err", "yellow", "--accent-2", "green")[i % 4]))
    # The table with a cake and candles, cups, and presents.
    table(M, 0.0, 0.3, 2.0, 1.0, top="--card", leg="--muted")
    cyl(M("pink"), 0.3, 0.74, 0.94, 0.0, 0.3, segments=32)
    cyl(M("--card"), 0.22, 0.94, 1.08, 0.0, 0.3, segments=32)
    for k in range(5):
        a = k / 5 * 2 * math.pi
        cx, cy = 0.12 * math.cos(a), 0.3 + 0.12 * math.sin(a)
        cyl(M("--accent-2"), 0.015, 1.08, 1.2, cx, cy, segments=8)
        ball(M("orange"), 0.025, cx, cy, 1.23, sz=1.5)
    for cx in (-0.7, 0.7):
        cyl(M("--accent-2"), 0.06, 0.74, 0.88, cx, 0.1, segments=16, r2=0.075)
    for i, (gx, gy, s, col) in enumerate(((1.6, -1.2, 0.4, "--err"), (2.1, -1.0, 0.3, "--accent-2"), (1.8, -0.7, 0.25, "yellow"))):
        box(M(col), gx - s / 2, gy - s / 2, 0.0, gx + s / 2, gy + s / 2, s, bevel=0.01)
        box(M("--card"), gx - 0.03, gy - s / 2 - 0.005, 0.0, gx + 0.03, gy + s / 2 + 0.005, s + 0.005, bevel=0.0)
    # Balloons on strings, tied to a chair.
    chair(M, -2.0, 0.9, 90)
    for i, (bx, by, bz, col) in enumerate(((-2.3, 0.7, 2.0, "--err"), (-2.0, 1.2, 2.2, "yellow"), (-1.7, 0.8, 1.9, "--accent-2"))):
        rod(M("--muted"), (-2.0, 1.05, 0.9), (bx, by, bz - 0.25), 0.006)
        ball(M(col), 0.22, bx, by, bz, sz=1.2)
    # The birthday child in a party hat blowing out the candles; two friends.
    person(M, 0.0, 1.1, turn=180, shirt="yellow", pants="--accent", skin="skin2", hair="hair1", scale=0.72, reach=(70, 70), hat="--err")
    person(M, -1.1, -0.6, turn=30, shirt="--accent-2", pants="--muted", skin="skin1", hair="hair2", scale=0.7, reach=(140, 140), hat="green")
    person(M, 1.0, -0.4, turn=250, shirt="--err", pants="--accent", skin="skin3", hair="hair1", reach=(0, 60))


def bedroom(M, rng):
    slab(M, "wood", -2.6, -2.2, 2.6, 2.2)
    walls(M, -2.6, -2.2, 2.6, 2.2, key="wall")
    window(M, -2.6, -1.2, 0.2, 1.0, 1.9)
    cyl(M("--accent-2"), 1.0, 0.0, 0.02, 0.2, -0.6, segments=40)
    # The bed against the back wall, a nightstand with a lamp, a wardrobe.
    box(M("wood"), -1.6, 0.0, 0.0, 0.4, 2.2, 0.4, bevel=0.03)
    box(M("wood"), -1.6, 2.05, 0.0, 0.4, 2.2, 1.0, bevel=0.03)
    box(M("--card"), -1.55, 0.05, 0.4, 0.35, 2.05, 0.55, bevel=0.06)
    box(M("green"), -1.58, 0.02, 0.55, 0.38, 1.3, 0.62, bevel=0.04)
    box(M("--card"), -1.3, 1.55, 0.55, 0.1, 1.95, 0.7, bevel=0.07)
    box(M("wood-dark"), 0.6, 1.7, 0.0, 1.1, 2.2, 0.6, bevel=0.02)
    cyl(M("--ink"), 0.05, 0.6, 0.9, 0.85, 1.95, segments=12)
    cyl(M("yellow"), 0.13, 0.9, 1.15, 0.85, 1.95, r2=0.08)
    box(M("wood-dark"), 1.5, 1.4, 0.0, 2.6, 2.2, 2.1, bevel=0.03)
    box(M("wood"), 2.02, 1.38, 0.1, 2.08, 1.4, 2.0, bevel=0.0)
    # Someone sitting on the bed reading; a cat on the rug; a ball.
    person(M, -0.6, 0.45, turn=20, shirt="--err", pants="--accent", skin="skin2", hair="hair2", scale=0.8, sit=0.55 / 0.8, reach=(75, 75))
    box(M("--accent-2"), -0.45, -0.05, 0.85, -0.15, 0.0, 1.07, bevel=0.01)
    box(M("orange"), 0.4, -1.0, 0.02, 0.8, -0.8, 0.22, bevel=0.07)
    ball(M("orange"), 0.1, 0.85, -0.95, 0.27)
    for ex in (-0.04, 0.04):
        cyl(M("orange"), 0.035, 0.32, 0.4, 0.85 + ex, -0.95, segments=6, r2=0.0)
    ball(M("--err"), 0.13, -0.9, -1.4, 0.13)


def farm(M, rng):
    slab(M, "grass", -3.2, -2.6, 3.2, 2.6)
    box(M("sand"), -0.3, -2.6, 0.0, 0.5, 2.6, 0.01, bevel=0.0)
    # The barn: red walls, a white-trimmed door, a grey roof.
    box(M("--err"), -3.0, 0.8, 0.0, -1.0, 2.4, 1.6, bevel=0.02)
    roof(M("--muted"), -3.1, 0.7, -0.9, 2.5, 1.6, 0.9)
    box(M("--card"), -1.02, 1.2, 0.0, -0.98, 2.0, 1.2, bevel=0.0)
    box(M("wood-dark"), -1.0, 1.28, 0.0, -0.97, 1.92, 1.12, bevel=0.0)
    # A fence along the front, with a cow and chickens in the field.
    for i in range(7):
        box(M("wood"), 0.8 + i * 0.35, -2.4, 0.0, 0.86 + i * 0.35, -2.34, 0.7, bevel=0.0)
    for z in (0.3, 0.6):
        box(M("wood"), 0.8, -2.42, z, 2.96, -2.36, z + 0.05, bevel=0.0)
    box(M("--card"), 1.2, 0.3, 0.5, 2.3, 0.8, 1.05, bevel=0.1)
    for sx, sz in ((1.5, 0.95), (2.0, 0.7)):
        box(M("--ink"), sx - 0.15, 0.29, sz - 0.1, sx + 0.12, 0.81, sz + 0.05, bevel=0.03)
    box(M("--card"), 2.25, 0.35, 0.8, 2.6, 0.75, 1.15, bevel=0.07)
    box(M("pink"), 2.58, 0.45, 0.82, 2.65, 0.65, 0.95, bevel=0.02)
    for lx in (1.3, 2.2):
        for ly in (0.38, 0.72):
            box(M("--card"), lx - 0.05, ly - 0.05, 0.0, lx + 0.05, ly + 0.05, 0.5, bevel=0.0)
    for cx, cy in ((1.4, -1.2), (1.8, -1.5), (2.3, -1.1)):
        ball(M("--card"), 0.13, cx, cy, 0.18, sz=0.9)
        ball(M("--card"), 0.07, cx + 0.1, cy - 0.05, 0.32)
        cyl(M("orange"), 0.025, 0.3, 0.34, cx + 0.17, cy - 0.07, segments=6, r2=0.0)
    # The farmer with a bucket, and a tractor by the barn.
    person(M, 0.8, -0.8, turn=80, shirt="--accent-2", pants="--accent", skin="skin3", hair="hair1", reach=(0, 30), hat="yellow")
    cyl(M("--muted"), 0.12, 0.3, 0.55, 1.2, -0.95, r2=0.15)
    box(M("green"), -2.2, -1.6, 0.35, -1.0, -0.9, 0.9, bevel=0.05)
    box(M("green"), -1.9, -1.55, 0.9, -1.3, -0.95, 1.5, bevel=0.04)
    box(M("sky"), -1.92, -1.5, 1.05, -1.28, -1.0, 1.4, bevel=0.0)
    for wx, wy, r in ((-2.0, -1.62, 0.4), (-2.0, -0.88, 0.4), (-1.15, -1.62, 0.25), (-1.15, -0.88, 0.25)):
        wheel(M, wx, wy, r)


SCENES = {f.__name__.replace("_", "-"): f for f in (market, kitchen, park, classroom, bus_stop, doctor, beach,
                                                     cafe, library, party, bedroom, farm)}


# --------------------------------------------------------------------------
# Framing, the paper backdrop, and main
# --------------------------------------------------------------------------

def frame(scene, cam, width, height):
    bpy.context.view_layer.update()
    rot = cam.matrix_world.to_3x3()
    right, up = rot @ Vector((1, 0, 0)), rot @ Vector((0, 1, 0))
    xs, ys = [], []
    for obj in scene.objects:
        if obj.type != "MESH":
            continue
        for v in obj.data.vertices:
            p = obj.matrix_world @ v.co
            xs.append(p.dot(right))
            ys.append(p.dot(up))
    sx, sy = max(xs) - min(xs), max(ys) - min(ys)
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    aspect = width / height
    fill = 1.0 - 2 * MARGIN
    cam.data.ortho_scale = max(sx / fill, sy / fill * aspect) if aspect >= 1 else max(sx / fill / aspect, sy / fill)
    fwd = rot @ Vector((0, 0, -1))
    cam.location = right * cx + up * cy + fwd * cam.location.dot(fwd)


def paper_backdrop(scene, pal):
    """Camera rays see --paper at strength 1 (displayed as the token itself in
    'Standard'); every other ray sees the dim world art_common sets."""
    art.set_world(scene, pal)
    nt = scene.world.node_tree
    bg = next(n for n in nt.nodes if n.type == "BACKGROUND")
    out = next(n for n in nt.nodes if n.type == "OUTPUT_WORLD")
    seen = nt.nodes.new("ShaderNodeBackground")
    seen.inputs["Color"].default_value = art.hex_to_linear(pal["--paper"]) + (1.0,)
    seen.inputs["Strength"].default_value = 1.0
    path = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(path.outputs["Is Camera Ray"], mix.inputs[0])
    nt.links.new(bg.outputs[0], mix.inputs[1])
    nt.links.new(seen.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])


def main():
    a, ledger, entry, version, out_path = art.begin("scene_prompts.py")
    if entry["theme"] != "light" or entry["use"] != "content":
        art.fail("071's pictures are content: theme light, use content")
    build = SCENES.get(entry["subject"])
    if not build:
        art.fail("no scene %r (have %s)" % (entry["subject"], ", ".join(sorted(SCENES))))
    scene = art.reset_scene()
    pal = art.palette("light")
    build(Mats(entry, pal), art.rng(entry))
    cam = art.add_camera(scene, "iso", entry["width"], entry["height"])
    frame(scene, cam, entry["width"], entry["height"])
    art.add_light_rig(scene)
    art.set_render(scene, entry)
    paper_backdrop(scene, pal)
    art.render_to(scene, out_path)
    if a["no_ledger"]:
        print("blender-art: wrote %s (ledger untouched)" % out_path)
        return
    art.finish_entry(ledger, entry, out_path, version, art.used_tokens())


if __name__ == "__main__":
    main()
