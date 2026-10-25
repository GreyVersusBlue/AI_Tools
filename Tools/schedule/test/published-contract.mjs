// published-contract.mjs — what a published schedule browser's data is.
//
// Path 11 P1 (BACKLOG.md, "Path 11", the P1 bullet). A file 035's Publish
// makes, and 034, carry one line `const PUBLISHED_DATA = {...};`. Nothing but
// that file's own script reads it, so a reader and its data are always the
// same age today; they come apart only when 034's data is refreshed by hand
// and in P6, where one browser takes many data files. This is the contract for
// those, written once, test-side only (a published file cannot import).
//
//   formatOf(data)          the integer in data.format, or 0 when there is none
//   validate(data)          { ok, format, errors: [{path, message}], warnings }
//   upgrade(data)           a copy at FORMAT; throws on a format above it
//   readEmbedded(html)      the PUBLISHED_DATA line of a published file, parsed
//   shapeOf(data)           types and counts, NO values: the only thing a
//                           failure may print, because 034's data is a real
//                           staff list and CI's log is public
//
// Format 0 is every file published up to v61, 034's included. Format 1 adds
// `format: 1` and `tool` and changes nothing else. Adding a field does not
// raise FORMAT; a change that would make an older reader show something wrong
// does, and upgrade() gains the step in the same commit. What a reader does
// with data above its own format: nothing is built for it (Devon, 2026-10-21,
// P11-3: the default, no handling).

export const FORMAT = 1;

/** The keys the publisher writes, in its order. check-publisher.mjs holds
 *  brBuildPublishedHTML()'s `data` object to this list (DATA). */
export const DATA_KEYS = ['school', 'publishedOn', 'dept', 'order', 'teachers', 'sections',
  'room2teacher', 'groupRooms', 'modCount', 'modLabel', 'bell', 'geometry'];
/** Missing in a format-0 file published before R60 (Devon, 2026-10-21, P11-5:
 *  old files are still read; the reader already allows it with `|| {}`). */
export const OPTIONAL_IN_0 = ['groupRooms', 'bell', 'geometry'];
const FORMAT1_KEYS = ['format', 'tool'];

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isInt = v => Number.isInteger(v);
const isStr = v => typeof v === 'string';
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

export function formatOf(data) {
  return isObj(data) && isInt(data.format) ? data.format : 0;
}

export function readEmbedded(html) {
  const lines = String(html).replace(/\r/g, '').split('\n')
    .filter(l => l.startsWith('const PUBLISHED_DATA = '));
  if (lines.length !== 1) throw new Error(`expected one "const PUBLISHED_DATA = " line, found ${lines.length}`);
  const body = lines[0].slice('const PUBLISHED_DATA = '.length).replace(/;\s*$/, '');
  return JSON.parse(body);
}

export function upgrade(data) {
  const f = formatOf(data);
  if (f > FORMAT) throw new Error(`data is format ${f}; this reader knows up to ${FORMAT}`);
  const out = JSON.parse(JSON.stringify(data));
  if (f < 1) {
    // 0 → 1: the two fields, nothing else touched.
    out.format = 1;
    if (!own(out, 'tool')) out.tool = 'unknown';
  }
  return out;
}

/** Types and counts only. Never a key or a value from the input. */
export function shapeOf(data) {
  const kind = v => v === null ? 'null' : Array.isArray(v) ? `array(${v.length})`
    : isObj(v) ? `object(${Object.keys(v).length})` : typeof v;
  if (!isObj(data)) return { data: kind(data) };
  const out = {};
  for (const k of DATA_KEYS.concat(FORMAT1_KEYS)) if (own(data, k)) out[k] = kind(data[k]);
  const extra = Object.keys(data).filter(k => !DATA_KEYS.includes(k) && !FORMAT1_KEYS.includes(k)).length;
  if (extra) out.unknownKeys = extra;
  if (isObj(data.geometry) && Array.isArray(data.geometry.floors)) {
    out.floors = data.geometry.floors.map(f => isObj(f) && Array.isArray(f.rooms) ? f.rooms.length : kind(f));
  }
  return out;
}

