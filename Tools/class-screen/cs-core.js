/* cs-core.js — the pure logic behind 087 Class Screen. No DOM, no storage:
   the page owns both, and this file only answers questions about data.

     ClassScreenCore.parseYouTube(text)   → { id, list, start } | null
     ClassScreenCore.embedUrl(parsed)     → a youtube-nocookie.com embed URL
     ClassScreenCore.normalizeState(raw)  → a state the page can trust
     ClassScreenCore.clampRect(rect)      → a rect that stays on the board
     ClassScreenCore.formatClock(ms)      → "4:05", "1:02:03"
     ClassScreenCore.parseDuration(text)  → seconds | null

   Positions are FRACTIONS of the board (0..1), never pixels, so a screen laid
   out on a laptop lands in the same place on a 1080p projector.

   normalizeState is the only thing standing between localStorage (which a
   teacher, an extension or an older build can have written anything into) and
   the page. It keeps what it recognises, clamps every number, caps every
   string and drops the rest. One bad widget loses that widget, never the
   screen; one bad screen loses that screen, never the others.

   Classic script publishing window.ClassScreenCore. The root package.json is
   "type": "module", so Node cannot require() this file; the unit test runs it
   in a vm context instead (test/core.test.mjs). */
(function (global) {
  'use strict';

  var TYPES = ['text', 'timer', 'stopwatch', 'clock', 'youtube', 'traffic', 'names', 'dice'];

  /* Default size of a new widget, as a fraction of the board. */
  var DEFAULT_SIZE = {
    text:      { w: 0.30, h: 0.25 },
    timer:     { w: 0.26, h: 0.34 },
    stopwatch: { w: 0.24, h: 0.26 },
    clock:     { w: 0.26, h: 0.20 },
    youtube:   { w: 0.36, h: 0.40 },
    traffic:   { w: 0.12, h: 0.40 },
    names:     { w: 0.28, h: 0.30 },
    dice:      { w: 0.24, h: 0.24 }
  };

  var MIN_W = 0.08, MIN_H = 0.08;
  var MAX_SCREENS = 30, MAX_WIDGETS = 40, MAX_TEXT = 5000, MAX_NAME = 60, MAX_URL = 500;
  var MAX_TIMER_S = 24 * 3600;
  var TEXT_SIZES = [1, 1.5, 2, 3, 4, 6];
  var LIGHTS = ['red', 'yellow', 'green'];

  function num(v, lo, hi, dflt) {
    var n = typeof v === 'number' ? v : NaN;
    if (!isFinite(n)) return dflt;
    return Math.min(hi, Math.max(lo, n));
  }
  function str(v, max, dflt) {
    return typeof v === 'string' ? v.slice(0, max) : dflt;
  }
  function bool(v, dflt) { return typeof v === 'boolean' ? v : dflt; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  /* ---- YouTube ---------------------------------------------------------- */

  var ID_RE = /^[A-Za-z0-9_-]{11}$/;
  var LIST_RE = /^[A-Za-z0-9_-]{10,64}$/;

  /* "90", "90s", "1m30s", "1h2m3s" → seconds. Anything else → 0. */
  function parseStart(t) {
    if (!t) return 0;
    t = String(t).trim();
    if (/^\d+$/.test(t)) return Math.min(MAX_TIMER_S, parseInt(t, 10));
    var m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
    if (!m || (!m[1] && !m[2] && !m[3])) return 0;
    return Math.min(MAX_TIMER_S, (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0));
  }

  /**
   * Accepts what a teacher actually pastes: a watch link, a youtu.be share
   * link, a Shorts or live link, an embed link, a playlist link, or a bare
   * 11-character video id. Returns null for anything else — including every
   * other host, which is what keeps this widget from becoming a general
   * "embed any URL" frame.
   */
  function parseYouTube(text) {
    if (typeof text !== 'string') return null;
    text = text.trim();
    if (!text || text.length > MAX_URL) return null;
    if (ID_RE.test(text)) return { id: text, list: '', start: 0 };

    var url;
    try {
      url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : 'https://' + text);
    } catch (e) { return null; }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

    var host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
    var parts = url.pathname.split('/').filter(Boolean);
    var q = url.searchParams;
    var id = '';

    if (host === 'youtu.be') {
      id = parts[0] || '';
    } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (parts[0] === 'watch') id = q.get('v') || '';
      else if (['embed', 'shorts', 'live', 'v'].indexOf(parts[0]) !== -1) id = parts[1] || '';
      else if (parts[0] === 'playlist') id = '';
      else return null;
    } else {
      return null;
    }

    var list = q.get('list') || '';
    if (!LIST_RE.test(list)) list = '';
    if (id && !ID_RE.test(id)) return null;
    if (!id && !list) return null;
    return { id: id, list: list, start: parseStart(q.get('t') || q.get('start')) };
  }

  function embedUrl(p) {
    if (!p || (!p.id && !p.list)) return '';
    var base = 'https://www.youtube-nocookie.com/embed/';
    var params = ['rel=0', 'modestbranding=1'];
    if (p.list) params.push('list=' + encodeURIComponent(p.list));
    if (p.start > 0) params.push('start=' + Math.floor(p.start));
    if (p.id) return base + encodeURIComponent(p.id) + '?' + params.join('&');
    return base + 'videoseries?' + params.join('&');
  }

  /* ---- time ------------------------------------------------------------- */

  function formatClock(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return h > 0 ? h + ':' + pad(m) + ':' + pad(sec) : m + ':' + pad(sec);
  }

  /* "5" → 300 (minutes), "4:30" → 270, "1:00:00" → 3600, "90s" → 90. */
  function parseDuration(text) {
    if (typeof text !== 'string') return null;
    text = text.trim().toLowerCase();
    var n;
    if (/^\d+(\.\d+)?$/.test(text)) n = Math.round(parseFloat(text) * 60);
    else if (/^\d+s$/.test(text)) n = parseInt(text, 10);
    else if (/^\d+:\d{1,2}$/.test(text)) {
      var a = text.split(':');
      if (+a[1] > 59) return null;
      n = +a[0] * 60 + +a[1];
    } else if (/^\d+:\d{1,2}:\d{1,2}$/.test(text)) {
      var b = text.split(':');
      if (+b[1] > 59 || +b[2] > 59) return null;
      n = +b[0] * 3600 + +b[1] * 60 + +b[2];
    } else return null;
    return n > 0 && n <= MAX_TIMER_S ? n : null;
  }

  /* ---- geometry --------------------------------------------------------- */

  function clampRect(r) {
    var w = num(r && r.w, MIN_W, 1, 0.25);
    var h = num(r && r.h, MIN_H, 1, 0.25);
    return {
      x: num(r && r.x, 0, 1 - w, 0),
      y: num(r && r.y, 0, 1 - h, 0),
      w: w,
      h: h
    };
  }

  /* ---- state ------------------------------------------------------------ */

  function newId(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function defaultData(type) {
    switch (type) {
      case 'text': return { text: '', size: 2 };
      case 'timer': return { duration: 300, endsAt: 0, remaining: 300, sound: true };
      case 'stopwatch': return { startedAt: 0, elapsed: 0 };
      case 'clock': return { h24: false, seconds: false, date: true };
      case 'youtube': return { url: '' };
      case 'traffic': return { light: 'green' };
      case 'names': return { roster: '' };
      case 'dice': return { count: 2, values: [1, 1] };
    }
    return {};
  }

  function normalizeData(type, d) {
    d = isObj(d) ? d : {};
    var dd = defaultData(type);
    switch (type) {
      case 'text':
        return { text: str(d.text, MAX_TEXT, ''), size: TEXT_SIZES.indexOf(d.size) !== -1 ? d.size : dd.size };
      case 'timer': {
        var duration = Math.round(num(d.duration, 1, MAX_TIMER_S, dd.duration));
        return {
          duration: duration,
          endsAt: num(d.endsAt, 0, 8.64e15, 0),
          remaining: num(d.remaining, 0, MAX_TIMER_S, duration),
          sound: bool(d.sound, true)
        };
      }
      case 'stopwatch':
        return { startedAt: num(d.startedAt, 0, 8.64e15, 0), elapsed: num(d.elapsed, 0, 8.64e15, 0) };
      case 'clock':
        return { h24: bool(d.h24, false), seconds: bool(d.seconds, false), date: bool(d.date, true) };
      case 'youtube':
        return { url: parseYouTube(str(d.url, MAX_URL, '')) ? d.url.trim() : '' };
      case 'traffic':
        return { light: LIGHTS.indexOf(d.light) !== -1 ? d.light : dd.light };
      case 'names':
        return { roster: str(d.roster, 200, '') };
      case 'dice': {
        var count = Math.round(num(d.count, 1, 6, 2));
        var vals = Array.isArray(d.values) ? d.values : [];
        var out = [];
        for (var i = 0; i < count; i++) {
          var v = vals[i];
          out.push(typeof v === 'number' && v >= 1 && v <= 6 ? Math.floor(v) : 1);
        }
        return { count: count, values: out };
      }
    }
    return dd;
  }

  function normalizeWidget(w) {
    if (!isObj(w) || TYPES.indexOf(w.type) === -1) return null;
    var r = clampRect(w);
    return {
      id: typeof w.id === 'string' && /^[\w-]{1,40}$/.test(w.id) ? w.id : newId('w'),
      type: w.type,
      x: r.x, y: r.y, w: r.w, h: r.h,
      z: Math.round(num(w.z, 1, 10000, 1)),
      data: normalizeData(w.type, w.data)
    };
  }

  function blankScreen(name) {
    return { id: newId('s'), name: name || 'Screen 1', widgets: [] };
  }

  function normalizeScreen(s, i) {
    if (!isObj(s)) return null;
    var name = str(s.name, MAX_NAME, '').trim() || 'Screen ' + (i + 1);
    var widgets = [];
    var seen = {};
    (Array.isArray(s.widgets) ? s.widgets : []).forEach(function (w) {
      if (widgets.length >= MAX_WIDGETS) return;
      var n = normalizeWidget(w);
      if (!n) return;
      if (seen[n.id]) n.id = newId('w');
      seen[n.id] = true;
      widgets.push(n);
    });
    return {
      id: typeof s.id === 'string' && /^[\w-]{1,40}$/.test(s.id) ? s.id : newId('s'),
      name: name,
      widgets: widgets
    };
  }

  function normalizeState(raw) {
    var screens = [];
    var seen = {};
    if (isObj(raw) && Array.isArray(raw.screens)) {
      raw.screens.forEach(function (s, i) {
        if (screens.length >= MAX_SCREENS) return;
        var n = normalizeScreen(s, i);
        if (!n) return;
        if (seen[n.id]) n.id = newId('s');
        seen[n.id] = true;
        screens.push(n);
      });
    }
    if (!screens.length) screens.push(blankScreen('Screen 1'));
    var current = isObj(raw) && typeof raw.current === 'string' && seen[raw.current] ? raw.current : screens[0].id;
    return { current: current, screens: screens };
  }

  /* Where a new widget goes: the first free spot in reading order (top-left
     first, the way a teacher fills a whiteboard), so a new widget never hides
     one that is already there. On a board too full for that, the spot that
     covers the least of the others. Centre-first was tried and packs worse:
     the first widget sits in the middle and splits the board, so one of each
     of the eight types no longer fits. Scanned on a 2% grid; rounded so saved
     numbers stay short. */
  function overlapArea(a, b) {
    var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    var h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w * h : 0;
  }
  function round3(n) { return Math.round(n * 1000) / 1000; }
  function placeNew(type, existing) {
    var size = DEFAULT_SIZE[type] || { w: 0.25, h: 0.25 };
    existing = existing || [];
    var best = null, bestKey = null, STEP = 0.02, GAP = 0.01;
    for (var j = 0; GAP + j * STEP + size.h <= 1 - GAP + 1e-9; j++) {
      for (var i = 0; GAP + i * STEP + size.w <= 1 - GAP + 1e-9; i++) {
        var x = round3(GAP + i * STEP), y = round3(GAP + j * STEP);
        var cand = { x: x - GAP, y: y - GAP, w: size.w + 2 * GAP, h: size.h + 2 * GAP };
        var cover = 0;
        for (var k = 0; k < existing.length; k++) cover += overlapArea(cand, existing[k]);
        var key = [round3(cover * 100), j * 1000 + i];
        if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
          bestKey = key; best = { x: x, y: y };
        }
      }
    }
    if (!best) best = { x: (1 - size.w) / 2, y: (1 - size.h) / 2 };
    return clampRect({ x: best.x, y: best.y, w: size.w, h: size.h });
  }

  var ClassScreenCore = {
    TYPES: TYPES,
    DEFAULT_SIZE: DEFAULT_SIZE,
    TEXT_SIZES: TEXT_SIZES,
    LIGHTS: LIGHTS,
    MIN_W: MIN_W,
    MIN_H: MIN_H,
    MAX_SCREENS: MAX_SCREENS,
    MAX_WIDGETS: MAX_WIDGETS,
    parseYouTube: parseYouTube,
    embedUrl: embedUrl,
    formatClock: formatClock,
    parseDuration: parseDuration,
    clampRect: clampRect,
    defaultData: defaultData,
    normalizeWidget: normalizeWidget,
    normalizeState: normalizeState,
    blankScreen: blankScreen,
    placeNew: placeNew,
    newId: newId
  };

  global.ClassScreenCore = ClassScreenCore;
})(typeof window !== 'undefined' ? window : globalThis);
