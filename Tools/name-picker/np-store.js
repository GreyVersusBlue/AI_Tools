// np-store.js — the Name Picker's twelve storage keys, on gvb-save.js.
//
// The page used to call localStorage directly at forty-six sites across twelve
// keys. Four of those were bare
// `JSON.parse(localStorage.getItem('np_rosters') || '{}')` with no try/catch, so
// one malformed roster entry threw on read and took the page down with a class
// list the teacher had no way to delete. That is the bug this file exists to
// make impossible, and gvb-save's `load()` returning null instead of throwing is
// the reason it can.
//
// Two constraints shaped everything here:
//
//   1. Every key name stays exactly as it was (locked decision #36). All twelve.
//   2. So does every byte on disk. gvb-save stamps `__v` into the object it
//      writes, which would turn `np_history` (an array) into an object with
//      numeric keys, and `np_theme` (the bare string `medieval`) into something
//      JSON.parse can actually read. `boxed()` below is the adapter that
//      prevents it: gvb-save sees `{value: …}`, localStorage sees precisely what
//      the old build wrote. Adopting this rewrites no stored data at all, so a
//      teacher who somehow ends up back on the old build still has her rosters.
//
// Three representations, kept straight on purpose, because conflating them was
// the first bug in this file:
//
//   disk    what localStorage holds — '1', 'medieval', a JSON array
//   app     what the page wants — true, 'medieval', an array
//   box     what gvb-save sees — {value: <disk>}
//
// `ok` and `fix` judge and clean the DISK form. `decode`/`encode` cross between
// disk and app. `snapshot()` is disk-shaped, which is what makes an export file
// a straight dump of the twelve keys.
//
// DOM-free on purpose — test/smoke.mjs imports it under plain Node, which is why
// the gvb-save import is relative rather than site-absolute.

import { createSaveSlot, defaultStorage } from "../../assets/js/gvb-save.js";

const GAME = "name-picker";
const SLOT_VERSION = 1;   // per-key slots. Unversioned data on disk reads as 0.
const BUNDLE_VERSION = 3; // export file. The hand-rolled backup format was at 2.

/* Ceilings, not policy. They stop a corrupt or hostile blob being loaded into
   the DOM by the thousand; no real class list comes near any of them. */
const MAX_NAME = 120, MAX_ROSTER = 400, MAX_ROSTERS = 60;
const MAX_PROMPTS = 200, MAX_HISTORY = 500, MAX_HOF = 50, MAX_STATS = 4000;

const isStr = v => typeof v === "string";
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const trimmed = v => (isStr(v) ? v.trim() : "");

/** A list of student names: trimmed, non-empty, de-duplicated, capped. */
function nameList(v, cap = MAX_ROSTER) {
  if (!Array.isArray(v)) return [];
  const seen = new Set(), out = [];
  for (const raw of v) {
    const n = trimmed(raw).slice(0, MAX_NAME);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= cap) break;
  }
  return out;
}

const countOf = v => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

export const OPTION_DEFAULTS = {
  sound: true,
  confetti: true,
  dramatic: true,
  rarity: true,
  hof: true,
  // Fair rotation defaults on. A uniform Math.random() over twenty-eight names
  // repeats the previous student about once every twenty-eight picks and leaves
  // somebody uncalled for a whole period, and "everyone before anyone twice" is
  // what a teacher standing in front of a class means by random.
  fair: true,
  coldCall: false,
  suddenDeath: false,
  promptsOn: false,
  mode: "jump",
  speed: 130,
  multi: 1,
  groups: 4
};

/* A disk-shaped '1'/'0' flag that the page wants as a boolean. */
const FLAG = {
  ok: isStr,
  fix: v => (v === "1" ? "1" : "0"),
  decode: v => v === "1",
  encode: v => (v ? "1" : "0"),
  blank: () => "0",
  wire: "raw",
  group: "prefs"
};

