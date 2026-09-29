"""scene_icons.py - the icon family: one mesh scene per tool, exported as a
currentColor line SVG through art_common.export_svg_lines, or rendered as a
96x96 shortcut PNG from the very same lines.

    blender -b --factory-startup -P Tools/blender-art/scene_icons.py -- --entry assets/art/icons/t007.svg
    blender -b --factory-startup -P Tools/blender-art/scene_icons.py -- --entry assets/art/shortcuts/t007-96.png

Each icon is a function below, keyed by the entry's "subject" (the tool
number). Icons are built from primitives and framed automatically: frame()
centres the projected drawing and scales the orthographic camera so its longer
side fills FILL of the frame, which keeps the set at one optical size however
big each model happens to be.

The style, so every icon in the set matches:
  * One object, or one small group, seen from the icon camera (three-quarter,
    30 degrees up, from the front right). No ground plane, no scenery.
  * Flat faces for anything that should draw as an outline (a door, a sheet of
    paper); closed boxes where the thickness should show (a clipboard, a
    screen). Marks on a surface (a list's lines, a calendar grid) are loose
    "wire" edges, not faces.
  * One stroke weight for the whole set, STROKE, on the 48-unit viewBox. The
    landing page draws icons at 32 CSS px, where 2.25 units is 1.5 px, the
    Path 21 floor. Do not draw these any smaller than 32 px without a heavier
    stroke; HISTORY.md's Path 21 P2 entry has the reasoning.
  * Look at every icon at 24, 32 and 48 px in both themes before keeping it,
    and ask what a seventh grader would say about the silhouette. 007's
    comment records three drafts that failed that test.

No colour reaches an SVG (it is stroke="currentColor"). The meshes still get
token materials, so a scene opened in the viewport is legible, and the
shortcut PNGs draw the lines in --ink on --paper as emission, which renders
each token exactly.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy          # noqa: E402
import bmesh        # noqa: E402
from mathutils import Vector  # noqa: E402
from bpy_extras.object_utils import world_to_camera_view  # noqa: E402
import art_common as art  # noqa: E402

STROKE = 2.25       # viewBox units on 48: 1.5 px at the landing page's 32 px
FILL = 0.8          # the drawing's longer side, as a fraction of the frame
FACING = 45.0       # rotation about Z that turns a -Y face toward the icon camera


# --------------------------------------------------------------------------
# Primitives
# --------------------------------------------------------------------------

def _mesh_object(name, bm, mat, parent=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    obj.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def group(name, rot=(0.0, 0.0, 0.0), loc=(0.0, 0.0, 0.0)):
    """An empty to model a thing in its own frame (front face toward -Y) and
    then turn the whole thing toward the camera. rot is in degrees."""
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.rotation_euler = tuple(math.radians(a) for a in rot)
    e.location = loc
    return e


def _place(obj, loc, rot):
    obj.location = loc
    obj.rotation_euler = tuple(math.radians(a) for a in rot)
    return obj


def box(name, size, mat, loc=(0.0, 0.0, 0.0), rot=(0.0, 0.0, 0.0), parent=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    return _place(_mesh_object(name, bm, mat, parent), loc, rot)


def cylinder(name, r, depth, mat, loc=(0.0, 0.0, 0.0), rot=(0.0, 0.0, 0.0), r2=None,
             segments=32, caps=True, parent=None):
    """A cylinder or a cone along Z, centred on loc. caps=False leaves it open,
    so its rims are boundaries and draw whole."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=segments,
                          radius1=r, radius2=r if r2 is None else r2, depth=depth)
    return _place(_mesh_object(name, bm, mat, parent), loc, rot)


def sphere(name, r, mat, loc=(0.0, 0.0, 0.0), parent=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=r)
    return _place(_mesh_object(name, bm, mat, parent), loc, (0.0, 0.0, 0.0))


def flat(name, pts, mat, loc=(0.0, 0.0, 0.0), rot=(0.0, 0.0, 0.0), parent=None):
    """One n-gon in the X-Z plane (its face toward -Y): its boundary is the
    outline and nothing else draws. pts are (x, z) pairs."""
    bm = bmesh.new()
    bm.faces.new([bm.verts.new((x, 0.0, z)) for x, z in pts])
    bm.normal_update()
    return _place(_mesh_object(name, bm, mat, parent), loc, rot)


def wire(name, lines, mat, loc=(0.0, 0.0, 0.0), rot=(0.0, 0.0, 0.0), parent=None):
    """Loose edges: each line is a list of (x, y, z) points, drawn as a
    polyline; a line whose last point repeats its first is closed."""
    bm = bmesh.new()
    for pts in lines:
        closed = len(pts) > 2 and tuple(pts[0]) == tuple(pts[-1])
        vs = [bm.verts.new(p) for p in (pts[:-1] if closed else pts)]
        for i in range(len(vs) - 1):
            bm.edges.new((vs[i], vs[i + 1]))
        if closed:
            bm.edges.new((vs[-1], vs[0]))
    return _place(_mesh_object(name, bm, mat, parent), loc, rot)


def rect(x0, z0, x1, z1, y=0.0):
    """A closed rectangle in the X-Z plane at depth y, for wire()."""
    return [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1), (x0, y, z0)]


def circle(cx, cz, r, y=0.0, segments=16):
    pts = [(cx + r * math.cos(2 * math.pi * i / segments), y, cz + r * math.sin(2 * math.pi * i / segments))
           for i in range(segments)]
    return pts + [pts[0]]


def prism(name, pts, depth, mat, loc=(0.0, 0.0, 0.0), rot=(0.0, 0.0, 0.0), parent=None):
    """An n-gon in the X-Z plane (pts are (x, z) pairs) extruded along Y, its
    front face at -depth/2. Its outline and edge thickness draw; nothing on
    the flat faces does."""
    bm = bmesh.new()
    front = [bm.verts.new((x, -depth / 2, z)) for x, z in pts]
    back = [bm.verts.new((x, depth / 2, z)) for x, z in pts]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((front[j], front[i], back[i], back[j]))
    bm.normal_update()
    return _place(_mesh_object(name, bm, mat, parent), loc, rot)


def rounded(w, h, r, segments=4, cx=0.0, cz=0.0):
    """(x, z) points of a w x h rectangle with corner radius r, centred."""
    pts = []
    corners = ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270))
    for x0, z0, a0 in corners:
        for i in range(segments + 1):
            a = math.radians(a0 + 90.0 * i / segments)
            pts.append((cx + x0 + r * math.cos(a), cz + z0 + r * math.sin(a)))
    return pts


def disk(r, segments=24, cx=0.0, cz=0.0):
    return [(cx + r * math.cos(2 * math.pi * i / segments), cz + r * math.sin(2 * math.pi * i / segments))
            for i in range(segments)]


def tube_arc(name, radius, tube, a0, a1, mat, segments=16, minor=12, loc=(0.0, 0.0, 0.0),
             rot=(0.0, 0.0, 0.0), parent=None):
    """A bent tube (a torus from angle a0 to a1, degrees) in the X-Z plane,
    open at both ends. minor=12 keeps its facets under the 35-degree crease
    angle, so only its silhouette draws."""
    bm = bmesh.new()
    rings = []
    for i in range(segments + 1):
        a = math.radians(a0 + (a1 - a0) * i / segments)
        c = Vector((radius * math.cos(a), 0.0, radius * math.sin(a)))
        out = Vector((math.cos(a), 0.0, math.sin(a)))
        ring = []
        for k in range(minor):
            b = 2 * math.pi * k / minor
            ring.append(bm.verts.new(c + out * (tube * math.cos(b)) + Vector((0.0, tube * math.sin(b), 0.0))))
        rings.append(ring)
    for i in range(segments):
        for k in range(minor):
            m = (k + 1) % minor
            bm.faces.new((rings[i][k], rings[i][m], rings[i + 1][m], rings[i + 1][k]))
    bm.normal_update()
    return _place(_mesh_object(name, bm, mat, parent), loc, rot)


def dog_eared(w, h, ear):
    """(x, z) points of a page with its top-right corner folded."""
    return [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2 - ear), (w / 2 - ear, h / 2), (-w / 2, h / 2)]


def lines_on(x0, x1, zs, y, short=()):
    """Horizontal text lines at heights zs; any index in short stops early."""
    return [[(x0, y, z), ((x0 + (x1 - x0) * 0.55) if i in short else x1, y, z)] for i, z in enumerate(zs)]

def cup(name, radius, height, segments, mat):
    """An open-topped cylinder: its rim is a boundary edge, so it draws whole."""
    bm = bmesh.new()
    ring_lo, ring_hi = [], []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        x, y = radius * math.cos(a), radius * math.sin(a)
        ring_lo.append(bm.verts.new((x, y, 0.0)))
        ring_hi.append(bm.verts.new((x * 1.08, y * 1.08, height)))   # a slight flare
    for i in range(segments):
        j = (i + 1) % segments
        bm.faces.new((ring_lo[i], ring_lo[j], ring_hi[j], ring_hi[i]))
    bm.faces.new(list(reversed(ring_lo)))
    bm.normal_update()
    return _mesh_object(name, bm, mat)


def stick(name, width, length, mat, round_segments=6):
    """A craft stick as one flat face with rounded ends, so its boundary is the
    outline and nothing else is drawn."""
    bm = bmesh.new()
    r = width / 2
    pts = []
    for i in range(round_segments + 1):                  # top end
        a = math.pi * i / round_segments
        pts.append((r * math.cos(a), length / 2 - r + r * math.sin(a)))
    for i in range(round_segments + 1):                  # bottom end
        a = math.pi + math.pi * i / round_segments
        pts.append((r * math.cos(a), -length / 2 + r + r * math.sin(a)))
    verts = [bm.verts.new((x, 0.0, y)) for x, y in pts]
    bm.faces.new(verts)
    bm.normal_update()
    return _mesh_object(name, bm, mat)


# --------------------------------------------------------------------------
# The icons, in tool-number order
# --------------------------------------------------------------------------

def icon_001(pal, rand):
    """001 Hall Pass: a door standing open. The frame is one U-shaped face and
    the door one flat panel swung toward the viewer, so the drawing is two
    outlines and a knob."""
    body = art.token_material(pal, "--card")
    g = group("door", rot=(0.0, 0.0, FACING - 25.0))
    flat("frame", [(-0.72, 0.0), (-0.72, 2.45), (0.72, 2.45), (0.72, 0.0),
                   (0.58, 0.0), (0.58, 2.31), (-0.58, 2.31), (-0.58, 0.0)], body, parent=g)
    # Hinged on the right jamb and swung toward the viewer. Hinged on the left,
    # the open panel lies along the camera's line of sight and draws as a
    # sliver (the first cut did exactly that).
    swing = 55.0 + rand.uniform(-1.0, 1.0)
    flat("panel", [(-1.14, 0.0), (0.0, 0.0), (0.0, 2.29), (-1.14, 2.29)], body,
         loc=(0.58, -0.01, 0.0), rot=(0.0, 0.0, swing), parent=g)
    a = math.radians(180.0 + swing)
    kx, ky = 0.58 + 0.98 * math.cos(a), -0.01 + 0.98 * math.sin(a)
    sphere("knob", 0.08, body, loc=(kx + 0.05, ky - 0.05, 1.1), parent=g)


def icon_002(pal, rand):
    """002 Group Generator: three pawns standing together on one round base.
    Pawns rather than people-shapes: a head and a cone, nothing that can be
    read as anything else."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    cylinder("base", 1.3, 0.14, wood, loc=(0.0, 0.0, 0.07), segments=48)
    for i, ang in enumerate((100.0, 220.0, 340.0)):
        a = math.radians(ang + rand.uniform(-3.0, 3.0))
        x, y = 0.6 * math.cos(a), 0.6 * math.sin(a)
        cylinder("pawn.%d" % i, 0.3, 0.7, body, loc=(x, y, 0.14 + 0.35), r2=0.1, segments=24)
        sphere("head.%d" % i, 0.22, body, loc=(x, y, 0.14 + 0.7 + 0.13))


def icon_003(pal, rand):
    """003 Rubric Builder: a scoring grid on a dog-eared sheet, a criteria
    column on the left and a check in one level of each row."""
    body = art.token_material(pal, "--card")
    g = group("rubric", rot=(-30.0, 0.0, FACING - 15.0))
    flat("sheet", dog_eared(1.7, 2.2, 0.4), body, parent=g)
    y, top, bot = -0.01, 0.62, -0.95
    lines = [[(-0.7, y, 0.86), (0.05, y, 0.86)]]                       # the title
    for z in (top, 0.23, -0.16, -0.55, bot):
        lines.append([(-0.7, y, z), (0.7, y, z)])
    for x in (-0.7, -0.15, 0.28, 0.7):
        lines.append([(x, y, top), (x, y, bot)])

    def check(cx, cz, s=0.1):
        return [(cx - s, y, cz), (cx - s * 0.2, y, cz - s * 0.9), (cx + s * 1.3, y, cz + s)]
    lines += [check(0.04, 0.42), check(0.47, 0.03), check(0.04, -0.36), check(0.47, -0.75)]
    wire("grid", lines, body, parent=g)


def icon_004(pal, rand):
    """004 Classroom Timer: an hourglass, two plates, two posts, two open
    cones and a pile of sand."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    h = 2.2
    cylinder("plate.lo", 0.82, 0.16, wood, loc=(0.0, 0.0, 0.08), segments=40)
    cylinder("plate.hi", 0.82, 0.16, wood, loc=(0.0, 0.0, h - 0.08), segments=40)
    glass = (h - 0.32) / 2
    cylinder("glass.lo", 0.6, glass, body, loc=(0.0, 0.0, 0.16 + glass / 2), r2=0.07, caps=False, segments=32)
    cylinder("glass.hi", 0.07, glass, body, loc=(0.0, 0.0, h - 0.16 - glass / 2), r2=0.6, caps=False, segments=32)
    cylinder("sand", 0.42, 0.28, wood, loc=(0.0, 0.0, 0.16 + 0.14), r2=0.02, caps=False, segments=32)
    # Posts to either side as the camera sees it (perpendicular to its view).
    side = math.radians(FACING)
    for i, s in enumerate((-1.0, 1.0)):
        cylinder("post.%d" % i, 0.05, h - 0.32, wood,
                 loc=(s * 0.7 * math.cos(side), s * 0.7 * math.sin(side), h / 2), segments=12)


