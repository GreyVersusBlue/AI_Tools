/* sketch.js — a small drawing pad for 024 Number Talks' strategy cards. A plain
   script that publishes one global, `NTSketch`.

   Number talk strategies are visual (a number line, an array, a decomposition
   tree), so a strategy card can carry one drawing. The drawing is a PNG data
   URL in the card's optional `sketch` field; a card with none is what it was.

   What this file owns:
     - isSketch / clean: the strict test a stored or arriving value must pass
       before it is put in an <img src>. Only a PNG data URL of base64 characters,
       under MAX characters, is a sketch; anything else is dropped.
     - open(): a modal <dialog> with a canvas, a few pen colours (named, never
       colour alone), thin / thick, an eraser, undo by stroke, clear, Done and
       Cancel. The drawing is kept as strokes and redrawn from them, so undo is
       exact. Pointer events only draw (a pen, a finger or a mouse); a teacher
       who cannot draw types on the card as before.
     - toDataUrl(): strokes to a PNG on white, scaled down once if it is over
       MAX, and refused (null) if it still is. */
(function (global) {
  'use strict';

  var MAX = 60000;                  // characters of data URL a card or a library entry may hold
  var W = 600, H = 375;             // the pad's own pixel size
  var PNG = /^data:image\/png;base64,[A-Za-z0-9+\/]+={0,2}$/;
  var COLORS = [['Black', '#111111'], ['Blue', '#1f4fd8'], ['Red', '#c0261b']];
  var SIZES = [['Thin', 3], ['Thick', 8]];
  var ERASER = 22;

  function isSketch(v) { return typeof v === 'string' && v.length <= MAX && PNG.test(v); }
  function clean(v) { return isSketch(v) ? v : ''; }

  /** White sheet, the picture being edited (if any), then every stroke. */
  function drawStrokes(ctx, strokes, scale, under) {
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    if (under) ctx.drawImage(under, 0, 0, W, H);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    strokes.forEach(function (s) {
      ctx.strokeStyle = s.erase ? '#ffffff' : s.color;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = s.w;
      var p = s.pts;
      if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0][0], p[0][1], s.w / 2, 0, Math.PI * 2); ctx.fill(); return; }
      ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
      for (var i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
      ctx.stroke();
    });
    ctx.restore();
  }

  /** Strokes to a PNG data URL on white. Tries full size, then 0.7; null when over MAX. */
  function toDataUrl(strokes, under) {
    var scales = [1, 0.7];
    for (var i = 0; i < scales.length; i++) {
      var c = document.createElement('canvas');
      c.width = Math.round(W * scales[i]); c.height = Math.round(H * scales[i]);
      drawStrokes(c.getContext('2d'), strokes, scales[i], under);
      var url = c.toDataURL('image/png');
      if (url.length <= MAX) return url;
    }
    return null;
  }

  /** open({ title, initial, onDone(url|''), onCancel, opener }) */
  function open(opts) {
    opts = opts || {};
    var strokes = [];
    var color = COLORS[0][1], size = SIZES[0][1], erase = false;
    var base = null;                  // the picture being edited, drawn under new strokes
    var live = null;

    var dlg = document.createElement('dialog');
    dlg.className = 'sk-dialog';
    dlg.setAttribute('aria-labelledby', 'skTitle');
    dlg.innerHTML =
      '<h2 id="skTitle" class="sk-title"></h2>' +
      '<p class="sk-hint">Draw with a finger, a pen or the mouse. Escape closes without saving.</p>' +
      '<div class="sk-tools" role="group" aria-label="Pen">' +
        COLORS.map(function (c, i) { return '<button type="button" class="sk-btn" data-color="' + c[1] + '" aria-pressed="' + (i === 0) + '">' + c[0] + '</button>'; }).join('') +
        SIZES.map(function (s, i) { return '<button type="button" class="sk-btn" data-size="' + s[1] + '" aria-pressed="' + (i === 0) + '">' + s[0] + '</button>'; }).join('') +
        '<button type="button" class="sk-btn" data-erase aria-pressed="false">Eraser</button>' +
      '</div>' +
      '<canvas class="sk-canvas" width="' + W + '" height="' + H + '" role="img" aria-label="Drawing area"></canvas>' +
      '<p class="sk-err" role="alert" hidden></p>' +
      '<div class="sk-tools">' +
        '<button type="button" class="sk-btn" data-undo>Undo stroke</button>' +
        '<button type="button" class="sk-btn" data-clear>Clear</button>' +
        '<span class="sk-spacer"></span>' +
        '<button type="button" class="sk-btn" data-cancel>Cancel</button>' +
        '<button type="button" class="sk-btn sk-done" data-done>Done</button>' +
      '</div>';
    dlg.querySelector('.sk-title').textContent = opts.title || 'Draw a strategy';
    document.body.appendChild(dlg);

    var canvas = dlg.querySelector('canvas');
    var ctx = canvas.getContext('2d');
    var errEl = dlg.querySelector('.sk-err');

    function repaint() { drawStrokes(ctx, live ? strokes.concat([live]) : strokes, 1, base); }

    if (isSketch(opts.initial)) {
      var img = new Image();
      img.onload = function () { base = img; repaint(); };
      img.src = opts.initial;
    }
    repaint();

    function pt(e) {
      var r = canvas.getBoundingClientRect();
      return [Math.round((e.clientX - r.left) * W / r.width * 10) / 10, Math.round((e.clientY - r.top) * H / r.height * 10) / 10];
    }
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* synthetic events have no capture */ }
      live = { color: color, w: erase ? ERASER : size, erase: erase, pts: [pt(e)] };
      repaint();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!live) return;
      live.pts.push(pt(e)); repaint();
    });
    function end() {
      if (!live) return;
      strokes.push(live); live = null; repaint();
    }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    function press(group, btn) {
      Array.prototype.forEach.call(dlg.querySelectorAll(group), function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
    }
    function close(result) {
      dlg.close();
      dlg.remove();
      if (opts.opener && opts.opener.focus) { try { opts.opener.focus(); } catch (x) { /* gone */ } }
      if (result === null) { if (opts.onCancel) opts.onCancel(); }
      else if (opts.onDone) opts.onDone(result);
    }
    dlg.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-color')) { color = b.getAttribute('data-color'); erase = false; press('[data-color],[data-erase]', b); }
      else if (b.hasAttribute('data-erase')) { erase = true; press('[data-color],[data-erase]', b); }
      else if (b.hasAttribute('data-size')) { size = +b.getAttribute('data-size'); press('[data-size]', b); }
      else if (b.hasAttribute('data-undo')) { strokes.pop(); repaint(); }
      else if (b.hasAttribute('data-clear')) { strokes = []; base = null; repaint(); }
      else if (b.hasAttribute('data-cancel')) close(null);
      else if (b.hasAttribute('data-done')) {
        if (!strokes.length && !base) { close(''); return; }
        var url = toDataUrl(strokes, base);
        if (!url) {
          errEl.textContent = 'This drawing is too detailed to keep. Undo a few strokes or clear it and draw it simpler.';
          errEl.hidden = false;
          return;
        }
        close(url);
      }
    });
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(null); });

    dlg.showModal();
    dlg.querySelector('[data-color]').focus();
    return { dialog: dlg };
  }

  global.NTSketch = { MAX: MAX, W: W, H: H, isSketch: isSketch, clean: clean, open: open, toDataUrl: toDataUrl };
})(typeof globalThis !== 'undefined' ? globalThis : this);