/* ---------------------------------------------------------------------------
   The twelve keys, plus np_options.

   `group` is the interesting column. The three groups have genuinely different
   erase needs, and that is what makes one honest "clear all data" button
   possible instead of twelve:

     roster   the names themselves
     records  names plus what they did — pick counts, history, hall of fame
     prefs    no student data at all, including the unlocked retro theme

   np_lucky is in `roster` and not `prefs` because it stores a student's name.
   That is invisible from the key alone and it is why this table exists rather
   than a flat list.

   `wire` is how the value already sits in localStorage: "json" for anything the
   old build ran through JSON.stringify, "raw" for the five keys it wrote as bare
   strings. Getting one wrong silently discards that key's stored value.
--------------------------------------------------------------------------- */
export const KEYS = [
  {
    name: "rosters", key: "np_rosters", group: "roster", wire: "json",
    label: "Saved rosters", blank: () => ({}),
    ok: isObj,
    // A roster whose value is not an array is what crashed loadRosterByName():
    // rosters[name].join('\n') on a number throws. It gets dropped here, and the
    // other rosters survive — which is the whole difference from the old
    // unguarded read, where one bad entry took the page with it.
    fix: v => {
      const out = {};
      for (const [label, list] of Object.entries(v)) {
        const title = trimmed(label).slice(0, 80);
        if (!title) continue;
        const names = nameList(list);
        if (!names.length) continue;
        out[title] = names;
        if (Object.keys(out).length >= MAX_ROSTERS) break;
      }
      return out;
    }
  },
  {
    name: "current", key: "np_current", group: "roster", wire: "json",
    label: "Roster on screen", blank: () => [],
    ok: Array.isArray, fix: v => nameList(v)
  },
  {
    name: "lucky", key: "np_lucky", group: "roster", wire: "json",
    label: "Lucky student of the day", blank: () => null,
    ok: v => v === null || isObj(v),
    fix: v => {
      if (!isObj(v)) return null;
      const name = trimmed(v.name).slice(0, MAX_NAME);
      const date = /^\d{4}-\d{2}-\d{2}$/.test(v.date) ? v.date : "";
      return name && date ? { name, date } : null;
    }
  },
  {
    name: "stats", key: "np_stats", group: "records", wire: "json",
    label: "Lifetime pick counts", blank: () => ({}),
    ok: isObj,
    // A non-numeric count became (count/max)*100 = NaN and rendered a bar with
    // width:NaN%. Coerced rather than dropped: the name is still worth keeping.
    fix: v => {
      const out = {};
      for (const [raw, n] of Object.entries(v)) {
        const name = trimmed(raw).slice(0, MAX_NAME);
        if (!name || name === "__v") continue;
        out[name] = countOf(n);
        if (Object.keys(out).length >= MAX_STATS) break;
      }
      return out;
    }
  },
  {
    name: "history", key: "np_history", group: "records", wire: "json",
    label: "Pick history", blank: () => [],
    ok: Array.isArray,
    fix: v => v
      .filter(isObj)
      .map(h => ({ name: trimmed(h.name).slice(0, MAX_NAME), time: trimmed(h.time).slice(0, 20) }))
      .filter(h => h.name)
      .slice(-MAX_HISTORY)
  },
  {
    name: "hof", key: "np_hof", group: "records", wire: "json",
    label: "Hall of Fame", blank: () => [],
    ok: Array.isArray,
    // The fill-in that earns `repair` here, and the bug class v7 §2 describes: a
    // field absent from existing data, used somewhere that turns `undefined`
    // into a failure. updateHofTicker() calls e.tier.toLowerCase() on every
    // entry, so one entry with no tier — a hand-edited key, a write truncated by
    // a quota error, an entry merged from an older backup — threw and killed the
    // ticker permanently. Entries with no usable name or tier go; the rest get
    // their missing fields filled.
    fix: v => v
      .filter(isObj)
      .map(e => ({
        name: trimmed(e.name).slice(0, MAX_NAME),
        tier: trimmed(e.tier).toUpperCase(),
        tierClass: trimmed(e.tierClass) || "rarity-common",
        emoji: trimmed(e.emoji) || "🏆",
        date: /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : ""
      }))
      .filter(e => e.name && e.tier)
      .slice(-MAX_HOF)
  },
  {
    name: "prompts", key: "np_prompts", group: "prefs", wire: "json",
    label: "Task prompts", blank: () => [],
    ok: Array.isArray,
    fix: v => v.map(p => trimmed(p).slice(0, 300)).filter(Boolean).slice(0, MAX_PROMPTS)
  },
  {
    name: "options", key: "np_options", group: "prefs", wire: "json",
    label: "Options", blank: () => ({ ...OPTION_DEFAULTS }),
    ok: isObj,
    // Every option added after this key ships arrives here as a fill-in, which
    // is why the defaults are one object rather than eleven checked attributes.
    fix: v => {
      const out = { ...OPTION_DEFAULTS };
      for (const [k, def] of Object.entries(OPTION_DEFAULTS)) {
        const got = v[k];
        if (got === undefined || got === null) continue;
        if (typeof def === "boolean") out[k] = !!got;
        else if (typeof def === "number") {
          const n = Number(got);
          if (Number.isFinite(n)) out[k] = n;
        } else if (isStr(def) && isStr(got)) out[k] = got.slice(0, 40);
      }
      out.multi = Math.min(10, Math.max(1, Math.floor(out.multi)));
      out.groups = Math.min(12, Math.max(2, Math.floor(out.groups)));
      out.speed = Math.min(500, Math.max(40, Math.floor(out.speed)));
      return out;
    }
  },
  {
    name: "theme", key: "np_theme", group: "prefs", wire: "raw",
    label: "Theme", blank: () => "default",
    ok: isStr, fix: v => trimmed(v).slice(0, 40) || "default"
  },
  { ...FLAG, name: "crazy", key: "np_crazy", label: "Let's Go Crazy" },
  { ...FLAG, name: "luckyEnabled", key: "np_lucky_enabled", label: "Lucky student enabled" },
  { ...FLAG, name: "retroActive", key: "np_retro_active", label: "Retro theme on" },
  { ...FLAG, name: "retroUnlocked", key: "np_retro_unlocked", label: "Retro theme unlocked" }
];