def icon_005(pal, rand):
    """005 Seating Chart: four chairs in two rows, facing the viewer the way
    a class faces the teacher. Recorded so nobody retries them: six bare desk
    slabs read as a chocolate bar, and desk tops with a chair back behind each
    read as four open laptops. The legs are what make it seating. The rows run
    square to the viewer; on the world axes they ran diagonally across the
    frame and overlapped into one shape."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("room", rot=(0.0, 0.0, FACING - 12.0))
    w, d, seat, back = 0.3, 0.28, 0.55, 0.62
    for r in range(2):
        for c in range(2):
            x, y = (c - 0.5) * 1.45, (r - 0.5) * 1.9
            flat("seat.%d.%d" % (r, c), [(-w, -d), (w, -d), (w, d), (-w, d)], wood,
                 loc=(x, y, seat), rot=(90.0, 0.0, 0.0), parent=g)
            flat("back.%d.%d" % (r, c), [(-w, 0.0), (w, 0.0), (w, back), (-w, back)], body,
                 loc=(x, y + d, seat), parent=g)
            wire("legs.%d.%d" % (r, c), [[(sx * w, sy * d, seat), (sx * w, sy * d, 0.0)]
                                         for sx in (-1, 1) for sy in (-1, 1)], wood,
                 loc=(x, y, 0.0), parent=g)


def icon_006(pal, rand):
    """006 Class Roster Hub: a clipboard with a checklist on it."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("clipboard", rot=(-18.0, 0.0, FACING - 12.0))
    box("board", (1.7, 0.08, 2.2), wood, parent=g)
    box("clip", (0.7, 0.16, 0.3), body, loc=(0.0, -0.06, 1.08), parent=g)
    lines = []
    for i, z in enumerate((0.55, 0.08, -0.39, -0.86)):
        lines.append(rect(-0.62, z - 0.12, -0.38, z + 0.12, y=-0.045))
        lines.append([(-0.22, -0.045, z), (0.62 - 0.14 * (i % 2), -0.045, z)])
    wire("list", lines, body, parent=g)


def icon_007(pal, rand):
    """007 Name Picker: a cup of name sticks, one drawn up out of the rest.
    Craft sticks in a cup are how most classrooms pick a name, and the shape
    survives 48 px where a spinner or a slot machine does not."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    cup("cup", 0.66, 0.95, 40, body).location = (0.0, 0.0, -1.45)
    # Three short sticks low in the cup, and one drawn up and out to the right,
    # tilted: the name being picked. Tilts are nudged by the seed within a
    # small range. Earlier cuts, recorded so nobody retries them: three equal
    # sticks read as fingers at 48 px; five read as fries; and one tall stick
    # straight up the middle between two short ones reads as a rude gesture.
    # Keep the picked stick off-centre and tilted.
    fan = ((-0.34, -14.0, -0.42), (-0.04, -3.0, -0.3), (0.26, 9.0, -0.45), (0.62, 30.0, 0.62))
    for i, (x, tilt, lift) in enumerate(fan):
        s = stick("stick.%d" % i, 0.25, 1.75, wood)
        jitter = rand.uniform(-1.5, 1.5)
        s.rotation_euler = (0.0, math.radians(tilt + jitter), math.radians(45.0))
        # Rotate the stick's face toward the three-quarter camera (azimuth 45).
        s.location = (x * math.cos(math.radians(45.0)), x * math.sin(math.radians(45.0)), -0.55 + lift)


def _star(n, r_out, r_in):
    pts = []
    for i in range(2 * n):
        r = r_out if i % 2 == 0 else r_in
        a = math.pi / 2 + math.pi * i / n
        pts.append((r * math.cos(a), r * math.sin(a)))
    return pts


def icon_008(pal, rand):
    """008 Behavior & Points: a thick gold-star award, turned so its edge
    shows. The site's pin control is a flat outline star; this one is a solid,
    which is the difference between a reward and a bookmark."""
    body = art.token_material(pal, "--card")
    g = group("star", rot=(0.0, 0.0, FACING - 32.0))
    pts = _star(5, 1.25, 0.52)
    bm = bmesh.new()
    front = [bm.verts.new((x, -0.16, z)) for x, z in pts]
    back = [bm.verts.new((x, 0.16, z)) for x, z in pts]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((front[j], front[i], back[i], back[j]))
    bm.normal_update()
    _mesh_object("star", bm, body, parent=g)


def icon_009(pal, rand):
    """009 Backup & Restore: a storage box with its lid lifting, a hand hole
    in its front. Where everything is kept, and where it comes back from."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("box", rot=(0.0, 0.0, FACING - 25.0))
    box("body", (2.0, 1.3, 1.0), wood, loc=(0.0, 0.0, 0.5), parent=g)
    hinge = group("hinge", rot=(-20.0, 0.0, 0.0), loc=(0.0, 0.71, 1.02))
    hinge.parent = g
    box("lid", (2.14, 1.44, 0.26), body, loc=(0.0, -0.72, 0.13), parent=hinge)
    hole = [(x, -0.66, z) for x, z in rounded(0.62, 0.2, 0.09, cz=0.7)]
    wire("hole", [hole + [hole[0]]], body, parent=g)


def icon_010(pal, rand):
    """010 Command Center: a monitor on a stand, its screen split into the
    dashboard's panels."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("monitor", rot=(0.0, 0.0, FACING - 22.0))
    box("screen", (2.4, 0.14, 1.5), body, loc=(0.0, 0.0, 1.3), parent=g)
    box("neck", (0.22, 0.12, 0.5), wood, loc=(0.0, 0.1, 0.3), parent=g)
    box("foot", (0.95, 0.55, 0.07), wood, loc=(0.0, 0.1, 0.035), parent=g)
    y = -0.075
    lines = [rect(-1.04, 0.72, 1.04, 1.88, y=y),                 # the bezel's inner edge
             [(0.2, y, 0.72), (0.2, y, 1.88)],                   # a wide panel and two small
             [(0.2, y, 1.3), (1.04, y, 1.3)]]
    for i, top in enumerate((1.25, 1.6, 1.4)):                   # a small bar chart, left
        x = -0.8 + i * 0.28
        lines.append([(x, y, 0.9), (x, y, top)])
    wire("panels", lines, body, parent=g)


def icon_011(pal, rand):
    """011 Image to PDF: a photo laid over a dog-eared page."""
    body = art.token_material(pal, "--card")
    g = group("pdf", rot=(0.0, 0.0, FACING - 20.0))
    flat("page", dog_eared(1.5, 2.0, 0.42), body, loc=(0.4, 0.12, 0.3), parent=g)
    wire("text", lines_on(-0.05, 0.9, (1.0, 0.76, 0.52), 0.1, short=(0,)), body, parent=g)
    photo = flat("photo", [(-0.72, -0.52), (0.72, -0.52), (0.72, 0.52), (-0.72, 0.52)], body,
                 loc=(-0.3, -0.05, -0.2), rot=(0.0, -7.0, 0.0), parent=g)
    y = -0.01
    wire("scene", [[(-0.6, y, -0.4), (-0.18, y, 0.08), (0.06, y, -0.16), (0.3, y, 0.14), (0.6, y, -0.4)],
                   circle(0.36, 0.3, 0.1, y=y, segments=12)], body, parent=photo)


def icon_012(pal, rand):
    """012 Graph Paper & Number Line: a sheet of graph paper with a line
    plotted across it."""
    body = art.token_material(pal, "--card")
    g = group("graph", rot=(-28.0, 0.0, FACING - 15.0))
    flat("sheet", [(-1.1, -0.85), (1.1, -0.85), (1.1, 0.85), (-1.1, 0.85)], body, parent=g)
    y = -0.01
    lines = [[(x, y, -0.7), (x, y, 0.7)] for x in (-0.55, 0.0, 0.55)]
    lines += [[(-0.95, y, z), (0.95, y, z)] for z in (-0.35, 0.0, 0.35)]
    wire("grid", lines, body, parent=g)
    wire("plot", [[(-0.95, -0.03, -0.7), (-0.3, -0.03, -0.12), (0.2, -0.03, -0.3), (0.95, -0.03, 0.7)]], body, parent=g)


def icon_013(pal, rand):
    """013 Lab Safety Contract: safety goggles, two lenses on a bridge with
    the strap curving away behind them."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("goggles", rot=(0.0, 0.0, FACING - 20.0))
    lens = rounded(0.95, 0.7, 0.3)
    prism("lens.l", lens, 0.24, body, loc=(-0.56, 0.0, 0.0), rot=(0.0, 0.0, 10.0), parent=g)
    prism("lens.r", lens, 0.24, body, loc=(0.56, 0.0, 0.0), rot=(0.0, 0.0, -10.0), parent=g)
    box("bridge", (0.3, 0.14, 0.14), body, loc=(0.0, 0.0, 0.08), parent=g)
    bm = bmesh.new()
    top, bot = [], []
    for i in range(25):
        a = math.pi * i / 24
        x, yy = 1.12 * math.cos(a), 0.12 + 0.95 * math.sin(a)
        top.append(bm.verts.new((x, yy, 0.13)))
        bot.append(bm.verts.new((x, yy, -0.13)))
    for i in range(24):
        bm.faces.new((bot[i], bot[i + 1], top[i + 1], top[i]))
    bm.normal_update()
    _mesh_object("strap", bm, wood, parent=g)


def icon_014(pal, rand):
    """014 Roleplay Scenario: two speech bubbles, a conversation. The front
    one carries lines of text; the one answering is still thinking."""
    body = art.token_material(pal, "--card")
    g = group("talk", rot=(0.0, 0.0, FACING - 20.0))

    def bubble(w, h, tail):
        pts = rounded(w, h, 0.28)
        return pts[:15] + [(x, -h / 2 + dz) for x, dz in tail] + pts[15:]
    a = prism("say", bubble(1.7, 1.0, ((-0.35, 0.0), (-0.6, -0.4), (-0.05, 0.0))), 0.12, body,
              loc=(-0.35, 0.0, 0.4), parent=g)
    wire("words", lines_on(-0.55, 0.55, (0.15, -0.15), -0.07, short=(1,)), body, parent=a)
    b = prism("reply", bubble(1.4, 0.85, ((0.1, 0.0), (0.5, -0.36), (0.38, 0.0))), 0.12, body,
              loc=(0.6, 0.6, -0.6), parent=g)
    wire("dots", [circle(x, 0.0, 0.07, y=-0.07, segments=8) for x in (-0.32, 0.0, 0.32)], body, parent=b)


def icon_015(pal, rand):
    """015 Timeline Builder: a rail running to an arrowhead, with events
    marked on posts of different heights."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("timeline", rot=(0.0, 0.0, FACING - 25.0))
    box("rail", (2.7, 0.14, 0.14), wood, loc=(-0.1, 0.0, 0.0), parent=g)
    cylinder("head", 0.2, 0.36, wood, loc=(1.43, 0.0, 0.0), rot=(0.0, 90.0, 0.0), r2=0.0, segments=16, parent=g)
    posts = []
    for i, (x, h) in enumerate(((-1.05, 0.7), (-0.35, 1.15), (0.35, 0.85), (1.0, 1.3))):
        posts.append([(x, 0.0, 0.07), (x, 0.0, h)])
        flat("mark.%d" % i, disk(0.2, 16), body, loc=(x, -0.01, h + 0.2), parent=g)
    wire("posts", posts, wood, parent=g)


def icon_016(pal, rand):
    """016 QR Code Generator: a QR tile, its three finder squares in the
    corners and a scatter of modules. The finders are what make it a QR code
    at 32 px; the modules only have to suggest data."""
    body = art.token_material(pal, "--card")
    g = group("qr", rot=(-25.0, 0.0, FACING - 15.0))
    box("tile", (2.0, 0.1, 2.0), body, parent=g)
    y = -0.055
    lines = []
    for cx, cz in ((-0.6, 0.6), (0.6, 0.6), (-0.6, -0.6)):
        lines.append(rect(cx - 0.3, cz - 0.3, cx + 0.3, cz + 0.3, y=y))
        lines.append(rect(cx - 0.11, cz - 0.11, cx + 0.11, cz + 0.11, y=y))
    for cx, cz in ((0.18, 0.12), (0.56, -0.12), (0.72, -0.62), (0.3, -0.52), (-0.1, -0.28), (0.12, 0.62)):
        lines.append(rect(cx - 0.08, cz - 0.08, cx + 0.08, cz + 0.08, y=y))
    wire("code", lines, body, parent=g)


def icon_017(pal, rand):
    """017 Gallery Walk QR: a poster on an easel with a QR tag in its corner,
    one stop on the walk."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("easel", rot=(0.0, 0.0, FACING - 20.0))
    wire("legs", [[(-0.8, -0.25, 0.0), (-0.22, 0.05, 2.35)], [(0.8, -0.25, 0.0), (0.22, 0.05, 2.35)],
                  [(0.0, 0.9, 0.0), (0.0, 0.2, 2.1)]], wood, parent=g)
    box("tray", (1.8, 0.28, 0.07), wood, loc=(0.0, -0.22, 0.7), parent=g)
    canvas = box("poster", (1.6, 0.08, 1.25), body, loc=(0.0, -0.16, 1.38), rot=(-8.0, 0.0, 0.0), parent=g)
    y = -0.045
    lines = lines_on(-0.62, 0.62, (0.4, 0.14, -0.1), y, short=(2,))
    lines += [rect(0.26, -0.5, 0.62, -0.14, y=y), rect(0.38, -0.38, 0.5, -0.26, y=y)]
    wire("content", lines, body, parent=canvas)


def icon_018(pal, rand):
    """018 QR Scavenger Hunt: a magnifying glass, the hunt's own tool."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("magnifier", rot=(0.0, 0.0, FACING - 15.0))
    cylinder("rim", 0.75, 0.16, body, loc=(-0.3, 0.0, 0.35), rot=(90.0, 0.0, 0.0), caps=False, segments=40, parent=g)
    d = Vector((math.cos(math.radians(-45.0)), 0.0, math.sin(math.radians(-45.0))))
    c = Vector((-0.3, 0.0, 0.35)) + d * (0.75 + 0.62)
    cylinder("handle", 0.14, 1.1, wood, loc=tuple(c), rot=(0.0, 135.0, 0.0), segments=16, parent=g)
    glint = [(-0.3 + 0.5 * math.cos(math.radians(a)), -0.09, 0.35 + 0.5 * math.sin(math.radians(a)))
             for a in range(110, 171, 10)]
    wire("glint", [glint], body, parent=g)


def icon_019(pal, rand):
    """019 Escape Room / Puzzle Lock: a padlock with a keyhole."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("lock", rot=(0.0, 0.0, FACING - 25.0))
    prism("body", rounded(1.5, 1.2, 0.18), 0.55, wood, parent=g)
    tube_arc("shackle", 0.45, 0.1, 0.0, 180.0, body, loc=(0.0, 0.0, 0.98), parent=g)
    for i, x in enumerate((-0.45, 0.45)):
        cylinder("leg.%d" % i, 0.1, 0.44, body, loc=(x, 0.0, 0.76), segments=12, caps=False, parent=g)
    wire("keyhole", [circle(0.0, 0.08, 0.13, y=-0.285, segments=12), [(0.0, -0.285, -0.05), (0.0, -0.285, -0.32)]],
         body, parent=g)


def icon_020(pal, rand):
    """020 Bracket / Tournament: a four-team bracket on a board, narrowing to
    one winner."""
    body = art.token_material(pal, "--card")
    g = group("bracket", rot=(-20.0, 0.0, FACING - 15.0))
    flat("board", [(-1.2, -0.9), (1.2, -0.9), (1.2, 0.9), (-1.2, 0.9)], body, parent=g)
    y = -0.01
    lines = [[(-1.0, y, z), (-0.5, y, z)] for z in (0.6, 0.2, -0.2, -0.6)]
    lines += [[(-0.5, y, 0.6), (-0.5, y, 0.2)], [(-0.5, y, -0.2), (-0.5, y, -0.6)],
              [(-0.5, y, 0.4), (0.05, y, 0.4)], [(-0.5, y, -0.4), (0.05, y, -0.4)],
              [(0.05, y, 0.4), (0.05, y, -0.4)], [(0.05, y, 0.0), (0.55, y, 0.0)],
              circle(0.78, 0.0, 0.2, y=y, segments=16)]
    wire("draw", lines, body, parent=g)


