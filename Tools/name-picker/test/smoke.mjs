// smoke.mjs — node Tools/name-picker/test/smoke.mjs
//
// Plain-Node suite for the Name Picker's storage and picking logic, same shape as
// the rest of the site: a tiny assert() counter, no framework, non-zero exit on
// any failure (locked decision #13).
//
// The two things it exists to hold down:
//
//   Storage. Twelve keys and forty-six hand-rolled call sites, four of them a
//   bare JSON.parse with no guard. §"corrupt np_rosters" reintroduces that bug
//   and proves it throws before proving the store survives it — locked decision
//   #34 says you verify a guard-rail by putting the bug back.
//
//   Picking. Fairness is the tool's entire job and nothing checked it. The
//   distribution sections below run real draw counts rather than eyeballing.
//
// Every name in here is fabricated. No real student names go in this repo.

import {
  createStore, KEYS, OPTION_DEFAULTS, liftLegacyBackup, fixBundle, memoryStorage
} from "../np-store.js";
import {
  shuffle, freshRotation, fairPick, uniformPick, pickMany, makeGroups, leastPicked
} from "../np-pick.js";
import { report, overdue, summaryLine, daysBetween, shiftDay, dayKey } from "../np-equity.js";
import { DETAILS_KEY, loadDetails, parseDetails, lookupDetail, displayName } from "../np-details.js";

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) pass++;
  else { fail++; console.error("FAIL: " + msg); }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

/** localStorage stub whose contents can be inspected byte for byte. */
function stubStorage(seed = {}) {
  const mem = new Map(Object.entries(seed));
  return {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: k => mem.delete(k),
    _dump: () => Object.fromEntries(mem),
    _has: k => mem.has(k)
  };
}

/** Deterministic rng: a 32-bit LCG. Same sequence every run, so a distribution
    assertion cannot pass or fail on luck (locked decision #40). */
function seeded(seed = 12345) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const CLASS_OF_28 = [
  "Aiden Alvarez", "Brooklyn Bell", "Camila Castro", "Declan Doyle",
  "Elena Espinoza", "Finn Fletcher", "Grace Gallagher", "Hassan Haddad",
  "Isabel Ibarra", "Jonah Jennings", "Kaia Kowalski", "Liam Lindqvist",
  "Maya Mensah", "Nolan Nakamura", "Olivia Okonkwo", "Priya Patel",
  "Quinn Quintero", "Rosa Reyes", "Silas Sandoval", "Tessa Thornton",
  "Umar Usman", "Violet Vance", "Wyatt Whitfield", "Ximena Xiong",
  "Yusuf Yilmaz", "Zoe Zaman", "Amara Adebayo", "Bruno Baptiste"
];

/* A realistic set of all twelve keys exactly as the old build wrote them. This
   is the "prove existing data still loads" fixture — every value here is in the
   pre-gvb-save on-disk format, with no version stamp anywhere. */
const LEGACY_DISK = {
  np_rosters: JSON.stringify({
    "Period 3": CLASS_OF_28.slice(0, 24),
    "Period 5 Honors": CLASS_OF_28.slice(4),
    "Period 7 Academic": CLASS_OF_28.slice(0, 19)
  }),
  np_current: JSON.stringify(CLASS_OF_28.slice(0, 24)),
  np_stats: JSON.stringify(Object.fromEntries(CLASS_OF_28.slice(0, 24).map((n, i) => [n, i % 5]))),
  np_history: JSON.stringify([
    { name: "Aiden Alvarez", time: "09:14" },
    { name: "Rosa Reyes", time: "09:16" }
  ]),
  np_prompts: JSON.stringify(["Read the next paragraph aloud", "Name the cause AND the effect"]),
  np_hof: JSON.stringify([
    { name: "Priya Patel", tier: "MYTHIC", tierClass: "rarity-mythic", emoji: "✨", date: "2026-05-04" }
  ]),
  np_lucky: JSON.stringify({ name: "Finn Fletcher", date: "2026-05-04" }),
  np_theme: "medieval",
  np_crazy: "1",
  np_lucky_enabled: "1",
  np_retro_active: "0",
  np_retro_unlocked: "1"
};

console.log("name-picker smoke\n");

/* =====================================================================
   Existing data still loads — all twelve keys, unversioned, untouched
   ===================================================================== */
{
  const base = stubStorage({ ...LEGACY_DISK });
  const store = createStore({ storage: base });

  assert(Object.keys(store.get("rosters")).length === 3, "three legacy rosters load");
  assert(store.get("rosters")["Period 5 Honors"].length === 24, "roster contents survive");
  assert(store.get("current").length === 24, "np_current loads as an array");
  assert(Array.isArray(store.get("history")) && store.get("history").length === 2, "np_history stays an array");
  assert(store.get("history")[0].name === "Aiden Alvarez", "history entries keep their fields");
  assert(store.get("prompts").length === 2, "np_prompts stays an array");
  assert(store.get("hof")[0].tier === "MYTHIC", "Hall of Fame entry loads");
  assert(store.get("stats")["Brooklyn Bell"] === 1, "pick counts load as numbers");
  assert(store.get("lucky").name === "Finn Fletcher", "lucky student loads");
  assert(store.get("theme") === "medieval", "np_theme loads from a bare string");
  assert(store.get("crazy") === true, "np_crazy '1' decodes to true");
  assert(store.get("luckyEnabled") === true, "np_lucky_enabled '1' decodes to true");
  assert(store.get("retroActive") === false, "np_retro_active '0' decodes to false");
  assert(store.get("retroUnlocked") === true, "the retro unlock survives — it is an earned thing");
  assert(KEYS.length === 14, "twelve original keys plus np_options plus np_absent");
  assert(KEYS.filter(d => LEGACY_DISK[d.key] !== undefined).length === 12,
         "all twelve original keys are covered by a descriptor");
}

