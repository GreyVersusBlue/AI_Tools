// make-scan-fixtures.mjs — synthetic "photos of a sheet" for scan.test.mjs (Path 17 P2, AI-38).
//
// Extends make-fixtures.mjs (its PNG writer and its xorshift generator). No camera and no image
// library: a sheet is drawn from rectangles, forward-mapped through a homography onto a desk, lit
// by a left-to-right gradient, and given Gaussian noise and an optional soft shadow band. The true
// corners come back with the picture, so a test can say how far a corner is from the truth.
//
// The forward map here is NOT Scan.homography. It is Heckbert's closed form for the unit square
// to a quad, composed with the adjugate of the same thing for the photo side, so a broken
// Scan.homography cannot also bend the pictures it is tested on.
//
//   warpedPage({ w, h, quad, paper, desk, gradient, noise, shadow, seed })
//       -> { imageData, quad, sheetQuad, sheet }
//   fixture(name, { big, clean })     one of the named fixtures below
//   enhanceBoard()                    smoke-enhance.mjs's whiteboard photo, as an image
//   toPng(imageData)                  the picture as a PNG Buffer (for the browser suite)
//
// A quad is [TL, TR, BR, BL]. `sheetQuad` is the sheet's own corners in the photo (what rectify
// must be given to stand the sheet upright); `quad` is the same four points in screen order
// (TL = smallest x + y, clockwise), which is what a detector gives and what Scan.orderCorners
// returns. They are the same for a sheet turned less than a quarter turn.

import { makePng, xorshift32 } from './make-fixtures.mjs';

/* ── the sheet ────────────────────────────────────────────────────────────── */

export const SHEET_W = 850, SHEET_H = 1100;     // a Letter page at about 100 dpi

// what each pixel of the sheet is, for masks
export const PAPER = 0, TEXT = 1, FRAME = 2, RULE = 3;

/**
 * The un-warped sheet: a thick frame line, ruled lines every 40 px (2 px thick, the full width
 * inside the frame), and "text" as bars 5 px tall in the gaps between rules, starting at x = 130
 * so the strip at x 34..102 holds ruled lines and nothing else (a line's row is read off that
 * strip). Ink is drawn relative to the paper value, so a dark sheet has dark ink. Returns
 * { w, h, gray: Float32Array, kind: Uint8Array, ruleRows: [y of the top row of each rule] }.
 */
export function renderSheet(paper = 235) {
  const w = SHEET_W, h = SHEET_H;
  const gray = new Float32Array(w * h).fill(paper);
  const kind = new Uint8Array(w * h);
  const put = (x0, y0, x1, y1, v, k) => {          // [x0, x1) x [y0, y1)
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { gray[y * w + x] = v; kind[y * w + x] = k; }
  };
  const frameV = paper * 0.21, ruleV = paper * 0.5, textV = paper * 0.17;
  // frame, 6 px thick, inset 20
  put(20, 20, w - 20, 26, frameV, FRAME); put(20, h - 26, w - 20, h - 20, frameV, FRAME);
  put(20, 20, 26, h - 20, frameV, FRAME); put(w - 26, 20, w - 20, h - 20, frameV, FRAME);
  const ruleRows = [];
  const rng = xorshift32(7);
  for (let y = 100; y <= h - 100; y += 40) {
    put(26, y, w - 26, y + 2, ruleV, RULE);
    ruleRows.push(y);
    if (y + 40 > h - 100) break;
    // two or three words in the gap below this rule
    let x = 130;
    while (x < w - 70) {
      const len = 30 + (rng() % 60);
      if (x + len > w - 60) break;
      put(x, y + 16, x + len, y + 21, textV, TEXT);
      x += len + 14;
    }
  }
  return { w, h, gray, kind, ruleRows, paper };
}

/* ── an independent homography (Heckbert), for the forward map only ────────── */

function unitToQuad(q) {            // (0,0)->q0 (1,0)->q1 (1,1)->q2 (0,1)->q3
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  if (Math.abs(sx) < 1e-12 && Math.abs(sy) < 1e-12) {
    return [x1 - x0, x2 - x1, x0, y1 - y0, y2 - y1, y0, 0, 0, 1];
  }
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}
function adjugate(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  return [e * i - f * h, c * h - b * i, b * f - c * e,
          f * g - d * i, a * i - c * g, c * d - a * f,
          d * h - e * g, b * g - a * h, a * e - b * d];
}
function mat(A, B) {
  const C = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
  return C;
}

/* ── the photo ────────────────────────────────────────────────────────────── */

