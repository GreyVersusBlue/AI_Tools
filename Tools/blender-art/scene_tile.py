"""scene_tile.py - the test tile: the first raster through the pipeline.

    blender -b --factory-startup -P Tools/blender-art/scene_tile.py -- --entry assets/art/test/tile-256-light.webp
    blender -b --factory-startup -P Tools/blender-art/scene_tile.py -- --entry assets/art/test/tile-256-dark.webp

A 256-px light/dark pair from the top-down family (the camera 080's pieces and
046's relief will use): a card on the page's paper with three blocks casting
the rig's shadow toward the lower right. The top band of the card is a
declared under-text region for --ink, so the luminance measurement and the
validator's 4.5:1 floor are exercised end to end before any real art needs
them. It is not linked from any page.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy          # noqa: E402
import art_common as art  # noqa: E402


def box(name, size, loc, mat, bevel=0.03):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    mod = obj.modifiers.new("bevel", "BEVEL")
    mod.width = bevel
    mod.segments = 3
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def build(pal, rand):
    paper = art.token_material(pal, "--paper", roughness=0.8)
    card = art.token_material(pal, "--card", roughness=0.7)
    accent = art.token_material(pal, "--accent", roughness=0.45)
    accent2 = art.token_material(pal, "--accent-2", roughness=0.45)
    line = art.token_material(pal, "--line-strong", roughness=0.6)
    box("ground", (4.0, 4.0, 0.1), (0.0, 0.0, -0.05), paper, bevel=0.0)
    box("card", (1.7, 1.7, 0.05), (0.0, 0.0, 0.025), card, bevel=0.02)
    # Three blocks on the lower two thirds of the card; the top band stays
    # clear for the declared text region.
    specs = [(accent, 0.34), (accent2, 0.28), (line, 0.22)]
    for i, (mat, s) in enumerate(specs):
        x = -0.48 + i * 0.48 + rand.uniform(-0.04, 0.04)
        y = -0.30 + rand.uniform(-0.06, 0.06)
        box("block.%d" % i, (s, s, s), (x, y, 0.05 + s / 2), mat)


def main():
    a, ledger, entry, version, out_path = art.begin("scene_tile.py")
    theme = entry["theme"]
    if theme not in ("light", "dark"):
        art.fail("a raster tile is rendered per theme, not %r" % theme)
    scene = art.reset_scene()
    pal = art.palette(theme)
    build(pal, art.rng(entry))
    art.add_camera(scene, "topdown", entry["width"], entry["height"])
    art.add_light_rig(scene)
    art.set_world(scene, pal)
    art.set_render(scene, entry)
    art.render_to(scene, out_path)
    extra = None
    under = entry.get("underText")
    if under:
        lo, hi = art.luminance_under(out_path, under["region"])
        under = dict(under, lumMin=lo, lumMax=hi)
        extra = {"underText": under}
    if a["no_ledger"]:
        print("blender-art: wrote %s (ledger untouched)" % out_path)
        return
    art.finish_entry(ledger, entry, out_path, version, art.used_tokens(), extra)


if __name__ == "__main__":
    main()
