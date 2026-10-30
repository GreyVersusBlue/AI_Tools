// sv-check.js — the School Layout Visualizer's schedule checks.
//
// Path 11 P5 increment 1 (BACKLOG.md, "Path 11", the P5 bullet, which has the
// design). One pure function, checkSchedule(), reads the groups, the room
// registry and the settings and returns findings: codes, ids and numbers. It
// never changes the schedule and nothing it returns is stored; the schedule is
// the record and the findings are worked out again on every change. The one
// stored thing is an accepted finding ("I know, it's fine"), keyed by the
// finding's fingerprint, which the page keeps in `stviz_checks`.
//
// sentence() is the one English line for each kind. It is exported so the
// banner, the what-if lab and the suite print one text.
//
// Nothing here touches the DOM, `AppState` or storage. The page puts the module
// on `window.SVCheck`. Its suite is test/check.test.mjs
// (npm run test:schedule-check).

import { modLabels, bellDay, groupWeight } from './sv-model.js';
import '../../_shared/list-sentence.js';

export const KINDS = [
  'room-double', 'teacher-double',
  'over-capacity', 'teacher-no-planning', 'teacher-run', 'teacher-moves', 'passing-too-short', 'room-unknown',
  'group-gap', 'teacher-rooms', 'teacher-idle', 'room-idle', 'room-no-dept', 'room-no-teacher',
];
export const SEVERITY = {
  'room-double': 'error', 'teacher-double': 'error',
  'over-capacity': 'warn', 'teacher-no-planning': 'warn', 'teacher-run': 'warn', 'teacher-moves': 'warn',
  'passing-too-short': 'warn', 'room-unknown': 'warn',
  'group-gap': 'note', 'teacher-rooms': 'note', 'teacher-idle': 'note', 'room-idle': 'note',
  'room-no-dept': 'note', 'room-no-teacher': 'note',
};
const SEV_ORDER = { error: 0, warn: 1, note: 2 };

/** An accepted finding that matches nothing is kept this many days from `on`. */
export const ACK_KEEP_DAYS = 30;

export const CHECK_DEFAULTS = Object.freeze({ maxRun: 4, passingMarginSec: 0, off: [] });

/** settings.checks with its defaults filled; a bad value is the default. */
export function normalizeChecks(c) {
  const src = (c && typeof c === 'object') ? c : {};
  const maxRun = parseInt(src.maxRun, 10);
  const margin = parseInt(src.passingMarginSec, 10);
  return {
    maxRun: (Number.isFinite(maxRun) && maxRun >= 1 && maxRun <= 20) ? maxRun : CHECK_DEFAULTS.maxRun,
    passingMarginSec: (Number.isFinite(margin) && margin >= 0 && margin <= 600) ? margin : CHECK_DEFAULTS.passingMarginSec,
    off: Array.isArray(src.off) ? src.off.filter(k => KINDS.includes(k)) : [],
  };
}

/** A room's capacity, an integer 1 to 999, or null for "unknown". */
export function capacityOf(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return (Number.isInteger(n) && n >= 1 && n <= 999) ? n : null;
}

const COLLATOR = new Intl.Collator(undefined, { numeric: true });
const byName = (a, b) => COLLATOR.compare(String(a), String(b));

