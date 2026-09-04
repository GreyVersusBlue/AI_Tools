// check-registry.mjs — read-only guard that _shared/tool-registry.js and the
// tree agree about what every tool stores.
//
//   node Tools/board-check/check-registry.mjs          (or: npm run check:registry)
//   node Tools/board-check/check-registry.mjs --json   (the extraction, for seeding)
//   node Tools/board-check/check-registry.mjs --tool 019
//
// Before the registry existed, two hand-maintained lists inside 009 were the
// only site-wide record of what tools save: KNOWN_GROUPS (76 rows) and
// STUDENT_KEYS/STUDENT_PREFIXES (30 keys + 5 prefixes). Nothing checked either
// one, and the failure is silent in both directions — a tool whose key is
// missing shows up in a teacher's backup as "Other saved data" with no name,
// and, worse, is classified as settings rather than student data, so the
// end-of-year rollover keeps last year's students instead of clearing them.
//
// Measured on 2026-09-04, when this guard was written: 107 files touch
// localStorage or IndexedDB, resolving to 217 keys and 32 prefixes owned across
// 87 rows, against KNOWN_GROUPS's 76. Thirty-eight tools had no label at all and
// were showing up in teachers' backups as unnamed "Other saved data". Two of the
// three IndexedDB databases (rgb-audio, stviz-recovery) were unlabelled, and on
// Firefox none of the three was backed up at all.
//
// HOW A KEY IS RESOLVED (see below) is only half of it. Two patterns are not
// localStorage call sites at all and were found the hard way:
//   - assets/js/gvb-save.js writes through createSaveSlot({key}). Scanning call
//     sites alone attributed none of the Name Picker's fifteen keys to it, and
//     made np_rosters look as though only 006 wrote it.
//   - _shared/media-db.js opens IndexedDB on its callers' behalf, so an adopter
//     contains no indexedDB.open() at all; MediaDB.store({db}) is read instead,
//     and a call without a `db` is the shared gvb-media database.
//   - sessionStorage is NOT scanned, deliberately: it dies with the tab and no
//     backup can ever contain it. That is how 009's student-data rule for
//     gvb-command-center:excluded: turned out to have always been dead — 010
//     keeps that in sessionStorage.
//
// This file is both the extractor and the guard on purpose. A separate
// "measure it" script would rot — this repo has documented three commands that
// were never committed (sync-social-tags.mjs, the original board-check folder,
// list-dark-candidates.mjs) — so the same code path that seeds the registry
// with --json is the one CI runs to check it.
//
// HOW A KEY IS RESOLVED. Only 11 keys on this site are written as a bare
// literal at the call site; the rest go through `const X_KEY = '...'`. So each
// file's const/let/var string bindings are collected first, then every
// localStorage call site is resolved against them:
//
//   'lit'                     -> the key 'lit'
//   IDENT                     -> whatever IDENT was bound to
//   `lit${...}` / 'lit' + x   -> the prefix 'lit'
//   IDENT + x                 -> the prefix IDENT was bound to
//   fn(x), where fn is a one-line `return PREFIX + ...`  -> that prefix
//   a.b.IDENT                 -> IDENT, if exactly one file in the tree binds it
//   a bare lower-case name    -> a pass-through: the parameter of a generic
//                                helper (009's scanner, store.js itself), not a
//                                key. Constants on this site are SCREAMING_CASE,
//                                which is what makes this distinguishable.
//   anything else             -> DYNAMIC: the registry must acknowledge it by
//                                name in the tool's `dynamic` list, so that a
//                                human has looked at it once.
//
// Four checks:
//
//   1. UNREGISTERED — a key or prefix the tree writes that no registry row
//                     declares. This is the one the whole file exists for.
//   2. STALE        — a key or prefix the registry declares that nothing in the
//                     tree references any more.
//   3. DYNAMIC      — an unresolvable call site the owning tool's row does not
//                     acknowledge.
//   4. SHAPE        — every row has slug/title/file/category, every `file`
//                     exists, no two rows OWN the same key or prefix, and
//                     every numbered tool page has a row.
//
// Ownership is decided by who WRITES, not who touches: twelve tools read
// np_rosters and none of them owns it. A handful of tools legitimately write
// another tool's key as a handoff — 010 writes hall-pass-log-sections, the
// Writing Prompt Generator writes a Rubric Builder key — and those declare it
// in `writes` rather than claiming it twice, so a backup still groups the key
// under the tool that owns it.
//
// Exit 0 clean, 1 a real problem, 2 a bad invocation. No writes, no network.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/* Archived designs and alternates are kept for reference and are not live; the
   test harness and vendored libraries are not tools. */
