/* rooms.js — which testing room each student goes to, for 077's room-assignment
   view. A plain script that publishes one global, `TacgRooms`, so the page can
   call it and a pure-Node suite can import it.

   Nothing here touches the page or storage. The page owns the DOM and the
   saved state; this file owns the decisions that have to be right, because a
   student sent to a room that does not offer their accommodation is a child
   sitting a test without it:

     The rule. A student may go to a room only if the room provides EVERY
     accommodation the student has ticked. There is no partial credit and no
     "closest room": a student who cannot be placed is returned as unplaced with
     the reason, and the page says so; nothing is ever placed wrongly to make
     the count come out.

     The route. route() is deterministic: the same students, rooms and kept
     placements give the same answer, with no random draw and no dependence on
     object key order. Students with the most accommodations are placed first
     (the hardest to fit), ties in roster order; each takes the eligible room
     that offers the fewest accommodations it does not need (so a student who
     needs only a separate setting is not given the one room that also reads
     aloud), ties in room order. When the best room is full, an already-placed
     student is moved to another eligible room if that makes space (the
     standard augmenting path, so a student is left unplaced only when no
     arrangement at all can seat them), and the move is made in a fixed order.

     Kept placements. `keep` is a map of student name to room id the route must
     not change, which is how "route only the unplaced" and a teacher's hand
     moves survive a second press. A kept student still takes their seat in the
     room's capacity; whether that placement is a good one is check()'s question,
     not route()'s.

     The reasons. For every student left over, `reason` says which of three
     things is true: no room offers an accommodation at all (`missing` names
     them), no single room offers the whole combination (`combo`), or the rooms
     that would do are full (`full`, with their ids). The page turns these into
     sentences. */
