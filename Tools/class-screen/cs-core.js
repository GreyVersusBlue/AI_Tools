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
     ClassScreenCore.readCommand(msg)     → a phone-remote command, or null
     ClassScreenCore.readKey(e, where)    → a keyboard shortcut, or null

   Positions are FRACTIONS of the board (0..1), never pixels, so a screen laid
   out on a laptop lands in the same place on a 1080p projector.

   normalizeState is the only thing standing between localStorage (which a
   teacher, an extension or an older build can have written anything into) and
   the page. It keeps what it recognises, clamps every number, caps every
   string and drops the rest. One bad widget loses that widget, never the
   screen; one bad screen loses that screen, never the others.

   Needs _shared/countdown.js loaded first (formatClock, parseDuration).

   Classic script publishing window.ClassScreenCore. The root package.json is
   "type": "module", so Node cannot require() this file; the unit test runs it
   in a vm context instead (test/core.test.mjs). */
(function (global) {
  'use strict';

  var TYPES = ['text', 'timer', 'stopwatch', 'clock', 'youtube', 'traffic', 'names', 'dice',
               'symbols', 'noise', 'draw', 'image', 'qr', 'groups', 'agenda', 'pie', 'sequence', 'bell', 'score', 'wheel'];

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
    groups:    { w: 0.40, h: 0.40 },
    agenda:    { w: 0.30, h: 0.40 },
    pie:       { w: 0.26, h: 0.46 },
    sequence:  { w: 0.34, h: 0.42 },
    bell:      { w: 0.30, h: 0.26 },
    score:     { w: 0.40, h: 0.40 },
    wheel:     { w: 0.34, h: 0.50 }
  };

  var MIN_W = 0.08, MIN_H = 0.08;
  var MAX_SCREENS = 30, MAX_WIDGETS = 40, MAX_TEXT = 5000, MAX_NAME = 60, MAX_URL = 500;
  var MAX_TIMER_S = 24 * 3600;
  var MAX_AGENDA = 12, MAX_AGENDA_ITEM = 120;
  var MAX_STEPS = 8, MAX_STEP_LABEL = 30;
  var MAX_WHEEL = 24, MAX_WHEEL_ITEM = 40;
  var MAX_TEAMS = 8, MAX_TEAM_NAME = 30, MAX_SCORE = 9999;
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

  /* The countdown arithmetic, formatting and parsing are _shared/countdown.js's
     (Path 22 P5), so this page, 010 and 004 agree on them. These two names
     stay because the page and the suites already call them. */
  function formatClock(ms) { return global.Countdown.format(ms); }

  /* "5" → 300 (minutes), "4:30" → 270, "1:00:00" → 3600, "90s" → 90. */
  function parseDuration(text) { return global.Countdown.parse(text); }

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
      case 'timer': case 'pie': return { duration: 300, endsAt: 0, remaining: 300, sound: true };
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
      case 'agenda': return { items: [] };
      case 'wheel': return { items: ['Choice 1', 'Choice 2', 'Choice 3', 'Choice 4'] };
      case 'score': return { teams: [1, 2, 3, 4].map(function (n) { return { name: 'Team ' + n, score: 0 }; }) };
      case 'sequence': return { steps: DEFAULT_STEPS.map(function (x) { return { label: x.label, sec: x.sec }; }), i: 0, endsAt: 0, remaining: DEFAULT_STEPS[0].sec };
    }
    return {};
  }

  /* What a timer also does when it runs out (Path 22 P8): flash the board, set
     the traffic light, tick the next agenda item. null when none is on. The
     agenda flag is kept even on a page that has no agenda widget yet, so a
     link set on a later build survives a round trip through this one. */
  function normalizeLink(l) {
    if (!isObj(l)) return null;
    var out = { flash: bool(l.flash, false), light: LIGHTS.indexOf(l.light) !== -1 ? l.light : '', agenda: bool(l.agenda, false) };
    return out.flash || out.light || out.agenda ? out : null;
  }

  /* A sequence timer: steps run one after another, each { label, sec }. Typed
     as "Think 1:00, Pair 2:00, Share 3:00": the last word of each part is its
     length (the same forms the timer takes), the rest is its name. Parts split
     on commas, semicolons, new lines and arrows. */
  var DEFAULT_STEPS = [{ label: 'Think', sec: 60 }, { label: 'Pair', sec: 120 }, { label: 'Share', sec: 180 }];
  function parseSequence(text) {
    if (typeof text !== 'string') return { steps: [], error: 'Try Think 1:00, Pair 2:00, Share 3:00.' };
    var parts = text.split(/[,;\n]|->|→/).map(function (x) { return x.trim(); }).filter(Boolean);
    var steps = [], error = '';
    if (!parts.length) error = 'Try Think 1:00, Pair 2:00, Share 3:00.';
    parts.forEach(function (part, i) {
      if (error) return;
      var m = /^(.*\S)\s+(\S+)$/.exec(part);
      var sec = m ? global.Countdown.parse(m[2]) : null;
      if (!m || sec === null) { error = 'Step ' + (i + 1) + ' needs a name and a time, like Pair 2:00.'; return; }
      if (steps.length >= MAX_STEPS) { error = 'A sequence holds at most ' + MAX_STEPS + ' steps.'; return; }
      steps.push({ label: m[1].slice(0, MAX_STEP_LABEL), sec: sec });
    });
    return error ? { steps: [], error: error } : { steps: steps, error: '' };
  }
  function formatSequence(steps) {
    return (steps || []).map(function (x) { return x.label + ' ' + global.Countdown.format(x.sec * 1000); }).join(', ');
  }
  function normalizeSteps(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (x) {
      if (out.length >= MAX_STEPS || !isObj(x)) return;
      var label = str(x.label, MAX_STEP_LABEL, '').trim();
      var sec = typeof x.sec === 'number' && x.sec >= 0.5 ? Math.round(num(x.sec, 1, MAX_TIMER_S, 0)) : 0;
      if (label && sec > 0) out.push({ label: label, sec: sec });
    });
    return out.length ? out : DEFAULT_STEPS.map(function (x) { return { label: x.label, sec: x.sec }; });
  }

  /* A spinner wheel: up to MAX_WHEEL typed entries, one per segment. */
  function normalizeWheelItems(list, fallback) {
    if (!Array.isArray(list)) return fallback;
    var out = [];
    list.forEach(function (x) {
      if (out.length >= MAX_WHEEL) return;
      var t = str(x, MAX_WHEEL_ITEM, '').trim();
      if (t) out.push(t);
    });
    return out;
  }

  /* Where a spin lands. The wheel turns clockwise under a pointer at the top;
     segment i spans [i, i+1) * 360/n degrees measured clockwise from the top.
     `cur` is the wheel's accumulated rotation in degrees, `rng` returns [0, 1).
     The result always turns the wheel forward by at least `turns` full
     turns and stops inside the chosen segment (never on an edge). The caller
     keeps `angle` as the new rotation. */
  function spinTo(n, cur, rng, turns) {
    n = Math.max(1, Math.floor(n));
    var index = Math.min(n - 1, Math.floor(rng() * n));
    var seg = 360 / n, within = (0.1 + 0.8 * rng()) * seg;      // 10%..90% of the segment
    var want = (360 - (index * seg + within)) % 360;            // rotation (mod 360) that puts the stop under the pointer
    var have = ((cur % 360) + 360) % 360;
    var angle = cur + (turns || 5) * 360 + ((want - have) % 360 + 360) % 360;
    return { index: index, angle: angle };
  }
  /* The segment under the pointer at a rotation: spinTo's inverse. */
  function wheelAt(n, angle) {
    var a = ((-angle % 360) + 360) % 360;
    return Math.min(n - 1, Math.floor(a / (360 / n)));
  }

  /* A team scoreboard: up to MAX_TEAMS teams, each { name, score }. A team is a
     name the teacher types ("Team 1", "Table 3"), never a student; scores are
     whole numbers in either direction. Nothing here is student-facing: it is
     for the projector only. An empty list is a real state (all removed). */
  function normalizeTeams(list, fallback) {
    if (!Array.isArray(list)) return fallback;
    var out = [];
    list.forEach(function (t) {
      if (out.length >= MAX_TEAMS || !isObj(t)) return;
      var name = str(t.name, MAX_TEAM_NAME, '').trim() || 'Team ' + (out.length + 1);
      out.push({ name: name, score: Math.round(num(t.score, -MAX_SCORE, MAX_SCORE, 0)) });
    });
    return out;
  }

  /* An agenda: up to MAX_AGENDA lines, each { t, done }. A blank line is dropped. */
  function normalizeAgenda(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (it) {
      if (out.length >= MAX_AGENDA || !isObj(it)) return;
      var t = str(it.t, MAX_AGENDA_ITEM, '').trim();
      if (t) out.push({ t: t, done: bool(it.done, false) });
    });
    return out;
  }

  function normalizeData(type, d) {
    d = isObj(d) ? d : {};
    var dd = defaultData(type);
    switch (type) {
      case 'text':
        return { text: str(d.text, MAX_TEXT, ''), size: TEXT_SIZES.indexOf(d.size) !== -1 ? d.size : dd.size };
      case 'timer': case 'pie': {
        var duration = Math.round(num(d.duration, 1, MAX_TIMER_S, dd.duration));
        var t = {
          duration: duration,
          endsAt: num(d.endsAt, 0, 8.64e15, 0),
          remaining: num(d.remaining, 0, MAX_TIMER_S, duration),
          sound: bool(d.sound, true)
        };
        var link = normalizeLink(d.link);
        if (link) t.link = link;            // present only once a link is on, so an older save is unchanged
        return t;
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
      case 'agenda':
        return { items: normalizeAgenda(d.items) };
      case 'wheel':
        return { items: normalizeWheelItems(d.items, dd.items) };
      case 'score':
        return { teams: normalizeTeams(d.teams, dd.teams) };
      case 'sequence': {
        var steps = normalizeSteps(d.steps);
        var at = Math.min(steps.length - 1, Math.max(0, Math.round(num(d.i, 0, MAX_STEPS, 0))));
        var q = { steps: steps, i: at, endsAt: num(d.endsAt, 0, 8.64e15, 0), remaining: num(d.remaining, 0, MAX_TIMER_S, steps[at].sec) };
        var ql = normalizeLink(d.link);
        if (ql) q.link = ql;
        return q;
      }
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
   * Splits `names` into groups, shuffled by `rng` (a fresh seed by default).
   * by 'size': groups of n, and a remainder too small to stand alone (under
   * half of n) is spread one each over the other groups rather than left as
   * a group of one. by 'count': exactly n groups (fewer if there are fewer
   * names), sizes differing by at most one.
   *
   * The split is _shared/grouping.js's since Path 13 P2 (v337): `sizeRule:
   * 'near'` is this rule, and Tools/grouping/test/parity.test.mjs holds it to
   * the old function. Members are keyed by position, so a name that appears
   * twice (two students of one name) is still two people, and a blank still
   * takes a place, as before; the engine would drop a repeated key.
   */
  function makeGroups(names, by, n, rng) {
    var list = (names || []).slice();
    n = Math.max(1, Math.floor(n) || 1);
    var opts = by === 'count' ? { count: n } : { size: n, sizeRule: 'near' };
    if (rng) opts.rng = rng;
    var members = list.map(function (nm, i) { return { key: String(i), name: nm }; });
    return global.Grouping.formGroups(members, opts).groups.map(function (g) {
      return g.map(function (k) { return list[+k]; });
    });
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

  /* How long until the bell, for the bell countdown widget. `mins` is minutes
     since midnight (fractions allowed). Inside a period it is the time until
     that period ends; between periods, the time until the next one starts;
     after the last, none. Seconds are rounded up, so it never reads 0:00 with
     time left. Reads the same rows as periodAt and writes nothing. */
  function untilBell(list, mins) {
    var at = periodAt(list, mins);
    if (at.current) return { kind: 'ends', label: at.current.label, secs: Math.max(0, Math.ceil((at.current.e - mins) * 60 - 1e-6)) };
    if (at.next) return { kind: 'starts', label: at.next.label, secs: Math.max(0, Math.ceil((at.next.s - mins) * 60 - 1e-6)) };
    return { kind: 'none', label: '', secs: 0 };
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

  /* ---- the phone remote's commands -------------------------------------- */

  /* A command arrives from another device, so it is untrusted like a file:
     anything not in this vocabulary is dropped, and every argument is checked
     here before the page acts on it. Each one does what the matching button
     on the board does, to the topmost widget of that type on the screen. */
  var TIMER_ACTIONS = ['toggle', 'reset', 'add'];
  function readCommand(m) {
    if (!isObj(m) || typeof m.cmd !== 'string') return null;
    switch (m.cmd) {
      case 'screen': return typeof m.id === 'string' && /^[\w-]{1,40}$/.test(m.id) ? { cmd: 'screen', id: m.id } : null;
      case 'timer': return TIMER_ACTIONS.indexOf(m.action) !== -1 ? { cmd: 'timer', action: m.action } : null;
      case 'stopwatch': return m.action === 'toggle' || m.action === 'reset' ? { cmd: 'stopwatch', action: m.action } : null;
      case 'pick': return { cmd: 'pick' };
      case 'groups': return { cmd: 'groups' };
      case 'roll': return { cmd: 'roll' };
      case 'light': return LIGHTS.indexOf(m.color) !== -1 ? { cmd: 'light', color: m.color } : null;
      case 'symbol': return SYMBOLS.indexOf(m.mode) !== -1 ? { cmd: 'symbol', mode: m.mode } : null;
      case 'hello': return { cmd: 'hello' };
    }
    return null;
  }

  /* ---- keyboard and clicker shortcuts (Path 22 P7) ------------------------ */

  /* Which shortcut, if any, a keydown is. `e` is the event's key, repeat and
     modifier flags; `where` says what had focus: `typing` (a field that
     swallows keys: an input, a text box, a select, an editable region) and
     `control` (a button, link or summary, which Space already presses). Nothing
     fires while someone types, or with Ctrl, Cmd or Alt held (the browser's own
     shortcuts), or on a held key. A presentation clicker sends Right and Left,
     and PageDown and PageUp. */
  function readKey(e, where) {
    if (!isObj(e) || typeof e.key !== 'string') return null;
    where = isObj(where) ? where : {};
    if (where.typing || e.ctrlKey || e.metaKey || e.altKey) return null;
    switch (e.key) {
      case '?': return { act: 'help' };
      case ' ': return e.repeat || where.control || e.shiftKey ? null : { act: 'timer' };
      case 'n': case 'N': return e.repeat ? null : { act: 'pick' };
      case 'ArrowRight': case 'PageDown': return e.shiftKey ? null : { act: 'next' };
      case 'ArrowLeft': case 'PageUp': return e.shiftKey ? null : { act: 'prev' };
    }
    return null;
  }

  var ClassScreenCore = {
    TYPES: TYPES,
    readCommand: readCommand,
    readKey: readKey,
    TEMPLATES: TEMPLATES.map(function (t) { return { id: t.id, name: t.name }; }),
    fromTemplate: fromTemplate,
    readPeriods: readPeriods,
    periodAt: periodAt,
    untilBell: untilBell,
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
    MAX_AGENDA: MAX_AGENDA,
    MAX_AGENDA_ITEM: MAX_AGENDA_ITEM,
    MAX_STEPS: MAX_STEPS,
    MAX_WHEEL: MAX_WHEEL,
    MAX_WHEEL_ITEM: MAX_WHEEL_ITEM,
    spinTo: spinTo,
    wheelAt: wheelAt,
    MAX_TEAMS: MAX_TEAMS,
    MAX_TEAM_NAME: MAX_TEAM_NAME,
    MAX_SCORE: MAX_SCORE,
    parseSequence: parseSequence,
    formatSequence: formatSequence,
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