/** Bilinear read of the sheet's grey at continuous sheet coordinates. */
function sheetAt(sheet, u, v) {
  const fx = u - 0.5, fy = v - 0.5;
  let x0 = Math.floor(fx), y0 = Math.floor(fy);
  const ax = fx - x0, ay = fy - y0;
  let x1 = x0 + 1, y1 = y0 + 1;
  const W = sheet.w, H = sheet.h;
  if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > W - 1) x1 = W - 1; if (y1 > H - 1) y1 = H - 1;
  if (x0 > W - 1) x0 = W - 1; if (y0 > H - 1) y0 = H - 1;
  const g = sheet.gray;
  const top = g[y0 * W + x0] * (1 - ax) + g[y0 * W + x1] * ax;
  const bot = g[y1 * W + x0] * (1 - ax) + g[y1 * W + x1] * ax;
  return top * (1 - ay) + bot * ay;
}

/**
 * A photo `w` x `h` of the sheet standing at `quad` (the sheet's TL, TR, BR, BL in the photo)
 * on a desk of luminance `desk`. `paper` is the sheet's white. `gradient` darkens the photo
 * toward its left edge (light = 1 - gradient * (1 - x / w)); `noise` is the sigma of Gaussian
 * noise in levels; `shadow` { depth, width, x, angle } lays a soft dark band across it (`x` the
 * band's centre line at the photo's mid height, as a fraction of the width). `quad: null` is a
 * photo of the desk alone.
 */
export function warpedPage({ w, h, quad, paper = 235, desk = 90, gradient = 0.35, noise = 0, shadow = null, seed = 1, sheet = null }) {
  sheet = sheet || renderSheet(paper);
  const data = new Uint8ClampedArray(w * h * 4);
  const rnd = xorshift32(seed * 2654435761 >>> 0 || 1);
  const uni = () => (rnd() + 1) / 4294967297;
  const gauss = () => Math.sqrt(-2 * Math.log(uni())) * Math.cos(2 * Math.PI * uni());
  let P = null;                          // photo -> sheet
  if (quad) {
    const toQuad = unitToQuad(quad);
    const sheetFromUnit = [sheet.w, 0, 0, 0, sheet.h, 0, 0, 0, 1];
    P = mat(sheetFromUnit, adjugate(toQuad));
  }
  const sh = shadow ? { cx: shadow.x * w, ang: shadow.angle, wd: shadow.width * w, depth: shadow.depth } : null;
  let o = 0;
  for (let y = 0; y < h; y++) {
    const py = y + 0.5;
    for (let x = 0; x < w; x++, o += 4) {
      const px = x + 0.5;
      let base = desk;
      if (P) {
        const den = P[6] * px + P[7] * py + P[8];
        const u = (P[0] * px + P[1] * py + P[2]) / den, v = (P[3] * px + P[4] * py + P[5]) / den;
        const cov = Math.max(0, Math.min(1, Math.min(u, sheet.w - u, v, sheet.h - v) + 0.5));
        if (cov > 0) {
          const s = sheetAt(sheet, Math.max(0, Math.min(sheet.w, u)), Math.max(0, Math.min(sheet.h, v)));
          base = desk * (1 - cov) + s * cov;
        }
      }
      let light = 1 - gradient * (1 - px / w);
      if (sh) {
        // distance from the band's centre line, which leans by `ang` from the vertical
        const d = (px - sh.cx) * Math.cos(sh.ang) - (py - h / 2) * Math.sin(sh.ang);
        light *= 1 - sh.depth * Math.exp(-(d * d) / (2 * sh.wd * sh.wd));
      }
      const L = base * light;
      data[o]     = L + (noise ? noise * gauss() : 0);
      data[o + 1] = L + (noise ? noise * gauss() : 0);
      data[o + 2] = L + (noise ? noise * gauss() : 0);
      data[o + 3] = 255;
    }
  }
  const sheetQuad = quad ? quad.map(p => [p[0], p[1]]) : null;
  return { imageData: { data, width: w, height: h }, quad: sheetQuad ? orderQuad(sheetQuad) : null, sheetQuad, sheet };
}

// screen order, written out here so the fixtures do not lean on scan.js's orderCorners
function orderQuad(pts) {
  const cx = pts.reduce((a, p) => a + p[0] / 4, 0), cy = pts.reduce((a, p) => a + p[1] / 4, 0);
  const p = pts.map(q => [q[0], q[1]]).sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  let s = 0;
  for (let i = 1; i < 4; i++) {
    const a = p[i][0] + p[i][1], b = p[s][0] + p[s][1];
    if (a < b || (a === b && p[i][1] < p[s][1])) s = i;
  }
  return [p[s], p[(s + 1) % 4], p[(s + 2) % 4], p[(s + 3) % 4]];
}

/* ── the named fixtures ───────────────────────────────────────────────────── */

const rect = (cx, cy, hw, hh) => [[cx - hw, cy - hh], [cx + hw, cy - hh], [cx + hw, cy + hh], [cx - hw, cy + hh]];
const rotate = (q, cx, cy, deg) => {
  const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  return q.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
};
const shift = (q, dx, dy) => q.map(([x, y]) => [x + dx, y + dy]);

