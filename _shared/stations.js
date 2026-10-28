/* stations.js — one station/room/hunt record that both 018 (QR Scavenger Hunt
   Builder) and 019 (Escape Room Builder) can read (Path 18 P1).

   Classic script publishing window.Stations. Pure: no storage, no DOM, no
   dependency. The design is the Path 18 P1 bullet of BACKLOG.md; this header
   records only what the build decided or added to it.

   THE RECORD lives in memory. On disk each tool keeps its own shape and field
   names and gains `id` on every station (and on a hunt). read(obj) turns either
   tool's saved object, share payload or file into the canonical set; write(set)
   returns the owning tool's own shape again. write() emits the tool's COMPLETE
   station shape, so a sparse station comes back with its defaults filled in.

   Additions to the design, each so a round trip loses nothing:
     - set.extra / station.extra / run.extra hold fields the module has no name
       for, and write() puts them back (an older page's data survives).
     - answer.answersText (a room's comma-separated string), answer.toleranceText
       (a hunt's tolerance string) and hint.minutesText (a hunt's penalty string)
       keep the text as typed; the parsed numbers beside them are what play uses.
     - set.x / station.x: write(set, otherKind) carries the full canonical copy
       so read() of that foreign shape gets the fields the other page has no
       name for. Only fields the foreign page can edit (id, prompt, label, note,
       codeWord, hint text) are taken from the visible fields.
     - run.by === 'id' marks an id-keyed run; an index-keyed run has no marker.
     - codeText(set, station, opts) takes the set, because a player-link code
       needs it.

   Nothing here trims, uppercases or clamps at read time; playable() does that
   once, the two pages' validStations() in one place. check() calls
   the answer matcher that was er-match.js (folded in at P2, v383), which stays
   published as window.EscapeRoomMatch. */
