// sv-model.js — the School Layout Visualizer's schedule and blueprint model:
// mod labels, settings normalisation, bell times, group weights, the room
// registry, blueprint serialise / migrate / validate, schedule conflicts and
// the project file's group record.
//
// Path 11 P2 increment 2 (BACKLOG.md, "Path 11", the P2 bullet). Every
// function here was a top-level function of 035's classic script and is moved
// with its rules unchanged; what it read from `AppState` is now an argument.
// Nothing here touches the DOM, `AppState` or storage. The page keeps one thin
// wrapper per old name in its `BRIDGE` section (so its call sites and the
// suites' globals are untouched) and puts this module on `window.SVModel`
// from its inline `type="module"` script, which runs after the classic script
// is parsed and before `init()` on DOMContentLoaded.
//
// Its suite is test/model.test.mjs (npm run test:schedule-visualizer-model).

/* ── Mod labels ─────────────────────────────────────────────────────── */

const BLOCK_LETTERS  = ['A','B','C','D','E','F','G','H','I','J','K','L'];
const ORDINAL_SUFFIX = ['st','nd','rd','th','th','th','th','th','th','th','th','th'];

export function modLabel(index, style) {
  switch (style) {
    case 'period': return `Period ${index}`;
    case 'block':  return `Block ${BLOCK_LETTERS[index - 1] || index}`;
    case 'hour':   return `${index}${ORDINAL_SUFFIX[index - 1] || 'th'} Hour`;
    default:       return `Mod ${index}`;
  }
}

/** Every mod's label for these settings, 1..modCount. */
export function modLabels(settings) {
  const { modCount, modLabel: style } = settings;
  return Array.from({ length: modCount }, (_, i) => modLabel(i + 1, style));
}

/* ── Settings ───────────────────────────────────────────────────────── */

/* Round 59: Subjects seed — carries the pre-R59 BR_DEPT colors so
   existing classroom data renders unchanged in the Schedule Browser. */
export const SUBJECT_SEED = [
  { code: 'ELA',    name: 'English / ELA',              color: '#2563eb' },
  { code: 'MATH',   name: 'Mathematics',                color: '#c2520f' },
  { code: 'SCI',    name: 'Science',                    color: '#0d7c69' },
  { code: 'SS',     name: 'Social Studies',             color: '#7c3aa8' },
  { code: 'SCI/SS', name: 'Science / Social Studies',   color: '#71641f' },
];

/* R59: coerce one bell-schedule day payload into [{start,end}|null,…] or null. */
export function normalizeBellDay(day) {
  if (!Array.isArray(day)) return null;
  const timeRe = /^([01]?\d|2[0-3]):[0-5]\d$/;
  return day.map(e => {
    if (!e || typeof e !== 'object') return null;
    const start = (typeof e.start === 'string' && timeRe.test(e.start)) ? e.start : null;
    const end   = (typeof e.end   === 'string' && timeRe.test(e.end))   ? e.end   : null;
    return (start || end) ? { start, end } : null;
  });
}

/* R59: normalize settings in place after any load / reset / import so old
   files (no defaultGroupSize / bellSchedule / subjects keys) get clean
   defaults with no migration errors. Deep-clones seeds so the page's
   DEFAULT_SETTINGS is never mutated by reference. */
export function normalizeSettings(s) {
  if (!s || typeof s !== 'object') return s;
  const dgs = parseInt(s.defaultGroupSize, 10);
  s.defaultGroupSize = (Number.isFinite(dgs) && dgs >= 1 && dgs <= 999) ? dgs : 25;

  const bs = (s.bellSchedule && typeof s.bellSchedule === 'object') ? s.bellSchedule : {};
  s.bellSchedule = { A: normalizeBellDay(bs.A), B: normalizeBellDay(bs.B) };

  const validSubjects = Array.isArray(s.subjects) && s.subjects.length > 0 &&
    s.subjects.every(sub => sub && typeof sub === 'object' && typeof sub.code === 'string' && sub.code.trim());
  s.subjects = validSubjects
    ? s.subjects.map(sub => ({
        code:  sub.code.trim(),
        name:  (typeof sub.name === 'string' && sub.name.trim()) ? sub.name.trim() : sub.code.trim(),
        color: (typeof sub.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(sub.color)) ? sub.color : '#64748b',
      }))
    : SUBJECT_SEED.map(sub => ({ ...sub }));
  return s;
}