def _ring_xy(cx, cy, z, r, segments=20):
    pts = [(cx + r * math.cos(2 * math.pi * i / segments), cy + r * math.sin(2 * math.pi * i / segments), z)
           for i in range(segments)]
    return pts + [pts[0]]


def icon_021(pal, rand):
    """021 PE Tournament & Stations: three sports cones on their square
    feet, each with a stripe, spread out like stations on a gym floor."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    rings = []
    for i, (x, y) in enumerate(((-0.85, 0.35), (0.1, -0.4), (0.9, 0.45))):
        box("foot.%d" % i, (0.78, 0.78, 0.06), wood, loc=(x, y, 0.03), rot=(0.0, 0.0, 20.0))
        cylinder("cone.%d" % i, 0.32, 1.0, body, loc=(x, y, 0.56), r2=0.06, caps=False, segments=24)
        rings.append(_ring_xy(x, y, 0.62, 0.32 - 0.26 * 0.56 + 0.01))
    wire("stripes", rings, body)


def _pip(center, u, v, r=0.07, segments=10):
    c, u, v = Vector(center), Vector(u), Vector(v)
    pts = [tuple(c + u * (r * math.cos(2 * math.pi * i / segments)) + v * (r * math.sin(2 * math.pi * i / segments)))
           for i in range(segments)]
    return pts + [pts[0]]


def icon_022(pal, rand):
    """022 Lab Group & Role Randomizer: a lab flask and a die beside it, the
    lab and the random draw."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    fx, fy = -0.4, 0.3
    cylinder("flask", 0.75, 1.2, body, loc=(fx, fy, 0.6), r2=0.2, segments=32)
    cylinder("neck", 0.2, 0.55, body, loc=(fx, fy, 1.2 + 0.275), caps=False, segments=20)
    wire("liquid", [_ring_xy(fx, fy, 0.45, 0.75 - 0.55 * 0.45 / 1.2 + 0.01, segments=28)], body)
    die = box("die", (0.72, 0.72, 0.72), wood, loc=(0.8, -0.45, 0.36), rot=(0.0, 0.0, 18.0))
    h = 0.365
    pips = [_pip((0.0, 0.0, h), (1, 0, 0), (0, 1, 0))]                           # top: one
    pips += [_pip((dx, -h, dz), (1, 0, 0), (0, 0, 1)) for dx, dz in ((-0.17, 0.17), (0.17, -0.17))]  # front: two
    pips += [_pip((h, dy, dz), (0, 1, 0), (0, 0, 1)) for dy, dz in ((-0.18, 0.18), (0.0, 0.0), (0.18, -0.18))]  # side: three
    wire("pips", pips, wood, parent=die)


def icon_023(pal, rand):
    """023 Exit Ticket / Bell Ringer: an admission ticket, notched on both
    sides, with a perforated stub."""
    body = art.token_material(pal, "--card")
    g = group("ticket", rot=(-15.0, 0.0, FACING - 20.0))
    w, h, r = 2.4, 1.3, 0.2
    pts = [(-w / 2, -h / 2), (w / 2, -h / 2)]
    pts += [(w / 2 + r * math.cos(math.radians(270 - 180 * i / 8)), r * math.sin(math.radians(270 - 180 * i / 8)))
            for i in range(9)]
    pts += [(w / 2, h / 2), (-w / 2, h / 2)]
    pts += [(-w / 2 + r * math.cos(math.radians(90 - 180 * i / 8)), r * math.sin(math.radians(90 - 180 * i / 8)))
            for i in range(9)]
    prism("ticket", pts, 0.06, body, parent=g)
    y = -0.035
    lines = [[(0.55, y, z), (0.55, y, z + 0.13)] for z in (-0.55, -0.3, -0.05, 0.2, 0.42)]
    lines += lines_on(-0.9, 0.3, (0.25, -0.05, -0.35), y, short=(2,))
    wire("print", lines, body, parent=g)


def icon_024(pal, rand):
    """024 Number Talks: a chalkboard with the four operations on it."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("chalkboard", rot=(0.0, 0.0, FACING - 20.0))
    box("board", (2.4, 0.12, 1.6), wood, loc=(0.0, 0.0, 0.8), parent=g)
    box("tray", (2.4, 0.3, 0.07), wood, loc=(0.0, -0.18, -0.03), parent=g)
    y, s = -0.065, 0.2
    lines = [rect(-1.04, 0.14, 1.04, 1.46, y=y)]
    # Two rows, far enough apart that the divide sign's dots cannot run into
    # the minus above them (they did, at 24 px, in the first two cuts).
    hi, lo, k = 1.2, 0.52, s * 0.8
    lines += [[(-0.55 - s, y, hi), (-0.55 + s, y, hi)], [(-0.55, y, hi - s), (-0.55, y, hi + s)]]   # +
    lines += [[(0.55 - s, y, hi), (0.55 + s, y, hi)]]                                               # -
    lines += [[(-0.55 - k, y, lo - k), (-0.55 + k, y, lo + k)], [(-0.55 - k, y, lo + k), (-0.55 + k, y, lo - k)]]  # x
    lines += [[(0.55 - s, y, lo), (0.55 + s, y, lo)],
              circle(0.55, lo + 0.2, 0.05, y=y, segments=8), circle(0.55, lo - 0.2, 0.05, y=y, segments=8)]    # divide
    wire("chalk", lines, body, parent=g)


def icon_025(pal, rand):
    """025 Writing Prompt: a pencil at the end of a half-written line."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("write", rot=(-28.0, 0.0, FACING - 15.0))
    flat("page", [(-0.85, -1.1), (0.85, -1.1), (0.85, 1.1), (-0.85, 1.1)], body, parent=g)
    wire("text", lines_on(-0.65, 0.65, (0.75, 0.4, 0.05, -0.3), -0.01, short=(3,)), body, parent=g)
    p = group("pencil", rot=(0.0, 50.0, 0.0), loc=(0.08, -0.16, -0.3))
    p.parent = g
    cylinder("tip", 0.0, 0.3, wood, loc=(0.0, 0.0, 0.15), r2=0.13, segments=6, caps=False, parent=p)
    cylinder("shaft", 0.13, 1.5, body, loc=(0.0, 0.0, 1.05), segments=6, parent=p)
    cylinder("eraser", 0.13, 0.2, wood, loc=(0.0, 0.0, 1.9), segments=12, parent=p)


def icon_026(pal, rand):
    """026 Math Fact Drill: a fanned stack of flash cards, a times sign on
    the top card."""
    body = art.token_material(pal, "--card")
    g = group("cards", rot=(-20.0, 0.0, FACING - 15.0))
    card = rounded(1.9, 1.25, 0.12)
    back = prism("card.2", card, 0.05, body, loc=(0.4, 0.3, 0.5), rot=(0.0, 10.0, 0.0), parent=g)
    prism("card.1", card, 0.05, body, loc=(0.2, 0.15, 0.25), rot=(0.0, 4.0, 0.0), parent=g)
    front = prism("card.0", card, 0.05, body, loc=(0.0, 0.0, 0.0), rot=(0.0, -6.0, 0.0), parent=g)
    y, s = -0.03, 0.2
    # A lone times sign on a card read as "close" or "delete"; with an equals
    # sign after it, it is a sum waiting for its answer.
    wire("times", [[(-0.4 - s, y, -s), (-0.4 + s, y, s)], [(-0.4 - s, y, s), (-0.4 + s, y, -s)],
                   [(0.15, y, 0.1), (0.6, y, 0.1)], [(0.15, y, -0.1), (0.6, y, -0.1)]], body, parent=front)
    wire("plus", [[(0.52, y, 0.44), (0.76, y, 0.44)], [(0.64, y, 0.32), (0.64, y, 0.56)]], body, parent=back)


def icon_027(pal, rand):
    """027 Novel Study / Reading Circles: an open book, lines of text on
    both pages."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    # The spine runs away from the viewer and the pages spread left and right.
    # Turned 90 degrees the other way, the first cut read as a keyboard.
    # Stood up toward the viewer like a book on a stand: lying flat, the camera
    # saw it nearly edge-on and the text lines clotted into dark bars.
    g = group("book", rot=(42.0, 0.0, FACING - 10.0))
    t = math.tan(math.radians(16.0))
    bm = bmesh.new()
    for s in (-1, 1):
        vs = [bm.verts.new(p) for p in ((0.0, -0.85, 0.0), (0.0, 0.85, 0.0),
                                         (s * 1.2, 0.85, 1.2 * t), (s * 1.2, -0.85, 1.2 * t))]
        bm.faces.new(vs if s < 0 else list(reversed(vs)))
    bm.normal_update()
    _mesh_object("pages", bm, body, parent=g)
    bm = bmesh.new()
    for s in (-1, 1):
        vs = [bm.verts.new(p) for p in ((0.0, -0.95, -0.1), (0.0, 0.95, -0.1),
                                         (s * 1.3, 0.95, 1.3 * t - 0.1), (s * 1.3, -0.95, 1.3 * t - 0.1))]
        bm.faces.new(vs if s < 0 else list(reversed(vs)))
    bm.normal_update()
    _mesh_object("cover", bm, wood, parent=g)
    lines = []
    for s in (-1, 1):
        for i, yy in enumerate((-0.45, 0.0, 0.45)):
            x0, x1 = s * 0.25, s * (0.95 if i != 2 else 0.6)
            lines.append([(x0, yy, abs(x0) * t + 0.01), (x1, yy, abs(x1) * t + 0.01)])
    wire("text", lines, body, parent=g)


def icon_028(pal, rand):
    """028 Primary Source Analysis: a document scroll, rolled at the top and
    the bottom, with lines of old handwriting between. Every other page icon
    in the set is a modern sheet; the rolls are what make this one a source."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("scroll", rot=(-12.0, 0.0, FACING - 18.0))
    flat("sheet", [(-0.8, -0.95), (0.8, -0.95), (0.8, 0.95), (-0.8, 0.95)], body, parent=g)
    for i, z in enumerate((1.05, -1.05)):
        cylinder("roll.%d" % i, 0.16, 1.9, wood, loc=(0.0, 0.06, z), rot=(0.0, 90.0, 0.0),
                 segments=16, parent=g)
    wire("hand", lines_on(-0.55, 0.55, (0.55, 0.22, -0.11, -0.44), -0.01, short=(3,)), body, parent=g)


def icon_029(pal, rand):
    """029 Prompt Builder: a written prompt, its last line ending at a text
    cursor, with the four-point sparkle that has come to mean AI. Two cuts
    failed first: a chat window over a pill-shaped input field read as a
    transistor radio, and text lines broken by empty slots read as the
    sliders of a mixing desk."""
    body = art.token_material(pal, "--card")
    g = group("prompt", rot=(-15.0, 0.0, FACING - 15.0))
    flat("sheet", dog_eared(1.7, 2.2, 0.4), body, parent=g)
    y = -0.01
    lines = lines_on(-0.62, 0.55, (0.45, 0.1, -0.25), y)
    lines.append([(-0.62, y, -0.6), (-0.05, y, -0.6)])
    lines.append([(0.1, y, -0.78), (0.1, y, -0.42)])                   # the cursor
    wire("prompt", lines, body, parent=g)
    flat("sparkle", _star(4, 0.5, 0.13), body, loc=(0.9, -0.05, 1.1), parent=g)


def icon_030(pal, rand):
    """030 Quiz / Review Game Board: a game board of raised tiles under a
    header band, one tile already taken. Separate tiles with gaps between,
    not a ruled grid, so it cannot be mistaken for 032's calendar. The first
    cut raised every tile as a box, and their doubled edges clotted into one
    dark block at 32 px; flat tiles on a flat board draw as single outlines."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("board", rot=(-8.0, 0.0, FACING - 20.0))
    flat("board", [(-1.25, -0.98), (1.25, -0.98), (1.25, 0.98), (-1.25, 0.98)], wood, loc=(0.0, 0.0, 0.0), parent=g)
    y = -0.06
    flat("header", [(-1.1, 0.58), (1.1, 0.58), (1.1, 0.84), (-1.1, 0.84)], body, loc=(0.0, y, 0.0), parent=g)
    tile = [(-0.3, -0.16), (0.3, -0.16), (0.3, 0.16), (-0.3, 0.16)]
    for r, z in enumerate((0.22, -0.23, -0.68)):
        for c, x in enumerate((-0.76, 0.0, 0.76)):
            if (r, c) == (1, 2):
                continue                                   # answered already
            flat("tile.%d.%d" % (r, c), tile, body, loc=(x, y, z), parent=g)


def icon_031(pal, rand):
    """031 Word Doc Merger: three pages fanned out and held together by one
    paper clip, several documents made one."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("merge", rot=(-8.0, 0.0, FACING - 18.0))
    page = dog_eared(1.45, 1.9, 0.38)
    flat("page.2", page, body, loc=(0.42, 0.2, 0.18), rot=(0.0, 9.0, 0.0), parent=g)
    flat("page.1", page, body, loc=(0.2, 0.1, 0.08), rot=(0.0, 3.0, 0.0), parent=g)
    front = flat("page.0", page, body, loc=(0.0, 0.0, 0.0), rot=(0.0, -4.0, 0.0), parent=g)
    wire("text", lines_on(-0.5, 0.42, (0.35, 0.05, -0.25, -0.55), -0.01, short=(3,)), body, parent=front)
    # A paper clip over the top edge, left of the fold: an inner loop inside an
    # outer one, as the wire runs.
    y, x0, top = -0.03, -0.35, 1.12
    clip = [(x0 + 0.1, y, 0.62), (x0 + 0.1, y, top - 0.12)]
    clip += [(x0 + 0.1 * math.cos(math.radians(a)), y, top - 0.12 + 0.1 * math.sin(math.radians(a))) for a in range(0, 181, 30)]
    clip += [(x0 - 0.1, y, 0.5)]
    clip += [(x0 + 0.04 + 0.14 * math.cos(math.radians(a)), y, 0.5 + 0.14 * math.sin(math.radians(a))) for a in range(180, 361, 30)]
    clip += [(x0 + 0.18, y, top + 0.05)]
    wire("clip", [clip], wood, parent=front)