const EXEMPT = [
  'Tools/Old Designs/', 'Tools/New Designs/', 'Other Landing Page ideas/',
  'index_backup.html', 'node_modules/', '_shared/vendor/', 'Tools/board-check/',
  '_ds/', '.git/',
];
const SKIP_DIRS = new Set(['test', 'lib', 'libs', 'shots', 'fonts', 'node_modules']);

const argv = process.argv.slice(2);
const AS_JSON = argv.includes('--json');
const toolIdx = argv.indexOf('--tool');
const ONLY = toolIdx >= 0 ? argv[toolIdx + 1] : null;
if (toolIdx >= 0 && !ONLY) {
  console.error('check-registry: --tool needs a tool number (e.g. --tool 019).');
  process.exit(2);
}

const problems = [];
const warnings = [];

/* ── walk the tree ──────────────────────────────────────────────────────── */

function walk(dir, out = []) {
  for (const e of fs.readdirSync(path.join(SITE, dir), { withFileTypes: true })) {
    const rel = dir ? dir + '/' + e.name : e.name;
    if (EXEMPT.some(x => rel.startsWith(x))) continue;
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(rel, out); continue; }
    if (/\.(html|js|mjs)$/.test(e.name)) out.push(rel);
  }
  return out;
}
const FILES = walk('');

/* ── binding tables ─────────────────────────────────────────────────────── */

const BIND_RE = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"])([^'"\n]*)\2/g;
const READ_RE = /localStorage\s*\.\s*getItem\s*\(\s*([^,)]+?)\s*[,)]/g;
const WRITE_RE = /localStorage\s*\.\s*(?:setItem|removeItem)\s*\(\s*([^,)]+?)\s*[,)]/g;
const IDB_RE = /indexedDB\s*\.\s*open\s*\(\s*([^,)]+?)\s*[,)]/g;
/* _shared/media-db.js is to IndexedDB what store.js is to localStorage: after
   a tool adopts it, the tool's source no longer contains indexedDB.open() at
   all, and without this the database would drop out of the scan — the same
   silent disappearance STORE_WRITE_RE exists to stop one layer down. A call
   with an explicit `db:` names its own database (bmg-maps, whose records
   predate the module); a call without one is in the shared default. */
const MEDIA_STORE_RE = /MediaDB\s*\.\s*store\s*\(\s*\{([^}]*)\}/g;
const MEDIA_DEFAULT_DB = 'gvb-media';
/* _shared/store.js is the site's storage primitive, so a tool that adopts it
   stops calling localStorage at all. Without these two, every adopter would
   silently drop out of the guard as adoption spreads — the exact failure this
   file exists to prevent, arriving through the front door.

   Two tools already have a private object of their own called `Store` (028 and
   039, each with its own save/load/remove over a DATA_PREFIX). Their calls are
   NOT the shared primitive, so a file that declares its own `Store` is skipped
   — and those two will have to rename theirs before they can adopt the real
   one, which is worth knowing before Path 4 P4 gets to them. */