/* =====================================================================
   The on-disk format does not change. This is the promise that makes
   adoption safe: a rollback to the old build still finds its data.
   ===================================================================== */
{
  const base = stubStorage({ ...LEGACY_DISK });
  const store = createStore({ storage: base });

  store.set("theme", "byzantine");
  assert(base.getItem("np_theme") === "byzantine",
         "np_theme is still a bare string on disk, not JSON, not wrapped");

  store.set("crazy", false);
  assert(base.getItem("np_crazy") === "0", "np_crazy is still '0' / '1' on disk");

  store.set("history", [{ name: "Zoe Zaman", time: "10:02" }]);
  const onDisk = base.getItem("np_history");
  assert(onDisk.startsWith("[") && JSON.parse(onDisk).length === 1,
         "np_history is still a JSON array on disk — gvb-save's __v did not turn it into an object");
  assert(!/"__v"/.test(onDisk), "no version stamp leaks into np_history");

  store.set("rosters", { "Period 1": ["Maya Mensah"] });
  assert(!/"__v"/.test(base.getItem("np_rosters")), "no version stamp leaks into np_rosters");

  store.set("current", CLASS_OF_28.slice(0, 3));
  assert(JSON.parse(base.getItem("np_current")).length === 3, "np_current round-trips as an array");

  assert(!base._has("np_bundle"), "the export bundle never becomes a thirteenth stored key");
}

/* =====================================================================
   Corrupt np_rosters — the bug from task one, reintroduced then fixed
   ===================================================================== */
{
  const GARBAGE = '{"Period 3":["Aiden Alvarez"';   // truncated write, quota mid-save

  // The old code, verbatim, against the same bad value.
  let threw = false;
  try { JSON.parse(GARBAGE || "{}"); } catch (e) { threw = true; }
  assert(threw, "the old unguarded read really does throw on a truncated np_rosters");

  const base = stubStorage({ ...LEGACY_DISK, np_rosters: GARBAGE });
  const store = createStore({ storage: base });
  let survived = true, rosters = null;
  try { rosters = store.get("rosters"); } catch (e) { survived = false; }
  assert(survived, "the store does not throw on a truncated np_rosters");
  assert(rosters && Object.keys(rosters).length === 0, "it hands back an empty roster set instead");
  assert(store.get("current").length === 24, "a corrupt np_rosters does not take the other keys with it");

  // Not JSON at all, and a value of the wrong type.
  for (const bad of ["undefined", "", "[]", "42", '"a string"', "null"]) {
    const s = createStore({ storage: stubStorage({ np_rosters: bad }) });
    let ok = true;
    try { s.get("rosters"); } catch (e) { ok = false; }
    assert(ok, `np_rosters = ${JSON.stringify(bad)} is refused, not thrown on`);
  }

  // A roster whose value is not an array — the one that crashed
  // loadRosterByName() with rosters[name].join(). The other rosters survive.
  const mixed = createStore({
    storage: stubStorage({
      np_rosters: JSON.stringify({ "Period 3": 5, "Period 4": ["Rosa Reyes", "Silas Sandoval"] })
    })
  });
  const kept = mixed.get("rosters");
  assert(!("Period 3" in kept), "a roster that is not a list of names is dropped");
  assert(kept["Period 4"].length === 2, "the healthy roster beside it is kept");
  for (const list of Object.values(kept)) {
    assert(Array.isArray(list) && list.every(n => typeof n === "string"),
           "every roster the store returns is a list of strings, so .join() is safe");
  }
}

