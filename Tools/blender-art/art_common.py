"""art_common.py - the Path 21 scene template, shared by every scene script.

Run a scene script, never this file:

    blender -b --factory-startup -P Tools/blender-art/scene_icons.py -- --entry assets/art/icons/t007.svg

What lives here, so that no scene script can drift from it:

  * THE PIN. Blender is pinned to one LTS line, named once in renders.json's
    top-level "blender" field. check_version() exits non-zero if the running
    Blender is not that line, is not an LTS build, or is not a release build.
  * THE PALETTE. Parsed from _shared/ink-paper.css at render time: light from
    the top-level :root block (its var(--x-light) references resolved), dark
    from the top-level :root[data-theme="dark"]:not(.a11y-filter-dark) block.
    The same selector also appears inside @media print and in front of
    #printArea; both are skipped on purpose, because those re-assert the light
    values. There is no second copy of the palette anywhere in this folder.
  * THE CAMERAS, one per art family, fixed and named here.
  * THE LIGHT RIG: one key, one fill, one sun, the same in every family, so the
    whole site reads as lit from the upper left.
  * DETERMINISM: Cycles on CPU, a fixed seed from the ledger, no animated seed,
    fixed samples, OIDN on CPU, and no metadata stamps (the render-time stamp
    is a clock). Procedural placement takes rng(entry), never `random`.
  * THE OUTPUTS: WebP written by Blender itself, and an SVG line exporter for
    icons (see export_svg_lines for why it is not Freestyle).
  * THE LEDGER: renders.json is both the spec of an entry (path, script, seed,
    size, cap, theme, under-text region) and the record of what was made
    (Blender version, SHA-256, bytes, luminance). finish_entry() rewrites the
    record half; the spec half is written by hand.
"""

import bpy
import hashlib
import json
import math
import os
import random
import re
import sys

from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", ".."))
LEDGER = os.path.join(HERE, "renders.json")
CSS = os.path.join(REPO, "_shared", "ink-paper.css")


def fail(msg):
    sys.stderr.write("blender-art: " + msg + "\n")
    sys.stderr.flush()
    # sys.exit inside -P is caught by Blender and does not set the process
    # exit code; os._exit does.
    os._exit(2)


# --------------------------------------------------------------------------
# Arguments and the ledger
# --------------------------------------------------------------------------

def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = {"entry": None, "out": None, "no_ledger": False}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--entry":
            out["entry"] = argv[i + 1]
            i += 2
        elif a == "--out":
            # Write the file somewhere else and leave the ledger alone. This is
            # how the render-twice acceptance test compares two renders.
            out["out"] = argv[i + 1]
            out["no_ledger"] = True
            i += 2
        else:
            fail("unknown argument " + a)
    if not out["entry"]:
        fail("--entry <path from renders.json> is required")
    return out


def read_ledger():
    with open(LEDGER, encoding="utf-8") as fh:
        return json.load(fh)


def write_ledger(ledger):
    text = json.dumps(ledger, indent=2, ensure_ascii=False) + "\n"
    with open(LEDGER, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)


def find_entry(ledger, path):
    for e in ledger["entries"]:
        if e["path"] == path:
            return e
    fail("no renders.json entry for " + path + " (add its spec by hand first)")


def rng(entry):
    """The only source of randomness a scene may use."""
    return random.Random(entry["seed"])


# --------------------------------------------------------------------------
# The pin
# --------------------------------------------------------------------------

def check_version(ledger):
    pinned = ledger["blender"]                      # e.g. "5.2"
    want = tuple(int(x) for x in pinned.split("."))
    have = tuple(bpy.app.version[:2])
    if have != want:
        fail("Blender %s is running; renders.json pins the %s LTS line. "
             "Moving LTS is its own increment: re-render everything and read the hash diffs."
             % (bpy.app.version_string, pinned))
    if "LTS" not in bpy.app.version_string:
        fail("Blender %s is not an LTS build" % bpy.app.version_string)
    if bpy.app.version_cycle != "release":
        fail("Blender %s is a %s build, not a release" % (bpy.app.version_string, bpy.app.version_cycle))
    return "%d.%d.%d" % tuple(bpy.app.version)


