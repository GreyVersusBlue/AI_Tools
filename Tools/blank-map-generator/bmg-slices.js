// bmg-slices.js — time slices for annotations (Path 20 P4). Pure: no DOM, storage or network.
//
// A project may hold `slices: { list, active, next }`. Each slice is { id, name, year, content } and its content
// is the annotation set a map carries (CONTENT_FIELDS: labels, markers, regions, lines and their key text/order).
// The ACTIVE slice's content is the project's own fields, live, so every editor, export and undo reads and writes
// what it always did; the other slices hold stored copies. Switching writes the live fields into the active slice
// and loads the target's into the project. A project without `slices` is exactly what it was.

export const CONTENT_FIELDS = ['labels', 'markers', 'regions', 'lines', 'legendText', 'regionLegendText', 'lineLegendText', 'choroLegendText', 'labelLegendText', 'legendOrder'];
const ARRAY_FIELDS = new Set(['labels', 'markers', 'regions', 'lines', 'legendOrder']);
export const MAX_SLICES = 12;
const MAX_ITEMS = 5000;
const MIN_YEAR = -100000, MAX_YEAR = 100000;

const clone = v => JSON.parse(JSON.stringify(v));
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

/** An empty annotation set. */
export function blankContent() {
  const c = {};
  for (const f of CONTENT_FIELDS) c[f] = ARRAY_FIELDS.has(f) ? [] : {};
  return c;
}

/** The project's live annotation fields, copied. */
export function liveContent(project) {
  const c = {};
  for (const f of CONTENT_FIELDS) c[f] = clone(project[f] === undefined ? (ARRAY_FIELDS.has(f) ? [] : {}) : project[f]);
  return c;
}

export function hasSlices(project) {
  return !!(project && project.slices && Array.isArray(project.slices.list) && project.slices.list.length);
}

/** Whole-number year or null; anything else is not a year. */
export function parseYear(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isInteger(n) && n >= MIN_YEAR && n <= MAX_YEAR ? n : null;
}

function uniqueName(list, want) {
  const base = String(want || '').trim().slice(0, 80) || 'Slice ' + (list.length + 1);
  const taken = new Set(list.map(s => s.name));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) { const n = base + ' (' + i + ')'; if (!taken.has(n)) return n; }
}

/** Starts slices on a project that has none: its current annotations become the first slice. Returns the slice. */
export function enableSlices(project, { name = '', year = null } = {}) {
  if (hasSlices(project)) return activeSlice(project);
  const slice = { id: 's1', name: String(name || '').trim().slice(0, 80) || 'Slice 1', year: parseYear(year), content: null };
  project.slices = { list: [slice], active: 's1', next: 2 };
  return slice;
}

export function activeSlice(project) {
  return hasSlices(project) ? project.slices.list.find(s => s.id === project.slices.active) || project.slices.list[0] : null;
}

/** Writes the live fields into the active slice (so a stored copy is never stale). */
export function captureLive(project) {
  const s = activeSlice(project);
  if (s) s.content = liveContent(project);
}

/**
 * Adds a slice after the active one. `copy` starts it as a copy of what is on the map (borders that move a
 * little between dates); otherwise it is blank. It does not switch to it. Returns the new id, or null at the limit.
 */
export function addSlice(project, { name = '', year = null, copy = false } = {}) {
  if (!hasSlices(project)) enableSlices(project);
  const S = project.slices;
  if (S.list.length >= MAX_SLICES) return null;
  captureLive(project);
  const id = 's' + S.next++;
  const at = S.list.findIndex(s => s.id === S.active) + 1;
  S.list.splice(at, 0, { id, name: uniqueName(S.list, name), year: parseYear(year), content: copy ? clone(activeSlice(project).content) : blankContent() });
  return id;
}

/** Makes `id` the slice on the map. False when there is no such slice. */
export function switchTo(project, id) {
  if (!hasSlices(project)) return false;
  const target = project.slices.list.find(s => s.id === id);
  if (!target) return false;
  if (target.id === project.slices.active) return true;
  captureLive(project);
  const c = target.content || blankContent();
  for (const f of CONTENT_FIELDS) project[f] = clone(c[f] === undefined ? (ARRAY_FIELDS.has(f) ? [] : {}) : c[f]);
  project.slices.active = target.id;
  target.content = null; // the live fields are its content now
  return true;
}

/** Deletes a slice; the last one cannot go. Deleting the active one shows its neighbour. */
export function removeSlice(project, id) {
  if (!hasSlices(project) || project.slices.list.length < 2) return false;
  const S = project.slices;
  const i = S.list.findIndex(s => s.id === id);
  if (i < 0) return false;
  if (S.active === id) switchTo(project, (S.list[i + 1] || S.list[i - 1]).id);
  S.list.splice(S.list.findIndex(s => s.id === id), 1);
  return true;
}

export function setSliceMeta(project, id, { name, year } = {}) {
  const s = hasSlices(project) && project.slices.list.find(x => x.id === id);
  if (!s) return false;
  if (name !== undefined) s.name = uniqueName(project.slices.list.filter(x => x !== s), name);
  if (year !== undefined) s.year = parseYear(year);
  return true;
}

/** The slices oldest first (undated ones keep their order, after the dated). Reorders the list; the active slice stays active. */
export function sortByYear(project) {
  if (!hasSlices(project)) return;
  const L = project.slices.list.map((s, i) => [s, i]);
  L.sort((a, b) => {
    const ay = a[0].year, by = b[0].year;
    if (ay === null && by === null) return a[1] - b[1];
    if (ay === null) return 1;
    if (by === null) return -1;
    return ay - by || a[1] - b[1];
  });
  project.slices.list = L.map(x => x[0]);
}

/** A copy of one slice's annotations, read from the live fields when it is the one on the map. */
export function contentOf(project, id) {
  if (!hasSlices(project)) return null;
  const s = project.slices.list.find(x => x.id === id);
  if (!s) return null;
  return s.id === project.slices.active ? liveContent(project) : clone(s.content || blankContent());
}

/** "1803", "1803 BCE", or "" for an undated slice. */
export function yearText(year) {
  return year === null || year === undefined ? '' : year < 0 ? Math.abs(year) + ' BCE' : String(year);
}

/**
 * Makes anything that arrives (a share link, an imported file, an old save) into slices the page can trust, or
 * undefined. Bounded counts and lengths, known fields only; contents that are not the right shape become blank.
 */
export function cleanSlices(raw) {
  if (!isObj(raw) || !Array.isArray(raw.list)) return undefined;
  const seen = new Set();
  const list = [];
  for (const r of raw.list.slice(0, MAX_SLICES)) {
    if (!isObj(r)) continue;
    const id = typeof r.id === 'string' && /^s\d{1,6}$/.test(r.id) ? r.id : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    let content = null;
    if (isObj(r.content)) {
      content = blankContent();
      for (const f of CONTENT_FIELDS) {
        const v = r.content[f];
        if (ARRAY_FIELDS.has(f) ? Array.isArray(v) && v.length <= MAX_ITEMS : isObj(v)) content[f] = clone(v);
      }
    }
    list.push({ id, name: uniqueName(list, r.name), year: parseYear(r.year), content });
  }
  if (!list.length) return undefined;
  const active = list.some(s => s.id === raw.active) ? raw.active : list[0].id;
  const top = list.reduce((m, s) => Math.max(m, Number(s.id.slice(1))), 0);
  list.find(s => s.id === active).content = null;
  return { list, active, next: Math.max(top + 1, Number.isInteger(raw.next) ? raw.next : 0) };
}
