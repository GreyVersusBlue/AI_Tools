// media-db.test.mjs — _shared/media-db.js: the record shape, the namespace,
// and what a reader gets when the browser has no IndexedDB at all. Plain
// Node, no browser.
//
//   node Tools/media/test/media-db.test.mjs
//
// media-db.js is a classic browser script ending in `})(window)`, so it cannot
// be imported; it is evaluated in a `vm` context over a fake `window`. The
// fake IndexedDB below is deliberately small — open/put/get/getAll/delete and
// nothing else — because what is worth asserting here is this module's own
// logic, not the browser's: that two tools sharing one database cannot see
// each other's records, that a listing carries no blobs, and that a record
// written by the code this module replaced is still a valid record.
//
// The assertion this file exists for is section 6: bmg-maps' records were
// written flat, before this module, and if `list()` or `get()` stopped
// reading them a teacher's cached maps would silently disappear from a tool
// that says it caches them. That is why media-db keeps records flat instead of
// wrapping them in a { meta } envelope.
//
// The parts that need a real browser — IndexedDB itself, canvas downscaling,
// the quota message — are driven in Tools/media/test/smoke-media-db.mjs
// against the adopter, 046.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { SITE } from '../../board-check/harness.mjs';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const SRC = fs.readFileSync(path.join(SITE, '_shared', 'media-db.js'), 'utf8');

/* ── a fake IndexedDB, just enough ───────────────────────────────────────
   Requests and transactions call their handlers asynchronously, as the real
   thing does: a module that resolved its promises synchronously here would
   pass and then hang in a browser. */
function fakeIndexedDb(seed = {}) {
  const dbs = {};                       // name -> { store -> Map }
  Object.keys(seed).forEach(name => {
    dbs[name] = {};
    Object.keys(seed[name]).forEach(store => {
      dbs[name][store] = new Map(Object.entries(seed[name][store]));
    });
  });
  const soon = fn => setTimeout(fn, 0);

  function objectStore(map, failOn) {
    return {
      get(key) {
        const req = {};
        soon(() => { req.result = map.get(key); req.onsuccess && req.onsuccess(); });
        return req;
      },
      getAll() {
        const req = {};
        soon(() => { req.result = [...map.values()]; req.onsuccess && req.onsuccess(); });
        return req;
      },
      put(rec) {
        if (failOn === 'put') { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }
        map.set(rec.id, rec);
        return {};
      },
      delete(key) { map.delete(key); return {}; },
    };
  }

  return {
    __dbs: dbs,
    failOn: null,
    open(name) {
      const req = {};
      const self = this;
      soon(() => {
        const fresh = !dbs[name];
        if (fresh) dbs[name] = {};
        const db = {
          name,
          objectStoreNames: { contains: s => !!dbs[name][s] },
          createObjectStore(s) { dbs[name][s] = new Map(); return objectStore(dbs[name][s]); },
          transaction(storeName) {
            if (!dbs[name][storeName]) dbs[name][storeName] = new Map();
            const t = {
              objectStore: () => objectStore(dbs[name][storeName], self.failOn),
            };
            soon(() => { t.oncomplete && t.oncomplete(); });
            return t;
          },
        };
        req.result = db;
        if (fresh && req.onupgradeneeded) req.onupgradeneeded();
        req.onsuccess && req.onsuccess();
      });
      return req;
    },
  };
}

function load({ idb = fakeIndexedDb(), noIdb = false } = {}) {
  const win = {
    Blob: class { constructor(parts, o = {}) { this.parts = parts; this.type = o.type || ''; this.size = 7; } },
    console,
    setTimeout,
  };
  if (!noIdb) win.indexedDB = idb;
  const ctx = vm.createContext(win);
  vm.runInContext('var window = this;', ctx);
  vm.runInContext(SRC, ctx, { filename: '_shared/media-db.js' });
  return { MediaDB: ctx.MediaDB, idb };
}

