// scan.test.mjs — Scan (Tools/image-to-pdf/scan.js), Path 17 P2, AI-38: the pixel operations, and
// AI-39: the corner detector.
//
//   node Tools/image-to-pdf/test/scan.test.mjs            (npm run test:image-to-pdf-scan)
//   node Tools/image-to-pdf/test/scan.test.mjs --bench    ms per step on a 12 Mpx frame, no checks
//
// Pure Node: no browser, no port. scan.js is a classic script that publishes window.Scan, so it
// runs here in a vm context with no document, as export.test.mjs runs export.js. The pictures are
// the synthetic fixtures of make-scan-fixtures.mjs (a sheet warped onto a desk through its own
// independent homography), and every check below is then run again against a deliberately broken
// copy of scan.js, which must fail it.
//
// The design's checks (BACKLOG.md, Path 17, P2, "Tests, without a camera") this file holds:
//   (3) homography round-trips 200 random convex quads to 1e-9 and throws on collinear points
//   (4) rectify with the true quad against the un-warped sheet: mean difference under 12 levels,
//       every ruled line within 2 px
//   (5) threshold on the gradient sheet (99.5% of paper white, 95% of strokes black, dim and bright
//       end alike), the despeckle, gray, and flatten against a recorded table
//   (6) corners in any order come out TL, TR, BR, BL
//   (7) --bench
// and the detector's (AI-39):
//   (1) detect puts every corner within 1.5% of the photo's long edge of the truth, refine within 0.5%,
//       method 'edges' and confidence over 0.6, on every fixture but noPage and oneEdgeOut (lowContrast and
//       shadowBand may be under 0.6 and are held to the corners all the same)
//   (2) noPage is 'fallback' at confidence 0 with the inset frame; oneEdgeOut puts the side that is outside the
//       photo on the frame's edge, with confidence under 0.6
//   (4) rectify with the detected quad, not the true one: mean difference under 18 levels
//   and refine from a quad that is a few pixels off, outputSize, clean, process and downscale.
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { xorshift32 } from './make-fixtures.mjs';
import { fixture, enhanceBoard, SHEET_W, SHEET_H, PAPER, TEXT, FRAME, renderSheet } from './make-scan-fixtures.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, '..', 'scan.js'), 'utf8');
const GOLDEN = JSON.parse(fs.readFileSync(path.join(here, 'golden-enhance.json'), 'utf8'));

function patch(mutate) {
  let src = SRC;
  if (mutate) {
    for (const [from, to] of mutate) {
      if (!src.includes(from)) throw new Error('mutant pattern not found: ' + from);
      src = src.split(from).join(to);
    }
  }
  return src;
}

// Run in this realm: a file loaded into a fresh vm context is 10 to 20 times slower here (V8 treats
// the arrays handed across the realm boundary slowly), which made the suite a minute long and the
// --bench numbers a lie. scan.js publishes window.Scan, so a window is all it needs.
function load(mutate) {
  globalThis.window = {};
  vm.runInThisContext(patch(mutate), { filename: 'scan.js' });
  const S = globalThis.window.Scan;
  delete globalThis.window;
  return S;
}

// ...and the same file in a context of its own, as export.test.mjs loads export.js, answers the
// questions that cost nothing (it has no DOM, no import, no storage)
{
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  const S = ctx.window.Scan;
  const H = S.homography([[0, 0], [4, 0], [4, 4], [0, 4]], [[0, 0], [8, 0], [8, 8], [0, 8]]);
  const p = S.apply(H, [1, 1]);
  const g = S.gray({ data: new Uint8ClampedArray([255, 0, 0, 255]), width: 1, height: 1 });
  if (Math.abs(p[0] - 2) > 1e-9 || g.data[0] !== 76 || S.orderCorners([[9, 9], [0, 9], [0, 0], [9, 0]])[0][0] !== 0) {
    console.log('  FAIL scan.js in a vm context of its own does not work'); process.exit(1);
  }
}

/* ── --bench ──────────────────────────────────────────────────────────────── */

if (process.argv.includes('--bench')) {
  const S = load();
  const time = (label, fn) => {
    const t0 = process.hrtime.bigint(); const r = fn();
    console.log(label.padEnd(46) + (Number(process.hrtime.bigint() - t0) / 1e6).toFixed(0).padStart(7) + ' ms');
    return r;
  };
  console.log('Scan --bench: synthetic 4032 x 3024 (12.2 Mpx), one thread, ' + process.version + '\n');
  for (const name of ['centred', 'keystone']) {
    const fx = time('make fixture ' + name + ' (not Scan)', () => fixture(name, { big: true }));
    const img = fx.imageData;
    time(name + ': gray, whole frame', () => S.gray(img));
    time(name + ': homography', () => S.homography(fx.sheetQuad, [[0, 0], [1700, 0], [1700, 2200], [0, 2200]]));
    const page = time(name + ': rectify to 1700 x 2200', () => S.rectify(img, fx.sheetQuad, 1700, 2200));
    const flat = time(name + ': flatten (worksheet) on that page', () => S.flatten(page, 'worksheet'));
    time(name + ': threshold, window 15, on that page', () => S.threshold(flat, {}));
    const small = time(name + ': rectify to 1275 x 1650 (150 dpi)', () => S.rectify(img, fx.sheetQuad, 1275, 1650));
    time(name + ': threshold on that', () => S.threshold(small, {}));
    const det = time(name + ': detect (480 px grey)', () => S.detect(img));
    time(name + ': refine (1024 px grey)', () => S.refine(img, det.quad));
    time(name + ': process, color, maxDim 1600', () => S.process(img, { quad: det.quad, mode: 'color', maxDim: 1600 }));
    time(name + ': process, bw, maxDim 1600', () => S.process(img, { quad: det.quad, mode: 'bw', maxDim: 1600 }));
  }
  process.exit(0);
}

/* ── fixtures, made once (they do not depend on scan.js) ──────────────────── */

// made on first use and kept: a fixture is a second or two of per-pixel arithmetic
const cache = {};
const memo = (key, make) => cache[key] || (cache[key] = make());
const GEOM = ['centred', 'offCentre', 'rot15', 'rot40', 'rot90', 'keystone', 'nearFull', 'small', 'darkOnLight', 'lowContrast', 'noisy', 'shadowBand'];
const clean = new Proxy({}, { get: (_, n) => memo('clean:' + n, () => fixture(n, { clean: true })) });
const lit = new Proxy({}, { get: (_, n) => memo('lit:' + n, () => fixture(n)) });

