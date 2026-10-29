// bmg-quiz-memory.js — which places a class missed, kept across sessions (Path 20 P5). Pure but for the two
// storage wrappers at the bottom.
//
// The self-check quiz bar tallies "Class got it" / "Missed" for a round and forgets them. This keeps the signal
// that matters for reteaching: per map project, per place name, how often the class got it or missed it, and
// which came last. It is about places, never about students: no name, no id of a person, nothing typed by a
// student, so the key is not `student: true` in the tool registry and the year rollover leaves it.
//
// Shape (key `bmg_quiz_memory_v1`, one value, never inside the project, so a share link never carries it):
//   { __v: 1, projects: { [projectId]: { at: 'YYYY-MM-DD', labels: { [key]: { text, got, missed, last, at } } } } }
// `key` is the place name trimmed, whitespace-collapsed and lower-cased, so renaming a label's capitals or
// re-placing it on a copied map finds its history; `text` is the wording to show.

export const KEY = 'bmg_quiz_memory_v1';
export const VERSION = 1;
export const MAX_PROJECTS = 40;
export const MAX_LABELS = 500;
const MAX_TEXT = 80, MAX_COUNT = 9999;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

export function empty() { return { __v: VERSION, projects: {} }; }

/** The identity of a place across rounds, or null for a label with no text. */
export function keyOf(text) {
  const k = String(text == null ? '' : text).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
  return k ? k.slice(0, MAX_TEXT) : null;
}

const count = v => (Number.isInteger(v) && v > 0 ? Math.min(v, MAX_COUNT) : 0);
const day = v => (typeof v === 'string' && DAY.test(v) ? v : '');
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/** Whatever came out of storage, made into a memory. Junk becomes an empty one; it never throws. */
export function normalize(raw) {
  const out = empty();
  if (!isObj(raw) || raw.__v !== VERSION || !isObj(raw.projects)) return out;
  for (const pid of Object.keys(raw.projects)) {
    const p = raw.projects[pid];
    if (!isObj(p) || !isObj(p.labels)) continue;
    const labels = {};
    for (const k of Object.keys(p.labels)) {
      const e = p.labels[k];
      if (!isObj(e) || k !== keyOf(k)) continue;
      const got = count(e.got), missed = count(e.missed);
      if (!got && !missed) continue;
      labels[k] = {
        text: typeof e.text === 'string' && e.text.trim() ? e.text.trim().slice(0, MAX_TEXT) : k,
        got, missed,
        last: e.last === 'got' || e.last === 'missed' ? e.last : (missed > got ? 'missed' : 'got'),
        at: day(e.at),
      };
    }
    if (Object.keys(labels).length) out.projects[pid] = { at: day(p.at), labels };
  }
  return capProjects(out);
}

function capProjects(mem) {
  const ids = Object.keys(mem.projects);
  if (ids.length > MAX_PROJECTS) {
    ids.sort((a, b) => (mem.projects[b].at || '').localeCompare(mem.projects[a].at || ''));
    ids.slice(MAX_PROJECTS).forEach(id => { delete mem.projects[id]; });
  }
  return mem;
}

const clone = m => JSON.parse(JSON.stringify(m));

/**
 * Records one result for one place. `prev` is the result already recorded for that place this round (or null):
 * pressing the same button twice for one place counts once, and pressing the other button replaces the first
 * mark rather than adding a second. Returns a new memory; the one passed in is not changed.
 */
export function record(mem, projectId, text, result, today, prev = null) {
  const key = keyOf(text);
  if (!key || (result !== 'got' && result !== 'missed') || typeof projectId !== 'string' || !projectId) return mem;
  if (prev === result) return mem;
  const out = clone(normalize(mem));
  const p = out.projects[projectId] || (out.projects[projectId] = { at: '', labels: {} });
  const e = p.labels[key] || (p.labels[key] = { text: String(text).trim().slice(0, MAX_TEXT), got: 0, missed: 0, last: result, at: '' });
  if (prev === 'got') e.got = Math.max(0, e.got - 1);
  if (prev === 'missed') e.missed = Math.max(0, e.missed - 1);
  e[result] = Math.min(MAX_COUNT, e[result] + 1);
  e.text = String(text).trim().slice(0, MAX_TEXT);
  e.last = result;
  e.at = day(today);
  p.at = day(today);
  if (!e.got && !e.missed) delete p.labels[key];
  const keys = Object.keys(p.labels);
  if (keys.length > MAX_LABELS) {
    keys.sort((a, b) => (p.labels[a].at || '').localeCompare(p.labels[b].at || ''));
    keys.slice(0, keys.length - MAX_LABELS).forEach(k => { delete p.labels[k]; });
  }
  return capProjects(out);
}

/** A place needs another look when the class has missed it more than it got it, or missed it last time. */
export function isWeak(e) { return !!e && e.missed > 0 && (e.missed > e.got || e.last === 'missed'); }

/** The weak places of one map project, worst first: [{ key, text, got, missed, last, at }]. */
export function weakList(mem, projectId) {
  const p = isObj(mem) && isObj(mem.projects) && own(mem.projects, projectId) ? mem.projects[projectId] : null;
  if (!p || !isObj(p.labels)) return [];
  return Object.keys(p.labels).map(k => ({ key: k, ...p.labels[k] })).filter(isWeak)
    .sort((a, b) => (b.missed - b.got) - (a.missed - a.got) || b.missed - a.missed || a.text.localeCompare(b.text));
}

/** Of the labels still hidden this round, one the class has trouble with (random among them), or null when none is weak. */
export function pickWeak(hidden, mem, projectId, rng = Math.random) {
  const weak = new Set(weakList(mem, projectId).map(w => w.key));
  const pool = (hidden || []).filter(l => l && weak.has(keyOf(l.text)));
  return pool.length ? pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] : null;
}

/** One map project's history removed. */
export function forget(mem, projectId) {
  const out = clone(normalize(mem));
  delete out.projects[projectId];
  return out;
}

/** History of map projects that no longer exist removed (`liveIds` are the ids the workspace still holds). */
export function prune(mem, liveIds) {
  const live = new Set(liveIds || []);
  const out = clone(normalize(mem));
  for (const id of Object.keys(out.projects)) if (!live.has(id)) delete out.projects[id];
  return out;
}

/* ── storage ─ the only place this module touches localStorage ───────────────────────────────────────────── */

export function load() {
  try {
    const raw = globalThis.localStorage.getItem(KEY);
    return raw ? normalize(JSON.parse(raw)) : empty();
  } catch (e) { return empty(); }
}

/** True when it was stored; false when the browser refused (storage blocked or full), and the page then keeps the memory for the visit only. */
export function save(mem) {
  try {
    const n = normalize(mem);
    if (Object.keys(n.projects).length) globalThis.localStorage.setItem(KEY, JSON.stringify(n));
    else globalThis.localStorage.removeItem(KEY);
    return true;
  } catch (e) { return false; }
}