/* =====================================================================
   Corrupt everything else
   ===================================================================== */
{
  const store = createStore({
    storage: stubStorage({
      np_stats: JSON.stringify({ "Maya Mensah": "not a number", "Rosa Reyes": 4, "": 9, "__v": 1 }),
      np_history: JSON.stringify([null, 7, { name: "Quinn Quintero" }, { time: "09:00" }]),
      np_hof: JSON.stringify([{ name: "Nolan Nakamura" }, { name: "Priya Patel", tier: "epic" }]),
      np_prompts: JSON.stringify(["  ", "Define the vocab word", 42]),
      np_lucky: JSON.stringify({ name: "Tessa Thornton" }),
      np_current: JSON.stringify(["Maya Mensah", "Maya Mensah", "  ", 7, "Rosa Reyes"]),
      np_options: JSON.stringify({ speed: 9000, multi: 99, fair: 0, mode: "slot", nonsense: true })
    })
  });

  const stats = store.get("stats");
  assert(stats["Maya Mensah"] === 0, "a non-numeric pick count becomes 0, not NaN");
  assert(stats["Rosa Reyes"] === 4, "a good count is left alone");
  assert(!("" in stats), "an empty name is dropped from stats");
  assert(!("__v" in stats), "a stray __v never shows up as a student");
  for (const v of Object.values(stats)) assert(Number.isFinite(v), "every stat count is finite");

  const hist = store.get("history");
  assert(hist.length === 1 && hist[0].name === "Quinn Quintero", "unusable history rows are dropped");
  assert(hist[0].time === "", "a missing time becomes an empty string, never undefined");

  // The repair that matters: updateHofTicker() calls e.tier.toLowerCase() on
  // every entry, so an entry with no tier used to throw and kill the ticker.
  const hof = store.get("hof");
  assert(hof.length === 1 && hof[0].tier === "EPIC", "a Hall of Fame entry with no tier is dropped");
  for (const e of hof) {
    assert(typeof e.tier === "string" && e.tier.length > 0, "every HoF entry has a usable tier");
    assert(typeof e.emoji === "string" && e.emoji.length > 0, "every HoF entry has an emoji");
    assert(typeof e.tierClass === "string", "every HoF entry has a tier class");
  }

  assert(store.get("prompts").length === 1, "blank and non-string prompts are dropped");
  assert(store.get("lucky") === null, "a lucky student with no date is refused");
  assert(store.get("current").length === 2, "duplicate and blank names are cleaned out of the roster");

  const opts = store.get("options");
  assert(opts.speed === 500, "an out-of-range speed is clamped, not rejected");
  assert(opts.multi === 10, "an out-of-range multi-pick count is clamped");
  assert(opts.fair === false, "a falsy option coerces to boolean");
  assert(opts.mode === "slot", "a good option value is kept");
  assert(opts.groups === OPTION_DEFAULTS.groups, "a missing option is filled from the defaults");
  assert(!("nonsense" in opts), "an unknown option is not carried through");
}

/* =====================================================================
   np_options as the "field added after shipping" case
   ===================================================================== */
{
  // Exactly what a machine that used the tool before `fair` existed has on disk.
  const store = createStore({
    storage: stubStorage({ np_options: JSON.stringify({ sound: false, coldCall: true }) })
  });
  const opts = store.get("options");
  assert(opts.sound === false && opts.coldCall === true, "the options that were stored are kept");
  assert(opts.fair === true, "an option added since is filled in by repair, not left undefined");
  assert(Object.keys(opts).length === Object.keys(OPTION_DEFAULTS).length,
         "every option is present after a load, whatever was on disk");
}

/* =====================================================================
   Storage blocked outright
   ===================================================================== */
{
  // Chrome with site data blocked: touching the property throws, not just
  // setItem. None of the old forty-six call sites survived this.
  const hostile = {
    getItem() { throw new DOMExceptionish(); },
    setItem() { throw new DOMExceptionish(); },
    removeItem() { throw new DOMExceptionish(); }
  };
  function DOMExceptionish() { return new Error("The operation is insecure."); }

  let built = true, store = null;
  try { store = createStore({ storage: hostile }); } catch (e) { built = false; }
  assert(built, "the store is constructible when storage throws");

  let ran = true;
  try {
    store.get("rosters");
    store.get("options");
    store.set("theme", "space");
    store.snapshot();
  } catch (e) { ran = false; }
  assert(ran, "reads and writes against throwing storage do not take the page down");
  assert(Object.keys(store.get("rosters")).length === 0, "a blocked read reads as empty");

  // gvb-save's own probe path: no localStorage at all in Node.
  const fallback = createStore();
  assert(fallback.memoryOnly === true, "with no localStorage the store reports memoryOnly");
  fallback.set("current", ["Amara Adebayo"]);
  assert(fallback.get("current")[0] === "Amara Adebayo", "the memory fallback still round-trips");
}

/* =====================================================================
   Export / import round trip
   ===================================================================== */
{
  const base = stubStorage({ ...LEGACY_DISK });
  const store = createStore({ storage: base });

  const text = store.serialize(store.snapshot());
  const env = JSON.parse(text);
  assert(env.format === "gvb-save", "the export carries the shared envelope");
  assert(env.game === "name-picker", "the export names the tool");
  assert(env.version === 3, "the export version follows on from the old backup format's 2");
  assert(typeof env.savedAt === "string", "the export is stamped");
  assert(store.exportName("2026-07-28") === "name-picker-roster-backup-2026-07-28.json",
         "the filename says the file holds a roster");

  // Wipe everything, then bring it back from the file.
  store.clearAll();
  assert(Object.keys(store.get("rosters")).length === 0, "clearAll() really clears");
  assert(store.get("theme") === "default", "clearAll() takes the theme back to default");

  const back = store.deserialize(text);
  assert(back !== null, "the exported file deserializes");
  const wrote = store.restore(back, { merge: false });
  assert(wrote.length === KEYS.length, "every key in the bundle comes back");
  for (const d of KEYS.filter(k => LEGACY_DISK[k.key] !== undefined)) {
    assert(wrote.includes(d.key), `${d.key} is among the keys restored`);
  }
  assert(Object.keys(store.get("rosters")).length === 3, "the three rosters are back");
  assert(store.get("rosters")["Period 3"].length === 24, "with their names intact");
  assert(store.get("stats")["Brooklyn Bell"] === 1, "and the pick counts");
  assert(store.get("theme") === "medieval", "and the theme");
  assert(store.get("retroUnlocked") === true, "and the retro unlock");
  assert(store.get("hof")[0].tier === "MYTHIC", "and the Hall of Fame");

  // Rubbish and wrong-game files are refused, not loaded.
  assert(store.deserialize("not json at all") === null, "a non-JSON file is refused");
  assert(store.deserialize("[1,2,3]") === null, "a JSON array is refused");
  const wrongGame = JSON.stringify({ ...env, game: "fourth-quarter" });
  assert(store.deserialize(wrongGame) === null, "another game's save file is refused");
}

