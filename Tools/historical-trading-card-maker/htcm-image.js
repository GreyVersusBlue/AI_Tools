/* htcm-image.js — photo import pipeline for the Historical Trading Card Maker.
   Reads a picked file, scales its long edge down to IMAGE_MAX_DIM, and hands
   back a JPEG data URL plus its pixel size (the crop editor needs the
   dimensions for its math). PNG sources with transparency get a white matte
   rather than black, since cards land on white printed paper.

   Adapted from the clue-image pipeline in Tools/030-review-game-board.html.
   That makes this the fifth copy of the downscale pattern in the repo
   (seating-chart, timeline-builder, certificate-award-maker, review-game-board
   have their own) — extracting a shared _shared/image-import.js and pointing
   all five at it is the agreed follow-up, out of scope for this tool's
   upgrade round. */
(function () {
  'use strict';

  var IMAGE_MAX_DIM = 1000; // long edge px: plenty for a 2.5in card at 300 DPI
  var IMAGE_QUALITY = 0.72; // keeps a phone photo around ~100 KB

  function approxKb(dataUrl) {
    // base64 carries 3 bytes per 4 characters; close enough to show a teacher.
    return Math.max(1, Math.round(String(dataUrl || '').length * 0.75 / 1024));
  }

  /** cb({src, w, h}) with the downscaled JPEG data URL and its pixel size. */
  function readAndDownscale(file, cb, onError) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, IMAGE_MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.max(1, Math.round(img.naturalWidth * scale));
        var h = Math.max(1, Math.round(img.naturalHeight * scale));
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        cb({ src: canvas.toDataURL('image/jpeg', IMAGE_QUALITY), w: w, h: h });
      };
      img.onerror = function () { onError('That file could not be read as an image.'); };
      img.src = reader.result;
    };
    reader.onerror = function () { onError('That file could not be read.'); };
    reader.readAsDataURL(file);
  }

  window.HtcmImage = {
    readAndDownscale: readAndDownscale,
    approxKb: approxKb
  };
})();
