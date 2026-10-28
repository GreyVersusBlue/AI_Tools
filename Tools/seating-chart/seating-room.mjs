/* seating-room.mjs — the room layer (Path 14 P4). Pure: no DOM, no storage.

   A room is drawn once and shared by every period that sits in it:
     state.rooms   = [{ id, name, desks: [{id,x,y,rot}], marks: [{id,kind,x,y,w,h,rot,label}] }]
     section.room  = a room id
   Both exist only once used, so a chart saved before rooms loads byte-identical.

   A section in a room keeps its own `desks` field as a MIRROR of the room's desks
   (geometry from the room; `locked` and `empty` stay the section's, being about that
   period's seating). _shared/seating-read.js and its readers (010, 008, 045, 007, 002)
   read section.desks and never learn a room exists. A room that is missing on load
   drops section.room and keeps the desks. Every change here returns a new state and
   leaves the old one alone. The geometry below is ROOM's in seating.mjs (the suite
   pins the two together); this file imports nothing so seating.mjs can import it. */

export const MARK_KINDS = ['door', 'window', 'teacher', 'bench', 'projector', 'obstacle'];
const W = 1280, H = 900, DESK_W = 106, DESK_H = 70;
export const GEOMETRY = { width: W, height: H, deskW: DESK_W, deskH: DESK_H };

const str = v => (typeof v === 'string' ? v : '');
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const uid = (rng = Math.random) => rng().toString(36).slice(2, 9);

function repairMark(m, rng) {
  if (!m || typeof m !== 'object' || !MARK_KINDS.includes(m.kind)) return null;
  const w = clamp(num(m.w, 80), 10, W), h = clamp(num(m.h, 40), 10, H);
  return {
    id: str(m.id) || uid(rng), kind: m.kind,
    x: clamp(num(m.x, 0), 0, W - w), y: clamp(num(m.y, 0), 0, H - h), w, h,
    rot: [0, 90, 180, 270].includes(num(m.rot, 0)) ? num(m.rot, 0) : 0,
    label: str(m.label).slice(0, 40),
  };
}

/** The `rooms` list as stored: shape-checked, ids kept unique, geometry only on the desks.
    `repairDesks` is seating.mjs's own, so a room's desks are cleaned exactly as a section's. */
export function repairRooms(raw, rng, repairDesks) {
  const out = [], seen = new Set();
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!r || typeof r !== 'object') continue;
    const id = str(r.id) || uid(rng);
    if (seen.has(id)) continue;
    seen.add(id);
    const dseen = new Set();
    const desks = repairDesks(r.desks, rng)
      .filter(d => !dseen.has(d.id) && dseen.add(d.id))
      .map(d => ({ id: d.id, x: d.x, y: d.y, rot: d.rot }));
    const mseen = new Set();
    const marks = (Array.isArray(r.marks) ? r.marks : []).map(m => repairMark(m, rng))
      .filter(m => m && !mseen.has(m.id) && mseen.add(m.id));
    out.push({ id, name: str(r.name).trim() || `Room ${out.length + 1}`, desks, marks });
  }
  return out;
}

/** A section's desks as a room dictates: the room's geometry, the section's own `locked`
    and `empty` for a desk it already had. Key order matches repairDesks, so a section that
    already mirrors its room is unchanged by it. */
export function mirrorDesks(room, sectionDesks) {
  const own = new Map((sectionDesks || []).map(d => [d.id, d]));
  return room.desks.map(d => {
    const o = own.get(d.id);
    return { id: d.id, x: d.x, y: d.y, rot: d.rot, locked: !!(o && o.locked), ...(o && o.empty === true ? { empty: true } : {}) };
  });
}

const roomOf = (state, id) => (state.rooms || []).find(r => r.id === id) || null;
const mapSections = (state, fn) => ({ ...state, sections: state.sections.map(fn) });

function seatsOn(section, desks) {
  const have = new Set(desks.map(d => d.id));
  const assign = {};
  for (const [dk, sid] of Object.entries(section.assign || {})) if (have.has(dk)) assign[dk] = sid;
  return assign;
}

/** Make a room from a section's desks (same desk ids, so its seats stay) and put it in. */
export function createRoom(state, sectionId, name, rng = Math.random) {
  const sec = state.sections.find(s => s.id === sectionId);
  if (!sec) return { state, room: null };
  const room = {
    id: uid(rng), name: str(name).trim() || `Room ${(state.rooms || []).length + 1}`,
    desks: sec.desks.map(d => ({ id: d.id, x: d.x, y: d.y, rot: d.rot })), marks: [],
  };
  return {
    room,
    state: { ...mapSections(state, s => (s.id === sectionId ? { ...s, room: room.id } : s)), rooms: [...(state.rooms || []), room] },
  };
}

