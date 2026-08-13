/* htcm-export.js — PNG / PDF / ZIP export for the Historical Trading Card
   Maker, built on a hand-drawn canvas renderer.

   Why hand-drawn: the repo vendors no html2canvas and bans CDNs, and the SVG
   foreignObject snapshot trick taints canvases in Safari and rasterizes CSS
   inconsistently. A card is a known, closed layout — and phases 2–4
   deliberately defined every decorative element as data + SVG-string
   generators, so this renderer reuses them instead of re-inventing them:

   - frames, foil gradients, stat icons: the same SVG strings the DOM shows,
     rasterized via data: URIs (same-origin, no taint). The shared <defs> are
     inlined into each SVG first, since a standalone SVG image can't resolve
     url(#…) refs into the host document.
   - the photo: the same {crop, shape, filter} numbers, via
     HtcmPhoto.sourceRect() and Path2D(HtcmFrames.shapePath(...)).
   - colors and fonts: the same HtcmThemes data the CSS is generated from.

   The only layout logic that exists twice is text line-breaking (wrapText
   below vs. the browser's), which is bounded and cosmetic. Card paper
   textures are CSS-only and capped at ~6% alpha; the export keeps flat
   paper — the one visible simplification.

   Everything renders at 300 DPI: a 2.5in × 3.5in card is 750 × 1050. */
