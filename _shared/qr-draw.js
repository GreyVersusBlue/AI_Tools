/* qr-draw.js — the one QR canvas renderer, and the measured payload budget.
   Path 6 P1. `window.QrDraw`, a plain global script like state-link.js.

   Twelve files carried their own copy of the same ~30-line loop over the
   vendored encoder (_shared/vendor/qrcode/qrcode.js, which must be loaded
   first — it is the ENCODER; _shared/vendor/jsqr/ is the decoder). They
   disagreed in exactly the ways that break a scan:

   - Most drew each module at `(quiet + c) * px` with px = size / total, a
     FRACTIONAL width, and filled `px` or `ceil(px) + 1` — so at ~100 modules
     the antialiased seams between cells are wide enough that a decoder
     cannot find the module grid at all. classroom-timer/ct-mirror.js found
     this the hard way on its pairing codes and rounded each edge; the other
     eleven never got the fix. Here every module is an INTEGER number of
     device pixels, always, and the canvas takes whatever size that implies.

   - None had a budget. The four share tools (028, 050, 056, 064) draw a QR
     up to the encoder's own limit — version 40, 177 modules — and say "too
     long" only when it throws past 2,953 bytes. A version-40 code shown at
     264 CSS px is 1.4 px per module. Nobody's phone reads that; the tool just
     looks broken. The budget below says no earlier, and says why.

   THE BUDGET IS MEASURED, NOT GUESSED. Tools/share/test/qr-draw.test.mjs
   renders codes of every version through this exact loop, blurs them the way
   a camera does, and decodes them with the vendored jsQR: at 2 px per module
   nothing decodes; at 3 it decodes clean but fails under heavier blur; at 4
   it holds through every blur tried. So MIN_PX_PER_MODULE is 4 CSS px, and
   the largest code that fits a given display size follows from that:

       max modules  =  floor(displayPx / 4) - 2 * QUIET
       so a 480 px sheet takes up to version 23 (~1.1 KB at level L)
       and a 320 px one up to version 13 (~425 bytes)

   plan() reports that as {ok:false, reason} instead of drawing, and
   share.js greys its QR row out and prints the reason. The suite asserts
   MIN_PX_PER_MODULE against its own measurement, so raising the budget past
   what the decoder can read fails the build.

   Level L throughout, like every copy this replaces: a code shown on a
   screen is not going to be creased or smudged, and L is 25-30% more
   capacity than M at the same module count. */
