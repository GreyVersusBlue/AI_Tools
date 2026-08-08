// seating.mjs — the Seating Chart Generator's pure logic and its save slot.
//
// Everything in here runs under plain Node with no DOM, which is the point: the
// seat solver, the constraint checker, the roster parser and the repair pass are
// arithmetic and string work, and `test/smoke-seating.mjs` drives them directly.
// The page keeps the DOM and nothing else that can be tested without a browser.
//
// The import of gvb-save is RELATIVE so Node can resolve it. A leading slash
// works only in the browser.

import { createSaveSlot } from '../../assets/js/gvb-save.js';

/* ---------------------------------------------------------------------------
   Storage identity. Both of these are permanent.

   `STORAGE_KEY` is the localStorage key. The trailing `-v1` is part of the name,
   not a version counter — locked decision #36 says an adopting project keeps its
   key forever, so bumping SCHEMA_VERSION below must NOT change this string.
   Changing it abandons every chart already saved on a classroom machine, and a
   chart is the most expensive thing in this tool to rebuild.
--------------------------------------------------------------------------- */
export const STORAGE_KEY = 'seating-chart-v1';
export const SCHEMA_VERSION = 1;

/** Room geometry. Desk coordinates are stored in this space, not screen pixels. */
export const ROOM = {
  width: 1280,      // floor width in layout px
  height: 900,      // maximum desk y + height
  deskW: 106,
  deskH: 70,
  grid: 22,         // snap step
  neighbor: 142,    // centre-to-centre distance that counts as "next to"
};

export const uid = (rng = Math.random) => rng().toString(36).slice(2, 9);

/* ---------------------------------------------------------------------------
   Shape
--------------------------------------------------------------------------- */

export function newSection(name, rng = Math.random) {
  return {
    id: uid(rng),
    name,
    students: [],   // { id, name, note, flag }
    apart: [],      // [ [studentId, studentId] ]
    together: [],
    desks: [],      // { id, x, y, rot, locked }
    assign: {},     // { deskId: studentId }
  };
}

/**
 * A brand-new set of charts. Passed to createSaveSlot as `defaults`, and it has
 * to be a factory rather than a literal: every section and desk carries a
 * generated id, so a shared literal would hand two resets the same ids.
 *
 * Three sections because that is the actual job — Honors GT, Honors and Academic
 * are three different rooms of students, and a tool that models one chart gets
 * used for one class and then abandoned.
 */
export function freshState(rng = Math.random) {
  const sections = ['Honors GT', 'Honors', 'Academic'].map(n => newSection(n, rng));
  return { sections, active: sections[0].id, theme: 'light', zoom: 'fit', lastFirst: false };
}

/* ---------------------------------------------------------------------------
   validate / repair

   validate() runs BEFORE repair() inside gvb-save, so it only asks the questions
   that separate "a saved chart" from "somebody else's JSON": is there a sections
   array with something in it. Everything finer is repair's job.
--------------------------------------------------------------------------- */

export function validateState(s) {
  return !!s && typeof s === 'object'
    && Array.isArray(s.sections) && s.sections.length > 0
    && s.sections.every(x => x && typeof x === 'object');
}

const str = (v, fallback = '') => (typeof v === 'string' ? v : fallback);
const bool = v => v === true;