# --------------------------------------------------------------------------
# The palette, from _shared/ink-paper.css
# --------------------------------------------------------------------------

def _strip_comments(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def _top_level_blocks(css):
    """(selector, body) for every rule at brace depth 0, so @media bodies are
    one opaque block and their inner rules are never mistaken for top level."""
    out, depth, start, sel_start = [], 0, 0, 0
    for i, ch in enumerate(css):
        if ch == "{":
            if depth == 0:
                sel = css[sel_start:i].strip()
                start = i + 1
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                out.append((sel, css[start:i]))
                sel_start = i + 1
    return out


def _decls(body):
    return dict(re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", body))


def _hex(value, names, seen=()):
    value = value.strip()
    m = re.fullmatch(r"var\((--[\w-]+)\)", value)
    if m:
        name = m.group(1)
        if name in seen or name not in names:
            raise ValueError("unresolvable " + value)
        return _hex(names[name], names, seen + (name,))
    if re.fullmatch(r"#[0-9a-fA-F]{3}", value):
        value = "#" + "".join(c * 2 for c in value[1:])
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
        raise ValueError("not a hex colour: " + value)
    return value.lower()


DARK_SELECTOR = ':root[data-theme="dark"]:not(.a11y-filter-dark)'


def palette(theme):
    """{'--ink': '#1f2430', ...} for 'light' or 'dark'."""
    with open(CSS, encoding="utf-8") as fh:
        blocks = _top_level_blocks(_strip_comments(fh.read()))
    roots = [b for s, b in blocks if s == ":root"]
    darks = [b for s, b in blocks if s == DARK_SELECTOR]
    if len(roots) != 1 or len(darks) != 1:
        fail("ink-paper.css: expected one top-level :root and one top-level %s block, found %d and %d"
             % (DARK_SELECTOR, len(roots), len(darks)))
    light = _decls(roots[0])
    names = dict(light)
    if theme == "dark":
        names.update(_decls(darks[0]))
    tokens = {}
    for name in names:
        if name.endswith("-light"):
            continue
        try:
            tokens[name] = _hex(names[name], names)
        except ValueError:
            pass            # not a colour (none today; color-scheme is not a custom property)
    return tokens


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear(hx):
    return tuple(srgb_to_linear(int(hx[i:i + 2], 16) / 255) for i in (1, 3, 5))


def relative_luminance_srgb(r, g, b):
    """WCAG relative luminance from display-space 0..1 components."""
    lr, lg, lb = (srgb_to_linear(c) for c in (r, g, b))
    return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb


# --------------------------------------------------------------------------
# Scene
# --------------------------------------------------------------------------

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def token_material(pal, token, roughness=0.55):
    """Materials are named for the token they use: mat.--ink, mat.--card."""
    name = "mat." + token
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    if mat.node_tree is None:
        mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = hex_to_linear(pal[token]) + (1.0,)
    bsdf.inputs["Roughness"].default_value = roughness
    mat["token"] = token
    return mat


# One camera per art family. Elevation is degrees above the horizon, azimuth
# is degrees counter-clockwise from -Y (the viewer's side of the scene), so
# 45 looks at the scene from the front right.
CAMERAS = {
    # Icons: orthographic three-quarter, drawn at 48x48.
    "icon":    {"elevation": 30.0,    "azimuth": 45.0, "ortho_scale": 3.4},
    # Hero: true isometric (atan(1/sqrt 2) = 35.264 degrees).
    "iso":     {"elevation": 35.2644, "azimuth": 45.0, "ortho_scale": 10.0},
    # 080's pieces and 046's relief: straight down.
    "topdown": {"elevation": 90.0,    "azimuth": 0.0,  "ortho_scale": 2.0},
}


def add_camera(scene, family, width, height, target=(0.0, 0.0, 0.0), ortho_scale=None):
    spec = CAMERAS[family]
    el, az = math.radians(spec["elevation"]), math.radians(spec["azimuth"])
    dist = 20.0
    direction = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    cam_data = bpy.data.cameras.new("cam." + family)
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ortho_scale or spec["ortho_scale"]
    cam_data.clip_start, cam_data.clip_end = 0.1, 100.0
    cam = bpy.data.objects.new("cam." + family, cam_data)
    scene.collection.objects.link(cam)
    cam.location = Vector(target) + direction * dist
    if spec["elevation"] >= 89.9:
        cam.rotation_euler = (0.0, 0.0, 0.0)      # straight down, +Y up the frame
    else:
        cam.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100
    scene.render.pixel_aspect_x = scene.render.pixel_aspect_y = 1.0
    return cam


# The rig. Azimuth/elevation in the same convention as CAMERAS. Azimuth -110
# is left and a little behind the scene, which is the upper left of the frame
# for both the top-down camera (+Y is up the frame) and the three-quarter and
# isometric cameras (behind the scene is up the frame), so shadows fall to the
# lower right everywhere. The fill is low and opposite. Energies were chosen
# once against the icon and tile scenes and are not tuned per scene.
RIG = {
    "sun":  {"azimuth": -110.0, "elevation": 55.0, "strength": 0.9, "angle": 8.0},
    "key":  {"azimuth": -80.0,  "elevation": 40.0, "energy": 360.0, "size": 6.0, "distance": 12.0},
    "fill": {"azimuth": 100.0,  "elevation": 20.0, "energy": 90.0, "size": 8.0, "distance": 12.0},
}


def _aim(obj, direction):
    obj.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()


def _dir(az_deg, el_deg):
    az, el = math.radians(az_deg), math.radians(el_deg)
    return Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))


