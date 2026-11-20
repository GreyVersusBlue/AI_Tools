/* scan-ui.js — ScanUI, the dialog and the Worker plumbing of 011's scanner (Path 17 P2).
 *
 * A plain global script, loaded by 011 only when a teacher first presses Scan (the way pdf.js is
 * loaded only when a PDF is chosen), publishing window.ScanUI. The arithmetic is scan.js's
 * (window.Scan); this file is the page half:
 *
 *   ScanUI.open({ url, name, scan, mode, maxDim, onClose })
 *       -> Promise<record | null>   the dialog; null when cancelled
 *   ScanUI.autoScan(url, { mode, maxDim }) -> Promise<record>   detect, then process, no dialog
 *   ScanUI.loadPhoto(url), ScanUI.job(op, photo, extra), ScanUI.blobOf(page, mode)
 *
 * A record is { quad, auto, mode, confidence, history, manual, processed: { blob, w, h } }:
 * `quad` the corners in use, `auto` what Detect found (Reset's target), `history` the last 20 quads
 * before a move (per-page undo), `manual` true once a corner was moved by hand (a later Scan all
 * leaves such a page alone), `processed` the finished page. Points are [x, y] in the photo as the
 * browser shows it (EXIF applied), the photo capped at 6000 px on its long edge.
 *
 * Jobs run in scan-worker.js, one at a time; a browser with no Worker, or one that cannot start it
 * (file://), runs the same function on the page's thread. Nothing here stores anything.
 */
