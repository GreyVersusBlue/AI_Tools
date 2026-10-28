/* dcb-fit.js — the curve fits behind 038's scatter chart (Path 16 P5, step 1). Pure: no DOM, no storage.
   A plain global script publishing window.ChartFit, so the page loads it with a <script> tag and
   dcb-fit.test.mjs loads it with vm.runInContext.

     ChartFit.MODELS                      [{ id, name, shape }] in the order the page lists them
     ChartFit.fit(id, points)             points: [{ x, y }]  ->  null, or
        { model, n, used, left: [{ x, y, why }], a, b, c, predict(x), r2, equation, label, desc, note }

   Every model is fitted by least squares; power, exponential and logarithmic are fitted on the
   transformed data (ln y against ln x, and so on), which is the way a spreadsheet's trendline does it
   and the note says so. **R² is always computed on the original y**: 1 - SSres/SStot, with the model's own
   predictions, so two models are comparable on one number (a power fit's R² on the log-log line would
   flatter it). A point a model cannot take (x <= 0 for power and logarithmic, y <= 0 for power and
   exponential) is left out, listed in `left` and counted in `note`; fewer than 2 usable points (3 for the
   quadratic, with 3 different x) is no fit, null. */
(function (global) {
  'use strict';

  var MODELS = [
    { id: 'linear', name: 'Linear', shape: 'y = a·x + b' },
    { id: 'power', name: 'Power', shape: 'y = a·x^b' },
    { id: 'exponential', name: 'Exponential', shape: 'y = a·e^(b·x)' },
    { id: 'logarithmic', name: 'Logarithmic', shape: 'y = a + b·ln x' },
    { id: 'quadratic', name: 'Quadratic', shape: 'y = a·x² + b·x + c' }
  ];

  /* Three significant figures, no trailing zeros, no exponent for ordinary sizes: 0.00123 -> "0.00123". */
  function sig(v) {
    if (v === 0 || !isFinite(v)) return String(v === 0 ? 0 : v);
    var s = Number(v.toPrecision(3));
    if (Math.abs(s) >= 1e-4 && Math.abs(s) < 1e6) return String(s);
    return s.toExponential(2).replace(/\.?0+e/, 'e').replace('e+', 'e');
  }
  function signed(v) { return (v < 0 ? '- ' : '+ ') + sig(Math.abs(v)); }

  /* Ordinary least squares y = m·x + k over [{x, y}] (all finite). */
  function ols(pts) {
    var n = pts.length, sx = 0, sy = 0, sxy = 0, sxx = 0, i;
    for (i = 0; i < n; i++) { sx += pts[i].x; sy += pts[i].y; sxy += pts[i].x * pts[i].y; sxx += pts[i].x * pts[i].x; }
    var den = n * sxx - sx * sx;
    if (n < 2 || den === 0) return null;
    var m = (n * sxy - sx * sy) / den;
    return { m: m, k: (sy - m * sx) / n };
  }

  /* Quadratic through the normal equations, solved by Gaussian elimination with partial pivoting. */
  function quad(pts) {
    var s = [0, 0, 0, 0, 0], t = [0, 0, 0], i, j, k;
    pts.forEach(function (p) {
      var x = p.x, x2 = x * x;
      s[0] += 1; s[1] += x; s[2] += x2; s[3] += x2 * x; s[4] += x2 * x2;
      t[0] += p.y; t[1] += p.y * x; t[2] += p.y * x2;
    });
    /* unknowns in the order c, b, a */
    var m = [[s[0], s[1], s[2], t[0]], [s[1], s[2], s[3], t[1]], [s[2], s[3], s[4], t[2]]];
    for (i = 0; i < 3; i++) {
      var piv = i;
      for (j = i + 1; j < 3; j++) if (Math.abs(m[j][i]) > Math.abs(m[piv][i])) piv = j;
      if (Math.abs(m[piv][i]) < 1e-12 * Math.max(1, Math.abs(m[0][0]))) return null;
      var tmp = m[i]; m[i] = m[piv]; m[piv] = tmp;
      for (j = i + 1; j < 3; j++) {
        var f = m[j][i] / m[i][i];
        for (k = i; k < 4; k++) m[j][k] -= f * m[i][k];
      }
    }
    var sol = [0, 0, 0];
    for (i = 2; i >= 0; i--) {
      var acc = m[i][3];
      for (j = i + 1; j < 3; j++) acc -= m[i][j] * sol[j];
      sol[i] = acc / m[i][i];
    }
    return { c: sol[0], b: sol[1], a: sol[2] };
  }

  function usable(id, p) {
    if (!isFinite(p.x) || !isFinite(p.y)) return 'not a number';
    if ((id === 'power' || id === 'logarithmic') && !(p.x > 0)) return 'x is not above 0';
    if ((id === 'power' || id === 'exponential') && !(p.y > 0)) return 'y is not above 0';
    return '';
  }

  function r2Of(pts, predict) {
    var n = pts.length, mean = 0, i;
    for (i = 0; i < n; i++) mean += pts[i].y;
    mean /= n;
    var res = 0, tot = 0;
    for (i = 0; i < n; i++) { var e = pts[i].y - predict(pts[i].x); res += e * e; tot += (pts[i].y - mean) * (pts[i].y - mean); }
    if (tot === 0) return res === 0 ? 1 : 0;
    return 1 - res / tot;
  }

  function fit(id, points) {
    var def = MODELS.filter(function (m) { return m.id === id; })[0];
    if (!def) return null;
    var pts = [], left = [];
    (points || []).forEach(function (p) {
      var why = usable(id, p);
      if (why) left.push({ x: p.x, y: p.y, why: why }); else pts.push(p);
    });
    var need = id === 'quadratic' ? 3 : 2;
    if (pts.length < need) return null;

    var a, b, c = null, predict, eq, o;
    if (id === 'linear') {
      o = ols(pts); if (!o) return null;
      a = o.m; b = o.k;
      predict = function (x) { return a * x + b; };
      eq = 'y = ' + sig(a) + 'x ' + signed(b);
    } else if (id === 'power') {
      o = ols(pts.map(function (p) { return { x: Math.log(p.x), y: Math.log(p.y) }; })); if (!o) return null;
      a = Math.exp(o.k); b = o.m;
      predict = function (x) { return a * Math.pow(x, b); };
      eq = 'y = ' + sig(a) + '·x^' + sig(b);
    } else if (id === 'exponential') {
      o = ols(pts.map(function (p) { return { x: p.x, y: Math.log(p.y) }; })); if (!o) return null;
      a = Math.exp(o.k); b = o.m;
      predict = function (x) { return a * Math.exp(b * x); };
      eq = 'y = ' + sig(a) + '·e^(' + sig(b) + 'x)';
    } else if (id === 'logarithmic') {
      o = ols(pts.map(function (p) { return { x: Math.log(p.x), y: p.y }; })); if (!o) return null;
      a = o.k; b = o.m;
      predict = function (x) { return a + b * Math.log(x); };
      eq = 'y = ' + sig(a) + ' ' + signed(b) + '·ln x';
    } else {
      var q = quad(pts); if (!q) return null;
      a = q.a; b = q.b; c = q.c;
      predict = function (x) { return a * x * x + b * x + c; };
      eq = 'y = ' + sig(a) + 'x² ' + signed(b) + 'x ' + signed(c);
    }
    var r2 = r2Of(pts, predict);
    var note = def.name + ' fit' + (id === 'power' || id === 'exponential' || id === 'logarithmic' ? ', least squares on the ' + (id === 'power' ? 'logs of x and y' : id === 'exponential' ? 'log of y' : 'log of x') : ', least squares') +
      '; R² is measured on the original values.';
    if (left.length) note += ' ' + left.length + ' point' + (left.length === 1 ? '' : 's') + ' left out (' + (left[0].why) + (left.some(function (l) { return l.why !== left[0].why; }) ? ', and others' : '') + ').';
    return {
      model: id, n: (points || []).length, used: pts.length, left: left,
      a: a, b: b, c: c, predict: predict, r2: r2,
      equation: eq,
      label: eq + '  (R² = ' + sig(r2) + ')',
      desc: def.name + ' fit ' + eq + ', R squared ' + sig(r2) + ', from ' + pts.length + ' point' + (pts.length === 1 ? '' : 's') + '.',
      note: note
    };
  }

  global.ChartFit = { MODELS: MODELS, fit: fit, sig: sig };
})(typeof window !== 'undefined' ? window : globalThis);