/** Finite number or the fallback. Guards the NaN class described below. */
const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Runs on EVERY accepted load — localStorage, an imported file, a pasted blob,
 * including a chart this build just wrote (locked decision #37). Fill-ins go
 * here, never in migrate.
 *
 * The bug class this is written against, in this tool's terms: a desk saved
 * before some numeric field existed comes back with `undefined` in it. Feed that
 * to `Math.hypot` and the distance is NaN, `NaN <= 142` is false, so every desk
 * reads as having no neighbours — at which point auto-assign reports "All
 * seating rules met" while sitting a keep-apart pair elbow to elbow. No error,
 * no crash, just a constraint engine that silently stops constraining. That is
 * The Fourth Quarter's missing `speed` wearing different clothes.
 */
export function repairState(state, rng = Math.random) {
  if (!state || typeof state !== 'object') return freshState(rng);

  const sections = (Array.isArray(state.sections) ? state.sections : [])
    .filter(s => s && typeof s === 'object')
    .map((s, i) => repairSection(s, i, rng));

  if (!sections.length) sections.push(newSection('Period 1', rng));

  const ids = new Set(sections.map(s => s.id));
  const active = ids.has(state.active) ? state.active : sections[0].id;

  return {
    sections,
    active,
    theme: state.theme === 'dark' ? 'dark' : 'light',
    zoom: state.zoom === 'full' ? 'full' : 'fit',
    lastFirst: bool(state.lastFirst),
  };
}

function repairSection(s, index, rng) {
  const id = str(s.id) || uid(rng);
  const name = str(s.name).trim() || `Section ${index + 1}`;

  const students = (Array.isArray(s.students) ? s.students : [])
    .filter(st => st && typeof st === 'object' && str(st.name).trim())
    .map(st => ({
      id: str(st.id) || uid(rng),
      name: str(st.name).trim(),
      note: str(st.note),
      flag: bool(st.flag),
    }));
  const studentIds = new Set(students.map(st => st.id));

  const desks = (Array.isArray(s.desks) ? s.desks : [])
    .filter(d => d && typeof d === 'object')
    .map(d => ({
      id: str(d.id) || uid(rng),
      x: clamp(num(d.x, 40), 0, ROOM.width - ROOM.deskW),
      y: clamp(num(d.y, 110), 0, ROOM.height - ROOM.deskH),
      rot: [0, 90, 180, 270].includes(num(d.rot, 0)) ? num(d.rot, 0) : 0,
      locked: bool(d.locked),
    }));
  const deskIds = new Set(desks.map(d => d.id));

  const pairs = list => {
    const out = [], seen = new Set();
    for (const p of Array.isArray(list) ? list : []) {
      if (!Array.isArray(p) || p.length < 2) continue;
      const [a, b] = [str(p[0]), str(p[1])];
      if (!a || !b || a === b) continue;
      if (!studentIds.has(a) || !studentIds.has(b)) continue;   // student was removed
      const k = [a, b].sort().join('|');
      if (seen.has(k)) continue;
      seen.add(k);
      out.push([a, b]);
    }
    return out;
  };
  const apart = pairs(s.apart);
  const apartKeys = new Set(apart.map(([a, b]) => [a, b].sort().join('|')));
  // A pair cannot be both. The page enforces it on entry; a hand-edited save can
  // still carry both, and then the solver chases a contradiction for 800 rounds.
  const together = pairs(s.together).filter(([a, b]) => !apartKeys.has([a, b].sort().join('|')));

  const assign = {};
  const seated = new Set();
  for (const [deskId, sid] of Object.entries(s.assign && typeof s.assign === 'object' ? s.assign : {})) {
    if (!deskIds.has(deskId) || !studentIds.has(sid)) continue;  // desk or student gone
    if (seated.has(sid)) continue;                               // same student twice
    assign[deskId] = sid;
    seated.add(sid);
  }

  return { id, name, students, apart, together, desks, assign };
}

/* ---------------------------------------------------------------------------
   The save slot
--------------------------------------------------------------------------- */

export function createSeatingSlot({ storage = null } = {}) {
  return createSaveSlot({
    game: 'seating-chart',
    key: STORAGE_KEY,
    version: SCHEMA_VERSION,
    defaults: freshState,        // factory: every section and desk needs a fresh id
    validate: validateState,
    migrate: (s, from) => s,     // nothing to migrate yet; version 1 is the first shape
    repair: repairState,
    storage,
  });
}

/* ---------------------------------------------------------------------------
   Geometry and neighbours
--------------------------------------------------------------------------- */

export function snap(v) { return Math.round(v / ROOM.grid) * ROOM.grid; }

export function centreOf(desk) {
  return { x: num(desk.x, 0) + ROOM.deskW / 2, y: num(desk.y, 0) + ROOM.deskH / 2 };
}

/** deskId -> [deskId] for every desk within `neighbor` px, centre to centre. */
export function neighborMap(desks, dist = ROOM.neighbor) {
  const m = {};
  const c = {};
  for (const d of desks) { m[d.id] = []; c[d.id] = centreOf(d); }
  for (let i = 0; i < desks.length; i++) {
    for (let j = i + 1; j < desks.length; j++) {
      const a = desks[i].id, b = desks[j].id;
      if (Math.hypot(c[a].x - c[b].x, c[a].y - c[b].y) <= dist) { m[a].push(b); m[b].push(a); }
    }
  }
  return m;
}

/** Union-find over the put-together pairs: every student in one group sits adjacent. */
export function togetherGroups(students, together) {
  const parent = {};
  for (const s of students) parent[s.id] = s.id;
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (const [a, b] of together) if (parent[a] && parent[b]) parent[find(a)] = find(b);
  const g = {};
  for (const s of students) { const r = find(s.id); (g[r] = g[r] || []).push(s.id); }
  return Object.values(g);
}

export function apartMap(students, apart) {
  const m = {};
  for (const s of students) m[s.id] = new Set();
  for (const [a, b] of apart) { if (m[a]) m[a].add(b); if (m[b]) m[b].add(a); }
  return m;
}

function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------------------------------------------------------------------------
   The solver
--------------------------------------------------------------------------- */

function onePass(section, nbrs, apart, freeDesks, toPlace, seedDesk, seedStudent, rng) {
  const wanted = new Set(toPlace);
  const blocks = shuffled(togetherGroups(section.students, section.together).map(g => shuffled(g, rng)), rng);
  const order = [];
  for (const b of blocks) for (const id of b) if (wanted.has(id)) order.push({ id, group: b });

  const free = new Set(freeDesks);
  const studentDesk = { ...seedStudent };
  const deskStudent = { ...seedDesk };
  const unseated = [];

  const ok = (sid, did) => {
    for (const m of apart[sid] || []) {
      const md = studentDesk[m];
      if (md && nbrs[did].includes(md)) return false;
    }
    return true;
  };

  for (const item of order) {
    const sid = item.id;
    if (!free.size) { unseated.push(sid); continue; }   // more students than desks: leave in the pool
    const mates = item.group.filter(g => g !== sid && studentDesk[g]);
    let cands = [...free].filter(did => ok(sid, did));
    if (mates.length) {
      const beside = cands.filter(did => mates.some(m => nbrs[did].includes(studentDesk[m])));
      if (beside.length) cands = beside;
      else return null;                                  // this pass cannot honour a put-together
    }
    if (!cands.length) return null;
    const pick = cands[Math.floor(rng() * cands.length)];
    studentDesk[sid] = pick;
    deskStudent[pick] = sid;
    free.delete(pick);
  }
  return { assign: deskStudent, unseated };
}

/**
 * Seat everyone the room has space for. Returns a new assignment plus what it
 * managed to honour; never throws and never returns an empty chart when desks
 * exist, because a teacher standing at the board would rather have a chart with
 * one broken rule than no chart.
 *
 * Locked desks keep their occupant exactly where they are.
 */
export function assignSeats(section, { attempts = 800, rng = Math.random } = {}) {
  const nbrs = neighborMap(section.desks);
  const apart = apartMap(section.students, section.apart);

  const seedDesk = {}, seedStudent = {}, lockedSids = new Set(), lockedDesks = new Set();
  for (const d of section.desks) {
    if (!d.locked) continue;
    const sid = section.assign[d.id];
    // A locked desk only "keeps its occupant in place" if it has one — a locked
    // but empty desk (occupant removed, or locked before ever being filled) has
    // nothing to pin, so treat it as free rather than losing it from the chart.
    if (!sid) continue;
    lockedDesks.add(d.id);
    seedDesk[d.id] = sid; seedStudent[sid] = d.id; lockedSids.add(sid);
  }
  const freeDesks = section.desks.filter(d => !lockedDesks.has(d.id)).map(d => d.id);
  const toPlace = section.students.filter(st => !lockedSids.has(st.id)).map(st => st.id);

  let best = null, bestScore = -Infinity;
  for (let i = 0; i < attempts; i++) {
    const pass = onePass(section, nbrs, apart, freeDesks, toPlace, seedDesk, seedStudent, rng);
    if (!pass) continue;
    const report = checkConstraints({ ...section, assign: pass.assign }, nbrs);
    // Seated students first, then rules met. A chart that seats 28 with one broken
    // keep-apart beats a spotless chart that seats 24.
    const score = Object.keys(pass.assign).length * 10
      + (report.apartOK ? 3 : 0) + (report.togetherOK ? 3 : 0);
    if (score > bestScore) { best = pass; bestScore = score; }
    if (report.apartOK && report.togetherOK && !pass.unseated.length) break;
  }

  if (!best) {
    // Nothing satisfied a put-together in `attempts` tries. Fill anyway, ignoring
    // rules, and let reportConstraints say so out loud.
    const assign = { ...seedDesk };
    const ds = shuffled(freeDesks, rng), st = shuffled(toPlace, rng);
    for (let i = 0; i < Math.min(ds.length, st.length); i++) assign[ds[i]] = st[i];
    best = { assign, unseated: st.slice(ds.length), forced: true };
  }

  const report = checkConstraints({ ...section, assign: best.assign }, nbrs);
  return {
    assign: best.assign,
    unseated: best.unseated,
    forced: !!best.forced,
    ...report,
  };
}

/** Which rules the current assignment actually honours. */
export function checkConstraints(section, nbrs = neighborMap(section.desks)) {
  const deskOf = {};
  for (const [d, sid] of Object.entries(section.assign)) deskOf[sid] = d;

  const apartBroken = section.apart.filter(([a, b]) => {
    const da = deskOf[a], db = deskOf[b];
    return da && db && nbrs[da].includes(db);
  });
  const togetherBroken = section.together.filter(([a, b]) => {
    const da = deskOf[a], db = deskOf[b];
    return !(da && db && nbrs[da].includes(db));
  });
  return {
    apartOK: apartBroken.length === 0,
    togetherOK: togetherBroken.length === 0,
    apartBroken,
    togetherBroken,
  };
}

/* ---------------------------------------------------------------------------
   Cold-call picker: every seated student once before anyone repeats.
--------------------------------------------------------------------------- */

export function pickNext(seatedPairs, alreadyPicked = new Set(), rng = Math.random) {
  if (!seatedPairs.length) return null;
  let pool = seatedPairs.filter(([, sid]) => !alreadyPicked.has(sid));
  const wrapped = pool.length === 0;
  if (wrapped) pool = seatedPairs;
  const [deskId, studentId] = pool[Math.floor(rng() * pool.length)];
  return { deskId, studentId, wrapped };
}

/* ---------------------------------------------------------------------------
   Roster paste

   Every roster starts life in a spreadsheet or a student-information-system
   export, so the paste path is the one that has to work. Handles a plain column,
   a two-column paste with a leading number, "Last, First", and the numbered
   list somebody typed by hand.
--------------------------------------------------------------------------- */

const NUMBERING = /^\s*\d+\s*[.)\]-]?\s+/;

