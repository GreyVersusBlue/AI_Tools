(function (global) {
  'use strict';

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function tenFrameDots(count) {
    count = clamp(Math.round(count), 1, 20);
    var dots = [];
    var frameRects = [];
    var frames = count > 10 ? 2 : 1;
    for (var f = 0; f < frames; f++) {
      frameRects.push({ x: 6, y: 6 + f * 44, w: 88, h: 38 });
    }
    for (var i = 0; i < count; i++) {
      var frameIndex = Math.floor(i / 10);
      var within = i % 10;
      var row = Math.floor(within / 5);
      var col = within % 5;
      dots.push({
        x: 14 + col * 18,
        y: 15 + frameIndex * 44 + row * 24,
        group: 0
      });
    }
    return { dots: dots, frameRects: frameRects };
  }

  var DICE_POSITIONS = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]]
  };

  function diceDots(count) {
    count = clamp(Math.round(count), 1, 6);
    var positions = DICE_POSITIONS[count] || DICE_POSITIONS[6];
    return { dots: positions.map(function (p) { return { x: p[0], y: p[1], group: 0 }; }) };
  }

  function scatteredDots(count) {
    count = clamp(Math.round(count), 1, 20);
    var dots = [];
    var minDist = count > 14 ? 13 : count > 8 ? 17 : 24;
    var attempts = 0;
    while (dots.length < count && attempts < count * 80) {
      attempts++;
      var x = 10 + Math.random() * 80;
      var y = 12 + Math.random() * 76;
      var ok = true;
      for (var i = 0; i < dots.length; i++) {
        var dx = dots[i].x - x, dy = dots[i].y - y;
        if (Math.sqrt(dx * dx + dy * dy) < minDist) { ok = false; break; }
      }
      if (ok) dots.push({ x: x, y: y, group: 0 });
    }
    while (dots.length < count) {
      dots.push({ x: 10 + Math.random() * 80, y: 12 + Math.random() * 76, group: 0 });
    }
    return { dots: dots };
  }

  function splitFriendly(count) {
    if (count > 10) return 10;
    if (count > 5) return 5;
    if (count > 2) return 2;
    return Math.max(1, Math.floor(count / 2));
  }

  function clusterPos(i, total, side) {
    var cols = Math.min(3, total);
    var row = Math.floor(i / cols);
    var col = i % cols;
    var baseX = side === 'left' ? 12 : 58;
    return { x: baseX + col * 15, y: 16 + row * 24, group: side === 'left' ? 0 : 1 };
  }

  function twoPartDots(count) {
    count = clamp(Math.round(count), 2, 20);
    var groupA = splitFriendly(count);
    var groupB = count - groupA;
    var dots = [];
    var i;
    for (i = 0; i < groupA; i++) dots.push(clusterPos(i, groupA, 'left'));
    for (i = 0; i < groupB; i++) dots.push(clusterPos(i, groupB, 'right'));
    return { dots: dots, groupA: groupA, groupB: groupB };
  }

  function generate(opts) {
    opts = opts || {};
    var count = clamp(Math.round(opts.count) || 1, 1, 20);
    var layout = opts.layout || 'random';
    if (layout === 'random') {
      var pool = ['tenframe', 'scattered'];
      if (count >= 2) pool.push('twopart');
      if (count <= 6) pool.push('dice');
      layout = pool[Math.floor(Math.random() * pool.length)];
    }
    var result;
    if (layout === 'dice') {
      count = clamp(count, 1, 6);
      result = diceDots(count);
    } else if (layout === 'twopart') {
      count = clamp(count, 2, 20);
      result = twoPartDots(count);
    } else if (layout === 'scattered') {
      result = scatteredDots(count);
    } else {
      layout = 'tenframe';
      result = tenFrameDots(count);
    }
    return {
      count: count,
      layout: layout,
      dots: result.dots,
      frameRects: result.frameRects,
      groupA: result.groupA,
      groupB: result.groupB
    };
  }

  global.NTDotImages = { generate: generate };
})(window);
