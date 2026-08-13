// seating-layout.js — read-only bridge from Seating Chart Generator's saved
// room layout (`seating-chart-v1`) to the Behavior & Points Tracker's tap
// board, so the board can be arranged the way the room actually is instead
// of alphabetically.
//
// Copied approach, not reinvented: Tools/010-command-center-dashboard.html
// already has a read-only seating panel (SEATING_KEY, loadSeating(), the
// loosely()/sameClass() name matching, the desk bounding-box + padding math,
// mirror-by-coordinate-reflection). This file follows that same shape so the
// two readers of seating-chart-v1 don't quietly disagree about what a chart
// means. It renders to plain 0-100% boxes instead of an SVG viewBox, because
// this board's cards are ordinary tappable <div>s wired into the existing
// click / long-press / flash / keyboard-arm machinery — an SVG <text> can't
// be one of those without a foreignObject detour that would cost more than
// it returns for the same picture. The bounding-box-and-padding math and the
// mirror reflection are the parts worth not redoing from scratch, and both
// are ported here unchanged in spirit.
//
// The one thing this file adds that the dashboard's panel doesn't need:
// matching a desk's assigned student back to *this tool's own roster name*.
// That's the same name-string matching problem _shared/student-details.js
// already solves for Class Roster Hub, so normalize() is imported from there
// rather than re-invented — and callers can additionally offer a preferred
// name per roster name (`altNames`), the same preferred-name precedent this
// tool already uses when showing a card. Seating Chart Generator has no idea
// about Class Roster Hub's stable ids (it mints its own, unrelated, id per
// desk-student), so matching here is by name, exactly like the rest of this
// tool's roster handling.
//
// DOM-free. Tools/behavior-points-tracker/test/smoke-seating-layout.mjs
// drives every export directly under plain Node.

import { normalize } from '../../_shared/student-details.js';

export const SEATING_KEY = 'seating-chart-v1';

/* Desk geometry, in the 1280x900 layout-px room space Tools/seating-chart/
   seating.mjs saves (ROOM.deskW / ROOM.deskH). The chart only saves desk
   *positions*, not their size, so this is kept in lockstep with
   Tools/010-command-center-dashboard.html's SEAT_DESK_W/H rather than read
   from the chart itself — both readers have to agree on it by convention. */
export const DESK_W = 106;
export const DESK_H = 70;
export const ROOM_PAD = 26;

/** Parse-guarded read of the saved chart. Never throws: a missing, corrupt,
    or hand-edited key reads as null, same as "no chart exists yet" — the
    caller's job is to leave the board standing (fall back to the ordinary
    alphabetical layout) rather than treat that as an error. */
export function parseSeatingState(raw) {
  if (!raw) return null;
  var parsed;
  try { parsed = JSON.parse(raw); } catch (e) { return null; }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sections) || !parsed.sections.length) return null;
  return parsed;
}

/** Names compared the way a teacher typed them rather than character by
    character — copied verbatim from Tools/010-command-center-dashboard.html's
    loosely()/sameClass(), which solves the identical "does this chart's
    class name mean this roster" matching problem. */