def icon_032(pal, rand):
    """032 School Calendar: a wall calendar page with two binding rings and a
    month grid, one day circled."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("calendar", rot=(0.0, 0.0, FACING - 18.0))
    box("page", (2.1, 0.12, 1.8), body, loc=(0.0, 0.0, 0.9), parent=g)
    y = -0.065
    lines = [[(-1.05, y, 1.36), (1.05, y, 1.36)]]                # the month's header band
    for x in (-0.525, 0.0, 0.525):
        lines.append([(x, y, 0.12), (x, y, 1.36)])
    for z in (0.53, 0.94):
        lines.append([(-0.93, y, z), (0.93, y, z)])
    lines.append(circle(0.26, 0.74, 0.17, y=y))                  # the day that matters
    wire("grid", lines, body, parent=g)
    for i, x in enumerate((-0.55, 0.55)):
        ring = [(x, 0.16 * math.cos(2 * math.pi * k / 16), 1.8 + 0.16 * math.sin(2 * math.pi * k / 16))
                for k in range(16)]
        wire("ring.%d" % i, [ring + [ring[0]]], wood, parent=g)


def icon_033(pal, rand):
    """033 SSR Log Tracker: a closed book standing up, a bookmark out of its
    top, the reader's place. Closed, so it is not 027's open book: covers, a
    page block between them and the page edges showing on the right."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    # Turned square to the camera's azimuth so the page edges show as much as
    # the cover; turned toward the cover, the first cut read as a notepad.
    g = group("book", rot=(0.0, 0.0, FACING - 45.0))
    w, t, h = 1.5, 0.5, 2.1
    for i, y in enumerate((-t / 2, t / 2)):
        box("cover.%d" % i, (w, 0.07, h), wood, loc=(0.0, y, 0.0), parent=g)
    box("spine", (0.07, t + 0.07, h), wood, loc=(-w / 2, 0.0, 0.0), parent=g)
    box("pages", (w - 0.12, t - 0.07, h - 0.14), body, loc=(-0.03, 0.0, 0.0), parent=g)
    flat("mark", [(0.18, 0.7), (0.46, 0.7), (0.46, 1.42), (0.32, 1.3), (0.18, 1.42)], body,
         loc=(0.0, 0.0, 0.0), parent=g)
    y = -t / 2 - 0.04
    x = w / 2 - 0.08
    wire("title", [[(-0.45, y, 0.55), (0.45, y, 0.55)], [(-0.3, y, 0.3), (0.3, y, 0.3)],
                   [(x, -0.08, -0.9), (x, -0.08, 0.9)], [(x, 0.08, -0.9), (x, 0.08, 0.9)]], body, parent=g)


def icon_034(pal, rand):
    """034 Schedule Browser: a wall clock, the bell schedule's own face,
    reading ten past ten."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("clock", rot=(0.0, 0.0, FACING - 22.0))
    prism("case", disk(1.15, 40), 0.24, wood, parent=g)
    y = -0.125
    lines = [circle(0.0, 0.0, 0.98, y=y, segments=32)]
    for i in range(12):
        a = math.radians(90.0 - 30.0 * i)
        r0 = 0.72 if i % 3 == 0 else 0.82
        lines.append([(r0 * math.cos(a), y, r0 * math.sin(a)), (0.9 * math.cos(a), y, 0.9 * math.sin(a))])
    for ang, ln in ((150.0, 0.45), (30.0, 0.68)):               # hour at ten, minute at two
        a = math.radians(ang)
        lines.append([(0.0, y, 0.0), (ln * math.cos(a), y, ln * math.sin(a))])
    wire("face", lines, body, parent=g)


def icon_035(pal, rand):
    """035 School Layout Visualizer: a floor plan, a hallway through the
    middle and rooms on both sides, with a map pin standing on one room."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("plan", rot=(-55.0, 0.0, FACING - 15.0))
    flat("sheet", [(-1.25, -0.95), (1.25, -0.95), (1.25, 0.95), (-1.25, 0.95)], body, parent=g)
    y = -0.01
    lines = [rect(-1.05, -0.75, 1.05, 0.75, y=y),
             [(-1.05, y, 0.15), (1.05, y, 0.15)], [(-1.05, y, -0.15), (1.05, y, -0.15)]]
    lines += [[(x, y, 0.15), (x, y, 0.75)] for x in (-0.35, 0.35)]
    lines += [[(x, y, -0.15), (x, y, -0.75)] for x in (-0.5, 0.2)]
    wire("rooms", lines, body, parent=g)
    bpy.context.view_layer.update()
    tip = g.matrix_world @ Vector((0.7, 0.0, 0.45))              # the room top right
    pin = group("pin", loc=tuple(tip))
    cylinder("point", 0.0, 0.6, wood, loc=(0.0, 0.0, 0.3), r2=0.2, segments=16, caps=False, parent=pin)
    sphere("head", 0.3, wood, loc=(0.0, 0.0, 0.78), parent=pin)


def icon_036(pal, rand):
    """036 Final Grade Checker: a calculator, a display over a keypad. The
    grade is a calculation, and the tool's job is checking it."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("calculator", rot=(-15.0, 0.0, FACING - 18.0))
    prism("case", rounded(1.5, 2.1, 0.16), 0.22, wood, parent=g)
    y = -0.115
    lines = [rect(-0.55, 0.45, 0.55, 0.85, y=y)]
    for r, z in enumerate((0.12, -0.3, -0.72)):
        for c, x in enumerate((-0.4, 0.0, 0.4)):
            lines.append(rect(x - 0.13, z - 0.13, x + 0.13, z + 0.13, y=y))
    wire("keys", lines, body, parent=g)


def icon_037(pal, rand):
    """037 Grade Distribution Visualizer: a histogram, five bars in a bell,
    on an axis."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("histogram", rot=(0.0, 0.0, FACING - 20.0))
    for i, hgt in enumerate((0.45, 1.05, 1.75, 1.3, 0.6)):
        x = -0.92 + i * 0.46
        box("bar.%d" % i, (0.4, 0.3, hgt), body, loc=(x, 0.0, hgt / 2), parent=g)
    wire("axis", [[(-1.3, -0.2, 2.0), (-1.3, -0.2, -0.05), (1.3, -0.2, -0.05)]], wood, parent=g)


def icon_038(pal, rand):
    """038 Data Table to Chart Builder: a pie chart standing up, one slice
    pulled out. 037 already has the bars."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("pie", rot=(-18.0, 0.0, FACING - 25.0))
    r = 1.0
    rest = [(0.0, 0.0)] + [(r * math.cos(math.radians(a)), r * math.sin(math.radians(a)))
                          for a in range(70, 361, 10)]
    prism("pie", rest, 0.28, body, parent=g)
    wire("cut", [[(0.0, -0.15, 0.0), (r * math.cos(math.radians(200)), -0.15, r * math.sin(math.radians(200)))]],
         body, parent=g)
    d = 0.24
    ox, oz = d * math.cos(math.radians(35)), d * math.sin(math.radians(35))
    wedge = [(ox, oz)] + [(ox + r * math.cos(math.radians(a)), oz + r * math.sin(math.radians(a)))
                          for a in range(0, 71, 10)]
    prism("slice", wedge, 0.28, wood, loc=(0.0, -0.06, 0.0), parent=g)


def icon_039(pal, rand):
    """039 Vocab & Conjugation Drill: a globe on its stand, for the world
    languages it drills. Three latitude rings and one meridian sit just proud
    of the sphere, so the far halves are hidden by it. The first cut tilted
    the axis 23 degrees like a real globe; that laid the equator nearly
    edge-on to the 30-degree camera, the lines vanished, and it read as a
    round mirror on a stand. Upright, the rings are open ellipses."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    r, cz = 0.9, 1.35
    globe = group("globe", rot=(0.0, 0.0, FACING), loc=(0.0, 0.0, cz))
    sphere("earth", r, body, parent=globe)
    k = r * 1.03
    rings = [_ring_xy(0.0, 0.0, k * math.sin(math.radians(lat)), k * math.cos(math.radians(lat)), segments=24)
             for lat in (-35.0, 0.0, 35.0)]
    phi = math.radians(55.0)          # a meridian turned away from face-on, so it is an ellipse
    rings.append([(k * math.cos(t) * math.cos(phi), k * math.cos(t) * math.sin(phi), k * math.sin(t))
                  for t in (2 * math.pi * i / 24 for i in range(25))])
    wire("lines", rings, body, parent=globe)
    tube_arc("arc", r + 0.14, 0.05, 120.0, 270.0, wood, parent=globe)
    cylinder("stem", 0.07, cz - r - 0.14 - 0.12, wood, loc=(0.0, 0.0, 0.12 + (cz - r - 0.26) / 2), segments=12)
    cylinder("base", 0.62, 0.12, wood, loc=(0.0, 0.0, 0.06), segments=32)


def icon_040(pal, rand):
    """040 Vocabulary Flashcard & Word Wall: vocabulary cards on a ring, the
    front one showing a capital A beside its definition lines. 026's fanned
    cards are maths; the letter and the ring make these words. A first cut,
    four cards pinned to a board, was a cluttered grid at 24 px."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("cards", rot=(-10.0, 0.0, FACING - 18.0))
    card = [(-0.95, -0.6), (0.95, -0.6), (0.95, 0.6), (-0.95, 0.6)]
    flat("card.1", card, body, loc=(0.3, 0.12, 0.28), rot=(0.0, 7.0, 0.0), parent=g)
    front = flat("card.0", card, body, parent=g)
    y = -0.01
    wire("word", [[(-0.7, y, -0.35), (-0.42, y, 0.35), (-0.14, y, -0.35)], [(-0.59, y, -0.08), (-0.25, y, -0.08)],
                  [(0.1, y, 0.12), (0.72, y, 0.12)], [(0.1, y, -0.18), (0.5, y, -0.18)],
                  circle(-0.78, 0.44, 0.08, y=y, segments=10)], body, parent=front)
    tube_arc("ring", 0.24, 0.035, -60.0, 240.0, wood, minor=8, loc=(-0.78, 0.06, 0.44),
             rot=(0.0, 0.0, 90.0), parent=g)


def icon_041(pal, rand):
    """041 Formula Reference Sheet Builder: a sheet with a square root over
    an x and a right triangle below it."""
    body = art.token_material(pal, "--card")
    g = group("formulas", rot=(-22.0, 0.0, FACING - 15.0))
    flat("sheet", dog_eared(1.7, 2.2, 0.4), body, parent=g)
    y = -0.01
    lines = [[(-0.62, y, 0.5), (-0.5, y, 0.56), (-0.34, y, 0.2), (-0.16, y, 0.8), (0.55, y, 0.8)]]    # the radical
    lines += [[(0.0, y, 0.62), (0.34, y, 0.3)], [(0.0, y, 0.3), (0.34, y, 0.62)]]                      # x
    lines.append([(-0.55, y, -0.8), (0.55, y, -0.8), (-0.55, y, -0.1), (-0.55, y, -0.8)])              # triangle
    lines.append([(-0.55, y, -0.62), (-0.37, y, -0.62), (-0.37, y, -0.8)])                            # its right angle
    wire("math", lines, body, parent=g)


def icon_042(pal, rand):
    """042 Certificate & Award Maker: an award rosette, a pleated disc with
    a round centre and two ribbon tails. 008 is the star; this is the prize."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("rosette", rot=(0.0, 0.0, FACING - 22.0))
    pleats = [((1.0 if i % 2 == 0 else 0.86) * math.cos(math.pi * i / 14),
               (1.0 if i % 2 == 0 else 0.86) * math.sin(math.pi * i / 14)) for i in range(28)]
    prism("pleats", pleats, 0.12, wood, loc=(0.0, 0.0, 0.45), parent=g)
    prism("centre", disk(0.55, 28), 0.1, body, loc=(0.0, -0.1, 0.45), parent=g)
    for i, s in enumerate((-1.0, 1.0)):
        flat("tail.%d" % i, [(-0.22, 0.0), (0.22, 0.0), (0.22, -1.25), (0.0, -1.05), (-0.22, -1.25)], wood,
             loc=(s * 0.3, 0.1, 0.0), rot=(0.0, -s * 16.0, 0.0), parent=g)


def icon_043(pal, rand):
    """043 Field Trip Permission Slip: a school bus, side on, the trip
    itself. A long body with a row of windows, a hood, two wheels."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("bus", rot=(0.0, 0.0, FACING - 30.0))
    box("body", (2.5, 1.0, 1.15), body, loc=(-0.2, 0.0, 0.8), parent=g)
    box("hood", (0.5, 0.9, 0.6), body, loc=(1.3, 0.0, 0.53), parent=g)
    y = -0.505
    lines = [rect(x, 0.9, x + 0.36, 1.2, y=y) for x in (-1.3, -0.84, -0.38, 0.08)]
    lines.append(rect(0.62, 0.34, 0.9, 1.2, y=y))                   # the door
    lines.append([(-1.45, y, 0.7), (0.5, y, 0.7)])                  # the stripe
    wire("side", lines, body, parent=g)
    for i, x in enumerate((-0.95, 0.85)):
        cylinder("wheel.%d" % i, 0.28, 0.16, wood, loc=(x, -0.46, 0.25), rot=(90.0, 0.0, 0.0), segments=20, parent=g)


def icon_044(pal, rand):
    """044 Sub Plan Builder: a tabbed folder, open a little, with a page of
    plans standing up out of it."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("folder", rot=(0.0, 0.0, FACING - 20.0))
    flat("back", [(-1.0, 0.0), (1.0, 0.0), (1.0, 1.75), (0.05, 1.75), (-0.12, 1.98), (-1.0, 1.98)],
         wood, loc=(0.0, 0.12, 0.0), parent=g)
    flat("page", [(-0.82, 0.12), (0.8, 0.12), (0.8, 2.2), (-0.82, 2.2)], body, loc=(0.0, 0.04, 0.0), parent=g)
    wire("plan", [[(-0.6, 0.03, z), (0.58 - 0.3 * (i == 2), 0.03, z)] for i, z in enumerate((1.95, 1.72, 1.49))],
         body, parent=g)
    flat("front", [(-1.0, 0.0), (1.0, 0.0), (1.0, 1.5), (-1.0, 1.5)], wood,
         loc=(0.0, -0.02, 0.0), rot=(18.0, 0.0, 0.0), parent=g)