(function () {
  'use strict';

  var WORKER_URL = 'image-to-pdf/scan-worker.js';
  var SCAN_URL = 'image-to-pdf/scan.js';
  var PHOTO_MAX = 6000, HISTORY_MAX = 20, STORE_MAX = 4000, LOW_CONFIDENCE = 0.6;
  var BAD_QUAD = 'Those corners do not make a page';

  /* ── Scan on this thread (the dialog's live preview, and the fallback) ─────── */
  var scanLoading = null;
  function ensureScan() {
    if (window.Scan) return Promise.resolve(window.Scan);
    if (!scanLoading) {
      scanLoading = new Promise(function (res, rej) {
        var el = document.createElement('script');
        el.src = SCAN_URL;
        el.onload = function () { res(window.Scan); };
        el.onerror = function () { scanLoading = null; rej(new Error("The scanner didn't load. Reload the page and try again.")); };
        document.head.appendChild(el);
      });
    }
    return scanLoading;
  }

  /* ── The Worker: one job at a time ───────────────────────────────────────────── */
  var worker = null, workerBad = false, seq = 0, pending = {}, tail = Promise.resolve();

  function failPending(err) {
    var p = pending; pending = {};
    Object.keys(p).forEach(function (id) { p[id].reject(err); });
  }
  function getWorker() {
    if (workerBad || typeof Worker === 'undefined') return null;
    if (!worker) {
      try {
        worker = new Worker(WORKER_URL);
        worker.onmessage = function (ev) {
          var m = ev.data, p = pending[m.id];
          if (!p) return;
          delete pending[m.id];
          if (m.error) p.reject(new Error(m.error)); else p.resolve(m);
        };
        worker.onerror = function () {
          workerBad = true; worker = null;
          failPending({ fallback: true });
        };
      } catch (e) { workerBad = true; worker = null; return null; }
    }
    return worker;
  }

  function viaWorker(w, op, photo, extra) {
    return new Promise(function (resolve, reject) {
      var id = ++seq, copy = photo.data.slice();
      pending[id] = { resolve: resolve, reject: reject };
      var msg = { id: id, op: op, buffer: copy.buffer, w: photo.width, h: photo.height };
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) msg[k] = extra[k];
      w.postMessage(msg, [copy.buffer]);
    }).then(function (m) {
      if (op === 'detect') return { quad: m.quad, confidence: m.confidence, method: m.method };
      return { imageData: { data: new Uint8ClampedArray(m.buffer), width: m.w, height: m.h }, w: m.w, h: m.h };
    });
  }

  function onThisThread(op, photo, extra) {
    return ensureScan().then(function (Scan) {
      var img = { data: photo.data, width: photo.width, height: photo.height };
      if (op === 'detect') {
        var d = Scan.detect(img), quad = d.quad;
        if (d.method === 'edges') { try { quad = Scan.refine(img, d.quad); } catch (e) { quad = d.quad; } }
        return { quad: quad, confidence: d.confidence, method: d.method };
      }
      var r = Scan.process(img, { quad: extra.quad, mode: extra.mode, maxDim: extra.maxDim });
      return { imageData: r.imageData, w: r.w, h: r.h };
    });
  }

  function run(op, photo, extra) {
    var w = getWorker();
    if (!w) return onThisThread(op, photo, extra);
    return viaWorker(w, op, photo, extra).catch(function (err) {
      if (err && err.fallback) return onThisThread(op, photo, extra);
      throw err;
    });
  }

  /** op 'detect' -> { quad, confidence, method }; op 'process' ({ quad, mode, maxDim }) -> { imageData, w, h }. */
  function job(op, photo, extra) {
    extra = extra || {};
    var go = function () { return run(op, photo, extra); };
    var p = tail.then(go, go);
    tail = p.catch(function () {});
    return p;
  }

  /* ── Photo in, page out ──────────────────────────────────────────────────────── */
  function loadPhoto(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var nw = img.naturalWidth, nh = img.naturalHeight;
        if (!nw || !nh) { reject(new Error('That image has no readable size.')); return; }
        var k = Math.min(1, PHOTO_MAX / Math.max(nw, nh));
        var cw = Math.max(1, Math.round(nw * k)), ch = Math.max(1, Math.round(nh * k));
        var canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        var ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        var id = ctx.getImageData(0, 0, cw, ch);
        resolve({ data: id.data, width: cw, height: ch, canvas: canvas });
      };
      img.onerror = function () { reject(new Error('That photo could not be read.')); };
      img.src = url;
    });
  }

  /** A finished page ({ data, width, height }) as a Blob: PNG for black and white, JPEG otherwise. */
  function blobOf(page, mode) {
    return new Promise(function (resolve, reject) {
      var c = document.createElement('canvas');
      c.width = page.width; c.height = page.height;
      c.getContext('2d').putImageData(new ImageData(page.data, page.width, page.height), 0, 0);
      c.toBlob(function (b) { if (b) resolve(b); else reject(new Error('The page could not be saved.')); },
        mode === 'bw' ? 'image/png' : 'image/jpeg', 0.92);
    });
  }

  function finish(photo, quad, mode, maxDim) {
    return job('process', photo, { quad: quad, mode: mode, maxDim: maxDim || STORE_MAX }).then(function (r) {
      return blobOf(r.imageData, mode).then(function (blob) { return { blob: blob, w: r.w, h: r.h }; });
    });
  }

  /** Detect and process with no dialog: the Scan all step. */
  function autoScan(url, opts) {
    opts = opts || {};
    var mode = opts.mode || 'color';
    return loadPhoto(url).then(function (photo) {
      return job('detect', photo).then(function (d) {
        return finish(photo, d.quad, mode, opts.maxDim).then(function (processed) {
          return { quad: d.quad, auto: d.quad.map(function (p) { return p.slice(); }), mode: mode,
            confidence: d.confidence, history: [], manual: false, processed: processed, pw: photo.width, ph: photo.height };
        });
      });
    });
  }

  /* ── The dialog ──────────────────────────────────────────────────────────────── */
  var NAMES = ['Top left corner', 'Top right corner', 'Bottom right corner', 'Bottom left corner'];
  var dlg = null, ui = null;

  function el(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function build() {
    dlg = el('dialog', 'scan-dialog', { 'aria-labelledby': 'scan-title' });
    var h = el('h2', 'scan-title', { id: 'scan-title' });
    var help = el('p', 'scan-help');
    help.textContent = 'Drag the four round handles onto the corners of the sheet, or focus one and use the arrow keys (Shift moves ten pixels). Ctrl+Z undoes a move. Nothing leaves this device.';

    var body = el('div', 'scan-body');
    var stage = el('div', 'scan-stage');
    var photoC = el('canvas', 'scan-photo', { role: 'img', 'aria-label': 'The photo, with the page outlined' });
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'scan-poly'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('preserveAspectRatio', 'none');
    var polyBack = document.createElementNS(svgNS, 'polygon'); polyBack.setAttribute('class', 'scan-poly-back');
    var poly = document.createElementNS(svgNS, 'polygon'); poly.setAttribute('class', 'scan-poly-line');
    svg.appendChild(polyBack); svg.appendChild(poly);
    stage.appendChild(photoC); stage.appendChild(svg);
    var handles = NAMES.map(function (n, i) {
      var b = el('button', 'scan-handle', { type: 'button', 'aria-label': n, 'data-i': String(i) });
      stage.appendChild(b);
      return b;
    });
    var loupe = el('canvas', 'scan-loupe', { width: '150', height: '150', 'aria-hidden': 'true' });
    loupe.hidden = true;
    stage.appendChild(loupe);

    var side = el('figure', 'scan-after');
    var afterC = el('canvas', null, { role: 'img', 'aria-label': 'The page as it will be saved' });
    var cap = el('figcaption'); cap.textContent = 'After';
    side.appendChild(afterC); side.appendChild(cap);
    body.appendChild(stage); body.appendChild(side);

    var bar = el('div', 'scan-controls');
    var modeWrap = el('label', 'scan-mode'); modeWrap.appendChild(document.createTextNode('Look '));
    var modeSel = el('select', 'input');
    [['color', 'Color'], ['gray', 'Grey'], ['bw', 'Black and white']].forEach(function (o) {
      var op = el('option'); op.value = o[0]; op.textContent = o[1]; modeSel.appendChild(op);
    });
    modeWrap.appendChild(modeSel);
    function btn(text, cls) { var b = el('button', 'btn ' + (cls || 'btn-secondary'), { type: 'button' }); b.textContent = text; return b; }
    var again = btn('Detect again'), reset = btn('Reset'), undo = btn('Undo');
    var cancel = btn('Cancel'), apply = btn('Apply', 'btn-primary');
    var sp = el('span', 'scan-spacer');
    [modeWrap, again, reset, undo, sp, cancel, apply].forEach(function (n) { bar.appendChild(n); });

    var status = el('p', 'scan-status', { role: 'status', 'aria-live': 'polite' });
    [h, help, body, bar, status].forEach(function (n) { dlg.appendChild(n); });
    document.body.appendChild(dlg);
    ui = { h: h, stage: stage, photoC: photoC, svg: svg, poly: poly, polyBack: polyBack, handles: handles, loupe: loupe,
      afterC: afterC, modeSel: modeSel, again: again, reset: reset, undo: undo, cancel: cancel, apply: apply, status: status };
  }

  function clone(q) { return q.map(function (p) { return [p[0], p[1]]; }); }

  function open(opts) {
    if (!dlg) build();
    var photo = null, quad = null, auto = null, confidence = 0, history = [], touched = !!(opts.scan && opts.scan.manual);
    var mode = (opts.scan && opts.scan.mode) || opts.mode || 'color';
    var lastPush = 0, previewTimer = 0, previewToken = 0, done = false, busy = false, quadValid = true;
    var rec = opts.scan || null;

    ui.h.textContent = 'Scan a page: ' + opts.name;
    ui.modeSel.value = mode;
    ui.status.textContent = 'Opening the photo…';
    ui.apply.disabled = true; ui.again.disabled = true; ui.reset.disabled = true; ui.undo.disabled = true;
    ui.handles.forEach(function (b) { b.hidden = true; });

    return new Promise(function (resolve) {
      function cleanup() {
        clearTimeout(previewTimer);
        dlg.removeEventListener('cancel', onCancel);
        dlg.removeEventListener('keydown', onKey);
        dlg.removeEventListener('close', onClosed);
        ui.again.onclick = ui.reset.onclick = ui.undo.onclick = ui.cancel.onclick = ui.apply.onclick = null;
        ui.modeSel.onchange = null;
        ui.handles.forEach(function (b) { b.onpointerdown = b.onpointermove = b.onpointerup = b.onpointercancel = b.onkeydown = null; });
      }
      function end(result) {
        if (done) return;
        done = true;
        cleanup();
        if (dlg.open) dlg.close();
        if (opts.onClose) opts.onClose();
        resolve(result);
      }
      function onCancel(e) { e.preventDefault(); if (!busy) end(null); }
      function onClosed() { end(null); }

      function say(t) { ui.status.textContent = t; }
      function setBusy(b) {
        busy = b;
        [ui.again, ui.reset, ui.apply, ui.cancel, ui.modeSel].forEach(function (c) { c.disabled = b; });
        ui.handles.forEach(function (c) { c.disabled = b; });
        if (!b) syncButtons();
      }
      function syncButtons() {
        ui.undo.disabled = busy || history.length === 0;
        ui.reset.disabled = busy || !auto;
        ui.again.disabled = busy || !photo;
        ui.apply.disabled = busy || !photo || !quadValid;
      }

      function pushHistory() {
        if (!quad) return;
        history.push(clone(quad));
        if (history.length > HISTORY_MAX) history.shift();
      }

      function draw() {
        var W = photo.width, H = photo.height;
        var pts = quad.map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
        ui.poly.setAttribute('points', pts); ui.polyBack.setAttribute('points', pts);
        ui.handles.forEach(function (b, i) {
          b.style.left = (quad[i][0] / W * 100) + '%';
          b.style.top = (quad[i][1] / H * 100) + '%';
        });
        schedulePreview();
      }

      function schedulePreview() {
        clearTimeout(previewTimer);
        previewTimer = setTimeout(preview, 150);
      }
      function preview() {
        var token = ++previewToken;
        ensureScan().then(function (Scan) {
          if (token !== previewToken || done) return;
          var ctx = ui.afterC.getContext('2d');
          try {
            var size = Scan.outputSize(quad, { maxDim: 360 });
            var page = Scan.rectify(photo, quad, size.w, size.h);
            var out = Scan.clean(page, ui.modeSel.value);
            ui.afterC.width = size.w; ui.afterC.height = size.h;
            ctx.putImageData(new ImageData(new Uint8ClampedArray(out.data), out.width, out.height), 0, 0);
            quadValid = true;
            if (ui.status.dataset.warn === '1') { say(''); ui.status.dataset.warn = ''; }
          } catch (e) {
            quadValid = false;
            ctx.clearRect(0, 0, ui.afterC.width, ui.afterC.height);
            say(BAD_QUAD + '. Move the corners so the four of them make a sheet.');
            ui.status.dataset.warn = '1';
          }
          syncButtons();
        }).catch(function (e) { say(e.message || 'The preview failed.'); });
      }

      function setQuad(q, remember) {
        if (remember) pushHistory();
        quad = clone(q);
        draw();
        syncButtons();
      }

      function pointerToPhoto(ev) {
        var r = ui.photoC.getBoundingClientRect();
        var x = (ev.clientX - r.left) / r.width * photo.width, y = (ev.clientY - r.top) / r.height * photo.height;
        return [Math.max(0, Math.min(photo.width, x)), Math.max(0, Math.min(photo.height, y))];
      }
      function showLoupe(i) {
        var c = ui.loupe, ctx = c.getContext('2d'), p = quad[i], S = 60;
        ctx.fillStyle = '#888'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(photo.canvas, p[0] - S / 2, p[1] - S / 2, S, S, 0, 0, c.width, c.height);
        ctx.strokeStyle = '#e11'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(c.width / 2, 0); ctx.lineTo(c.width / 2, c.height); ctx.moveTo(0, c.height / 2); ctx.lineTo(c.width, c.height / 2); ctx.stroke();
        c.classList.toggle('scan-loupe-right', i === 0 || i === 3);
        c.hidden = false;
      }

      function wireHandle(b, i) {
        b.onpointerdown = function (ev) {
          if (busy) return;
          ev.preventDefault();
          b.setPointerCapture(ev.pointerId);
          b.dataset.drag = '1';
          pushHistory(); touched = true;
          showLoupe(i); syncButtons();
        };
        b.onpointermove = function (ev) {
          if (b.dataset.drag !== '1') return;
          quad[i] = pointerToPhoto(ev);
          draw(); showLoupe(i);
        };
        function up() { delete b.dataset.drag; ui.loupe.hidden = true; }
        b.onpointerup = up; b.onpointercancel = up;
        b.onkeydown = function (ev) {
          var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
          if (!d || busy || ev.ctrlKey || ev.metaKey) return;
          ev.preventDefault();
          var now = Date.now();
          if (now - lastPush > 600) pushHistory();
          lastPush = now; touched = true;
          var k = ui.photoC.getBoundingClientRect().width / photo.width;   // one screen pixel, in photo pixels, is 1 / k
          var step = (ev.shiftKey ? 10 : 1) / (k || 1);
          quad[i] = [Math.max(0, Math.min(photo.width, quad[i][0] + d[0] * step)), Math.max(0, Math.min(photo.height, quad[i][1] + d[1] * step))];
          draw(); syncButtons();
        };
      }

      function undoMove() {
        if (busy || !history.length) return;
        quad = history.pop();
        draw(); syncButtons();
        say('Undid a move.');
      }
      function onKey(ev) {
        if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'z' || ev.key === 'Z')) { ev.preventDefault(); undoMove(); }
      }

      function detectAgain() {
        setBusy(true); say('Looking for the page…');
        return job('detect', photo).then(function (d) {
          pushHistory();
          auto = clone(d.quad); confidence = d.confidence;
          quad = clone(d.quad); touched = false;
          draw();
          say(d.method === 'fallback'
            ? "I couldn't find the edges of the page. Drag the corners onto it."
            : d.confidence < LOW_CONFIDENCE
              ? 'I found something, but I am not sure of it. Check the corners.'
              : 'Found the page. Move a corner if it is off.');
        }).catch(function (e) { say(e.message || 'Detection failed.'); })
          .then(function () { setBusy(false); });
      }

      function doApply() {
        setBusy(true); say('Making the page…');
        job('process', photo, { quad: quad, mode: ui.modeSel.value, maxDim: STORE_MAX }).then(function (r) {
          return blobOf(r.imageData, ui.modeSel.value).then(function (blob) {
            end({ quad: clone(quad), auto: auto ? clone(auto) : clone(quad), mode: ui.modeSel.value, confidence: confidence,
              history: history.slice(-HISTORY_MAX), manual: touched, processed: { blob: blob, w: r.w, h: r.h }, pw: photo.width, ph: photo.height });
          });
        }).catch(function (e) { say(e.message || 'The page could not be made.'); setBusy(false); });
      }

      dlg.addEventListener('cancel', onCancel);
      dlg.addEventListener('keydown', onKey);
      dlg.addEventListener('close', onClosed);
      if (!dlg.open) dlg.showModal();

      loadPhoto(opts.url).then(function (p) {
        if (done) return;
        photo = p;
        var W = p.width, H = p.height, k = Math.min(1, 1000 / Math.max(W, H));
        ui.photoC.width = Math.round(W * k); ui.photoC.height = Math.round(H * k);
        ui.photoC.getContext('2d').drawImage(p.canvas, 0, 0, ui.photoC.width, ui.photoC.height);
        ui.stage.style.maxWidth = ui.photoC.width + 'px';
        ui.svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        ui.handles.forEach(function (b, i) { b.hidden = false; wireHandle(b, i); });
        ui.again.onclick = detectAgain;
        ui.reset.onclick = function () { if (auto) { setQuad(auto, true); touched = false; say('Back to what Detect found.'); } };
        ui.undo.onclick = undoMove;
        ui.cancel.onclick = function () { end(null); };
        ui.apply.onclick = doApply;
        ui.modeSel.onchange = function () { schedulePreview(); };
        if (rec && rec.quad) {
          quad = clone(rec.quad); auto = rec.auto ? clone(rec.auto) : null; confidence = rec.confidence || 0;
          history = (rec.history || []).map(clone);
          draw(); setBusy(false); say('');
        } else {
          // the frame inset until Detect answers, so the handles show at once
          var W2 = W * 0.04, H2 = H * 0.04;
          quad = [[W2, H2], [W - W2, H2], [W - W2, H - H2], [W2, H - H2]];
          draw();
          detectAgain();
        }
        var first = ui.handles[0]; if (first && !busy) first.focus();
      }).catch(function (e) {
        say(e.message || 'That photo could not be read.');
        ui.cancel.disabled = false;
        ui.cancel.onclick = function () { end(null); };
      });
    });
  }

  window.ScanUI = { open: open, autoScan: autoScan, loadPhoto: loadPhoto, job: job, blobOf: blobOf, finish: finish,
    ensureScan: ensureScan, LOW_CONFIDENCE: LOW_CONFIDENCE };
})();
