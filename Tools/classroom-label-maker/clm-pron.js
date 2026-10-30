/* Classroom Label Maker — teacher-recorded pronunciations (Path 19 P5). Publishes window.ClmPron.

   For a word whose language has no voice on this device, the teacher says the word into the
   microphone and the recording is kept here, in the browser's media store (_shared/media-db.js,
   namespace `labels`), under an id made from the language and the word. It plays back in this
   tool. It is NOT in the label's QR code: a phone that scans a label speaks the word with its
   own voice (speak.html), and a recording cannot ride in a QR, so this is for the teacher's
   device and the classroom screen.

   A recording is a voice, kept on this device only, and never leaves the browser: no upload, no
   file. It holds no student's name. The microphone is asked for only when Record is pressed, and
   its tracks are released as soon as the recording stops.

     ClmPron.key(lang, target)        the media-store id for a word
     ClmPron.supported()              whether this browser can record and keep a recording
     ClmPron.record(maxMs)            -> { stop() } : starts at once; stop() resolves with the Blob
                                         (or rejects with a message fit to show a teacher)
     ClmPron.save(lang, target, blob) / ClmPron.has() / ClmPron.play(lang, target) / ClmPron.remove(...)  */
(function (root) {
  'use strict';

  var NS = 'labels';
  var MAX_MS = 10000;

  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  /* No "/" (the store forbids it in a namespace, and an id with one reads as a path). */
  function key(lang, target) {
    return 'pron:' + encodeURIComponent(norm(lang) + '|' + norm(target)).slice(0, 180);
  }

  function store() { return root.MediaDB && root.MediaDB.store({ ns: NS }); }

  function supported() {
    return !!(root.MediaDB && root.MediaRecorder && root.navigator && root.navigator.mediaDevices &&
      root.navigator.mediaDevices.getUserMedia);
  }

  function describe(e) {
    var n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return 'The microphone is blocked for this page. Allow it in the browser\'s address bar and try again.';
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No microphone was found on this device.';
    if (n === 'NotReadableError') return 'The microphone is busy in another program.';
    return 'Could not record: ' + ((e && e.message) || 'unknown error') + '.';
  }

  function record(maxMs) {
    var limit = Math.max(500, Math.min(maxMs || MAX_MS, 30000));
    var ready = root.navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var rec = new root.MediaRecorder(stream), chunks = [], timer = null, finish;
      var done = new Promise(function (resolve, reject) {
        finish = { resolve: resolve, reject: reject };
      });
      function release() { clearTimeout(timer); stream.getTracks().forEach(function (t) { t.stop(); }); }
      rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
      rec.onerror = function (ev) { release(); finish.reject(new Error(describe(ev && ev.error))); };
      rec.onstop = function () {
        release();
        var blob = new root.Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        if (blob.size) finish.resolve(blob); else finish.reject(new Error('Nothing was recorded.'));
      };
      rec.start();
      timer = setTimeout(function () { if (rec.state !== 'inactive') rec.stop(); }, limit);
      return { rec: rec, done: done };
    }, function (e) { throw new Error(describe(e)); });
    return {
      stop: function () {
        return ready.then(function (r) { if (r.rec.state !== 'inactive') r.rec.stop(); return r.done; });
      },
      /* resolves when the microphone is open and recording has begun */
      started: ready.then(function () { return true; })
    };
  }

  function save(lang, target, blob) { return store().put(key(lang, target), blob, { kind: 'pronunciation', lang: norm(lang) }); }

  /* The set of keys that have a recording, as an object, for drawing a table in one read. */
  function has() {
    var s = store();
    if (!s) return Promise.resolve({});
    return s.list().then(function (rows) {
      var out = {};
      (rows || []).forEach(function (r) { out[r.id] = true; });
      return out;
    }, function () { return {}; });
  }

  function play(lang, target) {
    return store().getBlob(key(lang, target)).then(function (blob) {
      if (!blob) return false;
      var url = root.URL.createObjectURL(blob), a = new root.Audio(url);
      function free() { root.URL.revokeObjectURL(url); }
      a.onended = free; a.onerror = free;
      return a.play().then(function () { return true; }, function () { free(); return false; });
    }, function () { return false; });
  }

  function remove(lang, target) { return store().remove(key(lang, target)); }

  root.ClmPron = { NS: NS, MAX_MS: MAX_MS, key: key, supported: supported, record: record, save: save, has: has, play: play, remove: remove };
})(typeof window !== 'undefined' ? window : globalThis);