/* ── R59 group-size helpers — all group-size consumers (weighted heat,
   travel delay, Stage-4 dot counts) route through these. ── */

/** Effective headcount of a group: explicit size, else the settings default, else 25. */
export function groupWeight(group, settings) {
  const sz = group ? Number(group.size) : NaN;
  if (Number.isFinite(sz) && sz > 0) return Math.round(sz);
  const d = settings && settings.defaultGroupSize;
  return (Number.isFinite(d) && d > 0) ? d : 25;
}

/** True when at least one group has an explicit size — controls whether
    congestion figures are displayed as "~N students" vs. raw group counts. */
export function anyGroupSized(groups) {
  return (groups || []).some(g => Number.isFinite(Number(g && g.size)) && Number(g.size) > 0);
}

/** Congestion-delay multiplier from "effective other groups" on a tile.
    Piecewise-linear through the R30 anchor points (0,0) (1,0.2) (2,0.5)
    (3,0.8), clamped at 0.8 — agrees exactly with the R58 discrete steps at
    every integer, so the all-sizes-null regression holds. */
export function congestionDelayMult(effOthers) {
  if (!(effOthers > 0)) return 0;
  if (effOthers >= 3) return 0.8;
  if (effOthers >= 2) return 0.5 + (effOthers - 2) * 0.3;
  if (effOthers >= 1) return 0.2 + (effOthers - 1) * 0.3;
  return effOthers * 0.2;
}

/* ── R59 bell-schedule helpers ── */

/** "HH:MM" 24h → compact display ("08:05" → "8:05", "13:40" → "1:40"). */
export function formatClockTime(hhmm) {
  if (typeof hhmm !== 'string' || !/^\d{1,2}:\d{2}$/.test(hhmm)) return '';
  let [h, m] = hhmm.split(':').map(Number);
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** The bell-schedule array for a day ('B' falls back to A when null). */
export function bellDay(settings, day) {
  const bs = (settings && settings.bellSchedule) || {};
  if (day === 'B' && Array.isArray(bs.B)) return bs.B;
  return Array.isArray(bs.A) ? bs.A : null;
}

/** formatModTime(settings, 'A', 0) → "8:00–8:42", or '' when no times exist. */
export function formatModTime(settings, day, modIdx) {
  const arr = bellDay(settings, day);
  const e = arr && arr[modIdx];
  if (!e || !e.start || !e.end) return '';
  return `${formatClockTime(e.start)}–${formatClockTime(e.end)}`;
}

/** Passing window for transition fromMod→fromMod+1 (1-based fromMod):
    prevMod.end → nextMod.start, e.g. "8:42–8:46". '' when unavailable. */
export function formatTransitionWindow(settings, day, fromMod) {
  const arr = bellDay(settings, day);
  if (!arr) return '';
  const prev = arr[fromMod - 1], next = arr[fromMod];
  if (!prev || !prev.end || !next || !next.start) return '';
  return `${formatClockTime(prev.end)}–${formatClockTime(next.start)}`;
}

/* ── Rooms ──────────────────────────────────────────────────────────── */

/** Round 31: floor-explicit anchor test — is (col,row) the top-left cell of its group? */
export function isGroupAnchorOn(gridData, gridCols, gridRows, col, row, groupId) {
  if (!groupId) return true;
  let minCol = col, minRow = row;
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const t = gridData[r] && gridData[r][c];
      if (t && t.type === 'classroom' && t.groupId === groupId) {
        if (c < minCol) minCol = c;
        if (r < minRow) minRow = r;
      }
    }
  }
  return col === minCol && row === minRow;
}

/**
 * Every assigned room on every floor, sorted by room number (numeric-aware).
 * Each entry: { roomNumber, teacherName, teacherDept, wing, excludeFromConflict,
 * floorId, cellCoordinates: {col, row} }. A multi-cell grouped classroom is
 * registered once, at its anchor cell; groupId uniqueness is global, so the
 * seen set spans floors.
 */
