// restore-kit.test.mjs — the restore logic 009 and a tool's own restore card
// share (_shared/restore-kit.js, Path 4 P5). Pure Node: the kit and the real
// tool registry run in a vm with a stub window and an in-memory storage.
//
//   node Tools/backup-restore/test/restore-kit.test.mjs
//
// What it holds: a tool's restore sees and writes only the keys the registry
// gives that tool (never another tool's, never a write probe); nothing is ever
// deleted; the three modes land the way the preview says they will.
//
// Exits 1 on any failure.

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

function memStorage(init) {
  const m = new Map(Object.entries(init || {}));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    keys: () => [...m.keys()].sort(),
    map: m,
  };
}

const storage = memStorage();
const window = { localStorage: storage };
const ctx = { window, document: { currentScript: null } };
vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(SITE, '_shared/tool-registry.js'), 'utf8'), ctx);
vm.runInContext(readFileSync(path.join(SITE, '_shared/restore-kit.js'), 'utf8'), ctx);
const RK = window.RestoreKit;

console.log('RestoreKit — the shared restore logic');

/* ── read ─────────────────────────────────────────────────────────────── */
ok(RK.read(null).error, 'read: a non-object is refused');
ok(RK.read({ data: [] }).error, 'read: an array data section is refused');
ok(RK.read({ data: {} }).error, 'read: an empty backup is refused');
const v1 = RK.read({ source: 'AsPerMyLessonPlan.com Backup & Restore', data: { a: '1' } });
eq(v1.envelope.formatVersion, 1, 'read: a stampless file from this site is version 1');
eq(v1.flags.length, 0, 'read: and raises no flag');
const stranger = RK.read({ data: { a: '1', b: 2 } });
eq(stranger.flags.filter(f => f.bad).length, 2, 'read: an unknown source and a non-text item are both flagged');
ok(RK.read({ formatVersion: 9, data: { a: '1' } }).flags.some(f => /newer version/.test(f.text)), 'read: a newer format says so');

/* ── ownedBy ──────────────────────────────────────────────────────────── */
const hall = RK.ownedBy('hall-pass-log');
ok(hall('hall-pass-log-sections'), 'ownedBy: Hall Pass owns hall-pass-log-sections');
ok(!hall('np_rosters'), 'ownedBy: Hall Pass does not own the Name Picker\'s np_rosters');
ok(!hall('gvb-command-center:settings'), 'ownedBy: nor 010\'s settings');
ok(!hall('not-a-registered-key'), 'ownedBy: nor a key nobody declares');
ok(RK.ownedBy('group-team-generator')('gtg:data:Period 2'), 'ownedBy: a prefix key belongs to its tool');
ok(!RK.ownedBy('shared')('__gvb_store_probe__'), 'ownedBy: a transient write probe is nobody\'s to restore');

/* ── groups + apply, scoped to one tool ───────────────────────────────── */
const here = {
  current: 'Period 3',
  sets: { 'Period 1': { names: ['Ada'] }, 'Period 3': { names: ['Nellie'] } },
};
const file = {
  current: 'Period 1',
  sets: { 'Period 1': { names: ['Ada', 'Marco'] }, 'Period 2': { names: ['Zheng'] } },
};
const ROSTERS_HERE = JSON.stringify({ 'Period 9': ['kept'] });
function freshDisk() {
  storage.map.clear();
  storage.setItem('hall-pass-log-sections', JSON.stringify(here));
  storage.setItem('np_rosters', ROSTERS_HERE);
}
const env = RK.read({
  formatVersion: 2,
  data: {
    'hall-pass-log-sections': JSON.stringify(file),
    'np_rosters': JSON.stringify({ 'Period 1': ['from the file'] }),
    'behavior-points-tracker-sections': JSON.stringify({ sets: {} }),
    'unregistered-thing': 'x',
  },
}).envelope;

