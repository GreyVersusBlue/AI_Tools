// live-base.test.mjs — bmg-live.js on its own (Path 20 P3, step 1), pure Node, no port.
// parseBaseMapId round-trips every id baseMapId() can make (nine presets x two styles x borders x
// relief x a choroKey); drawExtent answers the preset's own bounds at the fit view and a quarter
// of each span at 4x; loadSource over the vendored files (a recording path stub, fetch reading
// the files from disk) yields one land path with the polar closure and a stroke path without it,
// Fiji's two copies, per-shape fills for a custom preset, and shaded paths only for named
// fills. Then each MUTANT re-imports the module with one deliberate defect and the suite must notice.
//
//   node Tools/blank-map-generator/test/live-base.test.mjs   (npm run test:blank-map-live)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..');
const SRC = fs.readFileSync(path.join(dir, 'bmg-live.js'), 'utf8');

// Node's fetch cannot read file: URLs; the module only needs res.ok and res.json().
globalThis.fetch = async u => {
  const text = fs.readFileSync(new URL(u), 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
};
const V = await import('../bmg-vector.js');

class Rec {
  constructor() { this.ops = []; }
  moveTo(x, y) { this.ops.push(['M', x, y]); }
  lineTo(x, y) { this.ops.push(['L', x, y]); }
  closePath() { this.ops.push(['Z']); }
}
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

async function load(label, file) {
  const url = pathToFileURL(file).href + (label ? '?m=' + label : '');
  return import(url);
}

async function suite(M, label) {
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };

  // ---- parseBaseMapId ----
  let n = 0;
  for (const preset of V.BASE_MAP_PRESETS) for (const style of ['outline', 'land']) for (const borders of [false, true]) for (const relief of [false, true]) for (const choroKey of ['', 'a1b2c3']) {
    const id = V.baseMapId(preset, style, borders, choroKey, relief);
    const p = M.parseBaseMapId(id);
    n++;
    const withRelief = relief && !choroKey && V.hasRelief(preset);
    ok(p && p.key === preset.key && p.style === style && p.borders === borders && p.relief === withRelief && p.choroKey === choroKey, 'round trip ' + id);
    ok(p && p.preset && p.preset.key === preset.key, 'preset found for ' + id);
    ok(p && ['north', 'south', 'west', 'east'].every(k => p.bounds[k] === preset.bounds[k]), 'bounds back from ' + id);
    // the id of what it parsed is the same id
    if (p) ok(V.baseMapId(preset, p.style, p.borders, p.choroKey, p.relief) === id, 'id round trip ' + id);
  }
  ok(n === 9 * 2 * 2 * 2 * 2, 'covered every id');
  ok(M.parseBaseMapId('upload:abc') === null && M.parseBaseMapId('File:Map of Kansas.svg') === null && M.parseBaseMapId('') === null && M.parseBaseMapId(null) === null, 'null for uploads and Commons ids');
  ok(M.parseBaseMapId('vector:world:84,-90,-180:outline') === null, 'null for short bounds');
  ok(M.parseBaseMapId('vector:world:84,-90,-180,x:outline') === null, 'null for non-numeric bounds');
  const unknown = M.parseBaseMapId('vector:nowhere:1,0,0,1:land+borders');
  ok(unknown && unknown.preset === null && unknown.key === 'nowhere', 'a preset the page no longer has parses with preset null');

  // ---- loadSource ----
  const world = V.findPreset('world');
  const src = await M.loadSource({ preset: world, style: 'land', borders: true }, { makePath: () => new Rec() });
  ok(src.width === 4000, 'world width is the long side');
  ok(src.landFills.length === 1 && src.landFills[0].ops.length > 5000, 'one land path with the whole layer');
  ok(src.stroke.ops.length > 10000, 'a stroke path over the divided layer');
  ok(src.shaded.length === 0 && src.relief === null, 'no shading, no relief');
  ok(src.paint.land === '#f6f1e4', 'land style paint');
  // Antarctica: land closes through the pole (a point on the bottom edge), the stroke does not
  const bottomY = src.height;
  const wholeSrc = await M.loadSource({ preset: world, style: 'outline', borders: false }, { makePath: () => new Rec() });
  const polar = wholeSrc.landFills[0].ops.filter(o => o[0] === 'L' && near(o[2], bottomY, 1e-6)).length;
  const polarStroke = wholeSrc.stroke.ops.filter(o => o[0] === 'L' && near(o[2], bottomY, 1e-6)).length;
  ok(polar > polarStroke, 'the fill is closed through the pole and the stroke is not');
  // Fiji twice: some vertex projects past the right edge (shifted 360) and some at the left edge
  const maxX = Math.max(...wholeSrc.landFills[0].ops.filter(o => o.length > 2).map(o => o[1]));
  ok(maxX > src.width, 'a ring that crosses 180 is drawn twice, the copy past the edge');
  // borders off strokes the whole layer: fewer ops than the divided
  ok(wholeSrc.stroke.ops.length < src.stroke.ops.length, 'borders off strokes the land layer');
  // shaded: only named fills; an unknown name is ignored
  const shadedSrc = await M.loadSource({ preset: world, style: 'outline', borders: true, fills: { France: '#ff0000', Atlantis: '#00ff00' } }, { makePath: () => new Rec() });
  ok(shadedSrc.shaded.length === 1 && shadedSrc.shaded[0].color === '#ff0000', 'France shaded, Atlantis ignored');
  // relief is off under shading (the backstop) and on non-relief presets
  const eur = V.findPreset('europe');
  const e = await M.loadSource({ preset: eur, style: 'outline', borders: false, relief: true }, { makePath: () => new Rec() });
  ok(e.relief === null, 'no relief on a preset without a relief render');
  // custom: a file's shapes are filled one by one
  const sq = (x, y) => ({ type: 'Feature', properties: { name: 'S' + x }, geometry: { type: 'Polygon', coordinates: [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]] } });
  const gj = { type: 'FeatureCollection', features: [sq(0, 0), sq(5, 5), sq(9, 1)] };
  const parsed = { key: 'custom-test' + label, label: 'T', bounds: { north: 10, south: 0, west: 0, east: 12 }, geojson: gj, stats: { shapes: 3 } };
  const cust = V.registerCustomPreset ? V.registerCustomPreset(parsed) : null;
  if (cust) {
    const cs = await M.loadSource({ preset: cust, style: 'outline', borders: true }, { makePath: () => new Rec() });
    ok(cs.landFills.length === 3, 'a custom file has one fill path per shape');
  }

  // ---- drawExtent ----
  for (const preset of V.BASE_MAP_PRESETS) {
    const s = { width: 4000, height: 2000, calibration: { ...preset.bounds } };
    const sz = (await import('../../../_shared/geo-project.js')).pixelSizeFor(preset.bounds);
    s.width = sz.width; s.height = sz.height;
    const vw = 1000, vh = 800, k = Math.min(vw / s.width, vh / s.height);
    const view = { x: (vw - s.width * k) / 2, y: (vh - s.height * k) / 2, scale: k };
    const ex = M.drawExtent(s, view, vw, vh);
    ok(['north', 'south', 'west', 'east'].every(c => near(ex[c], preset.bounds[c], 1e-6)), 'extent at fit is the preset bounds: ' + preset.key + ' ' + JSON.stringify(ex));
    // 4x about the centre shows a quarter of each span
    const k4 = k * 4;
    const v4 = { x: vw / 2 - (s.width / 2) * k4, y: vh / 2 - (s.height / 2) * k4, scale: k4 };
    const e4 = M.drawExtent(s, v4, vw, vh);
    const lonSpan = preset.bounds.east - preset.bounds.west;
    const wantLon = Math.min(lonSpan, (vw / k4) / s.width * lonSpan);
    ok(near(e4.east - e4.west, wantLon, 1e-6), 'extent at 4x: width ' + preset.key);
    ok(e4.west >= preset.bounds.west - 1e-9 && e4.east <= preset.bounds.east + 1e-9, 'extent stays inside the map ' + preset.key);
  }

  // ---- drawBaseMap on a recording context ----
  const calls = [];
  const rec = new Proxy({}, { get: (_, k) => (...a) => { calls.push([k, ...a]); }, set: (_, k, v) => { calls.push(['set:' + k, v]); return true; } });
  const fakeSrc = { width: 400, height: 200, paint: { ocean: '#aaa', land: '#bbb', stroke: '#ccc' }, landFills: ['L'], stroke: 'S', shaded: [{ path: 'P', color: '#f00' }], relief: null };
  M.drawBaseMap(rec, fakeSrc, { x: 10, y: 20, scale: 3 }, 640, 480, { dpr: 2, strokePx: 1 });
  const tr = calls.find(c => c[0] === 'setTransform' && c[1] === 6);
  ok(tr && tr[5] === 20 && tr[6] === 40, 'transform is dpr*scale and dpr*offset');
  const lw = calls.find(c => c[0] === 'set:lineWidth');
  ok(lw && near(lw[1], 1 / 3), 'line width is strokePx/scale so it is strokePx on screen');
  ok(calls.some(c => c[0] === 'fill' && c[1] === 'L' && c[2] === 'evenodd'), 'land filled even-odd');
  ok(calls.some(c => c[0] === 'stroke' && c[1] === 'S'), 'stroke path stroked');
  const iFill = calls.findIndex(c => c[0] === 'fill' && c[1] === 'P'), iStroke = calls.findIndex(c => c[0] === 'stroke');
  ok(iFill > 0 && iFill < iStroke, 'shaded fills sit under the borders');
  ok(calls[0][0] === 'save' && calls[calls.length - 1][0] === 'restore', 'ctx state saved and restored');
  calls.length = 0;
  M.drawBaseMap(rec, fakeSrc, { x: 0, y: 0, scale: 1 }, 400, 200, { mat: null });
  ok(calls.filter(c => c[0] === 'fillRect').length === 1, 'mat null paints the ocean only');
  calls.length = 0;
  M.drawBaseMap(rec, fakeSrc, { x: 0, y: 0, scale: 1 }, 400, 200);
  ok(calls.filter(c => c[0] === 'fillRect').length === 2, 'the default paints a mat then the ocean');

  return bad;
}

