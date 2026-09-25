"""scene_icons.py - the icon family: one mesh scene per tool, exported as a
currentColor line SVG through art_common.export_svg_lines, or rendered as a
96x96 shortcut PNG from the very same lines.

    blender -b --factory-startup -P Tools/blender-art/scene_icons.py -- --entry assets/art/icons/t007.svg
    blender -b --factory-startup -P Tools/blender-art/scene_icons.py -- --entry assets/art/shortcuts/s007.png

Each icon is a function below, keyed by the entry's "subject" (the tool
number). Icons are built from primitives and framed automatically: frame()
centres the projected drawing and scales the orthographic camera so its longer
side fills FILL of the frame, which keeps the set at one optical size however
big each model happens to be.

The style, so the next 76 match the first ten:
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
    "001": icon_001, "002": icon_002, "004": icon_004, "005": icon_005, "006": icon_006,
    "007": icon_007, "008": icon_008, "010": icon_010, "032": icon_032, "044": icon_044,
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
