// envelope.test.mjs — the migration contract in _shared/store.js, driven under
// plain Node with no browser.
//
// store.js is a classic browser script that ends in `})(window)`, so it cannot
// be imported. It is evaluated here in a `vm` context carrying a fake window,
// a fake localStorage and a minimal event target — which is also the point of
// the exercise: everything this module decides about a payload is decidable
// without a DOM, and the browser half (the banner actually appearing on a full
// disk) is smoke-quota-banner.mjs's job, not this file's.

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

const SRC = fs.readFileSync(path.join(SITE, '_shared', 'store.js'), 'utf8');

/* A localStorage good enough to be wrong in the ways real ones are: it can be
   told to throw a QuotaExceededError, or to refuse every write the way a
   private-browsing window does. */
function fakeStorage({ full = false, blocked = false } = {}) {
  const map = new Map();
  const err = (name, code) => { const e = new Error(name); e.name = name; e.code = code; return e; };
  return {
    get length() { return map.size; },
    key(i) { return [...map.keys()][i] ?? null; },
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) {
      if (blocked) throw err('SecurityError', 18);
      if (full && k !== '__gvb_store_probe__') throw err('QuotaExceededError', 22);
      map.set(k, String(v));
    },
    removeItem(k) { map.delete(k); },
    __map: map,
  };
}

/* One Store per test, so a probe result or a banner from one case cannot leak
   into the next. Returns the Store plus the pieces a test wants to inspect. */
function makeStore(opts = {}) {
  const storage = opts.storage || fakeStorage(opts);
  const handlers = {};
  const dispatched = [];
  const body = { appendChild(el) { body.__children.push(el); el.isConnected = true; }, __children: [] };
  const win = {
    localStorage: storage,
    navigator: {},
    console: { error() {} },
    addEventListener(type, fn) { (handlers[type] ||= []).push(fn); },
    dispatchEvent(e) { dispatched.push(e); (handlers[e.type] || []).forEach(fn => fn(e)); return true; },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    document: {
      body,
      createElement: () => ({ style: { cssText: '' }, setAttribute() {}, textContent: '', isConnected: false }),
    },
    Promise,
    JSON,
    Object,
    Array,
    Error,
  };
  win.window = win;
  const ctx = vm.createContext(win);
  vm.runInContext(SRC, ctx, { filename: '_shared/store.js' });
  return { Store: win.Store, storage, win, banners: body.__children, handlers, dispatched };
}

const rawOf = (s, k) => s.storage.getItem(k);

console.log('Store — the migration contract (Path 4 P1)');

/* ── 1. The envelope round-trips, and stamps the version ─────────────── */
{
  const { Store, storage } = makeStore();
  const res = Store.set('k', { a: 1 }, { version: 3 });
  ok(res.ok, '1: set reports ok');
  eq(JSON.parse(storage.getItem('k')), { v: 3, data: { a: 1 } }, '1: on disk as {v, data}');
  eq(Store.get('k', { version: 3 }), { a: 1 }, '1: reads back');
  ok(res.bytes > 0, '1: reports the bytes it wrote');
}

/* ── 2. Rule 2: every legacy shape reads as version 0 ────────────────── */
{
  const cases = [
    ['a bare object', '{"rooms":[]}', { rooms: [] }],
    ['a bare array', '[1,2,3]', [1, 2, 3]],
    ['a bare string', '"hello"', 'hello'],
    ['a bare number', '42', 42],
    ['a {v:1} payload with no data property', '{"v":1,"text":"x"}', { v: 1, text: 'x' }],
  ];
  for (const [what, disk, want] of cases) {
    const { Store, storage } = makeStore();
    storage.setItem('k', disk);
    eq(Store._unwrap(disk), { data: want, version: 0 }, `2: ${what} is legacy v0`);
    // and it is reachable through get() with an identity migrate
    eq(Store.get('k', { version: 1, migrate: (from, d) => d }), want, `2: ${what} survives an identity migrate`);
  }
  // The 080/063 spelling is deliberately NOT special-cased: `{v:1, text:...}`
  // has no `data` property, so it is a legacy blob, not an envelope. Recorded
  // because it is the one case a reader will expect to go the other way.
}

/* ── 3. Rule 2's exception: a gvb-save payload reads at its own __v ──── */
{
  const { Store, storage } = makeStore();
  storage.setItem('k', JSON.stringify({ name: 'board', __v: 2 }));
  eq(Store._unwrap(rawOf({ storage }, 'k')).version, 2, '3: __v is the version');
  eq(Store.get('k', { version: 2 }), { name: 'board', __v: 2 }, '3: read at its own version, no migrate needed');
  eq(Store.get('k', { version: 3, migrate: (from, d) => ({ ...d, up: from }) }),
    { name: 'board', __v: 2, up: 2 }, '3: migrate is told it came from 2, not 0');
}

