// rollover.test.mjs — the year rollover's archive check and its journal
// (Tools/backup-restore/br-rollover.js, Path 3 P6 increment 1). Pure Node:
// the module, RestoreKit and BrCrypto run in a vm with an in-memory storage.
//
//   node Tools/backup-restore/test/rollover.test.mjs
//
// What it holds: an archive passes its check only as the exact bytes that
// were built, and each way a file can be wrong is refused with its own
// reason; a clear removes a key only while it holds what the archive holds;
// a clear that fails at any step leaves the journal at that step, and
// finishing from there gives the storage an uninterrupted clear gives; the
// journal never holds a name or a value.
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

function memStorage(init, { failRemoveAt = -1, failJournalAt = -1, keepRemoveAt = -1 } = {}) {
  const m = new Map(Object.entries(init || {}));
  let removes = 0, journalWrites = 0;
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      if (k === 'br_rollover_v1' && journalWrites++ === failJournalAt) throw new Error('QuotaExceededError');
      m.set(k, String(v));
    },
    removeItem: k => {
      const n = removes++;
      if (n === failRemoveAt) throw new Error('refused');
      if (n !== keepRemoveAt) m.delete(k);   // keepRemoveAt: the browser says yes and keeps it
    },
    map: m,
    snapshot: () => Object.fromEntries([...m.entries()].filter(([k]) => k !== 'br_rollover_v1').sort()),
  };
}

const window = { crypto: globalThis.crypto, TextEncoder };
const ctx = { window, document: { currentScript: null }, TextEncoder, globalThis: {} };
vm.createContext(ctx);
for (const f of ['_shared/tool-registry.js', '_shared/restore-kit.js', '_shared/backup-crypto.js', 'Tools/backup-restore/br-rollover.js']) {
  vm.runInContext(readFileSync(path.join(SITE, f), 'utf8'), ctx);
}
const RO = window.BrRollover;
const deps = { read: window.RestoreKit.read, isEncrypted: p => window.BrCrypto.isEncrypted(p) };

console.log('BrRollover — the year archive, its check and the journal');

/* Made-up students; nobody real. */
const NAMES = ['Avery Stone', 'Blake Rivers', 'Casey Lund'];
const LOCAL = {
  np_rosters: JSON.stringify({ 'Period 3': NAMES }),
  np_history: JSON.stringify([{ name: 'Avery Stone', at: 1 }]),
  'hall-pass-log-sections': JSON.stringify({ sections: [{ name: 'Period 3', log: [{ who: 'Blake Rivers' }] }] }),
  'gvb-rubric-builder:data:Essay': JSON.stringify({ title: 'Essay', rows: 4 }),
  'gvb-a11y-prefs': '{"theme":"dark"}',
};
const PNG = Buffer.from('a tiny picture, eleven bytes long'.slice(0, 11)).toString('base64');
function envelopeOf(local) {
  return {
    source: 'AsPerMyLessonPlan.com backup', format: 'aspermylessonplan-backup', formatVersion: 2,
    exportedAt: '2027-06-18T15:00:00.000Z', label: '2026-27',
    meta: { groups: [], itemCount: Object.keys(local).length, byteCount: 0 },
    data: { ...local },
    indexedDB: {
      'gvb-media': { version: 1, stores: [{ name: 'media', keyPath: 'id', records: [
        { v: { id: 'seating/a1', blob: { __t: 'blob', mime: 'image/png', v: PNG } } },
        { v: { id: 'rgb/b2', blob: { __t: 'blob', mime: 'image/png', v: PNG } } },
      ] }] },
    },
  };
}

async function buildArchive(local, id = 'ro-test-1') {
  const env = envelopeOf(local);
  const manifest = await RO.manifest(env);
  env.rollover = RO.stamp({ id, label: '2026-27', manifest, plannedAt: '2027-06-18T15:00:00.000Z' });
  const text = JSON.stringify(env, null, 2);
  return { id, text, hash: await RO.hash(text), manifest, env };
}

/* ── hash, base64 ─────────────────────────────────────────────────────── */
{
  const h = await RO.hash('abc');
  eq(h, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'hash: SHA-256 of "abc", hex');
  eq(RO.hashKind(h), 'SHA-256', 'hash: says which hash it is');
  ok((await RO.hash('Avery Stone ✓')) !== (await RO.hash('Avery Stone ✓ ')), 'hash: one byte more is another hash');
  eq(RO.base64Bytes(PNG), 11, 'base64Bytes: the decoded size');
  eq(RO.base64Bytes(PNG.slice(0, -1)), -1, 'base64Bytes: a string cut short is not base64');
}

