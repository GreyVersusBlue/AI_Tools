/* crcg-store.js — persistence for the Government/Civics Simulation Role Card
   Generator.

   Storage is a list of named simulations, the same triple-key shape as
   htcm-store.js and the bracket/review-board/formula-sheet stores:
   `crcg:list` (simulation names), `crcg:data:<name>` (one v2 document each),
   `crcg:current` (last-open simulation). Earlier releases stored one flat
   document under `crcg_roles_v1`; on first load that becomes the simulation
   "My simulation", and the legacy key is left in place as a one-release
   backup.

   Schema v2 (the per-simulation document):
     { v: 2,
       title,                                  // printed at the top of kit pages
       roles: [{ id, role, position, copies, students: [String],
                 caseFile, ballot,             // ballot: this role votes
                 points: [{ id, text }] }],
       agenda:   [{ id, name, minutes, cue }],
       ballot:   { title, question, instructions, options: [String],
                   names, extra },
       rubric:   { levels: [String x4], criteria: [{ id, name, top }] },
       reflection: { title, prompts: [{ id, text }] },
       print:    { agenda, cards, caseFiles, ballots, rubric, reflections } }

   repair() runs on every load and fills defaults for every field, so later
   rounds can add fields without a v3 bump. Two deliberate choices about the
   defaults:

   - Kit content defaults to EMPTY (no agenda rows, no ballot options, no
     rubric criteria, no reflection prompts). A simulation migrated from
     `crcg_roles_v1` has no kit, and empty content prints nothing, so an old
     saved role set prints exactly the cards and case files it always did.
     The built-in templates are what supply real kit content.
   - The print toggles all default ON. They are safe to leave on because a
     kit piece with no content prints nothing either way, so the toggles only
     ever subtract from a kit a teacher actually built. */
