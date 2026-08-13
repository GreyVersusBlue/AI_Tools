/* htcm-photo.js — the photo pipeline's viewing side for the Historical
   Trading Card Maker: parametric crop, shaped windows, era filters, and the
   hand-rolled editor dialog.

   Crops are non-destructive. A card image stores only
   { crop: {x, y, scale}, shape, filter } against its downscaled master:
   x/y are a normalized focal point (0–1) and scale is zoom (>= 1). The DOM
   applies it as `object-fit: cover; object-position: X% Y%` plus a
   transform zoom toward the same point — photoStyle() — and the canvas
   exporter inverts the identical math into a drawImage source rect —
   sourceRect(). The two functions live side by side in this file on
   purpose: if the math ever changes, it changes in both or the WYSIWYG
   promise breaks.

   The editor is a fixed overlay, not a canvas: its viewport is literally the
   card's photo window (same clip-path, same aspect, same photoStyle), so
   dragging and zooming previews exactly what prints. Pan sensitivity is
   computed from the cover-fitted image's hidden overflow so the picture
   tracks the pointer 1:1. */
(function (global) {
  'use strict';

  /* photo-window aspect ratios (w/h), mirroring the .pwin CSS in the tool:
     banner shapes span the card at 2.2in × 1.35in; medallion shapes are
     centered boxes. */
  var ASPECTS = {
    rrect: 2.2 / 1.35, oval: 2.2 / 1.35, hex: 2.2 / 1.35,
    circle: 1, shield: 1.45 / 1.6, arch: 1.45 / 1.7
  };

  var FILTERS = {
    none: { label: 'None', css: '' },
    sepia: { label: 'Sepia', css: 'sepia(0.6) contrast(0.92)' },
    gray: { label: 'B & W', css: 'grayscale(1)' }
  };

  function crop(image) {
    return (image && image.crop) || { x: 0.5, y: 0.5, scale: 1 };
  }

  /** Inline style for a card photo <img>. */
  function photoStyle(image) {
    var c = crop(image);
    var x = Math.round(c.x * 1000) / 10, y = Math.round(c.y * 1000) / 10;
    var s = 'object-fit:cover;object-position:' + x + '% ' + y + '%;';
    if (c.scale > 1.001) s += 'transform:scale(' + c.scale + ');transform-origin:' + x + '% ' + y + '%;';
    var f = FILTERS[image && image.filter] || FILTERS.none;
    if (f.css) s += 'filter:' + f.css + ';';
    return s;
  }

  /** The source rect in image pixels that photoStyle() shows through a
      dw × dh window — drawImage(img, sx, sy, sw, sh, …) renders the same
      framing on canvas. Needs image.w/h; returns null without them. */
  function sourceRect(image, dw, dh) {
    if (!image || !image.w || !image.h) return null;
    var c = crop(image);
    var k = Math.max(dw / image.w, dh / image.h); // object-fit: cover
    var cw = dw / k, ch = dh / k;                 // cover crop, source px
    var cx = (image.w - cw) * c.x, cy = (image.h - ch) * c.y;
    var sw = cw / c.scale, sh = ch / c.scale;     // zoom shrinks it…
    return {                                      // …anchored on the focal point
      sx: cx + (cw - sw) * c.x,
      sy: cy + (ch - sh) * c.y,
      sw: sw, sh: sh
    };
  }

  /* ---------- the editor overlay ---------- */

  var overlay = null;

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'photo-editor-overlay';
    overlay.innerHTML =
      '<div class="photo-editor" role="dialog" aria-label="Adjust photo">' +
      '<h3>Adjust photo</h3>' +
      '<div class="pe-stage"><div class="pe-viewport"><img alt=""></div></div>' +
      '<p class="hint pe-hint">Drag the photo to reposition it. This window is the exact shape that prints.</p>' +
      '<label>Zoom</label><input type="range" class="pe-zoom" min="1" max="4" step="0.05" value="1">' +
      '<label>Frame shape</label><div class="pe-row pe-shapes"></div>' +
      '<label>Filter</label><div class="pe-row pe-filters"></div>' +
      '<div class="pe-actions">' +
      '<button type="button" class="secondary pe-reset">Reset</button>' +
      '<span class="pe-spacer"></span>' +
      '<button type="button" class="secondary pe-cancel">Cancel</button>' +
      '<button type="button" class="pe-save">Save</button>' +
      '</div></div>';
    document.body.appendChild(overlay);
  }

  /** Opens the editor over a card image object (never mutated); Save hands a
      new image object to onSave. */
  function openEditor(image, onSave) {
    if (!overlay) buildOverlay();
    var state = {
      x: crop(image).x, y: crop(image).y, scale: crop(image).scale,
      shape: ASPECTS[image.shape] ? image.shape : 'rrect',
      filter: FILTERS[image.filter] ? image.filter : 'none',
      w: image.w || 0, h: image.h || 0
    };
    var viewport = overlay.querySelector('.pe-viewport');
    var img = viewport.querySelector('img');
    var zoom = overlay.querySelector('.pe-zoom');
    var shapesRow = overlay.querySelector('.pe-shapes');
    var filtersRow = overlay.querySelector('.pe-filters');

    function renderChoices() {
      shapesRow.innerHTML = Object.keys(global.HtcmFrames.SHAPES).map(function (k) {
        return '<button type="button" class="secondary small' + (k === state.shape ? ' selected' : '') +
          '" data-shape="' + k + '">' + global.HtcmFrames.SHAPES[k].label + '</button>';
      }).join('');
      filtersRow.innerHTML = Object.keys(FILTERS).map(function (k) {
        return '<button type="button" class="secondary small' + (k === state.filter ? ' selected' : '') +
          '" data-filter="' + k + '">' + FILTERS[k].label + '</button>';
      }).join('');
    }

    function apply() {
      var aspect = ASPECTS[state.shape];
      var vw = Math.min(300, (overlay.querySelector('.pe-stage').clientWidth || 300));
      viewport.style.width = vw + 'px';
      viewport.style.height = Math.round(vw / aspect) + 'px';
      viewport.style.clipPath = 'url(#htcm-clip-' + state.shape + ')';
      viewport.style.webkitClipPath = 'url(#htcm-clip-' + state.shape + ')';
      img.style.cssText = 'width:100%;height:100%;display:block;cursor:grab;' +
        photoStyle({ crop: { x: state.x, y: state.y, scale: state.scale }, filter: state.filter });
      zoom.value = state.scale;
    }

    img.onload = function () { // fills w/h for images imported before v2 kept them
      if (!state.w) { state.w = img.naturalWidth; state.h = img.naturalHeight; }
    };
    img.src = image.src;

    /* drag to pan: pointer movement maps 1:1 onto the cover-fitted image's
       hidden overflow, so the photo follows the finger */
    var drag = null;
    img.onpointerdown = function (ev) {
      ev.preventDefault();
      img.setPointerCapture(ev.pointerId);
      drag = { px: ev.clientX, py: ev.clientY };
    };
    img.onpointermove = function (ev) {
      if (!drag || !state.w) return;
      var vw = viewport.clientWidth, vh = viewport.clientHeight;
      var k = Math.max(vw / state.w, vh / state.h) * state.scale;
      var hiddenX = state.w * k - vw, hiddenY = state.h * k - vh;
      if (hiddenX > 0) state.x = Math.min(1, Math.max(0, state.x - (ev.clientX - drag.px) / hiddenX));
      if (hiddenY > 0) state.y = Math.min(1, Math.max(0, state.y - (ev.clientY - drag.py) / hiddenY));
      drag = { px: ev.clientX, py: ev.clientY };
      apply();
    };
    img.onpointerup = img.onpointercancel = function () { drag = null; };
    viewport.onwheel = function (ev) {
      ev.preventDefault();
      state.scale = Math.min(4, Math.max(1, state.scale * (ev.deltaY < 0 ? 1.08 : 0.93)));
      apply();
    };

    zoom.oninput = function () { state.scale = parseFloat(zoom.value) || 1; apply(); };
    shapesRow.onclick = function (ev) {
      var k = ev.target.getAttribute('data-shape');
      if (k) { state.shape = k; renderChoices(); apply(); }
    };
    filtersRow.onclick = function (ev) {
      var k = ev.target.getAttribute('data-filter');
      if (k) { state.filter = k; renderChoices(); apply(); }
    };
    overlay.querySelector('.pe-reset').onclick = function () {
      state.x = 0.5; state.y = 0.5; state.scale = 1; state.filter = 'none';
      renderChoices(); apply();
    };

    function close() {
      overlay.style.display = 'none';
      document.removeEventListener('keydown', onKey);
    }
    function onKey(ev) { if (ev.key === 'Escape') close(); }
    overlay.querySelector('.pe-cancel').onclick = close;
    overlay.onclick = function (ev) { if (ev.target === overlay) close(); };
    overlay.querySelector('.pe-save').onclick = function () {
      close();
      onSave({
        src: image.src, w: state.w, h: state.h,
        crop: { x: state.x, y: state.y, scale: state.scale },
        shape: state.shape, filter: state.filter
      });
    };

    document.addEventListener('keydown', onKey);
    overlay.style.display = '';
    renderChoices();
    apply();
  }

  global.HtcmPhoto = {
    ASPECTS: ASPECTS,
    FILTERS: FILTERS,
    photoStyle: photoStyle,
    sourceRect: sourceRect,
    openEditor: openEditor
  };
})(window);
