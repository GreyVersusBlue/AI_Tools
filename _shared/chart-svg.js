/* chart-svg.js — the shared chart layer (Path 16 P1): SVG strings built from plain
   data, the contrast rule that picks a label colour, the hatch patterns that are a
   second signal beside colour, and the one rasterizer / download / copy path.
   BACKLOG.md's Path 16 P1 bullet has the design and what is still to move in.

   Step 1 (here): Grade Distribution Visualizer's (037) code, moved unchanged.

     ChartSvg.escapeXml(s), ChartSvg.fmt(n, d)
     ChartSvg.relativeLuminance(hex), ChartSvg.contrastRatio(lumA, lumB)
     ChartSvg.textColorFor(hex[, ink])    near-black or white, whichever has the
                                          higher WCAG contrast on that fill
     ChartSvg.hatchPattern(id, base, stroke)
     ChartSvg.stackedBar(data[, opts]), ChartSvg.histogram(data[, opts])
         data is 037's lastChartData: { name, stats: { n }, letters, letterOrder,
         buckets, bucketWidth, excluded }
     ChartSvg.toPngBlob(svg, w, h, onBlob, onError)   2x, on white
     ChartSvg.downloadBlob / downloadSvg / downloadPng / copyImage / setStatus

   Pure functions touch no DOM; the browser half touches `document` only when
   called. Nothing here stores anything. A hex is #rrggbb. */