def add_light_rig(scene):
    s = RIG["sun"]
    sun = bpy.data.objects.new("rig.sun", bpy.data.lights.new("rig.sun", "SUN"))
    sun.data.energy = s["strength"]
    sun.data.angle = math.radians(s["angle"])
    _aim(sun, _dir(s["azimuth"], s["elevation"]))
    scene.collection.objects.link(sun)
    for name in ("key", "fill"):
        spec = RIG[name]
        light = bpy.data.objects.new("rig." + name, bpy.data.lights.new("rig." + name, "AREA"))
        light.data.energy = spec["energy"]
        light.data.size = spec["size"]
        d = _dir(spec["azimuth"], spec["elevation"])
        light.location = d * spec["distance"]
        _aim(light, d)
        scene.collection.objects.link(light)


def set_world(scene, pal, token="--paper", strength=0.35):
    """One world colour: the page's own paper, dim, so shadows lean toward it."""
    world = bpy.data.worlds.new("world." + token)
    if world.node_tree is None:
        world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = hex_to_linear(pal[token]) + (1.0,)
    bg.inputs["Strength"].default_value = strength
    scene.world = world


def set_render(scene, entry):
    r = scene.render
    r.engine = "CYCLES"
    c = scene.cycles
    c.device = "CPU"
    c.seed = int(entry["seed"])
    c.use_animated_seed = False
    c.samples = int(entry.get("samples", 64))
    c.use_adaptive_sampling = False
    c.use_denoising = True
    c.denoiser = "OPENIMAGEDENOISE"
    if hasattr(c, "denoising_use_gpu"):
        c.denoising_use_gpu = False
    c.max_bounces = 6
    r.use_persistent_data = False
    r.film_transparent = False
    # 'Standard' so a token colour lit flat reads as that colour, rather than
    # AgX's filmic shoulder desaturating the palette.
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    scene.display_settings.display_device = "sRGB"
    # No clock: every metadata stamp off (the render-time and date stamps
    # would put the wall clock into the file).
    r.use_stamp = False
    for attr in dir(r):
        if attr.startswith("use_stamp") and isinstance(getattr(r, attr), bool):
            try:
                setattr(r, attr, False)
            except (AttributeError, TypeError):
                pass
    fmt = r.image_settings
    ext = os.path.splitext(entry["path"])[1].lower()
    if ext == ".webp":
        fmt.file_format = "WEBP"
        fmt.color_mode = "RGB"
        fmt.quality = int(entry.get("quality", 80))
    elif ext == ".png":
        fmt.file_format = "PNG"
        fmt.color_mode = "RGBA" if entry.get("alpha") else "RGB"
        fmt.color_depth = "8"
        fmt.compression = 100
    else:
        fail("no raster format for " + entry["path"])


