"""scene_icons.py - the icon family: one mesh scene per tool, exported as a
currentColor line SVG through art_common.export_svg_lines.

    blender -b --factory-startup -P Tools/blender-art/scene_icons.py -- --entry assets/art/icons/t007.svg

Each icon is a function below, keyed by the entry's "subject" (the tool
number). Icons are built from primitives at a common scale: the icon camera's
ortho_scale (3.4) frames about a 2.6-unit object with room for the stroke.
No colour reaches the file (the SVG is stroke="currentColor"), but the meshes
still get token materials so the same scene renders sensibly if it is ever
opened in the viewport or used for a raster (P2's 96x96 shortcut PNGs).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy          # noqa: E402
import bmesh        # noqa: E402
import art_common as art  # noqa: E402


def _mesh_object(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    obj.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(obj)
    return obj


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
    return (0.14, 0.14, -0.51)       # centre the cup-plus-stick in the frame


ICONS = {"007": icon_007}


def main():
    a, ledger, entry, version, out_path = art.begin("scene_icons.py")
    subject = entry.get("subject")
    if subject not in ICONS:
        art.fail("no icon function for subject %r" % subject)
    scene = art.reset_scene()
    pal = art.palette("light")
    target = ICONS[subject](pal, art.rng(entry))
    cam = art.add_camera(scene, "icon", entry["width"], entry["height"], target=target)
    art.add_light_rig(scene)
    art.set_world(scene, pal)
    bpy.context.view_layer.update()
    art.export_svg_lines(scene, cam, entry, out_path, stroke_width=entry.get("stroke", 2.0))
    if a["no_ledger"]:
        print("blender-art: wrote %s (ledger untouched)" % out_path)
        return
    art.finish_entry(ledger, entry, out_path, version, art.used_tokens())


if __name__ == "__main__":
    main()