export function roomRegistryOf(blueprint) {
  const registry = [];
  const seenGroups = new Set();
  for (const floor of blueprint.floors) {
    const gridData = floor.gridData;
    const gridCols = floor.gridCols;
    const gridRows = floor.gridRows;
    if (!gridData) continue;
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const tile = gridData[r] && gridData[r][c];
        if (!tile || tile.type !== 'classroom') continue;
        if (tile.groupId) {
          if (seenGroups.has(tile.groupId)) continue;
          if (!isGroupAnchorOn(gridData, gridCols, gridRows, c, r, tile.groupId)) continue;
          seenGroups.add(tile.groupId);
        }
        if (!tile.roomNumber) continue;
        registry.push({
          roomNumber:           tile.roomNumber,
          teacherName:          tile.teacher || null,
          teacherDept:          tile.dept    || null,
          wing:                 tile.wing    || null,
          excludeFromConflict:  !!(tile.excludeFromConflict),
          floorId:         floor.id,
          cellCoordinates: { col: c, row: r },
        });
      }
    }
  }
  registry.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
  return registry;
}

/* ── Safety printing (Path 11 P4, increments 2 and 3) ───────────────── */

const byRoom = (a, b) => a.localeCompare(b, undefined, { numeric: true });

/** A room's lockdown note as the school typed it (`tile.lockdownNote`), or ''. */
export function lockdownNoteOf(tile) {
  return tile && typeof tile.lockdownNote === 'string' ? tile.lockdownNote.trim() : '';
}

/**
 * The lockdown maps' content: one page per floor that has a numbered room, in
 * floor order, each room with the cells it covers (so its number can be drawn
 * large over the whole room) and the school's own note for it. Nothing here is
 * advice: a room without a note has `note: ''`, and no shelter area, corner or
 * lock is worked out or marked.
 *   → { pages: [{ floorId, floorName, rooms: [{ room, minCol, minRow, maxCol, maxRow, note }] }], roomCount }
 */
export function lockdownPages(blueprint, opts = {}) {
  const floorLabel = opts.floorLabel || (id => id);
  const pages = [];
  let roomCount = 0;
  for (const floor of (blueprint && blueprint.floors) || []) {
    const grid = floor.gridData;
    if (!grid) continue;
    const cellsOf = new Map();                         // groupId → bounds
    for (let r = 0; r < floor.gridRows; r++) {
      for (let c = 0; c < floor.gridCols; c++) {
        const t = grid[r] && grid[r][c];
        if (!t || t.type !== 'classroom' || !t.groupId) continue;
        const b = cellsOf.get(t.groupId);
        if (!b) cellsOf.set(t.groupId, { minCol: c, minRow: r, maxCol: c, maxRow: r });
        else {
          b.minCol = Math.min(b.minCol, c); b.minRow = Math.min(b.minRow, r);
          b.maxCol = Math.max(b.maxCol, c); b.maxRow = Math.max(b.maxRow, r);
        }
      }
    }
    const rooms = [];
    for (let r = 0; r < floor.gridRows; r++) {
      for (let c = 0; c < floor.gridCols; c++) {
        const t = grid[r] && grid[r][c];
        if (!t || t.type !== 'classroom' || !t.roomNumber || !String(t.roomNumber).trim()) continue;
        const b = (t.groupId && cellsOf.get(t.groupId)) || { minCol: c, minRow: r, maxCol: c, maxRow: r };
        rooms.push({ room: String(t.roomNumber).trim(), ...b, note: lockdownNoteOf(t) });
      }
    }
    if (!rooms.length) continue;
    rooms.sort((a, b) => byRoom(a.room, b.room));
    roomCount += rooms.length;
    pages.push({ floorId: floor.id, floorName: floorLabel(floor.id), rooms });
  }
  return { pages, roomCount };
}

/**
 * The door-sign sets: per teacher (the name typed on a classroom, matched
 * exactly), one sign for each room with that name on it, holding the room's
 * subject and, for every mod, the groups the schedule puts in that room. A B
 * day is shown only when some group has a B day of its own (modsB empty means
 * "as A"). A room with no teacher typed gets no sign; `untaught` counts them.
 * No safety wording: a door sign is a timetable.
 *   → { teachers: [{ teacher, signs: [{ teacher, room, floorId, subject,
 *        days: [{ day, label, mods: [{ mod, label, time, groups: [name] }] }] }] }],
 *       signCount, untaught }
 */