def icon_045(pal, rand):
    """045 Sub Binder / Day Bundle: a ring binder standing closed, divider
    tabs sticking out of its open edge, a label on the cover. The tabs are
    what separate it from 044's folder and 033's book."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    # Square to the camera's azimuth so the open edge and its tabs show; turned
    # toward the cover, the tabs were hidden and it read as a tablet.
    g = group("binder", rot=(0.0, 0.0, FACING - 45.0))
    w, t, h = 1.6, 0.6, 2.1
    for i, y in enumerate((-t / 2, t / 2)):
        box("cover.%d" % i, (w, 0.07, h), wood, loc=(0.0, y, 0.0), parent=g)
    box("spine", (0.07, t + 0.07, h), wood, loc=(-w / 2, 0.0, 0.0), parent=g)
    box("pages", (w - 0.2, t - 0.12, h - 0.2), body, loc=(-0.06, 0.0, 0.0), parent=g)
    for i, (z, y) in enumerate(((0.62, -0.14), (0.05, 0.0), (-0.52, 0.14))):
        box("tab.%d" % i, (0.34, 0.03, 0.34), body, loc=(w / 2 + 0.08, y, z), parent=g)
    wire("label", [rect(-0.45, 0.25, 0.35, 0.72, y=-t / 2 - 0.04)], body, parent=g)


def icon_046(pal, rand):
    """046 Blank Map Generator: a folded paper map in four panels, a route
    wandering across it to a circled stop."""
    body = art.token_material(pal, "--card")
    g = group("map", rot=(-12.0, 0.0, FACING - 12.0))
    xs, dy, h = (-1.2, -0.4, 0.4, 1.2), 0.34, 1.7
    ys = [0.0 if i % 2 == 0 else -dy for i in range(4)]
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, 0.0)) for x, y in zip(xs, ys)]
    hi = [bm.verts.new((x, y, h)) for x, y in zip(xs, ys)]
    for i in range(3):
        bm.faces.new((lo[i], lo[i + 1], hi[i + 1], hi[i]))
    bm.normal_update()
    _mesh_object("map", bm, body, parent=g)

    def on(x, z):
        """A point on the folded surface, just in front of it."""
        for i in range(3):
            if xs[i] <= x <= xs[i + 1]:
                f = (x - xs[i]) / (xs[i + 1] - xs[i])
                return (x, ys[i] + (ys[i + 1] - ys[i]) * f - 0.02, z)
        return (x, -0.02, z)
    route = [on(-1.0 + 0.2 * i, 0.4 + 0.28 * math.sin(i * 1.1)) for i in range(10)]
    stop = [on(0.95 + 0.15 * math.cos(2 * math.pi * i / 12), 1.2 + 0.15 * math.sin(2 * math.pi * i / 12))
            for i in range(12)]
    wire("route", [route + [on(0.85, 1.08)], stop + [stop[0]]], body, parent=g)


def icon_047(pal, rand):
    """047 Art Critique Worksheet Generator: a painter's palette with its
    thumb hole and dabs of paint, a brush laid across it."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("palette", rot=(-35.0, 0.0, FACING - 15.0))
    # An oval with a bite out of its lower right, where the brushes rest.
    pts = []
    for i in range(32):
        a = 2 * math.pi * i / 32
        k = 0.72 if 290.0 <= math.degrees(a) <= 335.0 else 1.0
        pts.append((1.25 * k * math.cos(a), 0.95 * k * math.sin(a)))
    prism("board", pts, 0.08, body, parent=g)
    y = -0.045
    dabs = [circle(cx, cz, 0.15, y=y, segments=10) for cx, cz in ((-0.7, 0.3), (-0.25, 0.6), (0.3, 0.62), (0.75, 0.3))]
    wire("paint", dabs + [circle(-0.55, -0.35, 0.18, y=y, segments=12)], body, parent=g)
    b = group("brush", rot=(0.0, -30.0, 0.0), loc=(0.35, -0.2, -0.35))
    b.parent = g
    cylinder("handle", 0.07, 1.6, wood, loc=(0.0, 0.0, -0.5), rot=(0.0, 90.0, 0.0), r2=0.04, segments=10, parent=b)
    cylinder("tip", 0.09, 0.4, wood, loc=(0.0, 0.0, 0.0), rot=(0.0, 90.0, 0.0), r2=0.0, segments=10, parent=b)


def icon_048(pal, rand):
    """048 Art Portfolio Label & QR Tag: a hanging tag on a loop of string,
    a QR code's finder squares on it and a name line."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("tag", rot=(0.0, 0.0, FACING - 20.0))
    # Hanging askew. Hung straight, the tag and its loop read as a shopping bag.
    tag = prism("tag", [(-0.8, -1.0), (0.8, -1.0), (0.8, 0.7), (0.35, 1.15), (-0.35, 1.15), (-0.8, 0.7)], 0.06,
                body, rot=(0.0, -22.0, 0.0), parent=g)
    y = -0.035
    lines = [circle(0.0, 0.85, 0.12, y=y, segments=12)]
    for cx, cz in ((-0.38, 0.2), (0.38, 0.2), (-0.38, -0.44)):
        lines.append(rect(cx - 0.22, cz - 0.22, cx + 0.22, cz + 0.22, y=y))
    lines.append([(0.18, y, -0.3), (0.58, y, -0.3)])
    lines.append([(0.18, y, -0.56), (0.48, y, -0.56)])
    wire("print", lines, body, parent=tag)
    # The string is a loop up out of the hole, as a tag hangs.
    loop = [(0.2 * math.cos(math.radians(a)) + 0.12 * (1 + math.sin(math.radians(a))), y - 0.02,
             1.2 + 0.35 * math.sin(math.radians(a))) for a in range(-90, 271, 30)]
    wire("string", [loop], wood, parent=tag)


def dome(name, r, mat, loc=(0.0, 0.0, 0.0), rot=(0.0, 0.0, 0.0), parent=None):
    """The top half of a sphere, open underneath, so its rim is a boundary
    and draws whole."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=r)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context="VERTS")
    return _place(_mesh_object(name, bm, mat, parent), loc, rot)


def icon_049(pal, rand):
    """049 Book Tasting Menu: a serving cloche lifted off a plate, a book
    under it. The dish is the book."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("tasting", rot=(0.0, 0.0, FACING - 20.0))
    cylinder("plate", 1.4, 0.08, wood, loc=(0.0, 0.0, 0.04), r2=1.25, segments=40, parent=g)
    box("book", (1.1, 0.75, 0.24), body, loc=(0.0, 0.05, 0.2), rot=(0.0, 0.0, -12.0), parent=g)
    hinge = group("hinge", rot=(-38.0, 0.0, 0.0), loc=(0.0, 1.05, 0.1))
    hinge.parent = g
    dome("cloche", 1.05, body, loc=(0.0, -1.05, 0.0), parent=hinge)
    sphere("knob", 0.14, wood, loc=(0.0, -1.05, 1.15), parent=hinge)


def icon_050(pal, rand):
    """050 Civics Simulation: a ballot box, a marked ballot going into its
    slot. The simulation ends in a vote."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("ballot", rot=(0.0, 0.0, FACING - 25.0))
    w, d, h = 1.7, 1.2, 1.35
    box("box", (w, d, h), wood, loc=(0.0, 0.0, h / 2), parent=g)
    wire("slot", [[(-0.5, -0.07, h + 0.005), (0.5, -0.07, h + 0.005), (0.5, 0.07, h + 0.005),
                   (-0.5, 0.07, h + 0.005), (-0.5, -0.07, h + 0.005)]], wood, parent=g)
    paper = flat("paper", [(-0.4, 0.0), (0.4, 0.0), (0.4, 0.95), (-0.4, 0.95)], body,
                 loc=(0.0, 0.0, h - 0.25), parent=g)
    y = -0.01
    wire("mark", [rect(-0.25, 0.45, 0.0, 0.7, y=y),
                  [(-0.22, y, 0.58), (-0.14, y, 0.49), (0.02, y, 0.76)],
                  [(0.08, y, 0.58), (0.28, y, 0.58)]], body, parent=paper)
    wire("label", [rect(-0.45, 0.45, 0.45, 0.8, y=-d / 2 - 0.01)], body, parent=g)


def icon_051(pal, rand):
    """051 Classroom Label Maker: a sticker label, one corner peeling up,
    printed with a speaker and a word: the object's name, and how to say it."""
    body = art.token_material(pal, "--card")
    g = group("label", rot=(-10.0, 0.0, FACING - 18.0))
    w, h = 2.3, 1.2
    pts = rounded(w, h, 0.18, segments=3)
    pts = pts[:12] + [(w / 2 - 0.45, -h / 2), (w / 2, -h / 2 + 0.45)]
    flat("sticker", pts, body, parent=g)
    flat("peel", [(w / 2 - 0.45, -h / 2), (w / 2, -h / 2 + 0.45), (w / 2 - 0.45, -h / 2 + 0.45)], body,
         loc=(0.0, -0.03, 0.0), parent=g)
    y = -0.01
    lines = [rect(-0.85, -0.12, -0.72, 0.12, y=y),
             [(-0.72, y, 0.12), (-0.52, y, 0.3), (-0.52, y, -0.3), (-0.72, y, -0.12)]]
    for r in (0.2, 0.36):
        lines.append([(-0.52 + r * math.cos(math.radians(a)), y, r * math.sin(math.radians(a))) for a in range(-45, 46, 15)])
    lines += [[(0.0, y, 0.18), (0.8, y, 0.18)], [(0.0, y, -0.14), (0.5, y, -0.14)]]
    wire("print", lines, body, parent=g)


def icon_052(pal, rand):
    """052 Cognates & False Friends: a Venn diagram, two words' circles
    overlapping, an equals sign in what they share."""
    body = art.token_material(pal, "--card")
    g = group("venn", rot=(-15.0, 0.0, FACING - 15.0))
    y = 0.0
    wire("rings", [circle(-0.5, 0.0, 0.85, y=y, segments=32), circle(0.5, 0.0, 0.85, y=y, segments=32),
                   [(-0.14, y, 0.08), (0.14, y, 0.08)], [(-0.14, y, -0.08), (0.14, y, -0.08)]], body, parent=g)


def icon_053(pal, rand):
    """053 Cultural Trivia Cards: a thick question mark and a flag waving
    on its pole, a question about a country. The first cut flew a square
    flag level with the question mark, and the pair read as the letters
    "?F". The flag now waves, from a taller pole with a ball on top."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("trivia", rot=(0.0, 0.0, FACING - 20.0))
    tube_arc("hook", 0.45, 0.13, -90.0, 180.0, body, loc=(-0.35, 0.0, 1.05), parent=g)
    cylinder("stem", 0.13, 0.4, body, loc=(-0.35, 0.0, 0.4), segments=12, caps=False, parent=g)
    sphere("dot", 0.16, body, loc=(-0.35, 0.0, -0.05), parent=g)
    cylinder("pole", 0.05, 2.6, wood, loc=(0.6, 0.0, 0.9), segments=10, parent=g)
    sphere("finial", 0.1, wood, loc=(0.6, 0.0, 2.25), parent=g)
    top = [(0.05 + 0.95 * i / 8, 0.55 + 0.1 * math.sin(math.pi * 2 * i / 8)) for i in range(9)]
    bot = [(0.05 + 0.95 * i / 8, 0.1 * math.sin(math.pi * 2 * i / 8)) for i in range(8, -1, -1)]
    flat("flag", top + bot, wood, loc=(0.6, 0.0, 1.5), parent=g)


def icon_054(pal, rand):
    """054 Current Events Discussion: a newspaper, a masthead over a photo
    and columns of type, bent a little at its fold. The first cut folded the
    lower half out flat toward the viewer, and it read as an open laptop."""
    body = art.token_material(pal, "--card")
    g = group("paper", rot=(0.0, 0.0, FACING - 18.0))
    w = 1.8
    low = flat("lower", [(-w / 2, -1.2), (w / 2, -1.2), (w / 2, 0.0), (-w / 2, 0.0)], body, rot=(18.0, 0.0, 0.0), parent=g)
    top = flat("upper", [(-w / 2, 0.0), (w / 2, 0.0), (w / 2, 1.3), (-w / 2, 1.3)], body, rot=(-6.0, 0.0, 0.0), parent=g)
    y = -0.01
    lines = [[(-0.7, y, 1.12), (0.7, y, 1.12)], [(-0.7, y, 0.96), (0.7, y, 0.96)],
             rect(-0.7, 0.2, -0.05, 0.75, y=y)]
    lines += lines_on(0.1, 0.7, (0.72, 0.52, 0.32), y, short=(2,))
    wire("type", lines, body, parent=top)
    wire("more", [[(-0.7, y, z), (-0.1, y, z)] for z in (-0.25, -0.5, -0.75)] +
         [[(0.1, y, z), (0.7, y, z)] for z in (-0.25, -0.5)], body, parent=low)


def icon_055(pal, rand):
    """055 Daily Editing Warm-Up: a sentence strip reading "ABC", a big
    check mark over its corner: the spelling checked. Two cuts failed first,
    both as illegible bars at 32 px: a long strip with three word lines and a
    proofreader's caret, then a shorter one whose middle word carried a
    spell checker's wavy underline, which vanished and left a card."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("strip", rot=(-10.0, 0.0, FACING - 15.0))
    prism("strip", rounded(2.4, 1.2, 0.14), 0.05, body, parent=g)
    y = -0.035
    arc = lambda cx, cz, r, a0, a1, n=6: [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), y,
                                           cz + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]
    lines = [[(-0.95, y, -0.3), (-0.72, y, 0.3), (-0.49, y, -0.3)], [(-0.86, y, -0.08), (-0.58, y, -0.08)]]   # A
    lines.append([(-0.3, y, -0.3), (-0.3, y, 0.3)] + arc(-0.12, 0.15, 0.15, 90, -90) +
                 arc(-0.1, -0.15, 0.15, 90, -90) + [(-0.3, y, -0.3)])                                     # B
    lines.append(arc(0.35, 0.0, 0.3, 50, 310, 8))                                                          # C
    wire("letters", lines, body, parent=g)
    wire("check", [[(0.5, -0.06, -0.15), (0.82, -0.06, -0.62), (1.5, -0.06, 0.5)]], wood, parent=g)


def icon_056(pal, rand):
    """056 DBQ / Source Packet: a quill standing in an inkwell, the pen the
    old documents were written with."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("quill", rot=(0.0, 0.0, FACING - 20.0))
    cylinder("well", 0.62, 0.55, wood, loc=(0.0, 0.0, 0.275), r2=0.52, segments=32, parent=g)
    cylinder("neck", 0.28, 0.16, wood, loc=(0.0, 0.0, 0.63), segments=24, caps=False, parent=g)
    f = group("feather", rot=(0.0, 28.0, 0.0), loc=(0.0, 0.0, 0.45))
    f.parent = g
    vane = []
    for i in range(13):
        t = i / 12.0
        vane.append((0.34 * math.sin(math.pi * t) ** 0.8, 0.6 + 1.9 * t))
    for i in range(12, -1, -1):
        t = i / 12.0
        vane.append((-0.2 * math.sin(math.pi * t) ** 0.8, 0.6 + 1.9 * t))
    flat("vane", vane[1:-1], body, parent=f)
    y = -0.01
    barbs = [[(0.0, y, 0.0), (0.0, y, 2.5)]]
    barbs += [[(0.0, y, z), (0.24, y, z + 0.22)] for z in (1.0, 1.5, 2.0)]
    wire("shaft", barbs, body, parent=f)


def icon_057(pal, rand):
    """057 Dichotomous Key: a beetle, seen from above and in front, the
    kind of specimen a classification key sorts."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("beetle", rot=(-60.0, 0.0, FACING - 15.0))
    shell = [(0.7 * math.cos(2 * math.pi * i / 28), 0.95 * math.sin(2 * math.pi * i / 28) - 0.2) for i in range(28)]
    prism("shell", shell, 0.3, body, parent=g)
    prism("head", disk(0.34, 16, cz=1.0), 0.24, wood, parent=g)
    y = -0.16
    lines = [[(0.0, y, 0.72), (0.0, y, -1.1)]]
    for s in (-1, 1):
        for z0, z1 in ((0.35, 0.65), (0.0, -0.05), (-0.35, -0.75)):
            lines.append([(s * 0.66, 0.0, z0), (s * 1.1, 0.0, z1)])
        lines.append([(s * 0.18, 0.0, 1.28), (s * 0.45, 0.0, 1.7)])
    wire("legs", lines, wood, parent=g)