function hhmmSec(t) {
  if (typeof t !== 'string' || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 3600 + m * 60;
}

/** Seconds between mod `i`'s end and mod `i + 1`'s start (0-based i), or null.
    A zero gap is null too: back-to-back times are a bell typed without passing
    time, and reading it as "0 minutes" would flag every move in the building. */
export function passingSec(settings, day, i) {
  const arr = bellDay(settings, day);
  if (!arr) return null;
  const a = arr[i], b = arr[i + 1];
  const end = a && hhmmSec(a.end), start = b && hhmmSec(b.start);
  if (end === null || start === null || end === undefined || start === undefined) return null;
  return start > end ? start - end : null;
}

/** The days a schedule has: A and B when any group has a B day, else A. */
export function daysOf(groups) {
  return (groups || []).some(g => g && Array.isArray(g.modsB) && g.modsB.some(x => x)) ? ['A', 'B'] : ['A'];
}

/** The finding's fingerprint: kind, day, mod and the names involved, never an id. */
export function fingerprint(f) {
  const names = [];
  if (f.room) names.push('r:' + f.room);
  for (const r of (f.rooms || [])) names.push('r:' + r);
  if (f.teacher) names.push('t:' + f.teacher);
  for (const g of (f.groups || [])) names.push('g:' + g.name);
  const uniq = [...new Set(names)].sort();
  const mod = f.mods ? f.mods.join(',') : (f.mod != null ? String(f.mod) : '');
  return [f.kind, f.day || '', mod, uniq.join('+')].join('|');
}

/**
 * checkSchedule(groups, { registry, settings, days, travel, walk }) →
 * { findings, summary, teachers, rooms, dropped }.
 *
 * `registry` is roomRegistryOf()'s list (with `capacity`). `travel`, optional,
 * is `{ A: whatIfMetrics(…), B: … }`; with it `passing-too-short` is checked.
 * `walk(fromRoom, toRoom)`, optional, gives a teacher's walk in seconds or
 * null; with it `teacher-moves` is silent when the walk fits the passing time.
 * Mods in findings are 1-based (`mod`), as the banner has always shown them.
 */
export function checkSchedule(groups, opts = {}) {
  const settings = opts.settings || {};
  const modCount = settings.modCount || 8;
  const limits = normalizeChecks(settings.checks);
  const off = new Set(limits.off);
  const findings = [];
  const dropped = [];
  const ids = new Set();
  const add = (f) => {
    if (off.has(f.kind)) return;
    f.severity = SEVERITY[f.kind];
    f.where = f.where || [];
    f.ack = false;
    f.id = fingerprint(f);
    if (ids.has(f.id)) return;
    ids.add(f.id);
    findings.push(f);
  };

  // The registry: one record per room number; a second is dropped.
  const byRoom = new Map();
  for (const r of (opts.registry || [])) {
    if (!r || typeof r.roomNumber !== 'string') continue;
    if (byRoom.has(r.roomNumber)) {
      dropped.push({ path: 'registry.' + r.roomNumber, reason: 'room number on two rooms (floors ' + byRoom.get(r.roomNumber).floorId + ' and ' + r.floorId + '); the first is checked' });
      continue;
    }
    let cap = null;
    if (r.capacity !== undefined && r.capacity !== null && r.capacity !== '') {
      cap = capacityOf(r.capacity);
      if (cap === null) dropped.push({ path: 'registry.' + r.roomNumber + '.capacity', reason: 'capacity is not a whole number from 1 to 999; read as unknown' });
    }
    byRoom.set(r.roomNumber, { ...r, capacity: cap });
  }
  const teacherRooms = new Map();   // name (trimmed, case kept) → [room numbers]
  for (const r of byRoom.values()) {
    const t = typeof r.teacherName === 'string' ? r.teacherName.trim() : '';
    if (!t) continue;
    if (!teacherRooms.has(t)) teacherRooms.set(t, []);
    teacherRooms.get(t).push(r.roomNumber);
  }
  for (const list of teacherRooms.values()) list.sort(byName);

  // The groups, read once.
  const clean = [];
  (groups || []).forEach((g, gi) => {
    if (!g || typeof g.name !== 'string' || !g.name.trim()) {
      dropped.push({ path: 'groups[' + gi + ']', reason: 'group has no name; not checked' });
      return;
    }
    let size = g.size;
    if (size !== null && size !== undefined && size !== '' && !Number.isFinite(Number(size))) {
      dropped.push({ path: 'groups[' + gi + '].size', reason: 'size is not a number; read as blank' });
      size = null;
    }
    clean.push({ src: g, id: g.id, name: g.name.trim(), weight: groupWeight({ size }, settings), gi });
  });

  const days = Array.isArray(opts.days) && opts.days.length ? opts.days : daysOf(groups);
  const twoDays = days.length > 1;
  const labels = modLabels({ modCount, modLabel: settings.modLabel });
  const teachers = {};
  for (const [t, rooms] of teacherRooms) teachers[t] = { rooms: rooms.slice(), days: {} };
  const rooms = {};
  for (const rn of byRoom.keys()) rooms[rn] = { used: {} };

  for (const day of days) {
    // A group's day: its B list on B when it has one, else its A list (the
    // rule the paths, the what-if lab and the door signs use). occ: mod → room → [group].
    const occ = Array.from({ length: modCount }, () => new Map());
    for (const cg of clean) {
      const raw = day === 'B'
        ? ((cg.src.modsB && cg.src.modsB.length > 0) ? cg.src.modsB : (cg.src.modsA || cg.src.mods || []))
        : (cg.src.modsA || cg.src.mods || []);
      (raw || []).forEach((v, i) => {
        if (v === null || v === undefined || v === '') return;
        if (typeof v !== 'string') {
          dropped.push({ path: 'groups[' + cg.gi + '].mods' + day + '[' + i + ']', reason: 'slot is not text; read as blank' });
        } else if (i >= modCount && v.trim()) {
          dropped.push({ path: 'groups[' + cg.gi + '].mods' + day + '[' + i + ']', reason: 'slot past the last mod; not checked' });
        }
      });
      const mods = [];
      for (let i = 0; i < modCount; i++) mods.push(typeof raw[i] === 'string' ? raw[i].trim() : '');
      cg.mods = cg.mods || {};
      cg.mods[day] = mods;
      mods.forEach((rn, i) => {
        const cell = { groupId: cg.id, day, modIdx: i };
        if (!rn) {
          add({ kind: 'group-gap', day, mod: i + 1, groups: [{ id: cg.id, name: cg.name }], where: [cell] });
          return;
        }
        if (!byRoom.has(rn)) {
          add({ kind: 'room-unknown', day, mod: i + 1, room: rn, groups: [{ id: cg.id, name: cg.name }], where: [cell] });
        }
        if (!occ[i].has(rn)) occ[i].set(rn, []);
        occ[i].get(rn).push(cg);
      });
    }

    // Per room and mod.
    for (let i = 0; i < modCount; i++) {
      for (const [rn, list] of occ[i]) {
        const reg = byRoom.get(rn);
        const where = list.map(cg => ({ groupId: cg.id, day, modIdx: i }));
        const gs = list.map(cg => ({ id: cg.id, name: cg.name }));
        if (list.length >= 2 && !(reg && reg.excludeFromConflict)) {
          add({ kind: 'room-double', day, mod: i + 1, room: rn, groups: gs, n: list.length, where, first: list[0].gi });
        }
        if (reg && reg.capacity) {
          const heads = list.reduce((s, cg) => s + cg.weight, 0);
          if (heads > reg.capacity) {
            add({ kind: 'over-capacity', day, mod: i + 1, room: rn, groups: list.map(cg => ({ id: cg.id, name: cg.name, n: cg.weight })),
              n: heads, limit: reg.capacity, where });
          }
        }
      }
    }

    // Per teacher.
    for (const [t, trooms] of teacherRooms) {
      const slots = [];
      for (let i = 0; i < modCount; i++) {
        const here = [];
        for (const rn of trooms) {
          const list = occ[i].get(rn);
          if (list) here.push({ room: rn, groups: list.map(cg => ({ id: cg.id, name: cg.name })) });
        }
        slots.push(here);
      }
      teachers[t].days[day] = slots;
      const where = (i) => {
        const w = [];
        for (const s of slots[i]) for (const g of s.groups) w.push({ groupId: g.id, day, modIdx: i });
        return w;
      };
      slots.forEach((here, i) => {
        if (here.length >= 2) {
          const groupsByRoom = {};
          for (const s of here) groupsByRoom[s.room] = s.groups.map(g => g.name);
          add({ kind: 'teacher-double', day, mod: i + 1, teacher: t, rooms: here.map(s => s.room),
            groups: here.flatMap(s => s.groups), groupsByRoom, where: where(i) });
        }
      });
      const busy = slots.map(s => s.length > 0);
      if (!busy.some(Boolean)) {
        add({ kind: 'teacher-idle', day, teacher: t, rooms: trooms.slice() });
      } else if (busy.every(Boolean)) {
        add({ kind: 'teacher-no-planning', day, teacher: t });
      }
      // Runs longer than maxRun, one finding per run.
      let start = -1;
      for (let i = 0; i <= modCount; i++) {
        if (i < modCount && busy[i]) { if (start < 0) start = i; continue; }
        if (start >= 0) {
          const len = i - start;
          if (len > limits.maxRun) {
            const w = [];
            for (let k = start; k < i; k++) w.push(...where(k));
            add({ kind: 'teacher-run', day, teacher: t, mods: [start + 1, i], n: len, limit: limits.maxRun, where: w });
          }
          start = -1;
        }
      }
      // A change of single room between consecutive teaching mods.
      for (let i = 1; i < modCount; i++) {
        if (slots[i - 1].length !== 1 || slots[i].length !== 1) continue;
        const from = slots[i - 1][0].room, to = slots[i][0].room;
        if (from === to) continue;
        const window = passingSec(settings, day, i - 1);
        const f = { kind: 'teacher-moves', day, mods: [i, i + 1], teacher: t, rooms: [from, to], where: where(i) };
        if (window === null) { add(f); continue; }
        const sec = typeof opts.walk === 'function' ? opts.walk(from, to) : null;
        if (sec === null || sec === undefined || !Number.isFinite(sec)) continue;
        if (sec > window - limits.passingMarginSec) add({ ...f, sec: Math.round(sec), window, margin: limits.passingMarginSec });
      }
    }

    // Per room.
    for (const [rn, reg] of byRoom) {
      const used = [];
      for (let i = 0; i < modCount; i++) if (occ[i].has(rn)) used.push(i + 1);
      rooms[rn].used[day] = used;
      const t = typeof reg.teacherName === 'string' ? reg.teacherName.trim() : '';
      if (!used.length) {
        const tr = t ? teacherRooms.get(t) : null;
        const teacherIdle = tr && tr.every(r => !occ.some(m => m.has(r)));
        if (!teacherIdle) add({ kind: 'room-idle', day, room: rn });
      } else if (!t) {
        add({ kind: 'room-no-teacher', day, room: rn, mods: used });
      }
    }

    // Passing time a group walks, when the lab's numbers are handed in.
    const metrics = opts.travel && opts.travel[day];
    if (metrics && Array.isArray(metrics.perGroup)) {
      for (const pg of metrics.perGroup) {
        const cg = clean.find(c => c.id === pg.id);
        if (!cg) continue;
        for (const seg of (pg.segments || [])) {
          if (seg.error || seg.noTravel) continue;
          const window = passingSec(settings, day, seg.fromMod - 1);
          if (window === null) continue;
          const sec = (seg.travelSec || 0) + (seg.delaySec || 0);
          if (sec > window - limits.passingMarginSec) {
            add({ kind: 'passing-too-short', day, mods: [seg.fromMod, seg.toMod], rooms: [seg.fromRoom, seg.toRoom],
              groups: [{ id: cg.id, name: cg.name }], sec, window, margin: limits.passingMarginSec, crowd: (seg.delaySec || 0) > 0,
              where: [{ groupId: cg.id, day, modIdx: seg.toMod - 1 }] });
          }
        }
      }
    }
  }

  // Day-free facts.
  for (const [t, trooms] of teacherRooms) {
    if (trooms.length >= 2) add({ kind: 'teacher-rooms', teacher: t, rooms: trooms.slice() });
  }
  for (const [rn, reg] of byRoom) {
    const t = typeof reg.teacherName === 'string' ? reg.teacherName.trim() : '';
    if (t && !reg.teacherDept) add({ kind: 'room-no-dept', room: rn, teacher: t });
  }

  findings.sort(compareFindings);
  for (const f of findings) {
    if (!twoDays) f.oneDay = true;
  }
  return { findings, summary: summary(findings), teachers, rooms, dropped, days, labels };
}

/** Severity, then day, then mod, then room, then teacher, then id: total. */
export function compareFindings(a, b) {
  const s = SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
  if (s) return s;
  const d = (a.day || '') < (b.day || '') ? -1 : (a.day || '') > (b.day || '') ? 1 : 0;
  if (d) return d;
  const am = a.mod != null ? a.mod : (a.mods ? a.mods[0] : 0);
  const bm = b.mod != null ? b.mod : (b.mods ? b.mods[0] : 0);
  if (am !== bm) return am - bm;
  const ar = a.room || (a.rooms && a.rooms[0]) || '', br = b.room || (b.rooms && b.rooms[0]) || '';
  const r = byName(ar, br);
  if (r) return r;
  const t = byName(a.teacher || '', b.teacher || '');
  if (t) return t;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Counts of findings not accepted, by severity. */
export function summary(findings) {
  const out = { error: 0, warn: 0, note: 0 };
  for (const f of findings) if (!f.ack) out[f.severity]++;
  return out;
}

/** The room double-bookings of a day in the banner's old shape. */
export function conflictsOf(findings, day, labels) {
  return findings
    .filter(f => f.kind === 'room-double' && f.day === day)
    .sort((a, b) => (a.mod - b.mod) || (a.first - b.first))   // the old banner's order: by mod, then first group
    .map(f => ({ mod: f.mod, modLabel: (labels && labels[f.mod - 1]) || ('Mod ' + f.mod), room: f.room,
      groupNames: f.groups.map(g => g.name) }));
}

/** Mark `ack: true` on findings with an entry in `acks`; returns the same list. */
export function applyAcks(findings, acks) {
  const a = acks || {};
  for (const f of findings) f.ack = Object.prototype.hasOwnProperty.call(a, f.id);
  return findings;
}

/** Acks kept: every one that matches a finding, and the rest for 30 days from `on`. */
export function pruneAcks(acks, findings, today) {
  const live = new Set((findings || []).map(f => f.id));
  const now = Date.parse(today + 'T00:00:00Z');
  const out = {};
  for (const [id, a] of Object.entries(acks || {})) {
    if (!a || typeof a !== 'object') continue;
    const on = Date.parse(String(a.on) + 'T00:00:00Z');
    if (live.has(id)) { out[id] = a; continue; }
    if (Number.isFinite(on) && Number.isFinite(now) && (now - on) / 86400000 <= ACK_KEEP_DAYS) out[id] = a;
  }
  return out;
}

/** `{ v: 1, acks }` read from storage or a project file; anything else is empty. */
export function readChecksStore(raw) {
  const acks = {};
  if (raw && typeof raw === 'object' && raw.v === 1 && raw.acks && typeof raw.acks === 'object') {
    for (const [id, a] of Object.entries(raw.acks)) {
      if (!a || typeof a !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(String(a.on))) continue;
      acks[id] = { note: typeof a.note === 'string' ? a.note.slice(0, 200) : '', on: a.on };
    }
  }
  return { v: 1, acks };
}

/* ── Sentences ─────────────────────────────────────────────────────── */

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const word = (n) => WORDS[n] || String(n);

const list = (items) => globalThis.ListSentence.join(items);

/** "Room 204" for a number, the name as typed otherwise. */
function roomName(rn) {
  return /^\d/.test(rn) ? 'Room ' + rn : rn;
}

/** Split a label into its noun and its id: "Block B" → ['Block', 'B']; "2nd Hour" → hour. */
function labelParts(label) {
  let m = /^(Block|Period|Mod) (.+)$/.exec(label);
  if (m) return { noun: m[1], id: m[2], hour: false };
  m = /^(.+) Hour$/.exec(label);
  if (m) return { noun: 'Hour', id: m[1], hour: true };
  return null;
}

function modsPhrase(labels, mods, joiner) {
  const ls = mods.map(m => labels[m - 1] || ('Mod ' + m));
  if (ls.length === 1) return ls[0];
  const parts = ls.map(labelParts);
  if (parts.every(p => p && p.noun === parts[0].noun)) {
    const ids = parts.map(p => p.id);
    const joined = joiner === 'to' ? ids[0] + ' to ' + ids[ids.length - 1] : list(ids);
    return parts[0].hour ? joined + ' Hours' : parts[0].noun + 's ' + joined;
  }
  return joiner === 'to' ? ls[0] + ' to ' + ls[ls.length - 1] : list(ls);
}

function nounOf(labels) {
  const p = labels[0] && labelParts(labels[0]);
  return p ? p.noun.toLowerCase() : 'mod';
}

/** "3 minutes", "40 seconds", "5 minutes 10 seconds". */
export function duration(sec) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60), r = s % 60;
  const ms = m ? m + (m === 1 ? ' minute' : ' minutes') : '';
  const rs = r ? r + (r === 1 ? ' second' : ' seconds') : '';
  return (ms && rs) ? ms + ' ' + rs : (ms || rs || '0 seconds');
}
/** "a 3-minute walk" when whole minutes, else "a walk of 3 minutes 10 seconds". */
function aDuration(sec, what) {
  const s = Math.max(0, Math.round(sec));
  if (s && s % 60 === 0) return 'a ' + (s / 60) + '-minute ' + what;
  return 'a ' + what + ' of ' + duration(s);
}