export const GROUPS = {
  roster: { label: "Rosters and names", student: true },
  records: { label: "Pick counts, history and Hall of Fame", student: true },
  prefs: { label: "Themes, prompts, options and unlocks", student: false }
};

const byName = new Map(KEYS.map(d => [d.name, d]));
const identity = v => v;
const decodeOf = d => d.decode || identity;
const encodeOf = d => d.encode || identity;

/**
 * Present a stored value to gvb-save boxed as `{value: …}` and unbox it on the
 * way back out, so what lands in localStorage keeps the exact shape the old
 * build wrote. Without this, `save()` spreads `__v` into the state — harmless
 * for the object-valued keys, destructive for the four array-valued ones.
 *
 * Garbage is handed straight through rather than boxed: gvb-save's `load()`
 * already wraps `JSON.parse` in a try/catch and returns null, and letting it do
 * that instead of doing it here again is the point of adopting the module.
 *
 * The try/catch around `base.getItem` is not belt-and-braces. gvb-save's
 * `load()` guards `JSON.parse` but calls `store.getItem(key)` bare, so a storage
 * object that throws on read propagates out through `load()` — the one storage
 * touch in the module that is not guarded (`save` guards setItem, `reset` guards
 * removeItem). Its own `defaultStorage()` probe hides this, because a browser
 * that blocks storage fails the setItem probe and gets swapped for a memory
 * stub before any read happens. An injected storage does not get that treatment.
 * Guarded here rather than there; there is a Shared-file request in the session
 * notes for the one-line fix in `load()`.
 */