(function (global) {
  'use strict';

  var DPI = 300;
  var K = DPI / 96;              // CSS px → device px
  var W = 2.5 * DPI, H = 3.5 * DPI;
  var PAD = 0.15 * DPI;

  /* photo-window boxes, mirroring the .pwin CSS (device px) */
  var WINDOWS = {
    rrect: { w: W - 2 * PAD, h: 1.35 * DPI }, oval: { w: W - 2 * PAD, h: 1.35 * DPI },
    hex: { w: W - 2 * PAD, h: 1.35 * DPI },
    circle: { w: 1.5 * DPI, h: 1.5 * DPI }, shield: { w: 1.45 * DPI, h: 1.6 * DPI },
    arch: { w: 1.45 * DPI, h: 1.7 * DPI }
  };

  function slug(name) {
    return String(name || 'card').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'card';
  }

  function loadImage(src, cb) {
    var img = new Image();
    img.onload = function () { cb(img); };
    img.onerror = function () { cb(null); };
    img.src = src;
  }

  /** Rasterize an SVG string at wPx × hPx. Explicit width/height attributes
      are injected so the rasterizer knows the target size, and the xmlns
      declaration too — inline HTML SVG doesn't need one, but a standalone
      SVG document (which is what a data: URI image is) refuses to load
      without it. */
  function svgToImage(svg, wPx, hPx, cb) {
    var tagEnd = svg.indexOf('>');
    var attrs = ' width="' + wPx + '" height="' + hPx + '"';
    if (svg.slice(0, tagEnd).indexOf('xmlns=') === -1) attrs += ' xmlns="http://www.w3.org/2000/svg"';
    var sized = svg.slice(0, tagEnd) + attrs + svg.slice(tagEnd);
    loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized), cb);
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapText(ctx, text, maxWidth) {
    var words = String(text).split(/\s+/), lines = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var trial = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(trial).width > maxWidth && line) { lines.push(line); line = words[i]; }
      else line = trial;
    }
    if (line) lines.push(line);
    return lines;
  }

  function resolveTheme(entry, opts) {
    var key = (entry.theme && global.HtcmThemes.get(entry.theme).key === entry.theme) ?
      entry.theme : ((opts && opts.theme) || 'classic');
    return global.HtcmThemes.get(key);
  }

  /** Renders one card side to a 750 × 1050 canvas, asynchronously (waits for
      the photo and every SVG raster), then cb(canvas). */
  function renderCardCanvas(entry, side, opts, cb) {
    var theme = resolveTheme(entry, opts);
    var meta = entry.meta || {};
    var rarity = global.HtcmThemes.RARITIES[meta.rarity] ? meta.rarity : 'common';
    var rar = global.HtcmThemes.RARITIES[rarity];
    var isBack = side === 'back';
    var upper = theme.key === 'scifi' || theme.key === 'deco';

    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    /* ---- gather the async pieces first, then draw in DOM paint order ---- */
    var pending = 1; // released by prepare()
    var frameImg = null, photoImg = null, iconImgs = {};

    function step() { pending--; if (!pending) draw(); }

    function prepare() {
      var frameSvg = global.HtcmFrames.frameSvg(theme.frame, rar.gradient);
      if (frameSvg) {
        pending++;
        var tagEnd = frameSvg.indexOf('>');
        var withDefs = frameSvg.slice(0, tagEnd + 1) + global.HtcmFrames.defsInner() + frameSvg.slice(tagEnd + 1);
        svgToImage(withDefs, W, H, function (img) { frameImg = img; step(); });
      }
      if (!isBack && entry.image) {
        pending++;
        loadImage(entry.image.src, function (img) { photoImg = img; step(); });
      }
      if (!isBack) {
        entry.stats.forEach(function (s, i) {
          var svg = global.HtcmRender.statIconSvg(s.label);
          if (!svg) return;
          pending++;
          svgToImage(svg.replace(/currentColor/g, theme.accent2), 34, 34, function (img) { iconImgs[i] = img; step(); });
        });
      }
      step(); // release the initial hold
    }

    function drawPhoto() {
      if (!photoImg) return PAD;
      var image = entry.image;
      var shape = global.HtcmFrames.SHAPES[image.shape] ? image.shape : 'rrect';
      var win = WINDOWS[shape];
      var wx = (W - win.w) / 2, wy = PAD; // banners and medallions both center
      var iw = image.w || photoImg.naturalWidth, ih = image.h || photoImg.naturalHeight;
      var rect = global.HtcmPhoto.sourceRect({ w: iw, h: ih, crop: image.crop }, win.w, win.h);
      var path = new Path2D(global.HtcmFrames.shapePath(shape, win.w, win.h));
      ctx.save();
      ctx.translate(wx, wy);
      ctx.clip(path);
      var f = global.HtcmPhoto.FILTERS[image.filter];
      if (f && f.css && 'filter' in ctx) ctx.filter = f.css;
      if (rect) ctx.drawImage(photoImg, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, win.w, win.h);
      else ctx.drawImage(photoImg, 0, 0, win.w, win.h);
      if ('filter' in ctx) ctx.filter = 'none';
      ctx.restore();
      // rim stroke in the theme accent, tracing the same shape
      ctx.save();
      ctx.translate(wx, wy);
      ctx.strokeStyle = theme.accent;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 8; // ≈ the DOM rim's 2-unit stroke after its viewBox stretch
      ctx.stroke(path);
      ctx.restore();
      return wy + win.h + 0.1 * DPI;
    }

    function drawName(y) {
      var text = upper ? String(entry.name).toUpperCase() : String(entry.name);
      var font = theme.nameFont || theme.font;
      ctx.font = '700 ' + Math.round(15.2 * K) + 'px ' + font;
      var cw = W - 2 * PAD;
      var lines = wrapText(ctx, text, cw - 20).slice(0, 2);
      var lineH = Math.round(15.2 * K * 1.3);
      var plateH = lines.length * lineH + 24;
      if (theme.key === 'sport') { // the angled red name plate, minus the skew
        roundRectPath(ctx, PAD, y, cw, plateH, 9);
        ctx.fillStyle = theme.accent; ctx.fill();
        ctx.fillStyle = '#fff';
      } else {
        roundRectPath(ctx, PAD, y, cw, plateH, 9);
        ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fill();
        ctx.fillStyle = theme.accent;
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      lines.forEach(function (line, i) {
        ctx.fillText(line, W / 2, y + 12 + lineH * (i + 0.5));
      });
      return y + plateH + 0.08 * DPI;
    }

    function drawStars(y) {
      var st = meta.stars || 0;
      if (!st) return y;
      ctx.font = Math.round(11.2 * K) + 'px "Segoe UI", sans-serif';
      ctx.fillStyle = theme.accent;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(new Array(st + 1).join('★') + new Array(5 - st + 1).join('☆'), W / 2, y);
      return y + 11.2 * K + 14;
    }

    function drawStats(y, yMax) {
      var fontPx = Math.round(11.84 * K);
      var lineH = Math.round(fontPx * 1.45);
      var x0 = PAD, cw = W - 2 * PAD;
      ctx.textBaseline = 'alphabetic';
      for (var i = 0; i < entry.stats.length; i++) {
        var s = entry.stats[i];
        if (y + lineH > yMax) break; // .cstats is overflow: hidden
        var x = x0;
        if (iconImgs[i]) { ctx.drawImage(iconImgs[i], x, y + lineH - fontPx - 2, 34, 34); x += 44; }
        var m = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(s.value);
        ctx.textAlign = 'left';
        ctx.font = '700 ' + fontPx + 'px ' + theme.font;
        var label = s.label + ':';
        ctx.fillStyle = theme.accent2;
        ctx.fillText(label, x, y + lineH - 8);
        var labelW = ctx.measureText(label).width;
        if (m && parseFloat(m[2]) > 0) { // the stat bar, number printed inside
          var tx = x + labelW + 12, tw = x0 + cw - tx, th = 0.12 * DPI;
          var ty = y + lineH - 8 - th + 6;
          roundRectPath(ctx, tx, ty, tw, th, th / 2);
          ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
          ctx.save();
          roundRectPath(ctx, tx, ty, tw, th, th / 2);
          ctx.clip();
          ctx.globalAlpha = 0.4;
          ctx.fillStyle = theme.accent;
          var pct = Math.max(0, Math.min(1, parseFloat(m[1]) / parseFloat(m[2])));
          ctx.fillRect(tx, ty, tw * pct, th);
          ctx.restore();
          roundRectPath(ctx, tx, ty, tw, th, th / 2);
          ctx.strokeStyle = theme.ink; ctx.lineWidth = K; ctx.stroke();
          ctx.font = '700 ' + Math.round(9.28 * K) + 'px ' + theme.font;
          ctx.fillStyle = theme.ink;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(s.value, tx + tw / 2, ty + th / 2);
          ctx.textBaseline = 'alphabetic';
        } else {
          ctx.font = fontPx + 'px ' + theme.font;
          ctx.fillStyle = theme.ink;
          ctx.fillText(' ' + s.value, x + labelW, y + lineH - 8);
        }
        y += lineH;
      }
    }

    function drawSetStrip() {
      if (!meta.setName && !meta.cardNo) return H - PAD;
      var y = H - PAD - 0.04 * DPI;
      ctx.strokeStyle = theme.ink; ctx.globalAlpha = 0.85; ctx.lineWidth = K;
      ctx.beginPath();
      ctx.moveTo(PAD, y - 30); ctx.lineTo(W - PAD, y - 30); ctx.stroke();
      ctx.font = '700 ' + Math.round(9.28 * K) + 'px ' + theme.font;
      ctx.fillStyle = theme.ink;
      ctx.textBaseline = 'alphabetic';
      var num = meta.cardNo ? (meta.cardNo + (meta.setSize ? ' / ' + meta.setSize : '')) : '';
      ctx.textAlign = 'left'; ctx.fillText(num.toUpperCase(), PAD, y);
      ctx.textAlign = 'right'; ctx.fillText(String(meta.setName || '').toUpperCase(), W - PAD, y);
      ctx.globalAlpha = 1;
      return y - 30 - 10;
    }

    function drawFacts(y) {
      var fontPx = Math.round(12.16 * K);
      var lineH = Math.round(fontPx * 1.45);
      ctx.font = fontPx + 'px ' + theme.font;
      ctx.fillStyle = theme.ink;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      var facts = entry.facts.length ? entry.facts : ['—'];
      for (var i = 0; i < facts.length; i++) {
        var lines = wrapText(ctx, facts[i], W - 2 * PAD - 40);
        ctx.fillText('•', PAD, y + lineH - 8);
        for (var j = 0; j < lines.length; j++) {
          if (y + lineH > H - PAD) return;
          ctx.fillText(lines[j], PAD + 34, y + lineH - 8);
          y += lineH;
        }
        y += 6;
      }
    }

    function drawBadge() {
      if (isBack || !rar.badge) return;
      var r = 0.12 * DPI, cx = W - PAD * 0.4 - r, cy = PAD * 0.4 + r;
      var colors = { rare: ['#b7bfc7', '#7e8792'], epic: ['#9a6fc4', '#55307f'], legendary: ['#d4b354', '#8a6d1d'] };
      var g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      g.addColorStop(0, colors[rarity][0]); g.addColorStop(1, colors[rarity][1]);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 1.5 * K; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '700 ' + Math.round(r * (rarity === 'legendary' ? 1.15 : 1)) + 'px "Segoe UI", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(rar.badge, cx, cy);
    }

    function drawHolo() {
      if (isBack || rarity === 'common') return;
      // the same static 115° foil band the CSS draws
      var ang = (115 - 90) * Math.PI / 180;
      var cxv = Math.sin(ang) * W, cyv = Math.cos(ang) * H;
      var g = ctx.createLinearGradient(W / 2 - cxv, H / 2 - cyv, W / 2 + cxv, H / 2 + cyv);
      g.addColorStop(0.32, 'rgba(200,190,160,0)');
      g.addColorStop(0.45, 'rgba(200,190,160,0.18)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.4)');
      g.addColorStop(0.55, 'rgba(180,170,150,0.18)');
      g.addColorStop(0.68, 'rgba(180,170,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    function draw() {
      // paper (flat — textures are CSS-only, ≤6% alpha)
      roundRectPath(ctx, 0, 0, W, H, 6 * K);
      ctx.fillStyle = theme.paper; ctx.fill();
      // cut-line border, tinted by rarity like the CSS
      var bw = (rarity === 'legendary' ? 2 : 1.5) * K;
      roundRectPath(ctx, bw / 2, bw / 2, W - bw, H - bw, 6 * K);
      ctx.strokeStyle = rar.edge || theme.accent;
      ctx.lineWidth = bw; ctx.stroke();

      var y = PAD;
      if (isBack) {
        y = drawName(y);
        drawFacts(y + 10);
      } else {
        y = drawPhoto();
        y = drawName(y);
        y = drawStars(y);
        var stripTop = drawSetStrip();
        drawStats(y, stripTop);
      }
      if (frameImg) ctx.drawImage(frameImg, 0, 0, W, H);
      drawBadge();
      drawHolo();
      cb(canvas);
    }

    prepare();
  }

  /* ---------- downloads ---------- */

  function download(blob, filename) {
    var a = document.createElement('a');
    var url = URL.createObjectURL(blob);
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
  }

  /** Downloads name-front.png and name-back.png for one card. */
  function exportPng(entry, opts, done) {
    renderCardCanvas(entry, 'front', opts, function (front) {
      renderCardCanvas(entry, 'back', opts, function (back) {
        front.toBlob(function (fb) {
          download(fb, slug(entry.name) + '-front.png');
          back.toBlob(function (bb) {
            download(bb, slug(entry.name) + '-back.png');
            if (done) done();
          }, 'image/png');
        }, 'image/png');
      });
    });
  }

  /** The whole deck as a letter-portrait PDF: front pages, then row-mirrored
      back pages — the same duplex contract as the print button. */
  function exportPdf(entries, opts, done) {
    var jsPDF = global.jspdf && global.jspdf.jsPDF;
    if (!jsPDF) { alert('The PDF library did not load — try reloading the page.'); if (done) done(); return; }
    var cols = 3, per = 6, cardW = 2.5, cardH = 3.5, gap = 0.15;
    var mx = (8.5 - (cols * cardW + (cols - 1) * gap)) / 2;
    var my = (11 - (2 * cardH + gap)) / 2;
    var doc = new jsPDF({ unit: 'in', format: 'letter' });
    var pages = global.DuplexPrint.paginate(entries, per);
    var jobs = [];
    pages.forEach(function (page) {
      var padded = page.slice();
      while (padded.length < per) padded.push(null);
      jobs.push({ items: padded, side: 'front' });
    });
    pages.forEach(function (page) {
      var padded = page.slice();
      while (padded.length < per) padded.push(null);
      jobs.push({ items: global.DuplexPrint.mirrorPageRows(padded, cols), side: 'back' });
    });
    var first = true;
    (function nextPage(j) {
      if (j >= jobs.length) {
        var name = (entries[0] && entries[0].meta && entries[0].meta.setName) || 'trading-cards';
        doc.save(slug(name) + '.pdf');
        if (done) done();
        return;
      }
      if (!first) doc.addPage();
      first = false;
      var job = jobs[j];
      (function nextCard(i) {
        if (i >= job.items.length) { nextPage(j + 1); return; }
        var e = job.items[i];
        if (!e) { nextCard(i + 1); return; }
        renderCardCanvas(e, job.side, opts, function (canvas) {
          var col = i % cols, row = Math.floor(i / cols);
          doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG',
            mx + col * (cardW + gap), my + row * (cardH + gap), cardW, cardH);
          nextCard(i + 1);
        });
      })(0);
    })(0);
  }

  /** Every card's front and back PNG in one zip. */
  function exportZip(entries, opts, done) {
    if (!global.JSZip) { alert('The zip library did not load — try reloading the page.'); if (done) done(); return; }
    var zip = new global.JSZip();
    (function next(i) {
      if (i >= entries.length) {
        zip.generateAsync({ type: 'blob' }).then(function (blob) {
          var name = (entries[0] && entries[0].meta && entries[0].meta.setName) || 'trading-cards';
          download(blob, slug(name) + '-cards.zip');
          if (done) done();
        });
        return;
      }
      var e = entries[i];
      var base = ('00' + (i + 1)).slice(-2) + '-' + slug(e.name);
      renderCardCanvas(e, 'front', opts, function (front) {
        front.toBlob(function (fb) {
          zip.file(base + '-front.png', fb);
          renderCardCanvas(e, 'back', opts, function (back) {
            back.toBlob(function (bb) {
              zip.file(base + '-back.png', bb);
              next(i + 1);
            }, 'image/png');
          });
        }, 'image/png');
      });
    })(0);
  }

  global.HtcmExport = {
    renderCardCanvas: renderCardCanvas,
    exportPng: exportPng,
    exportPdf: exportPdf,
    exportZip: exportZip
  };
})(window);