def icon_058(pal, rand):
    """058 Duty Roster: a coach's whistle on a ring, the duty teacher's
    kit for the hallway, the cafeteria and the bus line."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("whistle", rot=(0.0, 0.0, FACING - 30.0))
    cylinder("barrel", 0.62, 0.7, body, rot=(90.0, 0.0, 0.0), segments=32, parent=g)
    box("mouth", (1.3, 0.5, 0.42), body, loc=(-0.85, 0.0, 0.41), parent=g)
    tube_arc("ring", 0.24, 0.05, 0.0, 360.0, wood, minor=8, loc=(0.6, 0.0, 0.7), rot=(0.0, 0.0, 90.0), parent=g)


def icon_059(pal, rand):
    """059 Experiment Design Planner: a light bulb, the hypothesis the plan
    starts from."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("bulb", rot=(0.0, 0.0, FACING))
    r, cz = 0.85, 1.45
    sphere("glass", r, body, loc=(0.0, 0.0, cz), parent=g)
    cylinder("neck", 0.36, 0.45, body, loc=(0.0, 0.0, 0.78), r2=0.55, caps=False, segments=24, parent=g)
    cylinder("base", 0.36, 0.5, wood, loc=(0.0, 0.0, 0.3), segments=24, parent=g)
    wire("thread", [_ring_xy(0.0, 0.0, z, 0.37, segments=20) for z in (0.2, 0.36)], wood, parent=g)
    fil = []
    for x, z in ((-0.25, 1.25), (-0.12, 1.55), (0.0, 1.3), (0.12, 1.55), (0.25, 1.25)):
        fil.append((x, -math.sqrt(max(r * r - x * x - (z - cz) ** 2, 0.0)) - 0.03, z))
    wire("filament", [fil], body, parent=g)


def icon_060(pal, rand):
    """060 Fitness & Skill Tracker: a dumbbell, two plates a side."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("dumbbell", rot=(0.0, 12.0, FACING - 30.0))
    cylinder("bar", 0.1, 2.6, wood, rot=(0.0, 90.0, 0.0), segments=12, parent=g)
    for i, s in enumerate((-1.0, 1.0)):
        cylinder("plate.a%d" % i, 0.62, 0.2, body, loc=(s * 0.72, 0.0, 0.0), rot=(0.0, 90.0, 0.0), segments=28, parent=g)
        cylinder("plate.b%d" % i, 0.48, 0.18, body, loc=(s * 0.93, 0.0, 0.0), rot=(0.0, 90.0, 0.0), segments=28, parent=g)


def icon_061(pal, rand):
    """061 Fraction, Decimal, Percent Drill: a percent sign on a round
    badge. The first cut built the sign solid, two tori and a bar; each torus
    drew an inner and an outer circle, so the rings read as "@" and the bar's
    capped end as a hockey stick. Drawn as single strokes on a disc it is a
    percent sign."""
    body = art.token_material(pal, "--card")
    g = group("percent", rot=(0.0, 0.0, FACING - 22.0))
    prism("badge", disk(1.1, 40), 0.2, body, parent=g)
    y = -0.105
    wire("sign", [circle(-0.36, 0.38, 0.2, y=y, segments=14), circle(0.36, -0.38, 0.2, y=y, segments=14),
                  [(-0.45, y, -0.62), (0.45, y, 0.62)]], body, parent=g)


def icon_062(pal, rand):
    """062 Geography Bee / Map Skills: a compass lying nearly flat, its
    needle on the N. 039 has the globe and 046 the map; this is the
    map-skills tool. The first cut stood it up with a bail ring on top, and it
    read as a stopwatch, which is 004's job."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("compass", rot=(-58.0, 0.0, FACING - 15.0))
    prism("case", disk(1.0, 40), 0.24, wood, parent=g)
    y = -0.125
    lines = [circle(0.0, 0.0, 0.84, y=y, segments=32)]
    for a in (0, 180, 270):
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        lines.append([(0.66 * c, y, 0.66 * s), (0.84 * c, y, 0.84 * s)])
    lines.append([(0.0, y, 0.5), (0.16, y, 0.0), (0.0, y, -0.62), (-0.16, y, 0.0), (0.0, y, 0.5)])
    lines.append([(-0.16, y, 0.0), (0.16, y, 0.0)])
    lines.append([(-0.1, y, 0.58), (-0.1, y, 0.8), (0.1, y, 0.58), (0.1, y, 0.8)])         # N
    wire("face", lines, body, parent=g)


def _jigsaw(s, knobs):
    """(x, z) points of a jigsaw piece of side s. knobs gives each edge,
    bottom, right, top, left, as +1 (a knob), -1 (a socket) or 0 (flat)."""
    h = s / 2
    corners = [(-h, -h), (h, -h), (h, h), (-h, h)]
    r = s * 0.16
    pts = []
    for e in range(4):
        (x0, z0), (x1, z1) = corners[e], corners[(e + 1) % 4]
        pts.append((x0, z0))
        k = knobs[e]
        if k == 0:
            continue
        dx, dz = (x1 - x0) / s, (z1 - z0) / s
        nx, nz = dz, -dx                                  # the outward normal
        mx, mz = (x0 + x1) / 2, (z0 + z1) / 2
        cx, cz = mx + nx * k * r * 1.1, mz + nz * k * r * 1.1
        pts.append((mx - dx * r * 0.6, mz - dz * r * 0.6))
        for i in range(9):
            # Round the knob's circle from the edge's start side, over its
            # outermost point, to its end side, overhanging the neck a little.
            t = math.radians(-35.0 + 250.0 * i / 8)
            pts.append((cx + r * (-dx * math.cos(t) + nx * k * math.sin(t)),
                        cz + r * (-dz * math.cos(t) + nz * k * math.sin(t))))
        pts.append((mx + dx * r * 0.6, mz + dz * r * 0.6))
    return pts


def icon_063(pal, rand):
    """063 Grammar Mad Libs: two jigsaw pieces, the second lifting into
    place: the word that fills the blank."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("jigsaw", rot=(-15.0, 0.0, FACING - 18.0))
    prism("piece.0", _jigsaw(1.2, (0, 1, 1, 0)), 0.18, wood, loc=(-0.62, 0.0, 0.0), parent=g)
    prism("piece.1", _jigsaw(1.2, (1, 0, -1, -1)), 0.18, body, loc=(0.75, -0.05, 0.35), rot=(0.0, -12.0, 0.0), parent=g)


def icon_064(pal, rand):
    """064 Historical Figure Trading Cards: a framed portrait, head and
    shoulders."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("portrait", rot=(0.0, 0.0, FACING - 20.0))
    box("frame", (1.75, 0.14, 2.2), wood, parent=g)
    y = -0.075
    lines = [rect(-0.66, -0.88, 0.66, 0.88, y=y), circle(0.0, 0.3, 0.3, y=y, segments=16)]
    lines.append([(-0.5 + 1.0 * i / 12, y, -0.62 + 0.5 * math.sin(math.pi * i / 12)) for i in range(13)])
    lines.append([(-0.5, y, -0.62), (0.5, y, -0.62)])
    wire("sitter", lines, body, parent=g)


def icon_065(pal, rand):
    """065 Lab Report Template: a microscope, arm, stage and a tube tipped
    back to its eyepiece."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("microscope", rot=(0.0, 0.0, FACING - 30.0))
    box("foot", (1.6, 0.9, 0.18), wood, loc=(0.0, 0.0, 0.09), parent=g)
    prism("arm", [(0.35, 0.18), (0.75, 0.18), (0.75, 1.15), (0.2, 1.95), (-0.05, 1.8), (0.4, 1.1)], 0.3, wood, parent=g)
    box("stage", (1.1, 0.8, 0.08), body, loc=(-0.1, 0.0, 0.8), parent=g)
    cylinder("tube", 0.2, 1.25, body, loc=(-0.25, 0.0, 1.62), rot=(0.0, -22.0, 0.0), segments=20, parent=g)
    cylinder("lens", 0.14, 0.25, body, loc=(-0.02, 0.0, 1.0), r2=0.09, rot=(0.0, -22.0, 0.0), segments=16, parent=g)
    cylinder("eyepiece", 0.24, 0.16, body, loc=(-0.49, 0.0, 2.2), rot=(0.0, -22.0, 0.0), segments=20, parent=g)


def icon_066(pal, rand):
    """066 Math Find the Mistake: a warning sign, a triangle with an
    exclamation mark. Something in the working is wrong."""
    body = art.token_material(pal, "--card")
    g = group("warning", rot=(0.0, 0.0, FACING - 20.0))
    tri = []
    for a in (90.0, 210.0, 330.0):
        cx, cz = 0.95 * math.cos(math.radians(a)), 0.95 * math.sin(math.radians(a))
        for k in range(4):
            b = math.radians(a - 60.0 + 40.0 * k)
            tri.append((cx + 0.2 * math.cos(b), cz + 0.2 * math.sin(b)))
    prism("sign", tri, 0.2, body, parent=g)
    y = -0.105
    wire("mark", [[(0.0, y, 0.55), (0.0, y, -0.12)], circle(0.0, -0.36, 0.06, y=y, segments=10)], body, parent=g)


def icon_067(pal, rand):
    """067 Music Sight-Reading: two eighth notes joined by a beam."""
    body = art.token_material(pal, "--card")
    g = group("notes", rot=(0.0, 0.0, FACING - 20.0))
    head = [(0.38 * math.cos(2 * math.pi * i / 20), 0.26 * math.sin(2 * math.pi * i / 20)) for i in range(20)]
    for i, (x, z) in enumerate(((-0.75, -0.9), (0.6, -0.55))):
        prism("head.%d" % i, head, 0.16, body, loc=(x, 0.0, z), rot=(0.0, 20.0, 0.0), parent=g)
        top = 1.2 + (x + 0.75) * 0.25
        box("stem.%d" % i, (0.08, 0.08, top - z), body, loc=(x + 0.32, 0.0, (top + z) / 2), parent=g)
    prism("beam", [(-0.47, 1.05), (0.96, 1.4), (0.96, 1.7), (-0.47, 1.35)], 0.16, body, parent=g)


def icon_068(pal, rand):
    """068 Parent/Guardian Contact Log: a desk telephone, the handset on
    its cradle and a dial on the front: the call home the log records."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("phone", rot=(0.0, 0.0, FACING - 20.0))
    prism("body", [(-0.95, 0.0), (0.95, 0.0), (0.7, 0.75), (-0.7, 0.75)], 1.1, wood, parent=g)
    prism("handset", [(-1.05, 0.7), (-0.55, 0.7), (-0.45, 0.92), (0.45, 0.92), (0.55, 0.7), (1.05, 0.7),
                      (0.98, 1.08), (0.72, 1.22), (-0.72, 1.22), (-0.98, 1.08)], 0.4, body,
          loc=(0.0, -0.05, 0.02), parent=g)
    y = -0.56
    wire("dial", [circle(0.0, 0.36, 0.26, y=y, segments=16), circle(0.0, 0.36, 0.08, y=y, segments=8)], body, parent=g)


def icon_069(pal, rand):
    """069 PE Warm-Up Circuit: a running shoe, sole, laces and heel, what
    the class warms up in. The first cut was a jump rope, two handles on a
    hanging loop, and it read as a horseshoe magnet."""
    body = art.token_material(pal, "--card")
    g = group("shoe", rot=(0.0, 0.0, FACING - 20.0))
    prism("shoe", [(-1.35, 0.0), (1.25, 0.0), (1.45, 0.12), (1.5, 0.28), (1.4, 0.42), (0.9, 0.55), (0.35, 0.75),
                   (0.0, 1.05), (-0.2, 1.1), (-0.45, 0.88), (-0.8, 0.9), (-1.15, 1.0), (-1.3, 0.85), (-1.38, 0.4)],
          0.7, body, parent=g)
    y = -0.36
    lines = [[(-1.36, y, 0.22), (1.49, y, 0.22)]]
    for t in (0.25, 0.5, 0.75):
        cx, cz = 0.9 - 0.9 * t, 0.55 + 0.5 * t
        lines.append([(cx + 0.02, y, cz + 0.03), (cx - 0.12, y, cz - 0.22)])
    wire("sole", lines, body, parent=g)


def icon_070(pal, rand):
    """070 Peer Feedback Checklist: two written pages and the arrows
    between them: trade papers with a partner."""
    body = art.token_material(pal, "--card")
    g = group("swap", rot=(-5.0, 0.0, FACING - 15.0))
    for i, s in enumerate((-1.0, 1.0)):
        p = flat("page.%d" % i, dog_eared(0.95, 1.25, 0.25), body, loc=(s * 0.75, 0.0, 0.0), parent=g)
        wire("lines.%d" % i, lines_on(-0.3, 0.3, (0.25, -0.05, -0.35), -0.01, short=(2,)), body, parent=p)
    y = -0.02
    top = [(0.75 * math.cos(math.radians(180.0 - 180.0 * i / 12)), y, 0.72 + 0.4 * math.sin(math.radians(180.0 - 180.0 * i / 12)))
           for i in range(13)]
    bot = [(-p[0], y, -p[2]) for p in top]
    wire("arrows", [top, [(0.6, y, 0.88), (0.75, y, 0.72), (0.9, y, 0.88)],
                    bot, [(-0.6, y, -0.88), (-0.75, y, -0.72), (-0.9, y, -0.88)]], body, parent=g)


