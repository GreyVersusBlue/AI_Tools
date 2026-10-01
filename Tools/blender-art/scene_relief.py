"""scene_relief.py - 046 Blank Map Generator's shaded-relief layer.

    blender -b --factory-startup -t 4 -P Tools/blender-art/scene_relief.py -- --entry Tools/blank-map-generator/art/relief-world.webp

One entry per base map it sits under. Today that is the default world map:
plate carree (x linear in longitude, y linear in latitude), north 84, south
-90, west -180, east 180, the exact extent bmg-vector.js draws its "world"
preset to. The entry's "bounds" and "projection" say so, and 046's suite
holds them to the page's preset.

The elevation model is NOT in the repo. The entry's "dem" names it (NOAA's
ETOPO2v2g, public domain) with its URL and SHA-256; download and unzip it
into $ART_DEM_DIR (default ~/.cache/aplp-dem) and this script checks the
hash before it reads a byte. See Tools/blender-art/README.md.

How it is made:

  * The DEM is box-averaged down to one height per output pixel (plus a
    one-pixel border, wrapping in longitude), so the mesh is exactly the
    image grid and nothing aliases.
  * Below sea level is flattened to sea level. The relief is drawn only on
    land (046 clips it to the landmass), and a flat sea costs nothing in the
    WebP.
  * Heights are exaggerated ("exaggeration") because at 20 km a pixel the
    real Himalaya are a fraction of a pixel tall.
  * The surface is --paper, lit by the one rig, straight down. The scene is
    built a tenth of a unit tall so the rig's area lights, twelve units away,
    light the whole world evenly: a unit-sized frame showed a 20% falloff
    from one side of the map to the other.
  * THE LUMINANCE CAP. The material also emits --paper at "floor". A slope
    facing away from every light still shows that much, so the darkest pixel
    in the file cannot fall below it, and the page's label ink and coastline
    strokes hold their contrast everywhere over the relief. The entry's
    underText covers the whole image and records what the file measured.

Light only, use "sheet": 046's viewer is a .paper-sheet whose map keeps its
fixed light colours in both themes.
"""

import hashlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy          # noqa: E402
import numpy as np  # noqa: E402
import art_common as art  # noqa: E402

DEM_DIR = os.environ.get("ART_DEM_DIR") or os.path.join(os.path.expanduser("~"), ".cache", "aplp-dem")

# The scene is SCALE units tall (see the header).
SCALE = 0.1
# ETOPO2v2g: 10801 x 5401 cells at 2 arc-minutes, gridline-registered from
# (-180, -90), stored north row first; the last column repeats the first.
DEM_COLS, DEM_ROWS, DEM_STEP = 10801, 5401, 1.0 / 30.0


def load_dem(entry):
    spec = entry["dem"]
    path = os.path.join(DEM_DIR, spec["file"])
    if not os.path.exists(path):
        art.fail("the DEM is not at %s: download %s and unzip it there (or set ART_DEM_DIR)" % (path, spec["url"]))
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    if h.hexdigest() != spec["sha256"]:
        art.fail("%s has SHA-256 %s, not the ledger's %s" % (path, h.hexdigest(), spec["sha256"]))
    dem = np.fromfile(path, dtype="<i2")
    if dem.size != DEM_COLS * DEM_ROWS:
        art.fail("%s has %d cells, not %d x %d" % (path, dem.size, DEM_COLS, DEM_ROWS))
    # Drop the repeated 180-degree column. Kept as int16 (117 MB): huginn
    # shares its RAM, and a float64 copy of the whole grid was OOM-killed.
    return dem.reshape(DEM_ROWS, DEM_COLS)[:, :DEM_COLS - 1]


def cell_ranges(lo_edges, hi_edges, first_centre, step, n, wrap):
    """Index ranges [a, b) of the DEM cells whose centres fall inside each
    output pixel. With wrap, indices may run past either end (the caller pads)."""
    a = np.ceil((lo_edges - first_centre) / step - 1e-9).astype(np.int64)
    b = np.ceil((hi_edges - first_centre) / step - 1e-9).astype(np.int64)
    if not wrap:
        a, b = np.clip(a, 0, n - 1), np.clip(b, 1, n)
    b = np.maximum(b, a + 1)
    return a, b


