/* scan.js — Scan, the pixel half of 011's scanner mode (Path 17 P2, AI-38).
 *
 * A plain global script that publishes window.Scan: pure functions over typed
 * arrays, no DOM, no storage, no Canvas. An "image" here is anything with
 * { data, width, height }, `data` being RGBA bytes: a browser's ImageData
 * works, and so does the plain object these functions return (wrap it with
 * `new ImageData(img.data, img.width, img.height)` to put it on a canvas). The
 * input is never changed; every function hands back a new image. That is what
 * lets scan.test.mjs load this file with vm.runInContext, as export.test.mjs
 * loads _shared/export.js, and what will let a Worker importScripts() it.
 *
 * Points are [x, y] in continuous pixel coordinates: pixel (i, j) covers
 * [i, i+1) x [j, j+1), so a photo W px wide spans x = 0 to W. A quad is
 * [TL, TR, BR, BL].
 *
 * What is here (the first half of the engine; the detector, outputSize and
 * process are AI-39's):
 *   toGray(img)               Uint8Array, Rec. 601 weights, integer
 *   gray(img)                 the same as an image: three equal channels
 *   homography(src, dst)      Float64Array(9), throws on a quad that is no page
 *   apply(H, [x, y])          the point through the homography
 *   rectify(img, quad, w, h)  the quad pulled flat to w x h, bilinear
 *   flatten(img, preset)      011's enhanceCanvas() on an image (white balance)
 *   threshold(img, opts)      Sauvola, then a despeckle: pure black and white
 *   orderCorners(points)      four points in any order -> TL, TR, BR, BL
 *
 * Order in a finished page is fixed: rectify, flatten, threshold. Rectify
 * first so the window and the illumination map are in page pixels and the
 * desk is gone; flatten before threshold because Sauvola's window is small and
 * a slow gradient across the sheet moves its mean.
 */