def icon_071(pal, rand):
    """071 Picture-Prompt Generator: a camera, where the pictures come
    from."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("camera", rot=(0.0, 0.0, FACING - 25.0))
    box("body", (1.9, 0.75, 1.15), wood, loc=(0.0, 0.0, 0.575), parent=g)
    box("hump", (0.7, 0.55, 0.28), wood, loc=(-0.2, 0.0, 1.29), parent=g)
    cylinder("button", 0.12, 0.12, body, loc=(0.6, 0.0, 1.21), segments=12, parent=g)
    cylinder("lens", 0.44, 0.4, body, loc=(0.05, -0.575, 0.55), rot=(90.0, 0.0, 0.0), segments=32, parent=g)
    wire("glass", [circle(0.05, 0.55, 0.28, y=-0.785, segments=20)], body, parent=g)
    wire("flash", [rect(0.5, 0.8, 0.8, 0.98, y=-0.38)], body, parent=g)


def icon_072(pal, rand):
    """072 Plot Diagram Builder: the plot mountain itself, a long rising
    slope to the climax and a short fall, snow on its peak, standing on a
    level line that runs out both sides: exposition and resolution. The
    first cut was a solid prism, and its thickness read as a wedge of
    cheese."""
    body = art.token_material(pal, "--card")
    g = group("mountain", rot=(0.0, 0.0, FACING - 5.0))
    m = flat("mountain", [(-1.1, 0.0), (1.0, 0.0), (0.35, 1.55)], body, parent=g)
    y = -0.01
    wire("snow", [[(-0.39, y, 0.95), (-0.2, y, 0.82), (0.0, y, 0.95), (0.2, y, 0.8), (0.4, y, 0.92), (0.62, y, 0.9)],
                  [(-1.45, y, 0.0), (1.35, y, 0.0)]], body, parent=m)


def icon_073(pal, rand):
    """073 Science Fair Project Tracker: a trifold display board, a title
    across the middle panel and pages on all three."""
    body = art.token_material(pal, "--card")
    g = group("board", rot=(0.0, 0.0, FACING - 15.0))
    h = 1.5
    c = flat("centre", [(-0.65, 0.0), (0.65, 0.0), (0.65, h), (-0.65, h)], body, parent=g)
    wl = flat("wing.l", [(-0.65, 0.0), (0.0, 0.0), (0.0, h), (-0.65, h)], body, loc=(-0.65, 0.0, 0.0),
              rot=(0.0, 0.0, 40.0), parent=g)
    wr = flat("wing.r", [(0.0, 0.0), (0.65, 0.0), (0.65, h), (0.0, h)], body, loc=(0.65, 0.0, 0.0),
              rot=(0.0, 0.0, -40.0), parent=g)
    y = -0.01
    wire("title", [rect(-0.45, 1.15, 0.45, 1.38, y=y), rect(-0.4, 0.35, 0.4, 0.95, y=y)], body, parent=c)
    wire("left", [rect(-0.52, 0.7, -0.13, 1.2, y=y), rect(-0.52, 0.2, -0.13, 0.55, y=y)], body, parent=wl)
    wire("right", [rect(0.13, 0.7, 0.52, 1.2, y=y), rect(0.13, 0.2, 0.52, 0.55, y=y)], body, parent=wr)


def icon_074(pal, rand):
    """074 Science Safety Label Maker: a hazard diamond with a flame in
    it, the flammable label on a lab cabinet."""
    body = art.token_material(pal, "--card")
    g = group("hazard", rot=(0.0, 0.0, FACING - 20.0))
    c = s = math.sqrt(0.5)
    diamond = [(x * c - z * s, x * s + z * c) for x, z in rounded(1.7, 1.7, 0.18, segments=3)]
    prism("sign", diamond, 0.14, body, parent=g)
    y = -0.08
    flame = [(-0.05, -0.38), (-0.3, -0.3), (-0.38, -0.08), (-0.3, 0.15), (-0.12, 0.35), (-0.1, 0.15), (0.02, 0.25),
             (0.08, 0.5), (0.25, 0.3), (0.33, 0.05), (0.28, -0.2), (0.12, -0.36), (-0.05, -0.38)]
    wire("mark", [[(x, y, z) for x, z in flame], [(-0.4, y, -0.52), (0.4, y, -0.52)],
                  [(0.0, y, 1.0), (1.0, y, 0.0), (0.0, y, -1.0), (-1.0, y, 0.0), (0.0, y, 1.0)]], body, parent=g)


def icon_075(pal, rand):
    """075 Staff Directory Builder: a staff ID badge, a strap through its
    slot, a head and shoulders over a name. The first cut was a rotary card
    file, and with its front cards hiding the rest it read as a toaster.
    (076's first cut, a slip under a push pin, read as this badge, which is
    how the badge was found.)"""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("badge", rot=(-8.0, 0.0, FACING - 18.0))
    prism("card", rounded(1.5, 2.0, 0.16, segments=3), 0.06, body, parent=g)
    y = -0.04
    lines = [rect(-0.25, 0.72, 0.25, 0.8, y=y), circle(0.0, 0.3, 0.2, y=y, segments=14),
             [(-0.4 + 0.8 * i / 10, y, -0.28 + 0.3 * math.sin(math.pi * i / 10)) for i in range(11)],
             [(-0.4, y, -0.28), (0.4, y, -0.28)], [(-0.45, y, -0.6), (0.45, y, -0.6)]]
    wire("print", lines, body, parent=g)
    wire("strap", [[(-0.18, 0.0, 0.76), (-0.18, 0.0, 1.35), (0.18, 0.0, 1.35), (0.18, 0.0, 0.76)]], wood, parent=g)


def icon_076(pal, rand):
    """076 Sub Note / Feedback Slip: a sticky note, handwritten, its
    bottom corner curling up: the note the sub leaves on the desk. The first
    cut, a slip under a push pin, read as an ID badge (the pin was the
    head); 075 took that idea."""
    body = art.token_material(pal, "--card")
    g = group("note", rot=(-8.0, 0.0, FACING - 15.0))
    s, c = 0.9, 0.45
    p = flat("slip", [(-s, -s), (s - c, -s), (s, -s + c), (s, s), (-s, s)], body, rot=(0.0, 6.0, 0.0), parent=g)
    flat("curl", [(s - c, -s), (s, -s + c), (s - c * 0.9, -s + c * 0.9)], body, loc=(0.0, -0.06, 0.0), parent=p)
    y = -0.01
    hand = [[(-0.6 + 1.2 * i / 12 * w, y, z + 0.06 * math.sin(math.pi * i / 2.0)) for i in range(13)]
            for z, w in ((0.45, 1.0), (0.1, 1.0), (-0.25, 0.6))]
    wire("hand", hand, body, parent=p)


def icon_077(pal, rand):
    """077 Testing Accommodations Cards: headphones, for the read-aloud
    accommodation. A judgement call: the card covers extended time and a
    separate setting too, but a clock is 034's and an hourglass 004's. The
    first cut was a bubble answer sheet; twelve bubbles read as an abacus and
    came to 1,868 B, over the cap."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("headphones", rot=(0.0, 0.0, FACING - 10.0))
    tube_arc("band", 0.95, 0.09, 8.0, 172.0, wood, segments=20, loc=(0.0, 0.0, 0.0), parent=g)
    for i, s in enumerate((-1.0, 1.0)):
        prism("cup.%d" % i, rounded(0.62, 0.8, 0.26, segments=3), 0.34, body, loc=(s * 1.0, 0.0, -0.05),
              rot=(0.0, 0.0, 90.0), parent=g)
        prism("pad.%d" % i, rounded(0.5, 0.66, 0.2, segments=3), 0.14, wood, loc=(s * 0.77, 0.0, -0.05),
              rot=(0.0, 0.0, 90.0), parent=g)


def icon_078(pal, rand):
    """078 Unit Conversion Chart: a ruler with a scale on each edge,
    inches along the top and centimetres along the bottom."""
    body = art.token_material(pal, "--card")
    g = group("ruler", rot=(0.0, -30.0, FACING - 20.0))
    prism("ruler", [(-1.3, -0.45), (1.3, -0.45), (1.3, 0.45), (-1.3, 0.45)], 0.1, body, parent=g)
    y = -0.055
    ticks = []
    for i in range(5):
        x = -1.0 + i * 0.5
        ticks.append([(x, y, 0.45), (x, y, 0.1 if i % 2 == 0 else 0.25)])
    for i in range(8):
        x = -1.05 + i * 0.3
        ticks.append([(x, y, -0.45), (x, y, -0.28)])
    wire("ticks", ticks, body, parent=g)


def icon_079(pal, rand):
    """079 Verb Conjugation Poster: a wall banner hung from a rod, a title
    over two columns of endings."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("poster", rot=(0.0, 0.0, FACING - 15.0))
    cylinder("rod", 0.07, 2.1, wood, loc=(0.0, 0.0, 1.4), rot=(0.0, 90.0, 0.0), segments=10, parent=g)
    for i, s in enumerate((-1.0, 1.0)):
        sphere("knob.%d" % i, 0.11, wood, loc=(s * 1.1, 0.0, 1.4), parent=g)
    wire("cord", [[(-0.8, 0.0, 1.45), (0.0, 0.0, 1.95), (0.8, 0.0, 1.45)]], wood, parent=g)
    p = flat("sheet", [(-0.85, 1.35), (-0.85, -0.9), (0.0, -0.6), (0.85, -0.9), (0.85, 1.35)], body, parent=g)
    y = -0.01
    lines = [[(-0.55, y, 1.05), (0.55, y, 1.05)], [(0.0, y, 0.8), (0.0, y, -0.35)]]
    lines += lines_on(-0.6, -0.15, (0.5, 0.0), y) + lines_on(0.15, 0.6, (0.5, 0.0), y)
    wire("text", lines, body, parent=p)


def icon_080(pal, rand):
    """080 Virtual Manipulatives Board: unit cubes, two on the floor and
    one stacked, and a pointer dragging a fourth into place: blocks you move
    on a screen. A pile of four under the dragged one clumped into one
    shape at 32 px. Two cuts failed before that: base-ten blocks (a ten rod lying
    down and three loose units), whose rod read as a harmonica at 32 px,
    and fraction tiles (a whole over two halves over three thirds), which
    read as a brick wall."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("cubes", rot=(0.0, 0.0, FACING - 20.0))
    u, gap = 0.62, 0.05
    for i, (x, z) in enumerate(((-0.67, 0.0), (0.0, 0.0), (-0.67, 0.67))):
        box("cube.%d" % i, (u, u, u), body, loc=(x, 0.0, z + u / 2), parent=g)
    box("cube.3", (u, u, u), body, loc=(0.95, 0.0, 1.25), rot=(0.0, 0.0, 12.0), parent=g)
    arrow = [(0.0, 0.0), (0.0, -0.8), (0.2, -0.6), (0.36, -0.95), (0.5, -0.88), (0.34, -0.55), (0.6, -0.55)]
    prism("pointer", arrow, 0.06, wood, loc=(1.0, -0.5, 1.2), parent=g)


def icon_081(pal, rand):
    """081 Word Problem Warm-Up: a steaming mug with a question mark on
    its side, the warm-up question."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("mug", rot=(0.0, 0.0, FACING - 20.0))
    cup("mug", 0.6, 1.2, 32, wood).parent = g
    tube_arc("handle", 0.35, 0.08, -80.0, 80.0, wood, loc=(0.68, 0.0, 0.6), parent=g)
    steam = []
    for x in (-0.2, 0.2):
        steam.append([(x + 0.1 * math.sin(math.pi * 2 * i / 8), 0.0, 1.4 + 0.08 * i) for i in range(9)])
    y = -0.67
    q = [(0.18 * math.cos(math.radians(a)), y, 0.75 + 0.18 * math.sin(math.radians(a))) for a in range(160, -61, -20)]
    q.append((0.0, y, 0.45))
    wire("marks", steam + [q, circle(0.0, 0.3, 0.03, y=y, segments=6)], body, parent=g)


def _slab_quote(x0):
    """(x, z) points of one slab-serif closing quote mark, left edge at x0."""
    return [(x0, 0.6), (x0 + 0.6, 0.6), (x0 + 0.6, 0.05), (x0 + 0.2, -0.55), (x0 + 0.05, -0.55),
            (x0 + 0.3, 0.0), (x0, 0.0)]


def icon_082(pal, rand):
    """082 Citation Generator: a pair of heavy quotation marks, the words
    someone else wrote."""
    body = art.token_material(pal, "--card")
    g = group("quotes", rot=(0.0, 0.0, FACING - 20.0))
    prism("mark.0", _slab_quote(-0.75), 0.25, body, parent=g)
    prism("mark.1", _slab_quote(0.15), 0.25, body, parent=g)


def icon_083(pal, rand):
    """083 Propaganda Analysis: a megaphone, sound coming out of its
    mouth: persuasion at volume."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("megaphone", rot=(0.0, 0.0, FACING - 20.0))
    cylinder("horn", 0.25, 1.6, body, loc=(0.2, 0.0, 0.0), r2=0.8, rot=(0.0, 90.0, 0.0), caps=False, segments=32, parent=g)
    cylinder("mouthpiece", 0.18, 0.3, wood, loc=(-0.75, 0.0, 0.0), rot=(0.0, 90.0, 0.0), segments=16, parent=g)
    box("grip", (0.2, 0.2, 0.6), wood, loc=(-0.2, 0.0, -0.45), parent=g)
    y = 0.0
    arcs = [[(1.15 + r * math.cos(math.radians(a)), y, r * math.sin(math.radians(a))) for a in range(-40, 41, 10)]
            for r in (0.35, 0.6)]
    wire("sound", arcs, body, parent=g)


def icon_084(pal, rand):
    """084 Socratic Seminar: a Greek column, plinth, fluted shaft and
    capital: Socrates' Athens."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("column", rot=(0.0, 0.0, FACING))
    box("plinth", (1.6, 1.6, 0.2), wood, loc=(0.0, 0.0, 0.1), parent=g)
    cylinder("shaft", 0.62, 1.4, body, loc=(0.0, 0.0, 0.9), r2=0.56, caps=False, segments=32, parent=g)
    cylinder("echinus", 0.58, 0.16, body, loc=(0.0, 0.0, 1.68), r2=0.76, caps=False, segments=32, parent=g)
    box("abacus", (1.6, 1.6, 0.18), wood, loc=(0.0, 0.0, 1.85), parent=g)
    flutes = []
    for a in (-128.0, -90.0, -52.0):
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        flutes.append([(0.63 * c, 0.63 * s, 0.35), (0.57 * c, 0.57 * s, 1.48)])
    wire("flutes", flutes, body, parent=g)


def icon_085(pal, rand):
    """085 Parent Communication Templates: an envelope, its flap open and
    a letter coming out."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("mail", rot=(0.0, 0.0, FACING - 20.0))
    flat("back", [(-1.1, 0.0), (1.1, 0.0), (1.1, 1.3), (0.0, 2.0), (-1.1, 1.3)], wood, loc=(0.0, 0.1, 0.0), parent=g)
    letter = flat("letter", [(-0.9, 0.3), (0.9, 0.3), (0.9, 1.9), (-0.9, 1.9)], body, loc=(0.0, 0.05, 0.0), parent=g)
    wire("text", lines_on(-0.6, 0.6, (1.65, 1.45, 1.25), -0.01, short=(2,)), body, parent=letter)
    flat("front", [(-1.1, 0.0), (1.1, 0.0), (1.1, 1.3), (0.0, 0.7), (-1.1, 1.3)], wood, parent=g)


