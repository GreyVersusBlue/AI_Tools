"""scene_seals.py - 042's certificate seals and ribbon tails.

    blender -b --factory-startup -t 4 -P Tools/blender-art/scene_seals.py -- --entry Tools/certificate-award-maker/art/seal-gold.webp

Ten ledger entries share this script, keyed by "subject": six seals
(seal-gold, -silver, -bronze, -red, -blue, -green) and four pairs of ribbon
tails (ribbon-blue, -red, -gold, -green). A certificate shows at most one of
each, the ribbon behind the seal, so any seal goes with any ribbon.

The seal is a foil sticker seen straight down (the top-down camera): a
serrated rim, a raised inner ring and a raised star. No text is baked in,
because award titles change and a seal must serve every certificate. The
ribbon image is drawn on the seal's own grid: its canvas is as wide as the
seal's, and the seal's centre is SEAL_CY down from its top, so the page lays
the two images at the same left and top and the tails come out from under it.

They are printed, so they are light only (use "print"), on a transparent
background (the templates' papers differ), and ink-conscious: small, a light
metallic face rather than a heavy dark plate. Colours are declared extras
(metallic gold, silver, bronze, and a foil green) or tokens (--err, --accent-2).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy          # noqa: E402
import bmesh        # noqa: E402
from mathutils import Matrix  # noqa: E402
import art_common as art  # noqa: E402

SIZE = 2.2          # the seal's canvas, in units: the seal's radius is 1
SEAL_CY = 1.1       # the seal's centre, down from the top of either canvas


def material(entry, pal, key):
    """A foil material: the entry's colour, part metallic, fairly smooth."""
    hex_ = entry["colors"][key]
    if hex_.startswith("--"):
        token, hex_ = hex_, pal[hex_]
    else:
        token = None
        if not any(c.get("hex", "").lower() == hex_.lower() and c.get("why") for c in entry.get("extraColors", [])):
            art.fail("%s is not a token and the entry does not declare it in extraColors" % hex_)
    name = "mat." + (token or hex_.lower()) + "." + key
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    if mat.node_tree is None:
        mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = art.hex_to_linear(hex_) + (1.0,)
    bsdf.inputs["Metallic"].default_value = entry.get("metallic", 0.5)
    bsdf.inputs["Roughness"].default_value = 0.35
    if token:
        mat["token"] = token
    return mat


def _obj(name, bm, mat, bevel=0.0):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = "ANGLE"
    return obj


def extrude(name, mat, rings, z0, z1, bevel=0.0):
    """A polygon (list of (x, y); a second list makes it an annulus with that
    hole) extruded from z0 to z1."""
    bm = bmesh.new()
    outer = [bm.verts.new((x, y, z0)) for x, y in rings[0]]
    if len(rings) == 1:
        face = bm.faces.new(outer)
        geom = [face]
    else:
        inner = [bm.verts.new((x, y, z0)) for x, y in rings[1]]
        n = len(outer)
        geom = [bm.faces.new((outer[i], outer[(i + 1) % n], inner[(i + 1) % n], inner[i])) for i in range(n)]
    ext = bmesh.ops.extrude_face_region(bm, geom=geom, use_keep_orig=True)
    top = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=top, vec=(0, 0, z1 - z0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, mat, bevel)


def circle(r, n, cx=0.0, cy=0.0):
    return [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def star(r_out, r_in, points, turn=90.0):
    out = []
    for i in range(points * 2):
        r = r_out if i % 2 == 0 else r_in
        a = math.radians(turn) + math.pi * i / points
        out.append((r * math.cos(a), r * math.sin(a)))
    return out


def seal(entry, pal):
    face = material(entry, pal, "face")
    extrude("seal.rim", face, [star(1.0, 0.93, 40)], 0.0, 0.06, bevel=0.01)
    extrude("seal.ring", face, [circle(0.8, 96), circle(0.72, 96)], 0.06, 0.1, bevel=0.012)
    extrude("seal.star", face, [star(0.46, 0.2, 5)], 0.06, 0.12, bevel=0.02)
    # A second, inner ring of fine beads: the part of a real foil seal that
    # usually carries the words, here left as texture.
    for i, (x, y) in enumerate(circle(0.62, 36)):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=0.025)
        bmesh.ops.translate(bm, verts=bm.verts, vec=(x, y, 0.07))
        _obj("seal.bead.%d" % i, bm, face)


def ribbon(entry, pal):
    """Two tails from under the seal's centre, down and out, each in two
    panels at a slight tilt so the fold catches the light, with a V-cut end."""
    mat = material(entry, pal, "ribbon")
    for side in (-1, 1):
        a = math.radians(-90 + side * 22)       # pointing down and out
        ux, uy = math.cos(a), math.sin(a)        # along the tail
        px, py = -uy, ux                         # across it
        w, length = 0.2, 2.05
        def pt(t, s):
            return (ux * t + px * s * w, uy * t + py * s * w)
        notch = 0.2
        panels = (
            [pt(0.0, -1), pt(length * 0.55, -1), pt(length * 0.55, 0), pt(0.0, 0)],
            [pt(0.0, 0), pt(length * 0.55, 0), pt(length * 0.55, 1), pt(0.0, 1)],
            [pt(length * 0.55, -1), pt(length, -1), pt(length - notch, 0), pt(length * 0.55, 0)],
            [pt(length * 0.55, 0), pt(length - notch, 0), pt(length, 1), pt(length * 0.55, 1)],
        )
        for i, poly in enumerate(panels):
            o = extrude("ribbon.%d.%d" % (side, i), mat, [poly], 0.0, 0.015)
            # Tilt each half of the tail about its own long axis, opposite ways.
            tilt = math.radians(14 if (i % 2 == 0) == (side > 0) else -14)
            o.matrix_world = Matrix.Rotation(tilt, 4, (ux, uy, 0.0)) @ o.matrix_world


def main():
    a, ledger, entry, version, out_path = art.begin("scene_seals.py")
    if entry["theme"] != "light" or entry["use"] != "print":
        art.fail("042's seals and ribbons are printed: theme light, use print")
    scene = art.reset_scene()
    pal = art.palette("light")
    kind = entry["subject"].split("-")[0]
    if kind == "seal":
        seal(entry, pal)
    elif kind == "ribbon":
        ribbon(entry, pal)
    else:
        art.fail("no subject %r" % entry["subject"])
    h = SIZE * entry["height"] / entry["width"]
    # The seal's centre is the world origin; frame so it sits SEAL_CY below
    # the top of the canvas, whatever the canvas's height.
    art.add_camera(scene, "topdown", entry["width"], entry["height"],
                   target=(0.0, SEAL_CY - h / 2, 0.0), ortho_scale=max(SIZE, h))
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