export function doorSigns({ blueprint, groups, settings }) {
  const registry = roomRegistryOf(blueprint || { floors: [] });
  const subjects = new Map(((settings && settings.subjects) || []).map(s => [s.code, s.name || s.code]));
  const labels = modLabels(settings);
  const list = (groups || []).filter(g => g && typeof g.name === 'string');
  const hasB = list.some(g => (g.modsB || []).some(Boolean));
  const dayList = hasB ? [['A', 'A day'], ['B', 'B day']] : [['A', '']];
  const byTeacher = new Map();
  let untaught = 0;
  for (const entry of registry) {
    const teacher = entry.teacherName ? String(entry.teacherName).trim() : '';
    if (!teacher) { untaught++; continue; }
    const room = entry.roomNumber;
    const days = dayList.map(([day, label]) => ({
      day, label,
      mods: labels.map((modName, i) => ({
        mod: i + 1, label: modName,
        time: formatModTime(settings, day, i),
        groups: list.filter(g => {
          const mods = day === 'B' && (g.modsB || []).some(Boolean) ? g.modsB : (g.modsA || g.mods || []);
          return mods[i] === room;
        }).map(g => g.name),
      })),
    }));
    const sign = {
      teacher, room, floorId: entry.floorId,
      subject: entry.teacherDept ? (subjects.get(entry.teacherDept) || entry.teacherDept) : '',
      days,
    };
    if (!byTeacher.has(teacher)) byTeacher.set(teacher, []);
    byTeacher.get(teacher).push(sign);
  }
  const teachers = [...byTeacher.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([teacher, signs]) => ({ teacher, signs: signs.sort((a, b) => byRoom(a.room, b.room)) }));
  return { teachers, signCount: teachers.reduce((n, t) => n + t.signs.length, 0), untaught };
}

/* ── Blueprint ──────────────────────────────────────────────────────── */

/** Legacy staircasePairs format (['col,row','col,row']) for same-floor pairs on one floor. */
export function deriveSameFloorPairs(crossFloorPairs, floorId) {
  return (crossFloorPairs || [])
    .filter(p => p.a.floorId === floorId && p.b.floorId === floorId)
    .map(p => [`${p.a.col},${p.a.row}`, `${p.b.col},${p.b.row}`]);
}

/** The pair letter label ('A', 'B', …, wrapping after 'Z'). */
export function pairLabel(pairIndex) {
  return String.fromCharCode(65 + (pairIndex % 26));
}

/**
 * The full blueprint as the version-5 object the page saves, each floor a
 * sparse cells array, with top-level fields mirroring floors[0] so legacy
 * and external readers (and validateBlueprint) still see a single-floor
 * payload. `opts.portable` asks for each trace image through
 * `opts.traceImage(t)` (the page's, which puts the bytes back); `opts.savedAt`
 * is the caller's timestamp.
 */
export function serializeBlueprint(blueprint, settings, opts) {
  const portable = !!(opts && opts.portable);
  const bp = blueprint;
  const s  = settings;

  const floors = bp.floors.map(f => {
    const cells = [];
    if (f.gridData) {
      for (let r = 0; r < f.gridRows; r++) {
        for (let c = 0; c < f.gridCols; c++) {
          const tile = f.gridData[r] && f.gridData[r][c];
          if (tile) cells.push({ col: c, row: r, tile: { ...tile } });
        }
      }
    }
    return {
      id:               f.id,
      label:            f.label,
      gridCols:         f.gridCols,
      gridRows:         f.gridRows,
      cells,
      heatExcludeZones: JSON.parse(JSON.stringify(f.heatExcludeZones || [])),
      traceImage:       portable ? opts.traceImage(f.traceImage) : (f.traceImage ? { ...f.traceImage } : null),
    };
  });

  const f0 = floors[0] || { gridCols: bp.gridCols, gridRows: bp.gridRows, cells: [], heatExcludeZones: [] };

  return {
    version:          5,
    savedAt:          opts && opts.savedAt,
    gridCols:         f0.gridCols,
    gridRows:         f0.gridRows,
    cells:            f0.cells,
    staircasePairs:   deriveSameFloorPairs(bp.crossFloorPairs, bp.floors[0] ? bp.floors[0].id : 'floor_0'),
    heatExcludeZones: f0.heatExcludeZones,
    // Round 31 multi-floor payload:
    floors,
    activeFloorIdx:   bp.activeFloorIdx || 0,
    crossFloorPairs:  JSON.parse(JSON.stringify(bp.crossFloorPairs || [])),
    settings: {
      schoolName: s.schoolName,
      gridSize:   s.gridSize,
      gridCols:   s.gridCols,
      gridRows:   s.gridRows,
      // R59: carried in the blueprint file so a blueprint-only import keeps
      // bell times + subject palette in sync with the building it describes.
      bellSchedule: JSON.parse(JSON.stringify(s.bellSchedule || { A: null, B: null })),
      subjects:     JSON.parse(JSON.stringify(s.subjects || null)),
    },
  };
}