(function (global) {
  'use strict';

  /** A room's capacity as a whole number of seats, 0 when it is blank or not a number. */
  function capacityOf(room) {
    var n = Math.floor(Number(room && room.capacity));
    return isFinite(n) && n > 0 ? n : 0;
  }

  /** The ids in `provides` that name a type that still exists, in the room's own order. */
  function providesOf(room, typeIds) {
    var have = {};
    typeIds.forEach(function (id) { have[id] = true; });
    var out = [], seen = {};
    ((room && room.provides) || []).forEach(function (id) {
      if (have[id] && !seen[id]) { seen[id] = true; out.push(id); }
    });
    return out;
  }

  /** The type ids ticked for `name`, in the order the types are listed. */
  function needsOf(state, name) {
    return (state.types || []).filter(function (t) {
      return !!(state.assignments || {})[name + '|' + t.id];
    }).map(function (t) { return t.id; });
  }

  /** The students who have at least one accommodation, in roster order. They are
      the only ones who need a room; the rest stay in their own class. */
  function routable(state) {
    return (state.roster || []).filter(function (n) { return needsOf(state, n).length > 0; });
  }

  /** The ids in `needs` that `room` does not provide. [] means the room is a fit. */
  function missingFor(needs, room, typeIds) {
    var has = {};
    providesOf(room, typeIds).forEach(function (id) { has[id] = true; });
    return needs.filter(function (id) { return !has[id]; });
  }

  /** How many students each room holds: { roomId: count }, rooms with nobody at 0. */
  function loads(rooms, placed) {
    var out = {};
    rooms.forEach(function (r) { out[r.id] = 0; });
    Object.keys(placed).forEach(function (n) {
      if (Object.prototype.hasOwnProperty.call(out, placed[n])) out[placed[n]]++;
    });
    return out;
  }

  /**
   * route({ students: [{ name, needs }], rooms, typeIds, keep })
   *   -> { placed: { name: roomId }, unplaced: [{ name, needs, reason }] }
   * `students` is in roster order. `rooms` is the saved rooms, in order. `keep`
   * is optional. `unplaced` is in roster order.
   */
  function route(input) {
    var students = input.students || [];
    var rooms = input.rooms || [];
    var typeIds = input.typeIds || [];
    var keep = input.keep || {};

    var roomIndex = {};
    rooms.forEach(function (r, i) { roomIndex[r.id] = i; });
    var provides = rooms.map(function (r) { return providesOf(r, typeIds); });
    var cap = rooms.map(capacityOf);
    var assigned = rooms.map(function () { return []; });
    var placed = {};

    // Kept students sit first and cannot be moved.
    var fixed = {};
    students.forEach(function (s) {
      var rid = keep[s.name];
      if (Object.prototype.hasOwnProperty.call(keep, s.name) && Object.prototype.hasOwnProperty.call(roomIndex, rid)) {
        fixed[s.name] = true;
        placed[s.name] = rid;
        assigned[roomIndex[rid]].push(s.name);
      }
    });

    var rank = {};
    students.forEach(function (s, i) { rank[s.name] = i; });
    var byName = {};
    students.forEach(function (s) { byName[s.name] = s; });

    // The rooms a student may use, best fit first.
    var eligibleCache = {};
    function eligible(s) {
      if (eligibleCache[s.name]) return eligibleCache[s.name];
      var list = [];
      rooms.forEach(function (r, i) {
        var has = {};
        provides[i].forEach(function (id) { has[id] = true; });
        if (s.needs.every(function (id) { return has[id]; })) {
          list.push({ i: i, extra: provides[i].length - s.needs.length });
        }
      });
      list.sort(function (a, b) { return a.extra - b.extra || a.i - b.i; });
      eligibleCache[s.name] = list.map(function (x) { return x.i; });
      return eligibleCache[s.name];
    }

    var seen;
    function augment(s) {
      var opts = eligible(s);
      for (var k = 0; k < opts.length; k++) {
        var ri = opts[k];
        if (seen[ri]) continue;
        seen[ri] = true;
        if (assigned[ri].length < cap[ri]) { assigned[ri].push(s.name); return true; }
        var inRoom = assigned[ri].slice();
        for (var m = 0; m < inRoom.length; m++) {
          var other = inRoom[m];
          if (fixed[other]) continue;
          if (augment(byName[other])) {
            assigned[ri].splice(assigned[ri].indexOf(other), 1);
            assigned[ri].push(s.name);
            return true;
          }
        }
      }
      return false;
    }

    var order = students.filter(function (s) { return !fixed[s.name]; }).sort(function (a, b) {
      return b.needs.length - a.needs.length || rank[a.name] - rank[b.name];
    });
    var left = {};
    order.forEach(function (s) {
      seen = {};
      if (!augment(s)) left[s.name] = true;
    });

    assigned.forEach(function (list, i) {
      list.forEach(function (n) { placed[n] = rooms[i].id; });
    });

    var unplaced = [];
    students.forEach(function (s) {
      if (!left[s.name]) return;
      unplaced.push({ name: s.name, needs: s.needs.slice(), reason: whyNot(s, rooms, provides) });
    });
    return { placed: placed, unplaced: unplaced };
  }

  /** Why nobody could seat this student. */
  function whyNot(s, rooms, provides) {
    var fits = [];
    rooms.forEach(function (r, i) {
      var has = {};
      provides[i].forEach(function (id) { has[id] = true; });
      if (s.needs.every(function (id) { return has[id]; })) fits.push(r.id);
    });
    if (fits.length) return { kind: 'full', rooms: fits };
    var offered = {};
    provides.forEach(function (list) { list.forEach(function (id) { offered[id] = true; }); });
    var missing = s.needs.filter(function (id) { return !offered[id]; });
    if (missing.length) return { kind: 'missing', missing: missing };
    return { kind: 'combo', needs: s.needs.slice() };
  }

  global.TacgRooms = {
    capacityOf: capacityOf,
    providesOf: providesOf,
    needsOf: needsOf,
    routable: routable,
    missingFor: missingFor,
    loads: loads,
    route: route
  };
})(typeof window !== 'undefined' ? window : globalThis);