/* ── 4. Rules 3 and 4: refusal returns the default and keeps the disk ── */
{
  const { Store, storage } = makeStore();
  storage.setItem('k', '{"rooms":[]}');

  eq(Store.get('k', { version: 2, default: 'DEF' }), 'DEF', '4: no migrate for an older payload refuses');
  eq(storage.getItem('k'), '{"rooms":[]}', '4: ...and leaves it on disk');

  eq(Store.get('k', { version: 2, default: 'DEF', migrate: () => null }), 'DEF', '4: a null migrate refuses');
  eq(Store.get('k', { version: 2, default: 'DEF', migrate: () => { throw new Error('nope'); } }),
    'DEF', '4: a throwing migrate refuses instead of propagating');
  eq(storage.getItem('k'), '{"rooms":[]}', '4: a refusal never destroys the payload');

  eq(Store.get('missing', { default: [] }), [], '4: an absent key is the default');
  storage.setItem('bad', '{not json');
  eq(Store.get('bad', { default: 'DEF' }), 'DEF', '4: unparsable is the default');
  eq(storage.getItem('bad'), '{not json', '4: ...and is also left alone');
}

/* ── 5. migrate does not run when the payload is current or newer ────── */
{
  const { Store } = makeStore();
  let ran = 0;
  Store.set('k', { a: 1 }, { version: 2 });
  Store.get('k', { version: 2, migrate: () => { ran++; return {}; } });
  Store.get('k', { version: 1, migrate: () => { ran++; return {}; } });
  eq(ran, 0, '5: migrate is skipped at equal and at newer versions');
}

/* ── 6. onChange fires in this tab, which `storage` alone never does ─── */
{
  const { Store, handlers } = makeStore();
  const seen = [];
  const off = Store.onChange('k', (v, key) => seen.push([key, v]));

  Store.set('k', { n: 1 });
  eq(seen, [['k', { n: 1 }]], '6: fires for a write in the writing tab');

  Store.remove('k');
  eq(seen[1], ['k', null], '6: fires with null on remove');

  // The cross-tab half: replay the `storage` event store.js subscribed to,
  // carrying the raw envelope another tab would have written.
  seen.length = 0;
  ok(Array.isArray(handlers.storage) && handlers.storage.length === 1,
    '6: exactly one storage listener was registered');
  handlers.storage[0]({ key: 'k', newValue: JSON.stringify({ v: 1, data: { n: 9 } }) });
  eq(seen, [['k', { n: 9 }]], '6: fires for another tab’s write');

  seen.length = 0;
  handlers.storage[0]({ key: null, newValue: null });   // localStorage.clear()
  eq(seen, [], '6: a keyless storage event is ignored, not treated as key ""');

  seen.length = 0;
  Store.set('unrelated', 1);
  eq(seen, [], '6: another key does not notify');

  off();
  Store.set('k', { n: 2 });
  eq(seen, [], '6: unsubscribe stops it');
}

/* A subscriber that throws must not stop the ones behind it. */
{
  const { Store } = makeStore();
  const seen = [];
  Store.onChange('k', () => { throw new Error('bad subscriber'); });
  Store.onChange('k', v => seen.push(v));
  Store.set('k', 1);
  eq(seen, [1], '6: one throwing subscriber does not block the others');
}

/* ── 7. A full disk is never silent ──────────────────────────────────── */
{
  const { Store, banners } = makeStore({ full: true });
  Store.configure({ toolName: 'Escape Room Builder' });
  const res = Store.set('k', { a: 1 });

  ok(!res.ok, '7: set reports failure');
  ok(res.quota, '7: ...classified as quota');
  eq(banners.length, 1, '7: a banner was put on the page');
  ok(/Escape Room Builder/.test(banners[0].textContent), '7: the message names the tool');
  ok(/Backup & Restore/.test(banners[0].textContent), '7: ...and points at Backup & Restore');
  eq(Store.get('k', { default: 'DEF' }), 'DEF', '7: nothing was written');
}

/* ── 8. A tool's own handler replaces the banner but cannot silence it ─ */
{
  const { Store, banners } = makeStore({ full: true });
  const calls = [];
  Store.configure({ toolName: 'T', onQuota: (info) => calls.push(info) });
  Store.set('k', 1);
  eq(calls.length, 1, '8: the tool’s handler ran');
  eq(calls[0].kind, 'quota', '8: told which failure it was');
  eq(banners.length, 0, '8: the default banner stayed away');

  const two = makeStore({ full: true });
  two.Store.configure({ toolName: 'T', onQuota: () => { throw new Error('bad handler'); } });
  two.Store.set('k', 1);
  eq(two.banners.length, 1, '8: a handler that throws falls back to the banner — never silence');
}

/* ── 9. Blocked storage keeps the session usable and says so ──────────── */
{
  const { Store, banners } = makeStore({ blocked: true });
  ok(Store.isBlocked(), '9: the write probe detected it');
  const res = Store.set('k', { a: 1 });
  ok(!res.ok && res.blocked && !res.quota, '9: reported as blocked, not quota');
  eq(banners.length, 1, '9: still visible');
  ok(/private browsing/.test(banners[0].textContent), '9: the message explains why');
  eq(Store.get('k', { default: 'DEF' }), { a: 1 }, '9: the in-memory fallback reads back in-session');
}