/* =====================================================================
   Merge import, and the old hand-rolled backup format
   ===================================================================== */
{
  const base = stubStorage({
    np_rosters: JSON.stringify({ "Period 3": ["Aiden Alvarez"] }),
    np_stats: JSON.stringify({ "Aiden Alvarez": 5 }),
    np_prompts: JSON.stringify(["My own prompt"]),
    np_theme: "ocean"
  });
  const store = createStore({ storage: base });

  const incoming = {
    np_rosters: { "Period 9": ["Zoe Zaman", "Yusuf Yilmaz"] },
    np_stats: { "Aiden Alvarez": 3, "Zoe Zaman": 2 },
    np_prompts: ["Imported prompt"],
    np_theme: "halloween"
  };
  store.restore(incoming, { merge: true });
  assert(Object.keys(store.get("rosters")).length === 2, "a merge adds rosters rather than replacing");
  assert(store.get("stats")["Aiden Alvarez"] === 8, "a merge sums pick counts");
  assert(store.get("stats")["Zoe Zaman"] === 2, "a merge brings new students' counts across");
  assert(store.get("prompts")[0] === "My own prompt", "a merge does not overwrite the teacher's own prompts");
  assert(store.get("theme") === "ocean", "a merge does not reach in and change settings");

  // An empty prompt list is the one settings case a merge will fill.
  const fresh = createStore({ storage: stubStorage({}) });
  fresh.restore({ np_prompts: ["Imported prompt"] }, { merge: true });
  assert(fresh.get("prompts")[0] === "Imported prompt", "a merge does fill an empty prompt list");
}

{
  // A version-2 backup file written by the build that shipped. These carry
  // `version: 2` but no `format`, so gvb-save reads them as version 0 and hands
  // the whole object to migrate.
  const legacyFile = JSON.stringify({
    version: 2,
    exported: "2026-03-11T14:02:11.000Z",
    rosters: { "Period 3": ["Camila Castro", "Declan Doyle"] },
    currentRoster: ["Camila Castro", "Declan Doyle"],
    stats: { "Camila Castro": 7 },
    history: [{ name: "Declan Doyle", time: "11:40" }],
    prompts: ["Summarize the last section"],
    hallOfFame: [{ name: "Camila Castro", tier: "RARE", emoji: "🔵", date: "2026-03-11" }],
    theme: "forest"
  });

  const store = createStore({ storage: stubStorage({}) });
  const state = store.deserialize(legacyFile);
  assert(state !== null, "a version-2 backup file still imports");
  assert(state.np_rosters["Period 3"].length === 2, "its rosters land on np_rosters");
  assert(state.np_current.length === 2, "currentRoster lands on np_current");
  assert(state.np_stats["Camila Castro"] === 7, "its stats land on np_stats");
  assert(state.np_hof[0].tier === "RARE", "its Hall of Fame lands on np_hof");
  assert(state.np_theme === "forest", "its theme lands on np_theme");

  store.restore(state, { merge: false });
  assert(store.get("rosters")["Period 3"][1] === "Declan Doyle", "and the whole thing writes through");

  // The lift is idempotent and leaves a modern bundle alone.
  const modern = { np_rosters: { "Period 1": ["Rosa Reyes"] } };
  assert(liftLegacyBackup(modern).np_rosters === modern.np_rosters, "a modern bundle passes through untouched");
  assert(Object.keys(fixBundle({ nonsense: 1 })).length === 0, "unknown keys never enter the store");
}