const near = (a, b, tol) => Math.abs(a - b) <= tol;
// the worst distance between matching corners
const cornerError = (q, truth) => Math.max(...q.map((p, i) => Math.hypot(p[0] - truth[i][0], p[1] - truth[i][1])));

class Stop extends Error {}

function check(S, only, firstOnly) {
  try { return checks(S, only, firstOnly); } catch (e) { if (e instanceof Stop) return e.bad; throw e; }
}

function checks(S, only, firstOnly) {
  const bad = [];
  const want = (name) => !only || only === name;
  const ok = (c, m) => { if (!c) { bad.push(m); if (firstOnly) { const e = new Stop(); e.bad = bad; throw e; } } };

  /* gray ------------------------------------------------------------------ */
  if (want('gray')) {
    const px = (r, g, b) => ({ data: new Uint8ClampedArray([r, g, b, 255]), width: 1, height: 1 });
    const g = (r, gg, b) => Array.from(S.gray(px(r, gg, b)).data);
    ok(g(255, 0, 0).join() === '76,76,76,255', 'gray: red is 76 in three equal channels, got ' + g(255, 0, 0));
    ok(g(0, 255, 0).join() === '150,150,150,255', 'gray: green is 150, got ' + g(0, 255, 0));
    ok(g(0, 0, 255).join() === '29,29,29,255', 'gray: blue is 29, got ' + g(0, 0, 255));
    ok(g(255, 255, 255).join() === '255,255,255,255' && g(0, 0, 0).join() === '0,0,0,255', 'gray: white stays 255 and black 0');
    const img = { data: new Uint8ClampedArray([10, 20, 30, 7, 200, 100, 50, 7]), width: 2, height: 1 };
    const before = Array.from(img.data);
    S.gray(img);
    ok(Array.from(img.data).join() === before.join(), 'gray: leaves the input alone');
    ok(S.toGray(img).length === 2 && S.toGray(img).constructor.name === 'Uint8Array', 'toGray: one byte a pixel');
  }

  /* (3) homography --------------------------------------------------------- */
  if (want('homography')) {
    const rng = xorshift32(12345);
    const u = () => rng() / 4294967296;
    const UNIT = [[0, 0], [1, 0], [1, 1], [0, 1]];
    let made = 0, worstUnit = 0, worstBack = 0, tries = 0;
    while (made < 200 && tries++ < 5000) {
      // a random convex quad: four points at sorted angles around a centre, at random radii
      const cx = 200 + u() * 600, cy = 200 + u() * 600;
      const angs = [0, 1, 2, 3].map(i => (i + u() * 0.7) * Math.PI / 2).sort((a, b) => a - b);
      const q = angs.map(a => { const r = 80 + u() * 220; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
      let sane = true;                      // interior angles 30..150 degrees, so nothing is a sliver
      for (let i = 0; i < 4; i++) {
        const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
        const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
        const cos = (ux * vx + uy * vy) / Math.hypot(ux, uy) / Math.hypot(vx, vy);
        if (Math.abs(cos) > 0.87) sane = false;
        if ((ux * vy - uy * vx) <= 0) sane = false;   // clockwise on the screen
      }
      if (!sane) continue;
      made++;
      const H = S.homography(q, UNIT), Hi = S.homography(UNIT, q);
      for (let i = 0; i < 4; i++) {
        const p = S.apply(H, q[i]);
        worstUnit = Math.max(worstUnit, Math.abs(p[0] - UNIT[i][0]), Math.abs(p[1] - UNIT[i][1]));
      }
      // through the unit square and back, at corners and at interior points
      const pts = q.concat([[cx, cy], [cx + 10, cy - 7], [cx - 30, cy + 20]]);
      for (const p of pts) {
        const back = S.apply(Hi, S.apply(H, p));
        worstBack = Math.max(worstBack, Math.hypot(back[0] - p[0], back[1] - p[1]));
      }
    }
    ok(made === 200, 'homography: 200 random quads made, got ' + made);
    ok(worstUnit < 1e-9, 'homography: the corners land on the unit square to 1e-9, worst ' + worstUnit);
    ok(worstBack < 1e-9, 'homography: through the unit square and back to 1e-9 px, worst ' + worstBack);
    // a known mapping: a rectangle to a rectangle is the scale and shift written down by hand
    const R = S.homography([[10, 20], [110, 20], [110, 70], [10, 70]], [[0, 0], [200, 0], [200, 100], [0, 100]]);
    const m = S.apply(R, [60, 45]);
    ok(near(m[0], 100, 1e-9) && near(m[1], 50, 1e-9), 'homography: a rectangle to a rectangle maps its centre to the centre, got ' + m);

    const throws = (src, dst) => { try { S.homography(src, dst); return false; } catch (e) { return /do not make a page/.test(e.message); } };
    const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
    ok(throws([[0, 0], [5, 0], [10, 0], [0, 10]], sq), 'homography: three collinear points in the source throw');
    ok(throws(sq, [[0, 0], [10, 10], [20, 20], [0, 5]]), 'homography: three collinear points in the target throw');
    ok(throws([[0, 0], [10, 0], [2, 2], [0, 10]], sq), 'homography: a quad that is not convex throws');
    ok(throws([[0, 0], [10, 0], [10, 10], [10, 10]], sq), 'homography: a repeated point throws');
    ok(!throws(sq, [[0, 0], [100, 5], [90, 90], [-5, 80]]), 'homography: an honest quad does not throw');
  }

  /* (4) rectify ------------------------------------------------------------ */
  if (want('rectify')) {
    const sheets = {};
    for (const n of GEOM) {
      const fx = clean[n];
      const sheet = sheets[fx.sheet.paper] || (sheets[fx.sheet.paper] = renderSheet(fx.sheet.paper));
      const out = S.rectify(fx.imageData, fx.sheetQuad, SHEET_W, SHEET_H);
      ok(out.width === SHEET_W && out.height === SHEET_H && out.data.length === SHEET_W * SHEET_H * 4, n + ': rectify gives the size asked for');
      let sum = 0;
      for (let i = 0; i < SHEET_W * SHEET_H; i++) sum += Math.abs(out.data[i * 4 + 1] - sheet.gray[i]);
      const mad = sum / (SHEET_W * SHEET_H) / (fx.sheet.paper / 235);       // dark paper's levels are scaled down; judge it as if it were 235
      ok(mad < 12, n + ': rectify with the true quad is within 12 levels of the sheet on average, got ' + mad.toFixed(2));

      // ruled lines: read the rows off the strip at x 34..102, where only rules and the frame's bars are
      const prof = new Float64Array(SHEET_H);
      for (let y = 0; y < SHEET_H; y++) {
        let s = 0; for (let x = 34; x < 102; x++) s += out.data[(y * SHEET_W + x) * 4 + 1];
        prof[y] = s / 68;
      }
      const lines = [];
      let y = 0;
      const cut = fx.sheet.paper * 0.8;
      while (y < SHEET_H) {
        if (prof[y] >= cut) { y++; continue; }
        let wsum = 0, ysum = 0;
        while (y < SHEET_H && prof[y] < cut) { const wgt = fx.sheet.paper - prof[y]; wsum += wgt; ysum += wgt * (y + 0.5); y++; }
        lines.push(ysum / wsum);
      }
      const want = [23].concat(sheet.ruleRows.map(r => r + 1), [SHEET_H - 23]);
      ok(lines.length === want.length, n + ': ' + want.length + ' ruled lines found in the page, got ' + lines.length);
      let worst = 0;
      for (const wv of want) worst = Math.max(worst, Math.min(...lines.map(l => Math.abs(l - wv))));
      ok(worst <= 2, n + ': every ruled line is within 2 px of where it belongs, worst ' + worst.toFixed(2));
    }
    // outside the photo is white
    const fx = clean.oneEdgeOut;
    const out = S.rectify(fx.imageData, fx.sheetQuad, SHEET_W, SHEET_H);
    let allWhite = true;
    for (let y = 0; y < SHEET_H; y += 7) for (let x = 0; x < 60; x++) {
      const o = (y * SHEET_W + x) * 4;
      if (out.data[o] !== 255 || out.data[o + 1] !== 255 || out.data[o + 2] !== 255) allWhite = false;
    }
    ok(allWhite, 'rectify: the strip of the sheet that was outside the photo comes out white');
    const input = clean.centred.imageData, copy = new Uint8ClampedArray(input.data);
    S.rectify(input, clean.centred.sheetQuad, 100, 130);
    ok(input.data.every((v, i) => v === copy[i]), 'rectify: leaves the photo alone');
    let thrown = false;
    try { S.rectify(input, [[0, 0], [10, 0], [20, 0], [0, 10]], 10, 10); } catch (e) { thrown = true; }
    ok(thrown, 'rectify: three collinear corners throw rather than draw');
  }

  /* (5) flatten, against the recorded table of today's enhanceCanvas ---------- */
  if (want('flatten')) {
    const board = enhanceBoard();
    const keep = Array.from(board.data);
    for (const mode of ['whiteboard', 'worksheet']) {
      const out = S.flatten(board, mode);
      const want = Buffer.from(GOLDEN[mode], 'base64');
      let i = 0, max = 0, sum = 0, n = 0;
      for (let y = GOLDEN.offset; y < GOLDEN.height; y += GOLDEN.stride) for (let x = GOLDEN.offset; x < GOLDEN.width; x += GOLDEN.stride) {
        const p = (y * GOLDEN.width + x) * 4;
        for (let c = 0; c < 3; c++) { const d = Math.abs(out.data[p + c] - want[i++]); if (d > max) max = d; sum += d; n++; }
      }
      ok(i === want.length, 'flatten ' + mode + ': the whole recorded table was compared');
      ok(sum / n < 1.5, 'flatten ' + mode + ': mean gap to the page\'s own bytes under 1.5 levels, got ' + (sum / n).toFixed(3));
      ok(max <= 8, 'flatten ' + mode + ': worst gap to the page\'s own bytes at most 8 levels, got ' + max);
    }
    ok(board.data.every((v, i) => v === keep[i]), 'flatten: leaves the input alone');
    const off = S.flatten(board, 'off');
    ok(off.data.every((v, i) => v === board.data[i]), 'flatten: an unknown mode is an unchanged copy');
    // what it is for, read off the board as smoke-enhance reads the page
    const f = S.flatten(board, 'whiteboard');
    const at = (img, x, y) => { const o = (y * 400 + x) * 4; return 0.299 * img.data[o] + 0.587 * img.data[o + 1] + 0.114 * img.data[o + 2]; };
    ok(at(f, 30, 30) > 235 && at(f, 370, 270) > 235 && Math.abs(at(f, 30, 30) - at(f, 370, 270)) <= 10, 'flatten: the dim and the bright end of the board both come out white and within 10 levels (the page\'s own output is 247 and 255 there)');
    ok(at(f, 60, 150) < at(board, 60, 150) && at(f, 340, 150) < at(board, 340, 150), 'flatten: the writing gets darker at both ends');
    const o = (90 * 400 + 200) * 4;
    ok(f.data[o] - f.data[o + 1] > 40, 'flatten: red marker stays red on the whiteboard preset');
    const o2 = (30 * 400 + 30) * 4;
    ok(Math.abs(f.data[o2] - f.data[o2 + 2]) <= 6, 'flatten: the warm cast is gone');
  }

  /* (5) threshold ---------------------------------------------------------- */
  if (want('threshold')) {
    // the gradient sheet, pulled flat with the true quad, cleaned the way a page is
    const fx = lit.gradientSheet;
    const sheet = renderSheet(235);
    const page = S.rectify(fx.imageData, fx.sheetQuad, SHEET_W, SHEET_H);
    // masks off the sheet: paper at least 3 px from any ink, stroke cores 1 px in from their edge
    const isInk = (k) => k === TEXT || k === FRAME;
    const paperAt = (x, y) => {
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= SHEET_W || yy >= SHEET_H) return false;
        if (sheet.kind[yy * SHEET_W + xx] !== PAPER) return false;
      }
      return true;
    };
    const coreAt = (x, y) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= SHEET_W || yy >= SHEET_H) return false;
        if (!isInk(sheet.kind[yy * SHEET_W + xx])) return false;
      }
      return true;
    };
    const score = (bw, x0, x1) => {
      let paper = 0, white = 0, ink = 0, dark = 0;
      for (let y = 0; y < SHEET_H; y++) for (let x = x0; x < x1; x++) {
        const v = bw.data[(y * SHEET_W + x) * 4];
        if (coreAt(x, y)) { ink++; if (v === 0) dark++; }
        else if (paperAt(x, y)) { paper++; if (v === 255) white++; }
      }
      return { paper, white, ink, dark };
    };
    const variants = { 'flattened': S.threshold(S.flatten(page, 'worksheet'), {}), 'unflattened': S.threshold(page, {}) };
    for (const [label, bw] of Object.entries(variants)) {
      ok(bw.width === SHEET_W && bw.height === SHEET_H, 'threshold (' + label + '): same size out');
      let twoLevel = true;
      for (let i = 0; i < SHEET_W * SHEET_H; i++) {
        const r = bw.data[i * 4], g = bw.data[i * 4 + 1], b = bw.data[i * 4 + 2];
        if ((r !== 0 && r !== 255) || r !== g || r !== b || bw.data[i * 4 + 3] !== 255) { twoLevel = false; break; }
      }
      ok(twoLevel, 'threshold (' + label + '): three equal channels of 0 or 255, opaque');
      for (const [end, x0, x1] of [['dim end', 0, 280], ['bright end', 570, SHEET_W]]) {
        const s = score(bw, x0, x1);
        ok(s.paper > 20000 && s.ink > 1000, 'threshold (' + label + ', ' + end + '): the masks have something in them (' + s.paper + ' paper, ' + s.ink + ' ink)');
        ok(s.white / s.paper >= 0.995, 'threshold (' + label + ', ' + end + '): 99.5% of paper white, got ' + (100 * s.white / s.paper).toFixed(2) + '%');
        ok(s.dark / s.ink >= 0.95, 'threshold (' + label + ', ' + end + '): 95% of strokes black, got ' + (100 * s.dark / s.ink).toFixed(2) + '%');
      }
    }

    // against a plain reference: the same Sauvola, written out window by window
    {
      const w = 64, h = 48, rng = xorshift32(99);
      const img = { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
      const grey = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const x = i % w, y = (i / w) | 0;
        let v = 150 + x * 1.2 + (rng() % 30) - 15;
        if ((x > 10 && x < 30 && y > 12 && y < 16) || (x > 40 && x < 43 && y > 5 && y < 40)) v = 30 + (rng() % 30);
        v = Math.max(0, Math.min(255, Math.round(v)));
        grey[i] = v;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
      }
      for (const [win, k, R] of [[9, 0.2, 128], [15, 0.34, 128], [7, 0.1, 100]]) {
        const out = S.threshold(img, { window: win, k, R, despeckle: false });
        const r = (win - 1) / 2;
        let diff = 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          let s = 0, q = 0, n = 0;
          for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++) for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) {
            const v = grey[yy * w + xx]; s += v; q += v * v; n++;
          }
          const m = s / n, sd = Math.sqrt(Math.max(0, q / n - m * m));
          const want = grey[y * w + x] < m * (1 + k * (sd / R - 1)) ? 0 : 255;
          if (out.data[(y * w + x) * 4] !== want) diff++;
        }
        ok(diff === 0, 'threshold: window ' + win + ', k ' + k + ', R ' + R + ' equals the plain Sauvola, ' + diff + ' pixels differ');
      }
      const dflt = S.threshold({ data: new Uint8ClampedArray(1700 * 4), width: 1700, height: 1 }, {});
      ok(dflt.width === 1700, 'threshold: runs on a one-row image');
    }

    // the despeckle: a lone black pixel goes, a 2-px rule and a 2 x 2 block stay
    {
      const w = 48, h = 40;
      const img = { data: new Uint8ClampedArray(w * h * 4).fill(255), width: w, height: h };
      const dot = (x, y) => { const o = (y * w + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = 0; };
      dot(6, 6);                                                  // alone
      for (let y = 6; y < 34; y++) { dot(20, y); dot(21, y); }    // a rule 2 px wide
      dot(34, 8); dot(35, 8); dot(34, 9); dot(35, 9);             // 2 x 2
      const val = (bw, x, y) => bw.data[(y * w + x) * 4];
      const on = S.threshold(img, { window: 15 }), off = S.threshold(img, { window: 15, despeckle: false });
      ok(val(off, 6, 6) === 0, 'despeckle off: a lone black pixel is black (so the test is not vacuous)');
      ok(val(on, 6, 6) === 255, 'despeckle on: a lone black pixel is whitened');
      let ruleKept = true;
      for (let y = 6; y < 34; y++) if (val(on, 20, y) !== 0 || val(on, 21, y) !== 0) ruleKept = false;
      ok(ruleKept, 'despeckle on: a 2-px rule is kept whole');
      ok(val(on, 34, 8) === 0 && val(on, 35, 9) === 0, 'despeckle on: a 2 x 2 block is kept');
    }
    // and on a noisy photo: no black pixel is left alone
    {
      const nf = lit.noisy;
      const pg = S.flatten(S.rectify(nf.imageData, nf.sheetQuad, SHEET_W, SHEET_H), 'worksheet');
      const lone = (bw) => {
        let c = 0;
        for (let y = 1; y < SHEET_H - 1; y++) for (let x = 1; x < SHEET_W - 1; x++) {
          if (bw.data[(y * SHEET_W + x) * 4] !== 0) continue;
          let nb = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && bw.data[((y + dy) * SHEET_W + x + dx) * 4] === 0) nb++;
          if (!nb) c++;
        }
        return c;
      };
      const loneOn = lone(S.threshold(pg, {})), loneOff = lone(S.threshold(pg, { despeckle: false }));
      ok(loneOn === 0, 'despeckle on a noisy photo: no lone black pixel is left, got ' + loneOn);
      ok(loneOff > 0, 'despeckle off a noisy photo: there are lone black pixels to take out (' + loneOff + ')');
    }
  }

  /* (6) orderCorners ------------------------------------------------------- */
  if (want('order')) {
    const perms = (a) => a.length <= 1 ? [a] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map(p => [x].concat(p)));
    const same = (a, b) => a.every((p, i) => Math.abs(p[0] - b[i][0]) < 1e-9 && Math.abs(p[1] - b[i][1]) < 1e-9);
    for (const n of ['centred', 'offCentre', 'rot15', 'rot40', 'keystone', 'nearFull', 'small']) {
      const want = clean[n].sheetQuad;     // the sheet's own TL, TR, BR, BL; turned under a quarter, that is also the screen's
      let all = true;
      for (const p of perms(want)) if (!same(S.orderCorners(p), want)) all = false;
      ok(all, 'orderCorners: ' + n + ' comes out TL, TR, BR, BL from all 24 orders');
    }
    const q = clean.rot90.sheetQuad;       // a sheet on its side: ordered by where its corners are in the photo
    const want90 = [q[3], q[0], q[1], q[2]];
    let all90 = true;
    for (const p of perms(q)) if (!same(S.orderCorners(p), want90)) all90 = false;
    ok(all90, 'orderCorners: a sheet on its side is ordered by the photo, not by the sheet');
    const inp = [[5, 5], [1, 1], [9, 1], [1, 9]];
    S.orderCorners(inp);
    ok(inp[0][0] === 5 && inp[1][0] === 1, 'orderCorners: leaves its argument in order');
    let thrown = false;
    try { S.orderCorners([[0, 0], [1, 1], [2, 2]]); } catch (e) { thrown = true; }
    ok(thrown, 'orderCorners: three points throw');
  }

  /* downscale ------------------------------------------------------------- */
  if (want('downscale')) {
    // 40 x 20, a ramp in x and a step in y, to a long edge of 10: a factor of 4
    const w = 40, h = 20, img = { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = x * 6 + (y >= 8 ? 10 : 0), o = (y * w + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255;
    }
    const d = S.downscale(img, 10);
    ok(d.scale === 4 && d.w === 10 && d.h === 5, 'downscale: 40 x 20 to a long edge of 10 is a factor of 4, 10 x 5, got ' + d.scale + ', ' + d.w + ' x ' + d.h);
    ok(d.gray.length === 50, 'downscale: one value a pixel');
    // box (3, 1) covers x 12..15, y 4..7: mean x is 13.5, so 81
    ok(Math.abs(d.gray[1 * 10 + 3] - 81) < 1e-4, 'downscale: a box is the mean of its 4 x 4 pixels, got ' + d.gray[13]);
    ok(Math.abs(d.gray[2 * 10 + 3] - 91) < 1e-4, 'downscale: and the step in y lands in the right box, got ' + d.gray[23]);
    const keep = Array.from(img.data);
    ok(img.data.every((v, i) => v === keep[i]), 'downscale: leaves the photo alone');
    const big = S.downscale(lit.centred.imageData, 480);
    ok(big.scale === 3 && big.w === 533 && big.h === 400, 'downscale: 1600 x 1200 to 480 is 533 x 400, got ' + big.w + ' x ' + big.h);
    const tiny = S.downscale({ data: new Uint8ClampedArray(3 * 2 * 4), width: 3, height: 2 }, 480);
    ok(tiny.scale === 1 && tiny.w === 3 && tiny.h === 2, 'downscale: a picture under the long edge is not shrunk');
  }

  /* (1) detect and refine ---------------------------------------------------- */
  if (want('detect')) {
    for (const n of GEOM) {
      const fx = lit[n], long = Math.max(fx.imageData.width, fx.imageData.height);
      const d = S.detect(fx.imageData);
      ok(d.method === 'edges', n + ': detect finds edges, method ' + d.method);
      ok(Array.isArray(d.quad) && d.quad.length === 4, n + ': detect gives four corners');
      if (!(Array.isArray(d.quad) && d.quad.length === 4)) continue;
      const e = cornerError(d.quad, fx.quad);
      ok(e <= 0.015 * long, n + ': detect is within 1.5% of the long edge (' + (0.015 * long).toFixed(0) + ' px) of the truth, worst corner ' + e.toFixed(1) + ' px');
      if (n !== 'lowContrast' && n !== 'shadowBand') ok(d.confidence > 0.6, n + ': confidence over 0.6, got ' + d.confidence.toFixed(2));
      ok(d.confidence >= 0 && d.confidence <= 1, n + ': confidence is 0 to 1');
      ok(Array.isArray(d.lines) && d.lines.length === 4, n + ': detect names the four lines it chose');
      const r = S.refine(fx.imageData, d.quad);
      const re = cornerError(r, fx.quad);
      ok(re <= 0.005 * long, n + ': refine is within 0.5% of the long edge (' + (0.005 * long).toFixed(0) + ' px) of the truth, worst corner ' + re.toFixed(2) + ' px');
    }
    // the orientation and the scale: every corner is in the photo, and in order
    const c = S.detect(lit.centred.imageData).quad;
    ok(c[0][0] < c[1][0] && c[3][0] < c[2][0] && c[0][1] < c[3][1] && c[1][1] < c[2][1], 'detect: corners come out TL, TR, BR, BL');
    const before = Array.from(lit.centred.imageData.data.slice(0, 4000));
    S.detect(lit.centred.imageData);
    ok(Array.from(lit.centred.imageData.data.slice(0, 4000)).join() === before.join(), 'detect: leaves the photo alone');
  }

  /* (1) refine, from a quad that is a few pixels off -------------------------- */
  if (want('refine')) {
    const nudge = [[7, -6], [-6, 7], [6, 6], [-7, -6]];
    for (const n of GEOM) {
      const fx = clean[n], long = Math.max(fx.imageData.width, fx.imageData.height);
      const off = fx.quad.map((p, i) => [p[0] + nudge[i][0], p[1] + nudge[i][1]]);
      const r = S.refine(fx.imageData, off);
      const re = cornerError(r, fx.quad);
      ok(re <= 0.005 * long, n + ': refine from corners 6 to 9 px off lands within 0.5% of the long edge, worst corner ' + re.toFixed(2) + ' px');
    }
    let thrown = false;
    try { S.refine(clean.centred.imageData, [[0, 0], [10, 0], [20, 0], [0, 10]]); } catch (e) { thrown = /do not make a page/.test(e.message); }
    ok(thrown, 'refine: three collinear corners throw rather than draw');
    // a side with no edge to fit (it lies on the frame) is left where it was
    const fo = clean.oneEdgeOut, onFrame = fo.quad.map(p => [Math.max(0, p[0]), p[1]]);
    const rf = S.refine(fo.imageData, onFrame);
    ok(Math.abs(rf[0][0]) < 0.5 && Math.abs(rf[3][0]) < 0.5, 'refine: the side on the edge of the frame stays on it, got x ' + rf[0][0].toFixed(2) + ', ' + rf[3][0].toFixed(2));
    const co = cornerError([rf[1], rf[2]], [fo.quad[1], fo.quad[2]]);
    ok(co <= 8, 'refine: the two corners that are in the photo are within 8 px of the truth, worst ' + co.toFixed(2));
  }

  /* (2) what detect does when it is wrong --------------------------------------- */
  if (want('wrong')) {
    const np = lit.noPage, d = S.detect(np.imageData), W = np.imageData.width, H = np.imageData.height;
    ok(d.method === 'fallback', 'noPage: method is fallback, got ' + d.method);
    ok(d.confidence === 0, 'noPage: confidence is 0, got ' + d.confidence);
    const frame = [[0.04 * W, 0.04 * H], [0.96 * W, 0.04 * H], [0.96 * W, 0.96 * H], [0.04 * W, 0.96 * H]];
    ok(cornerError(d.quad, frame) < 1e-6, 'noPage: the quad is the frame inset 4%, got ' + JSON.stringify(d.quad.map(p => p.map(Math.round))));
    const d2 = S.detect(np.imageData, { inset: 0.1 });
    ok(Math.abs(d2.quad[0][0] - 0.1 * W) < 1e-6, 'noPage: the inset is an option');
    // a flat grey frame, and a one-pixel one: never throws
    const flat = { data: new Uint8ClampedArray(64 * 48 * 4).fill(128), width: 64, height: 48 };
    ok(S.detect(flat).method === 'fallback', 'detect: a flat grey picture is a fallback');
    ok(S.detect({ data: new Uint8ClampedArray(4), width: 1, height: 1 }).method === 'fallback', 'detect: a one-pixel picture is a fallback, not a throw');

    const oe = lit.oneEdgeOut, e = S.detect(oe.imageData), long = Math.max(oe.imageData.width, oe.imageData.height);
    ok(e.method === 'edges', 'oneEdgeOut: still edges, got ' + e.method);
    ok(e.confidence < 0.6, 'oneEdgeOut: confidence under 0.6, got ' + e.confidence.toFixed(2));
    ok(e.quad[0][0] <= 0.005 * long && e.quad[3][0] <= 0.005 * long, 'oneEdgeOut: the left side is on the frame\'s edge, got x ' + e.quad[0][0].toFixed(1) + ', ' + e.quad[3][0].toFixed(1));
    const rest = cornerError([e.quad[1], e.quad[2]], [oe.quad[1], oe.quad[2]]);
    ok(rest <= 0.015 * long, 'oneEdgeOut: the two corners that are in the photo are within 1.5% of the truth, worst ' + rest.toFixed(1) + ' px');
    ok(e.lines.filter(l => l.frame).length === 1, 'oneEdgeOut: one of the four lines is the frame\'s');
  }

  /* (4) rectify with the detected quad ------------------------------------------- */
  if (want('detected-rectify')) {
    const sheets = {};
    for (const n of GEOM) {
      const fx = clean[n];
      const sheet = sheets[fx.sheet.paper] || (sheets[fx.sheet.paper] = renderSheet(fx.sheet.paper));
      const det = S.refine(fx.imageData, S.detect(fx.imageData).quad);
      // the sheet's own corner order: the detected quad is in the photo's, and a sheet on its side starts a corner round
      let best = 0, bestD = Infinity;
      for (let k = 0; k < 4; k++) {
        const dd = Math.hypot(det[k][0] - fx.sheetQuad[0][0], det[k][1] - fx.sheetQuad[0][1]);
        if (dd < bestD) { bestD = dd; best = k; }
      }
      const q = [0, 1, 2, 3].map(i => det[(best + i) % 4]);
      const out = S.rectify(fx.imageData, q, SHEET_W, SHEET_H);
      let sum = 0;
      for (let i = 0; i < SHEET_W * SHEET_H; i++) sum += Math.abs(out.data[i * 4 + 1] - sheet.gray[i]);
      const mad = sum / (SHEET_W * SHEET_H) / (fx.sheet.paper / 235);
      ok(mad < 18, n + ': rectify with the detected quad is within 18 levels of the sheet on average, got ' + mad.toFixed(2));
    }
  }

  /* outputSize ------------------------------------------------------------------- */
  if (want('outputSize')) {
    const R = (w, h) => [[0, 0], [w, 0], [w, h], [0, h]];
    const o = (q, m) => JSON.stringify(S.outputSize(q, m === undefined ? undefined : { maxDim: m }));
    ok(o(R(100, 50)) === '{"w":100,"h":50}', 'outputSize: a rectangle is its own size, got ' + o(R(100, 50)));
    ok(o(R(100, 50), 60) === '{"w":60,"h":30}', 'outputSize: the long edge is capped at maxDim and the shape kept, got ' + o(R(100, 50), 60));
    ok(o(R(50, 100), 60) === '{"w":30,"h":60}', 'outputSize: a portrait page is capped on its height, got ' + o(R(50, 100), 60));
    ok(o(R(100, 50), 500) === '{"w":100,"h":50}', 'outputSize: a page under maxDim is not enlarged');
    ok(o(R(5000, 2500)) === '{"w":4000,"h":2000}', 'outputSize: no maxDim means the 4000 px cap, got ' + o(R(5000, 2500)));
    // a keystoned sheet: the longer of the two opposite sides each way (700 near, 420 far; 916.7 either side)
    const k = clean.keystone.sheetQuad, ks = S.outputSize(k, { maxDim: 4000 });
    ok(ks.w === 700 && ks.h === 917, 'outputSize: a keystoned sheet takes the longer of its opposite sides, got ' + ks.w + ' x ' + ks.h);
    const kc = S.outputSize(k, { maxDim: 600 });
    ok(kc.h === 600 && kc.w === 458, 'outputSize: and caps it, got ' + kc.w + ' x ' + kc.h);
    ok(S.outputSize([[0, 0], [0.2, 0], [0.2, 0.2], [0, 0.2]]).w === 1, 'outputSize: never under 1 px');
    let thrown = false;
    try { S.outputSize([[0, 0], [10, 0], [20, 0], [0, 10]]); } catch (e) { thrown = /do not make a page/.test(e.message); }
    ok(thrown, 'outputSize: three collinear corners throw');
  }

  /* clean and process --------------------------------------------------------------- */
  if (want('process')) {
    const fx = lit.gradientSheet, q = fx.sheetQuad, img = fx.imageData, keep = Array.from(img.data.slice(0, 4000));
    const size = S.outputSize(q, { maxDim: 600 });
    const page = S.rectify(img, q, size.w, size.h);
    for (const mode of ['color', 'gray', 'bw']) {
      const p = S.process(img, { quad: q, mode, maxDim: 600 });
      ok(p.w === size.w && p.h === size.h && p.imageData.width === p.w && p.imageData.height === p.h, 'process ' + mode + ': the page is the size outputSize says, got ' + p.w + ' x ' + p.h);
      const want2 = S.clean(page, mode);
      let same = p.imageData.data.length === want2.data.length;
      for (let i = 0; same && i < want2.data.length; i++) if (p.imageData.data[i] !== want2.data[i]) same = false;
      ok(same, 'process ' + mode + ': is rectify, then clean, byte for byte');
    }
    const g = S.process(img, { quad: q, mode: 'gray', maxDim: 600 }).imageData.data;
    let eq = true; for (let i = 0; i < g.length; i += 4) if (g[i] !== g[i + 1] || g[i] !== g[i + 2] || g[i + 3] !== 255) { eq = false; break; }
    ok(eq, 'process gray: three equal channels');
    const b = S.process(img, { quad: q, mode: 'bw', maxDim: 600 }).imageData.data;
    let two = true, dark = 0; for (let i = 0; i < b.length; i += 4) { if ((b[i] !== 0 && b[i] !== 255) || b[i] !== b[i + 1] || b[i] !== b[i + 2]) { two = false; break; } if (b[i] === 0) dark++; }
    ok(two, 'process bw: three equal channels of 0 or 255');
    ok(dark > 500 && dark < 0.2 * b.length / 4, 'process bw: some of the page is ink and most is paper, ' + dark + ' black px');
    // flatten is in the colour path: the dim end of the gradient comes out as white as the bright end
    const c = S.process(img, { quad: q, mode: 'color', maxDim: 600 }), cw = c.w;
    const lum = (x, y) => { const o = (y * cw + x) * 4; return c.imageData.data[o + 1]; };
    ok(Math.abs(lum(8, 8) - lum(cw - 9, 8)) <= 12 && lum(8, 8) > 220, 'process color: the light is evened out (corners ' + lum(8, 8) + ' and ' + lum(cw - 9, 8) + ')');
    ok(Array.from(img.data.slice(0, 4000)).join() === keep.join(), 'process: leaves the photo alone');
    let thrown = false;
    try { S.process(img, { quad: q, mode: 'sepia' }); } catch (e) { thrown = /mode/.test(e.message); }
    ok(thrown, 'process: an unknown mode throws');
    let thrown2 = false;
    try { S.process(img, { quad: [[0, 0], [10, 0], [20, 0], [0, 10]], mode: 'bw' }); } catch (e) { thrown2 = /do not make a page/.test(e.message); }
    ok(thrown2, 'process: three collinear corners throw');
    // colour stays colour, grey is grey: a photo with a red patch and a blue one on white
    {
      const w = 120, h = 160, im = { data: new Uint8ClampedArray(w * h * 4).fill(255), width: w, height: h };
      const patch = (x0, y0, r, g, b) => { for (let y = y0; y < y0 + 30; y++) for (let x = x0; x < x0 + 30; x++) { const o = (y * w + x) * 4; im.data[o] = r; im.data[o + 1] = g; im.data[o + 2] = b; } };
      patch(20, 30, 220, 30, 30); patch(70, 90, 30, 30, 220);
      const full = [[0, 0], [w, 0], [w, h], [0, h]];
      const col = S.process(im, { quad: full, mode: 'color' }).imageData.data, gr = S.process(im, { quad: full, mode: 'gray' }).imageData.data;
      const at = (d, x, y) => { const o = (y * w + x) * 4; return [d[o], d[o + 1], d[o + 2]]; };
      const red = at(col, 35, 45);
      ok(red[0] - red[1] > 60, 'process color: a red patch stays red, got ' + red);
      const g = at(gr, 35, 45), g2 = at(gr, 85, 105);
      ok(g[0] === g[1] && g[1] === g[2] && g2[0] === g2[1] && g2[1] === g2[2], 'process gray: a red patch and a blue one come out grey, got ' + g + ' and ' + g2);
      ok(g[0] > g2[0] || g[0] < g2[0], 'process gray: and they are not the same grey');
    }
    // the defaults: colour, and the 4000 px cap (this photo's page is under it)
    const d = S.process(img, { quad: q });
    ok(d.w === S.outputSize(q).w, 'process: with no maxDim the page is its own size, got ' + d.w);
  }
  return bad;
}

