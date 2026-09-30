"""scene_hero.py - the landing page's hero: an isometric classroom diorama.

    blender -b --factory-startup -P Tools/blender-art/scene_hero.py -- --entry assets/art/hero/classroom-1x-light.webp

Four ledger entries share this one scene: a light/dark pair at 1x and at 2x.
They differ only in the palette (the entry's theme) and the resolution (its
width and height); the model, the camera framing and the seed are the same,
so the 2x file is the 1x picture at twice the pixels.

The room is a cut-away box seen from the iso camera (front right, from
above): a floor slab and the two far walls, nothing between the viewer and
the room. The left wall has the window, the right wall the board and the
clock. Six student desks face the board; the teacher's desk sits beside it
with an apple, a stack of papers and a cup of craft sticks (007's icon, the
cup a name gets drawn from). A bookcase with a globe (046) stands in the
front-left corner.

What makes it read as a classroom, so a redraw keeps it: rows of desks with
chairs facing a board, a wall clock, a window. Checked at the size the page
shows it (see HISTORY.md, Path 21 P3), in both themes.

The background is transparent (WebP with alpha). The landing page's paper is
index.html's own --paper, not ink-paper.css's, so a rendered backdrop would
show as a faint rectangle in one theme or the other. Every material is a
token; nothing is a literal colour.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy          # noqa: E402
import bmesh        # noqa: E402
from mathutils import Vector, Matrix  # noqa: E402
import art_common as art  # noqa: E402

# The room, in scene units. x runs along the board wall, y toward it.
W, D = 8.0, 6.0         # floor
WALL_H = 2.7            # wall height above the floor
WALL_T = 0.2            # wall thickness
SLAB = 0.35             # floor slab thickness
MARGIN = 0.05           # empty frame left around the model, per side, as a fraction


# --------------------------------------------------------------------------
# Primitives (bmesh, so nothing depends on the viewport's selection state)
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


def box(name, mat, x0, y0, z0, x1, y1, z1, bevel=0.015):
    """An axis-aligned box from corner (x0, y0, z0) to (x1, y1, z1)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = x1 - x0, y1 - y0, z1 - z0
    bmesh.ops.transform(bm, verts=bm.verts,
                        matrix=Matrix.Translation(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
                        @ Matrix.Diagonal((sx, sy, sz, 1.0)))
    return _obj(name, bm, mat, bevel=min(bevel, sx / 3, sy / 3, sz / 3))


def cyl(name, mat, r, z0, z1, x, y, segments=24, r2=None, axis="Z"):
    """A cylinder (or a cone frustum when r2 is given) from z0 to z1 along its
    axis, centred on (x, y) in the other two."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=r,
                          radius2=r if r2 is None else r2, depth=z1 - z0)
    m = Matrix.Translation((0, 0, (z0 + z1) / 2))
    if axis == "X":      # lying along x: (x, y) are then (y, z)
        m = Matrix.Translation((z0 + (z1 - z0) / 2, x, y)) @ Matrix.Rotation(math.pi / 2, 4, "Y")
    elif axis == "Y":    # lying along y: (x, y) are then (x, z)
        m = Matrix.Translation((x, z0 + (z1 - z0) / 2, y)) @ Matrix.Rotation(-math.pi / 2, 4, "X")
    else:
        m = Matrix.Translation((x, y, (z0 + z1) / 2))
    bmesh.ops.transform(bm, verts=bm.verts, matrix=m)
    return _obj(name, bm, mat, smooth=True)


def ball(name, mat, r, x, y, z):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=r)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(x, y, z))
    return _obj(name, bm, mat, smooth=True)


# --------------------------------------------------------------------------
# The room
# --------------------------------------------------------------------------

def build(pal, rand):
    m = lambda token, rough=0.6: art.token_material(pal, token, roughness=rough)
    floor, wall, trim = m("--card-2", 0.8), m("--card", 0.85), m("--line-strong", 0.7)
    ink, muted, line = m("--ink", 0.5), m("--muted", 0.6), m("--line", 0.7)
    navy, blue, red = m("--accent", 0.55), m("--accent-2", 0.45), m("--err", 0.45)
    chalk = m("--accent-ink", 0.8)

    x0, x1, y0, y1 = -W / 2, W / 2, -D / 2, D / 2

    # Slab, floor and the two far walls. The slab's sides are --line-strong so
    # the diorama reads as a model standing on the page, not a hole in it.
    box("slab", trim, x0, y0, -SLAB, x1, y1, -0.02, bevel=0.03)
    box("floor", floor, x0, y0, -0.02, x1, y1, 0.0, bevel=0.0)
    # Left wall (x = x0) is built around the window opening, so the window is
    # a real hole and the rig's light falls through it onto the floor.
    wy0, wy1, wz0, wz1 = -1.3, 1.3, 0.95, 2.15
    lx0, lx1 = x0 - WALL_T, x0
    # The right wall owns the back corner; the left wall stops at y1, so the
    # two never overlap (an overlap showed as a dark speck at the corner's top).
    box("wall.L.below", wall, lx0, y0, 0.0, lx1, y1, wz0)
    box("wall.L.above", wall, lx0, y0, wz1, lx1, y1, WALL_H)
    box("wall.L.front", wall, lx0, y0, wz0, lx1, wy0, wz1, bevel=0.0)
    box("wall.L.back", wall, lx0, wy1, wz0, lx1, y1, wz1, bevel=0.0)
    box("wall.R", wall, x0 - WALL_T, y1, 0.0, x1, y1 + WALL_T, WALL_H)
    # Skirting along both walls.
    box("skirt.L", trim, x0, y0, 0.0, x0 + 0.04, y1, 0.14)
    box("skirt.R", trim, x0, y1 - 0.04, 0.0, x1, y1, 0.14)

    # Window: a frame, a cross of mullions and a sill; the glass is left out so
    # light comes through, and the far side of the opening reads as sky blue.
    fx = x0 + 0.02
    box("win.sill", trim, x0, wy0 - 0.08, wz0 - 0.06, x0 + 0.16, wy1 + 0.08, wz0)
    for i, (a, b) in enumerate(((wy0, wy0 + 0.07), (wy1 - 0.07, wy1))):
        box("win.jamb.%d" % i, trim, lx0, a, wz0, fx, b, wz1, bevel=0.0)
    box("win.head", trim, lx0, wy0, wz1 - 0.07, fx, wy1, wz1, bevel=0.0)
    box("win.mullion.v", trim, lx0 + 0.06, -0.035, wz0, fx - 0.02, 0.035, wz1, bevel=0.0)
    box("win.mullion.h", trim, lx0 + 0.06, wy0, (wz0 + wz1) / 2 - 0.035, fx - 0.02, wy1, (wz0 + wz1) / 2 + 0.035, bevel=0.0)
    # Just behind the opening and no bigger than the wall around it: anything
    # further out shows above the wall's top edge from this camera (it did).
    sky = box("win.sky", blue, lx0 - 0.02, wy0 - 0.05, wz0 - 0.05, lx0 - 0.01, wy1 + 0.05, wz1 + 0.05, bevel=0.0)
    sky.visible_shadow = False      # seen through the window, never in the light's way

    # The board on the right wall, with a chalk tray and a few chalk lines
    # (marks, not writing: no text is baked into site art).
    bx0, bx1, bz0, bz1 = -1.2, 2.2, 0.95, 2.2
    by = y1 - 0.03
    box("board.frame", trim, bx0 - 0.07, by - 0.02, bz0 - 0.07, bx1 + 0.07, y1, bz1 + 0.07)
    box("board", navy, bx0, by - 0.035, bz0, bx1, by, bz1, bevel=0.0)
    box("board.tray", trim, bx0, by - 0.14, bz0 - 0.09, bx1, y1, bz0 - 0.05)
    marks = [(-0.95, 1.95, 1.2), (-0.95, 1.75, 0.8), (-0.95, 1.55, 1.05),
             (0.55, 1.9, 1.3), (0.55, 1.7, 0.6), (0.55, 1.5, 0.9), (0.55, 1.3, 0.45)]
    for i, (mx, mz, ml) in enumerate(marks):
        box("board.mark.%d" % i, chalk, mx, by - 0.045, mz - 0.025, mx + ml, by - 0.035, mz + 0.025, bevel=0.0)

    # The clock, right of the board.
    cx, cz = 3.05, 2.0
    cyl("clock.rim", ink, 0.32, y1 - 0.08, y1, cx, cz, segments=32, axis="Y")
    cyl("clock.face", wall, 0.27, y1 - 0.095, y1 - 0.08, cx, cz, segments=32, axis="Y")
    box("clock.hour", ink, cx - 0.02, y1 - 0.11, cz - 0.02, cx + 0.02, y1 - 0.095, cz + 0.15, bevel=0.0)
    hand = box("clock.minute", ink, -0.015, y1 - 0.115, -0.015, 0.2, y1 - 0.105, 0.015, bevel=0.0)
    hand.rotation_euler = (0.0, math.radians(20), 0.0)
    hand.location = (cx, 0.0, cz)

    # Student desks: two rows of three, facing the board (+y), each a top on
    # four legs with a chair behind it.
    for r, dy in enumerate((0.1, -1.55)):
        for c, dx in enumerate((-2.2, -0.6, 1.0, 2.6)):
            desk(pal, "desk.%d%d" % (r, c), dx + rand.uniform(-0.05, 0.05), dy + rand.uniform(-0.04, 0.04),
                 floor=floor, top=wall, leg=muted, seat=blue)

    # A pin board between the window and the back corner, with four cards.
    px0, px1, pz0, pz1 = 1.55, 2.75, 1.0, 2.1
    box("pins.frame", trim, x0, px0, pz0, x0 + 0.05, px1, pz1)
    box("pins", floor, x0 + 0.05, px0 + 0.06, pz0 + 0.06, x0 + 0.07, px1 - 0.06, pz1 - 0.06, bevel=0.0)
    for i, (cy, cz, tok) in enumerate(((1.7, 1.55, red), (2.15, 1.65, blue), (1.8, 1.15, wall), (2.3, 1.2, navy))):
        box("pins.card.%d" % i, tok, x0 + 0.07, cy, cz, x0 + 0.085, cy + 0.34, cz + 0.36, bevel=0.0)

    # The teacher's desk, left of the board and turned to face the room.
    tx0, tx1, ty0, ty1 = -3.3, -1.7, 1.55, 2.35
    box("tdesk.body", navy, tx0, ty0, 0.0, tx1, ty1, 0.72)
    box("tdesk.top", wall, tx0 - 0.05, ty0 - 0.05, 0.72, tx1 + 0.05, ty1 + 0.05, 0.78)
    # An apple, a stack of papers with a red mark on top, and the cup of sticks.
    ball("apple", red, 0.12, -1.98, 1.78, 0.9)
    box("apple.stem", ink, -1.99, 1.77, 1.0, -1.97, 1.79, 1.06, bevel=0.0)
    for i in range(4):
        rot = rand.uniform(-0.12, 0.12)
        sheet = box("paper.%d" % i, wall, -0.3, -0.21, 0.0, 0.3, 0.21, 0.018, bevel=0.0)
        sheet.rotation_euler = (0.0, 0.0, rot)
        sheet.location = (-2.75, 1.95, 0.78 + i * 0.02)
    tick = box("paper.mark", red, -0.12, -0.02, 0.0, 0.12, 0.02, 0.012, bevel=0.0)
    tick.rotation_euler = (0.0, 0.0, math.radians(35))
    tick.location = (-2.7, 1.98, 0.78 + 4 * 0.02)
    cyl("cup", red, 0.12, 0.78, 1.05, -2.2, 2.15, segments=20, r2=0.13)
    for i in range(5):
        stick = box("stick.%d" % i, floor, -0.02, -0.006, 0.0, 0.02, 0.006, 0.5, bevel=0.0)
        a = i / 5 * 2 * math.pi
        stick.rotation_euler = (math.radians(9) * math.cos(a), math.radians(9) * math.sin(a), 0.0)
        stick.location = (-2.2 + 0.05 * math.cos(a), 2.15 + 0.05 * math.sin(a), 0.8)
    # The teacher's chair, behind the desk.
    chair(pal, "tchair", -2.5, 2.7, math.pi, seat=navy, leg=muted)

    # Bookcase in the front-left corner, against the left wall, with a globe.
    kx0, kx1, ky0, ky1, kh = x0, x0 + 0.5, -2.8, -1.4, 1.25
    box("case.back", wall, kx0, ky0, 0.0, kx0 + 0.04, ky1, kh)
    for i, (a, b) in enumerate(((ky0, ky0 + 0.05), (ky1 - 0.05, ky1))):
        box("case.side.%d" % i, wall, kx0, a, 0.0, kx1, b, kh)
    for i, z in enumerate((0.0, 0.42, 0.84, kh - 0.05)):
        box("case.shelf.%d" % i, wall, kx0, ky0, z, kx1, ky1, z + 0.05)
    tokens = (navy, blue, red, muted, trim, navy, red, blue)
    for s, z in enumerate((0.05, 0.47)):
        y = ky0 + 0.07
        while y < ky1 - 0.16:
            t = rand.uniform(0.07, 0.12)
            h = rand.uniform(0.26, 0.34)
            box("book.%d.%.2f" % (s, y), tokens[int(rand.random() * len(tokens))],
                kx0 + 0.06, y, z, kx0 + 0.4, y + t, z + h, bevel=0.008)
            y += t + 0.01
    cyl("globe.stand", ink, 0.1, kh, kh + 0.05, kx0 + 0.26, (ky0 + ky1) / 2, segments=16)
    cyl("globe.post", ink, 0.015, kh + 0.05, kh + 0.2, kx0 + 0.26, (ky0 + ky1) / 2, segments=8)
    ball("globe", blue, 0.2, kx0 + 0.26, (ky0 + ky1) / 2, kh + 0.38)


def chair(pal, name, x, y, turn, seat, leg):
    """A chair whose seat is centred on (x, y), its back toward +y before `turn`."""
    parts = [
        box(name + ".seat", seat, -0.22, -0.2, 0.42, 0.22, 0.2, 0.47),
        box(name + ".back", seat, -0.22, 0.16, 0.6, 0.22, 0.2, 0.86),
    ]
    for i, (lx, ly) in enumerate(((-0.19, -0.17), (0.19, -0.17), (-0.19, 0.17), (0.19, 0.17))):
        parts.append(box("%s.leg.%d" % (name, i), leg, lx - 0.02, ly - 0.02, 0.0, lx + 0.02, ly + 0.02,
                         0.86 if ly > 0 else 0.42, bevel=0.0))
    for p in parts:
        p.matrix_world = Matrix.Translation((x, y, 0.0)) @ Matrix.Rotation(turn, 4, "Z") @ p.matrix_world


def desk(pal, name, x, y, floor, top, leg, seat):
    """A student desk centred on (x, y), with its chair on the -y side."""
    box(name + ".top", top, x - 0.5, y - 0.33, 0.7, x + 0.5, y + 0.33, 0.76)
    box(name + ".shelf", leg, x - 0.44, y - 0.1, 0.5, x + 0.44, y + 0.3, 0.53, bevel=0.0)
    for i, (lx, ly) in enumerate(((-0.44, -0.27), (0.44, -0.27), (-0.44, 0.27), (0.44, 0.27))):
        box("%s.leg.%d" % (name, i), leg, x + lx - 0.025, y + ly - 0.025, 0.0,
            x + lx + 0.025, y + ly + 0.025, 0.7, bevel=0.0)
    chair(pal, name + ".chair", x, y - 0.62, 0.0, seat=seat, leg=leg)


# --------------------------------------------------------------------------
# Framing: the model's projected bounds decide the camera, not a constant
# --------------------------------------------------------------------------

def frame(scene, cam, width, height):
    """Centre the model and set ortho_scale so it fills the frame less MARGIN."""
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
    # ortho_scale spans the frame's longer side.
    scale = max(sx / fill, sy / fill * aspect) if aspect >= 1 else max(sx / fill / aspect, sy / fill)
    cam.data.ortho_scale = scale
    fwd = rot @ Vector((0, 0, -1))
    centre = right * cx + up * cy
    # Keep the camera's distance along its own axis; move it across only.
    along = cam.location.dot(fwd)
    cam.location = centre + fwd * along
    return scale


def main():
    a, ledger, entry, version, out_path = art.begin("scene_hero.py")
    theme = entry["theme"]
    if theme not in ("light", "dark"):
        art.fail("the hero is rendered per theme, not %r" % theme)
    scene = art.reset_scene()
    pal = art.palette(theme)
    build(pal, art.rng(entry))
    cam = art.add_camera(scene, "iso", entry["width"], entry["height"])
    frame(scene, cam, entry["width"], entry["height"])
    art.add_light_rig(scene)
    art.set_world(scene, pal)
    art.set_render(scene, entry)
    scene.render.film_transparent = True
    art.render_to(scene, out_path)
    if a["no_ledger"]:
        print("blender-art: wrote %s (ledger untouched)" % out_path)
        return
    art.finish_entry(ledger, entry, out_path, version, art.used_tokens())


if __name__ == "__main__":
    main()
