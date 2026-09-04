/* seating-read.js — the one read-only reader of `seating-chart-v1`, the chart
   005 Seating Chart Generator saves.

   Why this exists. Four files render or read that key today and none of them
   shares a line with another: 010's inline SVG panel, 008's
   behavior-points-tracker/seating-layout.js (which says in its own header that
   it is copying 010's approach so the two "don't quietly disagree about what a
   chart means"), 045's printed desk table, and 007's roster peek. They already
   disagree in three places, and all three are recorded below rather than
   quietly harmonised, because two of them are a teacher-visible decision and
   not this module's to take.

   WHAT A CHART IS, from Tools/seating-chart/seating.mjs, which owns the shape:

     { sections: [ { id, name, students: [{id, name, note, flag}],
                     desks: [{id, x, y, rot, locked}],
                     assign: { deskId: studentId } } ],
       active: sectionId, mirror: bool, numbered: bool }

     Desk coordinates are the TOP-LEFT corner in a 1280x900 layout space, and
     the chart does not save a desk's size — 106x70 is ROOM.deskW/deskH over
     there, and a constant here, exactly as 010 and 008 each already hardcode
     it. If that ever changes it changes in three files, which is one of the
     reasons this module exists.

   THE THREE DISAGREEMENTS, all real, none invented here:

     1. Which section to show. 010 remembers a choice per class period and
        falls back to roster name, then period label, then state.active, then
        the first section. 008 remembers per its own section, then tries
        roster name, then section name, then the same two fallbacks. 045 shows
        state.active and nothing else. pickSection() takes the chain as a list
        of names to try, so all three express their own precedence with one
        implementation.
     2. What the bounding box is drawn around. 010 measures EVERY desk; 008
        measures only the desks whose student it matched to its own roster. On
        a chart where somebody is unmatched those are different rooms, and 008's
        also moves its mirror axis. bounds() measures whatever it is handed, so
        a caller keeps its behaviour — but 010's is the one to converge on, and
        008 changing to it is a visible change to a teacher's board, so it waits
        for that tool's own round.
     3. Rotated desks. 010 allows for the (w-h)/2 a turned desk overhangs its
        own box by, or the desk is clipped; 008 does not, and 045 draws no room
        at all. `overhang` is computed here and included in the box, which is
        the strictly safer of the two.

   Read-only, on purpose and permanently. 005 owns this key; nothing here
   writes, and no reader should — a chart edited from two tools is a chart with
   no owner. Everything is parse-guarded and returns "no chart" rather than
   throwing: a corrupt or hand-edited key must leave the reading tool standing,
   because its own job is not seating.

   Plain global script, not an ES module, for the reason store.js gives: half
   this site's tools use `<script type="module">` and half use classic scripts.
   An ES module caller reads window.SeatingRead instead of importing it. */