/* =====================================================================
   Groups: clearing student data must not clear the earned retro theme
   ===================================================================== */
{
  const base = stubStorage({ ...LEGACY_DISK });
  const store = createStore({ storage: base });

  const before = store.census();
  assert(before.rosters === 3, "census counts rosters");
  assert(before.names === 28, "census counts distinct student names across every roster");
  assert(before.tracked === 24, "census counts students with pick counts");

  const cleared = store.clearStudentData();
  assert(cleared.length === 7, "seven keys hold student names: rosters, current, lucky, absent, stats, history, hof");
  assert(cleared.includes("lucky"), "np_lucky counts as student data — it stores a name");

  const after = store.census();
  assert(after.names === 0 && after.tracked === 0 && after.history === 0 && after.hof === 0,
         "no student names are left anywhere after clearStudentData()");
  assert(store.get("lucky") === null, "the lucky student is gone");
  assert(store.get("theme") === "medieval", "the theme survives a student-data wipe");
  assert(store.get("retroUnlocked") === true, "so does the retro unlock — it is not student data");
  assert(store.get("prompts").length === 2, "so do the teacher's own task prompts");

  // And every key that holds a name is actually gone from the browser.
  for (const d of KEYS.filter(k => k.group !== "prefs")) {
    assert(base.getItem(d.key) === null, `${d.key} is removed from storage, not just emptied`);
  }
  const leftover = JSON.stringify(base._dump());
  for (const n of CLASS_OF_28) {
    assert(!leftover.includes(n), `no trace of ${n.split(" ")[0]} is left in storage`);
  }
}

/* =====================================================================
   Fair picking — the tool's actual job
   ===================================================================== */
{
  const rng = seeded(7);
  let state = freshRotation();
  const counts = Object.fromEntries(CLASS_OF_28.map(n => [n, 0]));
  let backToBack = 0, prev = null;

  // Ten full rounds of twenty-eight.
  for (let round = 0; round < 10; round++) {
    const thisRound = [];
    for (let i = 0; i < CLASS_OF_28.length; i++) {
      const step = fairPick(state, CLASS_OF_28, rng);
      state = step.state;
      counts[step.name]++;
      thisRound.push(step.name);
      if (step.name === prev) backToBack++;
      prev = step.name;
    }
    assert(new Set(thisRound).size === 28,
           `round ${round + 1}: every student called exactly once before anyone twice`);
  }
  const values = Object.values(counts);
  assert(Math.min(...values) === 10 && Math.max(...values) === 10,
         "after ten rounds of 28 every student has been called exactly 10 times");
  assert(backToBack === 0, "fair rotation never calls the same student twice in a row");

  // 280 uniform draws for contrast, same rng family.
  const urng = seeded(7);
  const ucounts = Object.fromEntries(CLASS_OF_28.map(n => [n, 0]));
  let ustate = freshRotation();
  for (let i = 0; i < 280; i++) {
    const step = uniformPick(ustate, CLASS_OF_28, urng);
    ustate = step.state;
    ucounts[step.name]++;
  }
  const uvals = Object.values(ucounts);
  assert(Math.max(...uvals) - Math.min(...uvals) >= 6,
         "uniform draws are visibly lumpy over the same number of picks — this is what fair mode fixes");
  console.log(`  fair rotation over 280 picks:  min ${Math.min(...values)}, max ${Math.max(...values)}, spread ${Math.max(...values) - Math.min(...values)}`);
  console.log(`  uniform draws over 280 picks:  min ${Math.min(...uvals)}, max ${Math.max(...uvals)}, spread ${Math.max(...uvals) - Math.min(...uvals)}`);
}

{
  // Uniformity within a round: over many rounds, position 1 should be roughly
  // evenly spread across the roster rather than favouring anybody.
  const rng = seeded(99);
  const first = Object.fromEntries(CLASS_OF_28.map(n => [n, 0]));
  const ROUNDS = 28000;
  for (let r = 0; r < ROUNDS; r++) {
    const step = fairPick(freshRotation(), CLASS_OF_28, rng);
    first[step.name]++;
  }
  const expected = ROUNDS / 28;
  const worst = Math.max(...Object.values(first).map(c => Math.abs(c - expected)));
  assert(worst < expected * 0.15,
         `the first pick of a round is uniform across 28 names (worst deviation ${worst} of ${expected})`);
  console.log(`  first-pick uniformity over ${ROUNDS} rounds: expected ${expected}, worst deviation ${worst}`);
}

{
  // A roster that changes mid-round: absences and a period change.
  const rng = seeded(4242);
  let state = freshRotation();
  const roster = CLASS_OF_28.slice(0, 6);
  const called = [];
  for (let i = 0; i < 3; i++) {
    const step = fairPick(state, roster, rng);
    state = step.state;
    called.push(step.name);
  }
  // Two of the six go absent, one of them already called.
  const present = roster.filter(n => n !== roster[0] && n !== roster[5]);
  const rest = [];
  for (let i = 0; i < present.length; i++) {
    const step = fairPick(state, present, rng);
    state = step.state;
    rest.push(step.name);
  }
  assert(rest.every(n => present.includes(n)), "an absent student is never called");
  const dueStill = present.filter(n => !called.includes(n));
  assert(dueStill.every(n => rest.includes(n)),
         "students who had not had a turn still get one after somebody goes absent");

  // Switching period entirely: nobody from the old roster comes through.
  const other = ["Ximena Xiong", "Yusuf Yilmaz", "Zoe Zaman"];
  const afterSwitch = [];
  for (let i = 0; i < 6; i++) {
    const step = fairPick(state, other, rng);
    state = step.state;
    afterSwitch.push(step.name);
  }
  assert(afterSwitch.every(n => other.includes(n)), "loading a different period does not call the old one");
  assert(new Set(afterSwitch.slice(0, 3)).size === 3, "the new roster gets its own clean round");
}