/**
 * Round 31: normalize any blueprint payload (old or new) into a floors[] +
 * crossFloorPairs shape. Mutates `data` in place and returns it.
 */
export function migrateBlueprint(data) {
  if (data && Array.isArray(data.floors) && data.floors.length) {
    if (!Array.isArray(data.crossFloorPairs)) data.crossFloorPairs = [];
    if (typeof data.activeFloorIdx !== 'number') data.activeFloorIdx = 0;
    return data;
  }
  // Pre-Round-31 single-floor payload (top-level cells array).
  data.floors = [{
    id:               'floor_0',
    label:            'Floor 1',
    gridCols:         data.gridCols || 30,
    gridRows:         data.gridRows || 20,
    cells:            Array.isArray(data.cells) ? data.cells : [],
    heatExcludeZones: data.heatExcludeZones || [],
  }];
  data.crossFloorPairs = (data.staircasePairs || []).map(([ka, kb]) => {
    const [ac, ar] = String(ka).split(',').map(Number);
    const [bc, br] = String(kb).split(',').map(Number);
    return { a: { floorId: 'floor_0', col: ac, row: ar },
             b: { floorId: 'floor_0', col: bc, row: br } };
  });
  data.activeFloorIdx = 0;
  return data;
}

/**
 * Validate that a parsed JSON object is a blueprint payload. Throws an Error
 * with a user-friendly message if it is not; returns nothing if it is.
 */
export function validateBlueprint(data) {
  if (!data || typeof data !== 'object')
    throw new Error('Invalid file: not a JSON object.');
  // Round 31: a floors-based payload is valid on its own.
  const hasFloors = Array.isArray(data.floors) && data.floors.length > 0;
  if (!hasFloors) {
    if (typeof data.gridCols !== 'number' || typeof data.gridRows !== 'number')
      throw new Error('Invalid file: missing grid dimensions.');
    if (data.gridCols < 5 || data.gridRows < 5 || data.gridCols > 200 || data.gridRows > 200)
      throw new Error('Invalid file: grid dimensions out of range (5–200).');
    if (!Array.isArray(data.cells))
      throw new Error('Invalid file: missing cells array.');
    if (!Array.isArray(data.staircasePairs))
      throw new Error('Invalid file: missing staircasePairs array.');
    if (data.cells.length > 0) {
      const first = data.cells[0];
      if (typeof first.col !== 'number' || typeof first.row !== 'number' || !first.tile)
        throw new Error('Invalid file: malformed cell entry.');
    }
  } else {
    const f0 = data.floors[0];
    if (!f0 || typeof f0.gridCols !== 'number' || typeof f0.gridRows !== 'number')
      throw new Error('Invalid file: malformed floor entry.');
    if (!Array.isArray(f0.cells))
      throw new Error('Invalid file: floor missing cells array.');
  }
}

/** A floor object's gridData 2D array (rows × cols of nulls), set in place. */
export function initFloorGridData(floor) {
  floor.gridData = Array.from({ length: floor.gridRows }, () =>
    Array.from({ length: floor.gridCols }, () => null)
  );
}

/** The pure half of applying a payload that has been through migrateBlueprint:
 *  each serialized floor rebuilt as a live floor object (cells → gridData,
 *  out-of-grid cells dropped). */
export function floorsFromData(data) {
  return data.floors.map((sf, i) => {
    const floor = {
      id:               sf.id || ('floor_' + i),
      label:            sf.label || ('Floor ' + (i + 1)),
      gridCols:         sf.gridCols || 30,
      gridRows:         sf.gridRows || 20,
      gridData:         null,
      heatExcludeZones: JSON.parse(JSON.stringify(sf.heatExcludeZones || [])),
      traceImage:       sf.traceImage ? { ...sf.traceImage } : null,
    };
    initFloorGridData(floor);
    for (const entry of (sf.cells || [])) {
      if (entry.col >= 0 && entry.col < floor.gridCols &&
          entry.row >= 0 && entry.row < floor.gridRows) {
        floor.gridData[entry.row][entry.col] = { ...entry.tile };
      }
    }
    return floor;
  });
}