def render_to(scene, out_path):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)
    if not os.path.exists(out_path):
        fail("Blender did not write " + out_path)


def linear_to_srgb(c):
    return c * 12.92 if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def write_two_tone_png(render_path, out_path, bg_hex, fg_hex, levels=16):
    """Re-write a render of flat fg-on-bg art as an indexed PNG whose palette
    is `levels` exact blends of the two tokens.

    Blender's own PNG writer has no palette mode, and its RGB output of a
    96x96 line icon was 5.5-6.9 KB, over the shortcut cap of 4 KB; grayscale
    fit but changed both token colours. Coverage is recovered per pixel from
    linear luminance, which a linear mix of two colours preserves exactly, so
    the endpoints are the tokens themselves and the edges are the render's
    own antialiasing, quantized to `levels` steps. Pure stdlib (zlib, struct)."""
    import struct
    import zlib
    img = bpy.data.images.load(render_path, check_existing=False)
    w, h = img.size
    ch = img.channels
    px = list(img.pixels)
    bpy.data.images.remove(img)
    bg, fg = hex_to_linear(bg_hex), hex_to_linear(fg_hex)
    lum = lambda c: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    y_bg, y_fg = lum(bg), lum(fg)
    pal = []
    for k in range(levels):
        t = k / (levels - 1)
        pal.extend(int(round(255 * linear_to_srgb(bg[i] + (fg[i] - bg[i]) * t))) for i in range(3))
    bits = 4 if levels <= 16 else 8
    raw = bytearray()
    for y in range(h):
        row = h - 1 - y                       # Blender stores the bottom row first
        idx = []
        for x in range(w):
            i = (row * w + x) * ch
            y_px = lum([srgb_to_linear(px[i + j]) for j in range(3)])
            t = min(1.0, max(0.0, (y_bg - y_px) / (y_bg - y_fg)))
            idx.append(int(round(t * (levels - 1))))
        raw.append(0)                          # filter type 0 (none) per row
        if bits == 4:
            idx += [0] * (len(idx) % 2)
            raw.extend((idx[i] << 4) | idx[i + 1] for i in range(0, len(idx), 2))
        else:
            raw.extend(idx)

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, bits, 3, 0, 0, 0))
           + chunk(b"PLTE", bytes(pal))
           + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
           + chunk(b"IEND", b""))
    with open(out_path, "wb") as fh:
        fh.write(png)


def luminance_under(out_path, region):
    """Min and max WCAG relative luminance inside region [x, y, w, h] (pixels,
    origin top left) of the file as written, lossy encoding included."""
    img = bpy.data.images.load(out_path, check_existing=False)
    w, h = img.size
    px = list(img.pixels)            # byte images: display-space 0..1, bottom row first
    x0, y0, rw, rh = region
    lo, hi = 1.0, 0.0
    for y in range(y0, y0 + rh):
        row = h - 1 - y
        for x in range(x0, x0 + rw):
            i = (row * w + x) * img.channels
            lum = relative_luminance_srgb(px[i], px[i + 1], px[i + 2])
            lo, hi = min(lo, lum), max(hi, lum)
    bpy.data.images.remove(img)
    return round(lo, 4), round(hi, 4)