{
  // Degenerate rosters.
  assert(fairPick(freshRotation(), [], seeded(1)).name === null, "an empty roster picks nobody");
  assert(fairPick(freshRotation(), ["Solo Student"], seeded(1)).name === "Solo Student",
         "a roster of one picks that one");
  let s = freshRotation();
  for (let i = 0; i < 5; i++) { const step = fairPick(s, ["Solo Student"], seeded(1)); s = step.state; }
  assert(s.last === "Solo Student", "a roster of one keeps working, repeats and all");
  assert(fairPick(freshRotation(), [null, 7, "", "Real Name"], seeded(1)).name === "Real Name",
         "junk in the roster is skipped");
}

/* =====================================================================
   Multi-pick spends turns from the same rotation
   ===================================================================== */
{
  const rng = seeded(11);
  let state = freshRotation();
  const seen = new Set();
  for (let i = 0; i < 7; i++) {
    const step = pickMany(state, CLASS_OF_28, 4, { fair: true, rng });
    state = step.state;
    assert(step.names.length === 4, "multi-pick returns the number asked for");
    assert(new Set(step.names).size === 4, "and no duplicates inside one draw");
    step.names.forEach(n => seen.add(n));
  }
  assert(seen.size === 28, "seven picks of four cover the whole class of 28 exactly once");

  const small = pickMany(freshRotation(), ["A Student", "B Student"], 5, { rng: seeded(3) });
  assert(small.names.length === 2, "multi-pick cannot return more names than the roster holds");
  assert(pickMany(freshRotation(), [], 3, { rng: seeded(3) }).names.length === 0,
         "multi-pick on an empty roster returns nothing");
}

/* =====================================================================
   Shuffle and groups
   ===================================================================== */
{
  // The old comparator shuffle is not a shuffle. Both are measured rather than
  // asserted from theory.
  const TRIALS = 20000;
  const list = ["a", "b", "c", "d", "e", "f"];

  const badFirst = Object.fromEntries(list.map(n => [n, 0]));
  const brng = seeded(5);
  for (let i = 0; i < TRIALS; i++) badFirst[list.slice().sort(() => brng() - 0.5)[0]]++;

  const goodFirst = Object.fromEntries(list.map(n => [n, 0]));
  const grng = seeded(5);
  for (let i = 0; i < TRIALS; i++) goodFirst[shuffle(list, grng)[0]]++;

  const expected = TRIALS / list.length;
  const badWorst = Math.max(...Object.values(badFirst).map(c => Math.abs(c - expected)));
  const goodWorst = Math.max(...Object.values(goodFirst).map(c => Math.abs(c - expected)));
  assert(badWorst > expected * 0.2, `sort(()=>Math.random()-0.5) is measurably biased (worst deviation ${badWorst} of ${expected})`);
  assert(goodWorst < expected * 0.08, `Fisher-Yates is not (worst deviation ${goodWorst} of ${expected})`);
  console.log(`  shuffle bias, position 1 of 6 over ${TRIALS} shuffles: comparator worst ${badWorst}, Fisher-Yates worst ${goodWorst} (expected ${expected})`);

  assert(shuffle(list, seeded(2)).length === 6, "shuffle keeps every element");
  assert(shuffle(list, seeded(2)).slice().sort().join() === list.slice().sort().join(),
         "shuffle is a permutation, not a filter");
  const orig = ["x", "y", "z"];
  shuffle(orig, seeded(2));
  assert(orig.join() === "x,y,z", "shuffle does not mutate its input");
}

{
  const groups = makeGroups(CLASS_OF_28, 4, seeded(8));
  assert(groups.length === 4, "four groups requested, four returned");
  const sizes = groups.map(g => g.length);
  assert(Math.max(...sizes) - Math.min(...sizes) <= 1, "group sizes differ by at most one");
  assert(sizes.reduce((a, b) => a + b, 0) === 28, "everybody is in exactly one group");
  const flat = groups.flat();
  assert(new Set(flat).size === 28, "nobody is in two groups");

  const odd = makeGroups(CLASS_OF_28.slice(0, 27), 4, seeded(8)).map(g => g.length);
  assert(Math.max(...odd) - Math.min(...odd) <= 1, "27 into 4 still differs by at most one");
  assert(makeGroups(CLASS_OF_28, 1, seeded(8)).length === 2, "a group count below 2 is clamped to 2");
}

/* =====================================================================
   leastPicked — reading the stats back, which nothing used to do
   ===================================================================== */
{
  const due = leastPicked(["Aiden Alvarez", "Rosa Reyes", "Zoe Zaman"],
                          { "Aiden Alvarez": 4, "Rosa Reyes": 1, "Zoe Zaman": 1 });
  assert(due.length === 2 && due.includes("Rosa Reyes") && due.includes("Zoe Zaman"),
         "leastPicked finds everyone tied at the bottom");
  assert(leastPicked(["Never Called"], {})[0] === "Never Called", "a student with no count at all is due");
  assert(leastPicked([], {}).length === 0, "no roster, nobody due");
}