/* ── Groups ─────────────────────────────────────────────────────────── */

/**
 * R39: room double-bookings on a day ('A' or 'B'), sorted by mod:
 * [{ mod (1-based), modLabel, room, groupNames[] }]. A day's rooms are
 * `modsB || []` on B and `modsA || mods || []` on A; blank rooms and rooms
 * the registry flags `excludeFromConflict` are skipped. The key is
 * `${modIndex}-${room}`, re-joined on '-' since a room number may hold one.
 */
export function scheduleConflicts(groups, day, { registry, labels }) {
  const excludedRooms = new Set(
    registry.filter(r => r.excludeFromConflict).map(r => r.roomNumber)
  );
  const map = new Map(); // key `${modIndex}-${room}` → [groupName, ...]
  for (const group of groups) {
    const mods = day === 'B'
      ? (group.modsB || [])
      : (group.modsA || group.mods || []);
    mods.forEach((room, idx) => {
      if (!room || room === '') return;
      if (excludedRooms.has(room)) return;
      const key = `${idx}-${room}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(group.name);
    });
  }
  const conflicts = [];
  for (const [key, names] of map) {
    if (names.length < 2) continue;
    const [idxStr, ...roomParts] = key.split('-');
    const idx  = parseInt(idxStr, 10);
    const room = roomParts.join('-');
    conflicts.push({
      mod:      idx + 1,
      modLabel: labels[idx] || `Mod ${idx + 1}`,
      room,
      groupNames: names,
    });
  }
  conflicts.sort((a, b) => a.mod - b.mod);
  return conflicts;
}

/** The first preset no group uses, else a hue spaced by the group count. */
export function nextGroupColor(groups, presets) {
  const used = new Set(groups.map(g => g.color));
  for (const c of presets) {
    if (!used.has(c)) return c;
  }
  const hue = (groups.length * 47) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

/*
 * A new id: prefix, the clock in base 36, four random base-36 characters and a
 * four-character count of the ids this page has made. Before 2026-10-25 a group
 * id was the clock and `Math.random().toString(36).slice(2, 6)` only, so ids
 * made in the same millisecond (a CSV import, a project load, the bulk editor)
 * shared their clock part and collided about one run in fifteen across 200 of
 * them; the slice could also be shorter than four characters. The count makes
 * two ids from one page differ whatever the clock and the random source do, and
 * `taken` (ids, records with an `id`, or anything with `has()`) is checked so an
 * id saved by an earlier visit is never handed out again. Ids already saved are
 * read as they are: nothing parses one, and only uniqueness is promised.
 */
let idCount = 0;
function takenIds(taken) {
  if (!taken) return new Set();
  if (typeof taken.has === 'function') return taken;
  const ids = new Set();
  for (const t of taken) {
    if (typeof t === 'string') ids.add(t);
    else if (t && t.id != null) ids.add(String(t.id));
  }
  return ids;
}
export function freshId(prefix, taken) {
  const used = takenIds(taken);
  for (;;) {
    idCount = (idCount + 1) % 1679616;           // 36^4: always four characters
    let rand = '';
    for (let i = 0; i < 4; i++) rand += Math.floor(Math.random() * 36).toString(36);
    const id = prefix + Date.now().toString(36) + rand + idCount.toString(36).padStart(4, '0');
    if (!used.has(id)) return id;
  }
}

/** A new group id no group in `taken` has (see freshId). */
export function groupId(taken) {
  return freshId('grp_', taken);
}

/** One group as the project file writes it (R59: size a positive integer or null). */
export function groupRecord(g) {
  return {
    name: g.name, grade: g.grade, color: g.color,
    size: (Number.isFinite(Number(g.size)) && Number(g.size) > 0) ? Math.round(Number(g.size)) : null,
    modsA: g.modsA || g.mods || [],
    modsB: g.modsB || [],
    mods: g.modsA || g.mods || [],
  };
}