/* ── run it, then break it ────────────────────────────────────────────────── */

let failed = 0;
// a mutant that makes scan.js throw has failed the check as surely as one that gives a wrong answer
const run = (S, only) => { try { const t0 = Date.now(); const r = check(S, only, !!only); if (process.env.SCAN_TIMING) console.log('   [' + (only || 'all') + ' ' + (Date.now() - t0) + ' ms]'); return r; } catch (e) { return ['threw: ' + e.message]; } };
const real = run(load());
if (real.length) { failed += real.length; real.forEach(m => console.log('  FAIL ' + m)); }
else console.log('  ok  scan.js passes every check');

const MUTANTS = [
  ['gray: weights of red and blue swapped', 'gray', [['299 * d[j] + 587 * d[j + 1] + 114 * d[j + 2]', '114 * d[j] + 587 * d[j + 1] + 299 * d[j + 2]']]],
  ['homography: the v row of the system has a wrong term', 'homography', [['A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);', 'A.push([0, 0, 0, x, y, 1, -v * x, -u * y, v]);']]],
  ['homography: a collinear quad is accepted', 'homography', [['Math.abs(cr) <= 1e-6 * len', 'Math.abs(cr) < 0'], ['if (sign && s !== sign) return false;', ''], ['if (Math.abs(A[piv][i]) < 1e-10) throw new Error(BAD_QUAD);', '']]],
  ['homography: a non-convex quad is accepted', 'homography', [['if (sign && s !== sign) return false;', '']]],
  ['rectify: samples 2.5 px off', 'rectify', [['var fx = sx - 0.5, fy = sy - 0.5;', 'var fx = sx - 3, fy = sy - 3;']]],
  ['rectify: the output rectangle is mirrored', 'rectify', [['[[0, 0], [outW, 0], [outW, outH], [0, outH]], quad', '[[outW, 0], [0, 0], [0, outH], [outW, outH]], quad']]],
  ['rectify: outside the photo is black', 'rectify', [['od[o] = od[o + 1] = od[o + 2] = od[o + 3] = 255;', 'od[o] = od[o + 1] = od[o + 2] = 0; od[o + 3] = 255;']]],
  ['flatten: no white balance (each channel to a fixed target)', 'flatten', [['var target = (mr + mg + mb) / 3 || 1;', 'var target = 128;']]],
  ['flatten: the black point set too low', 'flatten', [['var black = white * p.blackFrac;', 'var black = white * 0.1;']]],
  ['flatten: the local maximum dropped from the map', 'flatten', [['var v = src[(yy * sw + xx) * 3 + c]; if (v > best) best = v;', 'var v = src[(y * sw + x) * 3 + c]; if (v > best) best = v;']]],
  ['threshold: the colours inverted', 'threshold', [['if (g[y * w + x] < mean * (1 + k * (sd / R - 1))) black[y * w + x] = 1;', 'if (g[y * w + x] > mean * (1 + k * (sd / R - 1))) black[y * w + x] = 1;']]],
  ['threshold: the deviation term dropped', 'threshold', [['var sd = variance > 0 ? Math.sqrt(variance) : 0;', 'var sd = 0;']]],
  ['threshold: the sum of squares is a sum', 'threshold', [['rq += v * v;', 'rq += v;']]],
  ['threshold: no despeckle', 'threshold', [['if (near) keep[i] = 1;', 'keep[i] = black[i];']]],
  ['threshold: despeckle eats 2-px strokes', 'threshold', [['if (black[yy * w + xx]) { near = true; break; }', 'if (black[yy * w + xx] && (dx === 0 || dy === 0) && dx + dy > 0) { near = true; break; }']]],
  ['orderCorners: starts at the bottom right', 'order', [['if (s < t || (s === t && p[i][1] < p[start][1])) start = i;', 'if (s > t || (s === t && p[i][1] < p[start][1])) start = i;']]],
  ['downscale: the box is divided by the factor, not its area', 'downscale', [['var out = new Float32Array(w * h), inv = 1 / (f * f * 1000);', 'var out = new Float32Array(w * h), inv = 1 / (f * 1000);']]],
  ['downscale: the scale is not the integer factor', 'downscale', [['return { gray: out, w: w, h: h, scale: f };', 'return { gray: out, w: w, h: h, scale: f + 1 };']]],
  ['detect: the corners are left in loop order', 'detect', [['var quad = orderCorners(corners.map(function (p) {', 'var quad = (corners.map(function (p) {']]],
  ['detect: the downscale factor is forgotten on the way out', 'detect', [['[Math.max(0, Math.min(img.width, p[0] * f)), Math.max(0, Math.min(img.height, p[1] * f))]', '[Math.max(0, Math.min(img.width, p[0] * f * 1.02)), Math.max(0, Math.min(img.height, p[1] * f))]']]],
  ['detect: the edge threshold is far too high', 'detect', [['magFloor: 0.05 ', 'magFloor: 0.6 '], ['pct: 0.7, ', 'pct: 0.99, ']]],
  ['detect: any line is a candidate, however little of the frame it crosses', 'wrong', [['minSpan: 0.30, ', 'minSpan: 0.0, ']]],
  ['detect: the frame cannot stand for a side outside the photo', 'wrong', [['var best = bestQuad(E, cands.concat(frameLines(w, h)), w, h, ref);', 'var best = bestQuad(E, cands, w, h, ref);']]],
  ['detect: a side on the frame costs no confidence', 'wrong', [['(anyFrame ? 0.5 : 1)', '1']]],
  ['detect: the fallback calls itself edges', 'wrong', [["confidence: 0, method: 'fallback', lines: []", "confidence: 0, method: 'edges', lines: []"]]],
  ['detect: the fallback has some confidence', 'wrong', [["confidence: 0, method: 'fallback', lines: []", "confidence: 0.5, method: 'fallback', lines: []"]]],
  ['detect: the fallback frame is not inset', 'wrong', [['var W = img.width, H = img.height, inset = opts.inset === undefined ? 0.04 : opts.inset;', 'var W = img.width, H = img.height, inset = 0;']]],
  ['detect: noise lines are accepted with nothing to pair them (no minimum of three real lines)', 'wrong', [['if (real < 3) continue;', 'if (real < 1) continue;'], ['if (cands[i].frame && cands[j].frame) continue;', ''], ['if (cands.length < 3) return null;', '']]],
  ['refine: does nothing', 'refine', [['for (var pass = 0; pass < 2; pass++) {\n      var lines = [];', 'for (var pass = 0; pass < 0; pass++) {\n      var lines = [];']]],
  ['refine: takes the strongest step, not the nearest', 'refine', [['var dd = Math.abs(j - half);\n        if (dd < pd) { pd = dd; pick = j; }', 'var dd = -D[j];\n        if (dd < pd) { pd = dd; pick = j; }']]],
  ['refine: the page is always taken as brighter than its surroundings', 'refine', [['var pol = polSum >= 0 ? 1 : -1;', 'var pol = 1;']]],
  ['refine: the sub-pixel offset is dropped', 'refine', [['var off = den < 0 ? 0.5 * (y1 - y3) / den : 0;', 'var off = 0;'], ['var sOff = (pick - half + off) * ds;', 'var sOff = Math.round(pick - half + off) * 2;']]],
  ['outputSize: takes the shorter of the opposite sides', 'outputSize', [['var w = Math.max(dist(quad[0], quad[1]), dist(quad[3], quad[2]));', 'var w = Math.min(dist(quad[0], quad[1]), dist(quad[3], quad[2]));']]],
  ['outputSize: the cap is on the width only', 'outputSize', [['var k = Math.max(w, h) > maxDim ? maxDim / Math.max(w, h) : 1;', 'var k = w > maxDim ? maxDim / w : 1;']]],
  ['outputSize: the cap is never applied', 'outputSize', [['var k = Math.max(w, h) > maxDim ? maxDim / Math.max(w, h) : 1;', 'var k = 1;']]],
  ['process: the page is not flattened', 'process', [["var f = flatten(img, 'worksheet');", 'var f = img;']]],
  ['process: black and white skips the threshold', 'process', [['return threshold(f, {});', 'return gray(f);']]],
  ['process: grey is colour', 'process', [['if (mode === \'gray\') return gray(f);', "if (mode === 'gray') return f;"]]],
  ['process: maxDim is ignored', 'process', [['var size = outputSize(opts.quad, { maxDim: opts.maxDim });', 'var size = outputSize(opts.quad, {});']]],
  ['process: cleans the photo and then warps it', 'process', [['var page = rectify(img, opts.quad, size.w, size.h);\n    return { imageData: clean(page, opts.mode || \'color\'), w: size.w, h: size.h };', "var page = rectify(clean(img, opts.mode || 'color'), opts.quad, size.w, size.h);\n    return { imageData: page, w: size.w, h: size.h };"]]],
  ['rectify of the detected quad: the corners are mirrored', 'detected-rectify', [['var quad = orderCorners(corners.map(function (p) {', 'var quad = orderCorners(corners.map(function (p) { p = [img.width - p[0] / f, p[1] / f].map(function (v) { return v * f; });']]],
  ['orderCorners: counter-clockwise', 'order', [['return Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx);', 'return Math.atan2(b[1] - cy, b[0] - cx) - Math.atan2(a[1] - cy, a[0] - cx);']]],
];
for (const [name, section, edit] of MUTANTS) {
  const bad = run(load(edit), section);
  if (bad.length) console.log('  ok  mutant caught: ' + name + '  (first failure: ' + bad[0].slice(0, 70) + ')');
  else { failed++; console.log('  FAIL mutant survived: ' + name); }
}

console.log(failed ? '\n' + failed + ' failed' : '\nall passed');
if (failed) process.exit(1);