/* =====================================================================
   The two additive fields on np_history, and np_absent.

   `prompt` is the regression that matters: the page has always written it and
   the repair silently dropped it, so a question attached to a pick never
   survived a reload. `date` is new, and every entry written before it existed
   has none — the equity view has to treat that as unknown, not as today.
   ===================================================================== */
{
  const store = createStore({ storage: stubStorage() });
  store.set("history", [
    { name: "Aiden Alvarez", time: "09:15 AM" },                                        // pre-date entry
    { name: "Rosa Reyes", time: "09:17 AM", date: "2026-08-10", prompt: "Read aloud" },
    { name: "Zoe Zaman", time: "09:19 AM", date: "not-a-date", prompt: "  " }
  ]);
  const back = store.get("history");
  assert(back.length === 3, "every history entry survives the round trip");
  assert(back[0].date === undefined, "an entry written before dates existed keeps no date");
  assert(back[1].date === "2026-08-10", "a valid date is kept");
  assert(back[1].prompt === "Read aloud", "the prompt attached to a pick survives a reload");
  assert(back[2].date === undefined, "a malformed date is dropped rather than trusted");
  assert(back[2].prompt === undefined, "a blank prompt is not stored");

  const longPrompt = "x".repeat(500);
  store.set("history", [{ name: "Aiden Alvarez", time: "09:15 AM", prompt: longPrompt }]);
  assert(store.get("history")[0].prompt.length === 300, "an outsized prompt is capped, not dropped");
}

{
  const store = createStore({ storage: stubStorage() });
  assert(store.get("absent").names.length === 0 && store.get("absent").date === "",
         "np_absent starts empty");
  store.set("absent", { date: "2026-08-10", names: ["Rosa Reyes", "Rosa Reyes", "  ", "Zoe Zaman"] });
  const a = store.get("absent");
  assert(a.date === "2026-08-10", "the absence date is kept");
  assert(a.names.length === 2, "absent names are de-duplicated and blanks dropped");

  store.set("absent", { date: "yesterday", names: ["Rosa Reyes"] });
  assert(store.get("absent").date === "", "a malformed date reads as no date, so the list is treated as stale");

  const withNames = createStore({ storage: stubStorage() });
  withNames.set("absent", { date: "2026-08-10", names: ["Rosa Reyes"] });
  assert(withNames.clearStudentData().includes("absent"), "erasing student data erases the absent list");
}

/* =====================================================================
   The equity report — the numbers a teacher would be asked to defend.

   Dates are passed in rather than read off the clock, so the "not called in
   three weeks" boundary is checked here instead of three weeks from now.
   ===================================================================== */
{
  const TODAY = "2026-08-10";
  const roster = ["Aiden Alvarez", "Brooklyn Bell", "Rosa Reyes", "Zoe Zaman"];
  const history = [
    { name: "Aiden Alvarez", time: "09:00 AM", date: "2026-08-10" },
    { name: "Aiden Alvarez", time: "09:05 AM", date: "2026-08-10", prompt: "Read aloud" },
    { name: "Aiden Alvarez", time: "09:10 AM", date: "2026-08-09" },
    { name: "Brooklyn Bell", time: "09:15 AM", date: "2026-08-02" },   // 8 days ago
    { name: "Rosa Reyes",    time: "09:20 AM", date: "2026-07-01" },   // 40 days ago
    { name: "Ghost Student", time: "09:25 AM", date: "2026-08-10" },   // no longer on the roster
    { name: "Zoe Zaman",     time: "09:30 AM" }                        // pre-dates the date field
  ];
  const stats = { "Aiden Alvarez": 12, "Brooklyn Bell": 3, "Rosa Reyes": 1, "Zoe Zaman": 5 };

  const week = report(roster, history, stats, { days: 7, today: TODAY });
  assert(week.roster === 4, "the report covers everyone on the roster, not everyone in the log");
  assert(week.windowTotal === 4, "picks inside the window are counted, including students since removed");
  assert(week.undated === 1, "entries with no date are counted separately, not assumed to be today");

  const byName = Object.fromEntries(week.rows.map(r => [r.name, r]));
  assert(byName["Aiden Alvarez"].count === 3, "three picks this week");
  assert(byName["Aiden Alvarez"].daysSince === 0, "called today reads as 0 days since");
  assert(byName["Aiden Alvarez"].withPrompt === 1, "prompts asked are counted");
  assert(byName["Aiden Alvarez"].lifetime === 12, "lifetime comes from np_stats, not the capped history");
  assert(byName["Brooklyn Bell"].count === 0, "a pick 8 days ago is outside a 7-day window ending today");
  assert(byName["Brooklyn Bell"].daysSince === 8, "…but still sets days-since-last-called");
  assert(byName["Rosa Reyes"].daysSince === 40, "a pick 40 days ago is 40 days since");
  assert(byName["Zoe Zaman"].daysSince === null, "an undated pick leaves the student as never-called-on-record");

  assert(week.rows[0].name === "Zoe Zaman", "never-called sorts to the top");
  assert(week.rows[1].name === "Rosa Reyes", "then the longest-overdue student");
  assert(week.rows[week.rows.length - 1].name === "Aiden Alvarez", "the most-called student sorts last");

  const twoWeeks = report(roster, history, stats, { days: 14, today: TODAY });
  assert(twoWeeks.windowTotal === 5, "widening the window picks up Brooklyn's pick 8 days ago");
  assert(Math.abs(twoWeeks.evenShare - 1.25) < 1e-9, "even share is picks ÷ roster size");
  assert(twoWeeks.rows.find(r => r.name === "Aiden Alvarez").versusEven > 0,
         "an over-called student is above an even share");

  const all = report(roster, history, stats, { days: 0, today: TODAY });
  assert(all.from === null && all.windowTotal === 6, "days:0 means every dated pick on record");

  assert(overdue(week.rows, 21).length === 2, "never-called plus 40-days-ago are both overdue at 21 days");
  assert(overdue(week.rows, 5).map(r => r.name).includes("Brooklyn Bell"), "8 days is overdue at a 5-day threshold");

  assert(report([], history, stats, { today: TODAY }).rows.length === 0, "no roster, no rows");
  assert(summaryLine(report([], [], {}, { today: TODAY })) === "No roster loaded.",
         "the summary line says so plainly when there is nothing to report");
  assert(/never called/.test(summaryLine(week)), "the summary line names the never-called count");

  assert(daysBetween("2026-08-01", "2026-08-10") === 9, "daysBetween counts whole days forward");
  assert(daysBetween("nonsense", "2026-08-10") === null, "an unparsable date gives null, not NaN");
  assert(shiftDay("2026-03-01", -1) === "2026-02-28", "shiftDay crosses a month boundary");
  assert(dayKey(new Date(2026, 0, 5)) === "2026-01-05", "dayKey pads to YYYY-MM-DD");
}

