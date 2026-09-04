/* roster.js — the site's one reader, writer and picker for the shared class
   roster, plus the identity layer that says which student is which.

   Why this exists. `np_rosters` is the closest thing this site has to a
   schema: `{ "Period 3": ["Aiden Smith", ...] }`, written by Class Roster Hub
   and by the Name Picker, and read by 28 tool pages through roughly six
   distinct copy-pasted picker functions. Measured across those pages:

     1. Most parse the key TWICE per interaction — once to fill the <select>,
        once again in the change handler to get the names back out.
     2. Only two (050, 064) listen for the cross-tab `storage` event, and none
        of the 28 sees a write made in its own tab. Open Class Roster Hub in one
        tab and Name Picker in another and the second is stale until reload.
     3. They disagree about failure. Some assume `rosters[n]` is an array and
        throw on `.length` if a hand-edited key says otherwise; 016 type-guards
        properly and disables the control with an explanation; the rest render
        an empty dropdown that looks like "you have no rosters".
     4. They disagree about escaping — escapeAttr+escapeHtml, escapeHtml twice,
        or `esc` — which is four spellings of one XSS question about a string
        the teacher typed.

   Separately, every tool that keeps per-student history keys it on the NAME
   STRING, so a roster edit orphans that history everywhere. Class Roster Hub
   already writes the fix — `crh_students_v1`, a sidecar hanging a stable `id`,
   a preferred name and a pronunciation off each name — and before this file
   only three readers of it existed.

   THE WIRE SHAPE DOES NOT CHANGE, AND THIS IS THE POINT. `np_rosters` stays a
   bare, unversioned `{ name: string[] }` object on disk and `crh_students_v1`
   stays `{version:1, rosters:{...}}`. Both are contracts with tools that read
   them with a plain JSON.parse, so both are written through store.js's
   `raw: true` (see its set()) and read back with an identity `migrate`, which
   by store.js rule 2 is what a version-0 legacy payload needs. A tool that
   never learns about this file keeps working forever.

   THE WRITE-CONTENTION CONTRACT. After this file there are three writers of
   `np_rosters`: Class Roster Hub (006), the Name Picker (through
   Tools/name-picker/np-store.js) and this module. All three read-modify-write
   the WHOLE object — nobody writes a single roster in place — and
   last-writer-wins across tabs. That is the behaviour the site already had; it
   is not fixed here, only written down, because fixing it means a lock this
   site has no server to hold.

   WHAT A BAD ROSTER DOES. Dropped, never thrown. `np-store.js` learned this
   the hard way: a roster whose value is not an array crashed the Name Picker's
   loadRosterByName() on `rosters[name].join('\n')` and took the page with it.
   One unreadable entry loses that entry and nothing else.

   DEPENDS ON store.js, deliberately and hard. A page loading this file must
   load `_shared/store.js` first. The alternative — falling back to a bare
   localStorage read when Store is absent — would put a second, silent storage
   path back on the site, which is the exact thing store.js exists to delete. If
   Store is missing this file says so once in the console and every write
   reports failure rather than pretending.

   Plain global script, not an ES module, for the same reason store.js and
   state-link.js are: about half this site's tools use `<script type="module">`
   and half use classic scripts, and a single file cannot use both `export` and
   plain-script syntax without a parse error under one of them. That also means
   this file cannot import `_shared/student-details.js`, which IS an ES module;
   `normalize()` there and `normKey` in 006 are the same function as `normKey`
   here, and this file is now the canonical copy. */
