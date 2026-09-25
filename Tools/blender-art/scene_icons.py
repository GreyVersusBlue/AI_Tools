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


ICONS = {
    "001": icon_001, "002": icon_002, "003": icon_003, "004": icon_004, "005": icon_005,
    "006": icon_006, "007": icon_007, "008": icon_008, "009": icon_009, "010": icon_010,
    "011": icon_011, "012": icon_012, "013": icon_013, "014": icon_014, "015": icon_015,
    "016": icon_016, "017": icon_017, "018": icon_018, "019": icon_019, "020": icon_020,
    "021": icon_021, "022": icon_022, "023": icon_023, "024": icon_024, "025": icon_025,
    "026": icon_026, "027": icon_027, "032": icon_032, "044": icon_044,
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
    cu = bpy.data.curves.new("lines", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = 2
    cu.use_fill_caps = True
    joints = set()
    for line in lines:
        pts = [to_world(x, y) for x, y in line]
        sp = cu.splines.new("POLY")
        sp.points.add(len(pts) - 1)
        for p, co in zip(sp.points, pts):
            p.co = (co[0], co[1], co[2], 1.0)
        joints.update((round(x, 3), round(y, 3)) for x, y, _ in pts)
    ob = bpy.data.objects.new("lines", cu)
    ob.data.materials.append(ink)
    scene.collection.objects.link(ob)
    # Round caps and joins, as the SVG's stroke-linecap/linejoin are round.
    bm = bmesh.new()
    for x, y in sorted(joints):
        ring = [bm.verts.new((x + r * math.cos(2 * math.pi * i / 12), y + r * math.sin(2 * math.pi * i / 12), 0.0))
                for i in range(12)]
        bm.faces.new(ring)
    _mesh_object("joints", bm, ink)
    art.add_camera(scene, "topdown", size, size, ortho_scale=float(size))
    art.set_world(scene, pal, "--paper", strength=1.0)
    art.set_render(scene, entry)
    scene.cycles.use_denoising = False          # flat colour; the denoiser would only soften edges
    tmp = out_path + ".render.png"
    art.render_to(scene, tmp)
    art.write_two_tone_png(tmp, out_path, pal["--paper"], pal["--ink"])
    os.remove(tmp)


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
    if is_png:
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