export function boxed(base, wire) {
  const read = k => { try { return base.getItem(k); } catch (e) { return null; } };
  return {
    getItem(k) {
      const raw = read(k);
      if (raw === null || raw === undefined) return null;
      if (wire === "raw") return JSON.stringify({ value: String(raw) });
      try { return JSON.stringify({ value: JSON.parse(raw) }); }
      catch (e) { return String(raw); }
    },
    setItem(k, json) {
      const box = JSON.parse(json);          // always something we serialized
      base.setItem(k, wire === "raw" ? String(box.value) : JSON.stringify(box.value));
    },
    removeItem(k) { try { base.removeItem(k); } catch (e) { /* nothing to undo */ } },
    get __memoryOnly() {
      try { return !!base.__memoryOnly; } catch (e) { return true; }
    }
  };
}

/** localStorage-shaped, backed by a Map. Used for the export-only bundle slot. */
export function memoryStorage() {
  const mem = new Map();
  return {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: k => mem.delete(k),
    __memoryOnly: true
  };
}

/** Run every descriptor's validate+repair over a disk-shaped `{np_key: value}`. */
export function fixBundle(state) {
  if (!isObj(state)) return {};
  const out = {};
  for (const d of KEYS) {
    const got = state[d.key];
    if (got === undefined) continue;
    try { if (d.ok(got)) out[d.key] = d.fix(got); }
    catch (e) { /* one unusable key is not a reason to refuse the whole file */ }
  }
  return out;
}

/**
 * Lift the hand-rolled backup format the tool shipped with (`{version: 2,
 * rosters, currentRoster, stats, history, prompts, hallOfFame, theme}`) onto the
 * np_ keys, so old backups on a teacher's hard drive still import.
 *
 * This is `migrate`, not `repair`: version-specific reshaping that runs only on
 * files predating the envelope (locked decision #37). Those files carry
 * `version: 2` but no `format`, so gvb-save reads them as version 0 and hands
 * the whole object here.
 */
export function liftLegacyBackup(state) {
  if (!isObj(state)) return state;
  if (KEYS.some(d => state[d.key] !== undefined)) return state;  // already np_ keyed
  const out = {};
  const move = (from, key) => { if (state[from] !== undefined) out[key] = state[from]; };
  move("rosters", "np_rosters");
  move("currentRoster", "np_current");
  move("stats", "np_stats");
  move("history", "np_history");
  move("prompts", "np_prompts");
  move("hallOfFame", "np_hof");
  move("theme", "np_theme");
  return out;
}

/**
 * The whole storage surface of the Name Picker.
 *
 * Nothing outside this file touches localStorage. `storage` is injectable so the
 * Node suite can drive it, and left alone it goes through gvb-save's
 * `defaultStorage()`, which probes with a write and hands back a memory stub
 * when the browser blocks storage. Reading the `localStorage` property throws
 * outright in that configuration, and that is what none of the old forty-six
 * call sites survived.
 */
