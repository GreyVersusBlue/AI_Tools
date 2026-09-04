/* share.js — one share sheet for every tool. Path 6 P1. `window.Share`.

   Seventeen tools share state through state-link.js, and each grew its own
   share UI: a "copy link" button, sometimes a QR modal with its own drawQR,
   sometimes navigator.share, and four of them a hand-written "too long for
   a QR" fallback that only fires when the encoder throws. This is the one
   sheet they will all open (Path 6 P2 adopts it; P1 ships it with 064 as the
   single adopter):

       Share.mount(button, { getState, param, title, filename, ... })

   Clicking `button` opens a small dialog with four rows:

     Copy link        the state-link URL, on the clipboard (or shown in a box
                      when the clipboard is unavailable — file://, no HTTPS)
     Show QR code     drawn by _shared/qr-draw.js, greyed out with the reason
                      when the code would be too dense to scan at this size
     Download file    a .json of the FULL state, images included
     Share…           navigator.share, only where the browser has it

   POLICY — images never ride in a link. A photo is a data: URL of tens of
   KB or more; a URL bar holds a few KB and a QR code far less, and every
   adopter had to discover that on its own (028, 050, 056, 064 each strip
   images by hand). Here stripImages() walks the state and drops any string
   that is a data:image/… or blob: URL before the link is built, and the
   sheet SAYS SO — "2 photos are left out of the link and QR code; the
   downloaded file carries them." The download gets the untouched state.

   The download is `{ aplp: { v, tool, param, exported }, state }`, so a file
   can say which tool it belongs to; the receiving side of that (open a .json
   the way ?state= is opened) is Path 6 P2's, alongside the link receiver.

   Depends on state-link.js (the URL) and, for the QR row, qr-draw.js plus
   the vendored encoder. A page that loads share.js without state-link.js is
   a deployment mistake and is told so at mount, not at the first click.

   Plain global script; see state-link.js for why not an ES module. */