(function (global) {
  'use strict';

  var KEY = 'seating-chart-v1';

  /* ROOM.deskW / ROOM.deskH from Tools/seating-chart/seating.mjs. The chart
     saves desk positions, not desk sizes, so every reader has to know these by
     convention — which is why they are here once rather than in each. */
  var DESK_W = 106;
  var DESK_H = 70;
  var PAD = 26;          // breathing room around the outermost desks
  var FRONT_BAND = 62;   // the FRONT OF ROOM bar 005 and 010 both draw

  /* ---- reading ---------------------------------------------------------- */

  /** A chart from a raw string, or null. Never throws: a missing, corrupt or
      hand-edited key is "no chart saved yet", which is what every caller has
      a fallback for already. */
  function parse(raw) {
    if (!raw) return null;
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return null; }
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.sections) || !parsed.sections.length) return null;
    return parsed;
  }

  /** The saved chart, or null. */
  function read() {
    var raw = null;
    try { raw = global.localStorage.getItem(KEY); } catch (e) { return null; }
    return parse(raw);
  }

  /* A plain `storage` listener rather than Store.onChange: 005 writes this key
     through assets/js/gvb-save.js, not through _shared/store.js, so the
     same-tab CustomEvent half of that API would never fire for it and the
     wiring would imply a guarantee this key does not have. Cross-tab is the
     case that matters anyway — the teacher edits the chart in 005 and looks at
     it in another tab. Returns an unsubscribe. */
  function onChange(fn) {
    if (!global.addEventListener) return function () {};
    var handler = function (e) {
      if (!e || e.key !== KEY) return;     // a cleared storage has no key
      fn(parse(e.newValue), KEY);
    };
    global.addEventListener('storage', handler);
    return function () { global.removeEventListener('storage', handler); };
  }

  /* ---- matching a class to a section ------------------------------------ */

  /** Names compared the way a teacher typed them rather than character by
      character: case, punctuation and doubled spaces all vary between a roster
      list and the chart's name for the same class. */
  function loosely(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function sameClass(a, b) {
    a = loosely(a); b = loosely(b);
    return !!a && !!b && (a === b || a.indexOf(b) !== -1 || b.indexOf(a) !== -1);
  }

  /**
   * Which section a reader should show.
   *
   *   chosenId  an id the teacher picked explicitly — wins outright if it is
   *             still in the chart, and is ignored if it is not (a section can
   *             be deleted in 005 long after a reader remembered it).
   *   names     names to try in the caller's own order of confidence: 010
   *             passes [period.roster, period.label], 008 passes [rosterName,
   *             sectionName]. The first that loosely matches a section wins.
   *
   * Falls back to the chart's own `active`, then its first section, so a chart
   * with one class in it just works with nothing to pick. Returns null only
   * for something with no sections at all.
   */
  function pickSection(state, opts) {
    opts = opts || {};
    if (!state || !Array.isArray(state.sections) || !state.sections.length) return null;
    var byId = {};
    state.sections.forEach(function (s) { if (s && s.id) byId[s.id] = s; });
    if (opts.chosenId && byId[opts.chosenId]) return byId[opts.chosenId];

    var names = opts.names || [];
    for (var i = 0; i < names.length; i++) {
      if (!names[i]) continue;
      var hit = null;
      for (var j = 0; j < state.sections.length; j++) {
        if (sameClass(state.sections[j].name, names[i])) { hit = state.sections[j]; break; }
      }
      if (hit) return hit;
    }
    return byId[state.active] || state.sections[0];
  }

  /* ---- the room --------------------------------------------------------- */

  function studentsById(section) {
    var by = {};
    (section && Array.isArray(section.students) ? section.students : []).forEach(function (s) {
      if (s && s.id) by[s.id] = s;
    });
    return by;
  }

  /**
   * Every desk in a section, in the chart's own order, with its student
   * resolved and mirroring already applied:
   *
   *   { id, index, x, y, rot, student }
   *
   * `index` is the desk's position in the saved order, which is what 005 and
   * 010 both number a seat by — it survives mirroring, so a numbered chart
   * does not renumber itself when the teacher flips the view.
   *
   * `opts.mirror` reflects the room left-right (student's-eye rather than
   * teacher's-eye). Reflecting COORDINATES rather than flipping the drawing
   * keeps every label the right way round without a counter-flip on each one,
   * and the rotation reflects with it. The axis is the full desk set's own
   * bounds, so the room stays where it is.
   */
  function placeDesks(section, opts) {
    opts = opts || {};
    var desks = (section && Array.isArray(section.desks)) ? section.desks : [];
    if (!desks.length) return [];
    var by = studentsById(section);
    var assign = (section.assign && typeof section.assign === 'object') ? section.assign : {};

    var minX = Infinity, maxX = -Infinity;
    desks.forEach(function (d) {
      var x = Number(d && d.x) || 0;
      if (x < minX) minX = x;
      if (x + DESK_W > maxX) maxX = x + DESK_W;
    });
    var mirror = opts.mirror === true;

    return desks.map(function (d, i) {
      var x = Number(d && d.x) || 0;
      var y = Number(d && d.y) || 0;
      var rot = Number(d && d.rot) || 0;
      if (mirror) { x = (minX + maxX) - x - DESK_W; rot = -rot; }
      return {
        id: d && d.id, index: i, x: x, y: y, rot: rot,
        student: (d && d.id && assign[d.id]) ? (by[assign[d.id]] || null) : null
      };
    });
  }

  /**
   * The viewBox around a set of placed desks — pass every desk (010's room),
   * or only the ones a caller matched (008's). `frontBand` reserves space
   * above the desks for a FRONT OF ROOM bar; pass 0 when there is none.
   *
   * A rotated desk overhangs its own box by (w-h)/2 top and bottom, so the
   * extents allow for it or a turned desk is clipped — the one of the three
   * existing readers' behaviours that is strictly safer.
   */
  function bounds(placed, opts) {
    opts = opts || {};
    var pad = typeof opts.pad === 'number' ? opts.pad : PAD;
    var frontBand = typeof opts.frontBand === 'number' ? opts.frontBand : 0;
    if (!placed || !placed.length) return null;

    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, turned = false;
    placed.forEach(function (p) {
      if (p.x < minX) minX = p.x;
      if (p.x + DESK_W > maxX) maxX = p.x + DESK_W;
      if (p.y < minY) minY = p.y;
      if (p.y + DESK_H > maxY) maxY = p.y + DESK_H;
      if ((p.rot || 0) % 180 !== 0) turned = true;
    });
    var overhang = turned ? (DESK_W - DESK_H) / 2 : 0;

    return {
      minX: minX, maxX: maxX, minY: minY, maxY: maxY, overhang: overhang,
      vx: minX - pad - overhang,
      vy: minY - pad - frontBand - overhang,
      vw: (maxX - minX) + 2 * (pad + overhang),
      vh: (maxY - minY) + 2 * (pad + overhang) + frontBand
    };
  }

  /** Placed desks as percentages of their own box, for a caller laying plain
      divs out with CSS rather than drawing an SVG (008's tap board). The
      container has to hold box.w / box.h as its aspect ratio for the room to
      keep its proportions. */
  function toPercent(placed, box) {
    if (!box || !box.vw || !box.vh) return [];
    return placed.map(function (p) {
      return {
        id: p.id, index: p.index, rot: p.rot, student: p.student,
        leftPct: ((p.x - box.vx) / box.vw) * 100,
        topPct: ((p.y - box.vy) / box.vh) * 100,
        wPct: (DESK_W / box.vw) * 100,
        hPct: (DESK_H / box.vh) * 100
      };
    });
  }

  /* ---- who is, and is not, sitting down --------------------------------- */

  /** The section's students who have no desk, in roster order. Names, because
      that is what all three readers print. */
  function unseatedNames(section) {
    var assign = (section && section.assign && typeof section.assign === 'object') ? section.assign : {};
    var seated = {};
    Object.keys(assign).forEach(function (deskId) { seated[assign[deskId]] = true; });
    return (section && Array.isArray(section.students) ? section.students : [])
      .filter(function (s) { return s && !seated[s.id]; })
      .map(function (s) { return s.name; })
      .filter(Boolean);
  }

  /** How full the room is: { filled, total }. */
  function fill(section) {
    var placed = placeDesks(section, {});
    var filled = 0;
    placed.forEach(function (p) { if (p.student) filled++; });
    return { filled: filled, total: placed.length };
  }

  /**
   * The chart as a printable table (045's sub binder): one row per desk in
   * READING ORDER — down the room, then across — rather than in the order the
   * desks happen to have been dragged out, because a substitute reads a room
   * front to back and the saved order means nothing to them.
   *
   * `{ rows: [{ label, name, note, flag }], unseated: [student] }`, with an
   * empty desk's name blank rather than dropped: a printed chart with a gap in
   * it is information.
   */
  function deskRows(section) {
    var placed = placeDesks(section, {}).slice().sort(function (a, b) {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });
    var seated = {};
    var rows = placed.map(function (p, i) {
      var s = p.student;
      if (s && s.id) seated[s.id] = true;
      return {
        label: 'Desk ' + (i + 1),
        name: s ? s.name : '',
        note: s ? (s.note || '') : '',
        flag: s ? !!s.flag : false
      };
    });
    var unseated = (section && Array.isArray(section.students) ? section.students : [])
      .filter(function (s) { return s && !seated[s.id]; });
    return { rows: rows, unseated: unseated };
  }

  global.SeatingRead = {
    KEY: KEY,
    DESK_W: DESK_W,
    DESK_H: DESK_H,
    PAD: PAD,
    FRONT_BAND: FRONT_BAND,

    parse: parse,
    read: read,
    onChange: onChange,

    loosely: loosely,
    sameClass: sameClass,
    pickSection: pickSection,

    placeDesks: placeDesks,
    bounds: bounds,
    toPercent: toPercent,

    unseatedNames: unseatedNames,
    fill: fill,
    deskRows: deskRows
  };
})(window);
