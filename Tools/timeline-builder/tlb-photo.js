/* Timeline Builder — photo downscaling.
   Browser-only (needs Image/canvas), so unlike the other tlb-*.js modules
   this one isn't unit-tested in Node — it's covered by an end-to-end
   headless-browser pass that uploads a real image and checks the stored
   data URL actually shrank. Downscaling keeps embedded photos from being
   the thing that blows through localStorage's quota after a few events. */
(function (global) {
  'use strict';

  var MAX_DIMENSION = 480; // px, long edge
  var JPEG_QUALITY = 0.72;

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
          resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  global.TimelinePhoto = { downscaleImage: downscaleImage, MAX_DIMENSION: MAX_DIMENSION };
})(window);