/** Put a section in an existing room. Seats on desks the room has stay; the rest are
    unseated and counted. The section's saved layouts are left alone. */
export function attachSection(state, sectionId, roomId) {
  const room = roomOf(state, roomId), sec = state.sections.find(s => s.id === sectionId);
  if (!room || !sec) return { state, unseated: 0 };
  const desks = mirrorDesks(room, sec.desks), assign = seatsOn(sec, desks);
  return {
    unseated: Object.keys(sec.assign || {}).length - Object.keys(assign).length,
    state: mapSections(state, s => (s.id === sectionId ? { ...s, room: roomId, desks, assign } : s)),
  };
}

/** The section keeps the desks it has and stops following the room. */
export function detachSection(state, sectionId) {
  return mapSections(state, s => { if (s.id !== sectionId || !s.room) return s; const { room, ...rest } = s; return rest; });
}

/** The one place the room is edited: its desks change, and every period in it follows.
    `desks` is geometry ({id,x,y,rot}); new ids are new desks. Seats on a removed desk are dropped
    and counted. */
export function setRoomDesks(state, roomId, desks) {
  const room = roomOf(state, roomId);
  if (!room) return { state, unseated: 0 };
  const clean = [], seen = new Set();
  for (const d of desks) {
    if (!d || typeof d.id !== 'string' || !d.id || seen.has(d.id)) continue;
    seen.add(d.id);
    clean.push({ id: d.id, x: clamp(num(d.x, 40), 0, W - DESK_W), y: clamp(num(d.y, 110), 0, H - DESK_H), rot: [0, 90, 180, 270].includes(num(d.rot, 0)) ? num(d.rot, 0) : 0 });
  }
  const next = { ...room, desks: clean };
  let unseated = 0;
  const state2 = mapSections({ ...state, rooms: state.rooms.map(r => (r.id === roomId ? next : r)) }, s => {
    if (s.room !== roomId) return s;
    const d = mirrorDesks(next, s.desks), assign = seatsOn(s, d);
    unseated += Object.keys(s.assign || {}).length - Object.keys(assign).length;
    return { ...s, desks: d, assign };
  });
  return { state: state2, unseated };
}

/** Add a mark, or replace the one with the same id. Returns the repaired mark too. */
export function setMark(state, roomId, mark, rng = Math.random) {
  const room = roomOf(state, roomId), m = repairMark(mark, rng);
  if (!room || !m) return { state, mark: null };
  const marks = room.marks.some(x => x.id === m.id) ? room.marks.map(x => (x.id === m.id ? m : x)) : [...room.marks, m];
  return { mark: m, state: { ...state, rooms: state.rooms.map(r => (r.id === roomId ? { ...room, marks } : r)) } };
}

export function removeMark(state, roomId, markId) {
  return { ...state, rooms: (state.rooms || []).map(r => (r.id === roomId ? { ...r, marks: r.marks.filter(m => m.id !== markId) } : r)) };
}

/** Delete a room. Every period in it keeps its desks and seats and stops following it. */
export function deleteRoom(state, roomId) {
  const rooms = (state.rooms || []).filter(r => r.id !== roomId);
  const next = mapSections(state, s => { if (s.room !== roomId) return s; const { room, ...rest } = s; return rest; });
  if (rooms.length) return { ...next, rooms };
  const { rooms: _drop, ...rest } = next;
  return rest;
}

/** Desk ids whose centre is within `radius` of the edge of a mark (a door, a window): the
    desk list for a tapped zone, so "near the door" is a rule over desks and not a new kind. */
export function desksNear(room, markId, radius = 150) {
  const m = room && room.marks.find(x => x.id === markId);
  if (!m) return [];
  return room.desks.filter(d => {
    const cx = d.x + DESK_W / 2, cy = d.y + DESK_H / 2;
    const dx = Math.max(m.x - cx, 0, cx - (m.x + m.w)), dy = Math.max(m.y - cy, 0, cy - (m.y + m.h));
    return Math.hypot(dx, dy) <= radius;
  }).map(d => d.id);
}

/** Which periods sit in a room, for the editor's "this changes N periods" line. */
export function sectionsIn(state, roomId) {
  return state.sections.filter(s => s.room === roomId).map(s => s.id);
}