(function (root) {
  'use strict';

  var LETTER_HEX = { A: '#08306b', B: '#2171b5', C: '#4292c6', D: '#6baed6', F: '#9ecae1' };
  var ZERO_HEX = '#6b6a63';
  var INK_HEX = '#1f2430';

  function escapeXml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmt(n, d) {
    if (n == null || isNaN(n)) return '—';
    var f = n.toFixed(d == null ? 1 : d);
    return f.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1') || f;
  }

  /** WCAG 2.x relative luminance of a #rrggbb string. */
  function relativeLuminance(hex) {
    var chan = [1, 3, 5].map(function (i) {
      var v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
  }

  function contrastRatio(l1, l2) {
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  /** Readable label text for a fill: the ink or white, by real WCAG contrast, the
      better one wins. (A brightness guess with a 0.55 threshold put white on
      #4292c6 at 3.41:1; the ink is 4.55:1.) */
  function textColorFor(hex, ink) {
    ink = ink || INK_HEX;
    var lum = relativeLuminance(hex);
    return contrastRatio(lum, relativeLuminance(ink)) >= contrastRatio(lum, 1) ? ink : '#ffffff';
  }

  /** One diagonal-hatch <pattern>: a second, non-colour signal that survives
      grayscale printing. */
  function hatchPattern(id, base, stroke) {
    return '<pattern id="' + id + '" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<rect width="7" height="7" fill="' + base + '"/>' +
      '<line x1="0" y1="0" x2="0" y2="7" stroke="' + stroke + '" stroke-width="3"/>' +
      '</pattern>';
  }

  function letterDefs(o) {
    return '<defs>' +
      hatchPattern('hatchF', o.letterHex.F, 'rgba(31,36,48,.35)') +
      hatchPattern('hatchZero', o.zeroHex, 'rgba(255,255,255,.45)') +
      '</defs>';
  }

  function opts(o) {
    o = o || {};
    return {
      letterHex: o.letterHex || LETTER_HEX,
      zeroHex: o.zeroHex || ZERO_HEX,
      ink: o.ink || INK_HEX
    };
  }

  /** "n=31 (2 excluded — blank/non-numeric)": every export carries the count that
      decides whether the shape it shows is trustworthy. */
  function nCaption(data) {
    var s = 'n = ' + data.stats.n;
    if (data.excluded) s += ' (' + data.excluded + ' excluded — blank/non-numeric)';
    return s;
  }

  /** The letter-grade breakdown as a standalone SVG (a flexbox bar has no meaning
      outside the page's stylesheet). */
  function stackedBar(data, o) {
    o = opts(o);
    var W = 640, H = 168, pad = 20, barY = 46, barH = 40;
    var barW = W - pad * 2;
    var x = pad, legend = '', segs = '';
    var legendY = barY + barH + 34, lx = pad;
    data.letterOrder.forEach(function (l) {
      var count = data.letters[l];
      var pct = data.stats.n ? (count / data.stats.n * 100) : 0;
      var w = barW * (pct / 100);
      var fill = l === 'F' ? 'url(#hatchF)' : o.letterHex[l];
      var textFill = textColorFor(o.letterHex[l], o.ink);
      if (w > 0) {
        segs += '<rect x="' + x.toFixed(2) + '" y="' + barY + '" width="' + w.toFixed(2) + '" height="' + barH + '" fill="' + fill + '"/>';
        if (pct >= 6) {
          segs += '<text x="' + (x + w / 2).toFixed(2) + '" y="' + (barY + barH / 2 + 5) + '" text-anchor="middle" font-size="13" font-weight="700" fill="' + textFill + '" font-family="Segoe UI, Arial, sans-serif">' + Math.round(pct) + '%</text>';
        }
        x += w;
      }
      var legendText = l + ': ' + count + ' (' + fmt(pct, 1) + '%)';
      legend += '<rect x="' + lx + '" y="' + (legendY - 11) + '" width="11" height="11" fill="' + fill + '" stroke="#8c897f"/>' +
        '<text x="' + (lx + 16) + '" y="' + legendY + '" font-size="12" font-family="Segoe UI, Arial, sans-serif" fill="#1f2430">' + escapeXml(legendText) + '</text>';
      lx += 16 + legendText.length * 6.6 + 18;
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      letterDefs(o) +
      '<rect width="' + W + '" height="' + H + '" fill="#fff"/>' +
      '<text x="' + pad + '" y="18" font-size="14" font-weight="700" font-family="Segoe UI, Arial, sans-serif" fill="#1f2430">' + escapeXml((data.name || 'Assignment') + ' — Letter-grade breakdown') + '</text>' +
      '<text x="' + pad + '" y="34" font-size="11" font-family="Segoe UI, Arial, sans-serif" fill="#6b6a63">' + escapeXml(nCaption(data)) + '</text>' +
      '<rect x="' + pad + '" y="' + barY + '" width="' + barW + '" height="' + barH + '" fill="none" stroke="#8c897f"/>' +
      segs + legend +
      '</svg>';
  }

  function histogram(data, o) {
    o = opts(o);
    var W = 640, H = 330, padL = 30, padR = 20, padT = 50, padB = 50;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var buckets = data.buckets;
    var maxCount = buckets.reduce(function (m, b) { return Math.max(m, b.count); }, 0) || 1;
    var n = buckets.length;
    var gap = 6;
    var barW = (plotW - gap * (n - 1)) / n;
    var bars = '', labels = '';
    buckets.forEach(function (b, i) {
      var h = (b.count / maxCount) * plotH;
      var x = padL + i * (barW + gap);
      var y = padT + (plotH - h);
      var fill = b.isZero ? 'url(#hatchZero)' : '#2e6b8f';
      bars += '<rect x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + barW.toFixed(2) + '" height="' + h.toFixed(2) + '" fill="' + fill + '"/>';
      if (b.count) bars += '<text x="' + (x + barW / 2).toFixed(2) + '" y="' + (y - 6).toFixed(2) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#1f3550" font-family="Segoe UI, Arial, sans-serif">' + b.count + '</text>';
      var labelWeight = b.isZero ? 'font-weight="700" fill="#1f2430"' : 'fill="#6b6a63"';
      labels += '<text x="' + (x + barW / 2).toFixed(2) + '" y="' + (padT + plotH + 18) + '" text-anchor="middle" font-size="10" ' + labelWeight + ' font-family="Segoe UI, Arial, sans-serif">' + escapeXml(b.isZero ? '0 (not submitted)' : b.label) + '</text>';
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      letterDefs(o) +
      '<rect width="' + W + '" height="' + H + '" fill="#fff"/>' +
      '<text x="' + padL + '" y="20" font-size="14" font-weight="700" font-family="Segoe UI, Arial, sans-serif" fill="#1f2430">' + escapeXml((data.name || 'Assignment') + ' — Score histogram (bucket width ' + data.bucketWidth + ')') + '</text>' +
      '<text x="' + padL + '" y="36" font-size="11" font-family="Segoe UI, Arial, sans-serif" fill="#6b6a63">' + escapeXml(nCaption(data)) + '</text>' +
      '<line x1="' + padL + '" y1="' + (padT + plotH) + '" x2="' + (padL + plotW) + '" y2="' + (padT + plotH) + '" stroke="#8c897f" stroke-width="1.5"/>' +
      bars + labels +
      '</svg>';
  }

  /* ---------- the browser half: rasterize, download, copy ---------- */

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function downloadSvg(svgString, filenameBase) {
    downloadBlob(new Blob([svgString], { type: 'image/svg+xml' }), filenameBase + '.svg');
  }

  /** Rasterise a standalone SVG to a PNG blob at 2x on white (a transparent chart
      pasted into a dark document is unreadable). The download and the copy share it,
      so the image on the clipboard is byte-for-byte the image on disk. */
  function toPngBlob(svgString, w, h, onBlob, onError) {
    var img = new Image();
    var svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(svgBlob);
    img.onload = function () {
      var scale = 2;
      var canvas = document.createElement('canvas');
      canvas.width = w * scale; canvas.height = h * scale;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(function (blob) {
        if (blob) onBlob(blob); else onError();
      }, 'image/png');
    };
    img.onerror = function () { URL.revokeObjectURL(url); onError(); };
    img.src = url;
  }

  function downloadPng(svgString, filenameBase, w, h) {
    toPngBlob(svgString, w, h,
      function (blob) { downloadBlob(blob, filenameBase + '.png'); },
      function () { alert('Could not render a PNG — try downloading the SVG instead.'); });
  }

  /* The status goes next to the button, not into an alert: it is a "did that work?"
     answer, not something to dismiss. It is announced (role=status), a success
     clears itself, a failure stays until the next attempt replaces it. */
  var statusTimers = new WeakMap();

  function setStatus(row, text, isError) {
    if (!row) return;
    var el = row.querySelector('.copy-status');
    if (!el) {
      el = document.createElement('span');
      el.className = 'copy-status';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      row.appendChild(el);
    }
    el.textContent = text;
    el.classList.toggle('error', !!isError);

    var pending = statusTimers.get(el);
    if (pending) clearTimeout(pending);
    if (!isError && text && text.indexOf('…') === -1) {
      statusTimers.set(el, setTimeout(function () {
        if (el.textContent === text) el.textContent = '';
      }, 6000));
    }
  }

  /** Put the chart on the clipboard as an image. Clipboard image writes need a secure
      context and are unsupported or permission-gated in places, so every failure falls
      back to the PNG download and says so. The try/catch is as well as the rejection
      handler: a partly implemented API throws from the ClipboardItem constructor
      synchronously instead of rejecting. */
  function copyImage(svgString, filenameBase, w, h, row) {
    var canWrite = !!(navigator.clipboard && window.ClipboardItem && navigator.clipboard.write);
    setStatus(row, 'Copying…');
    toPngBlob(svgString, w, h, function (blob) {
      if (!canWrite) {
        downloadBlob(blob, filenameBase + '.png');
        setStatus(row, 'This browser can’t put an image on the clipboard — downloaded the PNG instead.', true);
        return;
      }
      var wrote;
      try {
        wrote = navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
      } catch (e) {
        downloadBlob(blob, filenameBase + '.png');
        setStatus(row, 'This browser refused the clipboard — downloaded the PNG instead.', true);
        return;
      }
      Promise.resolve(wrote).then(function () {
        setStatus(row, 'Copied — paste it straight into your document.');
      }, function () {
        downloadBlob(blob, filenameBase + '.png');
        setStatus(row, 'The clipboard was blocked here — downloaded the PNG instead.', true);
      });
    }, function () {
      setStatus(row, 'Could not render the chart as an image. The SVG download still works.', true);
    });
  }

  root.ChartSvg = {
    LETTER_HEX: LETTER_HEX,
    ZERO_HEX: ZERO_HEX,
    INK_HEX: INK_HEX,
    escapeXml: escapeXml,
    fmt: fmt,
    relativeLuminance: relativeLuminance,
    contrastRatio: contrastRatio,
    textColorFor: textColorFor,
    hatchPattern: hatchPattern,
    nCaption: nCaption,
    stackedBar: stackedBar,
    histogram: histogram,
    toPngBlob: toPngBlob,
    downloadBlob: downloadBlob,
    downloadSvg: downloadSvg,
    downloadPng: downloadPng,
    setStatus: setStatus,
    copyImage: copyImage
  };
})(window);
