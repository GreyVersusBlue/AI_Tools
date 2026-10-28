// bmg-live.js — the base map drawn from the vectors for any view (Path 20 P3, step 1).
//
// The stage unit does not change: one unit is one pixel of the 4000 px plate carrée raster that
// pixelSizeFor(preset.bounds) describes, whether or not a raster exists. So every saved label,
// marker, region, line, view and calibration opens where it was. `drawBaseMap` is the one draw
// function: the screen calls it on a viewport-sized canvas and an export calls it in place of
// drawImage(mapImg, ...). bmg-vector.js's renderBaseMapCanvas() is untouched and stays the
// raster path (the cache records, 015's panel, the series sheet); the suite holds the two to
// the same pixels at the identity view.
//
// DOM-free but for the canvas it is handed. Nothing is fetched here beyond the data files
// bmg-vector.js already reads.

import { pixelSizeFor, traceFeature } from '../../_shared/geo-project.js';
import {
  STYLE_PAINT, findPreset, hasRelief, loadReliefImage, loadWholeGeoJson, loadDividedGeoJson,
} from './bmg-vector.js';

export const MAT = '#eef0ec';

/** The inverse of baseMapId(): which map an id describes, from the string alone. null for a Commons file or an upload. */
export function parseBaseMapId(id, lookup = findPreset) {
  const m = /^vector:([^:]+):([^:]+):(outline|land)((?:\+borders|\+relief)*)(?::choro:([^:]*))?$/.exec(String(id || ''));
  if (!m) return null;
  const preset = lookup(m[1]);
  const n = m[2].split(',').map(Number);
  if (n.length !== 4 || n.some(v => !Number.isFinite(v))) return null;
  return {
    preset,
    key: m[1],
    bounds: { north: n[0], south: n[1], west: n[2], east: n[3] },
    style: m[3],
    borders: m[4].includes('+borders'),
    relief: m[4].includes('+relief'),
    choroKey: m[5] || '',
  };
}

// Path2D takes a path-building ctx shape: moveTo/lineTo/closePath. traceFeature needs no beginPath.
function pathOf(makePath, layer, bounds, width, height, forStroke) {
  const p = makePath();
  for (const f of layer.features || []) traceFeature(p, f, bounds, width, height, forStroke);
  return p;
}

/**
 * Loads and projects once. spec: { preset, style, borders, fills, relief }. Returns
 * { spec, width, height, calibration, paint, landFills, stroke, shaded, relief }, where every path is
 * in stage units and cached for the life of the source.
 */
export async function loadSource(spec, { makePath = () => new Path2D(), longSide } = {}) {
  const { preset, style = 'outline', borders = true } = spec;
  const fills = spec.fills && Object.keys(spec.fills).length ? spec.fills : null;
  const bounds = preset.bounds;
  const { width, height } = pixelSizeFor(bounds, longSide);
  const reliefImg = spec.relief && !fills && hasRelief(preset) ? await loadReliefImage(preset) : null;
  const whole = await loadWholeGeoJson(preset);
  const divided = (borders || fills) ? await loadDividedGeoJson(preset) : null;

  // A dropped file's shapes may overlap, so each is filled on its own; a built-in layer is one even-odd path.
  const landFills = preset.custom
    ? whole.features.map(f => pathOf(makePath, { features: [f] }, bounds, width, height, false))
    : [pathOf(makePath, whole, bounds, width, height, false)];
  const stroke = pathOf(makePath, borders ? divided : whole, bounds, width, height, true);
  const shaded = [];
  if (fills) {
    for (const f of divided.features || []) {
      const name = f.properties && f.properties.name;
      const color = name && fills[name];
      if (color) shaded.push({ path: pathOf(makePath, { features: [f] }, bounds, width, height, false), color });
    }
  }
  return {
    spec, width, height, landFills, stroke, shaded, relief: reliefImg,
    paint: STYLE_PAINT[style] || STYLE_PAINT.outline,
    calibration: { north: bounds.north, south: bounds.south, west: bounds.west, east: bounds.east, projection: 'equirectangular' },
  };
}

/**
 * Paints the base map for `view` ({ x, y, scale }, as bmg-viewer.js keeps it) onto a cssW x cssH
 * box of `ctx` drawn at `dpr`. `strokePx` is the line's width in SCREEN pixels at any zoom; the
 * raster path's equivalent at scale 1 is max(1, round(longSide/1600)). `mat: null` leaves the
 * area outside the map transparent.
 */
export function drawBaseMap(ctx, source, view, cssW, cssH, { dpr = 1, strokePx = 1, mat = MAT } = {}) {
  const { x, y, scale } = view;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (mat) { ctx.fillStyle = mat; ctx.fillRect(0, 0, Math.ceil(cssW * dpr), Math.ceil(cssH * dpr)); }
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * x, dpr * y);
  const { paint } = source;
  ctx.fillStyle = paint.ocean;
  ctx.fillRect(0, 0, source.width, source.height);
  ctx.fillStyle = paint.land;
  for (const p of source.landFills) ctx.fill(p, 'evenodd');
  if (source.relief) {
    ctx.save();
    ctx.clip(source.landFills[0], 'evenodd');
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source.relief, 0, 0, source.width, source.height);
    ctx.restore();
  }
  for (const s of source.shaded) { ctx.fillStyle = s.color; ctx.fill(s.path, 'evenodd'); }
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = paint.stroke;
  ctx.lineWidth = strokePx / scale;
  ctx.stroke(source.stroke);
  ctx.restore();
}

/** The lat/long rectangle the view shows, clamped to the map. */
export function drawExtent(source, view, cssW, cssH) {
  const b = source.calibration;
  const sx0 = Math.max(0, -view.x / view.scale), sx1 = Math.min(source.width, (cssW - view.x) / view.scale);
  const sy0 = Math.max(0, -view.y / view.scale), sy1 = Math.min(source.height, (cssH - view.y) / view.scale);
  const lonAt = sx => b.west + (sx / source.width) * (b.east - b.west);
  const latAt = sy => b.north - (sy / source.height) * (b.north - b.south);
  return { west: lonAt(sx0), east: lonAt(sx1), north: latAt(sy0), south: latAt(sy1) };
}