/* =====================================================================
   Reading Class Roster Hub's sidecar — the other side of the decision to
   leave np_rosters alone. Every path here has to survive the sidecar being
   absent, truncated, or shaped like something else entirely, because most
   teachers will never have opened that tool.
   ===================================================================== */
{
  const SIDECAR = JSON.stringify({
    version: 1,
    rosters: {
      "Period 3": {
        meta: { period: "3" },
        students: [
          { id: "s1", name: "Aiden Alvarez", preferred: "AJ", say: "AY-den" },
          { id: "s2", name: "Yusuf Yilmaz", preferred: "", say: "yoo-SOOF" },
          { id: "s3", name: "Rosa Reyes", preferred: "", say: "" },
          { id: "s4", name: "Sam Sandoval", preferred: "Sammy", say: "" }
        ]
      },
      "Period 5": {
        meta: {},
        students: [{ id: "s9", name: "Sam Sandoval", preferred: "Sandy", say: "" }]
      }
    }
  });
  const store = stubStorage({ [DETAILS_KEY]: SIDECAR });
  const parsed = loadDetails(store);

  assert(parsed.order.length === 2, "both rosters with details are indexed");
  assert(lookupDetail(parsed, "Aiden Alvarez", "Period 3").preferred === "AJ", "preferred name found");
  assert(lookupDetail(parsed, "  aiden   alvarez ", "Period 3").say === "AY-den",
         "matching ignores case and stray whitespace");
  assert(lookupDetail(parsed, "Rosa Reyes", "Period 3") === null,
         "a student with neither field is not carried at all");
  assert(lookupDetail(parsed, "Nobody Here", "Period 3") === null, "an unknown name gives null");
  assert(lookupDetail(parsed, "Sam Sandoval", "Period 5").preferred === "Sandy",
         "the current roster wins when two classes disagree");
  assert(lookupDetail(parsed, "Sam Sandoval", "Not A Roster").preferred === "Sammy",
         "with no roster match it falls back to whichever roster knows the name");

  const shown = displayName("Aiden Alvarez", lookupDetail(parsed, "Aiden Alvarez", "Period 3"));
  assert(shown.big === "AJ" && shown.sub === "Aiden Alvarez" && shown.say === "AY-den",
         "the preferred name becomes the big name and the roster name the subtitle");
  const plain = displayName("Rosa Reyes", null);
  assert(plain.big === "Rosa Reyes" && plain.sub === "" && plain.say === "",
         "with no detail on file, nothing changes about how the name is shown");
  const sameName = displayName("Rosa Reyes", { preferred: "rosa reyes", say: "" });
  assert(sameName.sub === "", "a preferred name equal to the roster name does not print twice");

  assert(loadDetails(stubStorage()).order.length === 0, "no sidecar at all reads as no details");
  assert(loadDetails(stubStorage({ [DETAILS_KEY]: '{"version":1,"rosters":' })).order.length === 0,
         "a truncated sidecar reads as no details rather than throwing");
  assert(parseDetails('{"version":1,"rosters":{"P1":{"students":"nope"}}}').order.length === 0,
         "a roster whose students are not an array is skipped");
  assert(loadDetails({ getItem() { throw new Error("blocked"); } }).order.length === 0,
         "storage that throws on read is survivable");
}

console.log(`\nname-picker: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