/* ── manifest ─────────────────────────────────────────────────────────── */
const A = await buildArchive(LOCAL);
{
  eq(Object.keys(A.manifest.local), Object.keys(LOCAL).sort(), 'manifest: every key, sorted');
  eq(A.manifest.local.np_rosters[0], LOCAL.np_rosters.length, 'manifest: a key\'s length');
  eq(A.manifest.databases, { 'gvb-media': { media: 2 } }, 'manifest: records per store');
  eq(A.manifest.blobs, { 'gvb-media': [2, 22] }, 'manifest: blobs and their decoded bytes');
  eq(A.env.formatVersion, 2, 'stamp: the envelope stays format 2, so an older reader still restores it');
  eq(RO.compareLocal(A.manifest.local, A.manifest.local), [], 'compareLocal: a manifest equals itself');
  const later = await RO.localManifest({ ...LOCAL, np_history: '[]', 'new-key': 'x' });
  eq(RO.compareLocal(A.manifest.local, later), ['new-key', 'np_history'], 'compareLocal: a changed key and an added key');
}

/* ── verify: the one file that passes, and each way a file is wrong ───── */
{
  const codes = async (text, expect = A) => (await RO.verify(text, expect, deps)).reasons.map(r => r.code);
  const good = await RO.verify(A.text, A, deps);
  ok(good.ok && good.reasons.length === 0, 'verify: the built text passes');

  eq(await codes(''), ['empty'], 'verify: a 0-byte file says so');
  eq((await codes(A.text.slice(0, Math.floor(A.text.length * 0.6))))[1], 'truncated', 'verify: a file cut short is changed and does not parse');

  const edited = JSON.parse(A.text);
  edited.data.np_history = '[]';
  eq(await codes(JSON.stringify(edited, null, 2)), ['changed', 'changed-key'], 'verify: an edited value is named');

  const dropped = JSON.parse(A.text);
  delete dropped.data.np_history;
  dropped.meta.itemCount = Object.keys(dropped.data).length;
  eq(await codes(JSON.stringify(dropped, null, 2)), ['changed', 'missing-key'], 'verify: a removed key is named');

  const B = await buildArchive(LOCAL, 'ro-other-run');
  eq(await codes(B.text), ['changed', 'other-run'], 'verify: another run\'s archive is refused');

  const plain = JSON.parse(A.text);
  delete plain.rollover;
  eq(await codes(JSON.stringify(plain, null, 2)), ['changed', 'not-archive'], 'verify: an ordinary backup is not the archive');

  const locked = { source: 'x', format: 'aspermylessonplan-backup', formatVersion: 2, encrypted: { v: 1 }, ciphertext: 'abc' };
  eq(await codes(JSON.stringify(locked)), ['changed', 'locked'], 'verify: a locked file is refused');

  const noDb = JSON.parse(A.text);
  delete noDb.indexedDB;
  eq(await codes(JSON.stringify(noDb, null, 2)), ['changed', 'missing-db'], 'verify: a missing database is named');

  const fewer = JSON.parse(A.text);
  fewer.indexedDB['gvb-media'].stores[0].records.pop();
  eq((await codes(JSON.stringify(fewer, null, 2))).slice(0, 2), ['changed', 'db-count'], 'verify: a database short of a record is named');

  const shortBlob = JSON.parse(A.text);
  shortBlob.indexedDB['gvb-media'].stores[0].records[0].v.blob.v = Buffer.from('ten bytes!').toString('base64');
  eq(await codes(JSON.stringify(shortBlob, null, 2)), ['changed', 'blob-size'], 'verify: a picture one byte short is named');

  /* The byte check is not the only guard: the same content re-serialised
     (another indent) fails on its bytes and passes on everything else. */
  eq(await codes(JSON.stringify(JSON.parse(A.text))), ['changed'], 'verify: the same content in other bytes fails on the hash alone');
}

/* ── planClear and run ────────────────────────────────────────────────── */
const STUDENT = ['np_rosters', 'np_history', 'hall-pass-log-sections'];
const KEPT_AFTER = Object.fromEntries(Object.entries(LOCAL).filter(([k]) => !STUDENT.includes(k)).sort());