export function loosely(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
export function sameClass(a, b) {
  a = loosely(a); b = loosely(b);
  return !!a && !!b && (a === b || a.indexOf(b) !== -1 || b.indexOf(a) !== -1);
}

/**
 * Which saved chart section this tool's board should draw from.
 *
 *   chosenId    an id the teacher explicitly picked last time (remembered
 *               per Behavior & Points Tracker section) — wins if it still
 *               exists in the chart.
 *   rosterName  the Name Picker roster this section is following, if any —
 *               the stronger signal, since it was set deliberately.
 *   sectionName this tool's own section name, tried second.
 *
 * Falls back to the chart's own `active` section, then its first section, so
 * a chart with exactly one class in it just works with nothing to pick.
 * `parsed` is expected to already be parseSeatingState()'s output; this
 * function returns null only if it's handed something with no sections.
 */
export function pickSeatingSection(parsed, opts) {
  opts = opts || {};
  if (!parsed || !Array.isArray(parsed.sections) || !parsed.sections.length) return null;
  var byId = {};
  parsed.sections.forEach(function (s) { if (s && s.id) byId[s.id] = s; });
  if (opts.chosenId && byId[opts.chosenId]) return byId[opts.chosenId];
  var guess = null;
  if (opts.rosterName) {
    guess = parsed.sections.filter(function (s) { return sameClass(s.name, opts.rosterName); })[0];
  }
  if (!guess && opts.sectionName) {
    guess = parsed.sections.filter(function (s) { return sameClass(s.name, opts.sectionName); })[0];
  }
  if (guess) return guess;
  return byId[parsed.active] || parsed.sections[0];
}

/**
 * Positions this tool's roster names the way the room's desks actually sit,
 * scaled to 0-100% boxes so the caller can lay divs out with plain CSS
 * (left/top/width/height percentages of a room container held to the same
 * aspect ratio) instead of redoing this bounding-box math itself.
 *
 * A name only gets a seat if BOTH: the chart has a desk assigned to a
 * student whose name (or, failing that, whose entry in `altNames`) matches
 * it, AND that name is on the roster passed in as `names`. Everything else —
 * a roster name the chart has never heard of, a chart student not on this
 * roster, an empty desk — is left out of `seats` and comes back in
 * `unseated` instead of being silently dropped from the board. That is the
 * "a student isn't in it" half of the fallback contract: one unmatched
 * student never takes the rest of the seating layout down with it. A
 * missing/corrupt chart, or a chart section with no desks placed at all
 * (`seats` empty, `unseated` === every name), is the caller's cue to fall
 * back to the ordinary alphabetical layout entirely.
 *
 * `opts.mirror` reflects every desk left-right about the room's own bounds
 * (student's-eye view rather than teacher's-eye), the same
 * mirror-by-coordinate-reflection Tools/010-command-center-dashboard.html
 * uses — reflecting the coordinates keeps every card's own text right-way-
 * round without a counter-flip on each one, and the desk's rotation
 * reflects with it.
 *
 * `opts.altNames` is `{ rosterName: preferredNameOrFalsy }` — the same
 * preferred-name idea this tool already applies to cards, offered here in
 * case the chart's desk was labeled with the name the class calls a student
 * rather than the name on the roster line.
 */
export function layoutSeats(section, names, opts) {
  opts = opts || {};
  names = Array.isArray(names) ? names : [];
  var result = { seats: [], unseated: names.slice(), box: null };

  var desks = (section && Array.isArray(section.desks)) ? section.desks : [];
  if (!desks.length || !names.length) return result;

  var studentsById = {};
  (Array.isArray(section.students) ? section.students : []).forEach(function (s) {
    if (s && s.id) studentsById[s.id] = s;
  });
  var assign = (section.assign && typeof section.assign === 'object') ? section.assign : {};

  var byNormName = {};
  names.forEach(function (n) { byNormName[normalize(n)] = n; });
  var altOf = opts.altNames || {};
  var byNormAlt = {};
  names.forEach(function (n) {
    var alt = altOf[n];
    if (!alt) return;
    var key = normalize(alt);
    if (!byNormName[key] && !byNormAlt[key]) byNormAlt[key] = n;
  });

  var claimed = {};
  var rawSeats = [];
  desks.forEach(function (d) {
    if (!d || !d.id) return;
    var studentId = assign[d.id];
    var student = studentId ? studentsById[studentId] : null;
    if (!student) return;
    var key = normalize(student.name);
    var rosterName = byNormName[key] || byNormAlt[key];
    if (!rosterName || claimed[rosterName]) return;   // desk's student isn't (or no longer is) on this roster
    claimed[rosterName] = true;
    rawSeats.push({ name: rosterName, x: Number(d.x) || 0, y: Number(d.y) || 0, rot: Number(d.rot) || 0 });
  });

  if (!rawSeats.length) return result;

  var xs = rawSeats.map(function (s) { return s.x; });
  var ys = rawSeats.map(function (s) { return s.y; });
  var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs) + DESK_W;
  var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys) + DESK_H;
  var mirror = opts.mirror === true;

  var vx = minX - ROOM_PAD, vy = minY - ROOM_PAD;
  var vw = (maxX - minX) + 2 * ROOM_PAD, vh = (maxY - minY) + 2 * ROOM_PAD;

  result.box = { w: vw, h: vh };
  result.seats = rawSeats.map(function (s) {
    var x = s.x, rot = s.rot;
    if (mirror) { x = (minX + maxX) - x - DESK_W; rot = -rot; }
    return {
      name: s.name, rot: rot,
      leftPct: ((x - vx) / vw) * 100,
      topPct: ((s.y - vy) / vh) * 100,
      wPct: (DESK_W / vw) * 100,
      hPct: (DESK_H / vh) * 100,
    };
  });
  result.unseated = names.filter(function (n) { return !claimed[n]; });
  return result;
}

export default { SEATING_KEY, DESK_W, DESK_H, ROOM_PAD, parseSeatingState, loosely, sameClass, pickSeatingSection, layoutSeats };
