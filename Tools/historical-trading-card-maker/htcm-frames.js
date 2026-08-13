/* htcm-frames.js — procedural decorative card frames for the Historical
   Trading Card Maker, on the model of certificate-award-maker/cam-borders.js:
   every frame is generated SVG stroked with `currentColor` (inherited from
   the card theme's accent), so one drawing works with every theme and prints
   as crisp strokes on any school printer, color or B/W.

   Frames are drawn in a fixed 240 × 336 space (2.5in × 3.5in at CSS 96dpi)
   and stretched with preserveAspectRatio="none", so the same generator
   serves the standard card, the legacy "fill" size, and any future preset.
   They are absolutely positioned overlays — they add zero layout size, which
   the card-geometry test relies on.

   Rarity foil: frameSvg() can swap every `currentColor` for a metallic SVG
   linearGradient (silver / purple / gold). The gradients are defined once,
   in defsSvg(), which the page injects at boot — and the print builder
   injects a second copy inside #printArea, because browsers have historically
   been unreliable about resolving url(#…) references into hidden subtrees at
   print time. On paper the gradients print as smooth metal-gray/tan bands;
   in B/W the *ornateness* of the frame carries the rarity signal instead. */
(function (global) {
  'use strict';

  var W = 240, H = 336; // drawing space: 2.5in × 3.5in at 96px/in

  /* ---- helpers ---- */

  function rect(x, y, w, h, sw) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
      '" fill="none" stroke="currentColor" stroke-width="' + sw + '"/>';
  }

  /* ---- frames ---- */

  function doubleLine(w, h) {
    var m1 = 5, m2 = 11;
    var dots = [[m2, m2], [w - m2, m2], [w - m2, h - m2], [m2, h - m2]].map(function (p) {
      return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.6" fill="currentColor"/>';
    }).join('');
    return rect(m1, m1, w - 2 * m1, h - 2 * m1, 1.8) + rect(m2, m2, w - 2 * m2, h - 2 * m2, 0.9) + dots;
  }

  /* Corner scrollwork: a double arc sweeping into each corner with a curl dot. */
  function filigree(w, h) {
    var m = 6;
    function corner(cx, cy, sx, sy) { // sx/sy: +1 or -1, direction into the card
      var a = 26, b = 15;
      return '<path d="M ' + (cx + sx * a) + ',' + (cy + sy * m) +
        ' Q ' + (cx + sx * m) + ',' + (cy + sy * m) + ' ' + (cx + sx * m) + ',' + (cy + sy * a) +
        '" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
        '<path d="M ' + (cx + sx * a) + ',' + (cy + sy * b) +
        ' Q ' + (cx + sx * b) + ',' + (cy + sy * b) + ' ' + (cx + sx * b) + ',' + (cy + sy * a) +
        '" fill="none" stroke="currentColor" stroke-width="1"/>' +
        '<circle cx="' + (cx + sx * 21) + '" cy="' + (cy + sy * 21) + '" r="2" fill="currentColor"/>';
    }
    return rect(m, m, w - 2 * m, h - 2 * m, 1.2) +
      corner(0, 0, 1, 1) + corner(w, 0, -1, 1) + corner(w, h, -1, -1) + corner(0, h, 1, -1);
  }

  /* A Greek-key (meander) band along the top and bottom edges, plain double
     rails up the sides — a full-perimeter fret gets muddy at card size. */
  function greekKey(w, h) {
    var u = 14, band = 8, m = 6;
    function fret(y, flip) {
      var s = flip ? -1 : 1;
      var d = '';
      for (var x = m + 8; x + u <= w - m - 8; x += u) {
        d += 'M' + x + ',' + (y + s * band) + ' V' + y + ' H' + (x + u - 3) +
          ' V' + (y + s * band * 0.7) + ' H' + (x + 4) + ' V' + (y + s * band * 0.35) + ' H' + (x + u - 6) + ' ';
      }
      return '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.1"/>';
    }
    return rect(m, m, w - 2 * m, h - 2 * m, 1.4) +
      fret(m + 4, false) + fret(h - m - 4, true);
  }

  function leafCluster(cx, cy, rot) {
    return [-30, 0, 30].map(function (angle) {
      var a = (rot + angle) * Math.PI / 180;
      var lx = cx + Math.cos(a) * 11;
      var ly = cy + Math.sin(a) * 11;
      return '<ellipse cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" rx="7" ry="2.9" ' +
        'fill="currentColor" fill-opacity="0.8" transform="rotate(' + (rot + angle).toFixed(0) +
        ' ' + lx.toFixed(1) + ' ' + ly.toFixed(1) + ')"/>';
    }).join('');
  }

  function laurel(w, h) {
    var m = 8;
    return rect(m, m, w - 2 * m, h - 2 * m, 1.2) +
      leafCluster(m + 5, m + 5, 45) +
      leafCluster(w - m - 5, m + 5, 135) +
      leafCluster(w - m - 5, h - m - 5, 225) +
      leafCluster(m + 5, h - m - 5, 315);
  }

  /* Art deco: stepped corners, twin rails, and a sunburst fan at top center. */
  function deco(w, h) {
    var m = 5;
    function step(cx, cy, sx, sy) {
      return '<path d="M ' + (cx + sx * m) + ',' + (cy + sy * 26) +
        ' V ' + (cy + sy * 14) + ' H ' + (cx + sx * 10) +
        ' V ' + (cy + sy * 10) + ' H ' + (cx + sx * 14) +
        ' V ' + (cy + sy * m) + ' H ' + (cx + sx * 26) +
        '" fill="none" stroke="currentColor" stroke-width="1.8"/>';
    }
    var rays = '';
    for (var i = -3; i <= 3; i++) {
      var a = i * 16 * Math.PI / 180;
      rays += '<line x1="' + (w / 2) + '" y1="' + m + '" x2="' + (w / 2 + Math.sin(a) * 18).toFixed(1) +
        '" y2="' + (m + Math.cos(a) * 18).toFixed(1) + '" stroke="currentColor" stroke-width="1"/>';
    }
    return rect(m + 5, m + 5, w - 2 * (m + 5), h - 2 * (m + 5), 0.9) +
      step(0, 0, 1, 1) + step(w, 0, -1, 1) + step(w, h, -1, -1) + step(0, h, 1, -1) + rays;
  }

  /* Sci-fi: notched corner brackets over a dashed rail. */
  function pixel(w, h) {
    var m = 6;
    function bracket(cx, cy, sx, sy) {
      return '<path d="M ' + (cx + sx * m) + ',' + (cy + sy * 28) +
        ' V ' + (cy + sy * m) + ' H ' + (cx + sx * 28) +
        '" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"/>' +
        '<rect x="' + (cx + (sx > 0 ? 12 : -16)) + '" y="' + (cy + (sy > 0 ? 12 : -16)) +
        '" width="4" height="4" fill="currentColor"/>';
    }
    return '<rect x="' + (m + 5) + '" y="' + (m + 5) + '" width="' + (w - 2 * (m + 5)) + '" height="' + (h - 2 * (m + 5)) +
      '" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="7 5"/>' +
      bracket(0, 0, 1, 1) + bracket(w, 0, -1, 1) + bracket(w, h, -1, -1) + bracket(0, h, 1, -1);
  }

  /* Sport: bold angled corner slashes over twin rails. */
  function banner(w, h) {
    var m = 5;
    function slash(cx, cy, sx, sy) {
      return '<path d="M ' + (cx + sx * m) + ',' + (cy + sy * 34) + ' L ' + (cx + sx * 34) + ',' + (cy + sy * m) +
        '" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M ' + (cx + sx * m) + ',' + (cy + sy * 44) + ' L ' + (cx + sx * 44) + ',' + (cy + sy * m) +
        '" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
    }
    return rect(m, m, w - 2 * m, h - 2 * m, 1.6) +
      slash(0, 0, 1, 1) + slash(w, 0, -1, 1) + slash(w, h, -1, -1) + slash(0, h, 1, -1);
  }

  var FRAMES = {
    'plain': { label: 'Plain', draw: null }, // the card's own border is the frame
    'double-line': { label: 'Double line', draw: doubleLine },
    'filigree': { label: 'Filigree corners', draw: filigree },
    'greek-key': { label: 'Greek key', draw: greekKey },
    'laurel': { label: 'Laurel', draw: laurel },
    'deco': { label: 'Art deco', draw: deco },
    'pixel': { label: 'Circuit brackets', draw: pixel },
    'banner': { label: 'Corner slashes', draw: banner }
  };

  /** The frame overlay for one card. gradientId (optional) swaps every
      currentColor for a metallic gradient defined in defsSvg(). */
  function frameSvg(styleKey, gradientId) {
    var f = FRAMES[styleKey] || FRAMES['plain'];
    if (!f.draw) return '';
    var body = f.draw(W, H);
    if (gradientId) body = body.replace(/currentColor/g, 'url(#' + gradientId + ')');
    return '<svg class="card-frame" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
      body + '</svg>';
  }

  /* ---- photo window shapes ----
     Each shape is one generator emitting an SVG path for a w × h box. It has
     two consumers that must never disagree: called with (1, 1) it yields the
     normalized path inside the objectBoundingBox <clipPath> below (CSS
     clip-path: url(#htcm-clip-…) — one definition, any box size), and called
     with real pixel sizes it feeds new Path2D(...) in the canvas exporter and
     the stroked rim overlay. Radii use min(w,h) so corners and circles stay
     round wherever the box isn't square. */

  function n(v) { return Math.round(v * 1000) / 1000; }

  var SHAPE_DRAW = {
    rrect: function (w, h) {
      var r = 0.09 * Math.min(w, h);
      return 'M' + n(r) + ',0 H' + n(w - r) + ' Q' + w + ',0 ' + w + ',' + n(r) +
        ' V' + n(h - r) + ' Q' + w + ',' + h + ' ' + n(w - r) + ',' + h +
        ' H' + n(r) + ' Q0,' + h + ' 0,' + n(h - r) +
        ' V' + n(r) + ' Q0,0 ' + n(r) + ',0 Z';
    },
    oval: function (w, h) {
      return 'M' + n(w / 2) + ',0 A' + n(w / 2) + ',' + n(h / 2) + ' 0 1 1 ' + n(w / 2) + ',' + h +
        ' A' + n(w / 2) + ',' + n(h / 2) + ' 0 1 1 ' + n(w / 2) + ',0 Z';
    },
    circle: function (w, h) { // true circle in a square window; ellipse elsewhere
      return SHAPE_DRAW.oval(w, h);
    },
    hex: function (w, h) {
      return 'M' + n(w * 0.25) + ',0 H' + n(w * 0.75) + ' L' + w + ',' + n(h / 2) +
        ' L' + n(w * 0.75) + ',' + h + ' H' + n(w * 0.25) + ' L0,' + n(h / 2) + ' Z';
    },
    shield: function (w, h) {
      return 'M0,0 H' + w + ' V' + n(h * 0.45) +
        ' C' + w + ',' + n(h * 0.75) + ' ' + n(w * 0.8) + ',' + n(h * 0.92) + ' ' + n(w / 2) + ',' + h +
        ' C' + n(w * 0.2) + ',' + n(h * 0.92) + ' 0,' + n(h * 0.75) + ' 0,' + n(h * 0.45) + ' Z';
    },
    arch: function (w, h) {
      return 'M0,' + h + ' V' + n(h * 0.4) + ' Q0,0 ' + n(w / 2) + ',0 Q' + w + ',0 ' + w + ',' + n(h * 0.4) +
        ' V' + h + ' Z';
    }
  };

  var SHAPES = {
    rrect: { label: 'Rounded' },
    oval: { label: 'Oval' },
    circle: { label: 'Circle' },
    hex: { label: 'Hexagon' },
    shield: { label: 'Shield' },
    arch: { label: 'Arch' }
  };

  function shapePath(key, w, h) {
    var draw = SHAPE_DRAW[key] || SHAPE_DRAW.rrect;
    return draw(w, h);
  }

  function clipDefs() {
    return Object.keys(SHAPE_DRAW).map(function (key) {
      return '<clipPath id="htcm-clip-' + key + '" clipPathUnits="objectBoundingBox">' +
        '<path d="' + shapePath(key, 1, 1) + '"/></clipPath>';
    }).join('');
  }

  function gradient(id, stops) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
      stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"/>'; }).join('') +
      '</linearGradient>';
  }

  /** The inner <defs> markup alone — the canvas exporter inlines it into a
      frame SVG before rasterizing, since a standalone data-URI image can't
      resolve url(#…) refs into the host document. */
  function defsInner() {
    return '<defs>' +
      gradient('htcm-foil-silver', [[0, '#dfe5ea'], [0.35, '#98a2ac'], [0.55, '#eef1f4'], [0.8, '#7e8792'], [1, '#b7bfc7']]) +
      gradient('htcm-foil-purple', [[0, '#c9a6ea'], [0.35, '#6b3fa0'], [0.55, '#e6d4f7'], [0.8, '#55307f'], [1, '#9a6fc4']]) +
      gradient('htcm-foil-gold', [[0, '#f0dc8f'], [0.35, '#b08d2f'], [0.55, '#f7ecc0'], [0.8, '#8a6d1d'], [1, '#d4b354']]) +
      clipDefs() +
      '</defs>';
  }

  /** Shared SVG resources (rarity foil gradients, photo clip shapes).
      Injected once into the page body, and again inside #printArea by the
      print builder — see the header comment. */
  function defsSvg() {
    return '<svg class="htcm-defs" width="0" height="0" style="position:absolute" aria-hidden="true">' +
      defsInner() + '</svg>';
  }

  global.HtcmFrames = {
    W: W, H: H,
    FRAMES: FRAMES,
    SHAPES: SHAPES,
    frameSvg: frameSvg,
    shapePath: shapePath,
    defsInner: defsInner,
    defsSvg: defsSvg
  };
})(window);