/** ", less 1 minute 40 seconds of margin" when Settings keeps a margin. */
function less(f) { return f.margin ? ', less ' + duration(f.margin) + ' of margin' : ''; }

/**
 * The English line for a finding. `opts.labels` is modLabels(settings); the day
 * is named only when the schedule has two (`f.oneDay` is false).
 */
export function sentence(f, opts = {}) {
  const labels = opts.labels || [];
  const on = (f.day && !f.oneDay) ? ' on ' + f.day + ' days' : '';
  const mod = (m) => labels[m - 1] || ('Mod ' + m);
  const names = (f.groups || []).map(g => g.name);
  switch (f.kind) {
    case 'room-double':
      return roomName(f.room) + ' has ' + word(names.length) + ' groups in ' + mod(f.mod) + on + ': ' + list(names) +
        '. ' + (names.length > 2 ? 'All but one' : 'One') + ' of them needs another room or another ' + nounOf(labels) + '.';
    case 'teacher-double': {
      const at = f.rooms.map(rn => {
        const gn = (f.groupsByRoom && f.groupsByRoom[rn]) || [];
        return gn.length ? 'in ' + rn + ' with ' + list(gn) : 'in ' + rn;
      });
      return f.teacher + ' is ' + list(at) + ' in ' + mod(f.mod) + on + '. A teacher can only be in one room at a time.';
    }
    case 'over-capacity': {
      const gs = f.groups || [];
      if (gs.length === 1) {
        return gs[0].name + ' (' + gs[0].n + ') is in ' + f.room + ', which seats ' + f.limit + ', in ' + mod(f.mod) + on + '.';
      }
      return roomName(f.room) + ' holds ' + f.n + ' in ' + mod(f.mod) + on + ' (' +
        list(gs.map(g => g.name + ' with ' + g.n)) + ') and seats ' + f.limit + '.';
    }
    case 'teacher-no-planning':
      return f.teacher + ' has no planning ' + nounOf(labels) + on + '.';
    case 'teacher-run': {
      const noun = nounOf(labels);
      return f.teacher + ' teaches ' + word(f.n) + ' ' + noun + 's in a row' + on + ', ' +
        modsPhrase(labels, [f.mods[0], f.mods[1]], 'to') + '.';
    }
    case 'teacher-moves': {
      const head = f.teacher + ' moves from ' + f.rooms[0] + ' to ' + f.rooms[1] + ' between ' +
        modsPhrase(labels, f.mods, 'and') + on;
      if (f.window == null) return head + ', and no bell times are set.';
      return head + ': ' + aDuration(f.sec, 'walk') + ' in ' + aDuration(f.window, 'passing time') + less(f) + '.';
    }
    case 'passing-too-short':
      return names[0] + ' has ' + duration(f.sec) + ' of walking between ' + modsPhrase(labels, f.mods, 'and') + on +
        ' (' + f.rooms[0] + ' to ' + f.rooms[1] + (f.crowd ? ', with the crowd' : '') + ') in ' +
        aDuration(f.window, 'passing time') + less(f) + '.';
    case 'room-unknown':
      return names[0] + " is in '" + f.room + "' in " + mod(f.mod) + on + ", and the blueprint has no room '" + f.room + "'.";
    case 'group-gap':
      return names[0] + ' has nothing in ' + mod(f.mod) + on + '.';
    case 'teacher-rooms':
      return f.teacher + ' is written on ' + word(f.rooms.length) + ' rooms, ' + list(f.rooms) + '.';
    case 'teacher-idle':
      return f.rooms.length === 1
        ? f.teacher + "'s room " + f.rooms[0] + ' has no group' + on + '.'
        : f.teacher + "'s rooms " + list(f.rooms) + ' have no group' + on + '.';
    case 'room-idle':
      return roomName(f.room) + ' has no group' + on + '.';
    case 'room-no-dept':
      return roomName(f.room) + ' (' + f.teacher + ') has no department, so the published browser colours it as ELA.';
    case 'room-no-teacher':
      return roomName(f.room) + ' has groups in ' + modsPhrase(labels, f.mods, 'and') + on + ' and no teacher named.';
    default:
      return f.kind;
  }
}

