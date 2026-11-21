/* ocr.js — OcrKit, the reading half of 011's "Make the PDF searchable" (Path 17 P5).
 *
 * A plain global script, loaded by 011 only when a teacher ticks the OCR box (the way pdf.js is
 * loaded only when a PDF is chosen), publishing window.OcrKit. It wraps the vendored Tesseract.js
 * (_shared/vendor/tesseract/, English, about 7 MB a device fetches) and adds nothing else.
 *
 *   OcrKit.ready(onStatus)      -> Promise   loads the engine; rejects with a plain sentence
 *   OcrKit.recognize(src)       -> Promise<{ w, h, words }>   src is a data: or blob: URL;
 *                                  words are { t, x0, y0, x1, y1 } as fractions of the picture
 *   OcrKit.layer(doc, words, box, K, font) -> number   draws the words as invisible text on the
 *                                  jsPDF page `doc`, over box { x, y, w, h } in mm (times K, the
 *                                  page's unit per mm, as 011's other drawing steps use it)
 *   OcrKit.clean(text)          -> string    what a word may be in a standard PDF font
 *   OcrKit.release()            terminates the worker (011 calls it when a build finishes)
 *
 * The files are fetched only when OCR is first used and cached by the service worker's
 * same-origin runtime cache on that use (they are not in sw.js's precache). The first use needs a
 * connection; Tesseract's own IndexedDB cache is off (cacheMethod 'none') so there is one cache,
 * the worker's, and it goes with a CACHE_VERSION bump. Nothing is stored by this file.
 */
(function () {
  'use strict';

  var DIR = '../_shared/vendor/tesseract';
  var MAX_EDGE = 2200;          // the long edge the picture is read at; a bigger one is shrunk
  var MIN_CONFIDENCE = 20;      // a word Tesseract is below this sure of is left out
  var OFFLINE = 'Reading the text needs the OCR files, which download the first time you use it (about 7 MB). ' +
    "That download didn't finish. Connect and try again, or untick “Make the PDF searchable” to make the PDF without it.";

  function abs(path) { return new URL(path, document.baseURI).href; }

  var scriptLoading = null;
  function loadEngine() {
    if (window.Tesseract) return Promise.resolve();
    if (!scriptLoading) {
      scriptLoading = new Promise(function (res, rej) {
        var el = document.createElement('script');
        el.src = DIR + '/tesseract.min.js';
        el.onload = function () { res(); };
        el.onerror = function () { rej(new Error(OFFLINE)); };
        document.head.appendChild(el);
      }).catch(function (e) { scriptLoading = null; throw e; });
    }
    return scriptLoading;
  }

  var workerLoading = null, onStatus = function () {};
  function say(m) {
    if (!m || !m.status) return;
    var pct = typeof m.progress === 'number' ? ' ' + Math.round(m.progress * 100) + '%' : '';
    var words = {
      'loading tesseract core': 'Loading the OCR engine (first time only)',
      'loading language traineddata': 'Loading the English reading data (first time only)',
      'initializing api': 'Starting the OCR engine',
      'recognizing text': 'Reading the text'
    };
    if (words[m.status]) onStatus(words[m.status] + pct);
  }

  function ready(status) {
    if (status) onStatus = status;
    if (!workerLoading) {
      workerLoading = loadEngine().then(function () {
        // oem 1 is LSTM only: it picks the *-lstm cores and the 2.9 MB integer model vendored here.
        return window.Tesseract.createWorker('eng', 1, {
          workerPath: abs(DIR + '/worker.min.js'),
          corePath: abs(DIR),
          langPath: abs(DIR),
          cacheMethod: 'none',
          gzip: true,
          workerBlobURL: false,
          logger: say
        });
      }).catch(function (e) {
        workerLoading = null;
        throw new Error(e && /^Reading the text/.test(e.message) ? e.message : OFFLINE);
      });
    }
    return workerLoading;
  }

  function release() {
    var p = workerLoading;
    workerLoading = null;
    onStatus = function () {};
    if (p) p.then(function (w) { return w.terminate(); }).catch(function () {});
  }

  function toCanvas(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () {
        var s = Math.min(1, MAX_EDGE / Math.max(im.naturalWidth, im.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.naturalWidth * s));
        c.height = Math.max(1, Math.round(im.naturalHeight * s));
        var x = c.getContext('2d');
        x.fillStyle = '#fff';           // a transparent PNG would read as black on black
        x.fillRect(0, 0, c.width, c.height);
        x.drawImage(im, 0, 0, c.width, c.height);
        res(c);
      };
      im.onerror = function () { rej(new Error("The picture couldn't be read for OCR.")); };
      im.src = src;
    });
  }

  function recognize(src) {
    return Promise.all([ready(), toCanvas(src)]).then(function (a) {
      var worker = a[0], canvas = a[1];
      return worker.recognize(canvas, {}, { blocks: true }).then(function (r) {
        var words = [];
        ((r.data && r.data.blocks) || []).forEach(function (b) {
          (b.paragraphs || []).forEach(function (p) {
            (p.lines || []).forEach(function (l) {
              (l.words || []).forEach(function (w) {
                var t = clean(w.text);
                if (!t || !w.bbox || w.confidence < MIN_CONFIDENCE) return;
                words.push({ t: t, x0: w.bbox.x0 / canvas.width, y0: w.bbox.y0 / canvas.height,
                             x1: w.bbox.x1 / canvas.width, y1: w.bbox.y1 / canvas.height });
              });
            });
          });
        });
        return { w: canvas.width, h: canvas.height, words: words };
      });
    });
  }

  // A standard PDF font holds Latin-1 only; anything else would come out as other letters.
  function clean(text) {
    return String(text == null ? '' : text).replace(/[^\x21-\x7e\xa1-\xff]/g, '').trim();
  }

  function layer(doc, words, box, K, font) {
    doc.setFont(font || 'helvetica', 'normal');
    doc.setTextColor(0);
    var n = 0;
    words.forEach(function (w) {
      var t = clean(w.t);
      var hMm = (w.y1 - w.y0) * box.h;
      var wUnits = (w.x1 - w.x0) * box.w * K;
      if (!t || !(hMm > 0) || !(wUnits > 0)) return;
      // The size that makes the word as wide as the printed one: the text is invisible, so its
      // height does not matter, but a selection box and a search highlight follow its width.
      doc.setFontSize(10);
      var natural = doc.getTextWidth(t);
      if (!(natural > 0)) return;
      doc.setFontSize(Math.max(1, Math.min(400, 10 * wUnits / natural)));
      doc.text(t, (box.x + w.x0 * box.w) * K, (box.y + w.y1 * box.h - hMm * 0.2) * K, { renderingMode: 'invisible' });
      n++;
    });
    return n;
  }

  window.OcrKit = { ready: ready, recognize: recognize, layer: layer, clean: clean, release: release };
})();
