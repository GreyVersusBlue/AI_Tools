/* qr-scan.js — point a device camera at a QR code and get the decoded text
   back, using getUserMedia + jsQR. jsQR itself is NOT bundled here: it's
   ~250KB and not every page that wants this wrapper wants that payload, so
   the page loads it itself from _shared/vendor/jsqr/jsqr.js — this just
   expects window.jsQR to already be there by the time something calls
   scanQRFromCamera().

   Plain global script, matching this site's classic-script tools. */
(function (global) {
  'use strict';

  /**
   * Streams the camera into `videoEl` and polls frames for a QR code.
   * Calls `opts.onResult(text)` once, the first time one decodes, then stops
   * the camera automatically. `opts.onError(err)` fires if the camera can't
   * be opened at all (no camera, permission denied, not a secure context).
   * Returns `{ stop }` so the caller can cancel before anything is found —
   * e.g. the user closes the scanner.
   */
  function scanQRFromCamera(videoEl, opts) {
    opts = opts || {};
    var onResult = opts.onResult || function () {};
    var onError = opts.onError || function () {};
    var stopped = false;
    var stream = null;
    var rafId = null;
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d', { willReadFrequently: true });

    function stop() {
      if (stopped) return;
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      videoEl.srcObject = null;
    }

    function tick() {
      if (stopped) return;
      if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA && videoEl.videoWidth) {
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        var imageData;
        try {
          imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch (e) {
          rafId = requestAnimationFrame(tick);
          return;
        }
        var code = global.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
        if (code && code.data) {
          stop();
          onResult(code.data);
          return;
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    if (!global.navigator.mediaDevices || !global.navigator.mediaDevices.getUserMedia) {
      onError(new Error('Camera access isn’t available in this browser.'));
      return { stop: stop };
    }

    global.navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(function (s) {
        if (stopped) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        stream = s;
        videoEl.srcObject = s;
        videoEl.setAttribute('playsinline', ''); // iOS Safari: without this it forces fullscreen
        videoEl.play();
        rafId = requestAnimationFrame(tick);
      })
      .catch(function (err) { onError(err); });

    return { stop: stop };
  }

  global.QRScan = { scanQRFromCamera: scanQRFromCamera };
})(window);