freshDisk();
const g = RK.groups(env, 'replace', { filter: hall });
const ids = Object.keys(g);
eq(ids.length, 1, 'groups: a tool-scoped preview has only that tool\'s group');
const only = g[ids[0]];
eq(only.keys, ['hall-pass-log-sections'], 'groups: and only its key');
eq(only.kind, 'student', 'groups: the key\'s kind comes from the registry');
eq(only.replaced, ['Period 1'], 'replace: the clashing section is replaced');
eq(only.added, ['Period 2'], 'replace: the new section is added');
eq(only.lost, ['Period 3'], 'replace: the section only here is named as lost');
eq(RK.groups(env, 'merge', { filter: hall })[ids[0]].lost, [], 'merge: nothing is lost');
eq(RK.groups(env, 'fill', { filter: hall })[ids[0]].replaced, [], 'fill: nothing is replaced');

const unscoped = RK.groups(env, 'replace');
ok(Object.keys(unscoped).length >= 3, 'groups: unscoped (009) sees every tool\'s rows');
ok(Object.keys(unscoped).some(id => /^Other saved data/.test(id)), 'groups: an unregistered key is "Other saved data", as 009 always showed it');

freshDisk();
const resM = RK.apply(env, only.keys, 'merge');
eq(resM, { restored: 1, merged: 1, skipped: 0, failed: [] }, 'apply merge: one key written, combined');
const afterM = JSON.parse(storage.getItem('hall-pass-log-sections'));
eq(Object.keys(afterM.sets).sort(), ['Period 1', 'Period 2', 'Period 3'], 'apply merge: keeps the local-only section and adds the new one');
eq(afterM.sets['Period 1'].names, ['Ada', 'Marco'], 'apply merge: the file wins the clash');
eq(afterM.current, 'Period 3', 'apply merge: this computer\'s current section is kept');
eq(storage.getItem('np_rosters'), ROSTERS_HERE, 'apply: another tool\'s key is untouched');
eq(storage.getItem('behavior-points-tracker-sections'), null, 'apply: another tool\'s key is not created');

freshDisk();
RK.apply(env, only.keys, 'fill');
const afterF = JSON.parse(storage.getItem('hall-pass-log-sections'));
eq(afterF.sets['Period 1'].names, ['Ada'], 'apply fill: this computer wins the clash');
eq(Object.keys(afterF.sets).sort(), ['Period 1', 'Period 2', 'Period 3'], 'apply fill: the missing section arrives');

freshDisk();
RK.apply(env, only.keys, 'replace');
eq(storage.getItem('hall-pass-log-sections'), JSON.stringify(file), 'apply replace: the key is the file\'s, byte for byte');

/* Nothing is deleted: a tool key that exists only here survives any mode. */
storage.map.clear();
storage.setItem('gvb-rubric-builder:data:Only here', '{"x":1}');
const rubric = RK.read({ data: { 'gvb-rubric-builder:data:From file': '{"y":2}' } }).envelope;
const rg = RK.groups(rubric, 'replace', { filter: RK.ownedBy('rubric-builder') });
eq(Object.values(rg)[0].added, ['From file'], 'prefix key: a record-per-key file is shown by its name');
RK.apply(rubric, ['gvb-rubric-builder:data:From file'], 'replace');
eq(storage.keys(), ['gvb-rubric-builder:data:From file', 'gvb-rubric-builder:data:Only here'], 'apply replace never deletes a key the file lacks');

/* An unchanged key is skipped, not rewritten. */
eq(RK.apply(rubric, ['gvb-rubric-builder:data:From file'], 'replace').skipped, 1, 'apply: a key already equal to the file is left as it was');

/* A settings blob is all-or-nothing. */
eq(RK.combineValue('merge', '{"a":1,"b":2}', '{"a":3}'), '{"a":3}', 'combine: a flat settings blob is replaced whole under merge');
eq(RK.combineValue('fill', '{"a":1,"b":2}', '{"a":3}'), '{"a":1,"b":2}', 'combine: and kept whole under fill');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
