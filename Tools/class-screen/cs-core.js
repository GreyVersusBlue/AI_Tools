/* cs-core.js — the pure logic behind 087 Class Screen. No DOM, no storage:
   the page owns both, and this file only answers questions about data.

     ClassScreenCore.parseYouTube(text)   → { id, list, start } | null
     ClassScreenCore.embedUrl(parsed)     → a youtube-nocookie.com embed URL
     ClassScreenCore.normalizeState(raw)  → a state the page can trust
     ClassScreenCore.clampRect(rect)      → a rect that stays on the board
     ClassScreenCore.formatClock(ms)      → "4:05", "1:02:03"
     ClassScreenCore.parseDuration(text)  → seconds | null
     ClassScreenCore.normalizeStrokes(l)  → drawing strokes the page can trust
     ClassScreenCore.makeGroups(names, by, n, rng) → [[name, …], …]
     ClassScreenCore.mediaIds(state)      → every IndexedDB picture id still in use
     ClassScreenCore.readPeriods(settings)→ 010's bell periods, cleaned
     ClassScreenCore.periodAt(list, mins) → { current, next }
     ClassScreenCore.fromTemplate(id)     → a new screen built from a starter
     ClassScreenCore.exportScreen(s, med) → the .json file's object
     ClassScreenCore.readImport(obj)      → { screen, media } | { error }

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

  var TYPES = ['text', 'timer', 'stopwatch', 'clock', 'youtube', 'traffic', 'names', 'dice',
               'symbols', 'noise', 'draw', 'image', 'qr', 'groups'];

  /* Default size of a new widget, as a fraction of the board. */
  var DEFAULT_SIZE = {
    text:      { w: 0.30, h: 0.25 },
    timer:     { w: 0.26, h: 0.34 },
    stopwatch: { w: 0.24, h: 0.26 },
    clock:     { w: 0.26, h: 0.20 },
    youtube:   { w: 0.36, h: 0.40 },
    traffic:   { w: 0.12, h: 0.40 },
    names:     { w: 0.28, h: 0.30 },
    dice:      { w: 0.24, h: 0.24 },
    symbols:   { w: 0.18, h: 0.30 },
    noise:     { w: 0.24, h: 0.36 },
    draw:      { w: 0.40, h: 0.45 },
    image:     { w: 0.30, h: 0.34 },
    qr:        { w: 0.20, h: 0.36 },
    groups:    { w: 0.40, h: 0.40 }
  };

  var MIN_W = 0.08, MIN_H = 0.08;
  var MAX_SCREENS = 30, MAX_WIDGETS = 40, MAX_TEXT = 5000, MAX_NAME = 60, MAX_URL = 500;
  var MAX_TIMER_S = 24 * 3600;
  var TEXT_SIZES = [1, 1.5, 2, 3, 4, 6];
  var LIGHTS = ['red', 'yellow', 'green'];

  /* Work symbols: what the room should sound like right now. */
  var SYMBOLS = ['silent', 'whisper', 'partner', 'group', 'hands', 'ask3'];

  /* Screen backgrounds. Every one is painted from ink-paper tokens, so each
     has a dark counterpart for free; 'image' is a teacher's picture kept in
     IndexedDB (media-db.js), never in this state. */
  var BACKGROUNDS = ['dots', 'grid', 'lines', 'plain', 'blue', 'slate', 'warm', 'image'];

  /* Drawing: pen colours are token names, resolved when painted, so a
     drawing made in light mode reads in dark mode too. Points are fractions
     of the widget, so a drawing scales with its widget. The cap keeps one
     busy drawing from filling localStorage: ~8,000 points is about 60 KB. */
  var PENS = ['ink', 'red', 'blue', 'green'];
  var PEN_SIZES = [2, 4, 8, 16];
  var MAX_POINTS = 8000, MAX_STROKES = 600;
  var MEDIA_ID_RE = /^[\w-]{1,60}$/;
  var PERIOD_ID_RE = /^[\w-]{1,40}$/;
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
      case 'symbols': return { mode: 'silent' };
      case 'noise': return { sensitivity: 5, limit: 70 };
      case 'draw': return { strokes: [] };
      case 'image': return { mediaId: '', alt: '', fit: 'contain' };
      case 'qr': return { text: '' };
      case 'groups': return { roster: '', by: 'size', n: 4 };
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
      case 'symbols':
        return { mode: SYMBOLS.indexOf(d.mode) !== -1 ? d.mode : dd.mode };
      case 'noise':
        return {
          sensitivity: Math.round(num(d.sensitivity, 1, 10, dd.sensitivity)),
          limit: Math.round(num(d.limit, 10, 100, dd.limit))
        };
      case 'draw':
        return { strokes: normalizeStrokes(d.strokes) };
      case 'image':
        return {
          mediaId: typeof d.mediaId === 'string' && MEDIA_ID_RE.test(d.mediaId) ? d.mediaId : '',
          alt: str(d.alt, 200, ''),
          fit: d.fit === 'cover' ? 'cover' : 'contain'
        };
      case 'qr':
        return { text: str(d.text, MAX_URL, '') };
      case 'groups':
        return {
          roster: str(d.roster, 200, ''),
          by: d.by === 'count' ? 'count' : 'size',
          n: Math.round(num(d.n, 2, 12, dd.n))
        };
    }
    return dd;
  }

  /* Strokes: { c: pen, s: size, p: [x0, y0, x1, y1, …] } with every point a
     fraction of the widget, rounded to 3 places. Bad points end a stroke
     rather than poisoning it; the point cap drops the newest strokes. */
  function normalizeStrokes(list) {
    var out = [], total = 0;
    if (!Array.isArray(list)) return out;
    for (var i = 0; i < list.length && out.length < MAX_STROKES; i++) {
      var st = list[i];
      if (!isObj(st) || !Array.isArray(st.p)) continue;
      var pts = [];
      for (var j = 0; j + 1 < st.p.length; j += 2) {
        var x = st.p[j], y = st.p[j + 1];
        if (typeof x !== 'number' || typeof y !== 'number' || !isFinite(x) || !isFinite(y)) break;
        pts.push(round3(Math.min(1, Math.max(0, x))), round3(Math.min(1, Math.max(0, y))));
      }
      if (pts.length < 2) continue;
      if (total + pts.length / 2 > MAX_POINTS) break;
      total += pts.length / 2;
      out.push({ c: PENS.indexOf(st.c) !== -1 ? st.c : 'ink', s: PEN_SIZES.indexOf(st.s) !== -1 ? st.s : PEN_SIZES[1], p: pts });
    }
    return out;
  }
  function strokePoints(strokes) {
    return (strokes || []).reduce(function (n, st) { return n + st.p.length / 2; }, 0);
  }

  /**
   * Splits `names` into groups, shuffled by `rng` (Math.random by default).
   * by 'size': groups of n, and a remainder too small to stand alone (under
   * half of n) is spread one each over the other groups rather than left as
   * a group of one. by 'count': exactly n groups (fewer if there are fewer
   * names), sizes differing by at most one.
   */
  function makeGroups(names, by, n, rng) {
    rng = rng || Math.random;
    var list = (names || []).slice();
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = list[i]; list[i] = list[j]; list[j] = t;
    }
    n = Math.max(1, Math.floor(n) || 1);
    if (!list.length) return [];
    var count;
    if (by === 'count') count = Math.min(n, list.length);
    else {
      count = Math.max(1, Math.floor(list.length / n));
      var rem = list.length - count * n;
      if (rem >= Math.ceil(n / 2) || count === 0) count += 1;
    }
    var groups = [];
    for (var g = 0; g < count; g++) groups.push([]);
    list.forEach(function (name, k) { groups[k % count].push(name); });
    return groups;
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
    return { id: newId('s'), name: name || 'Screen 1', bg: 'dots', bgImage: '', period: '', widgets: [] };
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
      bg: BACKGROUNDS.indexOf(s.bg) !== -1 ? s.bg : 'dots',
      bgImage: typeof s.bgImage === 'string' && MEDIA_ID_RE.test(s.bgImage) ? s.bgImage : '',
      period: typeof s.period === 'string' && PERIOD_ID_RE.test(s.period) ? s.period : '',
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
    return { current: current, follow: isObj(raw) ? bool(raw.follow, false) : false, screens: screens };
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

  /* Every media id the state still points at: image widgets and image
     backgrounds, on every screen. The page deletes IndexedDB records that are
     not in this list, so a removed image does not sit on the disk forever. */
  function mediaIds(state) {
    var ids = [];
    ((state && state.screens) || []).forEach(function (s) {
      if (s.bgImage && ids.indexOf(s.bgImage) === -1) ids.push(s.bgImage);
      (s.widgets || []).forEach(function (w) {
        if (w.type === 'image' && w.data && w.data.mediaId && ids.indexOf(w.data.mediaId) === -1) ids.push(w.data.mediaId);
      });
    });
    return ids;
  }

  /* ---- the bell schedule (owned by 010 Command Center) ----------------- */

  function minutesOf(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
    if (!m || +m[1] > 23 || +m[2] > 59) return null;
    return +m[1] * 60 + +m[2];
  }

  /* 010 stores { periods: [{ id, label, start: 'HH:MM', end: 'HH:MM', … }] }
     in 'gvb-command-center:settings'. This keeps the rows this page can use
     (a usable id and two real times, end after start), sorted by start. It
     never writes that key: the schedule is 010's. */
  function readPeriods(settings) {
    var out = [], seen = {};
    var list = isObj(settings) && Array.isArray(settings.periods) ? settings.periods : [];
    list.forEach(function (p) {
      if (!isObj(p) || typeof p.id !== 'string' || !PERIOD_ID_RE.test(p.id) || seen[p.id]) return;
      var s = minutesOf(p.start), e = minutesOf(p.end);
      if (s === null || e === null || e <= s) return;
      seen[p.id] = true;
      out.push({ id: p.id, label: str(p.label, MAX_NAME, '').trim() || p.id, start: p.start, end: p.end, s: s, e: e });
    });
    out.sort(function (a, b) { return a.s - b.s; });
    return out;
  }

  /* The period containing `mins` (minutes since midnight, fractions allowed),
     and the next one to start. The same rule as 010's periodAt: start is
     inside a period, end is not. */
  function periodAt(list, mins) {
    var current = null, next = null;
    (list || []).forEach(function (p) {
      if (mins >= p.s && mins < p.e) current = p;
      if (p.s > mins && !next) next = p;
    });
    return { current: current, next: next };
  }

  function screenForPeriod(state, periodId) {
    if (!periodId) return null;
    var list = (state && state.screens) || [];
    for (var i = 0; i < list.length; i++) if (list[i].period === periodId) return list[i];
    return null;
  }

  /* ---- starter screens ------------------------------------------------- */

  function tw(type, x, y, w, h, data) {
    var d = defaultData(type);
    Object.keys(data || {}).forEach(function (k) { d[k] = data[k]; });
    return { type: type, x: x, y: y, w: w, h: h, data: d };
  }
  var TEMPLATES = [
    { id: 'donow', name: 'Do Now', widgets: function () { return [
      tw('text', 0.02, 0.03, 0.62, 0.62, { text: 'Do Now:\n', size: 3 }),
      tw('timer', 0.66, 0.03, 0.32, 0.42, { duration: 300, remaining: 300 }),
      tw('clock', 0.66, 0.48, 0.32, 0.2),
      tw('symbols', 0.02, 0.68, 0.2, 0.3, { mode: 'silent' })
    ]; } },
    { id: 'groupwork', name: 'Group work', widgets: function () { return [
      tw('groups', 0.02, 0.03, 0.56, 0.62),
      tw('timer', 0.6, 0.03, 0.38, 0.4, { duration: 900, remaining: 900 }),
      tw('symbols', 0.6, 0.46, 0.18, 0.34, { mode: 'group' }),
      tw('noise', 0.8, 0.46, 0.18, 0.34),
      tw('text', 0.02, 0.68, 0.56, 0.29, { text: 'Roles: reader, recorder, timekeeper, reporter', size: 2 })
    ]; } },
    { id: 'test', name: 'Test day', widgets: function () { return [
      tw('text', 0.02, 0.03, 0.96, 0.28, { text: 'Test in progress. Phones away, eyes on your own paper.', size: 3 }),
      tw('clock', 0.02, 0.34, 0.46, 0.3),
      tw('timer', 0.52, 0.34, 0.46, 0.3, { duration: 2700, remaining: 2700 }),
      tw('symbols', 0.02, 0.67, 0.22, 0.31, { mode: 'silent' }),
      tw('traffic', 0.86, 0.67, 0.12, 0.31, { light: 'red' })
    ]; } },
    { id: 'reading', name: 'Independent reading', widgets: function () { return [
      tw('timer', 0.02, 0.03, 0.46, 0.46, { duration: 1200, remaining: 1200 }),
      tw('symbols', 0.52, 0.03, 0.22, 0.46, { mode: 'whisper' }),
      tw('noise', 0.76, 0.03, 0.22, 0.46, { limit: 50 }),
      tw('text', 0.02, 0.53, 0.96, 0.44, { text: 'When the timer ends, log your pages and one sentence about what happened.', size: 2 })
    ]; } },
    { id: 'exit', name: 'Exit ticket', widgets: function () { return [
      tw('text', 0.02, 0.03, 0.6, 0.6, { text: 'Exit ticket:\n', size: 3 }),
      tw('qr', 0.64, 0.03, 0.34, 0.6),
      tw('timer', 0.02, 0.66, 0.4, 0.32, { duration: 180, remaining: 180 }),
      tw('clock', 0.44, 0.66, 0.3, 0.32)
    ]; } },
    { id: 'break', name: 'Brain break', widgets: function () { return [
      tw('youtube', 0.02, 0.03, 0.62, 0.7),
      tw('timer', 0.66, 0.03, 0.32, 0.4, { duration: 180, remaining: 180 }),
      tw('traffic', 0.66, 0.46, 0.12, 0.5, { light: 'green' }),
      tw('dice', 0.8, 0.46, 0.18, 0.3)
    ]; } }
  ];
  function fromTemplate(id) {
    var t = null;
    TEMPLATES.forEach(function (x) { if (x.id === id) t = x; });
    if (!t) return null;
    var list = t.widgets().map(function (w, i) { w.id = newId('w'); w.z = i + 1; return w; });
    var screen = normalizeScreen({ id: newId('s'), name: t.name, bg: 'dots', widgets: list }, 0);
    return screen;
  }

  /* ---- a screen as a file ---------------------------------------------- */

  var EXPORT_KIND = 'gvb-class-screen';
  var DATA_URL_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+\/=]+$/;
  var MAX_IMPORT_MEDIA = 20 * 1024 * 1024;     // characters of data URL, all pictures together

  /* `media` is { id: dataUrl } for the pictures the screen points at. The
     screen's period link is dropped: a period id means something only on the
     machine whose bell schedule defined it. */
  function exportScreen(screen, media) {
    var copy = JSON.parse(JSON.stringify(screen));
    copy.period = '';
    var out = {};
    mediaIds({ screens: [copy] }).forEach(function (id) { if (media && typeof media[id] === 'string') out[id] = media[id]; });
    return { kind: EXPORT_KIND, version: 1, exportedAt: new Date().toISOString(), screen: copy, media: out };
  }

  /* Everything in the file is untrusted: the screen goes through
     normalizeScreen like localStorage does, gets fresh ids so it can never
     collide with a screen already here, and every picture must be an image
     data URL. Picture ids are remapped too, and `rename` maps old → new so
     the page can store the blobs under the new ids. */
  function readImport(obj) {
    if (!isObj(obj) || obj.kind !== EXPORT_KIND) return { error: 'That file is not a Class Screen export.' };
    if (obj.version !== 1) return { error: 'That file was made by a newer version of Class Screen.' };
    var screen = normalizeScreen(obj.screen, 0);
    if (!screen) return { error: 'That file has no screen in it.' };
    screen.id = newId('s');
    screen.period = '';
    screen.widgets.forEach(function (w) { w.id = newId('w'); });
    var media = {}, rename = {}, total = 0;
    var src = isObj(obj.media) ? obj.media : {};
    var dropped = 0;
    mediaIds({ screens: [screen] }).forEach(function (id) {
      var url = src[id];
      if (typeof url !== 'string' || !DATA_URL_RE.test(url) || total + url.length > MAX_IMPORT_MEDIA) { dropped++; return; }
      total += url.length;
      var nid = newId('img');
      rename[id] = nid;
      media[nid] = url;
    });
    if (screen.bgImage) {
      if (rename[screen.bgImage]) screen.bgImage = rename[screen.bgImage];
      else { screen.bgImage = ''; if (screen.bg === 'image') screen.bg = 'dots'; }
    }
    screen.widgets.forEach(function (w) {
      if (w.type === 'image' && w.data.mediaId) w.data.mediaId = rename[w.data.mediaId] || '';
    });
    return { screen: screen, media: media, dropped: dropped };
  }

  var ClassScreenCore = {
    TYPES: TYPES,
    TEMPLATES: TEMPLATES.map(function (t) { return { id: t.id, name: t.name }; }),
    fromTemplate: fromTemplate,
    readPeriods: readPeriods,
    periodAt: periodAt,
    minutesOf: minutesOf,
    screenForPeriod: screenForPeriod,
    exportScreen: exportScreen,
    readImport: readImport,
    EXPORT_KIND: EXPORT_KIND,
    SYMBOLS: SYMBOLS,
    BACKGROUNDS: BACKGROUNDS,
    PENS: PENS,
    PEN_SIZES: PEN_SIZES,
    MAX_POINTS: MAX_POINTS,
    normalizeStrokes: normalizeStrokes,
    strokePoints: strokePoints,
    makeGroups: makeGroups,
    mediaIds: mediaIds,
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