async function startRun(storage, id = A.id) {
  window.BrRollover.recordRun(storage, { id, label: '2026-27', state: 'archived', archiveName: 'a.json', archiveHash: A.hash });
}
{
  const s = memStorage(LOCAL);
  await startRun(s);
  const plan = await RO.planClear(A.id, s.snapshot(), STUDENT, A.manifest);
  eq(plan.items.map(i => i.action + ':' + i.key), ['delete:hall-pass-log-sections', 'delete:np_history', 'delete:np_rosters'], 'plan: one delete per student key, sorted');
  eq(plan.problems, [], 'plan: nothing outside the archive');
  const res = await RO.run(plan, { storage: s });
  ok(res.done && res.removed === 3, 'run: three keys removed');
  eq(s.snapshot(), KEPT_AFTER, 'run: the student keys are gone and everything else is as it was');
  const j = RO.getRun(s, A.id);
  eq([j.state, j.done, j.steps], ['done', 3, 3], 'run: the journal says done, 3 of 3');
  eq(RO.resume(s), null, 'resume: a finished run asks for nothing');
  const journal = s.getItem('br_rollover_v1');
  ok(!NAMES.some(n => journal.includes(n)) && !journal.includes('Period 3'), 'journal: no student name and no value in br_rollover_v1');
  eq(await RO.writtenBack(s), [], 'writtenBack: nothing has come back');
  s.setItem('np_history', LOCAL.np_history);
  s.setItem('np_rosters', JSON.stringify({ 'Period 3': ['Dana New'] }));
  eq(await RO.writtenBack(s), ['np_history'], 'writtenBack: last year\'s exact value is found; this year\'s new value is not');
}
{
  /* A key the archive does not hold, or holds another value of, stops the
     plan: it would be cleared without being in the archive. */
  const s = memStorage({ ...LOCAL, 'np_absent': '["Casey Lund"]', np_history: '[]' });
  const plan = await RO.planClear(A.id, s.snapshot(), [...STUDENT, 'np_absent'], A.manifest);
  eq(plan.problems.map(p => p.code + ':' + p.key).sort(), ['changed-since:np_history', 'not-archived:np_absent'], 'plan: a key not in the archive and a key changed since are problems');
  const res = await RO.run(plan, { storage: s });
  ok(!res.done && res.removed === 0, 'run: a plan with problems writes nothing');
  eq(s.getItem('np_rosters'), LOCAL.np_rosters, 'run: ...not even the keys that were fine');
}
{
  /* A key saved between the plan and the run stops it with nothing written. */
  const s = memStorage(LOCAL);
  await startRun(s);
  const plan = await RO.planClear(A.id, s.snapshot(), STUDENT, A.manifest);
  s.setItem('np_history', '[{"name":"Blake Rivers","at":2}]');
  const res = await RO.run(plan, { storage: s });
  eq([res.done, res.stale, res.removed], [false, ['np_history'], 0], 'run: a key changed after the plan stops the run');
  eq(s.getItem('np_rosters'), LOCAL.np_rosters, 'run: ...with nothing removed');
  eq(RO.getRun(s, A.id).state, 'archived', 'run: ...and the journal still at archived');
}
/* A removal refused at step k, for every k, leaves the journal at
   'clearing' with k done; finishing from there gives the same storage as a
   run that never failed. */
for (let k = 0; k < STUDENT.length; k++) {
  const s = memStorage(LOCAL, { failRemoveAt: k });
  await startRun(s);
  const res = await RO.run(await RO.planClear(A.id, s.snapshot(), STUDENT, A.manifest), { storage: s });
  eq([res.done, res.removed], [false, k], `fail at removal ${k}: stops with ${k} removed`);
  const r = RO.resume(s);
  eq(r && [r.state, r.doneSteps, r.totalSteps], ['clearing', k, 3], `fail at removal ${k}: the journal says clearing, ${k} of 3`);
  const finish = await RO.run(await RO.planClear(A.id, s.snapshot(), STUDENT, A.manifest), { storage: s });
  ok(finish.done, `fail at removal ${k}: finishing completes`);
  eq(s.snapshot(), KEPT_AFTER, `fail at removal ${k}: finishing gives the uninterrupted result`);
  eq(Object.keys(RO.getRun(s, A.id).cleared).sort(), [...STUDENT].sort(), `fail at removal ${k}: the journal lists every cleared key once`);
}
/* A removal the browser accepts and does not carry out is caught by reading
   the key back, and is not recorded as cleared. */
{
  const s = memStorage(LOCAL, { keepRemoveAt: 1 });
  await startRun(s);
  const res = await RO.run(await RO.planClear(A.id, s.snapshot(), STUDENT, A.manifest), { storage: s });
  eq([res.done, res.failed, res.removed], [false, 'np_history', 1], 'run: a removal that did not happen is caught by reading it back');
  eq(Object.keys(RO.getRun(s, A.id).cleared), ['hall-pass-log-sections'], 'run: ...and is not recorded as cleared');
}
/* The journal refusing a write (a full disk) at step k stops the run there
   too, and never claims a step the storage does not show. */
for (let k = 1; k <= STUDENT.length + 2; k++) {
  const s = memStorage(LOCAL, { failJournalAt: k });
  await startRun(s);   // journal write 0
  const res = await RO.run(await RO.planClear(A.id, s.snapshot(), STUDENT, A.manifest), { storage: s });
  ok(!res.done, `journal refused at write ${k}: the run stops`);
  const j = RO.getRun(s, A.id);
  const gone = STUDENT.filter(key => s.getItem(key) === null).length;
  ok((j.done || 0) <= gone, `journal refused at write ${k}: the journal claims ${j.done || 0}, storage shows ${gone}`);
  const finish = await RO.run(await RO.planClear(A.id, s.snapshot(), STUDENT, A.manifest), { storage: s });
  ok(finish.done, `journal refused at write ${k}: finishing completes`);
  eq(s.snapshot(), KEPT_AFTER, `journal refused at write ${k}: and gives the uninterrupted result`);
}

/* ── the journal keeps three runs ─────────────────────────────────────── */
{
  const s = memStorage();
  for (let i = 1; i <= 5; i++) RO.recordRun(s, { id: 'ro-' + i, state: 'done' });
  eq(RO.readJournal(s).runs.map(r => r.id), ['ro-3', 'ro-4', 'ro-5'], 'journal: the last three runs');
  s.setItem('br_rollover_v1', '{not json');
  eq(RO.readJournal(s).runs, [], 'journal: an unreadable journal reads as empty, not a throw');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