# --------------------------------------------------------------------------
# SVG icons: a small line exporter instead of Freestyle
# --------------------------------------------------------------------------
#
# Blender 5.2.2 LTS does not bundle the Freestyle SVG Exporter: only the SVG
# *importer* (io_curve_svg) is in addons_core. The exporter is an extension on
# extensions.blender.org and is not installed on the rendering machine. Rather
# than make every icon depend on an unpinned download, this is the fallback
# BACKLOG.md's Path 21 names: project silhouette, crease and boundary edges
# through world_to_camera_view, with hidden-line removal by ray casts toward
# the (orthographic) camera. It needs no render and no add-on, and its output
# is plain arithmetic on the mesh, so it is deterministic by construction.

CREASE_DEGREES = 35.0


def _visible(scene, depsgraph, point, toward_cam, eps):
    hit, loc, *_ = scene.ray_cast(depsgraph, point + toward_cam * eps, toward_cam)
    return not hit


def _segments(scene, cam, width, height):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    toward_cam = (cam.matrix_world.to_quaternion() @ Vector((0.0, 0.0, 1.0))).normalized()
    scale = cam.data.ortho_scale
    eps = scale * 2e-4
    segs = []
    for obj in scene.objects:
        if obj.type != "MESH" or obj.hide_render:
            continue
        ev = obj.evaluated_get(depsgraph)
        mesh = ev.to_mesh()
        mw = ev.matrix_world
        nmat = mw.to_3x3().inverted_safe().transposed()
        verts = [mw @ v.co for v in mesh.vertices]
        normals = [(nmat @ p.normal).normalized() for p in mesh.polygons]
        edge_faces = {}
        for p in mesh.polygons:
            for key in p.edge_keys:
                edge_faces.setdefault(key, []).append(p.index)
        # A loose edge (no face) is a "wire", drawn as it is: the marks an icon
        # needs on a surface (a list's lines, a calendar's grid) without
        # modelling them as faces, whose outlines would double every stroke.
        for e in mesh.edges:
            edge_faces.setdefault(e.key, [])
        for key in sorted(edge_faces):
            faces = edge_faces[key]
            if not faces:
                kind = "wire"
            elif len(faces) == 1:
                kind = "boundary"
            elif len(faces) == 2:
                a, b = (normals[f].dot(toward_cam) > 0 for f in faces)
                if a != b:
                    kind = "silhouette"
                elif a and b and math.degrees(normals[faces[0]].angle(normals[faces[1]], 0.0)) > CREASE_DEGREES:
                    kind = "crease"
                else:
                    continue
            else:
                kind = "boundary"
            p0, p1 = verts[key[0]], verts[key[1]]
            steps = max(2, int((p1 - p0).length / scale * width * 1.5))
            run = []
            for i in range(steps + 1):
                p = p0.lerp(p1, i / steps)
                if _visible(scene, depsgraph, p, toward_cam, eps):
                    q = world_to_camera_view(scene, cam, p)
                    run.append((q.x * width, (1.0 - q.y) * height))
                else:
                    if len(run) > 1:
                        segs.append(run)
                    run = []
            if len(run) > 1:
                segs.append(run)
        ev.to_mesh_clear()
    return segs


def _rdp(points, tol):
    if len(points) < 3:
        return points
    (x0, y0), (x1, y1) = points[0], points[-1]
    dx, dy = x1 - x0, y1 - y0
    norm = math.hypot(dx, dy)
    best, idx = -1.0, 0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        # A closed loop has a zero-length chord; measure from its start point
        # instead, or every point is "on the line" and the loop collapses to a
        # dot. (It did: the first 007 icon lost its one fully visible stick.)
        d = (abs(dy * px - dx * py + x1 * y0 - y1 * x0) / norm) if norm > 1e-9 else math.hypot(px - x0, py - y0)
        if d > best:
            best, idx = d, i
    if best <= tol:
        return [points[0], points[-1]]
    return _rdp(points[:idx + 1], tol)[:-1] + _rdp(points[idx:], tol)