def icon_086(pal, rand):
    """086 Wiki Race: a chequered flag on its pole, the finish."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("flag", rot=(0.0, 0.0, FACING - 20.0))
    cylinder("pole", 0.06, 2.8, wood, loc=(-1.0, 0.0, 0.9), segments=10, parent=g)
    sphere("finial", 0.1, wood, loc=(-1.0, 0.0, 2.35), parent=g)
    wave = lambda x: 0.12 * math.sin(math.pi * 2 * (x + 0.95) / 1.95)
    xs = [-0.95 + 1.95 * i / 12 for i in range(13)]
    top = [(x, 2.2 + wave(x)) for x in xs]
    bot = [(x, 1.0 + wave(x)) for x in reversed(xs)]
    p = flat("flag", top + bot, body, parent=g)
    y = -0.01
    lines = []
    for k in (1, 2):
        lines.append([(x, y, 1.0 + 0.4 * k + wave(x)) for x in xs])
    for k in (1, 2, 3):
        x = -0.95 + 1.95 * k / 4
        lines.append([(x, y, 1.0 + wave(x)), (x, y, 2.2 + wave(x))])
    wire("checks", lines, body, parent=p)


def icon_087(pal, rand):
    """087 Class Screen: a projector screen on a tripod, widgets on it: a
    clock and two panels."""
    body = art.token_material(pal, "--card")
    wood = art.token_material(pal, "--card-2")
    g = group("screen", rot=(0.0, 0.0, FACING - 20.0))
    cylinder("case", 0.1, 2.3, wood, loc=(0.0, 0.0, 2.3), rot=(0.0, 90.0, 0.0), segments=12, parent=g)
    s = flat("screen", [(-1.05, 0.9), (1.05, 0.9), (1.05, 2.22), (-1.05, 2.22)], body, parent=g)
    y = -0.01
    wire("widgets", [circle(-0.55, 1.56, 0.3, y=y, segments=16), rect(-0.1, 1.72, 0.75, 1.98, y=y),
                     rect(-0.1, 1.12, 0.75, 1.52, y=y)], body, parent=s)
    legs = [[(0.0, 0.08, 0.9), (0.0, 0.08, 0.45)]]
    for a in (90.0, 210.0, 330.0):
        legs.append([(0.0, 0.08, 0.45), (0.6 * math.cos(math.radians(a)), 0.08 + 0.6 * math.sin(math.radians(a)), 0.0)])
    wire("tripod", legs, wood, parent=g)


# --------------------------------------------------------------------------
# The app mark
# --------------------------------------------------------------------------

# index.html's red-pen circle (the .grade path, drawn round every row's grade,
# in a 44-unit box centred on 22,22): four cubic Beziers, a hand-drawn loop
# that overshoots its start. The app mark reuses it rather than a true circle,
# so the installed icon and the landing page draw the same pen stroke.
PEN_LOOP = (((22.0, 5.0), (10.0, 4.0), (4.0, 11.0), (4.5, 21.5)),
            ((4.5, 21.5), (5.0, 33.0), (14.0, 40.0), (23.0, 39.5)),
            ((23.0, 39.5), (34.0, 39.0), (40.5, 31.0), (39.5, 20.5)),
            ((39.5, 20.5), (38.6, 11.0), (31.0, 5.6), (22.5, 5.4)))


def pen_loop(rx, rz, cx=0.0, cz=0.0, y=0.0, steps=10):
    """PEN_LOOP as one open wire, about rx by rz, centred on (cx, cz)."""
    pts = []
    for n, (p0, p1, p2, p3) in enumerate(PEN_LOOP):
        for i in range(0 if n == 0 else 1, steps + 1):
            t = i / steps
            a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2, t ** 3
            x = a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0]
            v = a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]
            pts.append((cx + (x - 22.0) / 17.5 * rx, y, cz - (v - 22.0) / 17.5 * rz))
    return [pts]


def icon_app(pal, rand):
    """The app mark (manifest.json's icons): a graded page. The old mark was
    the landing page's own joke, a blue A circled in red pen, drawn flat; this
    is the same grade on a dog-eared page in the set's three-quarter view, the
    grade in single pen strokes and the loop index.html's .grade path. The
    loop is the one line in the set that is not --ink: its material is --err,
    and the app-mark renderer draws each ink its entry names in that token.

    It is "A+", the landing page's first grade, and not "A": a lone monoline A
    in a hand-drawn red circle is the anarchy sign, which is the first thing
    a seventh grader would say about the first cut. The + makes it a grade."""
    body = art.token_material(pal, "--card")
    pen = art.token_material(pal, "--err")
    g = group("page", rot=(0.0, 0.0, FACING - 20.0))
    flat("page", dog_eared(2.0, 2.4, 0.5), body, parent=g)
    y = -0.02
    # A monoline A (two strokes meeting at the apex, and a crossbar), then the +.
    cx, apex, base, half = -0.18, 0.56, -0.38, 0.33
    at = lambda z: half * (apex - z) / (apex - base)
    zb = 0.0
    plus, arm = (0.45, 0.2), 0.16
    wire("grade", [[(cx - half, y, base), (cx, y, apex), (cx + half, y, base)],
                   [(cx - at(zb), y, zb), (cx + at(zb), y, zb)],
                   [(plus[0] - arm, y, plus[1]), (plus[0] + arm, y, plus[1])],
                   [(plus[0], y, plus[1] - arm), (plus[0], y, plus[1] + arm)]], body, parent=g)
    wire("pen", pen_loop(0.86, 0.74, cx=0.04, cz=0.1, y=y), pen, parent=g)


ICONS = {
    "001": icon_001, "002": icon_002, "003": icon_003, "004": icon_004, "005": icon_005,
    "006": icon_006, "007": icon_007, "008": icon_008, "009": icon_009, "010": icon_010,
    "011": icon_011, "012": icon_012, "013": icon_013, "014": icon_014, "015": icon_015,
    "016": icon_016, "017": icon_017, "018": icon_018, "019": icon_019, "020": icon_020,
    "021": icon_021, "022": icon_022, "023": icon_023, "024": icon_024, "025": icon_025,
    "026": icon_026, "027": icon_027, "028": icon_028, "029": icon_029, "030": icon_030,
    "031": icon_031, "032": icon_032, "033": icon_033, "034": icon_034, "035": icon_035,
    "036": icon_036, "037": icon_037, "038": icon_038, "039": icon_039, "040": icon_040,
    "041": icon_041, "042": icon_042, "043": icon_043, "044": icon_044, "045": icon_045,
    "046": icon_046, "047": icon_047, "048": icon_048,
    "049": icon_049, "050": icon_050, "051": icon_051, "052": icon_052, "053": icon_053,
    "054": icon_054, "055": icon_055, "056": icon_056, "057": icon_057, "058": icon_058,
    "059": icon_059, "060": icon_060, "061": icon_061, "062": icon_062, "063": icon_063,
    "064": icon_064, "065": icon_065, "066": icon_066, "067": icon_067,
    "068": icon_068, "069": icon_069, "070": icon_070, "071": icon_071, "072": icon_072,
    "073": icon_073, "074": icon_074, "075": icon_075, "076": icon_076, "077": icon_077,
    "078": icon_078, "079": icon_079, "080": icon_080, "081": icon_081, "082": icon_082,
    "083": icon_083, "084": icon_084, "085": icon_085, "086": icon_086, "087": icon_087,
    "app": icon_app,
}


# --------------------------------------------------------------------------
# Framing and output
# --------------------------------------------------------------------------

def frame(scene, cam):
    """Centre the drawing and fit its longer side to FILL of the frame. Every
    mesh vertex counts, hidden or not, so a hidden edge can never be cropped
    and the fit does not depend on what the exporter happens to see."""
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    us, vs = [], []
    for obj in scene.objects:
        if obj.type != "MESH":
            continue
        ev = obj.evaluated_get(depsgraph)
        for v in ev.data.vertices:
            q = world_to_camera_view(scene, cam, ev.matrix_world @ v.co)
            us.append(q.x)
            vs.append(q.y)
    scale = cam.data.ortho_scale
    right = cam.matrix_world.to_3x3().col[0].normalized()
    up = cam.matrix_world.to_3x3().col[1].normalized()
    cu, cv = (min(us) + max(us)) / 2, (min(vs) + max(vs)) / 2
    cam.location += right * (cu - 0.5) * scale + up * (cv - 0.5) * scale
    extent = max(max(us) - min(us), max(vs) - min(vs))
    cam.data.ortho_scale = scale * extent / FILL
    bpy.context.view_layer.update()


def emission_material(pal, token):
    """A flat colour: emission at strength 1 under the Standard transform
    renders as the token itself, with no light rig in the way."""
    name = "emit." + token
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    if mat.node_tree is None:
        mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    for n in list(nodes):
        nodes.remove(n)
    out = nodes.new("ShaderNodeOutputMaterial")
    em = nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = art.hex_to_linear(pal[token]) + (1.0,)
    em.inputs["Strength"].default_value = 1.0
    links.new(em.outputs["Emission"], out.inputs["Surface"])
    mat["token"] = token
    return mat


def draw_lines(lines, to_world, r, mat, z=0.0, split=False):
    """Polylines as tubes of radius r in one emission material, with a disc at
    every joint for round caps and joins, as the SVG's stroke-linecap and
    stroke-linejoin are round. A tube pinches where a polyline turns sharply
    (the app mark's A, at 512 px, showed its apex disc as a knob), so split
    draws every segment as its own straight tube; the shortcut PNGs predate it
    and keep the joined tubes, byte for byte."""
    cu = bpy.data.curves.new("lines", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = 2
    cu.use_fill_caps = True
    joints = set()
    for line in lines:
        pts = [to_world(x, y) for x, y in line]
        for run in ([pts[i:i + 2] for i in range(len(pts) - 1)] if split else [pts]):
            sp = cu.splines.new("POLY")
            sp.points.add(len(run) - 1)
            for p, co in zip(sp.points, run):
                p.co = (co[0], co[1], z, 1.0)
        joints.update((round(x, 3), round(y, 3)) for x, y, _ in pts)
    ob = bpy.data.objects.new("lines", cu)
    ob.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new()
    for x, y in sorted(joints):
        ring = [bm.verts.new((x + r * math.cos(2 * math.pi * i / 12), y + r * math.sin(2 * math.pi * i / 12), z))
                for i in range(12)]
        bm.faces.new(ring)
    _mesh_object("joints", bm, mat)


def render_shortcut(entry, out_path, lines, icon_px):
    """Draw the icon's own 48-unit polylines as tubes of --ink on --paper and
    render them top-down: the shortcut PNG is the landing icon, rasterised by
    Blender, so the two cannot drift apart."""
    size = entry["width"]
    scene = art.reset_scene()
    pal = art.palette("light")
    ink = emission_material(pal, "--ink")
    k = icon_px / 48.0
    off = (size - icon_px) / 2.0
    r = STROKE * k / 2.0
    to_world = lambda x, y: (off + x * k - size / 2.0, size / 2.0 - (off + y * k), 0.0)
    draw_lines(lines, to_world, r, ink)
    art.add_camera(scene, "topdown", size, size, ortho_scale=float(size))
    art.set_world(scene, pal, "--paper", strength=1.0)
    art.set_render(scene, entry)
    scene.cycles.use_denoising = False          # flat colour; the denoiser would only soften edges
    tmp = out_path + ".render.png"
    art.render_to(scene, tmp)
    art.write_two_tone_png(tmp, out_path, pal["--paper"], pal["--ink"])
    os.remove(tmp)


# The maskable safe zone: a launcher may crop a maskable icon to any shape that
# contains the centred circle of radius 40% of its width, so nothing may reach
# past it. SAFE leaves a hair inside that line.
SAFE = 0.39


def appmark_scale(entry, layers):
    """Pixels per 48-unit icon unit for an app-mark entry. fit "any" draws the
    icon as the landing page frames it (longer side 80% of the square); fit
    "maskable" shrinks it until every point of every stroke, cap included,
    lies inside the safe circle."""
    size, stroke = entry["width"], entry["stroke"]
    if entry["fit"] == "any":
        return size / 48.0
    reach = max(math.hypot(x - 24.0, y - 24.0) for _, lines in layers for line in lines for x, y in line)
    return SAFE * size / (reach + stroke / 2.0)


def render_appmark(entry, out_path, layers):
    """The app mark: each (token, lines) layer drawn as tubes of that token on
    --paper, later layers on top, rendered top-down and re-written as an
    indexed PNG of exact token blends. Full-bleed paper, no transparency: the
    platform masks it (a maskable icon, iOS's apple-touch-icon) or shows the
    square."""
    size = entry["width"]
    scene = art.reset_scene()
    pal = art.palette("light")
    k = appmark_scale(entry, layers)
    off = size / 2.0 - 24.0 * k
    r = entry["stroke"] * k / 2.0
    to_world = lambda x, y: (off + x * k - size / 2.0, size / 2.0 - (off + y * k), 0.0)
    # Later layers on top: each earlier one a tube's width further from the
    # camera, which the top-down camera sits 20 units above the origin, so
    # nothing may be stacked upward past it (the first cut did, and the pen
    # layer lost its caps to the clip).
    n = len(layers)
    for i, (token, lines) in enumerate(layers):
        draw_lines(lines, to_world, r, emission_material(pal, token), z=-(n - 1 - i) * (2.0 * r + 1.0), split=True)
    art.add_camera(scene, "topdown", size, size, ortho_scale=float(size))
    art.set_world(scene, pal, "--paper", strength=1.0)
    art.set_render(scene, entry)
    scene.cycles.use_denoising = False
    tmp = out_path + ".render.png"
    art.render_to(scene, tmp)
    art.write_tone_png(tmp, out_path, pal["--paper"], [pal[t] for t, _ in layers], levels=entry.get("levels", 8))
    os.remove(tmp)
    print("blender-art: %s strokes are %.2f px wide, %.2f px when shown at 48 px"
          % (entry["path"], 2.0 * r, 2.0 * r * 48.0 / size))


# The exporter simplifies to 0.3 units, a third of a pixel at the landing
# page's 32-48 px. The app mark is drawn at up to 512 px, where that is 3 px
# and the pen loop came out as a visible polygon; 0.03 is a third of a pixel
# there.
APPMARK_TOL = 0.03


def line_layers(scene, cam, inks):
    """The scene's lines split by ink: an object whose material token is one
    of inks draws in it, and everything else in inks[0]. Each pass hides the
    other inks' objects from the exporter only (hide_render); they still
    occlude, because the ray cast reads the viewport depsgraph."""
    meshes = [o for o in scene.objects if o.type == "MESH"]
    ink_of = lambda o: next((m["token"] for m in o.data.materials if m and m.get("token") in inks), inks[0])
    layers = []
    for token in inks:
        for o in meshes:
            o.hide_render = ink_of(o) != token
        layers.append((token, art.icon_polylines(scene, cam, 48, 48, tol=APPMARK_TOL)))
    for o in meshes:
        o.hide_render = False
    return layers


def main():
    a, ledger, entry, version, out_path = art.begin("scene_icons.py")
    subject = entry.get("subject")
    if subject not in ICONS:
        art.fail("no icon function for subject %r" % subject)
    scene = art.reset_scene()
    pal = art.palette("light")
    ICONS[subject](pal, art.rng(entry))
    is_png = entry["path"].lower().endswith(".png")
    w, h = (48, 48) if is_png else (entry["width"], entry["height"])
    cam = art.add_camera(scene, "icon", w, h)
    frame(scene, cam)
    art.add_light_rig(scene)
    art.set_world(scene, pal)
    bpy.context.view_layer.update()
    if entry["family"] == "appmark":
        layers = line_layers(scene, cam, entry["inks"])
        render_appmark(entry, out_path, layers)
        tokens = {"--paper"} | {t for t, lines in layers if lines}
    elif is_png:
        lines = art.icon_polylines(scene, cam, w, h)
        render_shortcut(entry, out_path, lines, entry.get("iconPx", 64))
        tokens = {"--ink", "--paper"}
    else:
        art.export_svg_lines(scene, cam, entry, out_path, stroke_width=entry.get("stroke", STROKE))
        tokens = art.used_tokens()
    if a["no_ledger"]:
        print("blender-art: wrote %s (ledger untouched)" % out_path)
        return
    art.finish_entry(ledger, entry, out_path, version, tokens)


if __name__ == "__main__":
    main()