(function (global) {
  'use strict';

  var ROSTERS_KEY = 'np_rosters';        // { [rosterName]: string[] } — bare, unversioned
  var RECORDS_KEY = 'crh_students_v1';   // { version:1, rosters:{ [name]: {meta, students, orphans} } }

  /* Class Roster Hub's ceilings, which mirror the Name Picker's own. Kept here
     so the two agree after the port rather than drifting apart. */
  var MAX_NAME = 120, MAX_ROSTER = 400, MAX_ROSTERS = 60, MAX_ORPHANS = 120;

  var HEADER_WORDS = ['name', 'names', 'student', 'student name', 'full name', 'last', 'first', 'last name',
                      'first name', 'id', 'student id', 'period', 'grade', 'email'];

  var warnedNoStore = false;

  /* ---- storage --------------------------------------------------------- */

  /* Whether store.js is present. Callers then reach `global.Store.get(...)`
     INLINE rather than through a local alias — check-registry.mjs finds this
     file's np_rosters access by matching `Store.get` / `Store.set` at the call
     site, and it skips any file that declares its own `var Store = …`. An alias
     would drop roster.js out of the guard silently, which is the exact failure
     that guard was written to prevent, arriving through the front door. */
  function haveStore() {
    if (global.Store) return true;
    if (!warnedNoStore) {
      warnedNoStore = true;
      if (global.console && global.console.error) {
        global.console.error('roster.js needs _shared/store.js — load it first. ' +
                             'Rosters cannot be read or saved until it is.');
      }
    }
    return false;
  }

  /** No write happened, and the caller must be able to tell. */
  function noStoreResult() {
    return { ok: false, quota: false, blocked: true, bytes: 0, error: null };
  }

  /** Same shape Store.set returns, so a caller has one thing to check. */
  function refusal(why) {
    return { ok: false, quota: false, blocked: false, bytes: 0, error: new Error(why) };
  }

  function identity(fromV, data) { return data; }

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  /** Every roster on disk, sanitized. A roster whose value is not an array of
      strings is dropped and the rest survive — np-store.js's rule. */
  function readRosters() {
    if (!haveStore()) return {};
    var raw = global.Store.get(ROSTERS_KEY, { default: {}, migrate: identity });
    if (!isObj(raw)) return {};
    var out = {};
    for (var name in raw) {
      if (!Object.prototype.hasOwnProperty.call(raw, name)) continue;
      if (!Array.isArray(raw[name])) continue;
      var title = String(name).replace(/\s+/g, ' ').trim().slice(0, 80);
      if (!title) continue;
      var names = [];
      for (var i = 0; i < raw[name].length; i++) {
        if (typeof raw[name][i] !== 'string') continue;
        var n = raw[name][i].replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
        if (n) names.push(n);
      }
      out[title] = names.slice(0, MAX_ROSTER);
      if (Object.keys(out).length >= MAX_ROSTERS) break;
    }
    return out;
  }

  /** The read-modify-write every writer of this key owes the other two. */
  function writeRosters(all) {
    if (!haveStore()) return noStoreResult();
    return global.Store.set(ROSTERS_KEY, all, { raw: true });
  }

  function readRecords() {
    if (!haveStore()) return { version: 1, rosters: {} };
    var db = global.Store.get(RECORDS_KEY, { default: null, migrate: identity });
    /* 006 used to DISCARD any payload whose version was not 1. Reading an
       unknown-version sidecar as empty is the same outcome for today's data and
       leaves the payload on disk, per store.js rule 4. */
    if (!isObj(db) || !isObj(db.rosters)) return { version: 1, rosters: {} };
    return db;
  }

  function writeRecords(db) {
    if (!haveStore()) return noStoreResult();
    return global.Store.set(RECORDS_KEY, db, { raw: true });
  }

  /* ---- names ----------------------------------------------------------- */

  /** Case- and whitespace-insensitive. The canonical copy: 006's `normKey` and
      student-details.js's `normalize` are this function. */
  function normKey(s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

  /** Order- and punctuation-insensitive key, so "Smith, John" and "John Smith"
      land in the same bucket — that swap is the single most common way one
      student ends up as two in downstream tools. */
  function tokenKey(s) {
    return normKey(s).replace(/[.,;]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
  }

  /** One name per line, whitespace collapsed, deduped case-insensitively,
      capped. Returns {names, truncatedNames, truncatedList} so a caller can
      tell the teacher what it had to cut. */
  function parseNames(text) {
    var seen = {};
    var out = [];
    var truncatedNames = 0;
    String(text || '').split('\n').forEach(function (line) {
      var name = line.replace(/\s+/g, ' ').trim();
      if (!name) return;
      if (name.length > MAX_NAME) { name = name.slice(0, MAX_NAME); truncatedNames++; }
      var key = name.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      out.push(name);
    });
    var truncatedList = out.length > MAX_ROSTER;
    out = out.slice(0, MAX_ROSTER);
    return { names: out, truncatedNames: truncatedNames, truncatedList: truncatedList };
  }

  function newId() {
    return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---- delimited text -------------------------------------------------- */

  /** Splits one delimited line into cells. Handles quoted cells (so a
      "Last, First" cell keeps its comma) and picks tab over comma when the
      line has tabs — which is what pasting a spreadsheet region gives you. */
  function splitCells(line, delim) {
    var out = [], cur = '', inQ = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  }

  /** CSV/TSV text → `{rows, cols}`, every row right-padded to `cols`. */
  function parseDelimited(text) {
    var lines = String(text || '').split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
    if (!lines.length) return { rows: [], cols: 0 };
    var delim = lines[0].indexOf('\t') !== -1 ? '\t' : (lines[0].indexOf(',') !== -1 ? ',' : '\t');
    var rows = lines.map(function (l) { return splitCells(l, delim); });
    var cols = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    rows.forEach(function (r) { while (r.length < cols) r.push(''); });
    return { rows: rows, cols: cols };
  }

  function looksLikeHeader(row) {
    var hits = row.filter(function (c) { return HEADER_WORDS.indexOf(normKey(c)) !== -1; }).length;
    return hits >= Math.max(1, Math.ceil(row.length / 3));
  }

  /** "Smith, John" → "John Smith". Leaves anything without a comma alone. */
  function flipLastFirst(name) {
    var t = String(name || '').trim();
    var i = t.indexOf(',');
    if (i === -1) return t;
    var last = t.slice(0, i).trim(), rest = t.slice(i + 1).trim();
    if (!last || !rest) return t.replace(',', ' ').replace(/\s+/g, ' ').trim();
    return (rest + ' ' + last).replace(/\s+/g, ' ').trim();
  }

  /** Index of the first column whose header is one of `words`, or -1. */
  function guessColumn(rows, header, words) {
    if (header) {
      for (var c = 0; c < rows[0].length; c++) {
        if (words.indexOf(normKey(rows[0][c])) !== -1) return c;
      }
    }
    return -1;
  }

  /** With no header to go on, the column with the most letters-and-spaces in
      it is almost always the name column — IDs and periods are digits. */
  function widestTextColumn(t) {
    var best = 0, bestScore = -1;
    for (var c = 0; c < t.cols; c++) {
      var score = 0;
      t.rows.slice(0, 12).forEach(function (r) {
        var v = String(r[c] || '');
        if (/[a-z]/i.test(v)) score += v.replace(/[^a-z ]/gi, '').length;
      });
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  /* ---- rosters --------------------------------------------------------- */

  function listRosters() {
    return Object.keys(readRosters()).sort(function (a, b) { return a.localeCompare(b); });
  }

  /** A copy, never a live reference — a caller that sorts the result in place
      must not be sorting what the next caller reads. */
  function getRoster(name) {
    var all = readRosters();
    return Array.isArray(all[name]) ? all[name].slice() : [];
  }

  /**
   * Create or replace one roster, as a read-modify-write of the whole object.
   *
   * Refuses to create a 61st roster rather than writing one that readRosters()
   * would then silently drop — the cap is applied on read (np-store.js does the
   * same), so without this check the write "succeeds" and the roster is gone by
   * the next page load. REPLACING an existing roster is always allowed, however
   * full the list is; 006 saves the open roster on nearly every interaction and
   * must never be refused for a limit it is not adding to.
   */
  function setRoster(name, names) {
    var title = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!title) return refusal('a roster needs a name');
    var all = readRosters();
    if (!Object.prototype.hasOwnProperty.call(all, title) && Object.keys(all).length >= MAX_ROSTERS) {
      return refusal('this browser is already holding ' + MAX_ROSTERS + ' rosters');
    }
    all[title] = parseNames((names || []).join('\n')).names;
    return writeRosters(all);
  }

  /**
   * Rename in one read-modify-write, so the roster is never briefly present
   * under both names (or, if the write failed between two calls, under only the
   * old one). Overwrites `to` if it exists — the caller confirms that.
   */
  function renameRoster(from, to) {
    var title = String(to || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!title) return refusal('a roster needs a name');
    var all = readRosters();
    if (!Object.prototype.hasOwnProperty.call(all, from)) return refusal('no roster called "' + from + '"');
    all[title] = all[from];
    if (title !== from) delete all[from];
    return writeRosters(all);
  }

  /**
   * Write the whole roster map at once.
   *
   * This exists for the ONE operation that is genuinely about the whole map —
   * Class Roster Hub's year rollover, which keeps this year's roster names and
   * empties every one of them. Doing that as a loop of setRoster calls would
   * leave a teacher's storage half-rolled-over if the disk filled in the middle.
   *
   * It is not a general-purpose door. Every other mutation must go through
   * setRoster / removeRoster / renameRoster, which re-read immediately before
   * they write; a caller that holds a map across a prompt() or a modal and then
   * replaceAll()s it has silently discarded whatever another tab did meanwhile.
   */
  function replaceAll(map) {
    var clean = {};
    if (isObj(map)) {
      for (var name in map) {
        if (!Object.prototype.hasOwnProperty.call(map, name)) continue;
        if (!Array.isArray(map[name])) continue;
        var title = String(name).replace(/\s+/g, ' ').trim().slice(0, 80);
        if (!title) continue;
        clean[title] = parseNames(map[name].join('\n')).names;
        if (Object.keys(clean).length >= MAX_ROSTERS) break;
      }
    }
    return writeRosters(clean);
  }

  function removeRoster(name) {
    var all = readRosters();
    if (!Object.prototype.hasOwnProperty.call(all, name)) {
      return { ok: true, quota: false, blocked: false, bytes: 0, error: null };
    }
    delete all[name];
    return writeRosters(all);
  }

  /* ---- identity -------------------------------------------------------- */

  /** Read-only view of the whole sidecar. */
  function getStudentMeta() { return readRecords(); }

  function blankEntry() { return { meta: {}, students: [], orphans: [] }; }

  function entryFor(db, rosterName) {
    var e = db.rosters[rosterName];
    if (!isObj(e)) return blankEntry();
    return {
      meta: isObj(e.meta) ? e.meta : {},
      students: Array.isArray(e.students) ? e.students : [],
      orphans: Array.isArray(e.orphans) ? e.orphans : []
    };
  }

  /**
   * Reconciles the sidecar records for one roster against an authoritative list
   * of names, WITHOUT writing. Returns `{students, orphans}`.
   *
   * Names keep their record — and so their id — across a reorder or a rename,
   * because a vanished name is re-matched by sorted-token key. A record whose
   * name is gone but which carries a preferred name or a pronunciation parks in
   * `orphans` so re-adding the student, or re-typing them in the other name
   * order, gets their detail back. Pure, so the suite can drive it.
   *
   * `mint` decides what happens to a name the sidecar has never seen: the
   * OWNER of the sidecar (Class Roster Hub, through syncRecords) mints an id
   * and stores it; a READER gets `id: null` and must fall back to the name.
   * A reader that minted would hand two tools two different ids for the same
   * student — the exact confusion a stable id exists to end — and it would do
   * it invisibly, because nothing was written down to disagree with.
   */
  function reconcile(names, prevStudents, prevOrphans, mint) {
    var prior = (prevStudents || []).concat(prevOrphans || []);
    var byName = {}, byToken = {};
    prior.forEach(function (r) {
      if (!isObj(r) || typeof r.name !== 'string') return;
      byName[normKey(r.name)] = r;
      var t = tokenKey(r.name);
      if (!byToken[t]) byToken[t] = r;
    });

    var used = {};
    var out = (names || []).map(function (n) {
      var rec = byName[normKey(n)] || byToken[tokenKey(n)];
      if (rec && rec.id && !used[rec.id]) {
        used[rec.id] = true;
        return { id: rec.id, name: n, preferred: rec.preferred || '', say: rec.say || '' };
      }
      return { id: mint === false ? null : newId(), name: n, preferred: '', say: '' };
    });

    var kept = {};
    out.forEach(function (r) { if (r.id) kept[r.id] = true; });
    var seenOrphan = {};
    var orphans = prior.filter(function (r) {
      return isObj(r) && r.id && !kept[r.id] && (r.preferred || r.say);
    }).filter(function (r) {
      if (seenOrphan[r.id]) return false;
      seenOrphan[r.id] = true;
      return true;
    }).slice(0, MAX_ORPHANS);

    return { students: out, orphans: orphans };
  }

  /** `reconcile` against what is on disk, then write the result back. */
  function syncRecords(rosterName, names) {
    var db = readRecords();
    var entry = entryFor(db, rosterName);
    var next = reconcile(names, entry.students, entry.orphans);
    db.rosters[rosterName] = { meta: entry.meta, students: next.students, orphans: next.orphans };
    writeRecords(db);
    return db.rosters[rosterName];
  }

  /**
   * The identity layer's entry point: `[{id, name, preferred, say}]` for one
   * roster, joined from `np_rosters` (who is on it) and `crh_students_v1` (what
   * we know about them).
   *
   * Read-only, and `id` is **null** for a name the sidecar has never seen — a
   * roster typed straight into the Name Picker has no ids at all, and that is a
   * fact a consumer needs rather than a gap to paper over. A tool keying its own
   * history should use the id when there is one and the name when there is not;
   * opening Class Roster Hub on that roster is what mints the ids for real.
   */
  function getStudents(rosterName) {
    var names = getRoster(rosterName);
    var entry = entryFor(readRecords(), rosterName);
    return reconcile(names, entry.students, entry.orphans, false).students;
  }

  /**
   * Find one student by name or by id, across every roster.
   *
   * `rosterName` is checked first so two classes with a "Sam" do not collide;
   * without a match there it falls back to the first roster that knows them —
   * student-details.js's convention, kept so the two agree. Returns
   * `{id, name, preferred, say, roster}` or null.
   */
  function resolve(nameOrId, rosterName) {
    var needle = String(nameOrId || '').trim();
    if (!needle) return null;
    var key = normKey(needle);
    var order = listRosters();
    if (rosterName) {
      order = [rosterName].concat(order.filter(function (r) { return r !== rosterName; }));
    }
    var byId = null;
    for (var i = 0; i < order.length; i++) {
      var list = getStudents(order[i]);
      for (var j = 0; j < list.length; j++) {
        if (normKey(list[j].name) === key) return withRoster(list[j], order[i]);
        if (!byId && list[j].id === needle) byId = withRoster(list[j], order[i]);
      }
    }
    return byId;
  }

  function withRoster(rec, roster) {
    return { id: rec.id, name: rec.name, preferred: rec.preferred, say: rec.say, roster: roster };
  }

  /* ---- fuzzy name matching --------------------------------------------- */

  /** Levenshtein, bounded: it stops as soon as every cell in a row exceeds
      `max`, so a long non-match costs a row, not a full matrix. */
  function editDistance(a, b, max) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      var best = cur[0];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(
          prev[j] + 1,
          cur[j - 1] + 1,
          prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)
        );
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev = cur.slice();
    }
    return prev[b.length];
  }

  /**
   * Match something heard or typed against a roster: exact name → exact
   * preferred name → a unique first name → a single close spelling. Returns the
   * student record, or **null** when it is not sure.
   *
   * Two rules earn their place. A first name only counts when exactly ONE
   * student on the roster has it — "Jordan" in a class with two Jordans is not
   * an answer, it is a question. And the edit-distance budget is one edit per
   * four characters, capped at two: that admits "Aiden"/"Aidan" and
   * "Nguyen"/"Nguyan" while refusing "Sam"/"Pam" (3 characters buys 0 edits, so
   * a 3-letter name must be spelled right) and "Jon"/"Ron". A tie at the best
   * distance returns null for the same reason the first-name rule does — this
   * function's failure mode has to be "ask", never "guess wrong about a kid".
   */
  function matchName(spoken, students) {
    var list = Array.isArray(students) ? students : [];
    var key = normKey(spoken);
    if (!key || !list.length) return null;

    var i;
    for (i = 0; i < list.length; i++) if (normKey(list[i].name) === key) return list[i];
    for (i = 0; i < list.length; i++) if (list[i].preferred && normKey(list[i].preferred) === key) return list[i];

    /* token-order swap: "Smith, John" heard as "John Smith" */
    var tk = tokenKey(spoken);
    var tokenHits = list.filter(function (s) { return tokenKey(s.name) === tk; });
    if (tokenHits.length === 1) return tokenHits[0];

    var firstHits = list.filter(function (s) {
      return normKey(String(s.name).split(' ')[0]) === key;
    });
    if (firstHits.length === 1) return firstHits[0];

    var budget = Math.min(2, Math.floor(key.length / 4));
    if (budget < 1) return null;
    var best = null, bestD = budget + 1, tied = false;
    for (i = 0; i < list.length; i++) {
      var cand = [normKey(list[i].name), normKey(String(list[i].name).split(' ')[0])];
      if (list[i].preferred) cand.push(normKey(list[i].preferred));
      var d = budget + 1;
      for (var c = 0; c < cand.length; c++) {
        var dc = editDistance(key, cand[c], budget);
        if (dc < d) d = dc;
      }
      if (d > budget) continue;
      if (d < bestD) { bestD = d; best = list[i]; tied = false; }
      else if (d === bestD && best !== list[i]) { tied = true; }
    }
    return tied ? null : best;
  }

  /* ---- change notification --------------------------------------------- */

  /**
   * Fires whenever the roster list changes, in this tab as well as the others —
   * `Store.onChange` wraps both the native `storage` event and store.js's
   * same-tab CustomEvent, which is what the 28 hand-rolled readers miss.
   * Returns an unsubscribe function.
   */
  function onChange(fn) {
    if (!haveStore()) return function () {};
    return global.Store.onChange(ROSTERS_KEY, function () { fn(listRosters()); });
  }

  /* ---- the picker ------------------------------------------------------ */

  /**
   * Fill a <select> with the saved rosters and keep it filled.
   *
   * Options, all optional: `persistKey` (a localStorage key remembering the
   * chosen roster — pass the tool's EXISTING key so no data migrates),
   * `emptyLabel`, `placeholder`, `includeManualOption` (adds a "Type names
   * manually" entry, which three of the six variants have), `disableWhenEmpty`
   * (016's behaviour, the most helpful of the six) and `onChange(name, names)`.
   *
   * Returns `{refresh, getSelected, getNames, destroy}`. Options are built with
   * createElement and textContent rather than an innerHTML string, which is why
   * this file has no escape helper: there is nothing to escape. The four
   * different escaping spellings across the copy-pasted variants were four
   * answers to a question that only existed because they concatenated markup.
   */
  function mountRosterPicker(selectEl, opts) {
    opts = opts || {};
    if (!selectEl || !selectEl.appendChild) return null;
    var placeholder = opts.placeholder || 'Load a saved roster…';
    var emptyLabel = opts.emptyLabel || 'No saved rosters yet';
    /* Deliberately lower-case. check-registry.mjs resolves each localStorage
       call-site argument by name: SCREAMING_CASE is a constant it must be able
       to follow to a literal, a bare lower-case name is a generic helper's
       parameter. Spelled `persistKey` this fails `npm run check:registry` with
       an unresolvable key attributed to a "site" row that does not exist. And a
       parameter is exactly what it is — the key belongs to the CALLING tool,
       which passes the remembered-selection key it already has, so adopting the
       picker migrates no data. This file must never introduce a key of its own. */
    var persistkey = opts.persistKey || '';
    var onPick = typeof opts.onChange === 'function' ? opts.onChange : function () {};
    /* The sentinel for the "type names manually" entry. readRosters()
       collapses whitespace in every roster name it returns, so no real
       roster can ever be called this and the value cannot collide. */
    var MANUAL = '\nmanual';

    function remembered() {
      if (!persistkey) return '';
      try { return global.localStorage.getItem(persistkey) || ''; } catch (e) { return ''; }
    }
    function remember(v) {
      if (!persistkey) return;
      try { global.localStorage.setItem(persistkey, v); } catch (e) { /* a remembered
        selection is a convenience; failing to keep it must not break the tool,
        and store.js already owns telling the teacher that storage is full. */ }
    }

    function option(value, text) {
      var o = global.document.createElement('option');
      o.value = value;
      o.textContent = text;
      return o;
    }

    function refresh() {
      var want = selectEl.value || remembered();
      var names = listRosters();
      var all = readRosters();
      selectEl.textContent = '';
      selectEl.appendChild(option('', names.length ? placeholder : emptyLabel));
      names.forEach(function (n) {
        selectEl.appendChild(option(n, n + ' (' + (all[n] ? all[n].length : 0) + ')'));
      });
      if (opts.includeManualOption) selectEl.appendChild(option(MANUAL, 'Type names manually'));
      if (opts.disableWhenEmpty) selectEl.disabled = names.length === 0;
      if (want && (want === MANUAL || names.indexOf(want) !== -1)) selectEl.value = want;
      return names;
    }

    function getSelected() {
      var v = selectEl.value;
      return v === MANUAL ? null : (v || null);
    }
    function getNames() {
      var v = getSelected();
      return v ? getRoster(v) : [];
    }

    function handleChange() {
      remember(selectEl.value);
      onPick(getSelected(), getNames());
    }

    selectEl.addEventListener('change', handleChange);
    var unsubscribe = onChange(function () { refresh(); });
    refresh();

    return {
      refresh: refresh,
      getSelected: getSelected,
      getNames: getNames,
      destroy: function () {
        selectEl.removeEventListener('change', handleChange);
        unsubscribe();
      }
    };
  }

  global.Roster = {
    /* rosters */
    listRosters: listRosters,
    getRoster: getRoster,
    setRoster: setRoster,
    renameRoster: renameRoster,
    replaceAll: replaceAll,
    removeRoster: removeRoster,
    onChange: onChange,
    mountRosterPicker: mountRosterPicker,
    /* identity */
    getStudents: getStudents,
    getStudentMeta: getStudentMeta,
    syncRecords: syncRecords,
    reconcile: reconcile,
    resolve: resolve,
    matchName: matchName,
    /* text */
    parseDelimited: parseDelimited,
    splitCells: splitCells,
    looksLikeHeader: looksLikeHeader,
    flipLastFirst: flipLastFirst,
    guessColumn: guessColumn,
    widestTextColumn: widestTextColumn,
    parseNames: parseNames,
    normKey: normKey,
    tokenKey: tokenKey,
    newId: newId,
    /* the ceilings 006 and the Name Picker both enforce */
    MAX_NAME: MAX_NAME,
    MAX_ROSTER: MAX_ROSTER,
    MAX_ROSTERS: MAX_ROSTERS,
    HEADER_WORDS: HEADER_WORDS,
    ROSTERS_KEY: ROSTERS_KEY,
    RECORDS_KEY: RECORDS_KEY,
    /* exposed for the test suite */
    _editDistance: editDistance,
    _readRecords: readRecords,
    _writeRecords: writeRecords
  };
})(window);