def _chain(segs, snap=0.35):
    """Join segments whose ends meet into polylines, in a deterministic order."""
    key = lambda p: (round(p[0] / snap), round(p[1] / snap))
    segs = [list(s) for s in segs]
    lines = []
    while segs:
        line = segs.pop(0)
        grown = True
        while grown:
            grown = False
            for i, s in enumerate(segs):
                if key(s[0]) == key(line[-1]):
                    line += s[1:]
                elif key(s[-1]) == key(line[-1]):
                    line += list(reversed(s))[1:]
                elif key(s[-1]) == key(line[0]):
                    line = s[:-1] + line
                elif key(s[0]) == key(line[0]):
                    line = list(reversed(s))[:-1] + line
                else:
                    continue
                segs.pop(i)
                grown = True
                break
        lines.append(line)
    return lines


def _fmt(v):
    s = ("%.1f" % v).rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def icon_polylines(scene, cam, width, height, tol=0.3):
    """The scene's visible lines, projected, chained and simplified, in pixel
    coordinates of a width x height frame (origin top left). The SVG writer
    and the shortcut-PNG path both draw from this, so they cannot disagree."""
    return [_rdp(l, tol) for l in _chain(_segments(scene, cam, width, height))]


def _fmt_stroke(v):
    # Two decimals, not _fmt's one: 2.25 through _fmt came out as "2.2", which
    # is 1.47 px at the landing page's 32 px and under Path 21's 1.5 px floor.
    # validate-art.mjs's STROKE rule now catches that.
    return ("%.2f" % v).rstrip("0").rstrip(".")


def export_svg_lines(scene, cam, entry, out_path, stroke_width=2.0, tol=0.3):
    width, height = entry["width"], entry["height"]
    lines = icon_polylines(scene, cam, width, height, tol)
    parts = []
    for line in lines:
        pts = [(_fmt(x), _fmt(y)) for x, y in line]
        dedup = [pts[0]] + [p for i, p in enumerate(pts[1:], 1) if p != pts[i - 1]]
        if len(dedup) < 2:
            continue
        closed = dedup[0] == dedup[-1] and len(dedup) > 2
        body = dedup[:-1] if closed else dedup
        d = "M" + body[0][0] + " " + body[0][1] + "".join("L" + x + " " + y for x, y in body[1:])
        parts.append(d + ("Z" if closed else ""))
    parts.sort()
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" fill="none" '
           'stroke="currentColor" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round">'
           '<path d="%s"/></svg>\n') % (width, height, _fmt_stroke(stroke_width), "".join(parts))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(svg)


# --------------------------------------------------------------------------
# Finishing an entry
# --------------------------------------------------------------------------

def file_record(path):
    with open(path, "rb") as fh:
        data = fh.read()
    if path.lower().endswith(".svg"):
        data = data.replace(b"\r", b"")   # hash text with line endings normalized
    return hashlib.sha256(data).hexdigest(), len(data)


def finish_entry(ledger, entry, out_path, version, tokens, extra=None):
    sha, size = file_record(out_path)
    entry["blender"] = version
    entry["sha256"] = sha
    entry["bytes"] = size
    entry["tokens"] = sorted(tokens)
    if extra:
        entry.update(extra)
    write_ledger(ledger)
    print("blender-art: wrote %s (%d bytes, cap %d, sha256 %s)" % (entry["path"], size, entry["cap"], sha[:12]))
    if size > entry["cap"]:
        fail("%s is %d bytes, over its cap of %d" % (entry["path"], size, entry["cap"]))


def begin(expect_script):
    """Parse args, read the ledger, check the pin, and hand back what a scene
    script needs. expect_script is the calling script's own file name, so an
    entry cannot be rendered by the wrong scene."""
    a = args()
    ledger = read_ledger()
    version = check_version(ledger)
    entry = find_entry(ledger, a["entry"])
    if os.path.basename(entry["script"]) != expect_script:
        fail("%s belongs to %s, not %s" % (entry["path"], entry["script"], expect_script))
    out_path = a["out"] or os.path.join(REPO, *entry["path"].split("/"))
    return a, ledger, entry, version, out_path


def used_tokens():
    return {m["token"] for m in bpy.data.materials if "token" in m}