export function createStore(options = {}) {
  const base = options.storage || defaultStorage();
  const slots = new Map();

  for (const d of KEYS) {
    slots.set(d.name, createSaveSlot({
      game: GAME,
      key: d.key,
      version: SLOT_VERSION,
      storage: boxed(base, d.wire),
      defaults: () => ({ value: d.blank() }),
      validate: s => { try { return d.ok(s.value); } catch (e) { return false; } },
      repair: s => ({ value: d.fix(s.value) })
    }));
  }

  // Export/import only. Given a memory stub so it can never become key thirteen.
  const bundle = createSaveSlot({
    game: GAME,
    key: "np_bundle",
    version: BUNDLE_VERSION,
    storage: memoryStorage(),
    defaults: () => ({}),
    validate: isObj,
    migrate: (s, from) => (from < BUNDLE_VERSION ? liftLegacyBackup(s) : s),
    repair: fixBundle
  });

  const desc = name => {
    const d = byName.get(name);
    if (!d) throw new Error(`np-store: no such key "${name}"`);
    return d;
  };

  /** The stored disk value, repaired, or the default. */
  function raw(name) {
    const d = desc(name);
    const box = slots.get(name).load();
    return box && box.value !== undefined ? box.value : d.blank();
  }

  /** App-shaped value. Never throws; never returns undefined. */
  function get(name) { return decodeOf(desc(name))(raw(name)); }

  /** Returns false when the write did not stick (quota, blocked storage). */
  function set(name, value) {
    return slots.get(desc(name).name).save({ value: encodeOf(desc(name))(value) });
  }

  /** Write an already-disk-shaped value. Used by restore(). */
  function setRaw(name, diskValue) {
    return slots.get(desc(name).name).save({ value: diskValue });
  }

  function clear(name) { slots.get(desc(name).name).reset(); return name; }

  /** Erase one group. `clearGroup('roster')` leaves the retro unlock alone. */
  function clearGroup(group) {
    return KEYS.filter(d => d.group === group).map(d => clear(d.name));
  }

  /** Every key holding a student name. What the UI's clear button erases. */
  function clearStudentData() {
    return [...clearGroup("roster"), ...clearGroup("records")];
  }

  function clearAll() { return KEYS.map(d => clear(d.name)); }

  /** Disk-shaped `{np_key: value}` for everything currently stored. */
  function snapshot() {
    const out = {};
    for (const d of KEYS) out[d.key] = raw(d.name);
    return out;
  }

  /** How many student names each group holds, so the UI can state it plainly. */
  function census() {
    const rosters = get("rosters");
    const distinct = new Set();
    for (const list of Object.values(rosters)) list.forEach(n => distinct.add(n));
    get("current").forEach(n => distinct.add(n));
    return {
      rosters: Object.keys(rosters).length,
      names: distinct.size,
      tracked: Object.keys(get("stats")).length,
      history: get("history").length,
      hof: get("hof").length
    };
  }

  /**
   * Take a bundle. `merge` adds to what is there (stats counts sum, rosters of
   * the same name are overwritten, history and Hall of Fame append) and leaves
   * settings alone; without it the file replaces every key it carries. Returns
   * the keys actually written.
   */
  function restore(state, { merge = true } = {}) {
    const incoming = fixBundle(state);
    const wrote = [];
    for (const d of KEYS) {
      let value = incoming[d.key];
      if (value === undefined) continue;
      if (merge) {
        if (d.name === "rosters") value = { ...raw("rosters"), ...value };
        else if (d.name === "stats") {
          const acc = { ...raw("stats") };
          for (const [n, c] of Object.entries(value)) acc[n] = (acc[n] || 0) + c;
          value = acc;
        } else if (d.name === "history") value = [...raw("history"), ...value].slice(-MAX_HISTORY);
        else if (d.name === "hof") value = [...raw("hof"), ...value].slice(-MAX_HOF);
        else if (d.name === "prompts") {
          if (raw("prompts").length) continue;   // never overwrite a teacher's own list
        } else if (d.group === "prefs") continue; // an import does not change settings
      }
      if (setRaw(d.name, value)) wrote.push(d.key);
    }
    return wrote;
  }

  /** The filename says what the file is, because it is a list of student names. */
  function exportName(today) {
    return `name-picker-roster-backup-${today}.json`;
  }

  return {
    get, set, raw, setRaw, clear, clearGroup, clearStudentData, clearAll,
    snapshot, restore, census, exportName,
    keys: KEYS, groups: GROUPS, bundle,
    serialize: state => bundle.serialize(state),
    deserialize: text => bundle.deserialize(text),
    get memoryOnly() { return !!base.__memoryOnly; }
  };
}

export default {
  createStore, KEYS, GROUPS, OPTION_DEFAULTS,
  liftLegacyBackup, fixBundle, boxed, memoryStorage
};