// A fixture's sheet is 700 px wide and 906 tall in a 1600 x 1200 photo (the sheet's own
// 850:1100), centred, unless it says otherwise. All sizes below are for 1600 x 1200 and scale by
// the photo's width for the 4032 x 3024 versions.
const BASE = rect(800, 600, 350, 453);
const KEYSTONE = [[590, 147], [1010, 147], [1150, 1053], [450, 1053]];   // far side 60% of the near

/** Each entry: a quad in 1600 x 1200 photo coordinates (null: no sheet) and warpedPage's options. */
export const SPECS = {
  centred:     { quad: BASE },
  offCentre:   { quad: shift(BASE, -250, 30) },
  rot15:       { quad: rotate(BASE, 800, 600, 15) },
  rot40:       { quad: rotate(BASE, 800, 600, 40) },
  rot90:       { quad: rotate(BASE, 800, 600, 90) },
  keystone:    { quad: KEYSTONE },
  nearFull:    { quad: rect(800, 600, 445, 576) },               // 96% of the frame's height
  small:       { quad: rect(800, 600, 278, 360) },               // about a fifth of the frame's area
  oneEdgeOut:  { quad: shift(BASE, -530, 0) },                   // the left edge 80 px outside the frame
  darkOnLight: { quad: BASE, paper: 70, desk: 200 },
  lowContrast: { quad: BASE, paper: 235, desk: 205 },
  noisy:       { quad: BASE, noise: 12 },
  shadowBand:  { quad: BASE, shadow: { depth: 0.35, width: 0.03, x: 0.5, angle: 0.3 } },
  noPage:      { quad: null, desk: 150, noise: 8, gradient: 0.2 },
  // the strong left-to-right gradient the threshold is judged on: the dim end at 40% of the bright
  gradientSheet: { quad: BASE, gradient: 0.6 },
};

/**
 * One named fixture, 1600 x 1200, or 4032 x 3024 with { big: true }. { clean: true } is its
 * geometry alone, no lighting gradient, no shadow, no noise: what the rectify checks compare
 * against the un-warped sheet (a lit photo cannot be within 12 levels of an unlit sheet).
 */
export function fixture(name, { big = false, clean = false } = {}) {
  const spec = SPECS[name];
  if (!spec) throw new Error('no fixture named ' + name);
  const w = big ? 4032 : 1600, h = big ? 3024 : 1200, k = w / 1600;
  const quad = spec.quad ? spec.quad.map(([x, y]) => [x * k, y * k]) : null;
  const opts = { w, h, quad, paper: spec.paper, desk: spec.desk, gradient: spec.gradient, noise: spec.noise, shadow: spec.shadow, seed: 1 };
  if (clean) { opts.gradient = 0; opts.shadow = null; if (name !== 'noisy') opts.noise = 0; }
  for (const key of Object.keys(opts)) if (opts[key] === undefined) delete opts[key];
  return { name, ...warpedPage(opts) };
}

/* ── smoke-enhance.mjs's board ────────────────────────────────────────────── */

export const BOARD_W = 400, BOARD_H = 300;
export const BOARD_MARKS = { dimInk: { x: 60, y: 150 }, brightInk: { x: 340, y: 150 }, redMark: { x: 200, y: 90 } };

/** The whiteboard photo smoke-enhance.mjs builds (a dim 118 on the left to a bright 210 on the
 *  right with a warm cast, three marks), as an image. Same arithmetic, same bytes. */
export function enhanceBoard() {
  const W = BOARD_W, H = BOARD_H, M = BOARD_MARKS;
  const boardPixel = (x) => {
    const base = 118 + (210 - 118) * (x / W);
    return [Math.round(base * 1.06), Math.round(base), Math.round(base * 0.88)];
  };
  const near = (x, y, m, r = 14) => Math.abs(x - m.x) < r && Math.abs(y - m.y) < r;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let px;
    if (near(x, y, M.dimInk) || near(x, y, M.brightInk)) {
      const b = boardPixel(x);
      px = [Math.round(b[0] * 0.22), Math.round(b[1] * 0.22), Math.round(b[2] * 0.22)];
    } else if (near(x, y, M.redMark)) {
      const b = boardPixel(x);
      px = [Math.round(b[0] * 0.95), Math.round(b[1] * 0.22), Math.round(b[2] * 0.22)];
    } else px = boardPixel(x);
    const o = (y * W + x) * 4;
    data[o] = px[0]; data[o + 1] = px[1]; data[o + 2] = px[2]; data[o + 3] = 255;
  }
  return { data, width: W, height: H };
}

/** The picture as a PNG (RGB). */
export function toPng(img) {
  return makePng(img.width, img.height, (x, y) => {
    const o = (y * img.width + x) * 4;
    return [img.data[o], img.data[o + 1], img.data[o + 2]];
  });
}