(function (global) {
  'use strict';

  var QUIET = 4;                 // the standard quiet zone, in modules
  var MIN_PX_PER_MODULE = 4;     // CSS px; see the header and the suite
  var DEFAULT_LEVEL = 'L';
  var DEFAULT_FG = '#16222e';
  var DEFAULT_BG = '#ffffff';

  function byteLength(text) {
    text = String(text == null ? '' : text);
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).length;
    return unescape(encodeURIComponent(text)).length;
  }

  /** Encodes `text` at the smallest version that fits. null past version 40. */
  function encode(text, level) {
    var qrcode = global.qrcode;
    if (typeof qrcode !== 'function') throw new Error('qr-draw.js needs _shared/vendor/qrcode/qrcode.js loaded first');
    try {
      var qr = qrcode(0, level || DEFAULT_LEVEL);
      qr.addData(String(text == null ? '' : text));
      qr.make();
      return qr;
    } catch (e) {
      return null; // the encoder throws 'code length overflow' past version 40
    }
  }

  /**
   * Decides how a code for `text` would render, without drawing it.
   *
   *   opts.maxPx   — the CSS px the caller can show it at (the sheet's width);
   *                  the code gets floor(maxPx / total) px per module, and
   *                  ok:false below MIN_PX_PER_MODULE.
   *   opts.px      — a fixed CSS px per module instead (print, pairing codes);
   *                  no budget applies, ok:false only past version 40.
   *   opts.minPx   — override MIN_PX_PER_MODULE (tests).
   *   opts.level   — 'L' (default), 'M', 'Q', 'H'.
   *
   * Returns { ok, version, modules, total, px, cssSize, bytes, reason }.
   * `reason` is teacher-facing and only set when ok is false.
   */
  function plan(text, opts) {
    opts = opts || {};
    var bytes = byteLength(text);
    var qr = encode(text, opts.level);
    if (!qr) {
      return { ok: false, version: null, modules: null, total: null, px: 0, cssSize: 0, bytes: bytes,
        reason: 'This is ' + kb(bytes) + ' of link, more than any QR code can hold (about 2.9 KB). Copy the link or download the file instead.' };
    }
    var modules = qr.getModuleCount();
    var version = (modules - 17) / 4;
    var total = modules + QUIET * 2;
    var px;
    if (opts.px) {
      px = Math.max(1, Math.round(opts.px));
    } else {
      var maxPx = opts.maxPx || 0;
      px = Math.floor(maxPx / total);
      var minPx = opts.minPx || MIN_PX_PER_MODULE;
      if (px < minPx) {
        var need = total * minPx;
        return { ok: false, version: version, modules: modules, total: total, px: px, cssSize: px * total, bytes: bytes,
          reason: 'A code for ' + kb(bytes) + ' of link is ' + modules + ' modules across. At this size that is under ' + minPx +
            ' px per module, which phones cannot read reliably (it would need ' + need + ' px). Copy the link or download the file instead.' };
      }
    }
    return { ok: true, version: version, modules: modules, total: total, px: px, cssSize: px * total, bytes: bytes, reason: '', _qr: qr };
  }

  /**
   * Draws `text` into `canvas`. Same options as plan(), plus opts.fg / opts.bg
   * and opts.dpr (defaults to devicePixelRatio, so the module edges land on
   * device pixels on a 2x screen too; the canvas is sized in device px and
   * its style in CSS px). Returns the plan; on ok:false the canvas is
   * untouched. Never throws for a bad payload.
   */
  function draw(canvas, text, opts) {
    opts = opts || {};
    var p = plan(text, opts);
    if (!p.ok) return p;
    var qr = p._qr;
    delete p._qr;
    var dpr = opts.dpr || (global.devicePixelRatio && global.devicePixelRatio > 1 ? Math.round(global.devicePixelRatio) : 1);
    var devPx = p.px * dpr;
    var size = p.total * devPx;
    canvas.width = size;
    canvas.height = size;
    if (canvas.style) {
      canvas.style.width = p.cssSize + 'px';
      canvas.style.height = p.cssSize + 'px';
    }
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = opts.bg || DEFAULT_BG;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = opts.fg || DEFAULT_FG;
    var n = p.modules;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) ctx.fillRect((QUIET + c) * devPx, (QUIET + r) * devPx, devPx, devPx);
      }
    }
    p.devicePx = devPx;
    p.size = size;
    return p;
  }

  /** The module grid as an array of rows of booleans — what the suite decodes. */
  function modulesOf(text, level) {
    var qr = encode(text, level);
    if (!qr) return null;
    var n = qr.getModuleCount(), rows = [];
    for (var r = 0; r < n; r++) {
      var row = [];
      for (var c = 0; c < n; c++) row.push(qr.isDark(r, c));
      rows.push(row);
    }
    return rows;
  }

  function kb(bytes) {
    return bytes < 1024 ? bytes + ' bytes' : (Math.round(bytes / 102.4) / 10) + ' KB';
  }

  global.QrDraw = {
    QUIET: QUIET,
    MIN_PX_PER_MODULE: MIN_PX_PER_MODULE,
    DEFAULT_LEVEL: DEFAULT_LEVEL,
    byteLength: byteLength,
    encode: encode,
    plan: plan,
    draw: draw,
    modulesOf: modulesOf
  };
})(window);