(function (global) {
  'use strict';

  var ID_LENGTH = 4;
  var ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var KINDS = ['hunt', 'room'];
  var ANSWER_TYPES = ['none', 'photo', 'choice', 'number', 'text', 'digits', 'cipher'];
  var CODE_WORDS = [
    'MAPLE', 'COMET', 'TIGER', 'ORBIT', 'ECHO', 'GRANITE', 'HARBOR', 'LANTERN',
    'MERIDIAN', 'PEBBLE', 'QUARTZ', 'RIVER', 'SUMMIT', 'TRAIL', 'VELVET', 'WILLOW',
    'ANCHOR', 'BEACON', 'CANYON', 'DRIFT', 'FALCON', 'GLACIER', 'HOLLOW', 'IVORY',
    'JASPER', 'KESTREL', 'LOOKOUT', 'MOSAIC', 'NUGGET', 'OPAL'
  ];
  var HUNT_TYPES = { text: 'none', photo: 'photo', choice: 'choice', numeric: 'number' };
  var HUNT_TYPES_BACK = { none: 'text', photo: 'photo', choice: 'choice', number: 'numeric' };
  var ROOM_TYPES = ['text', 'digits', 'cipher'];

  // ── small helpers (copied from the pages, to the letter) ──────────────────
  function isObj(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function str(v, d) { return typeof v === 'string' ? v : (d === undefined ? '' : d); }
  function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }

  function splitAnswers(raw) {   // 019
    return String(raw || '').split(',').map(function (a) { return a.trim(); }).filter(function (a) { return a.length; });
  }
  function clampShift(raw) {     // 019
    var x = parseInt(raw, 10);
    if (!isFinite(x) || isNaN(x)) x = 3;
    x = ((x % 26) + 26) % 26;
    if (x === 0) x = 13;
    return x;
  }
  function looksLikeUrl(v) {     // 018
    if (/\s/.test(v)) return false;
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:[0-9]+)?([\/?#][^\s]*)?$/i.test(v);
  }
  function normalizeContent(raw) { // 018
    var v = (raw || '').trim();
    if (!v) return '';
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return v;
    if (looksLikeUrl(v)) return 'https://' + v;
    return v;
  }

  // ── ids ───────────────────────────────────────────────────────────────────
  function usedSet(used) {
    var m = {};
    if (Array.isArray(used)) used.forEach(function (u) { m[u] = 1; });
    else if (used && typeof used.forEach === 'function') used.forEach(function (u) { m[u] = 1; });
    else if (isObj(used)) Object.keys(used).forEach(function (u) { m[u] = 1; });
    return m;
  }
  function newId(used, rng) {
    var taken = usedSet(used), r = rng || Math.random, id, tries = 0;
    do {
      id = '';
      for (var i = 0; i < ID_LENGTH; i++) id += ID_CHARS.charAt(Math.floor(r() * ID_CHARS.length));
      tries++;
    } while (taken[id] && tries < 1000);
    return id;
  }
  function newSetId() {    // 019's makeRoomId, kept as it is
    return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  }
  function validId(v) { return typeof v === 'string' && new RegExp('^[a-z0-9]{' + ID_LENGTH + '}$').test(v); }

  /** Draw the missing ids on a loaded blob in place. A hand-made duplicate or
      an id of the wrong form is redrawn for the later station. A hunt also
      gets a set id. Returns true when anything changed (the page saves). */
  function ensureIds(obj, rng) {
    if (!isObj(obj) || !Array.isArray(obj.stations)) return false;
    var kind = detect(obj), changed = false, seen = {};
    obj.stations.forEach(function (st) { if (isObj(st) && validId(st.id) && !seen[st.id]) seen[st.id] = 1; else if (isObj(st)) st._dupe = 1; });
    var taken = Object.keys(seen);
    obj.stations.forEach(function (st) {
      if (!isObj(st)) return;
      if (st._dupe) {
        delete st._dupe;
        st.id = newId(taken, rng);
        taken.push(st.id);
        changed = true;
      }
    });
    if (kind === 'hunt' && !(typeof obj.id === 'string' && obj.id)) { obj.id = newSetId(); changed = true; }
    return changed;
  }

  // ── detection ─────────────────────────────────────────────────────────────
  function detect(obj) {
    if (!isObj(obj)) return null;
    if (obj.kind === 'hunt' || obj.kind === 'room') return obj.kind;
    if (!Array.isArray(obj.stations)) return null;
    if (obj.roomId !== undefined || typeof obj.storyIntro === 'string') return 'room';
    if (String(obj.cardsPerPage) === '9') return 'hunt';
    for (var i = 0; i < obj.stations.length; i++) {
      var s = obj.stations[i];
      if (!isObj(s)) continue;
      if (s.qType !== undefined || s.content !== undefined) return 'hunt';
      if (s.clue !== undefined) return 'room';
    }
    return null;
  }

  // ── read ──────────────────────────────────────────────────────────────────
  var ROOM_SET_KEYS = ['name', 'roomId', 'id', 'storyIntro', 'cardsPerPage', 'ecLevel', 'showNumber', 'randomizeStart',
    'countdownEnabled', 'countdownMinutes', 'packetCardsPerPage', 'stations', 'kind', 'x'];
  var HUNT_SET_KEYS = ['name', 'id', 'cardsPerPage', 'ecLevel', 'showNumber', 'stations', 'run', 'kind', 'x'];
  var ROOM_ST_KEYS = ['id', 'clue', 'answers', 'hint', 'next', 'image', 'type', 'hintCost', 'awardLetter', 'cipherPlain',
    'cipherShift', 'maxAttempts', 'numericTolerance', 'codeWord', 'x'];
  var HUNT_ST_KEYS = ['id', 'label', 'content', 'note', 'qType', 'choices', 'correctChoice', 'numericAnswer', 'tolerance',
    'hint', 'hintPenalty', 'codeWord', 'x'];

  function extraOf(o, known) {
    var out = null;
    Object.keys(o).forEach(function (k) {
      if (known.indexOf(k) === -1) { if (!out) out = {}; out[k] = clone(o[k]); }
    });
    return out;
  }
  function blankAnswer() {
    return { type: 'none', accepted: [], choices: [], correct: 0, tolerance: null,
      cipher: { plain: '', shift: null }, maxAttempts: 0 };
  }

  function readRoomStation(st, id) {
    st = isObj(st) ? st : {};
    var type = st.type === undefined ? 'text' : st.type;
    var a = blankAnswer();
    a.type = type;
    a.answersText = str(st.answers, st.answers == null ? '' : String(st.answers));
    a.accepted = splitAnswers(st.answers);
    a.tolerance = st.numericTolerance === undefined ? null : st.numericTolerance;
    a.cipher = { plain: str(st.cipherPlain), shift: st.cipherShift === undefined ? null : st.cipherShift };
    a.maxAttempts = st.maxAttempts === undefined ? 0 : st.maxAttempts;
    var out = {
      id: id, label: '', prompt: str(st.clue), encode: 'player', note: '', codeWord: str(st.codeWord),
      image: str(st.image), letter: str(st.awardLetter), answer: a,
      hint: { text: str(st.hint), minutes: 0, points: st.hintCost === undefined ? 0 : st.hintCost },
      next: null
    };
    var ex = extraOf(st, ROOM_ST_KEYS);
    if (ex) out.extra = ex;
    if (isObj(st.x) && st.x.answer) foldForeign(out, st.x, 'room');
    return out;
  }

  function readHuntStation(st, id) {
    st = isObj(st) ? st : {};
    var a = blankAnswer();
    a.type = HUNT_TYPES[st.qType] || 'none';
    a.choices = Array.isArray(st.choices) ? st.choices.map(function (c) { return String(c == null ? '' : c); }) : [];
    a.correct = typeof st.correctChoice === 'number' ? st.correctChoice : 0;
    var numeric = typeof st.numericAnswer === 'string' ? st.numericAnswer : (st.numericAnswer != null ? String(st.numericAnswer) : '');
    a.accepted = numeric === '' ? [] : [numeric];
    var tol = typeof st.tolerance === 'string' ? st.tolerance : (st.tolerance != null ? String(st.tolerance) : '0');
    a.toleranceText = tol;
    a.tolerance = parseFloat(tol) || 0;
    var pen = typeof st.hintPenalty === 'string' ? st.hintPenalty : (st.hintPenalty != null ? String(st.hintPenalty) : '0');
    var out = {
      id: id, label: str(st.label), prompt: str(st.content), encode: 'prompt', note: str(st.note),
      codeWord: str(st.codeWord), image: '', letter: '', answer: a,
      hint: { text: typeof st.hint === 'string' ? st.hint : (st.hint != null ? String(st.hint) : ''),
        minutes: parseFloat(pen) || 0, minutesText: pen, points: 0 },
      next: null
    };
    var ex = extraOf(st, HUNT_ST_KEYS);
    if (ex) out.extra = ex;
    if (isObj(st.x) && st.x.answer) foldForeign(out, st.x, 'hunt');
    return out;
  }

  /* A foreign shape carrying `x`: take the full canonical copy, then let the
     fields this page can edit override it. */
  function foldForeign(out, x, kind) {
    var keep = { id: out.id, prompt: out.prompt, label: out.label, note: out.note, codeWord: out.codeWord, hintText: out.hint.text };
    var full = clone(x);
    Object.keys(out).forEach(function (k) { delete out[k]; });
    Object.keys(full).forEach(function (k) { out[k] = full[k]; });
    out.id = keep.id; out.prompt = keep.prompt;
    if (kind === 'hunt') { out.label = keep.label; out.note = keep.note; out.codeWord = keep.codeWord; }
    else { out.codeWord = keep.codeWord || out.codeWord; }
    out.hint.text = keep.hintText;
  }

  function assignIds(raw) {
    var seen = {}, used = [], n = 0;
    raw.forEach(function (st) {
      var id = isObj(st) && validId(st.id) && !seen[st.id] ? st.id : null;
      if (id) { seen[id] = 1; used.push(id); }
    });
    return raw.map(function (st) {
      var id = isObj(st) && validId(st.id) && seen[st.id] === 1 ? st.id : null;
      if (id) { seen[id] = 2; return id; }
      id = newId(used); used.push(id); n++;
      return id;
    }).concat([n]);
  }

  function read(obj) {
    var kind = detect(obj);
    if (!kind) return null;
    var ids = assignIds(obj.stations);
    var drew = ids.pop();
    var setId = typeof obj.roomId === 'string' && obj.roomId ? obj.roomId : (typeof obj.id === 'string' && obj.id ? obj.id : null);
    if (!setId) { setId = newSetId(); drew++; }
    var set = { v: 2, kind: kind, id: setId };
    var stations;
    if (kind === 'room') {
      var mins = obj.countdownMinutes;
      set.title = str(obj.name); set.intro = str(obj.storyIntro);
      set.entry = obj.randomizeStart ? 'any' : 'first';
      set.countdown = { enabled: !!obj.countdownEnabled, minutes: mins === undefined ? 20 : mins };
      set.print = { cardsPerPage: str(obj.cardsPerPage, '4'), ecLevel: str(obj.ecLevel, 'Q'), showNumber: obj.showNumber !== false,
        packetCardsPerPage: str(obj.packetCardsPerPage, '2') };
      stations = obj.stations.map(function (st, i) { return readRoomStation(st, ids[i]); });
      // next: a raw-list index becomes the id at that index
      obj.stations.forEach(function (st, i) {
        var n = isObj(st) ? st.next : null, out = stations[i];
        if (n === 'end') out.next = 'end';
        else if (typeof n === 'number' && n >= 0 && n < ids.length) out.next = ids[n];
        else out.next = null;
        if (isObj(st) && isObj(st.x) && st.x.answer && st.x.next !== undefined && out.next === null) out.next = st.x.next;
      });
      set.flow = 'chain';
    } else {
      set.title = str(obj.name); set.intro = '';
      set.entry = 'first';
      set.countdown = { enabled: false, minutes: 20 };
      set.print = { cardsPerPage: str(obj.cardsPerPage, '4'), ecLevel: str(obj.ecLevel, 'Q'), showNumber: obj.showNumber !== false,
        packetCardsPerPage: '2' };
      stations = obj.stations.map(function (st, i) { return readHuntStation(st, ids[i]); });
      set.flow = 'free';
    }
    if (isObj(obj.x) && obj.x.kind && obj.x.kind !== kind) {   // written for the other page: take back what it has no name for
      ['entry', 'countdown', 'flow'].forEach(function (k) { if (obj.x[k] !== undefined) set[k] = clone(obj.x[k]); });
      if (kind === 'hunt' && typeof obj.x.intro === 'string') set.intro = obj.x.intro;
      if (kind === 'hunt' && isObj(obj.x.print) && obj.x.print.packetCardsPerPage !== undefined) set.print.packetCardsPerPage = obj.x.print.packetCardsPerPage;
    }
    set.stations = stations;
    var known = kind === 'room' ? ROOM_SET_KEYS : HUNT_SET_KEYS;
    var ex = extraOf(obj, known);
    if (ex) set.extra = ex;
    set.run = null;
    if (kind === 'hunt' && isObj(obj.run)) {
      var byId = obj.run.by === 'id';
      var valid = playable(set).map(function (s) { return s.id; });
      set.run = remapRun(obj.run, valid, byId);
      set._dropped = byId ? 0 : set.run._dropped;
      delete set.run._dropped;
    }
    set._drew = drew;
    return set;
  }

  // ── write ─────────────────────────────────────────────────────────────────
  function writeRoomStation(st, ids, foreign) {
    var a = st.answer || blankAnswer(), n = st.next;
    var out = { id: st.id, clue: st.prompt, answers: a.answersText !== undefined ? a.answersText : (a.accepted || []).join(', '),
      hint: st.hint ? st.hint.text : '', next: null, image: st.image || '', type: a.type };
    if (n === 'end') out.next = 'end';
    else if (typeof n === 'string' && ids.indexOf(n) !== -1) out.next = ids.indexOf(n);
    if (foreign) { out.type = ROOM_TYPES.indexOf(a.type) !== -1 ? a.type : 'text'; out.answers = ''; }
    out.hintCost = st.hint ? st.hint.points : 0;
    out.awardLetter = st.letter || '';
    out.cipherPlain = a.cipher ? a.cipher.plain : '';
    if (a.cipher && a.cipher.shift !== null && a.cipher.shift !== undefined) out.cipherShift = a.cipher.shift;
    out.maxAttempts = a.maxAttempts || 0;
    out.numericTolerance = a.tolerance === undefined ? null : a.tolerance;
    if (st.codeWord) out.codeWord = st.codeWord;
    if (st.extra) Object.keys(st.extra).forEach(function (k) { out[k] = clone(st.extra[k]); });
    return out;
  }
  function writeHuntStation(st) {
    var a = st.answer || blankAnswer();
    var out = { id: st.id, label: st.label || '', content: st.prompt, note: st.note || '',
      qType: HUNT_TYPES_BACK[a.type] || 'text', choices: (a.choices || []).slice(), correctChoice: a.correct || 0,
      numericAnswer: (a.accepted && a.accepted.length && a.type !== 'text' && a.type !== 'digits' && a.type !== 'cipher') ? a.accepted[0] : '',
      tolerance: a.toleranceText !== undefined ? a.toleranceText : String(a.tolerance || 0),
      hint: st.hint ? st.hint.text : '',
      hintPenalty: st.hint && st.hint.minutesText !== undefined ? st.hint.minutesText : String(st.hint ? st.hint.minutes : 0),
      codeWord: st.codeWord || '' };
    if (st.extra) Object.keys(st.extra).forEach(function (k) { out[k] = clone(st.extra[k]); });
    return out;
  }

  function writeRun(run) {
    var out = { by: 'id', teams: (run.teams || []).map(clone) };
    out.timerRunning = run.timer ? !!run.timer.running : false;
    out.timerStartedAt = run.timer ? run.timer.startedAt : null;
    out.timerElapsedMs = run.timer ? run.timer.elapsedMs : 0;
    out.raceStartAt = run.timer ? run.timer.raceStartAt : null;
    out.checkinStation = run.checkinStation === undefined ? null : run.checkinStation;
    if (run.stagger !== undefined) out.stagger = run.stagger;
    if (run.extra) Object.keys(run.extra).forEach(function (k) { out[k] = clone(run.extra[k]); });
    return out;
  }

  function write(set, kind) {
    kind = kind || set.kind;
    var cross = kind !== set.kind;
    var ids = set.stations.map(function (s) { return s.id; });
    var out;
    if (kind === 'room') {
      out = { name: set.title, roomId: set.id, id: set.id,
        stations: set.stations.map(function (s) {
          var o = writeRoomStation(s, ids, cross);
          if (cross) o.x = clone(s);
          return o;
        }),
        cardsPerPage: set.print.cardsPerPage, ecLevel: set.print.ecLevel, showNumber: set.print.showNumber,
        randomizeStart: set.entry === 'any', countdownEnabled: !!set.countdown.enabled, countdownMinutes: set.countdown.minutes,
        storyIntro: set.intro || '', packetCardsPerPage: set.print.packetCardsPerPage };
      delete out.id;      // a room's set id is roomId, kept as it is
    } else {
      out = { name: set.title, id: set.id,
        stations: set.stations.map(function (s) {
          var o = writeHuntStation(s);
          if (cross) o.x = clone(s);
          return o;
        }),
        cardsPerPage: set.print.cardsPerPage, ecLevel: set.print.ecLevel, showNumber: set.print.showNumber };
      if (set.run && !cross) out.run = writeRun(set.run);
    }
    if (cross) out.x = { kind: set.kind, id: set.id, title: set.title, intro: set.intro, entry: set.entry,
      countdown: clone(set.countdown), print: clone(set.print), flow: set.flow };
    if (set.extra) Object.keys(set.extra).forEach(function (k) { out[k] = clone(set.extra[k]); });
    return out;
  }

  // ── playable ──────────────────────────────────────────────────────────────
  function roomNorm(st, i, imageSrc) {   // 019 validStations(), to the letter
    var a = st.answer, type = a.type || 'text';
    var answers = type === 'cipher' ? splitAnswers(a.cipher.plain) : splitAnswers(a.answersText !== undefined ? a.answersText : a.accepted.join(', '));
    var tol = (a.tolerance === undefined || a.tolerance === null || a.tolerance === '') ? null : Math.max(0, parseFloat(a.tolerance) || 0);
    return {
      idx: i, clue: (st.prompt || '').trim(), answers: answers, hint: ((st.hint && st.hint.text) || '').trim(),
      hintCost: Math.max(0, parseInt(st.hint && st.hint.points, 10) || 0),
      next: st._rawNext, image: imageSrc ? imageSrc(st.image) : st.image,
      type: type, cipherShift: clampShift(a.cipher.shift),
      awardLetter: (st.letter || '').trim().slice(0, 1).toUpperCase(),
      maxAttempts: Math.max(0, parseInt(a.maxAttempts, 10) || 0),
      numericTolerance: tol
    };
  }
  function huntNorm(st, i) {             // 018 validStations(), to the letter
    var a = st.answer;
    return {
      idx: i, label: (st.label || '').trim() || ('Station ' + (i + 1)),
      content: normalizeContent(st.prompt), note: (st.note || '').trim(),
      qType: HUNT_TYPES_BACK[a.type] || 'text', choices: (a.choices || []).slice(), correctChoice: a.correct,
      numericAnswer: a.accepted.length ? a.accepted[0] : '', tolerance: a.toleranceText !== undefined ? a.toleranceText : String(a.tolerance || 0),
      hint: ((st.hint && st.hint.text) || '').trim(), hintPenalty: parseFloat(st.hint && st.hint.minutesText !== undefined ? st.hint.minutesText : st.hint && st.hint.minutes) || 0,
      codeWord: st.codeWord
    };
  }

  /** The valid stations in play order. Each is a copy of the canonical station
      with `_index` (position in the authored list) and `_norm`, the page's own
      validStations() object for it. */
  function playable(set, opts) {
    var imageSrc = opts && opts.imageSrc, out = [];
    set.stations.forEach(function (st, i) {
      var c = clone(st);
      c._index = i;
      if (set.kind === 'room') {
        c._rawNext = st.next === 'end' ? 'end' : (typeof st.next === 'string' ? indexOfId(set, st.next) : null);
        c._norm = roomNorm(Object.assign(clone(st), { _rawNext: c._rawNext }), i, imageSrc);
        delete c._rawNext;
        if (!(c._norm.clue.length > 0 && c._norm.answers.length > 0)) return;
      } else {
        c._norm = huntNorm(st, i);
        if (!(c._norm.content.length > 0)) return;
      }
      out.push(c);
    });
    return out;
  }
  function indexOfId(set, id) {
    for (var i = 0; i < set.stations.length; i++) if (set.stations[i].id === id) return i;
    return null;
  }

  // ── play payload, url, reader ─────────────────────────────────────────────
  function roomPayload(set, valid) {     // 019 buildRoomPayload, 'end' kept
    var idxMap = {};
    valid.forEach(function (s, n) { idxMap[s._norm.idx] = n; });
    var room = {
      id: set.id,
      title: set.title || 'Escape Room',
      stations: valid.map(function (v) {
        var s = v._norm, next = null;
        if (s.next === 'end') next = 'end';
        else if (typeof s.next === 'number' && Object.prototype.hasOwnProperty.call(idxMap, s.next)) next = idxMap[s.next];
        var out = { clue: s.clue, answers: s.answers, hint: s.hint || '', next: next };
        if (s.image) out.image = s.image;
        if (s.type && s.type !== 'text') out.type = s.type;
        if (s.type === 'cipher') out.cipherShift = s.cipherShift;
        if (s.hintCost) out.hintCost = s.hintCost;
        if (s.awardLetter) out.awardLetter = s.awardLetter;
        if (s.maxAttempts) out.maxAttempts = s.maxAttempts;
        if (s.type === 'text' && s.numericTolerance !== null && s.numericTolerance !== undefined) out.numericTolerance = s.numericTolerance;
        return out;
      })
    };
    if (set.countdown && set.countdown.enabled) room.timerMinutes = Math.max(1, parseInt(set.countdown.minutes, 10) || 20);
    return room;
  }
  function huntPayload(set, valid) {
    var room = { id: set.id, title: set.title || 'Scavenger Hunt',
      stations: valid.map(function (v) {
        var a = v.answer;
        var out = { clue: v._norm.content, answers: a.accepted.slice(), hint: v._norm.hint, next: null };
        if (v.answer.type !== 'none') out.type = a.type;
        return out;
      }) };
    return room;
  }
  function stationPayloadFor(room, n) {  // 019, to the letter
    var out = {
      id: room.id, title: room.title,
      stations: room.stations.map(function (st, i) {
        var copy = {};
        if (i !== n) {
          if (st.hintCost) copy.hintCost = st.hintCost;
          if (st.awardLetter) copy.awardLetter = '?';
          return copy;
        }
        Object.keys(st).forEach(function (k) { if (k !== 'image') copy[k] = st[k]; });
        if (st.image) copy.imageOnCard = 1;
        return copy;
      })
    };
    if (room.timerMinutes) out.timerMinutes = room.timerMinutes;
    return out;
  }

  /** The `r=` object: today's buildRoomPayload then stationPayloadFor, plus
      v: 2, ids (the playable stations' ids as one fixed-width string, in play
      order), and next: 'end' kept where today's drops it to null. */
  function playPayload(set, opts) {
    opts = opts || {};
    var valid = playable(set, opts);
    var room = set.kind === 'room' ? roomPayload(set, valid) : huntPayload(set, valid);
    var n = typeof opts.station === 'number' ? opts.station : null;
    var out = n === null ? room : stationPayloadFor(room, n);
    out.v = 2;
    out.ids = valid.map(function (s) { return s.id; }).join('');
    return out;
  }
  function encodeRoom(room) { return btoa(unescape(encodeURIComponent(JSON.stringify(room)))); }
  function playUrl(set, n, opts) {
    opts = opts || {};
    var base = opts.base || (typeof location !== 'undefined' ? location.href : 'http://localhost/Tools/019-escape-room-builder.html');
    var payload = playPayload(set, { station: typeof n === 'number' ? n : null, imageSrc: opts.imageSrc });
    var url = new URL('escape-room-builder/lock.html', base);
    url.searchParams.set('r', encodeRoom(payload));
    if (typeof n === 'number') url.searchParams.set('s', String(n));
    if (opts.start && typeof n === 'number') url.searchParams.set('start', '1');
    return url.href;
  }

  /** The player's reader: a v1 payload (a whole room from before #320, or a
      #320 station code) or a v2 one. `ids` is an array or null. */
  function playRead(obj) {
    if (!isObj(obj) || !Array.isArray(obj.stations)) return null;
    var ids = null;
    if (obj.v === 2 && typeof obj.ids === 'string' && obj.ids.length === obj.stations.length * ID_LENGTH) {
      ids = [];
      for (var i = 0; i < obj.stations.length; i++) ids.push(obj.ids.slice(i * ID_LENGTH, (i + 1) * ID_LENGTH));
    }
    var out = Object.assign({}, obj);
    delete out.ids;
    out.ids = ids;
    return out;
  }

  function codeText(set, station, opts) {
    if (station.encode === 'player') {
      var pl = playable(set), pos = -1;
      pl.forEach(function (s, n) { if (s.id === station.id) pos = n; });
      return pos === -1 ? '' : playUrl(set, pos, opts);
    }
    return normalizeContent(station.prompt);
  }
  function teamCodeText(team) { return 'HUNT-TEAM:' + team.code; }

  // ── answer matching (was er-match.js, folded in at P2) ───────────────────
  // lock.html and 019's test-run mode both match through this, so a teacher's
  // test run says what a student will see. Lifted verbatim from er-match.js,
  // including the deliberate split between the two normalizers. Still
  // published as window.EscapeRoomMatch for the callers that name it.
  /* The light one, for digit locks and ciphers. The curly quotes are in the
     set because a teacher who writes the accepted phrase in Word gets U+2019
     whether they want it or not, and the student's phone gives them the same
     character back — but a Chromebook keyboard gives the straight one, so the
     two have to normalize together or the same phrase fails on one device and
     passes on the other. */
  function normalizeAnswer(s) {
    return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ')
      .replace(/[.,!?'"\u2018\u2019\u201c\u201d]/g, '');
  }

  /**
   * The forgiving one, for free-typed text answers.
   *
   * Four passes, in this order, because the order is where the bugs were:
   *
   *  1. Accents come off, so `café` and `cafe` are one answer. A language
   *     class types the accented form on one device and not on another, and
   *     the answer did not change.
   *  2. Apostrophes are *deleted*, in every shape a keyboard or a word
   *     processor produces, so `it's` collapses to `its` rather than breaking
   *     into two words. An apostrophe lives inside a word; it is the one mark
   *     here that does not separate anything.
   *  3. A `.` or `,` sitting between two digits is deleted too, so `1,000`
   *     and `1000` match, and `3.14` keeps being one token.
   *  4. Every *other* run of non-alphanumeric characters becomes a single
   *     space. Two things depended on this and neither used to work:
   *       - `well-known` now matches `well known`. Deleting the hyphen glued
   *         the words into `wellknown`, which matched nothing a teacher would
   *         have typed.
   *       - stripping punctuation used to run *after* whitespace was
   *         collapsed, so any mark with spaces around it left a double space
   *         behind — `1 / 2` became `1  2`, which could never equal anything.
   *
   * What this deliberately does *not* do is match an answer that merely
   * contains an accepted one. `it's a keyboard` is still wrong against an
   * accepted `a keyboard`, because the alternative — accepting any answer with
   * the right words somewhere in it — would accept `I don't know` at a station
   * whose answer is `no`. A teacher who wants the full sentence should list it
   * as another accepted answer; the field takes a comma-separated list.
   */
  function normalizeTextAnswer(s) {
    return String(s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/['\u2018\u2019\u02bc\u00b4`]/g, '')
      .replace(/(\d)[.,](\d)/g, '$1$2')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  /** Plain Levenshtein edit distance — used only to decide whether a wrong
      text answer is a near miss worth a gentler message, never to accept an
      answer as correct. */
  function levenshtein(a, b) {
    var m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    var prev = new Array(n + 1);
    var curr = new Array(n + 1);
    for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
      curr[0] = i;
      for (var k = 1; k <= n; k++) {
        var cost = a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1;
        curr[k] = Math.min(prev[k] + 1, curr[k - 1] + 1, prev[k - 1] + cost);
      }
      var tmp = prev; prev = curr; curr = tmp;
    }
    return prev[n];
  }

  /** "Close but not correct" — within a couple of edits of some accepted
      answer, scaled a little for longer answers, but never so loose that a
      genuinely different answer counts as a near miss. */
  function isNearMiss(given, acceptedList) {
    if (!given) return false;
    return acceptedList.some(function (accepted) {
      if (!accepted || accepted === given) return false;
      var dist = levenshtein(given, accepted);
      return dist > 0 && dist <= Math.max(1, Math.min(3, Math.ceil(accepted.length * 0.3)));
    });
  }

  /**
   * Is `rawGiven` an accepted answer for `station`?
   * @returns {{correct: boolean, nearMiss: boolean}}
   */
  function checkAnswer(station, rawGiven) {
    station = station || {};
    var answers = station.answers || [];
    var type = station.type || 'text';

    if (type !== 'text') {
      var givenOld = normalizeAnswer(rawGiven);
      var acceptedOld = answers.map(normalizeAnswer);
      return { correct: givenOld.length > 0 && acceptedOld.indexOf(givenOld) !== -1, nearMiss: false };
    }

    var givenNorm = normalizeTextAnswer(rawGiven);
    var acceptedNorm = answers.map(normalizeTextAnswer);
    var correct = givenNorm.length > 0 && acceptedNorm.indexOf(givenNorm) !== -1;

    if (!correct && station.numericTolerance !== undefined && station.numericTolerance !== null) {
      var givenNum = parseFloat(rawGiven);
      if (!isNaN(givenNum) && String(rawGiven).trim() !== '') {
        correct = answers.some(function (a) {
          var accNum = parseFloat(a);
          return !isNaN(accNum) && Math.abs(accNum - givenNum) <= station.numericTolerance;
        });
      }
    }

    return { correct: correct, nearMiss: correct ? false : isNearMiss(givenNorm, acceptedNorm) };
  }

  // ── check ─────────────────────────────────────────────────────────────────
  function check(station, given) {
    var a = station.answer, t = a.type;
    if (t === 'none' || t === 'photo') return { correct: false, nearMiss: false, reached: true };
    if (t === 'choice') return { correct: given === a.correct, nearMiss: false };
    if (t === 'number') {
      var val = parseFloat(given), target = parseFloat(a.accepted[0]);
      var tol = parseFloat(a.tolerance) || 0;
      return { correct: !isNaN(val) && !isNaN(target) && Math.abs(val - target) <= tol, nearMiss: false };
    }
    var answers = t === 'cipher' ? splitAnswers(a.cipher.plain) : splitAnswers(a.answersText !== undefined ? a.answersText : a.accepted.join(', '));
    var m = { answers: answers, type: t };
    if (t === 'text' && a.tolerance !== null && a.tolerance !== undefined && a.tolerance !== '') m.numericTolerance = Math.max(0, parseFloat(a.tolerance) || 0);
    var r = checkAnswer(m, given);
    return { correct: r.correct, nearMiss: r.nearMiss };
  }

  // ── chain walk ────────────────────────────────────────────────────────────
  /** The station a team goes to after `station`: an id, 'end' (the teacher
      chose "End here"), or null (the last station). A jump to a station that
      is not playable is "auto", which is what the payload made of it. */
  function nextOf(set, station) {
    var pl = playable(set), pos = -1;
    pl.forEach(function (s, n) { if (s.id === station.id) pos = n; });
    if (pos === -1) return null;
    var n = station.next;
    if (n === 'end') return 'end';
    if (typeof n === 'string') {
      for (var i = 0; i < pl.length; i++) if (pl[i].id === n) return n;
    }
    return pos + 1 < pl.length ? pl[pos + 1].id : null;
  }
  function reachable(set) {
    var pl = playable(set), byId = {}, seen = [], cur = pl.length ? pl[0].id : null;
    pl.forEach(function (s) { byId[s.id] = s; });
    while (cur && cur !== 'end' && seen.indexOf(cur) === -1) {
      seen.push(cur);
      cur = nextOf(set, byId[cur]);
    }
    return seen;
  }

  // ── runs and progress ─────────────────────────────────────────────────────
  /** 018's index-keyed run to an id-keyed one (or, with `alreadyById`, the
      id-keyed form write() emits back to the canonical one). `idsByIndex` is the playable
      stations' ids in play order. A mark past the end is dropped and counted on
      `_dropped`. */
  function remapRun(run, idsByIndex, alreadyById) {
    var dropped = 0;
    function map(o, upgrade) {
      var out = {};
      Object.keys(isObj(o) ? o : {}).forEach(function (k) {
        if (alreadyById) { out[k] = upgrade ? upgrade(o[k]) : clone(o[k]); return; }
        var id = idsByIndex[parseInt(k, 10)];
        if (id === undefined || String(parseInt(k, 10)) !== k) { dropped++; return; }
        out[id] = upgrade ? upgrade(o[k]) : clone(o[k]);
      });
      return out;
    }
    var teams = (Array.isArray(run.teams) ? run.teams : []).map(function (t) {
      var out = clone(t);
      out.marks = map(t.marks, function (m) { return typeof m === 'number' ? { at: m, correct: true } : clone(m); });
      out.attempts = map(t.attempts);
      out.hintsUsed = map(t.hintsUsed);
      return out;
    });
    var ci = run.checkinStation;
    var res = {
      by: 'id', teams: teams,
      timer: { running: !!run.timerRunning, startedAt: run.timerStartedAt === undefined ? null : run.timerStartedAt,
        elapsedMs: typeof run.timerElapsedMs === 'number' ? run.timerElapsedMs : 0,
        raceStartAt: run.raceStartAt === undefined ? null : run.raceStartAt },
      checkinStation: alreadyById ? (typeof ci === 'string' ? ci : null) : (typeof ci === 'number' && idsByIndex[ci] !== undefined ? idsByIndex[ci] : null),
      _dropped: dropped
    };
    if (run.stagger !== undefined) res.stagger = run.stagger;
    var ex = extraOf(run, ['teams', 'timerRunning', 'timerStartedAt', 'timerElapsedMs', 'raceStartAt', 'checkinStation', 'stagger', 'by']);
    if (ex) res.extra = ex;
    return res;
  }

  /** lock.html's index-keyed progress to id-keyed, when the code carries ids.
      Without ids nothing changes. 'done' stays 'done'. */
  function upgradeProgress(progress, ids) {
    if (!isObj(progress) || !Array.isArray(ids)) return progress;
    if (progress.by === 'id') return progress;
    function map(o) {
      if (!isObj(o)) return o;
      var out = {};
      Object.keys(o).forEach(function (k) {
        var id = ids[parseInt(k, 10)];
        if (id !== undefined) out[id] = o[k];
      });
      return out;
    }
    var out = Object.assign({}, progress, { by: 'id' });
    if (typeof progress.current === 'number') out.current = ids[progress.current] !== undefined ? ids[progress.current] : progress.current;
    ['misses', 'solved', 'hintsUsed', 'letters', 'lockUntil'].forEach(function (k) { if (k in progress) out[k] = map(progress[k]); });
    return out;
  }

  /** The payload budget for a set's printed codes (Path 18 P2): one row per playable station,
      { id, n, bytes, version, modules, px, ok, reason }. Each station's code text is what the
      page prints (a room's player link at that station, a hunt's content), planned by qr-draw.js
      at the canvas the sheet draws it on (600 px by default) and the error-correction level the
      page uses. `ok` is false when a module would be under qr-draw's measured floor (4 px, so a
      phone can read it) or the text is past what any code holds; `reason` then says which
      station, how big it is and what to shorten. Needs qr-draw.js (and the vendored encoder)
      loaded first. */
  function budget(set, opts) {
    opts = opts || {};
    var QD = global.QrDraw;
    if (!QD) throw new Error('Stations.budget needs qr-draw.js loaded first');
    var level = opts.ecLevel || 'Q', px = opts.px || 600, out = [];
    playable(set, opts).forEach(function (st, n) {
      var text = set.kind === 'room'
        ? playUrl(set, n, { start: !!opts.start, base: opts.base, imageSrc: opts.imageSrc })
        : codeText(set, st, opts);
      var plan = QD.plan(text, { maxPx: px, level: level });
      var row = { id: st.id, n: n, bytes: plan.bytes, version: plan.version, modules: plan.modules, px: plan.px, ok: plan.ok, reason: '' };
      if (!plan.ok) {
        row.reason = plan.modules === null
          ? 'Station ' + (n + 1) + '\u2019s code is ' + plan.bytes + ' bytes, more than any QR code can hold (about 2,900). Shorten its clue, answers or hint.'
          : 'Station ' + (n + 1) + '\u2019s code is ' + plan.bytes + ' bytes, ' + plan.modules + ' modules across. On the printed code that is under ' +
            QD.MIN_PX_PER_MODULE + ' px per module, which phones cannot read reliably. Shorten its clue, answers or hint.';
      }
      out.push(row);
    });
    return out;
  }

  global.Stations = {
    KINDS: KINDS, ANSWER_TYPES: ANSWER_TYPES, ID_LENGTH: ID_LENGTH, CODE_WORDS: CODE_WORDS,
    detect: detect, read: read, write: write, ensureIds: ensureIds, newId: newId, newSetId: newSetId,
    playable: playable, playPayload: playPayload, playUrl: playUrl, playRead: playRead,
    codeText: codeText, teamCodeText: teamCodeText, check: check, nextOf: nextOf, reachable: reachable,
    remapRun: remapRun, upgradeProgress: upgradeProgress, budget: budget
  };
  global.EscapeRoomMatch = {
    normalizeAnswer: normalizeAnswer,
    normalizeTextAnswer: normalizeTextAnswer,
    levenshtein: levenshtein,
    isNearMiss: isNearMiss,
    checkAnswer: checkAnswer
  };
})(typeof window !== 'undefined' ? window : this);
