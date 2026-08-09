/* Seating Chart Generator — student photo downscaling.
   Browser-only (needs Image/canvas), so like Timeline Builder's tlb-photo.js
   this isn't unit-tested in Node. Desk thumbnails are tiny, so the target size
   is a small avatar rather than a hero photo — keeps 30 students' worth of
   photos well inside localStorage's quota alongside everything else the chart
   saves. */
(function (global) {
  'use strict';

  var MAX_DIMENSION = 160; // px, long edge
  var JPEG_QUALITY = 0.75;

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

  global.SeatingPhoto = { downscaleImage: downscaleImage, MAX_DIMENSION: MAX_DIMENSION };
})(window);
