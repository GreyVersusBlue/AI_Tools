// seating.mjs — the Seating Chart Generator's pure logic and its save slot.
//
// Everything in here runs under plain Node with no DOM, which is the point: the
// seat solver, the constraint checker, the roster parser and the repair pass are
// arithmetic and string work, and `test/smoke-seating.mjs` drives them directly.
// The page keeps the DOM and nothing else that can be tested without a browser.
//
// The import of gvb-save is RELATIVE so Node can resolve it. A leading slash
// works only in the browser.

import { createSaveSlot } from '../../_shared/gvb-save.js';

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

/* How far the floor can be zoomed on screen. Below ZOOM_MIN a desk is too
   small to aim at; above ZOOM_MAX the room is mostly off-screen and panning
   stops being navigation. Shared with the page so the wheel, the saved zoom
   level and the state repair below all agree on the same limits. */
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 3;

export const uid = (rng = Math.random) => rng().toString(36).slice(2, 9);

/** Today as `YYYY-MM-DD` in the local timezone — a history entry's default
    date, and the input to suggestQuarter() when nothing else is known. Not
    `toISOString().slice(0,10)`, which reads UTC and drifts a date backward or
    forward for anyone west or east of Greenwich near midnight. */
export function todayISO(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ---------------------------------------------------------------------------
   Shape
--------------------------------------------------------------------------- */

export function newSection(name, rng = Math.random) {
  return {
    id: uid(rng),
    name,
    students: [],   // { id, name, note, flag, photo }
    apart: [],      // [ [studentId, studentId] ]
    together: [],
    desks: [],      // { id, x, y, rot, locked }
    assign: {},     // { deskId: studentId }
    layouts: [],    // { id, name, desks, assign } — saved arrangements, see newLayout
    history: [],    // { id, date, label, quarter, desks, assign, students } — dated
                     // snapshots for the seating-history/rotation report, see newHistoryEntry
  };
}

/**
 * A saved seating arrangement: its own desks and assignment, independent of
 * whatever is currently on the floor. The roster and the constraint pairs
 * are NOT part of a layout — they belong to the section as a whole, so
 * "Testing rows" and "Group pods" for the same class share one roster.
 */
export function newLayout(name, desks, assign, rng = Math.random) {
  return {
    id: uid(rng),
    name,
    desks: (desks || []).map(d => ({ ...d })),
    assign: { ...(assign || {}) },
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
  return {
    sections, active: sections[0].id, theme: 'light', zoom: 'fit', lastFirst: false,
    numbered: false,        // show a seat number on every desk, on screen and on paper
    mirror: false,          // student's-eye view: the floor flipped left/right
    printNames: true,       // the three print-only toggles Quick Wins ask for
    printPhotos: true,
    printViolations: true,
    // Which quarter "now" is, for the front-row-once-per-quarter check and for
    // tagging newly recorded history entries. A default guess, not a fact —
    // this tool has no school calendar of its own; see suggestQuarter().
    currentQuarter: suggestQuarter(todayISO()),
  };
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
    zoom: repairZoom(state.zoom),
    lastFirst: bool(state.lastFirst),
    numbered: bool(state.numbered),
    mirror: bool(state.mirror),
    printNames: state.printNames === false ? false : true,
    printPhotos: state.printPhotos === false ? false : true,
    printViolations: state.printViolations === false ? false : true,
    currentQuarter: str(state.currentQuarter).trim() || suggestQuarter(todayISO()),
  };
}

/** The saved zoom level: 'fit' (the default), 'full' (100%), or a number left
    behind by the wheel/pinch zoom. A number outside the usable range — or any
    other value, including one from a hand-edited file — falls back to 'fit'
    rather than to a floor nobody can see. */
function repairZoom(z) {
  if (z === 'full') return 'full';
  // typeof, not num(): a JSON round trip keeps a number a number, so anything
  // arriving as a string or a boolean is not a zoom level this tool wrote.
  if (typeof z === 'number' && Number.isFinite(z) && z >= ZOOM_MIN && z <= ZOOM_MAX) return z;
  return 'fit';
}

/** Shared by a section's live desks and every saved layout's desks. */
function repairDesks(list, rng) {
  return (Array.isArray(list) ? list : [])
    .filter(d => d && typeof d === 'object')
    .map(d => ({
      id: str(d.id) || uid(rng),
      x: clamp(num(d.x, 40), 0, ROOM.width - ROOM.deskW),
      y: clamp(num(d.y, 110), 0, ROOM.height - ROOM.deskH),
      rot: [0, 90, 180, 270].includes(num(d.rot, 0)) ? num(d.rot, 0) : 0,
      locked: bool(d.locked),
    }));
}

/** Drops a seat assignment pointing at a desk or student that no longer
    exists, and a student seated at two desks at once. Shared by a section's
    live assign and every saved layout's assign. */
function cleanAssign(assign, deskIds, studentIds) {
  const out = {};
  const seated = new Set();
  for (const [deskId, sid] of Object.entries(assign && typeof assign === 'object' ? assign : {})) {
    if (!deskIds.has(deskId) || !studentIds.has(sid)) continue;
    if (seated.has(sid)) continue;
    out[deskId] = sid;
    seated.add(sid);
  }
  return out;
}

/** A saved layout's desks and assign are repaired the same way the live floor
    is — they're just a floor that isn't the one currently on screen. */
function repairLayout(l, studentIds, rng) {
  const id = str(l.id) || uid(rng);
  const name = str(l.name).trim() || 'Layout';
  const desks = repairDesks(l.desks, rng);
  const deskIds = new Set(desks.map(d => d.id));
  const assign = cleanAssign(l.assign, deskIds, studentIds);
  return { id, name, desks, assign };
}

/** A recorded history entry is repaired the same way a saved layout is — its
    own desks and assign, cleaned against ITS OWN desk ids and ITS OWN name
    cache (not the live section's, which may have added or removed students
    since) — so an assign entry naming nobody in the entry's own record is
    exactly as invalid as a layout's assign naming nobody on the roster. */
function repairHistoryEntry(h, rng) {
  const id = str(h.id) || uid(rng);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str(h.date)) ? str(h.date) : todayISO();
  const label = str(h.label).trim() || `Recorded ${date}`;
  const quarter = str(h.quarter).trim() || suggestQuarter(date);
  const desks = (Array.isArray(h.desks) ? h.desks : [])
    .filter(d => d && typeof d === 'object' && str(d.id))
    .map(d => ({ id: str(d.id), x: num(d.x, 0), y: num(d.y, 0) }));
  const deskIds = new Set(desks.map(d => d.id));
  const students = (Array.isArray(h.students) ? h.students : [])
    .filter(x => x && typeof x === 'object' && str(x.id) && str(x.name).trim())
    .map(x => ({ id: str(x.id), name: str(x.name).trim() }));
  const studentIds = new Set(students.map(x => x.id));
  const assign = cleanAssign(h.assign, deskIds, studentIds);
  return { id, date, label, quarter, desks, assign, students };
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
      // Only ever a data: URL this tool generated itself (see scg-photo.js) —
      // anything else (a bare http(s) URL, garbage) is dropped rather than
      // trusted into an <img src>.
      photo: str(st.photo).slice(0, 11) === 'data:image/' ? str(st.photo) : '',
    }));
  const studentIds = new Set(students.map(st => st.id));

  const desks = repairDesks(s.desks, rng);
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

  const assign = cleanAssign(s.assign, deskIds, studentIds);

  const layouts = (Array.isArray(s.layouts) ? s.layouts : [])
    .filter(l => l && typeof l === 'object')
    .map(l => repairLayout(l, studentIds, rng));

  // Oldest first, so every history-reading function (studentHistoryRows,
  // classHistorySummary, the front-row-per-quarter check) can assume
  // chronological order instead of re-sorting.
  const history = (Array.isArray(s.history) ? s.history : [])
    .filter(h => h && typeof h === 'object')
    .map(h => repairHistoryEntry(h, rng))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return { id, name, students, apart, together, desks, assign, layouts, history };
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