export function validate(data) {
  const errors = [], warnings = [];
  const err = (path, message) => errors.push({ path, message });
  const warn = (path, message) => warnings.push({ path, message });
  // Paths name a position, never a teacher or a group: an index into the
  // object's keys, so a failure printed in CI carries no staff name.
  const at = (obj, key) => Object.keys(obj).indexOf(key);

  if (!isObj(data)) { err('', 'not an object'); return { ok: false, format: 0, errors, warnings }; }
  const format = formatOf(data);
  if (own(data, 'format') && !isInt(data.format)) err('format', 'not an integer');
  if (format > FORMAT) err('format', `format ${format} is newer than this contract (${FORMAT})`);
  if (format >= 1 && !isStr(data.tool)) err('tool', 'format 1 needs a tool version string');

  for (const k of DATA_KEYS) {
    if (!own(data, k) && !(format === 0 && OPTIONAL_IN_0.includes(k))) err(k, 'missing');
  }
  if (own(data, 'school') && !isStr(data.school)) err('school', 'not a string');
  if (own(data, 'publishedOn') && !(isStr(data.publishedOn) && /^\d{4}-\d{2}-\d{2}$/.test(data.publishedOn))) {
    err('publishedOn', 'not YYYY-MM-DD');
  }
  if (own(data, 'modLabel') && !isStr(data.modLabel)) err('modLabel', 'not a string');
  const modCount = data.modCount;
  if (own(data, 'modCount') && !(isInt(modCount) && modCount >= 1)) err('modCount', 'not an integer of 1 or more');

  const dept = isObj(data.dept) ? data.dept : {};
  if (own(data, 'dept') && !isObj(data.dept)) err('dept', 'not an object');
  for (const [code, d] of Object.entries(dept)) {
    const p = `dept[${at(dept, code)}]`;
    if (!isObj(d)) { err(p, 'not an object'); continue; }
    if (!(isStr(d.c) && /^#[0-9a-fA-F]{6}$/.test(d.c))) err(p + '.c', 'not #rrggbb');
    if (!(isStr(d.name) || d.name === null)) err(p + '.name', 'not a string');
  }
  if (own(data, 'order')) {
    if (!isObj(data.order)) err('order', 'not an object');
    else for (const [code, n] of Object.entries(data.order)) {
      if (!isInt(n)) err(`order[${at(data.order, code)}]`, 'not an integer');
    }
  }

  const teachers = isObj(data.teachers) ? data.teachers : {};
  const sections = isObj(data.sections) ? data.sections : {};
  if (own(data, 'teachers') && !isObj(data.teachers)) err('teachers', 'not an object');
  if (own(data, 'sections') && !isObj(data.sections)) err('sections', 'not an object');
  const okMods = isInt(modCount) && modCount >= 1;

  for (const [name, t] of Object.entries(teachers)) {
    const p = `teachers[${at(teachers, name)}]`;
    if (!isObj(t)) { err(p, 'not an object'); continue; }
    for (const k of ['dept', 'room', 'plan']) if (!isStr(t[k])) err(`${p}.${k}`, 'not a string');
    if (isStr(t.dept) && isObj(data.dept) && !own(dept, t.dept)) {
      warn(`${p}.dept`, 'a department code with no entry (the reader falls back to grey)');
    }
    if (!Array.isArray(t.sec)) err(`${p}.sec`, 'not an array');
    else t.sec.forEach((g, i) => { if (!own(sections, g)) err(`${p}.sec[${i}]`, 'names no group'); });
    if (!Array.isArray(t.co)) err(`${p}.co`, 'not an array');
    else t.co.forEach((c, i) => {
      if (!own(teachers, c)) err(`${p}.co[${i}]`, 'names no teacher');
      else if (!(Array.isArray(teachers[c].co) && teachers[c].co.includes(name))) {
        warn(`${p}.co[${i}]`, 'a co-teacher who does not list this teacher back');
      }
    });
    for (const day of ['A', 'B']) {
      const slots = t[day];
      if (!Array.isArray(slots)) { err(`${p}.${day}`, 'not an array'); continue; }
      // brDeriveScheduleData() gives a teacher with no group visits `[]`, not
      // a day of Planning; the reader shows an empty day. Not an error.
      if (slots.length === 0) { warn(`${p}.${day}`, 'a teacher with no day at all'); continue; }
      if (okMods && slots.length !== modCount) err(`${p}.${day}`, `not ${modCount} slots long`);
      slots.forEach((s, i) => {
        if (s !== 'Planning' && !own(sections, s)) err(`${p}.${day}[${i}]`, 'a slot naming no group');
      });
    }
  }

  for (const [g, list] of Object.entries(sections)) {
    const p = `sections[${at(sections, g)}]`;
    if (!Array.isArray(list)) { err(p, 'not an array'); continue; }
    list.forEach((tn, i) => {
      if (!own(teachers, tn)) { err(`${p}[${i}]`, 'names no teacher'); return; }
      const t = teachers[tn];
      const shows = ['A', 'B'].some(d => Array.isArray(t[d]) && t[d].includes(g));
      if (!shows) warn(`${p}[${i}]`, "a section listing a teacher whose own day never shows that group");
    });
  }

  if (own(data, 'room2teacher')) {
    if (!isObj(data.room2teacher)) err('room2teacher', 'not an object');
    else for (const [room, tn] of Object.entries(data.room2teacher)) {
      const p = `room2teacher[${at(data.room2teacher, room)}]`;
      if (!own(teachers, tn)) err(p, 'names no teacher');
    }
    for (const [name, t] of Object.entries(teachers)) {
      if (isObj(t) && isStr(t.room) && t.room && isObj(data.room2teacher) && own(data.room2teacher, t.room)
          && data.room2teacher[t.room] !== name) {
        err(`teachers[${at(teachers, name)}].room`, "room2teacher gives this teacher's room to someone else");
      }
    }
  }

  if (own(data, 'groupRooms')) {
    if (!isObj(data.groupRooms)) err('groupRooms', 'not an object');
    else for (const [g, r] of Object.entries(data.groupRooms)) {
      const p = `groupRooms[${at(data.groupRooms, g)}]`;
      if (!own(sections, g)) err(p, 'names no group');
      if (!isObj(r)) { err(p, 'not an object'); continue; }
      for (const day of ['A', 'B']) {
        if (!Array.isArray(r[day])) { err(`${p}.${day}`, 'not an array'); continue; }
        if (okMods && r[day].length !== modCount) err(`${p}.${day}`, `not ${modCount} long`);
        r[day].forEach((x, i) => { if (!(x === null || isStr(x))) err(`${p}.${day}[${i}]`, 'not a room or null'); });
      }
    }
  }

  if (own(data, 'bell') && data.bell !== null) {
    if (!isObj(data.bell)) err('bell', 'not null or an object');
    else for (const day of ['A', 'B']) {
      const b = data.bell[day];
      if (!Array.isArray(b)) err(`bell.${day}`, 'not an array');
      else if (okMods && b.length !== modCount) err(`bell.${day}`, `not ${modCount} long`);
      else b.forEach((x, i) => { if (!isStr(x)) err(`bell.${day}[${i}]`, 'not a string'); });
    }
  }

  if (own(data, 'geometry') && data.geometry !== null) {
    const g = data.geometry;
    if (!isObj(g) || !Array.isArray(g.floors)) err('geometry', 'not { floors: [] }');
    else {
      const seen = new Set();
      g.floors.forEach((f, fi) => {
        const p = `geometry.floors[${fi}]`;
        if (!isObj(f)) { err(p, 'not an object'); return; }
        if (!(isStr(f.id) || isInt(f.id))) err(p + '.id', 'not a string');
        if (!isStr(f.label)) err(p + '.label', 'not a string');
        if (!isInt(f.cols) || !isInt(f.rows)) { err(p, 'cols and rows not integers'); return; }
        const inside = c => Array.isArray(c) && c.length === 2 && isInt(c[0]) && isInt(c[1])
          && c[0] >= 0 && c[1] >= 0 && c[0] < f.cols && c[1] < f.rows;
        for (const k of ['hall', 'stair']) {
          if (!Array.isArray(f[k])) err(`${p}.${k}`, 'not an array');
          else f[k].forEach((c, i) => { if (!inside(c)) err(`${p}.${k}[${i}]`, 'a cell outside cols by rows'); });
        }
        if (!Array.isArray(f.rooms)) { err(p + '.rooms', 'not an array'); return; }
        f.rooms.forEach((r, ri) => {
          const rp = `${p}.rooms[${ri}]`;
          if (!isObj(r)) { err(rp, 'not an object'); return; }
          if (!isStr(r.rn)) err(rp + '.rn', 'not a string');
          else if (seen.has(r.rn)) err(rp + '.rn', 'a room number on two rooms');
          else seen.add(r.rn);
          if (!(r.teacher === null || isStr(r.teacher))) err(rp + '.teacher', 'not a string or null');
          if (!Array.isArray(r.cells)) err(rp + '.cells', 'not an array');
          else r.cells.forEach((c, i) => { if (!inside(c)) err(`${rp}.cells[${i}]`, 'a cell outside cols by rows'); });
        });
      });
    }
  }

  return { ok: errors.length === 0, format, errors, warnings };
}