const OWN_STORE_RE = /(?:var|let|const)\s+Store\s*=/;
const STORE_WRITE_RE = /\bStore\s*\.\s*(?:set|remove)\s*\(\s*([^,)]+?)\s*[,)]/g;
const STORE_READ_RE = /\bStore\s*\.\s*get\s*\(\s*([^,)]+?)\s*[,)]/g;
/* _shared/roster.js is to np_rosters what store.js is to localStorage. After a
   tool adopts the shared picker its source no longer contains the key at all —
   Path 3 P3 moved 25 pages at once — and the largest read set on this site would
   silently drop out of this scan. A Roster.* call is therefore a read of
   np_rosters, and the identity half of the module reads the sidecar too. Only
   the reads: the module is the writer of both, and _shared/ already declares
   that on the `shared` row. */
const ROSTER_RE = /\bRoster\s*\.\s*(?:listRosters|getRoster|mountRosterPicker|onChange|parseNames|newId)\b/;
const ROSTER_IDENTITY_RE = /\bRoster\s*\.\s*(?:getStudents|getStudentMeta|resolve|matchName|diffNames|syncRecords|reconcile|trackRenames)\b/;

/* assets/js/gvb-save.js writes through createSaveSlot({key}), so a scan of
   localStorage call sites cannot see those keys at all — the Name Picker's
   fourteen came out attributed to nothing, and np_rosters looked as though only
   006 wrote it. In a file that imports createSaveSlot, a `key:` property is a
   write. Two files do this: np-store.js and seating.mjs.
   ...UNLESS the slot is handed its own `storage`. np-store.js's np_bundle is an
   export/import slot built on a memory stub — "given a memory stub so it can
   never become a real key" — and a rule that reads `key:` alone invents it as a
   fifteenth localStorage key that will never exist. Each slot is therefore read
   as a whole object, not as a bare property. */
const SLOT_KEY_RE = /\bkey\s*:\s*(['"][^'"]+['"]|[A-Za-z_$][\w$]*)\s*[,}\n]/g;
/* A tool that wraps localStorage in its own readJson(key)/writeJson(key, v)
   hides every one of its keys from a call-site scan: the only argument the
   scanner ever sees is the wrapper's own parameter. 006 Class Roster Hub does
   exactly this, and its three crh_* keys — the roster sidecar, the withdrawn
   list and the year archive, all of them student data — came out invisible.
   So wrappers are found first, and their call sites are scanned too. */
const FN_DECL_RE = /function\s+([A-Za-z_$][\w$]*)\s*\(\s*([A-Za-z_$][\w$]*)/g;
/* a one-line key builder: function f(x) { return PREFIX + x; } or `lit${x}` */
const FN_RE = /function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*return\s+(?:([A-Za-z_$][\w$]*)\s*\+|`([^`$]*)\$\{)/g;

const sources = new Map();
const bindings = new Map();      // file -> Map(name -> literal)
const builders = new Map();      // file -> Map(fnName -> prefix)
for (const f of FILES) {
  const src = fs.readFileSync(path.join(SITE, f), 'utf8');
  sources.set(f, src);
  const b = new Map();
  for (const m of src.matchAll(BIND_RE)) if (!b.has(m[1])) b.set(m[1], m[3]);
  bindings.set(f, b);
}
for (const f of FILES) {
  const b = bindings.get(f);
  const fn = new Map();
  for (const m of sources.get(f).matchAll(FN_RE)) {
    if (m[2] && b.has(m[2])) fn.set(m[1], b.get(m[2]));
    else if (m[3]) fn.set(m[1], m[3]);
  }
  builders.set(f, fn);
}

/* A name bound to the same literal in exactly one file can be resolved across
   files — 008 reads 005's key as window.SeatingLayout.SEATING_KEY. Ambiguous
   names (STORAGE_KEY, bound in a dozen files) are deliberately not resolved
   this way; they fall through to DYNAMIC and get acknowledged by hand. */
const globalNames = new Map();
for (const [f, b] of bindings) {
  for (const [name, lit] of b) {
    if (!globalNames.has(name)) globalNames.set(name, new Set());
    globalNames.get(name).add(lit);
    void f;
  }
}

/* ── resolve one call-site argument ─────────────────────────────────────── */