(function () {
  'use strict';

  var LIST_KEY = 'crcg:list';
  var DATA_PREFIX = 'crcg:data:';
  var CURRENT_KEY = 'crcg:current';
  var LEGACY_KEY = 'crcg_roles_v1';
  var DEFAULT_NAME = 'My simulation';

  function uid() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function str(v) { return String(v == null ? '' : v); }
  function clampInt(v, lo, hi, dflt) {
    var n = parseInt(v, 10);
    if (!isFinite(n)) return dflt;
    return Math.max(lo, Math.min(hi, n));
  }
  function bool(v, dflt) { return typeof v === 'boolean' ? v : dflt; }

  function repairPoint(p) {
    if (typeof p === 'string') return { id: uid(), text: p };
    if (!p || typeof p !== 'object') return null;
    return { id: str(p.id) || uid(), text: str(p.text) };
  }

  function repairRole(r) {
    if (!r || typeof r !== 'object') return null;
    return {
      id: str(r.id) || uid(),
      role: str(r.role),
      position: str(r.position),
      copies: clampInt(r.copies, 1, 40, 1),
      students: Array.isArray(r.students) ? r.students.map(str) : [],
      caseFile: str(r.caseFile),
      /* Which roles get a ballot slip lives on the role itself rather than in
         a list of role names inside the ballot settings. Duplicating a role
         carries it, deleting a role takes it away, and the slip count follows
         the copies count with nothing left to keep in sync. */
      ballot: bool(r.ballot, false),
      points: (Array.isArray(r.points) ? r.points : []).map(repairPoint).filter(Boolean)
    };
  }

  function repairPhase(p) {
    if (!p || typeof p !== 'object') return null;
    return {
      id: str(p.id) || uid(),
      name: str(p.name),
      minutes: clampInt(p.minutes, 0, 240, 5),
      cue: str(p.cue)
    };
  }

  function repairBallot(b) {
    b = (b && typeof b === 'object') ? b : {};
    return {
      title: str(b.title),
      question: str(b.question),
      instructions: str(b.instructions),
      options: (Array.isArray(b.options) ? b.options : []).map(str).filter(function (o) { return o.trim(); }),
      /* A secret verdict wants a blank line; a recorded roll-call vote wants
         the delegate's name printed on the card. One switch covers both. */
      names: bool(b.names, false),
      extra: clampInt(b.extra, 0, 40, 0)
    };
  }

  function repairCriterion(c) {
    if (!c || typeof c !== 'object') return null;
    return { id: str(c.id) || uid(), name: str(c.name), top: str(c.top) };
  }

  function repairRubric(r) {
    r = (r && typeof r === 'object') ? r : {};
    var levels = Array.isArray(r.levels) ? r.levels.map(str) : [];
    while (levels.length < 4) levels.push(['4 Strong', '3 Solid', '2 Developing', '1 Beginning'][levels.length]);
    return {
      levels: levels.slice(0, 4),
      criteria: (Array.isArray(r.criteria) ? r.criteria : []).map(repairCriterion).filter(Boolean)
    };
  }

  function repairReflection(r) {
    r = (r && typeof r === 'object') ? r : {};
    return {
      title: str(r.title),
      prompts: (Array.isArray(r.prompts) ? r.prompts : []).map(repairPoint).filter(Boolean)
    };
  }

  function repairPrint(p) {
    p = (p && typeof p === 'object') ? p : {};
    return {
      agenda: bool(p.agenda, true),
      cards: bool(p.cards, true),
      caseFiles: bool(p.caseFiles, true),
      ballots: bool(p.ballots, true),
      rubric: bool(p.rubric, true),
      reflections: bool(p.reflections, true)
    };
  }

  function repairDoc(doc) {
    doc = (doc && typeof doc === 'object') ? doc : {};
    return {
      v: 2,
      title: str(doc.title),
      roles: (Array.isArray(doc.roles) ? doc.roles : []).map(repairRole).filter(Boolean),
      agenda: (Array.isArray(doc.agenda) ? doc.agenda : []).map(repairPhase).filter(Boolean),
      ballot: repairBallot(doc.ballot),
      rubric: repairRubric(doc.rubric),
      reflection: repairReflection(doc.reflection),
      print: repairPrint(doc.print)
    };
  }

  function readJson(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /* ---------- named simulations ---------- */

  function listSims() {
    var names = readJson(LIST_KEY);
    return Array.isArray(names) ? names.filter(function (n) { return typeof n === 'string' && n; }) : [];
  }

  /** Returns {ok:true} or {ok:false, error} — a caller that swallows a quota
      failure is silently losing a teacher's work. */
  function saveSim(name, doc) {
    try {
      var names = listSims();
      if (names.indexOf(name) === -1) {
        names.push(name);
        localStorage.setItem(LIST_KEY, JSON.stringify(names));
      }
      localStorage.setItem(DATA_PREFIX + name, JSON.stringify(doc));
      localStorage.setItem(CURRENT_KEY, name);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  /** A repaired v2 document, or null if that simulation doesn't exist. */
  function loadSim(name) {
    var doc = readJson(DATA_PREFIX + name);
    return doc ? repairDoc(doc) : null;
  }

  function deleteSim(name) {
    try {
      var names = listSims().filter(function (n) { return n !== name; });
      localStorage.setItem(LIST_KEY, JSON.stringify(names));
      localStorage.removeItem(DATA_PREFIX + name);
      if (localStorage.getItem(CURRENT_KEY) === name) localStorage.removeItem(CURRENT_KEY);
    } catch (e) { /* removals can't meaningfully fail */ }
  }

  /** "Mock Trial" when it is free, else "Mock Trial 2", "Mock Trial 3"...
      Used by the share-link import, which must never overwrite a simulation a
      teacher already has open under the same name. */
  function uniqueName(base) {
    base = str(base).trim() || 'Shared simulation';
    var names = listSims();
    if (names.indexOf(base) === -1) return base;
    for (var n = 2; n < 500; n++) {
      if (names.indexOf(base + ' ' + n) === -1) return base + ' ' + n;
    }
    return base + ' ' + Date.now();
  }

  /** The simulation to open at boot: the current one, else the first listed,
      else whatever the legacy flat `crcg_roles_v1` blob migrates into
      "My simulation", else a fresh empty one. The legacy key stays behind as
      a backup. */
  function loadCurrent() {
    var names = listSims();
    var current = null;
    try { current = localStorage.getItem(CURRENT_KEY); } catch (e) { /* ignore */ }
    if (current && names.indexOf(current) !== -1) {
      var doc = loadSim(current);
      if (doc) return { name: current, doc: doc, migrated: false };
    }
    if (names.length) {
      var first = loadSim(names[0]);
      if (first) return { name: names[0], doc: first, migrated: false };
    }
    var legacy = readJson(LEGACY_KEY);
    if (legacy && Array.isArray(legacy.roles) && legacy.roles.length) {
      var migrated = repairDoc(legacy);
      saveSim(DEFAULT_NAME, migrated); // best effort
      return { name: DEFAULT_NAME, doc: migrated, migrated: true };
    }
    return { name: DEFAULT_NAME, doc: repairDoc(null), migrated: false };
  }

  window.CrcgStore = {
    DEFAULT_NAME: DEFAULT_NAME,
    uid: uid,
    listSims: listSims,
    saveSim: saveSim,
    loadSim: loadSim,
    deleteSim: deleteSim,
    uniqueName: uniqueName,
    loadCurrent: loadCurrent,
    repairDoc: repairDoc
  };
})();
