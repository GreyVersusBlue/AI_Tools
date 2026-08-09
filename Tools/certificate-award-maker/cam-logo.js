/* Certificate & Award Maker — logo/crest image downscaling.
   Mirrors Timeline Builder's tlb-photo.js pattern: read the uploaded file,
   draw it downscaled onto an off-screen canvas, and hand back a small data
   URL to persist. A school crest or mascot only needs to be legible at
   corner size, and localStorage has a real cost to keeping the original
   photo resolution around — PNG (not JPEG) so a crest's transparent
   background survives the round trip. */
(function (global) {
  'use strict';

  var MAX_DIMENSION = 200; // px, long edge

  function downscaleImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read that image file.')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('Could not decode that image file.')); };
        img.onload = function () {
          var scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
          var w = Math.max(1, Math.round(img.width * scale));
          var h = Math.max(1, Math.round(img.height * scale));
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png'));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  global.CertificateLogo = { downscaleImage: downscaleImage, MAX_DIMENSION: MAX_DIMENSION };
})(window);