const blob = (size = 100, type = 'image/jpeg') => ({ size, type });

/* ── 1. The record shape ─────────────────────────────────────────────────── */
{
  const { MediaDB } = load();
  const rec = MediaDB.buildRecord('seating/ada', blob(2048, 'image/jpeg'), { name: 'Ada', crop: { x: 1 } });
  eq(rec.id, 'seating/ada', '1: the id is the on-disk key');
  eq(rec.size, 2048, '1: size comes off the blob, so a listing can add bytes up without reading any');
  eq(rec.type, 'image/jpeg', '1: type comes off the blob');
  eq(rec.name, 'Ada', '1: a caller\'s metadata rides along flat');
  eq(rec.crop, { x: 1 }, '1: ...including nested metadata');
  ok(typeof rec.savedAt === 'number', '1: savedAt is stamped');

  // The module's own four fields are written last on purpose.
  const clash = MediaDB.buildRecord('x', blob(9, 'image/png'), { id: 'not-this', size: 1, type: 'text/plain' });
  eq([clash.id, clash.size, clash.type], ['x', 9, 'image/png'], '1: metadata cannot overwrite id, size or type');
}

/* ── 2. Namespacing is a prefix, not a database ──────────────────────────── */
{
  const { MediaDB } = load();
  eq(MediaDB.nsKey('seating', 'ada'), 'seating/ada', '2: a namespaced id is prefixed');
  eq(MediaDB.nsKey('', 'ada'), 'ada', '2: no namespace, no prefix');
  eq(MediaDB.unNsKey('seating', 'seating/ada'), 'ada', '2: and stripped on the way back');
  eq(MediaDB.unNsKey('seating', 'timeline/ada'), null, '2: another namespace\'s record is not ours');
  eq(MediaDB.unNsKey('seating', 'seating/a/b'), 'a/b', '2: only the prefix is removed — an id may contain "/"');
  ok((() => { try { MediaDB.nsKey('seating', ''); return false; } catch (e) { return true; } })(),
    '2: an empty id is refused rather than written as the namespace itself');
  ok((() => { try { MediaDB.store({ ns: 'a/b' }); return false; } catch (e) { return true; } })(),
    '2: a namespace containing "/" is refused — it would collide with another');
}

/* ── 3. A listing carries no bytes ───────────────────────────────────────── */
{
  const { MediaDB } = load();
  const rec = MediaDB.buildRecord('seating/ada', blob(2048), { name: 'Ada' });
  const listed = MediaDB.withoutBlob(rec, 'seating');
  ok(!('blob' in listed), '3: the blob is dropped');
  eq(listed.id, 'ada', '3: the id comes back in the caller\'s terms');
  eq([listed.size, listed.name], [2048, 'Ada'], '3: size and metadata survive, so a picker can be drawn from a listing alone');
}

/* ── 4. Two tools, one database, no crosstalk ────────────────────────────── */
{
  const { MediaDB } = load();
  const seating = MediaDB.store({ ns: 'seating' });
  const timeline = MediaDB.store({ ns: 'timeline' });
  await seating.put('ada', blob(10), { name: 'Ada' });
  await seating.put('grace', blob(20), { name: 'Grace' });
  await timeline.put('ada', blob(30), { name: 'a different Ada' });

  const mine = await seating.list();
  eq(mine.map(r => r.id).sort(), ['ada', 'grace'], '4: a namespace lists only its own records');
  eq((await timeline.list()).length, 1, '4: ...and so does the other one');
  eq((await seating.get('ada')).name, 'Ada', '4: the same id in two namespaces is two records');
  eq((await timeline.get('ada')).name, 'a different Ada', '4: ...and neither shadows the other');

  const usage = await seating.usage();
  eq(usage, { count: 2, bytes: 30 }, '4: usage counts this namespace only');

  eq(await seating.clear(), 2, '4: clear() reports what it removed');
  eq((await seating.list()).length, 0, '4: ...and removes it');
  eq((await timeline.list()).length, 1, '4: ...without touching the neighbour');
}