/**
 * `hist` (optional) carries the two seating-history nudges, both best-effort:
 * `repeatMap` (studentId -> Set of seatKeys already sat in, from
 * seatHistoryMap) steers a student away from a desk that repeats an earlier
 * seat, and `frontRowSet`/`dueSet` (desk ids in the front row / student ids
 * who haven't had one this quarter, from frontRowDeskIds/frontRowStatus)
 * gives a due student first claim on a front-row desk. Neither ever returns
 * null the way an unsatisfiable put-together does — a rotation nudge losing
 * to Keep Apart or a full room is exactly the "warn, don't break the room"
 * behaviour the feature is supposed to have.
 */
function onePass(section, nbrs, apart, freeDesks, toPlace, seedDesk, seedStudent, rng, hist = {}) {
  const { deskById = {}, repeatMap = null, frontRowSet = null, dueSet = null } = hist;
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

    // Nudge 1: don't reseat this student somewhere they've already sat,
    // unless every remaining candidate desk would.
    if (repeatMap && repeatMap[sid] && repeatMap[sid].size) {
      const fresh = cands.filter(did => !repeatMap[sid].has(seatKey(deskById[did])));
      if (fresh.length) cands = fresh;
    }
    // Nudge 2: a student overdue for a front-row seat this quarter gets
    // first claim on one, whenever this pass still has one free.
    if (dueSet && dueSet.has(sid) && frontRowSet) {
      const front = cands.filter(did => frontRowSet.has(did));
      if (front.length) cands = front;
    }

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
 *
 * `quarter` (optional) turns on the two seating-history nudges (see onePass):
 * pass the section's `currentQuarter` to steer away from repeat seats and
 * toward a front-row seat for whoever's overdue this quarter. Omit it (the
 * default) and assignSeats behaves exactly as it did before history existed
 * — every existing caller that doesn't know about quarters is unaffected.
 */