/* ── The printed checks report (Path 11 P5 increment 4) ──────────────── */

const SECTIONS = [['error', 'Problems'], ['warn', 'Warnings'], ['note', 'Notes']];

/**
 * What the printed checks report shows, from one checkSchedule() result with
 * the acks applied: the counts, the findings by severity (accepted ones last,
 * with the note each was accepted with), and the teacher day grid, one per
 * day: teachers down, mods across, each cell the rooms and groups that teacher
 * has in that mod, or planning. A cell is marked with the worst un-accepted
 * problem or warning about it: one whose `where` holds a group in that cell, or
 * one about that teacher on that day with no cell of its own (no planning).
 * It formats every finding with sentence() and computes nothing else.
 * `acks` is the store's `{ [id]: { note, on } }`.
 */
export function checksReport(result, opts = {}) {
  const acks = opts.acks || {};
  const labels = result.labels || [];
  const findings = result.findings || [];
  const line = (f) => ({ id: f.id, kind: f.kind, severity: f.severity, day: f.day || null, text: sentence(f, { labels }) });
  const sections = SECTIONS.map(([severity, title]) => ({
    severity, title, items: findings.filter(f => !f.ack && f.severity === severity).map(line),
  }));
  sections.push({
    severity: 'ack', title: 'Accepted',
    items: findings.filter(f => f.ack).map(f => ({ ...line(f), note: (acks[f.id] && acks[f.id].note) || '' })),
  });
  const open = findings.filter(f => !f.ack && f.severity !== 'note');
  const worse = (a, b) => (!a ? b : (a === 'error' || b === 'error') ? 'error' : 'warn');
  const grids = (result.days || []).map(day => {
    const cellMark = new Map();   // groupId|modIdx → severity
    const rowMark = new Map();    // teacher → severity, for a finding with no cell
    for (const f of open) {
      if (f.day && f.day !== day) continue;
      if (f.where.length) {
        for (const w of f.where) {
          const k = w.groupId + '|' + w.modIdx;
          cellMark.set(k, worse(cellMark.get(k), f.severity));
        }
      } else if (f.teacher && f.day === day) {
        rowMark.set(f.teacher, worse(rowMark.get(f.teacher), f.severity));
      }
    }
    const rows = Object.keys(result.teachers || {}).sort(byName).map(teacher => {
      const t = result.teachers[teacher];
      const slots = (t.days && t.days[day]) || [];
      const cells = slots.map((here, i) => {
        if (!here.length) return { planning: true, text: '—', severity: rowMark.get(teacher) || null };
        let sev = rowMark.get(teacher) || null;
        for (const s of here) {
          for (const g of s.groups) {
            const m = cellMark.get(g.id + '|' + i);
            if (m) sev = worse(sev, m);
          }
        }
        return {
          planning: false, severity: sev,
          text: here.map(s => s.room + ' ' + s.groups.map(g => g.name).join(', ')).join(' / '),
        };
      });
      return { teacher, rooms: t.rooms.slice(), cells };
    });
    return { day, rows };
  });
  return { counts: summary(findings), sections, grids, days: (result.days || []).slice(), labels: labels.slice(),
    dropped: (result.dropped || []).length };
}