function resolveArg(raw, file) {
  const a = raw.trim();
  const b = bindings.get(file);

  let m = /^(['"])(.*)\1$/.exec(a);
  if (m) return { kind: 'key', value: m[2] };

  if (/^[A-Za-z_$][\w$]*$/.test(a)) {
    if (b.has(a)) return { kind: 'key', value: b.get(a) };
    // SCREAMING_CASE is how this site spells a constant; anything else is the
    // parameter of a generic helper that is handed the key by its caller.
    if (a === a.toLowerCase()) return { kind: 'passthrough', value: a };
    const seen = globalNames.get(a);
    if (seen && seen.size === 1) return { kind: 'key', value: [...seen][0] };
    return { kind: 'dynamic', value: a };
  }

  m = /^`([^`$]+)\$\{/.exec(a);
  if (m) return { kind: 'prefix', value: m[1] };

  m = /^(['"])([^'"]+)\1\s*\+/.exec(a);
  if (m) return { kind: 'prefix', value: m[2] };

  m = /^([A-Za-z_$][\w$]*)\s*\+/.exec(a);
  if (m && b.has(m[1])) return { kind: 'prefix', value: b.get(m[1]) };

  m = /^([A-Za-z_$][\w$]*)\s*\(/.exec(a);
  if (m && builders.get(file).has(m[1])) return { kind: 'prefix', value: builders.get(file).get(m[1]) };

  m = /^(?:[A-Za-z_$][\w$]*\s*\.\s*)+([A-Za-z_$][\w$]*)$/.exec(a);
  if (m) {
    if (b.has(m[1])) return { kind: 'key', value: b.get(m[1]) };
    const seen = globalNames.get(m[1]);
    if (seen && seen.size === 1) return { kind: 'key', value: [...seen][0] };
  }

  return { kind: 'dynamic', value: a.replace(/\s+/g, ' ').slice(0, 60) };
}

/* The object literal that encloses `at`, found by counting braces outwards.
   Quotes and comments are not tracked, which is fine for the two save-slot
   tables this reads and would not be for arbitrary source. */
function enclosingObject(src, at) {
  let depth = 0, start = -1;
  for (let i = at; i >= 0; i--) {
    if (src[i] === '}') depth++;
    else if (src[i] === '{') { if (depth === 0) { start = i; break; } depth--; }
  }
  if (start < 0) return '';
  depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return src.slice(start, start + 2000);
}

/* Functions whose first parameter is handed straight to localStorage. Returns
   Map(name -> 'read'|'write'); a wrapper that does both counts as a write,
   because a key it can write is a key the tool owns. */
function findWrappers(src) {
  const out = new Map();
  for (const m of src.matchAll(FN_DECL_RE)) {
    const body = enclosingBody(src, m.index + m[0].length);
    if (!body) continue;
    const p = m[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    /* Both storage spellings, for the same reason STORE_WRITE_RE exists above:
       a tool that wraps its keys AND adopts _shared/store.js hides them twice
       over. 006 Class Roster Hub is the first to do both — its writeJson(key, v)
       became Store.set(key, v, {raw:true}) when it adopted the primitive — and
       without this its three crh_* keys, all student data, went from visible to
       STALE ("declared by class-roster-hub, written by nothing in the tree").
       Adoption must never be the thing that drops a tool out of this guard. */
    const writes = new RegExp('(?:localStorage\\s*\\.\\s*(?:setItem|removeItem)|Store\\s*\\.\\s*(?:set|remove))\\s*\\(\\s*' + p + '\\s*[,)]').test(body);
    const reads = new RegExp('(?:localStorage\\s*\\.\\s*getItem|Store\\s*\\.\\s*get)\\s*\\(\\s*' + p + '\\s*[,)]').test(body);
    if (writes) out.set(m[1], 'write');
    else if (reads && !out.has(m[1])) out.set(m[1], 'read');
  }
  return out;
}

/* The body of the function whose parameter list starts at `from`. */
function enclosingBody(src, from) {
  const open = src.indexOf('{', src.indexOf(')', from));
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < src.length && i < open + 4000; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  return src.slice(open, open + 4000);
}

/* ── extract ────────────────────────────────────────────────────────────── */

const found = new Map();   // file -> {keys:Set, prefixes:Set, dynamic:Set, idb:Set}
for (const f of FILES) {
  const src = sources.get(f);
  const rec = {
    keys: new Set(), prefixes: new Set(), dynamic: new Set(), idb: new Set(),
    readKeys: new Set(), readPrefixes: new Set(),
  };
  /* Written and read are tracked apart, because ownership is what the registry
     records and a dozen tools READ np_rosters without owning it. A tool that
     only ever getItem()s a key belongs in the owner's readers list, not in a
     second claim on the key. 010 is the one tool that WRITES another tool's
     key (hall-pass-log-sections), which is what makes this a real distinction
     rather than a naming convention. */
  for (const m of src.matchAll(WRITE_RE)) {
    const r = resolveArg(m[1], f);
    if (r.kind === 'key') rec.keys.add(r.value);
    else if (r.kind === 'prefix') rec.prefixes.add(r.value);
    else if (r.kind === 'dynamic') rec.dynamic.add(r.value);
  }
  for (const m of src.matchAll(READ_RE)) {
    const r = resolveArg(m[1], f);
    if (r.kind === 'key') rec.readKeys.add(r.value);
    else if (r.kind === 'prefix') rec.readPrefixes.add(r.value);
    else if (r.kind === 'dynamic') rec.dynamic.add(r.value);
  }
  if (!f.endsWith('_shared/store.js') && !OWN_STORE_RE.test(src)) {
    for (const m of src.matchAll(STORE_WRITE_RE)) {
      const r = resolveArg(m[1], f);
      if (r.kind === 'key') rec.keys.add(r.value);
      else if (r.kind === 'prefix') rec.prefixes.add(r.value);
      else if (r.kind === 'dynamic') rec.dynamic.add(r.value);
    }
    for (const m of src.matchAll(STORE_READ_RE)) {
      const r = resolveArg(m[1], f);
      if (r.kind === 'key') rec.readKeys.add(r.value);
      else if (r.kind === 'prefix') rec.readPrefixes.add(r.value);
      else if (r.kind === 'dynamic') rec.dynamic.add(r.value);
    }
  }
  if (!f.startsWith('_shared/')) {
    if (ROSTER_RE.test(src) || ROSTER_IDENTITY_RE.test(src)) rec.readKeys.add('np_rosters');
    if (ROSTER_IDENTITY_RE.test(src)) rec.readKeys.add('crh_students_v1');
  }
  if (/createSaveSlot/.test(src) && !f.endsWith('assets/js/gvb-save.js')) {
    for (const m of src.matchAll(SLOT_KEY_RE)) {
      /* The slot's OWN object decides. np-store.js's fourteen real slots are
         rows of a KEYS table with no storage of their own (the caller passes
         defaultStorage()); np_bundle names a memory stub right there beside
         its key, and is the one to drop. */
      if (/memory/i.test(enclosingObject(src, m.index))) continue;
      const r = resolveArg(m[1], f);
      if (r.kind === 'key') rec.keys.add(r.value);
      else if (r.kind === 'prefix') rec.prefixes.add(r.value);
    }
  }
  for (const [fn, kind] of findWrappers(src)) {
    const re = new RegExp('\\b' + fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\(\\s*([^,)]+?)\\s*[,)]', 'g');
    for (const m of src.matchAll(re)) {
      const r = resolveArg(m[1], f);
      if (r.kind === 'key') (kind === 'write' ? rec.keys : rec.readKeys).add(r.value);
      else if (r.kind === 'prefix') (kind === 'write' ? rec.prefixes : rec.readPrefixes).add(r.value);
    }
  }
  for (const m of src.matchAll(IDB_RE)) {
    const r = resolveArg(m[1], f);
    if (r.kind === 'key') rec.idb.add(r.value);
    else if (r.kind === 'dynamic') rec.dynamic.add('indexedDB.open(' + r.value + ')');
  }
  if (!f.endsWith('_shared/media-db.js')) {
    for (const m of src.matchAll(MEDIA_STORE_RE)) {
      const db = /\bdb\s*:\s*([^,}]+)/.exec(m[1]);
      if (!db) { rec.idb.add(MEDIA_DEFAULT_DB); continue; }
      const r = resolveArg(db[1], f);
      if (r.kind === 'key') rec.idb.add(r.value);
      else rec.dynamic.add('MediaDB.store({ db: ' + r.value + ' })');
    }
  }
  if (rec.keys.size || rec.prefixes.size || rec.dynamic.size || rec.idb.size ||
      rec.readKeys.size || rec.readPrefixes.size) found.set(f, rec);
}

/* ── which tool owns a file ─────────────────────────────────────────────── */

const TOOL_PAGE = /^Tools\/(\d{3})-(.+)\.html$/;
const toolOfFolder = new Map();
/* folder -> tool number -> how many times that page references the folder.
   First-reference-wins was wrong and quietly cost the Name Picker its own keys:
   006 links to name-picker/ once, 007 IS the Name Picker and reaches into its
   folder for scripts, fonts and styles a dozen times, but 006 is read first.
   The tool that references a folder most is the tool that owns it. */
const folderHits = new Map();
for (const f of FILES) {
  const tp = TOOL_PAGE.exec(f);
  if (!tp) continue;
  /* A tool reaches its own folder four ways here, and only the first is an
     HTML attribute: `src="np-store.js"`, `import ... from
     'name-picker/np-store.js'`, `url('name-picker/fonts/...')` in a @font-face,
     and a dynamic `import('...')`. Matching src/href alone left five tools'
     modules unattributed and pooled their keys under "site". */
  const FOLDER_RE = /(?:(?:src|href)\s*=\s*["']|from\s*["']\.?\/?|url\(\s*["']?|import\(\s*["'])([A-Za-z0-9._-]+)\//g;
  for (const m of sources.get(f).matchAll(FOLDER_RE)) {
    if (m[1] === '..' || m[1] === '.' || m[1] === 'Tools') continue;
    if (!folderHits.has(m[1])) folderHits.set(m[1], new Map());
    const hits = folderHits.get(m[1]);
    hits.set(tp[1], (hits.get(tp[1]) || 0) + 1);
  }
}
for (const [folder, hits] of folderHits) {
  let best = null, bestN = -1;
  for (const [tool, n] of [...hits].sort()) if (n > bestN) { best = tool; bestN = n; }
  toolOfFolder.set(folder, best);
}

function toolOf(file) {
  const tp = TOOL_PAGE.exec(file);
  if (tp) return tp[1];
  const m = /^Tools\/([^/]+)\//.exec(file);
  if (m && toolOfFolder.has(m[1])) return toolOfFolder.get(m[1]);
  return 'site';
}

const byTool = new Map();
for (const [f, rec] of found) {
  const t = toolOf(f);
  if (!byTool.has(t)) {
    byTool.set(t, {
      keys: new Set(), prefixes: new Set(), dynamic: new Map(), idb: new Set(),
      readKeys: new Set(), readPrefixes: new Set(), files: [],
    });
  }
  const agg = byTool.get(t);
  agg.files.push(f);
  rec.keys.forEach(k => agg.keys.add(k));
  rec.prefixes.forEach(k => agg.prefixes.add(k));
  rec.idb.forEach(k => agg.idb.add(k));
  rec.readKeys.forEach(k => agg.readKeys.add(k));
  rec.readPrefixes.forEach(k => agg.readPrefixes.add(k));
  rec.dynamic.forEach(d => agg.dynamic.set(d, f));
}

if (AS_JSON) {
  const out = {};
  for (const [t, agg] of [...byTool].sort()) {
    out[t] = {
      files: agg.files.sort(),
      keys: [...agg.keys].sort(),
      prefixes: [...agg.prefixes].sort(),
      idb: [...agg.idb].sort(),
      reads: [...agg.readKeys].filter(k => !agg.keys.has(k)).sort(),
      readPrefixes: [...agg.readPrefixes].filter(x => !agg.prefixes.has(x)).sort(),
      dynamic: [...agg.dynamic].map(([d, f]) => `${d}   (${f})`).sort(),
    };
  }
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

/* ── load the registry ──────────────────────────────────────────────────── */

const REG_PATH = path.join(SITE, '_shared', 'tool-registry.js');
if (!fs.existsSync(REG_PATH)) {
  console.error('check-registry: _shared/tool-registry.js does not exist.');
  process.exit(1);
}
const ctx = vm.createContext({});
vm.runInContext('var window = this;', ctx);
vm.runInContext(fs.readFileSync(REG_PATH, 'utf8'), ctx, { filename: '_shared/tool-registry.js' });
const REG = ctx.ToolRegistry;
if (!REG || !Array.isArray(REG.tools)) {
  console.error('check-registry: _shared/tool-registry.js did not publish window.ToolRegistry.tools.');
  process.exit(1);
}

/* ── 4. SHAPE ───────────────────────────────────────────────────────────── */

const claimedKey = new Map();
const declaredWrites = new Set();
const claimedPrefix = new Map();
const rowOf = new Map();
for (const row of REG.tools) {
  for (const f of ['slug', 'title', 'file', 'category']) {
    if (!row[f] || typeof row[f] !== 'string') {
      problems.push(`SHAPE       ${row.slug || JSON.stringify(row).slice(0, 40)}\n            missing or non-string "${f}"`);
    }
  }
  if (row.file && !fs.existsSync(path.join(SITE, decodeURIComponent(row.file)))) {
    problems.push(`SHAPE       ${row.slug}\n            file "${row.file}" is not on disk`);
  }
  if (rowOf.has(row.slug)) problems.push(`SHAPE       ${row.slug}\n            two rows share this slug`);
  rowOf.set(row.slug, row);
  const num = /^Tools\/(\d{3})-/.exec(decodeURIComponent(row.file || ''));
  if (num) rowOf.set(num[1], row);

  for (const k of row.keys || []) {
    if (claimedKey.has(k.k)) {
      problems.push(`SHAPE       ${k.k}\n            owned by both ${claimedKey.get(k.k)} and ${row.slug} — one should declare it in "writes" instead`);
    }
    claimedKey.set(k.k, row.slug);
  }
  for (const p of row.prefixes || []) {
    if (claimedPrefix.has(p.p)) {
      problems.push(`SHAPE       ${p.p}\n            owned by both ${claimedPrefix.get(p.p)} and ${row.slug} — one should declare it in "writes" instead`);
    }
    claimedPrefix.set(p.p, row.slug);
  }
  for (const w of row.writes || []) declaredWrites.add(w);
}
for (const w of declaredWrites) {
  if (!claimedKey.has(w) && !claimedPrefix.has(w)) {
    problems.push(`SHAPE       ${w}\n            in a "writes" list but owned by no row — a handoff needs an owner`);
  }
}
for (const f of FILES) {
  const tp = TOOL_PAGE.exec(f);
  if (tp && !rowOf.has(tp[1])) {
    problems.push(`SHAPE       ${f}\n            a numbered tool page with no registry row`);
  }
}

/* A key is covered if some row declares it, or declares a prefix it starts
   with. Prefix rows cover the family; that is what they are for. */
/* A `legacy` declaration exists so 009 can still NAME a key a teacher has left
   over from an older build. It deliberately does not count as coverage here: an
   old broad prefix like `gvb-review-board:` would otherwise absorb every new key
   the tool ever adds, and the guard would go quiet exactly when it mattered. */
const livePrefixList = REG.tools.flatMap(r => (r.prefixes || []).filter(e => !e.legacy).map(e => e.p));
const liveKeySet = new Set(REG.tools.flatMap(r => (r.keys || []).filter(e => !e.legacy).map(e => e.k)));
function coveredKey(k) {
  return liveKeySet.has(k) || livePrefixList.some(p => k.startsWith(p));
}
function coveredPrefix(p) {
  return livePrefixList.includes(p) || livePrefixList.some(q => p.startsWith(q)) ||
         [...liveKeySet].some(k => k.startsWith(p));
}

/* ── 1. UNREGISTERED and 3. DYNAMIC ─────────────────────────────────────── */

for (const [t, agg] of [...byTool].sort()) {
  if (ONLY && t !== ONLY) continue;
  const row = rowOf.get(t);
  const where = agg.files.slice(0, 2).join(', ') + (agg.files.length > 2 ? `, +${agg.files.length - 2}` : '');
  for (const k of [...agg.keys].sort()) {
    if (!coveredKey(k)) {
      problems.push(`UNREGISTERED ${k}\n            written by ${where}, declared by no registry row`);
    }
  }
  for (const p of [...agg.prefixes].sort()) {
    if (!coveredPrefix(p)) {
      problems.push(`UNREGISTERED ${p}*\n            a key prefix built in ${where}, declared by no registry row`);
    }
  }
  const acked = new Set((row && row.dynamic) || []);
  for (const [d, f] of [...agg.dynamic].sort()) {
    if (!acked.has(d)) {
      problems.push(`DYNAMIC     ${d}\n            an unresolvable key in ${f}; add it verbatim to ${row ? row.slug : t}'s "dynamic" list once you have checked what it can be`);
    }
  }
}

/* ── 2. STALE ───────────────────────────────────────────────────────────── */

if (!ONLY) {
  const liveKeys = new Set();
  const livePrefixes = new Set();
  for (const agg of byTool.values()) {
    agg.keys.forEach(k => liveKeys.add(k));
    agg.prefixes.forEach(p => livePrefixes.add(p));
  }
  for (const [k, slug] of claimedKey) {
    /* A `legacy` key is one nothing writes any more but a teacher may still
       have on disk — a11y.js migrates gvb-tools-theme once and never writes it.
       It stays declared or 009 cannot name it in that teacher's backup. */
    const owner = REG.tools.find(r => (r.keys || []).some(e => e.k === k));
    if (owner && owner.keys.find(e => e.k === k).legacy) continue;
    if (!liveKeys.has(k) && ![...livePrefixes].some(p => k.startsWith(p))) {
      warnings.push(`STALE       ${k}\n            declared by ${slug}, written by nothing in the tree`);
    }
  }
  for (const [p, slug] of claimedPrefix) {
    const ownerP = REG.tools.find(r => (r.prefixes || []).some(e => e.p === p));
    if (ownerP && ownerP.prefixes.find(e => e.p === p).legacy) continue;
    if (!livePrefixes.has(p) && ![...liveKeys].some(k => k.startsWith(p))) {
      warnings.push(`STALE       ${p}*\n            declared by ${slug}, built by nothing in the tree`);
    }
  }
}

/* ── report ─────────────────────────────────────────────────────────────── */

for (const w of warnings.sort()) console.warn('check-registry: ' + w);

if (problems.length) {
  console.error(`\ncheck-registry: the registry and the tree disagree (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n`);
  for (const p of problems.sort()) console.error('  ' + p);
  console.error('\nA key no registry row declares is a key 009 Backup & Restore cannot name');
  console.error('and cannot classify — it shows up in a teacher\'s backup as "Other saved');
  console.error('data" and is treated as settings, so the year-end rollover keeps last');
  console.error('year\'s students instead of clearing them. Add it to _shared/tool-registry.js.');
  process.exit(1);
}

const keyCount = [...byTool.values()].reduce((n, a) => n + a.keys.size, 0);
const pfxCount = [...byTool.values()].reduce((n, a) => n + a.prefixes.size, 0);
console.log(`check-registry: OK — ${REG.tools.length} rows cover ${keyCount} keys and ${pfxCount} prefixes across ${found.size} files.`);