export function assignSeats(section, { attempts = 800, rng = Math.random, quarter = '' } = {}) {
  const nbrs = neighborMap(section.desks);
  const apart = apartMap(section.students, section.apart);

  const deskById = {};
  section.desks.forEach(d => { deskById[d.id] = d; });
  const history = Array.isArray(section.history) ? section.history : [];
  const repeatMap = history.length ? seatHistoryMap(history) : null;
  const frontRowSet = quarter ? new Set(frontRowDeskIds(section.desks)) : null;
  // Gated on history.length, not just a quarter being set: `currentQuarter`
  // always has a default value (see freshState), so without this gate every
  // section would get "due" nudges from the moment the page loads, whether
  // or not the teacher has ever recorded an arrangement. Once the rotation
  // has a first recorded data point, this seeds fairly from there.
  const dueSet = (quarter && history.length) ? frontRowStatus({ ...section, history }, quarter).dueIds : null;

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
    const pass = onePass(section, nbrs, apart, freeDesks, toPlace, seedDesk, seedStudent, rng,
      { deskById, repeatMap, frontRowSet, dueSet });
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

/* ---------------------------------------------------------------------------
   Storage usage (P12)

   localStorage stores strings as UTF-16, so a string's own .length (in UTF-16
   code units) times 2 is the byte count the browser actually books against
   quota — that is what the tool measures against, not a UTF-8 estimate that
   would understate a roster full of accented names.
--------------------------------------------------------------------------- */
export const QUOTA_BYTES = 5 * 1024 * 1024; // most browsers cap a localStorage origin near 5MB

export function estimateStorageBytes(str) {
  return String(str ?? '').length * 2;
}

/** How much of the one saved key a chart is using, and where it's going —
    photos are the thing that actually grows without bound, so they get their
    own line rather than being buried inside a section's total. */
export function storageReport(state) {
  const whole = estimateStorageBytes(JSON.stringify({ ...state, __v: SCHEMA_VERSION }));
  const bySection = state.sections.map(s => {
    const photoBytes = s.students.reduce((t, st) => t + estimateStorageBytes(st.photo || ''), 0);
    const photoCount = s.students.filter(st => st.photo).length;
    return {
      id: s.id,
      name: s.name,
      bytes: estimateStorageBytes(JSON.stringify(s)),
      photoBytes,
      photoCount,
    };
  });
  const photoBytes = bySection.reduce((t, s) => t + s.photoBytes, 0);
  const photoCount = bySection.reduce((t, s) => t + s.photoCount, 0);
  return { totalBytes: whole, quotaBytes: QUOTA_BYTES, pct: whole / QUOTA_BYTES, photoBytes, photoCount, bySection };
}

/* ---------------------------------------------------------------------------
   Bulk photo import — match a batch of image filenames to roster names, so a
   teacher can drop in a folder of ID-photo exports instead of clicking each
   student's circle one at a time.
--------------------------------------------------------------------------- */

function normalizeForMatch(s) {
  return String(s ?? '')
    .replace(/\.[a-z0-9]{2,4}$/i, '')          // drop a file extension
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // drop accents so they match plain ASCII
    .toLowerCase()
    .replace(/[_.\-]+/g, ' ')                  // filename separators become spaces
    .replace(/\d+/g, ' ')                      // strip stray id numbers ("ada_lovelace_014")
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(s) {
  return new Set(normalizeForMatch(s).split(' ').filter(Boolean));
}

const sameTokens = (a, b) => a.size > 0 && a.size === b.size && [...a].every(t => b.has(t));

/**
 * `filenames` — plain strings, e.g. from a batch of `File.name`. `students` —
 * `[{ id, name }]`. Matches each filename to at most one student and each
 * student to at most one filename: first an exact normalized match ("Ada
 * Lovelace.jpg"), then a same-word match regardless of order ("Lovelace,
 * Ada (3).png" — same two words as "Ada Lovelace"). Whatever is left over
 * comes back unmatched rather than guessed at, since a wrong photo on a face
 * is worse than a missing one.
 */
export function matchPhotoFilenames(filenames, students) {
  const used = new Set();
  const matches = [];
  const claimed = new Set();

  for (const filename of filenames) {
    const norm = normalizeForMatch(filename);
    const hit = students.find(st => !used.has(st.id) && normalizeForMatch(st.name) === norm);
    if (hit) { matches.push({ filename, studentId: hit.id, name: hit.name }); used.add(hit.id); claimed.add(filename); }
  }
  for (const filename of filenames) {
    if (claimed.has(filename)) continue;
    const toks = tokenSet(filename);
    if (!toks.size) continue;
    const hit = students.find(st => !used.has(st.id) && sameTokens(toks, tokenSet(st.name)));
    if (hit) { matches.push({ filename, studentId: hit.id, name: hit.name }); used.add(hit.id); claimed.add(filename); }
  }
  const unmatched = filenames.filter(f => !claimed.has(f));
  return { matches, unmatched };
}

/* ---------------------------------------------------------------------------
   Seating history and rotation — "nobody sits in the same seat twice" and
   "everybody sits in the front row once per quarter" as real constraints,
   plus the printable evidence for a parent/admin conversation about seating
   fairness. See Status in improvement prompts/005-seating-chart-generator.md
   for how "unit" and "quarter" boundaries were decided: a recorded entry is
   whatever the teacher labels it ("Unit 3") on whatever date they record it,
   and "quarter" is a freeform, editable tag defaulted by suggestQuarter()
   rather than read from a real school calendar (this tool has none).
--------------------------------------------------------------------------- */

/** A desk's stable "spot in the room", for comparing seats across recordings
    that may have added, removed, or nudged other desks in between — grid-
    snapped so a pixel of drag jitter never counts as a different seat. */
export function seatKey(desk) {
  return snap(num(desk.x, 0)) + ':' + snap(num(desk.y, 0));
}

/** Which desks count as "the front row": within `tolerance` of whichever desk
    sits closest to the board. A row built by "+ Row of" or "Make grid" steps
    a full `deskH + 24` (94px) between rows, so a tolerance well under that
    (60% of a desk's height) catches a hand-nudged front desk without also
    catching row two. */
export function frontRowDeskIds(desks, tolerance = ROOM.deskH * 0.6) {
  if (!desks || !desks.length) return [];
  const minY = Math.min(...desks.map(d => num(d.y, 0)));
  return desks.filter(d => num(d.y, 0) <= minY + tolerance).map(d => d.id);
}

/** A default guess at "which quarter is `dateStr`", using the shape of a
    common US school year (Aug-Oct, Nov-Jan, Feb-Mar, Apr-Jul). It is only
    ever a starting point for the prompt in recordHistory() — real school
    calendars vary school to school, and this tool has no calendar of its own
    to read a real one from (School Calendar does; this stays freeform). */
export function suggestQuarter(dateStr) {
  const d = new Date(String(dateStr || '') + 'T00:00:00');
  const m = Number.isFinite(d.getTime()) ? d.getMonth() + 1 : new Date().getMonth() + 1;
  if (m >= 8 && m <= 10) return 'Q1';
  if (m === 11 || m === 12 || m === 1) return 'Q2';
  if (m === 2 || m === 3) return 'Q3';
  return 'Q4';
}

/**
 * A dated snapshot of who sat where: the section's own desks and assignment
 * at the moment it's recorded, plus a name cache so a student later removed
 * from the roster still shows up by name in an old record instead of
 * "(removed)". `label` is freeform ("Unit 3", "Poetry unit"); `quarter`
 * groups entries for the front-row-once-per-quarter check.
 */
export function newHistoryEntry(section, { date, label, quarter } = {}, rng = Math.random) {
  const d = str(date) || todayISO();
  return {
    id: uid(rng),
    date: d,
    label: str(label).trim() || `Recorded ${d}`,
    quarter: str(quarter).trim() || suggestQuarter(d),
    desks: section.desks.map(dk => ({ id: dk.id, x: num(dk.x, 0), y: num(dk.y, 0) })),
    assign: { ...section.assign },
    students: section.students.map(st => ({ id: st.id, name: st.name })),
  };
}

/** studentId -> Set of seatKeys they've occupied, across every recorded
    history entry (not the live floor — see checkHistoryConstraints for
    that). Each entry supplies its own desks, so a desk id that has since
    been reused for an unrelated desk on the live floor can't collide. */
export function seatHistoryMap(history) {
  const m = {};
  for (const h of (history || [])) {
    const deskById = {};
    (h.desks || []).forEach(d => { deskById[d.id] = d; });
    for (const [deskId, sid] of Object.entries(h.assign || {})) {
      const d = deskById[deskId];
      if (!d) continue;
      if (!m[sid]) m[sid] = new Set();
      m[sid].add(seatKey(d));
    }
  }
  return m;
}

/**
 * Per-student front-row status for one quarter: how many recorded entries
 * tagged with that quarter sat them in that entry's own front row.
 * `dueIds` is every current roster student with zero — "hasn't had it yet,
 * and isn't being denied it indefinitely" is exactly the thing a fair-
 * rotation report and the auto-assign nudge both need to know.
 */
export function frontRowStatus(section, quarter) {
  const counts = {};
  for (const h of (section.history || [])) {
    if (h.quarter !== quarter) continue;
    const front = new Set(frontRowDeskIds(h.desks));
    for (const [deskId, sid] of Object.entries(h.assign || {})) {
      if (!front.has(deskId)) continue;
      counts[sid] = (counts[sid] || 0) + 1;
    }
  }
  const rows = section.students.map(st => ({
    studentId: st.id,
    name: st.name,
    timesFrontRow: counts[st.id] || 0,
  }));
  const dueIds = new Set(rows.filter(r => r.timesFrontRow === 0).map(r => r.studentId));
  return { quarter, rows, dueIds };
}

/**
 * What the LIVE assignment on the floor right now would repeat or still
 * leave overdue, checked against recorded history — the toolbar/status-line
 * report. Same shape of question as checkConstraints() (apart/together), for
 * a rule the solver treats as a best-effort nudge rather than a hard block
 * (see onePass): a chart can still violate it, and this is how that shows.
 * Pass `quarter` as '' to skip the front-row half of the report. Both halves
 * are naturally silent on a section with no recorded history yet — an empty
 * `seatHist`/`frontRowStatus` has nothing to flag — which is what keeps this
 * mute for the many sections that never touch Seating History at all.
 */
export function checkHistoryConstraints(section, quarter) {
  const seatHist = seatHistoryMap(section.history);
  const deskById = {};
  (section.desks || []).forEach(d => { deskById[d.id] = d; });

  const repeats = [];
  for (const [deskId, sid] of Object.entries(section.assign || {})) {
    const d = deskById[deskId];
    if (!d) continue;
    const had = seatHist[sid];
    if (had && had.has(seatKey(d))) repeats.push({ studentId: sid, deskId });
  }

  let dueUnseated = [];
  if (quarter && section.history && section.history.length) {
    const { dueIds } = frontRowStatus(section, quarter);
    const front = new Set(frontRowDeskIds(section.desks));
    const seatedFront = new Set();
    for (const [deskId, sid] of Object.entries(section.assign || {})) if (front.has(deskId)) seatedFront.add(sid);
    for (const id of dueIds) {
      if (seatedFront.has(id)) continue;   // the arrangement on the floor right now already covers them
      const st = section.students.find(s => s.id === id);
      if (st) dueUnseated.push({ studentId: id, name: st.name });
    }
  }

  return { repeatOK: repeats.length === 0, repeats, dueUnseated };
}

/** One student's seating history, oldest first — the row-by-row printable
    evidence for a fairness conversation about one student. `repeat` marks
    every entry from the second time this student's seat key recurs onward. */
export function studentHistoryRows(section, studentId) {
  const seen = new Set();
  const rows = [];
  for (const h of (section.history || [])) {
    // h.assign is deskId -> studentId, so finding this student's seat means
    // searching the values, not indexing by their id.
    const deskId = Object.keys(h.assign || {}).find(d => h.assign[d] === studentId);
    if (!deskId) continue;
    const deskById = {};
    (h.desks || []).forEach(d => { deskById[d.id] = d; });
    const desk = deskById[deskId];
    if (!desk) continue;
    const key = seatKey(desk);
    const repeat = seen.has(key);
    seen.add(key);
    rows.push({ date: h.date, label: h.label, quarter: h.quarter, frontRow: frontRowDeskIds(h.desks).includes(deskId), repeat });
  }
  return rows;
}

/** Whole-section rotation summary for one quarter: every current student's
    total recorded appearances, front-row appearances in `quarter`, and how
    many of their recorded seats repeated an earlier one of their own — the
    printable "is this section's rotation actually fair" evidence. */
export function classHistorySummary(section, quarter) {
  const byStudent = {};
  section.students.forEach(st => { byStudent[st.id] = { studentId: st.id, name: st.name, total: 0, repeats: 0, frontRowThisQuarter: 0 }; });
  const seen = {};
  for (const h of (section.history || [])) {
    const front = new Set(frontRowDeskIds(h.desks));
    const deskById = {};
    (h.desks || []).forEach(d => { deskById[d.id] = d; });
    for (const [deskId, sid] of Object.entries(h.assign || {})) {
      const row = byStudent[sid];
      if (!row) continue;   // recorded, but no longer on the roster
      row.total++;
      const desk = deskById[deskId];
      if (desk) {
        const key = seatKey(desk);
        if (!seen[sid]) seen[sid] = new Set();
        if (seen[sid].has(key)) row.repeats++;
        seen[sid].add(key);
      }
      if (h.quarter === quarter && front.has(deskId)) row.frontRowThisQuarter++;
    }
  }
  return Object.values(byStudent);
}
