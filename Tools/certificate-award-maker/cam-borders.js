/* Certificate & Award Maker — procedural decorative border frames.
   Each border is drawn as SVG using `currentColor` (inherited from the
   certificate's --accent) so the same four frames work with any theme,
   instead of needing one hand-drawn border per theme/color combination. */
(function (global) {
  'use strict';

  function doubleLine(w, h) {
    var m1 = 14, m2 = 24;
    var corner = [[m2, m2], [w - m2, m2], [w - m2, h - m2], [m2, h - m2]];
    var ticks = corner.map(function (p) {
      return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="5" fill="currentColor"/>';
    }).join('');
    return (
      '<rect x="' + m1 + '" y="' + m1 + '" width="' + (w - 2 * m1) + '" height="' + (h - 2 * m1) +
        '" fill="none" stroke="currentColor" stroke-width="2"/>' +
      '<rect x="' + m2 + '" y="' + m2 + '" width="' + (w - 2 * m2) + '" height="' + (h - 2 * m2) +
        '" fill="none" stroke="currentColor" stroke-width="1"/>' +
      ticks
    );
  }

  function dots(w, h) {
    var m = 18, gap = 26, r = 3.2;
    var pts = [];
    for (var x = m; x <= w - m; x += gap) { pts.push([x, m]); pts.push([x, h - m]); }
    for (var y = m + gap; y < h - m; y += gap) { pts.push([m, y]); pts.push([w - m, y]); }
    return pts.map(function (p) {
      return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + r + '" fill="currentColor"/>';
    }).join('');
  }

  function leafCluster(cx, cy, rot) {
    // A small fan of 3 leaf-shaped ellipses standing in for a laurel sprig.
    var leaves = [-28, 0, 28].map(function (angle) {
      var a = (rot + angle) * Math.PI / 180;
      var lx = cx + Math.cos(a) * 16;
      var ly = cy + Math.sin(a) * 16;
      return '<ellipse cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" rx="10" ry="4.2" ' +
        'fill="currentColor" fill-opacity="0.75" transform="rotate(' + (rot + angle).toFixed(0) + ' ' + lx.toFixed(1) + ' ' + ly.toFixed(1) + ')"/>';
    }).join('');
    return leaves;
  }

  function laurelCorners(w, h) {
    var m = 20;
    return (
      '<rect x="' + m + '" y="' + m + '" width="' + (w - 2 * m) + '" height="' + (h - 2 * m) +
        '" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
      leafCluster(m + 6, m + 6, 45) +
      leafCluster(w - m - 6, m + 6, 135) +
      leafCluster(w - m - 6, h - m - 6, 225) +
      leafCluster(m + 6, h - m - 6, 315)
    );
  }

  function zigzagEdge(x1, y1, x2, y2, amplitude, count) {
    var pts = [];
    for (var i = 0; i <= count; i++) {
      var t = i / count;
      var x = x1 + (x2 - x1) * t;
      var y = y1 + (y2 - y1) * t;
      var perpX = -(y2 - y1), perpY = (x2 - x1);
      var len = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
      var offset = (i % 2 === 0 ? 1 : -1) * amplitude;
      pts.push((x + (perpX / len) * offset).toFixed(1) + ',' + (y + (perpY / len) * offset).toFixed(1));
    }
    return pts.join(' ');
  }

  function zigzag(w, h) {
    var m = 20, amp = 6;
    var topCount = Math.max(6, Math.round((w - 2 * m) / 22));
    var sideCount = Math.max(4, Math.round((h - 2 * m) / 22));
    var top = zigzagEdge(m, m, w - m, m, amp, topCount);
    var bottom = zigzagEdge(m, h - m, w - m, h - m, amp, topCount);
    var left = zigzagEdge(m, m, m, h - m, amp, sideCount);
    var right = zigzagEdge(w - m, m, w - m, h - m, amp, sideCount);
    return [top, bottom, left, right].map(function (pts) {
      return '<polyline points="' + pts + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>';
    }).join('');
  }

  var BORDERS = {
    'double-line': { label: 'Double Line', draw: doubleLine },
    'dots': { label: 'Dotted', draw: dots },
    'laurel': { label: 'Laurel Corners', draw: laurelCorners },
    'zigzag': { label: 'Zigzag', draw: zigzag }
  };

  function borderSvg(styleKey, w, h) {
    var b = BORDERS[styleKey] || BORDERS['double-line'];
    return '<svg class="cert-border" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
      b.draw(w, h) + '</svg>';
  }

  global.CertificateBorders = { BORDERS: BORDERS, borderSvg: borderSvg };
})(window);
