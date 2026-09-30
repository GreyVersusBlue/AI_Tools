"""scene_board.py - 030 Review Game Board's projected board art.

    blender -b --factory-startup -t 4 -P Tools/blender-art/scene_board.py -- --entry Tools/review-game-board/art/cell.webp

Four ledger entries share this script, keyed by "subject":

  backdrop   the board's panel, behind the grid (CSS background, cover)
  header     a category header tile        (CSS border-image, 9-slice)
  cell       a point-value tile            (CSS border-image, 9-slice)
  cell-hover the same tile, lifted, for :hover and keyboard focus

The tiles are 9-slice sources: the page cuts each at the entry's "slice"
(file pixels) and stretches only the flat middle, so a bevel keeps its shape
at any column width. That is why a tile is small and square-cornered in the
file and why its middle is flat: the middle is what the text sits on, and
the text is --gold (030's own colour, not an ink-paper token), measured
against the rendered middle and held to 4.5:1 by check:art.

Quiet on purpose: this is read from the back of a room on a projector. The
board is navy and gold in both themes (030 says so at its :root), so there
is one set, light-only, use "sheet": a surface the page keeps the same in
both themes, like 080's paper board.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy          # noqa: E402
import bmesh        # noqa: E402
from mathutils import Matrix  # noqa: E402
import art_common as art  # noqa: E402


def material(entry, key, rough=0.55, metallic=0.0):
    hex_ = entry["colors"][key].lower()
    if not any(c.get("hex", "").lower() == hex_ and c.get("why") for c in entry.get("extraColors", [])):
        art.fail("%s is not declared in the entry's extraColors" % hex_)
    name = "mat.%s.%s" % (key, hex_)
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if mat.node_tree is None:
        mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = art.hex_to_linear(hex_) + (1.0,)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def slab(name, mat, x0, y0, x1, y1, z0, z1, bevel):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, verts=bm.verts,
                        matrix=Matrix.Translation(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
                        @ Matrix.Diagonal((x1 - x0, y1 - y0, z1 - z0, 1.0)))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 4
        mod.limit_method = "ANGLE"
    return obj


def build(entry):
    """Everything in units of the frame: the render is w x h pixels and the
    frame is w/h units wide by 1 unit tall, centred on the origin."""
    w, h = entry["width"] / entry["height"], 1.0
    sub = entry["subject"]
    if sub == "backdrop":
        # The panel, with a raised inner field one step in from the edge.
        slab("panel", material(entry, "panel"), -w / 2, -h / 2, w / 2, h / 2, -0.05, 0.0, 0.0)
        slab("field", material(entry, "field"), -w / 2 + 0.03, -h / 2 + 0.03, w / 2 - 0.03, h / 2 - 0.03, 0.0, 0.012, 0.01)
    else:
        # A tile filling the frame: bevelled edge inside the slice, flat middle.
        body = material(entry, "tile", rough=0.5)
        slab("tile", body, -w / 2, -h / 2, w / 2, h / 2, 0.0, 0.08, entry["bevel"])
        if sub == "header":
            # A thin gold rim inset from the edge, inside the slice.
            gold = material(entry, "rim", rough=0.3, metallic=0.6)
            i, t = 0.1, 0.018
            for n, (a, b, c, d) in enumerate(((-w / 2 + i, -h / 2 + i, w / 2 - i, -h / 2 + i + t),
                                              (-w / 2 + i, h / 2 - i - t, w / 2 - i, h / 2 - i),
                                              (-w / 2 + i, -h / 2 + i + t, -w / 2 + i + t, h / 2 - i - t),
                                              (w / 2 - i - t, -h / 2 + i + t, w / 2 - i, h / 2 - i - t))):
                slab("rim.%d" % n, gold, a, b, c, d, 0.08, 0.086, 0.0)


def main():
    a, ledger, entry, version, out_path = art.begin("scene_board.py")
    if entry["theme"] != "light" or entry["use"] != "sheet":
        art.fail("030's board is the same in both themes: theme light, use sheet")
    scene = art.reset_scene()
    pal = art.palette("light")
    build(entry)
    w = entry["width"] / entry["height"]
    art.add_camera(scene, "topdown", entry["width"], entry["height"], target=(0.0, 0.0, 0.0), ortho_scale=max(w, 1.0))
    art.add_light_rig(scene)
    art.set_world(scene, pal)
    art.set_render(scene, entry)
    art.render_to(scene, out_path)
    regions = entry.get("underText") or []
    for r in regions if isinstance(regions, list) else [regions]:
        r["lumMin"], r["lumMax"] = art.luminance_under(out_path, r["region"])
        print("blender-art: under %s luminance %.4f-%.4f" % (r.get("name", "text"), r["lumMin"], r["lumMax"]))
    if a["no_ledger"]:
        print("blender-art: wrote %s (ledger untouched)" % out_path)
        return
    art.finish_entry(ledger, entry, out_path, version, art.used_tokens())


if __name__ == "__main__":
    main()