let failed = 0;
const real = await suite(await load('', path.join(dir, 'bmg-live.js')), 'real');
if (real.length) { failed++; console.log('FAIL real module:\n  ' + real.join('\n  ')); } else console.log('ok   the module passes its own checks');

// ---- mutants: each must be caught ----
const MUTANTS = [
  ['parse drops +relief', s => s.replace("relief: m[4].includes('+relief')", 'relief: false')],
  ['parse swaps north/south', s => s.replace('north: n[0], south: n[1]', 'north: n[1], south: n[0]')],
  ['stroke width not divided by scale', s => s.replace('strokePx / scale', 'strokePx')],
  ['transform ignores dpr', s => s.replace('setTransform(dpr * scale, 0, 0, dpr * scale, dpr * x, dpr * y)', 'setTransform(scale, 0, 0, scale, x, y)')],
  ['shaded under land', s => s.replace("for (const p of source.landFills) ctx.fill(p, 'evenodd');", '')],
  ['stroke includes the polar closure', s => s.replace('borders ? divided : whole, bounds, width, height, true', 'borders ? divided : whole, bounds, width, height, false')],
  ['fill not even-odd', s => s.replace("ctx.fill(p, 'evenodd')", 'ctx.fill(p)')],
  ['extent forgets the map edge', s => s.replace('Math.min(source.width, (cssW - view.x) / view.scale)', '(cssW - view.x) / view.scale')],
  ['custom fills in one path', s => s.replace('preset.custom\n    ?', 'false\n    ?')],
  ['shading ignores names', s => s.replace('if (color) shaded.push', 'if (true) shaded.push')],
  ['no save/restore', s => s.replace('  ctx.save();\n  ctx.setTransform(1, 0, 0, 1, 0, 0);', '  ctx.setTransform(1, 0, 0, 1, 0, 0);')],
];
const tmp = path.join(process.env.HOME, '.cache', 'selector-scratch', 'AI-28', 'mut');
fs.mkdirSync(tmp, { recursive: true });
let i = 0;
for (const [name, mut] of MUTANTS) {
  const out = mut(SRC);
  if (out === SRC) { failed++; console.log('FAIL mutant "' + name + '" does not change the source (its anchor is stale)'); continue; }
  const f = path.join(dir, 'bmg-live.mut' + (++i) + '.js');
  fs.writeFileSync(f, out);
  try {
    const bad = await suite(await load('m' + i, f), 'mutant ' + i);
    if (!bad.length) { failed++; console.log('FAIL mutant "' + name + '" was not caught'); } else console.log('ok   mutant caught: ' + name);
  } catch (e) { console.log('ok   mutant caught (threw): ' + name); }
  finally { fs.rmSync(f, { force: true }); }
}
fs.rmSync(path.join(process.env.HOME, '.cache', 'selector-scratch', 'AI-28'), { recursive: true, force: true });
if (failed) { console.log(failed + ' failed'); process.exit(1); }
console.log('live-base: all passed');