(function () {
  'use strict';

  var root = typeof window !== 'undefined' ? window : self;
  var BAD_QUAD = 'Those corners do not make a page';

  function check(img) {
    if (!img || !img.data || !(img.width > 0) || !(img.height > 0) ||
        img.data.length !== img.width * img.height * 4) {
      throw new Error('Scan wants an image with RGBA data, a width and a height');
    }
  }

  function makeImage(w, h) {
    return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
  }

  /* ── grey ───────────────────────────────────────────────────────────────── */

  /** Rec. 601 luma of every pixel, integer, one byte each. */
  function toGray(img) {
    check(img);
    var d = img.data, n = img.width * img.height, out = new Uint8Array(n);
    for (var i = 0, j = 0; i < n; i++, j += 4) {
      out[i] = (299 * d[j] + 587 * d[j + 1] + 114 * d[j + 2] + 500) / 1000 | 0;
    }
    return out;
  }

  /** toGray as an image: R = G = B, alpha 255. */
  function gray(img) {
    var g = toGray(img), out = makeImage(img.width, img.height), o = out.data;
    for (var i = 0, j = 0; i < g.length; i++, j += 4) {
      o[j] = o[j + 1] = o[j + 2] = g[i]; o[j + 3] = 255;
    }
    return out;
  }

  /* ── homography ─────────────────────────────────────────────────────────── */

  /** Four points: no three collinear and the quad convex. Cross products of
   *  the consecutive edges must all have the one sign and none may be a
   *  sliver (sine of the corner under 1e-6). */
  function quadOk(q) {
    if (!q || q.length !== 4) return false;
    var sign = 0;
    for (var i = 0; i < 4; i++) {
      var a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
      if (!a || !b || !c || !isFinite(a[0] + a[1] + b[0] + b[1] + c[0] + c[1])) return false;
      var ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
      var cr = ux * vy - uy * vx;
      var len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
      if (!(len > 0) || Math.abs(cr) <= 1e-6 * len) return false;
      var s = cr > 0 ? 1 : -1;
      if (sign && s !== sign) return false;
      sign = s;
    }
    return true;
  }

  /** Hartley's normalisation of a point set: translate the centroid to the
   *  origin and scale the mean distance to sqrt(2). Solving in these units
   *  keeps the 8 x 8 system well conditioned for coordinates in the thousands. */
  function normaliser(pts) {
    var cx = 0, cy = 0, i;
    for (i = 0; i < 4; i++) { cx += pts[i][0] / 4; cy += pts[i][1] / 4; }
    var m = 0;
    for (i = 0; i < 4; i++) m += Math.sqrt(Math.pow(pts[i][0] - cx, 2) + Math.pow(pts[i][1] - cy, 2)) / 4;
    var s = Math.SQRT2 / m;
    return [s, 0, -s * cx, 0, s, -s * cy, 0, 0, 1];
  }

  function mul(A, B) {
    var C = new Float64Array(9);
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) {
      C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
    }
    return C;
  }

  /** The inverse of a similarity-with-scale normaliser: [s 0 tx; 0 s ty; 0 0 1]. */
  function invNorm(T) {
    var s = T[0];
    return [1 / s, 0, -T[2] / s, 0, 1 / s, -T[5] / s, 0, 0, 1];
  }

  /**
   * The 3 x 3 matrix (row-major, h[8] = 1) taking the four src points to the
   * four dst points: Gaussian elimination with partial pivoting on the 8 x 8
   * system, solved in normalised coordinates and put back. Throws
   * 'Those corners do not make a page' when either quad has three collinear
   * points or is not convex.
   */
  function homography(src, dst) {
    if (!quadOk(src) || !quadOk(dst)) throw new Error(BAD_QUAD);
    var Ts = normaliser(src), Td = normaliser(dst);
    var A = [], i, j, k;
    for (i = 0; i < 4; i++) {
      var x = Ts[0] * src[i][0] + Ts[2], y = Ts[4] * src[i][1] + Ts[5];
      var u = Td[0] * dst[i][0] + Td[2], v = Td[4] * dst[i][1] + Td[5];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
    }
    for (i = 0; i < 8; i++) {
      var piv = i;
      for (j = i + 1; j < 8; j++) if (Math.abs(A[j][i]) > Math.abs(A[piv][i])) piv = j;
      if (Math.abs(A[piv][i]) < 1e-10) throw new Error(BAD_QUAD);
      var t = A[i]; A[i] = A[piv]; A[piv] = t;
      for (j = i + 1; j < 8; j++) {
        var f = A[j][i] / A[i][i];
        if (f) for (k = i; k < 9; k++) A[j][k] -= f * A[i][k];
      }
    }
    var h = new Array(8);
    for (i = 7; i >= 0; i--) {
      var s = A[i][8];
      for (j = i + 1; j < 8; j++) s -= A[i][j] * h[j];
      h[i] = s / A[i][i];
    }
    var Hn = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
    var H = mul(invNorm(Td), mul(Hn, Ts));
    var w = H[8];
    if (!isFinite(w) || w === 0) throw new Error(BAD_QUAD);
    for (i = 0; i < 9; i++) H[i] /= w;
    return H;
  }

  /** [x, y] through a homography. */
  function apply(H, p) {
    var w = H[6] * p[0] + H[7] * p[1] + H[8];
    return [(H[0] * p[0] + H[1] * p[1] + H[2]) / w, (H[3] * p[0] + H[4] * p[1] + H[5]) / w];
  }

  /* ── rectify ────────────────────────────────────────────────────────────── */

  /**
   * Pull `quad` ([TL, TR, BR, BL] in the photo) flat to an outW x outH image:
   * every output pixel centre is sent back through the homography and the
   * photo is sampled there, bilinear. Outside the photo is white. Typed
   * arrays rather than Canvas 2D, which has no perspective.
   */
  function rectify(img, quad, outW, outH) {
    check(img);
    outW = Math.round(outW); outH = Math.round(outH);
    if (!(outW >= 1) || !(outH >= 1)) throw new Error('rectify wants a size of at least 1 x 1');
    var H = homography([[0, 0], [outW, 0], [outW, outH], [0, outH]], quad);
    var W = img.width, Ht = img.height, sd = img.data;
    var out = makeImage(outW, outH), od = out.data;
    var h0 = H[0], h1 = H[1], h2 = H[2], h3 = H[3], h4 = H[4], h5 = H[5], h6 = H[6], h7 = H[7], h8 = H[8];
    var o = 0;
    for (var y = 0; y < outH; y++) {
      var py = y + 0.5;
      for (var x = 0; x < outW; x++, o += 4) {
        var px = x + 0.5;
        var den = h6 * px + h7 * py + h8;
        var sx = (h0 * px + h1 * py + h2) / den, sy = (h3 * px + h4 * py + h5) / den;
        if (!(sx >= 0 && sx <= W && sy >= 0 && sy <= Ht)) {
          od[o] = od[o + 1] = od[o + 2] = od[o + 3] = 255;
          continue;
        }
        var fx = sx - 0.5, fy = sy - 0.5;
        var x0 = Math.floor(fx), y0 = Math.floor(fy);
        var ax = fx - x0, ay = fy - y0;
        var x1 = x0 + 1, y1 = y0 + 1;
        if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0;
        if (x1 > W - 1) x1 = W - 1; if (y1 > Ht - 1) y1 = Ht - 1;
        if (x0 > W - 1) x0 = W - 1; if (y0 > Ht - 1) y0 = Ht - 1;
        var p00 = (y0 * W + x0) * 4, p10 = (y0 * W + x1) * 4, p01 = (y1 * W + x0) * 4, p11 = (y1 * W + x1) * 4;
        var w00 = (1 - ax) * (1 - ay), w10 = ax * (1 - ay), w01 = (1 - ax) * ay, w11 = ax * ay;
        od[o]     = sd[p00] * w00 + sd[p10] * w10 + sd[p01] * w01 + sd[p11] * w11;
        od[o + 1] = sd[p00 + 1] * w00 + sd[p10 + 1] * w10 + sd[p01 + 1] * w01 + sd[p11 + 1] * w11;
        od[o + 2] = sd[p00 + 2] * w00 + sd[p10 + 2] * w10 + sd[p01 + 2] * w01 + sd[p11 + 2] * w11;
        od[o + 3] = 255;
      }
    }
    return out;
  }

  /* ── flatten: 011's enhanceCanvas, on an image ──────────────────────────── */

  /* Tools/011-image-to-pdf.html's ENHANCE_PRESETS, value for value. Its comment
   * there says why each number is what it is. */
  var ENHANCE_PRESETS = {
    whiteboard: { blackFrac: 0.32, whitePct: 0.92 },
    worksheet:  { blackFrac: 0.55, whitePct: 0.90 }
  };

  function percentileFromHistogram(hist, total, pct) {
    var seen = 0, want = total * pct;
    for (var v = 0; v < 256; v++) {
      seen += hist[v];
      if (seen >= want) return v;
    }
    return 255;
  }

  /** The illumination map: the image taken down to about 1/24 in each direction
   *  the way the page's drawImage onto a small canvas does it, which Chromium
   *  answers with a bilinear read at each cell's centre (not an area average:
   *  an average matched the recorded table worse, 10 levels at worst against 4
   *  with this). Rounded to bytes as a canvas holds them. Returns { sw, sh, m }
   *  with m three bytes a cell. */
  function lightMap(img) {
    var w = img.width, h = img.height, d = img.data;
    var sw = Math.max(1, Math.round(w / 24)), sh = Math.max(1, Math.round(h / 24));
    var m = new Uint8Array(sw * sh * 3);
    var cw = w / sw, ch = h / sh;
    for (var j = 0; j < sh; j++) {
      var fy = (j + 0.5) * ch - 0.5;
      var y0 = Math.max(0, Math.min(h - 1, Math.floor(fy))), y1 = Math.min(h - 1, y0 + 1);
      var ay = Math.max(0, fy - y0);
      for (var i = 0; i < sw; i++) {
        var fx = (i + 0.5) * cw - 0.5;
        var x0 = Math.max(0, Math.min(w - 1, Math.floor(fx))), x1 = Math.min(w - 1, x0 + 1);
        var ax = Math.max(0, fx - x0);
        var p00 = (y0 * w + x0) * 4, p10 = (y0 * w + x1) * 4, p01 = (y1 * w + x0) * 4, p11 = (y1 * w + x1) * 4;
        var q = (j * sw + i) * 3;
        for (var c = 0; c < 3; c++) {
          var top = d[p00 + c] * (1 - ax) + d[p10 + c] * ax;
          var bot = d[p01 + c] * (1 - ax) + d[p11 + c] * ax;
          m[q + c] = Math.round(top * (1 - ay) + bot * ay);
        }
      }
    }
    return { sw: sw, sh: sh, m: m };
  }

  /** The map passed through a 3 x 3 local maximum, per channel: the board is
   *  the bright end of any neighbourhood, and a stroke would otherwise darken
   *  the very cells it sits in. */
  function localMax(map) {
    var sw = map.sw, sh = map.sh, src = map.m, out = new Uint8Array(src.length);
    for (var y = 0; y < sh; y++) for (var x = 0; x < sw; x++) for (var c = 0; c < 3; c++) {
      var best = 0;
      for (var dy = -1; dy <= 1; dy++) {
        var yy = y + dy; if (yy < 0 || yy >= sh) continue;
        for (var dx = -1; dx <= 1; dx++) {
          var xx = x + dx; if (xx < 0 || xx >= sw) continue;
          var v = src[(yy * sw + xx) * 3 + c]; if (v > best) best = v;
        }
      }
      out[(y * sw + x) * 3 + c] = best;
    }
    return { sw: sw, sh: sh, m: out };
  }

  /** The map scaled back up to w x h, bilinear with the cell centres on the
   *  pixel grid and the edge cells held, rounded to bytes. */
  function upscale(map, w, h) {
    var sw = map.sw, sh = map.sh, m = map.m, out = new Uint8Array(w * h * 3);
    var xi = new Int32Array(w), xj = new Int32Array(w), xf = new Float64Array(w), x;
    for (x = 0; x < w; x++) {
      var u = (x + 0.5) * sw / w - 0.5;
      if (u < 0) u = 0; else if (u > sw - 1) u = sw - 1;
      var i0 = Math.floor(u);
      xi[x] = i0; xj[x] = Math.min(sw - 1, i0 + 1); xf[x] = u - i0;
    }
    var o = 0;
    for (var y = 0; y < h; y++) {
      var v = (y + 0.5) * sh / h - 0.5;
      if (v < 0) v = 0; else if (v > sh - 1) v = sh - 1;
      var j0 = Math.floor(v), j1 = Math.min(sh - 1, j0 + 1), fy = v - j0;
      for (x = 0; x < w; x++, o += 3) {
        var fx = xf[x];
        var a = (j0 * sw + xi[x]) * 3, b = (j0 * sw + xj[x]) * 3, c = (j1 * sw + xi[x]) * 3, e = (j1 * sw + xj[x]) * 3;
        for (var k = 0; k < 3; k++) {
          var top = m[a + k] + (m[b + k] - m[a + k]) * fx;
          var bot = m[c + k] + (m[e + k] - m[c + k]) * fx;
          out[o + k] = Math.round(top + (bot - top) * fy);
        }
      }
    }
    return out;
  }

  /**
   * Even out the light and set the white and black points. This is 011's
   * enhanceCanvas() with the arithmetic kept: an illumination map at 1/24 with
   * a local maximum, every channel sent to one grey target (which is the white
   * balance), the white point a percentile of the flattened luminance so one
   * glare highlight cannot set it, the black point a fraction of that. `preset`
   * is a key of ENHANCE_PRESETS or an object { blackFrac, whitePct }; anything
   * else returns an unchanged copy, as the page's "off" does.
   *
   * The one thing that is not the page's: the page lets the browser shrink and
   * stretch the map (drawImage), and this file does both itself (a bilinear read
   * at each cell centre, then a bilinear stretch), which differs from Chromium's
   * by a level or so: the recorded table, golden-enhance.json, is Chromium's own
   * output on smoke-enhance.mjs's board, and scan.test.mjs bounds the gap (mean
   * under 1.5, worst under 8). Byte-identical would need the browser.
   */
  function flatten(img, preset) {
    check(img);
    var p = typeof preset === 'string' ? ENHANCE_PRESETS[preset] : preset;
    var w = img.width, h = img.height;
    var out = makeImage(w, h);
    out.data.set(img.data);
    if (!p) return out;

    var bg = upscale(localMax(lightMap(img)), w, h);
    var sd = out.data, n = sd.length, px = n / 4, i, c;

    var mr = 0, mg = 0, mb = 0;
    for (i = 0; i < px; i++) { mr += bg[i * 3]; mg += bg[i * 3 + 1]; mb += bg[i * 3 + 2]; }
    mr = mr / px || 1; mg = mg / px || 1; mb = mb / px || 1;
    var target = (mr + mg + mb) / 3 || 1;

    var hist = new Uint32Array(256);
    var flat = new Float32Array(n);
    for (i = 0; i < px; i++) {
      var q = i * 4, b3 = i * 3;
      var r = sd[q] * target / Math.max(1, bg[b3]);
      var g = sd[q + 1] * target / Math.max(1, bg[b3 + 1]);
      var b = sd[q + 2] * target / Math.max(1, bg[b3 + 2]);
      flat[q] = r; flat[q + 1] = g; flat[q + 2] = b;
      var lum = 0.299 * r + 0.587 * g + 0.114 * b;
      hist[Math.max(0, Math.min(255, Math.round(lum)))]++;
    }
    var white = Math.max(1, percentileFromHistogram(hist, px, p.whitePct));
    var black = white * p.blackFrac;
    var span = Math.max(1, white - black);
    for (i = 0; i < n; i += 4) {
      for (c = 0; c < 3; c++) {
        var val = (flat[i + c] - black) * 255 / span;
        sd[i + c] = val < 0 ? 0 : val > 255 ? 255 : val;
      }
    }
    return out;
  }

  /* ── threshold: Sauvola, then a despeckle ───────────────────────────────── */

  /**
   * Sauvola's adaptive threshold: a pixel is black when it is under
   * T = mean * (1 + k * (sd / R - 1)) of the window around it, the mean and
   * the standard deviation read off integral images of the sums and of the
   * squares. The deviation term is what leaves blank paper blank, where a mean
   * minus a constant would speckle it. Then, unless `despeckle` is false, a
   * black pixel with no black 8-neighbour is whitened; a 2-px stroke has
   * neighbours and stays. Output is three equal channels of 0 or 255, so the
   * embed step can choose PNG.
   *
   * `window` defaults to the long edge / 110 rounded to odd (15 at 1700). A
   * stroke much wider than half the window hollows out (the window inside it
   * has no deviation), which is Sauvola's known cost; page ink is thinner.
   */
  function threshold(img, opts) {
    check(img);
    opts = opts || {};
    var w = img.width, h = img.height;
    var k = opts.k === undefined ? 0.2 : opts.k;
    var R = opts.R === undefined ? 128 : opts.R;
    var win = opts.window === undefined ? Math.round(Math.max(w, h) / 110) : Math.round(opts.window);
    if (win < 3) win = 3;
    if (win % 2 === 0) win += 1;
    var r = (win - 1) / 2;
    var g = toGray(img), n = w * h, i, x, y;

    var stride = w + 1;
    var S = (n * 255 < 4294967296) ? new Uint32Array(stride * (h + 1)) : new Float64Array(stride * (h + 1));
    var Q = new Float64Array(stride * (h + 1));
    for (y = 0; y < h; y++) {
      var rs = 0, rq = 0;
      for (x = 0; x < w; x++) {
        var v = g[y * w + x];
        rs += v; rq += v * v;
        S[(y + 1) * stride + x + 1] = S[y * stride + x + 1] + rs;
        Q[(y + 1) * stride + x + 1] = Q[y * stride + x + 1] + rq;
      }
    }
    var black = new Uint8Array(n);
    for (y = 0; y < h; y++) {
      var ya = y - r < 0 ? 0 : y - r, yb = y + r + 1 > h ? h : y + r + 1;
      for (x = 0; x < w; x++) {
        var xa = x - r < 0 ? 0 : x - r, xb = x + r + 1 > w ? w : x + r + 1;
        var cnt = (xb - xa) * (yb - ya);
        var sum = S[yb * stride + xb] - S[ya * stride + xb] - S[yb * stride + xa] + S[ya * stride + xa];
        var sq = Q[yb * stride + xb] - Q[ya * stride + xb] - Q[yb * stride + xa] + Q[ya * stride + xa];
        var mean = sum / cnt;
        var variance = sq / cnt - mean * mean;
        var sd = variance > 0 ? Math.sqrt(variance) : 0;
        if (g[y * w + x] < mean * (1 + k * (sd / R - 1))) black[y * w + x] = 1;
      }
    }
    if (opts.despeckle !== false) {
      var keep = new Uint8Array(n);
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        i = y * w + x;
        if (!black[i]) continue;
        var near = false;
        for (var dy = -1; dy <= 1 && !near; dy++) {
          var yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (var dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            var xx = x + dx; if (xx < 0 || xx >= w) continue;
            if (black[yy * w + xx]) { near = true; break; }
          }
        }
        if (near) keep[i] = 1;
      }
      black = keep;
    }
    var out = makeImage(w, h), od = out.data;
    for (i = 0; i < n; i++) {
      var val = black[i] ? 0 : 255, j = i * 4;
      od[j] = od[j + 1] = od[j + 2] = val; od[j + 3] = 255;
    }
    return out;
  }

  /* ── orderCorners ───────────────────────────────────────────────────────── */

  /**
   * Four points in any order, back as [TL, TR, BR, BL]: clockwise on the
   * screen (y down) starting from the point nearest the top left, the one
   * with the smallest x + y (a tie goes to the smaller y). A sheet turned a
   * quarter turn is ordered by where its corners are in the photo, not by the
   * sheet's own top, so the page comes out landscape and the rotate button
   * turns it.
   */
  function orderCorners(pts) {
    if (!pts || pts.length !== 4) throw new Error('orderCorners wants four points');
    var cx = 0, cy = 0, i;
    for (i = 0; i < 4; i++) {
      if (!pts[i] || !isFinite(pts[i][0] + pts[i][1])) throw new Error('orderCorners wants four points');
      cx += pts[i][0] / 4; cy += pts[i][1] / 4;
    }
    var p = pts.map(function (q) { return [q[0], q[1]]; });
    p.sort(function (a, b) {
      return Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx);
    });
    var start = 0;
    for (i = 1; i < 4; i++) {
      var s = p[i][0] + p[i][1], t = p[start][0] + p[start][1];
      if (s < t || (s === t && p[i][1] < p[start][1])) start = i;
    }
    return [p[start], p[(start + 1) % 4], p[(start + 2) % 4], p[(start + 3) % 4]];
  }

  root.Scan = {
    toGray: toGray,
    gray: gray,
    homography: homography,
    apply: apply,
    rectify: rectify,
    flatten: flatten,
    threshold: threshold,
    orderCorners: orderCorners,
    ENHANCE_PRESETS: ENHANCE_PRESETS
  };
})();
