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
 * What is here:
 *   toGray(img)               Uint8Array, Rec. 601 weights, integer
 *   gray(img)                 the same as an image: three equal channels
 *   homography(src, dst)      Float64Array(9), throws on a quad that is no page
 *   apply(H, [x, y])          the point through the homography
 *   rectify(img, quad, w, h)  the quad pulled flat to w x h, bilinear
 *   flatten(img, preset)      011's enhanceCanvas() on an image (white balance)
 *   threshold(img, opts)      Sauvola, then a despeckle: pure black and white
 *   orderCorners(points)      four points in any order -> TL, TR, BR, BL
 *   downscale(img, longEdge)  box-filtered grey, an integer factor, for the detector
 *   detect(img, opts)         the page's four corners: { quad, confidence, method, lines }
 *   refine(img, quad, opts)   the corners again, sub-pixel, from lines fitted on a larger grey
 *   outputSize(quad, opts)    the rectified page's size, capped at maxDim
 *   clean(img, mode)          'color' | 'gray' | 'bw': flatten, then grey or threshold
 *   process(img, opts)        rectify, flatten, gray/bw in one call: { imageData, w, h }
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


  /* ── downscale ──────────────────────────────────────────────────────────── */

  /**
   * The picture as luma, shrunk by the integer factor that brings its long edge
   * nearest `longEdge`, each output pixel the mean of a factor x factor box
   * (not drawImage, so Node and the page make the same bytes). Pixel (i, j) of
   * the result covers source [i*scale, (i+1)*scale), so a point in its
   * coordinates times `scale` is a point in the photo's. Returns
   * { gray: Float32Array, w, h, scale }.
   */
  function downscale(img, longEdge) {
    check(img);
    var W = img.width, H = img.height, d = img.data;
    var f = Math.max(1, Math.round(Math.max(W, H) / (longEdge || 480)));
    var w = Math.max(1, Math.floor(W / f)), h = Math.max(1, Math.floor(H / f));
    var out = new Float32Array(w * h), inv = 1 / (f * f * 1000);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var s = 0;
        for (var j = 0; j < f; j++) {
          var p = ((y * f + j) * W + x * f) * 4;
          for (var i = 0; i < f; i++, p += 4) s += 299 * d[p] + 587 * d[p + 1] + 114 * d[p + 2];
        }
        out[y * w + x] = s * inv;
      }
    }
    return { gray: out, w: w, h: h, scale: f };
  }

  /* ── lines ──────────────────────────────────────────────────────────────── */

  /* A line is { nx, ny, c }: the points p with nx*px + ny*py = c, (nx, ny) a unit
   * normal. Angles of lines are the normal's angle folded into [0, PI). */
  var PI = Math.PI;

  function lineAngle(L) {
    var a = Math.atan2(L.ny, L.nx);
    if (a < 0) a += PI;
    if (a >= PI) a -= PI;
    return a;
  }

  /** The smaller angle between two angles of lines, 0 to PI/2. */
  function angleGap(a, b) {
    var d = Math.abs(a - b) % PI;
    return d > PI / 2 ? PI - d : d;
  }

  function intersect(A, B) {
    var det = A.nx * B.ny - A.ny * B.nx;
    if (Math.abs(det) < 1e-9) return null;
    return [(A.c * B.ny - B.c * A.ny) / det, (A.nx * B.c - B.nx * A.c) / det];
  }

  /** Weighted total least squares through the points xs[k], ys[k] (k in `idx`,
   *  or all). Returns a line or null. */
  function fitLine(xs, ys, ws, idx) {
    var n = idx ? idx.length : xs.length, k, i, sw = 0, mx = 0, my = 0;
    for (k = 0; k < n; k++) { i = idx ? idx[k] : k; var w = ws ? ws[i] : 1; sw += w; mx += w * xs[i]; my += w * ys[i]; }
    if (!(sw > 0)) return null;
    mx /= sw; my /= sw;
    var sxx = 0, sxy = 0, syy = 0;
    for (k = 0; k < n; k++) {
      i = idx ? idx[k] : k;
      var wt = ws ? ws[i] : 1, dx = xs[i] - mx, dy = ys[i] - my;
      sxx += wt * dx * dx; sxy += wt * dx * dy; syy += wt * dy * dy;
    }
    var alpha = 0.5 * Math.atan2(2 * sxy, sxx - syy);      // the direction the points spread along
    var nx = -Math.sin(alpha), ny = Math.cos(alpha);
    return { nx: nx, ny: ny, c: nx * mx + ny * my };
  }

  /* ── detect ─────────────────────────────────────────────────────────────── */

  /* The detector's numbers. Starting values from the design, then tuned against
   * the fixtures (scan.test.mjs); HISTORY.md AI-39 says what moved and why. */
  var DET = {
    tolPx: 1.5,          // an edge pixel supports a line within this many px ...
    tolDeg: 15,          // ... and a gradient direction within this many degrees of its normal
    voteDeg: 6,          // a pixel votes for lines within this many degrees of its gradient
    peakFloor: 0.04,     // a Hough peak is a seed when it holds this share of the strongest
    maxPeaks: 400,        // Hough seeds measured, strongest first ...
    keep: 200,            // ... and the best this many lines by span go on to be paired
    minSpan: 0.30,       // a line is a candidate when edge pixels cover this share of the frame's short side
    minGap: 0.25,        // the two sides of a pair are at least this share of the short side apart
    parallelDeg: 20,     // the two sides of a pair are parallel to within this
    squareDeg: 35,       // and the pairs are perpendicular to within this
    minArea: 0.15, maxArea: 0.98,
    minAngle: 55, maxAngle: 125,
    minAspect: 0.45, maxAspect: 2.2,
    voteCap: 3,          // an edge pixel votes with its magnitude, capped at this many times the threshold
    pct: 0.7,            // the edge threshold is this percentile of the magnitude
    magFloor: 0.05       // the edge threshold is the 90th percentile of the magnitude, but not under this share of the strongest
  };

  /** Blur 3 x 3, Sobel, non-maximum suppression along the gradient, threshold.
   *  Returns the thin edge pixels: coordinates of their centres, magnitude and
   *  the angle of the gradient folded into [0, PI), and a dense angle map. */
  function edges(g, w, h) {
    var n = w * h, b = new Float32Array(n), x, y, i;
    for (y = 0; y < h; y++) {
      var y0 = y > 0 ? y - 1 : 0, y1 = y < h - 1 ? y + 1 : h - 1;
      for (x = 0; x < w; x++) {
        var x0 = x > 0 ? x - 1 : 0, x1 = x < w - 1 ? x + 1 : w - 1, s = 0;
        for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) s += g[yy * w + xx];
        b[y * w + x] = s / ((x1 - x0 + 1) * (y1 - y0 + 1));
      }
    }
    var mag = new Float32Array(n), gx = new Float32Array(n), gy = new Float32Array(n), top = 0;
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
      i = y * w + x;
      var dx = (b[i - w + 1] + 2 * b[i + 1] + b[i + w + 1]) - (b[i - w - 1] + 2 * b[i - 1] + b[i + w - 1]);
      var dy = (b[i + w - 1] + 2 * b[i + w] + b[i + w + 1]) - (b[i - w - 1] + 2 * b[i - w] + b[i - w + 1]);
      gx[i] = dx; gy[i] = dy;
      var m = Math.sqrt(dx * dx + dy * dy);
      mag[i] = m; if (m > top) top = m;
    }
    var out = { w: w, h: h, xs: [], ys: [], ms: [], as: [], map: new Int16Array(n).fill(-1), byDeg: [], top: top, thr: 0 };
    for (i = 0; i < 180; i++) out.byDeg.push([]);
    if (!(top > 0)) return out;
    var hist = new Uint32Array(1025), cnt = 0;
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) { hist[Math.min(1024, (mag[y * w + x] / top * 1024) | 0)]++; cnt++; }
    var seen = 0, p90 = 1024;
    for (i = 0; i <= 1024; i++) { seen += hist[i]; if (seen >= cnt * DET.pct) { p90 = i; break; } }
    var thr = Math.max(p90 / 1024 * top, DET.magFloor * top);
    out.thr = thr;
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
      i = y * w + x;
      var mm = mag[i];
      if (mm < thr) continue;
      var a = Math.atan2(gy[i], gx[i]);
      var ox = Math.round(Math.cos(a)), oy = Math.round(Math.sin(a));
      var m1 = mag[i + oy * w + ox], m2 = mag[i - oy * w - ox];
      if (!(mm > m1 && mm >= m2)) continue;
      if (a < 0) a += PI;
      if (a >= PI) a -= PI;
      out.xs.push(x + 0.5); out.ys.push(y + 0.5); out.ms.push(mm); out.as.push(a);
      out.map[i] = Math.round(a * 1800 / PI);               // tenths of a degree
      out.byDeg[Math.min(179, (a * 180 / PI) | 0)].push(out.xs.length - 1);
    }
    return out;
  }

  /** The Hough accumulator, 1 degree by 1 px about the frame's centre, each
   *  edge pixel voting with its magnitude for the lines within voteDeg of its
   *  own gradient direction. Returns the seed lines, strongest first. */
  function houghSeeds(E) {
    var w = E.w, h = E.h, cx = w / 2, cy = h / 2;
    var rmax = Math.ceil(Math.sqrt(w * w + h * h) / 2) + 2, nr = 2 * rmax + 1;
    var V = DET.voteDeg, nt = 180, acc = new Float32Array(nt * nr), t;
    var cs = new Float64Array(nt + 2 * V + 1), sn = new Float64Array(nt + 2 * V + 1);
    for (t = -V; t <= nt + V; t++) { cs[t + V] = Math.cos(t * PI / 180); sn[t + V] = Math.sin(t * PI / 180); }
    var n = E.xs.length, k;
    for (k = 0; k < n; k++) {
      var px = E.xs[k] - cx, py = E.ys[k] - cy, m = Math.min(E.ms[k], DET.voteCap * E.thr);   // a strong edge counts for a few weak ones, not for all of them
      var t0 = Math.round(E.as[k] * 180 / PI);
      for (var u = t0 - V; u <= t0 + V; u++) {
        var r = px * cs[u + V] + py * sn[u + V], tt = u;
        if (tt < 0) { tt += nt; r = -r; } else if (tt >= nt) { tt -= nt; r = -r; }
        acc[tt * nr + Math.round(r) + rmax] += m;
      }
    }
    // an edge that falls between two pixel rows puts its pixels on either side of a bin boundary:
    // sum three neighbouring bins so the line is one peak, not two weak ones
    var sm = new Float32Array(acc.length), top = 0, i;
    for (t = 0; t < nt; t++) for (var r1 = 1; r1 < nr - 1; r1++) {
      var q3 = t * nr + r1;
      sm[q3] = acc[q3 - 1] + acc[q3] + acc[q3 + 1];
      if (sm[q3] > top) top = sm[q3];
    }
    acc = sm;
    if (!(top > 0)) return [];
    var cells = [];
    for (t = 0; t < nt; t++) for (var r2 = 1; r2 < nr - 1; r2++) {
      var v = acc[t * nr + r2];
      if (v < DET.peakFloor * top) continue;
      if (v < acc[t * nr + r2 - 1] || v <= acc[t * nr + r2 + 1]) continue;
      cells.push([v, t, r2 - rmax]);
    }
    cells.sort(function (a, b) { return b[0] - a[0]; });
    var seeds = [];
    for (i = 0; i < cells.length && seeds.length < DET.maxPeaks; i++) {
      var c = cells[i], dup = false;
      for (var j = 0; j < seeds.length; j++) {
        var s = seeds[j], dt = Math.abs(c[1] - s.t);
        if (dt > 90) dt = 180 - dt;
        var rr = (Math.abs(c[1] - s.t) > 90) ? -s.r : s.r;     // same line across the 0 / 180 seam
        if (dt < 6 && Math.abs(c[2] - rr) < 3) { dup = true; break; }
      }
      if (dup) continue;
      seeds.push({ t: c[1], r: c[2], v: c[0] });
    }
    return seeds.map(function (s) {
      var a = s.t * PI / 180, nx = Math.cos(a), ny = Math.sin(a);
      return { nx: nx, ny: ny, c: s.r + nx * cx + ny * cy, votes: s.v };
    });
  }

  /** The line's stretch inside [0, w] x [0, h], as its two end points, or null. */
  function clipToFrame(L, w, h) {
    var dx = -L.ny, dy = L.nx;                                    // direction along the line
    var px = L.nx * L.c, py = L.ny * L.c;                         // the point nearest the origin
    var lo = -1e9, hi = 1e9;
    var lim = function (p, d, size) {
      if (Math.abs(d) < 1e-12) { if (p < 0 || p > size) { lo = 1; hi = 0; } return; }
      var t1 = (0 - p) / d, t2 = (size - p) / d;
      if (t1 > t2) { var t = t1; t1 = t2; t2 = t; }
      if (t1 > lo) lo = t1; if (t2 < hi) hi = t2;
    };
    lim(px, dx, w); lim(py, dy, h);
    if (!(hi > lo)) return null;
    return [[px + dx * lo, py + dy * lo], [px + dx * hi, py + dy * hi]];
  }

  /** How much of the segment A-B has an edge pixel beside it, facing the
   *  line's way: { covered, steps } at one step a pixel. */
  function coverage(E, L, A, B) {
    var len = Math.sqrt(Math.pow(B[0] - A[0], 2) + Math.pow(B[1] - A[1], 2));
    var steps = Math.max(1, Math.floor(len)), covered = 0, w = E.w, h = E.h;
    var la = lineAngle(L), tol = DET.tolDeg * 10;
    for (var k = 0; k < steps; k++) {
      var t = (k + 0.5) / steps, qx = A[0] + (B[0] - A[0]) * t, qy = A[1] + (B[1] - A[1]) * t, hit = false;
      for (var s = -1; s <= 1 && !hit; s++) {
        var x = Math.floor(qx + s * L.nx), y = Math.floor(qy + s * L.ny);
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        var a = E.map[y * w + x];
        if (a < 0) continue;
        var d = Math.abs(a - la * 1800 / PI) % 1800; if (d > 900) d = 1800 - d;
        if (d <= tol) hit = true;
      }
      if (hit) covered++;
    }
    return { covered: covered, steps: steps };
  }

  /** A seed line pulled onto the edge pixels beside it (twice, the second time
   *  from the closer ones), then measured. Returns a candidate or null. */
  function candidate(E, seed, ref) {
    var L = seed, tolDeg = DET.tolDeg * PI / 180;
    for (var pass = 0; pass < 3; pass++) {
      var tol = pass === 0 ? DET.tolPx : 1.0, la = lineAngle(L), idx = [];
      var deg0 = Math.round(la * 180 / PI), span = Math.ceil(DET.tolDeg) + 1;
      for (var bd = deg0 - span; bd <= deg0 + span; bd++) {
        var bucket = E.byDeg[((bd % 180) + 180) % 180];
        for (var bk = 0; bk < bucket.length; bk++) {
          var k = bucket[bk];
          if (Math.abs(L.nx * E.xs[k] + L.ny * E.ys[k] - L.c) > tol) continue;
          if (angleGap(E.as[k], la) > tolDeg) continue;
          idx.push(k);
        }
      }
      if (idx.length < 10) return null;
      var f = fitLine(E.xs, E.ys, E.ms, idx);
      if (!f) return null;
      L = f;
    }
    var seg = clipToFrame(L, E.w, E.h);
    if (!seg) return null;
    var cv = coverage(E, L, seg[0], seg[1]);
    return {
      nx: L.nx, ny: L.ny, c: L.c, a: seg[0], b: seg[1], frame: false,
      covered: cv.covered, frac: cv.covered / cv.steps, span: cv.covered / ref
    };
  }

  function frameLines(w, h) {
    var mk = function (nx, ny, c, a, b) { return { nx: nx, ny: ny, c: c, a: a, b: b, frame: true, covered: 0, frac: 0, span: 0 }; };
    return [
      mk(1, 0, 0, [0, 0], [0, h]), mk(1, 0, w, [w, 0], [w, h]),
      mk(0, 1, 0, [0, 0], [w, 0]), mk(0, 1, h, [0, h], [w, h])
    ];
  }

  function dist(p, q) { return Math.sqrt(Math.pow(p[0] - q[0], 2) + Math.pow(p[1] - q[1], 2)); }

  /** Four corners, in loop order, to a verdict: the area as a share of the frame
   *  or 0 when the quad is not a plausible page. */
  function plausible(q, w, h) {
    var i, sign = 0, area = 0, mx = 0.03 * w, my = 0.03 * h;
    for (i = 0; i < 4; i++) {
      var a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
      if (a[0] < -mx || a[0] > w + mx || a[1] < -my || a[1] > h + my) return 0;
      var ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
      var cr = ux * vy - uy * vx, lu = Math.sqrt(ux * ux + uy * uy), lv = Math.sqrt(vx * vx + vy * vy);
      if (!(lu > 0 && lv > 0)) return 0;
      var s = cr > 0 ? 1 : -1;
      if (sign && s !== sign) return 0;
      sign = s;
      var ang = Math.acos(Math.max(-1, Math.min(1, -(ux * vx + uy * vy) / (lu * lv)))) * 180 / PI;
      if (ang < DET.minAngle || ang > DET.maxAngle) return 0;
      area += a[0] * b[1] - b[0] * a[1];
    }
    area = Math.abs(area) / 2 / (w * h);
    if (area < DET.minArea || area > DET.maxArea) return 0;
    var wd = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2, ht = (dist(q[1], q[2]) + dist(q[0], q[3])) / 2;
    var asp = wd / ht;
    if (!(asp >= DET.minAspect && asp <= DET.maxAspect)) return 0;
    return area;
  }

  /** For a quad in loop order with its four lines (side i runs corner i to corner i+1): { covered,
   *  steps } per side along the stretch inside the frame, zero for a side taken from the frame. */
  function sideFracs(E, corners, sides) {
    var out = [], w = E.w, h = E.h;
    for (var i = 0; i < 4; i++) {
      var L = sides[i];
      if (L.frame) { out.push({ covered: 0, steps: 1 }); continue; }
      var A = corners[i], B = corners[(i + 1) % 4];
      var cv = coverage(E, L, [Math.max(0, Math.min(w, A[0])), Math.max(0, Math.min(h, A[1]))],
                              [Math.max(0, Math.min(w, B[0])), Math.max(0, Math.min(h, B[1]))]);
      out.push({ covered: cv.covered, steps: cv.steps });
    }
    return out;
  }

  /** The best plausible quad out of the candidates (and the frame's own four
   *  sides, which stand in for a side that is outside the photo). */
  function bestQuad(E, cands, w, h, ref) {
    var n = cands.length, i, j, pairs = [];
    var ang = cands.map(lineAngle);
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      if (cands[i].frame && cands[j].frame) continue;
      if (angleGap(ang[i], ang[j]) > DET.parallelDeg * PI / 180) continue;
      var A = cands[i], B = cands[j];
      var mid = [(B.a[0] + B.b[0]) / 2, (B.a[1] + B.b[1]) / 2];
      if (Math.abs(A.nx * mid[0] + A.ny * mid[1] - A.c) < DET.minGap * ref) continue;
      pairs.push([i, j]);
    }
    // pairs in 5-degree bins of their direction, so a pair is only set against the pairs roughly square to it
    var NB = 36, bins = [], bi;
    for (bi = 0; bi < NB; bi++) bins.push([]);
    for (i = 0; i < pairs.length; i++) {
      // the mean direction of two lines, which can straddle 0 / PI: average the doubled angles
      var a1 = ang[pairs[i][0]], a2 = ang[pairs[i][1]];
      var pa = 0.5 * Math.atan2(Math.sin(2 * a1) + Math.sin(2 * a2), Math.cos(2 * a1) + Math.cos(2 * a2));
      pa = ((pa % PI) + PI) % PI;
      pairs[i].push(pa);
      bins[Math.min(NB - 1, Math.floor(pa / PI * NB))].push(i);
    }
    var best = null, found = [], sqLo = (90 - DET.squareDeg) * PI / 180, sqHi = (90 + DET.squareDeg) * PI / 180;
    for (var p = 0; p < pairs.length; p++) {
      var P = pairs[p], lo = P[2] + sqLo, hi = P[2] + sqHi;
      for (var bb = Math.floor(lo / PI * NB) - 1; bb <= Math.ceil(hi / PI * NB) + 1; bb++) {
        var list = bins[((bb % NB) + NB) % NB];
        for (var li = 0; li < list.length; li++) {
      var q = list[li];
      if (q <= p) continue;
      var Q = pairs[q];
      if (angleGap(ang[P[0]], ang[Q[0]]) < sqLo) continue;
      var a = cands[P[0]], b = cands[P[1]], c = cands[Q[0]], d = cands[Q[1]];
      var real = !a.frame + !b.frame + !c.frame + !d.frame;
      if (real < 3) continue;
      var k1 = intersect(a, c), k2 = intersect(a, d), k3 = intersect(b, d), k4 = intersect(b, c);
      if (!k1 || !k2 || !k3 || !k4) continue;
      var quad = [k1, k2, k3, k4], area = plausible(quad, w, h);
      if (!area) continue;
      // a quad with a side taken from the frame only stands when no four-line quad does: the
      // frame's own sides enclose the most area and would otherwise win every time (real: 3, below)
      found.push({ quad: quad, sides: [a, d, b, c], area: area, real: real });
        }
      }
    }
    // The line-level score cannot tell a side of the sheet from a line that merely crosses it, so the
    // best few are scored again on what lies between their own corners: how many pixels of each side
    // have an edge beside them. A side taken from the frame has none.
    // Best first by an upper bound (every pixel of every real side covered), and stop when no
    // quad left could beat the one in hand: the answer is the exact best, found without scoring all.
    var m, z2;
    for (m = 0; m < found.length; m++) {
      var g = found[m], ub = 0;
      for (z2 = 0; z2 < 4; z2++) if (!g.sides[z2].frame) ub += dist(g.quad[z2], g.quad[(z2 + 1) % 4]);
      g.bound = ub * g.area + (g.real === 4 ? 1e9 : 0);
    }
    found.sort(function (u, v) { return v.bound - u.bound; });
    for (m = 0; m < found.length; m++) {
      var f = found[m];
      if (best && f.bound <= best.score) break;
      f.fracs = sideFracs(E, f.quad, f.sides);
      var sumPx = 0;
      for (z2 = 0; z2 < 4; z2++) sumPx += f.fracs[z2].covered;
      f.score = sumPx * f.area + (f.real === 4 ? 1e9 : 0);
      if (!best || f.score > best.score) best = f;
    }
    return best;
  }

  function detectEdges(img, longEdge) {
    var d = downscale(img, longEdge), w = d.w, h = d.h, f = d.scale;
    if (w < 16 || h < 16) return null;
    var E = edges(d.gray, w, h);
    if (E.xs.length < 40) return null;
    var ref = Math.min(w, h), seeds = houghSeeds(E), cands = [], i, j;
    for (i = 0; i < seeds.length; i++) {
      // a sheet's edge and the thick line printed just inside it can be two pixels apart here, and
      // one Hough peak then sits between them: try the seed where it is and a little either side
      var offs = [0, -2, 2];
      for (var oi = 0; oi < offs.length; oi++) {
        var off = offs[oi];
        var sd = seeds[i], moved = off ? { nx: sd.nx, ny: sd.ny, c: sd.c + off, votes: sd.votes } : sd;
        var c = candidate(E, moved, ref);
        if (!c || c.span < DET.minSpan) continue;
        var ca = lineAngle(c), dup = false;
        for (j = 0; j < cands.length; j++) {
          if (angleGap(ca, lineAngle(cands[j])) < 4 * PI / 180 &&
              Math.abs(c.nx * ((cands[j].a[0] + cands[j].b[0]) / 2) + c.ny * ((cands[j].a[1] + cands[j].b[1]) / 2) - c.c) < 1.2) {
            if (c.span > cands[j].span) cands[j] = c;
            dup = true; break;
          }
        }
        if (!dup) cands.push(c);
      }
    }
    if (cands.length < 3) return null;
    cands.sort(function (u, v) { return v.span - u.span; });
    if (cands.length > DET.keep) cands.length = DET.keep;
    var best = bestQuad(E, cands.concat(frameLines(w, h)), w, h, ref);
    if (!best) return null;
    // confidence: how much of each side has an edge beside it, a side on the frame counting for nothing, halved if any is
    var corners = best.quad, sum = 0, anyFrame = false, lines = [];
    for (i = 0; i < 4; i++) {
      var L = best.sides[i];
      if (L.frame) anyFrame = true;
      sum += best.fracs[i].covered / best.fracs[i].steps;
      lines.push({ theta: lineAngle(L) * 180 / PI, rho: (L.c - (L.nx * w / 2 + L.ny * h / 2)) * f, support: best.fracs[i].covered * f, frame: !!L.frame });
    }
    var confidence = Math.max(0, Math.min(1, sum / 4 * (anyFrame ? 0.5 : 1)));
    var quad = orderCorners(corners.map(function (p) {
      return [Math.max(0, Math.min(img.width, p[0] * f)), Math.max(0, Math.min(img.height, p[1] * f))];
    }));
    return { quad: quad, confidence: confidence, method: 'edges', lines: lines };
  }

  /**
   * The page's four corners in the photo, [TL, TR, BR, BL] in source px, from
   * the strong straight edges of a `longEdge`-px grey. Never throws on a
   * picture: a frame with no page in it gives the frame inset by `inset` at
   * confidence 0 and method 'fallback', so the handles still appear and the
   * teacher drags them. `confidence` is 0 to 1; the page flags under 0.6.
   */
  function detect(img, opts) {
    check(img);
    opts = opts || {};
    var W = img.width, H = img.height, inset = opts.inset === undefined ? 0.04 : opts.inset;
    var r = null;
    try { r = detectEdges(img, opts.longEdge || 480); } catch (e) { r = null; }
    if (r) return r;
    return {
      quad: [[inset * W, inset * H], [(1 - inset) * W, inset * H], [(1 - inset) * W, (1 - inset) * H], [inset * W, (1 - inset) * H]],
      confidence: 0, method: 'fallback', lines: []
    };
  }

  /* ── refine ─────────────────────────────────────────────────────────────── */

  function bilinear(g, gw, gh, x, y) {
    var fx = x - 0.5, fy = y - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy);
    if (x0 < 0 || y0 < 0 || x0 + 1 > gw - 1 || y0 + 1 > gh - 1) return NaN;
    var ax = fx - x0, ay = fy - y0, i = y0 * gw + x0;
    return (g[i] * (1 - ax) + g[i + 1] * ax) * (1 - ay) + (g[i + gw] * (1 - ax) + g[i + gw + 1] * ax) * ay;
  }

  /** The profile across a side at position (cx, cy): the mean of five short parallel reads at each
   *  of `size` offsets of `ds` px about the coarse line, along the unit normal (nx, ny). Fills `I`
   *  and returns false when a read leaves the picture. */
  function profile(g, gw, gh, cx, cy, dx, dy, nx, ny, half, ds, I) {
    var size = 2 * half + 1;
    for (var j = 0; j < size; j++) {
      var s = (j - half) * ds, sum = 0;
      for (var u = -2; u <= 2; u++) {
        var v = bilinear(g, gw, gh, cx + u * 1.5 * dx + s * nx, cy + u * 1.5 * dy + s * ny);
        if (v !== v) return false;
        sum += v;
      }
      I[j] = sum / 5;
    }
    return true;
  }

  /** Which way the page is brighter than what is outside it, summed over one side: positive when the
   *  inside (the way (nx, ny) points) is brighter. Read 1.5 px either side of the coarse line, which
   *  is closer than any line printed inside the edge. */
  function sidePolarity(g, gw, gh, P, Q, nx, ny) {
    var sum = 0;
    for (var k = 0; k < 40; k++) {
      var t = 0.1 + 0.8 * (k + 0.5) / 40, cx = P[0] + (Q[0] - P[0]) * t, cy = P[1] + (Q[1] - P[1]) * t;
      var a = bilinear(g, gw, gh, cx + 1.5 * nx, cy + 1.5 * ny), b = bilinear(g, gw, gh, cx - 1.5 * nx, cy - 1.5 * ny);
      if (a === a && b === b) sum += a - b;
    }
    return sum;
  }

  /** One side of the quad refitted: along it, each profile across it (a mean of five short parallel
   *  reads) has its steps found to a fraction of a pixel, and the one taken is the nearest to the coarse
   *  line of the steps in the page's own direction (`pol`: +1 inside brighter, -1 darker) that are not
   *  weak beside the strongest, so a thick line printed inside the sheet's edge, a much stronger step
   *  a few pixels further in, cannot pull the side onto itself. A robust line is then fitted through the steps. Returns a line, or the one
   *  it was given when too few positions had an edge (a side on the frame, a side the photo cuts
   *  off). Grey coordinates throughout; (nx, ny) points inward. */
  function refineSide(g, gw, gh, P, Q, band, nx, ny, pol) {
    var len = dist(P, Q);
    var line0 = { nx: nx, ny: ny, c: nx * P[0] + ny * P[1] };
    var dx = (Q[0] - P[0]) / len, dy = (Q[1] - P[1]) / len;
    var n = Math.max(24, Math.min(300, Math.round(len / 2)));
    var xs = [], ys = [], tried = 0, ds = 0.5, half = Math.round((band + 1) / ds), size = 2 * half + 1;
    var I = new Float64Array(size), D = new Float64Array(size);
    for (var k = 0; k < n; k++) {
      var t = 0.1 + 0.8 * (k + 0.5) / n, cx = P[0] + (Q[0] - P[0]) * t, cy = P[1] + (Q[1] - P[1]) * t, j;
      if (!profile(g, gw, gh, cx, cy, dx, dy, nx, ny, half, ds, I)) continue;
      tried++;
      var pick = -1, pd = 1e9, top = 0;
      for (j = 1; j < size - 1; j++) { D[j] = pol * (I[j + 1] - I[j - 1]); if (D[j] > top) top = D[j]; }
      var floor = Math.max(REFINE_MIN_STEP, REFINE_REL * top);
      for (j = 2; j < size - 2; j++) {
        if (D[j] < floor || D[j] < D[j - 1] || D[j] <= D[j + 1]) continue;
        var dd = Math.abs(j - half);
        if (dd < pd) { pd = dd; pick = j; }
      }
      if (pick < 0) continue;
      var y1 = D[pick - 1], y2 = D[pick], y3 = D[pick + 1], den = y1 - 2 * y2 + y3;
      var off = den < 0 ? 0.5 * (y1 - y3) / den : 0;
      var sOff = (pick - half + off) * ds;
      xs.push(cx + sOff * nx); ys.push(cy + sOff * ny);
    }
    if (tried < 8 || xs.length < 8 || xs.length < 0.35 * tried) return line0;
    var idx = xs.map(function (_, i) { return i; }), L = fitLine(xs, ys, null, idx);
    for (var it = 0; it < 3 && L; it++) {
      var res = idx.map(function (i) { return Math.abs(L.nx * xs[i] + L.ny * ys[i] - L.c); });
      var sorted = res.slice().sort(function (a, b) { return a - b; });
      var cut = Math.max(0.75, 2.5 * sorted[sorted.length >> 1]);
      var keep = idx.filter(function (_, m) { return res[m] <= cut; });
      if (keep.length < 8 || keep.length === idx.length) break;
      idx = keep; L = fitLine(xs, ys, null, idx);
    }
    if (!L) return line0;
    if (L.nx * nx + L.ny * ny < 0) { L.nx = -L.nx; L.ny = -L.ny; L.c = -L.c; }
    return L;
  }

  var REFINE_MIN_STEP = 6;     // a step in the grey (levels over one pixel) smaller than this is noise
  var REFINE_REL = 0.1;        // ... and so is one under this share of the strongest step in its profile

  /**
   * The four lines fitted again on a `longEdge`-px grey (1024 by default), each
   * within `band` px of the coarse one, twice (the second band half the first,
   * round the first answer), and the corners taken from the new intersections.
   * Sub-pixel; the coarse step alone is only as good as its downscale factor.
   * A side that has no edge to fit (it lies on the frame) is left where it was.
   * Throws 'Those corners do not make a page' on a quad that is none.
   */
  function refine(img, quad, opts) {
    check(img);
    if (!quadOk(quad)) throw new Error(BAD_QUAD);
    opts = opts || {};
    var d = downscale(img, opts.longEdge || 1024), f = d.scale, band = opts.band || 12;
    var q = quad.map(function (p) { return [p[0] / f, p[1] / f]; });
    // which way is inward on each side, and whether the page is brighter or darker than its surroundings
    var turn = 0, i;
    for (i = 0; i < 4; i++) { var u = q[i], v = q[(i + 1) % 4]; turn += u[0] * v[1] - v[0] * u[1]; }
    var inward = turn > 0 ? 1 : -1, polSum = 0, nrm = [];
    for (i = 0; i < 4; i++) {
      var A = q[i], B = q[(i + 1) % 4], ln = dist(A, B);
      nrm.push([-(B[1] - A[1]) / ln * inward, (B[0] - A[0]) / ln * inward]);
      polSum += sidePolarity(d.gray, d.w, d.h, A, B, nrm[i][0], nrm[i][1]);
    }
    var pol = polSum >= 0 ? 1 : -1;
    for (var pass = 0; pass < 2; pass++) {
      var lines = [];
      for (i = 0; i < 4; i++) lines.push(refineSide(d.gray, d.w, d.h, q[i], q[(i + 1) % 4], pass === 0 ? band : band / 2, nrm[i][0], nrm[i][1], pol));
      var next = [];
      for (var c = 0; c < 4; c++) {
        var p = intersect(lines[(c + 3) % 4], lines[c]);
        if (!p || dist(p, q[c]) > band * 2) return quad.map(function (v) { return [v[0], v[1]]; });
        next.push(p);
      }
      if (!quadOk(next)) return quad.map(function (v) { return [v[0], v[1]]; });
      q = next;
      for (i = 0; i < 4; i++) {
        var A2 = q[i], B2 = q[(i + 1) % 4], ln2 = dist(A2, B2);
        nrm[i] = [-(B2[1] - A2[1]) / ln2 * inward, (B2[0] - A2[0]) / ln2 * inward];
      }
    }
    return q.map(function (p) { return [p[0] * f, p[1] * f]; });
  }

  /* ── outputSize, clean, process ─────────────────────────────────────────── */

  /**
   * The page's size in px once pulled flat: each way the longer of the two
   * opposite sides (the near side of a keystoned sheet is the one that was not
   * foreshortened), then the long edge capped at `maxDim` (4000 when none is
   * given). Never under 1.
   */
  function outputSize(quad, opts) {
    if (!quadOk(quad)) throw new Error(BAD_QUAD);
    var maxDim = opts && opts.maxDim > 0 ? opts.maxDim : 4000;
    var w = Math.max(dist(quad[0], quad[1]), dist(quad[3], quad[2]));
    var h = Math.max(dist(quad[0], quad[3]), dist(quad[1], quad[2]));
    var k = Math.max(w, h) > maxDim ? maxDim / Math.max(w, h) : 1;
    return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
  }

  /** `mode`: 'color' (flatten, the worksheet preset), 'gray' (flatten, then
   *  grey in three channels) or 'bw' (flatten, then threshold). */
  function clean(img, mode) {
    if (mode !== 'color' && mode !== 'gray' && mode !== 'bw') throw new Error("Scan mode must be 'color', 'gray' or 'bw'");
    var f = flatten(img, 'worksheet');
    if (mode === 'color') return f;
    if (mode === 'gray') return gray(f);
    return threshold(f, {});
  }

  /** Rectify, flatten, then grey or threshold: the Worker's one job.
   *  Returns { imageData, w, h }. */
  function process(img, opts) {
    opts = opts || {};
    var size = outputSize(opts.quad, { maxDim: opts.maxDim });
    var page = rectify(img, opts.quad, size.w, size.h);
    return { imageData: clean(page, opts.mode || 'color'), w: size.w, h: size.h };
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
    downscale: downscale,
    detect: detect,
    refine: refine,
    outputSize: outputSize,
    clean: clean,
    process: process,
    ENHANCE_PRESETS: ENHANCE_PRESETS
  };
})();