export function parseRoster(text, { lastFirst = false, existing = [] } = {}) {
  const have = new Set(existing.map(n => String(n).trim().toLowerCase()));
  const names = [];
  const duplicates = [];

  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    let line = rawLine.replace(/\s+/g, ' ').trim();
    if (!line) continue;

    if (line.includes('\t') || rawLine.includes('\t')) {
      // Spreadsheet paste: take the first cell that isn't a bare number or blank.
      const cell = rawLine.split('\t').map(c => c.replace(/\s+/g, ' ').trim())
        .find(c => c && !/^\d+$/.test(c));
      line = cell || '';
    }
    line = line.replace(NUMBERING, '').replace(/^["']|["']$/g, '').trim();
    if (!line || /^\d+$/.test(line)) continue;

    if (lastFirst) {
      const m = line.match(/^([^,]+),\s*(.+)$/);
      if (m) line = `${m[2].trim()} ${m[1].trim()}`.replace(/\s+/g, ' ');
    }
    if (!line) continue;

    const k = line.toLowerCase();
    if (have.has(k)) { duplicates.push(line); continue; }
    have.add(k);
    names.push(line);
  }
  return { names, duplicates };
}

/* ---------------------------------------------------------------------------
   Layout helpers used by the toolbar buttons. Pure so the test can check that a
   grid of 6x5 really is 30 desks inside the room and that a row lands under the
   deepest desk rather than on top of it.
--------------------------------------------------------------------------- */

export function gridDesks(cols, rows, rng = Math.random) {
  cols = clamp(Math.round(num(cols, 6)) || 6, 1, 12);
  rows = clamp(Math.round(num(rows, 5)) || 5, 1, 10);
  const totalW = cols * ROOM.deskW + (cols - 1) * 22;
  const startX = snap(Math.max(30, (ROOM.width - totalW) / 2));
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        id: uid(rng),
        x: snap(startX + c * (ROOM.deskW + 22)),
        y: snap(110 + r * (ROOM.deskH + 24)),
        rot: 0, locked: false,
      });
    }
  }
  return out;
}