/* ── 5. A reader survives a browser with no IndexedDB ────────────────────── */
{
  const { MediaDB } = load({ noIdb: true });
  eq(await MediaDB.isAvailable(), false, '5: isAvailable() says so');
  eq(await MediaDB.get('anything'), null, '5: get() reads as "nothing stored"');
  eq(await MediaDB.list(), [], '5: list() is empty rather than a rejection');
  eq(await MediaDB.usage(), { count: 0, bytes: 0 }, '5: usage() is zero');
  // The write is the one that must NOT be quiet.
  let msg = null;
  await MediaDB.put('x', blob(1)).then(() => {}, e => { msg = e.message; });
  ok(msg && /gone when you close the tab/.test(msg),
    '5: put() rejects with something a teacher can read');
}

/* ── 6. Records written before this module existed are still records ─────── */
{
  // Exactly what Tools/blank-map-generator/bmg-map-cache.js wrote for two
  // years: flat, no `size`, no `savedAt`, its own `mime` and `cachedAt`.
  const legacy = {
    id: 'File:Europe.svg', title: 'Europe', blob: blob(4096, 'image/svg+xml'),
    mime: 'image/svg+xml', width: 800, height: 600,
    attribution: { artist: 'Someone' }, cachedAt: 1700000000000,
  };
  const { MediaDB } = load({ idb: fakeIndexedDb({ 'bmg-maps': { images: { 'File:Europe.svg': legacy } } }) });
  const maps = MediaDB.store({ db: 'bmg-maps', store: 'images' });

  const got = await maps.get('File:Europe.svg');
  eq(got.title, 'Europe', '6: a record written before media-db.js reads back whole');
  ok(got.blob, '6: ...blob and all');
  const listed = await maps.list();
  eq(listed.length, 1, '6: and it lists');
  eq([listed[0].mime, listed[0].cachedAt], ['image/svg+xml', 1700000000000],
    '6: with the fields the tool already reads — no migration, because the shape never changed');

  // usage() over records that predate `size` under-reports rather than throwing.
  eq(await maps.usage(), { count: 1, bytes: 0 }, '6: an old record has no size to count, and says 0');
}

/* ── 7. A quota failure is a message, not a boolean ──────────────────────── */
{
  const idb = fakeIndexedDb();
  idb.failOn = 'put';
  const { MediaDB } = load({ idb });
  let err = null;
  await MediaDB.put('x', blob(1)).then(() => {}, e => { err = e; });
  ok(err && err.quota === true, '7: a quota failure is flagged as one');
  ok(err && /Backup & Restore/.test(err.message), '7: ...and points at the page that can free space');
  ok(MediaDB.isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' }) &&
     MediaDB.isQuotaError({ code: 22 }) && MediaDB.isQuotaError({ code: 1014 }),
    '7: every name browsers actually use counts as one');
  ok(!MediaDB.isQuotaError({ name: 'AbortError' }), '7: ...and an unrelated failure does not');
}

/* ── 8. The downscaler's arithmetic ──────────────────────────────────────── */
{
  const { MediaDB } = load();
  const f = MediaDB.fitDimensions;
  eq(f(3000, 2000, 1600), { w: 1600, h: 1067 }, '8: the long edge lands on maxDim');
  eq(f(2000, 3000, 1600), { w: 1067, h: 1600 }, '8: ...whichever edge that is');
  eq(f(400, 300, 1600), { w: 400, h: 300 }, '8: a small image is never scaled UP');
  eq(f(4000, 3, 160), { w: 160, h: 1 }, '8: a sliver keeps at least one pixel rather than rounding to zero');
  eq(f(0, 0, 160), { w: 0, h: 0 }, '8: an undecodable size is 0, for the caller to refuse');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('\nFailures:'); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