/* ── 10. The quota predicate covers what the four browsers actually set ─ */
{
  const { Store } = makeStore();
  const q = Store._isQuotaError;
  ok(q({ name: 'QuotaExceededError' }), '10: Chrome/Safari name');
  ok(q({ name: 'NS_ERROR_DOM_QUOTA_REACHED' }), '10: old Firefox name');
  ok(q({ code: 22 }), '10: code 22');
  ok(q({ code: 1014 }), '10: Firefox code 1014');
  ok(!q({ name: 'SecurityError', code: 18 }), '10: a blocked-storage error is not quota');
  ok(!q(null), '10: null is not quota');
}

/* ── 11. estimate() prefers the browser’s number, falls back to a walk ── */
{
  const { Store, win } = makeStore();
  Store.set('k', 'x'.repeat(100));
  const local = await Store.estimate();
  eq(local.source, 'localStorage', '11: falls back to walking the keys');
  ok(local.usage > 200, '11: ...and the walk counts UTF-16 bytes');

  win.navigator.storage = { estimate: () => Promise.resolve({ usage: 5, quota: 10 }) };
  const nav = await Store.estimate();
  eq(nav, { usage: 5, quota: 10, source: 'navigator' }, '11: prefers navigator.storage');

  win.navigator.storage = { estimate: () => Promise.reject(new Error('no')) };
  eq((await Store.estimate()).source, 'localStorage', '11: a rejecting estimate falls back');
}

/* ── 12. `raw: true` writes no envelope, for a cross-tool wire format ─── */
{
  // np_rosters is read by 28 tool pages with a plain JSON.parse. If _shared/
  // roster.js enveloped it, all 28 would show a teacher an empty roster list
  // and nothing would say why — so store.js has to be able to write a key bare
  // while keeping the quota report, the announce and the blocked fallback.
  const { Store, storage } = makeStore();
  const rosters = { 'Period 3': ['Ada Lovelace'] };
  const res = Store.set('np_rosters', rosters, { raw: true });
  ok(res.ok, '12: a raw write reports ok');
  eq(storage.getItem('np_rosters'), JSON.stringify(rosters), '12: on disk with no {v, data} wrapper');
  eq(JSON.parse(storage.getItem('np_rosters')), rosters, "12: a raw reader's JSON.parse sees the real thing");

  // and it round-trips back through the ordinary legacy path
  eq(Store._unwrap(storage.getItem('np_rosters')), { data: rosters, version: 0 },
    '12: a raw payload is legacy version 0, by rule 2');
  eq(Store.get('np_rosters', { default: {}, migrate: (from, d) => d }), rosters,
    '12: ...so an identity migrate reads it back unchanged');
  eq(Store.get('np_rosters', { default: 'refused' }), 'refused',
    '12: ...and with no migrate it is refused like any other legacy payload');
}

/* ── 13. A raw write is still never silent, and still announces ────────── */
{
  const { Store, storage, banners } = makeStore({ full: true });
  const res = Store.set('np_rosters', { P: ['Ada'] }, { raw: true });
  ok(!res.ok && res.quota, '13: a full disk fails a raw write like any other');
  ok(banners.length === 1, '13: ...and still shows the banner — raw is not a way around it');
  eq(storage.getItem('np_rosters'), null, '13: nothing was written');
}
{
  const { Store } = makeStore();
  const seen = [];
  Store.onChange('np_rosters', v => seen.push(v));
  Store.set('np_rosters', { P: ['Ada'] }, { raw: true });
  eq(seen, [{ P: ['Ada'] }], '13: a raw write notifies subscribers in the writing tab, unwrapped');
}

/* ── 14. reportWriteFailure: the never-silent path, lent out ──────────── */
{
  /* _shared/gvb-save.js writes through a `storage` object its callers inject
     (np-store.js's boxing wrapper, a suite's Map), so its failures cannot come
     through set(). They come through here instead, and must land on the same
     surface. */
  const { Store, banners } = makeStore();
  const quota = Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError', code: 22 });
  eq(Store.reportWriteFailure(quota), 'quota', '14: a quota error is classified as one');
  ok(banners.length === 1, '14: ...and shows the banner');
  ok(/storage for this site is\s+full/.test(banners[0].textContent),
    '14: with the full-disk wording: ' + JSON.stringify(banners[0].textContent));
}
{
  const { Store, banners } = makeStore();
  const other = Object.assign(new Error('SecurityError'), { name: 'SecurityError', code: 18 });
  eq(Store.reportWriteFailure(other), 'blocked', '14: anything else reads as blocked storage');
  ok(banners.length === 1, '14: ...and is still said out loud');
}
{
  /* configure({onQuota}) re-renders it; it cannot suppress it. Same rule as
     set()'s, and worth asserting on this entrance too. */
  const { Store, banners } = makeStore();
  const seen = [];
  Store.configure({ toolName: 'Name Picker', onQuota: e => seen.push(e) });
  Store.reportWriteFailure(Object.assign(new Error('q'), { name: 'QuotaExceededError' }));
  eq(seen.length, 1, '14: a tool handler receives the report');
  eq(seen[0].tool, 'Name Picker', '14: ...and it names the tool');
  ok(banners.length === 0, '14: the default banner steps aside for it');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