export function rowDesks(n, existing = [], rng = Math.random) {
  n = clamp(Math.round(num(n, 6)) || 6, 1, 14);
  const y = existing.length ? snap(Math.max(...existing.map(d => num(d.y, 110))) + ROOM.deskH + 24) : 110;
  const totalW = n * ROOM.deskW + (n - 1) * 22;
  let x = snap(Math.max(30, (ROOM.width - totalW) / 2));
  const out = [];
  for (let i = 0; i < n; i++) { out.push({ id: uid(rng), x: snap(x), y, rot: 0, locked: false }); x += ROOM.deskW + 22; }
  return out;
}

/** Free-ish spot for a single new desk, scanning the room left to right. */
export function nextSpot(desks) {
  for (let y = 110; y < 700; y += ROOM.deskH + 24) {
    for (let x = 40; x < ROOM.width - ROOM.deskW - 26; x += ROOM.deskW + 24) {
      if (!desks.some(d => Math.abs(num(d.x, 0) - x) < ROOM.deskW && Math.abs(num(d.y, 0) - y) < ROOM.deskH)) {
        return { x: snap(x), y: snap(y) };
      }
    }
  }
  return { x: snap(40), y: snap(120) };
}

/** The box the desks actually occupy. Used to trim the printed page. */
export function contentBox(desks) {
  if (!desks.length) return { x: 0, y: 0, w: ROOM.width, h: 400 };
  const xs = desks.map(d => num(d.x, 0)), ys = desks.map(d => num(d.y, 0));
  const x = Math.min(...xs), y = Math.min(...ys);
  return {
    x, y,
    w: Math.max(...xs) + ROOM.deskW - x,
    h: Math.max(...ys) + ROOM.deskH - y,
  };
}