def heights(entry):
    """One height (metres) per vertex: the output pixel centres plus a
    one-pixel border, box-averaged from the DEM."""
    w, h = entry["width"], entry["height"]
    b = entry["bounds"]
    dem = load_dem(entry)
    dx = (b["east"] - b["west"]) / w
    dy = (b["north"] - b["south"]) / h
    i = np.arange(-1, w + 1)
    j = np.arange(-1, h + 1)
    lon0, lon1 = b["west"] + i * dx, b["west"] + (i + 1) * dx
    lat_hi, lat_lo = b["north"] - j * dy, b["north"] - (j + 1) * dy
    # Columns: centres at -180 + k/30, wrapping; pad a band either side.
    # Averaged a band of rows at a time; sea (and land below it) to 0 first.
    ca, cb = cell_ranges(lon0, lon1, -180.0, DEM_STEP, dem.shape[1], True)
    pad = int(max(-ca.min(), cb.max() - dem.shape[1], 0)) + 1
    cols = np.empty((dem.shape[0], len(i)))
    for r0 in range(0, dem.shape[0], 256):
        band = np.maximum(dem[r0:r0 + 256], 0).astype(np.float64)
        band = np.concatenate([band[:, -pad:], band, band[:, :pad]], axis=1)
        cs = np.zeros((band.shape[0], band.shape[1] + 1))
        np.cumsum(band, axis=1, out=cs[:, 1:])
        cols[r0:r0 + 256] = (cs[:, cb + pad] - cs[:, ca + pad]) / (cb - ca)
    del dem
    # Rows: north row first, centres at 90 - r/30.
    ra, rb = cell_ranges(90.0 - lat_hi, 90.0 - lat_lo, 0.0, DEM_STEP, cols.shape[0], False)
    rs = np.zeros((cols.shape[0] + 1, cols.shape[1]))
    np.cumsum(cols, axis=0, out=rs[1:])
    return (rs[rb] - rs[ra]) / (rb - ra)[:, None]      # (h + 2, w + 2), row 0 is north


def build_mesh(entry, z_m):
    w, h = entry["width"], entry["height"]
    unit = SCALE / h                                # scene units per pixel
    km_per_px = (entry["bounds"]["north"] - entry["bounds"]["south"]) / h * 111.32
    zs = z_m * (entry["exaggeration"] * unit / (km_per_px * 1000.0))
    ny, nx = zs.shape
    xs = (np.arange(nx) - 1 + 0.5 - w / 2) * unit
    ys = (h / 2 - (np.arange(ny) - 1 + 0.5)) * unit
    gx, gy = np.meshgrid(xs, ys)
    co = np.stack([gx, gy, zs], axis=-1).astype(np.float32).reshape(-1)
    idx = np.arange(nx * ny).reshape(ny, nx)
    # Counter-clockwise seen from above, so normals face the camera.
    quads = np.stack([idx[1:, :-1], idx[1:, 1:], idx[:-1, 1:], idx[:-1, :-1]], axis=-1).reshape(-1)
    nq = (nx - 1) * (ny - 1)
    me = bpy.data.meshes.new("relief")
    me.vertices.add(nx * ny)
    me.vertices.foreach_set("co", co)
    me.loops.add(nq * 4)
    me.loops.foreach_set("vertex_index", quads.astype(np.int32))
    me.polygons.add(nq)
    me.polygons.foreach_set("loop_start", (np.arange(nq) * 4).astype(np.int32))
    me.update(calc_edges=True)
    me.validate()
    me.shade_smooth()
    obj = bpy.data.objects.new("relief", me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def relief_material(pal, floor):
    """--paper, matte, plus an emission of --paper at `floor`: the cap."""
    mat = art.token_material(pal, "--paper", roughness=1.0)
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.0
    bsdf.inputs["Emission Color"].default_value = art.hex_to_linear(pal["--paper"]) + (1.0,)
    bsdf.inputs["Emission Strength"].default_value = float(floor)
    return mat


def main():
    a, ledger, entry, version, out_path = art.begin("scene_relief.py")
    if entry["theme"] != "light" or entry["use"] != "sheet":
        art.fail("046's map is the same in both themes: theme light, use sheet")
    if entry.get("projection") != "equirectangular":
        art.fail("only the plate carree world is drawn here")
    z = heights(entry)
    print("blender-art: heights %d x %d, %.0f-%.0f m" % (z.shape[1], z.shape[0], z.min(), z.max()))
    scene = art.reset_scene()
    pal = art.palette("light")
    obj = build_mesh(entry, z)
    del z
    obj.data.materials.append(relief_material(pal, entry["floor"]))
    w, h = entry["width"], entry["height"]
    art.add_camera(scene, "topdown", w, h, target=(0.0, 0.0, 0.0), ortho_scale=SCALE * w / h)
    art.add_light_rig(scene)
    art.set_world(scene, pal)
    art.set_render(scene, entry)
    art.render_to(scene, out_path)
    u = entry["underText"]
    u["lumMin"], u["lumMax"] = art.luminance_under(out_path, u["region"])
    print("blender-art: under %s luminance %.4f-%.4f" % (u["name"], u["lumMin"], u["lumMax"]))
    if a["no_ledger"]:
        print("blender-art: wrote %s (ledger untouched)" % out_path)
        return
    art.finish_entry(ledger, entry, out_path, version, art.used_tokens())


if __name__ == "__main__":
    main()