(function (global) {
  'use strict';

  var doc = global.document;
  var STYLE_ID = 'share-sheet-style';
  var openSheet = null;

  /* ── pure helpers ─────────────────────────────────────────────────── */

  function isImageString(s) {
    return typeof s === 'string' && (/^data:image\//i.test(s) || /^blob:/i.test(s));
  }

  /**
   * A deep copy of `value` with every data:image/… or blob: string replaced
   * by null. Returns { value, stripped } where stripped is how many were
   * dropped. Never mutates the input.
   */
  function stripImages(value) {
    var count = 0;
    function walk(v) {
      if (isImageString(v)) { count++; return null; }
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === 'object') {
        var out = {};
        for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) out[k] = walk(v[k]);
        return out;
      }
      return v;
    }
    return { value: walk(value), stripped: count };
  }

  /** "My Deck: Period 3!" -> "My Deck Period 3", then the extension. */
  function filename(name, ext) {
    var base = String(name == null ? '' : name).replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, ' ');
    return (base || 'shared') + (ext || '.json');
  }

  function kb(bytes) {
    return bytes < 1024 ? bytes + ' bytes' : (Math.round(bytes / 102.4) / 10) + ' KB';
  }

  /**
   * The link for `opts.getState()`: { url, payload, stripped, bytes }, or
   * null when getState returns null/undefined (nothing to share yet).
   */
  function buildLink(opts) {
    var state = opts.getState ? opts.getState() : null;
    if (state === null || state === undefined) return null;
    var s = opts.stripImages === false ? { value: state, stripped: 0 } : stripImages(state);
    var url = global.StateLink.buildShareUrl(opts.param || 'state', s.value, { base: opts.base });
    return { url: url, payload: s.value, stripped: s.stripped, bytes: byteLength(url), state: state };
  }

  function byteLength(text) {
    if (global.QrDraw) return global.QrDraw.byteLength(text);
    return unescape(encodeURIComponent(String(text))).length;
  }

  /** The .json the Download row hands over, as a string. */
  function fileContents(opts, state) {
    return JSON.stringify({
      aplp: { v: 1, tool: opts.tool || null, param: opts.param || 'state', exported: new Date().toISOString() },
      state: state
    }, null, 2);
  }

  /** Hands `text` to the browser as a file download named `name`. */
  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = doc.createElement('a');
    a.href = url;
    a.download = name;
    doc.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function copyText(text) {
    var nav = global.navigator;
    if (nav && nav.clipboard && nav.clipboard.writeText) return nav.clipboard.writeText(text);
    return Promise.reject(new Error('clipboard unavailable'));
  }

  /* ── the sheet ────────────────────────────────────────────────────── */

  function ensureStyle() {
    if (doc.getElementById(STYLE_ID)) return;
    var st = doc.createElement('style');
    st.id = STYLE_ID;
    st.textContent =
      '.share-sheet-backdrop{position:fixed;inset:0;z-index:2147483000;background:rgba(10,10,14,.55);display:flex;align-items:center;justify-content:center;padding:16px}' +
      '.share-sheet{background:var(--card,#fff);color:var(--ink,#1f2430);border:1px solid var(--line,#dcdad2);border-radius:12px;padding:16px 18px 14px;width:min(100%,420px);max-height:calc(100vh - 32px);overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.4);font-size:.95rem;line-height:1.45}' +
      '.share-sheet-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 6px}' +
      '.share-sheet-head h2{font-size:1.05rem;margin:0}' +
      '.share-sheet-close{width:auto;margin:0;padding:.2rem .6rem;font-size:1.2rem;line-height:1;background:transparent;color:inherit;border:1px solid var(--line,#dcdad2);border-radius:6px;cursor:pointer}' +
      '.share-sheet-note{margin:0 0 10px;font-size:.85rem;color:var(--muted,#6b6a63)}' +
      '.share-sheet-rows{display:flex;flex-direction:column;gap:6px;margin:0}' +
      '.share-sheet-rows button{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;margin:0;padding:.6rem .8rem;text-align:left;font:inherit;font-weight:600;background:var(--card-2,#f1f0ea);color:inherit;border:1px solid var(--line,#dcdad2);border-radius:8px;cursor:pointer}' +
      '.share-sheet-rows button:hover:not([disabled]){border-color:var(--accent,#1f3550)}' +
      '.share-sheet-rows button[disabled]{opacity:.55;cursor:not-allowed}' +
      '.share-sheet-rows small{font-weight:400;color:var(--muted,#6b6a63);white-space:nowrap}' +
      '.share-sheet-reason{margin:6px 0 0;font-size:.82rem;color:var(--muted,#6b6a63)}' +
      '.share-sheet-qr{margin:12px 0 0;text-align:center}' +
      '.share-sheet-qr canvas{display:block;margin:0 auto;image-rendering:pixelated;background:#fff}' +
      '.share-sheet-qr p{margin:.5rem 0 0;font-size:.82rem;color:var(--muted,#6b6a63)}' +
      '.share-sheet-status{margin:10px 0 0;font-size:.85rem;min-height:1.2em;word-break:break-word}' +
      '.share-sheet-status.error{color:var(--err,#a3372b)}' +
      '.share-sheet-url{display:block;width:100%;margin:6px 0 0;font:inherit;font-size:.8rem;padding:.4rem .5rem;border:1px solid var(--line,#dcdad2);border-radius:6px;background:var(--card,#fff);color:inherit}';
    doc.head.appendChild(st);
  }

  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function row(action, label, sub) {
    var b = el('button');
    b.type = 'button';
    b.setAttribute('data-share', action);
    b.appendChild(el('span', null, label));
    if (sub) b.appendChild(el('small', null, sub));
    return b;
  }

  function qrMaxPx(opts) {
    var w = global.innerWidth || 1024, h = global.innerHeight || 768;
    return Math.max(120, Math.min(opts.maxQrPx || 480, w - 80, h - 300));
  }

  /**
   * Opens the sheet now. `opts` as for mount(); opts.opener is the element
   * to return focus to. Returns { root, close, link } — `link` is what
   * buildLink() returned (null when there was nothing to share, in which
   * case no sheet opens and opts.onMessage gets told).
   */
  function open(opts) {
    opts = opts || {};
    if (!global.StateLink) throw new Error('share.js needs _shared/state-link.js loaded first');
    var onMessage = opts.onMessage || function () {};
    var link = buildLink(opts);
    if (!link) {
      onMessage(opts.emptyMessage || 'There is nothing to share yet.');
      return { root: null, close: function () {}, link: null };
    }
    if (openSheet) openSheet.close();
    ensureStyle();

    var noun = opts.noun || 'this';
    var titleId = 'share-sheet-title-' + Date.now().toString(36);
    var backdrop = el('div', 'share-sheet-backdrop');
    var sheet = el('div', 'share-sheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', titleId);

    var head = el('div', 'share-sheet-head');
    var h = el('h2', null, opts.title || 'Share');
    h.id = titleId;
    var closeBtn = el('button', 'share-sheet-close', '×');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    head.appendChild(h);
    head.appendChild(closeBtn);
    sheet.appendChild(head);

    var noteText = opts.note || '';
    if (link.stripped) {
      noteText += (noteText ? ' ' : '') + link.stripped + (link.stripped === 1 ? ' image is' : ' images are') +
        ' left out of the link and QR code; the downloaded file carries ' + (link.stripped === 1 ? 'it' : 'them') + '.';
    }
    var note = el('p', 'share-sheet-note', noteText);
    if (noteText) sheet.appendChild(note);

    var rows = el('div', 'share-sheet-rows');
    var copyBtn = row('copy', 'Copy link', kb(link.bytes));
    var qrPlan = global.QrDraw ? global.QrDraw.plan(link.url, { maxPx: qrMaxPx(opts) }) : null;
    var qrBtn = row('qr', 'Show QR code', qrPlan && qrPlan.ok ? (qrPlan.modules + '×' + qrPlan.modules) : 'too dense to scan');
    var wanted = typeof opts.filename === 'function' ? opts.filename() : opts.filename;
    var dlName = filename(wanted || opts.title || 'shared', opts.ext || '.json');
    var dlBtn = row('download', 'Download file', dlName);
    rows.appendChild(copyBtn);
    rows.appendChild(qrBtn);
    rows.appendChild(dlBtn);
    var nav = global.navigator;
    var nativeBtn = null;
    if (nav && typeof nav.share === 'function') {
      nativeBtn = row('native', 'Share…', 'system share sheet');
      rows.appendChild(nativeBtn);
    }
    sheet.appendChild(rows);

    var reason = el('p', 'share-sheet-reason');
    reason.id = titleId + '-qr-reason';
    if (!qrPlan) {
      qrBtn.disabled = true;
      reason.textContent = 'QR codes are not available on this page.';
    } else if (!qrPlan.ok) {
      qrBtn.disabled = true;
      qrBtn.setAttribute('aria-describedby', reason.id);
      reason.textContent = qrPlan.reason;
    }
    if (reason.textContent) sheet.appendChild(reason);

    var qrBox = el('div', 'share-sheet-qr');
    var canvas = doc.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'QR code for this link');
    qrBox.appendChild(canvas);
    qrBox.appendChild(el('p', null, opts.qrNote || 'Scan with a phone camera to open this link there.'));

    var status = el('p', 'share-sheet-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    sheet.appendChild(status);

    var urlBox = doc.createElement('input');
    urlBox.className = 'share-sheet-url';
    urlBox.type = 'text';
    urlBox.readOnly = true;
    urlBox.setAttribute('aria-label', 'Shareable link');

    backdrop.appendChild(sheet);
    doc.body.appendChild(backdrop);

    function say(text, isError) {
      status.textContent = text || '';
      status.classList.toggle('error', !!isError);
      onMessage(text);
    }

    copyBtn.addEventListener('click', function () {
      copyText(link.url).then(function () {
        say(opts.successMessage || ('Link copied. Paste it anywhere to open ' + noun + ' exactly as it is now.'));
      }, function () {
        if (!urlBox.isConnected) sheet.insertBefore(urlBox, status);
        urlBox.value = link.url;
        urlBox.focus();
        urlBox.select();
        say('The clipboard is not available here. The link is in the box above; select it and copy.', true);
      });
    });

    qrBtn.addEventListener('click', function () {
      if (qrBtn.disabled) return;
      var p = global.QrDraw.draw(canvas, link.url, { maxPx: qrMaxPx(opts) });
      if (!p.ok) { say(p.reason, true); return; }
      if (!qrBox.isConnected) sheet.insertBefore(qrBox, status);
      say(opts.qrMessage || '');
    });

    dlBtn.addEventListener('click', function () {
      download(dlName, fileContents(opts, link.state));
      say('Saved as ' + dlName + '.');
    });

    if (nativeBtn) {
      nativeBtn.addEventListener('click', function () {
        nav.share({ title: opts.title || doc.title, url: link.url }).then(function () {
          say('Shared.');
        }, function (e) {
          if (e && e.name === 'AbortError') return; // the teacher closed the system sheet
          say('Sharing did not go through. Copy the link instead.', true);
        });
      });
    }

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Tab') {
        var focusables = sheet.querySelectorAll('button:not([disabled]),input');
        var first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    function onBackdrop(e) { if (e.target === backdrop) close(); }

    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      doc.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      if (openSheet === handle) openSheet = null;
      if (opts.opener && opts.opener.focus) opts.opener.focus();
      if (opts.onClose) opts.onClose();
    }
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('mousedown', onBackdrop);
    doc.addEventListener('keydown', onKey, true);

    var handle = { root: backdrop, close: close, link: link };
    openSheet = handle;
    if (opts.onOpen) opts.onOpen(handle);
    copyBtn.focus();
    return handle;
  }

  /**
   * Wires `button` to open the sheet. Options:
   *
   *   getState()       the full state to share; null/undefined = nothing yet
   *   param            the query-string parameter the tool reads back (state-link)
   *   base             the page the link opens (defaults to this page)
   *   title            the sheet heading ("Share this deck")
   *   noun             "this deck" — used in the default copy message
   *   note             one sentence on what travels
   *   filename, ext    the download name (sanitised; ".json" by default); filename
   *                    may be a function, read when the sheet opens
   *   tool             the tool slug, written into the file header
   *   stripImages      false to keep images in the link (default true)
   *   successMessage, emptyMessage, qrNote, onMessage(text), onOpen, onClose
   *
   * Returns { open, close, destroy }.
   */
  function mount(button, opts) {
    opts = opts || {};
    if (!global.StateLink) throw new Error('share.js needs _shared/state-link.js loaded first');
    var current = null;
    function openNow() {
      current = open(Object.assign({}, opts, { opener: button }));
    }
    button.addEventListener('click', openNow);
    return {
      open: openNow,
      close: function () { if (current) current.close(); },
      destroy: function () { button.removeEventListener('click', openNow); if (current) current.close(); }
    };
  }

  global.Share = {
    mount: mount,
    open: open,
    close: function () { if (openSheet) openSheet.close(); },
    buildLink: buildLink,
    stripImages: stripImages,
    filename: filename,
    fileContents: fileContents,
    download: download
  };
})(window);
