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

function memStorage(init, { failChangeAt = -1, failJournalAt = -1, keepChangeAt = -1 } = {}) {
  const m = new Map(Object.entries(init || {}));
  let changes = 0, journalWrites = 0;
  /* A change is a write or a removal of anything but the journal. failChangeAt
     throws on that change; keepChangeAt says yes and keeps the old value. */
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      if (k === 'br_rollover_v1') { if (journalWrites++ === failJournalAt) throw new Error('QuotaExceededError'); m.set(k, String(v)); return; }
      const n = changes++;
      if (n === failChangeAt) throw new Error('QuotaExceededError');
      if (n !== keepChangeAt) m.set(k, String(v));
    },
    removeItem: k => {
      const n = changes++;
      if (n === failChangeAt) throw new Error('refused');
      if (n !== keepChangeAt) m.delete(k);
    },
    map: m,
    snapshot: () => Object.fromEntries([...m.entries()].filter(([k]) => k !== 'br_rollover_v1').sort()),
  };
}

const window = { crypto: globalThis.crypto, TextEncoder };
const ctx = { window, document: { currentScript: null }, TextEncoder, setTimeout, clearTimeout, globalThis: {} };
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
  'hall-pass-log-sections': JSON.stringify({ current: 'Period 3', sets: { 'Period 3': { name: 'Period 3', namesText: NAMES.join('\n'),
    destinations: [{ id: 'lib', label: 'Library annex' }], log: [{ name: 'Blake Rivers' }] } } }),
  'subPlanBuilder.standingDetails.v1': JSON.stringify({ teacherName: 'Ms. Teacher', medicalAlerts: 'Casey Lund: inhaler' }),
  np_prompts: JSON.stringify(['Avery Stone goes first', 'Pair and share']),
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

/* ── the rules: one for every student entry, an entry for every rule ── */
const REG = window.ToolRegistry;
const TOOLS = Array.isArray(REG.tools) ? REG.tools : REG.tools();
{
  const declared = new Set(), student = [];
  for (const t of TOOLS) {
    for (const k of t.keys || []) { declared.add('k:' + k.k); if (k.student) student.push({ key: k.k }); }
    for (const p of t.prefixes || []) { declared.add('p:' + p.p); if (p.student) student.push({ prefix: p.p }); }
  }
  const missing = student.filter(e => {
    if (e.key) return !RO.RULES.some(r => r.key === e.key);
    return !RO.RULES.some(r => r.prefix === e.prefix);
  }).map(e => e.key || e.prefix + '*');
  eq(missing, [], 'rules: every student key and prefix in the registry has a rule');
  const undeclared = RO.RULES.filter(r => !declared.has(r.key ? 'k:' + r.key : 'p:' + r.prefix)).map(r => r.key || r.prefix + '*');
  eq(undeclared, [], 'rules: every rule names a key or prefix the registry declares');
  ok(RO.RULES.every(r => ['delete', 'reduce', 'roster', 'ask', 'index', 'keep'].includes(r.kind)), 'rules: every rule has a known kind');
  ok(RO.RULES.every(r => r.kind === 'delete' || r.kind === 'keep' || typeof r.reduce === 'function'), 'rules: every reducing rule has a reducer');
  ok(Object.isFrozen(RO.RULES) && Object.isFrozen(RO.RULES[0]), 'rules: the list is frozen');
  eq(RO.ruleFor('gtg:data:Period 3').prefix, 'gtg:data:', 'ruleFor: the longest prefix wins over a legacy family');
  eq(RO.ruleFor('gtg:list').kind, 'index', 'ruleFor: an exact key wins over a prefix');
  eq(RO.ruleFor('gvb-a11y-prefs'), null, 'ruleFor: a settings key has no rule');
}

/* ── scanNames ───────────────────────────────────────────────────────── */
{
  const N = ['Avery Stone', 'Blake Rivers', 'Casey Lund', 'Jo'];
  eq(RO.scanNames('Avery Stone left early. avery stone came back.', N), [{ name: 'Avery Stone', count: 2 }], 'scanNames: a full name, in other case too');
  eq(RO.scanNames('Seat Blake\nRivers by the door', N), [{ name: 'Blake Rivers', count: 1 }], 'scanNames: a name across a line break');
  eq(RO.scanNames('Avery is here; Stone Age unit', N), [], 'scanNames: no hit on a first name or a last name alone');
  eq(RO.scanNames('Casey Lundgren', N), [], 'scanNames: no hit on a name inside a longer word');
  eq(RO.scanNames('Jo went home', N), [], 'scanNames: a one-word roster name is never searched');
  eq(RO.scanValue({ 'Casey Lund': 'x' }, N), [{ name: 'Casey Lund', count: 1 }], 'scanValue: a name used as an object key is found');
  eq(RO.scanValue(['line one', 'Blake\nRivers'], N), [{ name: 'Blake Rivers', count: 1 }], 'scanValue: the text a teacher typed, not JSON\'s escapes of it');
  eq(RO.rosterNames({
    np_rosters: JSON.stringify({ 'Period 3': ['Avery Stone', 'Blake Rivers'], 'Period 4': ['avery  stone', 'Jo'] }),
    crh_students_v1: JSON.stringify({ version: 1, rosters: { 'Period 3': { meta: {}, students: [{ id: 's1', name: 'Casey Lund', preferred: 'Case' }], orphans: [] } } }),
  }), ['Avery Stone', 'Blake Rivers', 'Casey Lund'], 'rosterNames: both roster keys, each name once, full names only');
}

/* ── each reducer, on its tool's own shape with made-up students ─────── */
const CTX = { names: NAMES, nextTerm: '2027-28', choices: {} };
const J = JSON.stringify;
/* key → [fixture, (after) => [[check, label]...]] — every fixture names a
   student; `after` is the parsed value written, or null for a delete. */
const FIX = {
  'seating-chart-v1': [{ __v: 1, theme: 'light', zoom: 'fit', currentQuarter: 'Q4',
    sections: [{ id: 'sec1', name: 'Period 3', students: [{ id: 'a', name: 'Avery Stone', note: 'EpiPen', flag: 1, photo: 'idb:seating/p1' }],
      apart: [['a', 'b']], together: [], desks: [{ id: 'd1', x: 1, y: 2 }, { id: 'd2', x: 3, y: 4 }], assign: { d1: 'a' },
      layouts: [{ id: 'L1', name: 'Test day', desks: [{ id: 'd1', x: 0, y: 0 }], assign: { d1: 'a' } }],
      history: [{ id: 'h', students: [{ id: 'a', name: 'Avery Stone' }] }] }] },
    a => [[a.sections.length === 1 && a.sections[0].id === 'sec1' && a.sections[0].name === 'Period 3', 'the section, its id and name'],
          [a.sections[0].desks.length === 2 && a.sections[0].layouts[0].desks.length === 1 && a.sections[0].layouts[0].name === 'Test day', 'the desks and the saved layout'],
          [J(a.sections[0].students) === '[]' && J(a.sections[0].assign) === '{}' && J(a.sections[0].layouts[0].assign) === '{}' && J(a.sections[0].history) === '[]', 'students, seats and history empty'],
          [a.theme === 'light' && a.zoom === 'fit' && a.currentQuarter === '', 'view settings kept, the quarter re-guessed']]],
  'hall-pass-log-sections': [{ current: 'Period 3', sets: { 'Period 3': { name: 'Period 3', namesText: 'Avery Stone\nBlake Rivers',
      destinations: [{ id: 'nurse', label: 'Nurse', overtimeMin: 8 }, { id: 'lib', label: 'Library annex' }], weeklyBudget: 5, teacherInitials: 'DM',
      outNow: [{ name: 'Casey Lund' }], log: [{ name: 'Avery Stone' }], history: [{ rows: [{ name: 'Blake Rivers' }] }], approvalNames: ['Avery Stone'],
      rosterName: 'Period 3', idNames: { s1: 'Avery Stone' } } } },
    a => [[a.current === 'Period 3' && a.sets['Period 3'].name === 'Period 3' && a.sets['Period 3'].rosterName === 'Period 3', 'the class and its roster link'],
          [a.sets['Period 3'].destinations[1].label === 'Library annex' && a.sets['Period 3'].weeklyBudget === 5 && a.sets['Period 3'].teacherInitials === 'DM', 'the custom destination and limits'],
          [a.sets['Period 3'].namesText === '' && J(a.sets['Period 3'].log) === '[]' && J(a.sets['Period 3'].idNames) === '{}', 'names, log and id map empty']]],
  'behavior-points-tracker-sections': [{ current: 'P3', sets: { P3: { name: 'P3', namesText: 'Avery Stone', tags: [{ id: 't', label: 'Lab helper', delta: 2 }],
      points: { 'Avery Stone': 4 }, posCount: { 'Avery Stone': 2 }, negCount: {}, log: [{ name: 'Avery Stone' }], history: [], goals: { 'Avery Stone': 10 },
      idNames: { s: 'Avery Stone' }, rosterName: 'P3', seatingSectionId: 'sec1', teams: [{ id: 'T1', name: 'Owls' }], teamOf: { 'Avery Stone': 'T1' },
      teamBank: { T1: 7 }, teamDay: { T1: 2 }, teamLog: [{ team: 'T1' }] } } },
    a => [[a.sets.P3.tags[0].label === 'Lab helper' && a.sets.P3.seatingSectionId === 'sec1' && a.sets.P3.teams[0].name === 'Owls', 'tags, seating link and teams'],
          [J(a.sets.P3.points) === '{}' && J(a.sets.P3.teamBank) === '{"T1":0}' && J(a.sets.P3.teamOf) === '{}', 'points, team scores and members empty']]],
  'gtg:data:Period 3': [{ name: 'Period 3', names: 'Avery Stone\t3\nBlake Rivers', mode: 'size', splitValue: 3, customNames: 'Red\nBlue', rolesText: 'Scribe',
      keepApart: [['Avery Stone', 'Blake Rivers']], keepTogether: [], absentNames: ['Casey Lund'], pairHistory: { 'a␟b': { gen: 1 } }, pairGen: 4,
      rosterName: 'Period 3', idNames: { x: 'Avery Stone' }, roleHistory: { 'Avery Stone': {} } },
    a => [[a.name === 'Period 3' && a.mode === 'size' && a.customNames === 'Red\nBlue' && a.rolesText === 'Scribe' && a.rosterName === 'Period 3', 'group settings, labels and roles'],
          [a.names === '' && a.pairGen === 0 && !('roleHistory' in a), 'names and history empty']]],
  'lsct_sections_v1': [{ 'Period 3': { roster: ['Avery Stone'], contracts: { 'Avery Stone': { docs: {} } }, dueDate: '2026-09-01',
      documents: [{ id: 'c', label: 'Lab contract', fee: 5, body: 'I will wear goggles.' }], rosterName: 'Period 3', idNames: { a: 'Avery Stone' } } },
    a => [[a['Period 3'].documents[0].body === 'I will wear goggles.' && a['Period 3'].documents[0].fee === 5, 'the contract wording and fee'],
          [J(a['Period 3'].roster) === '[]' && J(a['Period 3'].contracts) === '{}' && a['Period 3'].dueDate === '', 'roster, signatures and due date empty']]],
  'lgrr_rosters': [{ 'Bio 1': { name: 'Bio 1', students: 'Avery Stone\nBlake Rivers', roles: [{ name: 'Materials manager' }], stations: [{ name: 'Bench A' }],
      mode: 'equip', equipment: [{ item: 'Microscope', count: 4 }], history: { 'Avery Stone': ['x'] }, lastGroups: [{ members: [{ name: 'Avery Stone' }] }],
      checkoutLog: [{}], keepApart: [['Avery Stone', 'Blake Rivers']], absent: ['Casey Lund'], safetyGate: { enabled: true, section: 'Period 3' },
      lastExcludedForSafety: ['Casey Lund'], rosterName: 'Bio 1', idNames: {} } },
    a => [[a['Bio 1'].roles[0].name === 'Materials manager' && a['Bio 1'].equipment[0].item === 'Microscope' && a['Bio 1'].safetyGate.section === 'Period 3', 'roles, equipment and the safety gate'],
          [a['Bio 1'].students === '' && a['Bio 1'].lastGroups === null && J(a['Bio 1'].absent) === '[]', 'names, groups and absences empty']]],
  'subPlanBuilder.standingDetails.v1': [{ teacherName: 'Ms. Teacher', periods: [{ label: '1', time: '8:00', _id: 'p1' }], medicalAlerts: 'Avery Stone: EpiPen in the red bag',
      behaviorVariant: 'custom', behaviorCustom: 'Seat Blake Rivers by the door', fireRoute: 'Exit B' },
    a => [[a.teacherName === 'Ms. Teacher' && a.fireRoute === 'Exit B' && a.periods.length === 1, 'the standing details'],
          [a.medicalAlerts === '' && a.behaviorCustom === '' && a.behaviorVariant === 'custom', 'medical alerts and the named note empty']]],
  'gvb-certificate-maker:data:Awards': [{ name: 'Awards', theme: 'gold', mode: 'batch', studentName: 'Avery Stone', batchNames: 'Blake Rivers, helping', reason: 'For Casey Lund\'s kindness', qrUrl: '', awardTitle: 'Star' },
    a => [[a.theme === 'gold' && a.awardTitle === 'Star' && a.mode === 'batch', 'the design'],
          [a.studentName === '' && a.batchNames === '' && a.reason === '' && typeof a.batchNames === 'string', 'names and the named reason are empty strings']]],
  'crcg:data:Senate': [{ v: 2, title: 'Senate', roles: [{ id: 'r', role: 'Senator', students: ['Avery Stone'], points: [{ text: 'Vote no' }] }], agenda: [{ name: 'Debate' }] },
    a => [[a.title === 'Senate' && a.roles[0].role === 'Senator' && a.roles[0].points[0].text === 'Vote no' && a.agenda.length === 1, 'the simulation'],
          [J(a.roles[0].students) === '[]', 'who plays each role empty']]],
  'crcg_roles_v1': [{ roles: [{ role: 'Judge', students: ['Blake Rivers'] }] },
    a => [[a.roles[0].role === 'Judge' && J(a.roles[0].students) === '[]', 'the legacy key the same way']]],
  'gvb-review-board:data:Unit 3': [{ name: 'Unit 3', teams: [{ name: 'Team 1: Avery Stone, Blake Rivers', score: 400 }, { name: 'Owls', score: 100 }, { name: 'Casey Lund crew', score: 0 }],
      categories: [{ name: 'Cells', clues: [{ points: 100, question: 'Q', answer: 'A', used: true, marks: ['r', 'w'] }] }],
      final: { on: true, question: 'FQ', answer: 'FA', wagers: [1], marks: ['r'], deltas: [1] }, quizBowl: { on: true, tossup: 10, log: [{ id: 'x' }], over: true },
      wheel: { on: true, seed: 99, spins: 3, lose: true, doubleNext: true, last: { i: 1 } } },
    a => [[a.categories[0].clues[0].question === 'Q' && a.final.question === 'FQ' && a.quizBowl.tossup === 10 && a.wheel.lose === true, 'the clues and every mode\'s settings'],
          [J(a.teams.map(t => t.name)) === '["Team 1","Owls","Team 3"]' && a.teams.every(t => t.score === 0), 'roster-split and named teams back to Team N, scores 0; a typed name with no student kept'],
          [a.categories[0].clues[0].used === false && !('marks' in a.categories[0].clues[0]) && !('wagers' in a.final) && J(a.quizBowl.log) === '[]' && a.wheel.seed === '' && a.wheel.spins === 0, 'the game played on it reset']]],
  'qr-code-generator-inventory': [{ 'CALC-01': { label: 'Calculator 1', status: 'out', assignedTo: 'Avery Stone', checkedOutAt: 5, checkedInAt: 2, createdAt: 1, history: [{ event: 'out', who: 'Avery Stone', ts: 5 }] } },
    a => [[a['CALC-01'].label === 'Calculator 1' && a['CALC-01'].createdAt === 1, 'the item and its label'],
          [a['CALC-01'].status === 'in' && a['CALC-01'].assignedTo === '' && J(a['CALC-01'].history) === '[]' && a['CALC-01'].checkedOutAt === null, 'checked in, no borrower, no history']]],
  'qr-scavenger-hunt-sets': [{ current: 'Hunt', sets: { Hunt: { name: 'Hunt', stations: [{ codeWord: 'mitosis' }], run: { teams: [{ name: 'Avery Stone' }] } } } },
    a => [[a.sets.Hunt.stations[0].codeWord === 'mitosis' && !('run' in a.sets.Hunt), 'the hunt kept, its run gone']]],
  'htcm:data:Figures': [{ v: 2, cards: [{ id: 'c1', name: 'Harriet Tubman', stats: [] }, { id: 'c2', name: 'Avery Stone', stats: [] }], settings: { size: 'poker' } },
    a => [[a.cards.length === 1 && a.cards[0].name === 'Harriet Tubman' && a.settings.size === 'poker', 'a card for a student goes, a figure\'s stays']]],
  'drb_roster_v1': [{ staff: ['Mr. Okafor', 'Avery Stone'], duties: [{ id: 'd', name: 'Bus' }], assignments: { 'd|Monday': 'Avery Stone', 'd|Tuesday': 'Mr. Okafor' },
      staffSkip: { 'Avery Stone': true }, weekOverrides: { 2: { 'd|Monday': 'Avery Stone' } } },
    a => [[J(a.staff) === '["Mr. Okafor"]' && a.assignments['d|Tuesday'] === 'Mr. Okafor' && a.duties.length === 1, 'staff and duties kept'],
          [!('d|Monday' in a.assignments) && J(a.staffSkip) === '{}' && J(a.weekOverrides[2]) === '{}', 'a student on the rota gone']]],
  'sdb_directory_v1': [[{ id: '1', name: 'Mr. Okafor', room: '12' }, { id: '2', name: 'Blake Rivers', room: '' }],
    a => [[a.length === 1 && a[0].name === 'Mr. Okafor', 'staff kept, a student gone']]],
  'gvb-exit-ticket:categoryTally': [{ categories: [{ id: 'g', label: 'Got it', count: 12 }], history: [{ ts: 1, total: 12 }] },
    a => [[a.categories[0].label === 'Got it' && a.categories[0].count === 0 && J(a.history) === '[]', 'the categories kept, the counts gone']]],
  'novel-study-circles': [{ Hatchet: { name: 'Hatchet', students: 'Avery Stone\nBlake Rivers', bookTitle: 'Hatchet', mode: 'count', splitValue: 4,
      groups: [{ id: 'g', label: 'G1', members: ['Avery Stone'] }], roles: [{ name: 'Connector', prompts: 'p' }], history: { 'Avery Stone': ['Connector'] },
      meetings: [{ groups: [{ assignment: [{ name: 'Avery Stone' }] }] }], schedule: { days: { 1: true }, rows: [] }, rosterName: 'Period 3', idNames: { a: 'Avery Stone' } } },
    a => [[a.Hatchet.bookTitle === 'Hatchet' && a.Hatchet.roles[0].name === 'Connector' && a.Hatchet.schedule.days[1] === true && a.Hatchet.rosterName === 'Period 3', 'the book, roles and schedule'],
          [a.Hatchet.students === '' && J(a.Hatchet.groups) === '[]' && J(a.Hatchet.meetings) === '[]', 'names, groups and meetings empty']]],
  'sslt_sections_v1': [{ 'Period 3': { roster: ['Avery Stone'], logs: { 'Avery Stone': [{ book: 'Holes' }] }, finished: { 'Avery Stone': ['holes'] }, genres: { holes: 'Mystery' },
      weeklyGoalPages: 50, rosterName: 'Period 3', idNames: {} } },
    a => [[a['Period 3'].genres.holes === 'Mystery' && a['Period 3'].weeklyGoalPages === 50, 'genres and goals'],
          [J(a['Period 3'].roster) === '[]' && J(a['Period 3'].logs) === '{}', 'roster and logs empty']]],
  'fsat_tracker_v1': [{ roster: ['Avery Stone'], events: [{ id: 'e', name: 'Shuttle run', type: 'time' }], results: { 'Avery Stone|e': '9.1' } },
    a => [[a.events[0].name === 'Shuttle run' && J(a.roster) === '[]' && J(a.results) === '{}', 'events kept, roster an empty array']]],
  'sfpt_tracker_v1': [{ v: 2, data: { list: [{ id: 't1', name: 'Fair 2027', roster: ['Avery Stone'], milestones: [{ id: 'm', name: 'Hypothesis' }], done: { 'Avery Stone|m': true }, notes: { 'Avery Stone|m': 'late' } }], currentId: 't1' } },
    a => [[a.v === 2 && a.data.currentId === 't1' && a.data.list[0].milestones[0].name === 'Hypothesis', 'the Store envelope and milestones'],
          [J(a.data.list[0].roster) === '[]' && J(a.data.list[0].notes) === '{}', 'roster and notes empty']]],
  'tacg_cards_v1': [{ roster: ['Avery Stone'], types: [{ id: 'x', name: 'Extended time' }], assignments: { 'Avery Stone|x': true }, notes: { 'Avery Stone': 'n' },
      rooms: [{ id: 'r', name: 'Library', proctor: 'Mr. Okafor' }], roomOf: { 'Avery Stone': 'r' } },
    a => [[a.types[0].name === 'Extended time' && a.rooms[0].proctor === 'Mr. Okafor', 'types and rooms'],
          [J(a.roster) === '[]' && J(a.assignments) === '{}' && J(a.roomOf) === '{}', 'who gets what empty']]],
  'pe-tournament-stations': [{ current: 'Field day', projects: { 'Field day': { name: 'Field day', roster: 'Avery Stone, Blake Rivers', stations: [{ id: 's', name: 'Sack race' }],
      groups: [{ id: 'g', name: 'Red', members: 'Avery Stone' }], rotation: { minutes: 5, seconds: 0, count: 3, running: true }, scores: { s: { 'Avery Stone': 3 } },
      bracketSource: 'custom', bracketEntrants: 'Avery Stone\nBlake Rivers', bracket: { name: 'B', slots: [['Avery Stone']] } } } },
    a => [[a.projects['Field day'].stations[0].name === 'Sack race' && a.projects['Field day'].groups[0].name === 'Red' && a.projects['Field day'].rotation.minutes === 5, 'stations, group names and the rotation\'s timing'],
          [a.projects['Field day'].roster === '' && a.projects['Field day'].groups[0].members === '' && a.projects['Field day'].bracket === null && a.projects['Field day'].rotation.running === false, 'names, scores and the bracket gone']]],
  'gallery-walk-qr-sets': [{ current: 'Walk', sets: { Walk: { name: 'Walk', entries: [{ name: 'Avery Stone', value: 'https://x', feedbackNotes: ['nice'] }], walkGroups: ['Blake Rivers'],
      feedbackPrompt: 'One wish', timer: { minutes: 3, running: true } } } },
    a => [[a.sets.Walk.feedbackPrompt === 'One wish' && a.sets.Walk.timer.minutes === 3, 'the walk\'s settings'],
          [J(a.sets.Walk.entries) === '[{"name":"","value":""}]' && J(a.sets.Walk.walkGroups) === '[]', 'entries to one blank row']]],
  'gvb-field-trip:data:Zoo': [{ name: 'Zoo', destination: 'City Zoo', cost: '12', studentName: 'Avery Stone', batchNames: 'Blake Rivers', collected: { 'Blake Rivers': { returned: true } },
      chaperones: [{ name: 'Pat Lund', phone: '555' }], chaperoneAssignments: { 'Blake Rivers': 'Pat Lund' }, chaperoneName: 'Pat Lund', chaperonePhone: '555', translations: { purpose: 'x' } },
    a => [[a.destination === 'City Zoo' && a.cost === '12' && a.translations.purpose === 'x', 'the letter'],
          [a.studentName === '' && J(a.collected) === '{}' && J(a.chaperones) === '[]' && a.chaperoneName === '', 'students, slips and chaperones empty']]],
  'socsem:data:Seminar': [{ name: 'Seminar', question: 'Is it fair?', roster: [{ id: 'p1', name: 'Avery Stone' }], order: ['p1'], groups: { p1: 'inner' }, tallies: { p1: { c: 2 } } },
    a => [[a.question === 'Is it fair?' && J(a.roster) === '[]' && J(a.tallies) === '{}', 'the question kept, the roster and tallies empty']]],
  'gvb-bracket:data:Spelling': [{ name: 'Spelling', slots: [['Avery Stone', 'Blake Rivers']] }, a => [[a === null, 'a bracket is its entrants: the document goes']]],
  'gvb-grade-distribution:data:Quiz': [{ name: 'Quiz', text: 'Avery Stone, 91\nBlake Rivers, 77', cutA: 93, compareNames: [] },
    a => [[a.cutA === 93 && a.text === '', 'cut-offs kept, the names and scores an empty string']]],
  'pct:lastValues': [{ Student: 'Avery Stone', 'Parent/Guardian': 'Pat Stone', Grade: 'B', 'Teacher Name': 'Ms. Teacher', Class: 'Bio' },
    a => [[a['Teacher Name'] === 'Ms. Teacher' && a.Class === 'Bio' && !('Student' in a) && !('Parent/Guardian' in a), 'your name and class kept, the student and parent gone']]],
  'apl_portfolios_v1': [{ list: [{ id: 'p', name: 'Spring show', title: 'Art 1', entries: [{ id: 'e', artist: 'Avery Stone', title: 'Vase', image: 'data:image/png;base64,AA' }], labelsPerPage: '6' }], currentId: 'p' },
    a => [[a.list[0].name === 'Spring show' && a.currentId === 'p' && a.list.length === 1, 'the portfolio kept, never an empty list'],
          [a.list[0].entries.length === 1 && a.list[0].entries[0].artist === '' && a.list[0].entries[0].image === '', 'its labels to one blank row']]],
  'np_rosters': [{ 'Period 3': ['Avery Stone', 'Blake Rivers'], 'Period 4': ['Casey Lund'] },
    a => [[J(a) === '{"Period 3":[],"Period 4":[]}', 'every class name kept, every list empty']]],
  'crh_students_v1': [{ version: 1, rosters: { 'Period 3': { meta: { period: '3', subject: 'Biology', term: '2026-27', created: 1, updated: 2, source: 'Avery Stone.csv' },
      students: [{ id: 's1', name: 'Avery Stone', preferred: 'Ave' }], orphans: [{ id: 's2', name: 'Blake Rivers' }] } } },
    a => [[a.version === 1 && a.rosters['Period 3'].meta.period === '3' && a.rosters['Period 3'].meta.subject === 'Biology', 'period and subject kept'],
          [a.rosters['Period 3'].meta.term === '2027-28' && !('source' in a.rosters['Period 3'].meta), 'the new year\'s term, the import\'s file name gone'],
          [J(a.rosters['Period 3'].students) === '[]' && J(a.rosters['Period 3'].orphans) === '[]', 'students and orphans empty (an orphan would hand next year\'s namesake an old id)']]],
  'crh_archive_v1': [{ version: 1, rosters: [{ name: 'Period 3', names: ['Avery Stone'] }], years: [{ id: 'y', label: '2025-26', rosters: [{ names: ['Blake Rivers'] }] }] },
    a => [[J(a) === '{"version":1,"rosters":[],"years":[]}', 'past years and archived rosters gone (Devon: the file is the only copy)']]],
  'gvb-roleplay:roster': [{ 'Period 3': ['Avery Stone'] }, a => [[J(a) === '{"Period 3":[]}', 'class names kept, lists empty']]],
  'data-chart-builder-datasets': [{ 'Quiz scores': 'Avery Stone,91\nBlake Rivers,77', 'Rainfall': 'Mon,3\nTue,4' },
    a => [[J(Object.keys(a)) === '["Rainfall"]', 'the dataset naming students goes, the other stays']]],
  'subPlanBuilder.history.v1': [[{ date: '2027-05-01', overviewText: 'Avery Stone leads warm-up' }, { date: '2027-05-02', overviewText: 'Quiz day' }],
    a => [[a.length === 1 && a[0].date === '2027-05-02', 'the plan naming a student goes']]],
  'promptBuilderDraft_v2': [{ topic: 'Cells', studentNeeds: 'Blake Rivers reads at grade 4' }, a => [[a === null, 'the draft goes whole, as 029\'s Clear All does']]],
  'promptBuilderCustomPresets_v1': [[{ name: 'Bio', data: { topic: 'x' } }, { name: 'Casey Lund IEP', data: {} }], a => [[a.length === 1 && a[0].name === 'Bio', 'the preset naming a student goes']]],
  'promptBuilderHistory_v1': [[{ id: 'h', text: 'Plan for Avery Stone' }, { id: 'i', text: 'Plan for cells' }], a => [[a.length === 1 && a[0].id === 'i', 'the prompt naming a student goes']]],
  'qr-code-generator-recent': [[{ label: 'Avery Stone portfolio', text: 'https://a' }, { label: 'Lab', text: 'https://b' }], a => [[a.length === 1 && a[0].label === 'Lab', 'the recent code naming a student goes']]],
  'htcm:game': [{ v: 1, teams: [{ name: 'Avery Stone', score: 2 }] }, a => [[a === null, 'the saved game goes, as HtcmGame.clear() does']]],
  'pct:custom': [[{ id: 'custom_1', title: 'Note home', body: 'Dear family of Blake Rivers' }, { id: 'custom_2', title: 'Field trip', body: 'Dear families' }],
    a => [[a.length === 1 && a[0].id === 'custom_2', 'the template naming a student goes']]],
  'np_prompts': [['Avery Stone, share first', 'Pair and share'], a => [[J(a) === '["Pair and share"]', 'the prompt naming a student goes']]],
  'gvb-number-talks:myBank': [[{ id: 'n', exprs: ['3x4'], note: 'Casey Lund\'s strategy' }], a => [[a.length === 1 && a[0].note === '' && a[0].exprs[0] === '3x4', 'the note goes, the number talk stays']]],
};
const RAW = { 'gvb-sub-binder:today-lesson': 'Avery Stone will hand out the worksheets.' };

for (const [key, [fixture, checks]] of Object.entries(FIX)) {
  const rule = RO.ruleFor(key);
  if (!ok(rule && rule.reduce, `${key}: has a reducing rule`)) continue;
  const text = J(fixture);
  const r = RO.reduceKey(rule, key, text, CTX);
  ok(!r.unreadable && (r.action === 'write' || r.action === 'delete'), `${key}: changes the key (got ${r.action}${r.unreadable ? ', unreadable' : ''})`);
  const after = r.action === 'delete' ? null : JSON.parse(r.after);
  for (const [cond, label] of checks(after)) ok(cond, `${key}: ${label}`);
  const out = r.after || '';
  ok(!NAMES.some(n => out.includes(n)), `${key}: no fixture student is left in it`);
  ok(r.after === null || r.after.length <= text.length, `${key}: what it writes is no longer than what it replaces`);
  ok(r.removed.length > 0 && r.removed.every(x => x.count > 0), `${key}: says what it removed`);
  if (r.after) {
    const again = RO.reduceKey(rule, key, r.after, CTX);
    eq(again.action, 'keep', `${key}: idempotent — reducing the result changes nothing`);
  }
  for (const bad of ['null', '42', '"text"', '{not json']) {
    let res;
    try { res = RO.reduceKey(rule, key, bad, CTX); } catch (e) { res = { threw: e.message }; }
    ok(!res.threw && res.action !== 'write' && res.action !== 'delete', `${key}: ${bad} is left alone, no throw (${res.threw || res.action})`);
  }
}
{
  const key = 'gvb-sub-binder:today-lesson';
  const r = RO.reduceKey(RO.ruleFor(key), key, RAW[key], CTX);
  eq([r.action, r.hits.map(h => h.name)], ['delete', ['Avery Stone']], `${key}: a plain-text note naming a student is cleared`);
  eq(RO.reduceKey(RO.ruleFor(key), key, 'Worksheets on the cart', CTX).action, 'keep', `${key}: one naming nobody is not touched`);
}
/* Every reducing rule has a fixture, so a new rule cannot ship untested. */
{
  const tested = RO.RULES.filter(r => r.reduce && r.kind !== 'index').filter(r =>
    !Object.keys(FIX).concat(Object.keys(RAW)).some(k => RO.ruleFor(k) === r)).map(r => r.key || r.prefix + '*');
  eq(tested, ['gvb-certificate-maker:last'], 'fixtures: every reducing rule has one (the legacy certificate key shares the preset\'s reducer)');
}
/* A kind E key with no student in it is not touched or shown. */
eq(RO.reduceKey(RO.ruleFor('np_prompts'), 'np_prompts', J(['Pair and share']), CTX).action, 'keep', 'ask: a key naming nobody is kept and not shown');
eq(RO.reduceKey(RO.ruleFor('np_prompts'), 'np_prompts', J(['Avery Stone first']), { ...CTX, choices: { np_prompts: 'keep' } }).action, 'choose', 'ask: Keep chosen is kept and still listed');

/* ── plan and run ─────────────────────────────────────────────────────── */
async function startRun(storage, id = A.id) {
  RO.recordRun(storage, { id, label: '2026-27', state: 'archived', archiveName: 'a.json', archiveHash: A.hash });
}
const STUDENT = ['hall-pass-log-sections', 'np_history', 'np_rosters'];
const ARCH = A.env.data;
const SEATING = ['seating/a1'];
/* The photos and the share slot, faked: each clear can be made to fail. */
function fakeIo(storage, { mediaFails = false, shareFails = false } = {}) {
  const io = { storage, photos: [...SEATING], shared: true };
  io.media = { clear: async ns => { if (mediaFails) throw new Error('blocked'); if (ns === 'seating') io.photos = []; return io.photos.length === 0; } };
  io.share = { remove: async () => { if (shareFails) return false; io.shared = false; return true; } };
  return io;
}
const planOf = (s, extra = {}) => RO.plan(A.id, s.snapshot(), ARCH, { studentKeys: STUDENT, nextTerm: '2027-28',
  media: { seating: { ids: SEATING, bytes: 11 } }, archiveMedia: ['seating/a1', 'rgb/b2'], share: true, ...extra });

let EXPECTED;
{
  const s = memStorage(LOCAL);
  await startRun(s);
  const p = await planOf(s);
  eq(p.items.filter(i => i.action !== 'keep').map(i => i.phase + ':' + i.action + ':' + i.key), [
    '1:write:hall-pass-log-sections', '1:write:np_prompts', '1:write:subPlanBuilder.standingDetails.v1',
    '2:delete:np_history', '3:write:np_rosters'], 'plan: reductions, then deletions, then the roster last');
  eq(p.problems, [], 'plan: nothing outside the archive');
  eq([p.totals.write, p.totals.delete, p.totals.media, p.totals.share], [4, 1, 1, 1], 'plan: totals, the photos and the share slot');
  const pr = p.items.find(i => i.key === 'np_prompts');
  eq([pr.kind, pr.choice, pr.hits.map(h => h.name)], ['ask', 'clear', ['Avery Stone']], 'plan: free text naming a student is shown with its names, pre-set to Clear');
  ok(!p.items.some(i => i.key === 'gvb-rubric-builder:data:Essay' || i.key === 'gvb-a11y-prefs'), 'plan: setup keys are not in it');
  const io = fakeIo(s);
  const res = await RO.run(p, io);
  ok(res.done && res.removed === 7, 'run: five keys, the photos and the share slot');
  EXPECTED = s.snapshot();
  const hp = JSON.parse(EXPECTED['hall-pass-log-sections']).sets['Period 3'];
  ok(hp.destinations[0].label === 'Library annex' && hp.namesText === '' && hp.log.length === 0, 'run: the hall pass keeps its destination and loses its names');
  eq(EXPECTED.np_rosters, '{"Period 3":[]}', 'run: the class is kept, empty');
  eq(JSON.parse(EXPECTED['subPlanBuilder.standingDetails.v1']), { teacherName: 'Ms. Teacher', medicalAlerts: '' }, 'run: the medical alerts are gone, the sub plan stays');
  eq(EXPECTED.np_prompts, '["Pair and share"]', 'run: the chosen Clear took only the prompt naming a student');
  ok(!('np_history' in EXPECTED), 'run: kind A deleted');
  eq([EXPECTED['gvb-rubric-builder:data:Essay'], EXPECTED['gvb-a11y-prefs']], [LOCAL['gvb-rubric-builder:data:Essay'], LOCAL['gvb-a11y-prefs']], 'run: setup untouched');
  ok(!NAMES.some(n => Object.values(EXPECTED).some(v => v.includes(n))), 'run: no fixture student anywhere in storage');
  eq([io.photos, io.shared], [[], false], 'run: the photos and the parked roster file are cleared');
  const j = RO.getRun(s, A.id);
  eq([j.state, j.done, j.steps], ['done', 7, 7], 'run: the journal says done, 7 of 7');
  const journal = s.getItem('br_rollover_v1');
  ok(!NAMES.some(n => journal.includes(n)) && !journal.includes('Period 3') && !journal.includes('inhaler'), 'journal: no name and no value in br_rollover_v1');
  eq(res.receipt.keys.length, 5, 'receipt: the keys it changed');
  ok(!NAMES.some(n => JSON.stringify(res.receipt).includes(n)), 'receipt: no student name on it');
  eq(await RO.writtenBack(s), [], 'writtenBack: nothing has come back');
  s.setItem('hall-pass-log-sections', LOCAL['hall-pass-log-sections']);
  s.setItem('np_history', LOCAL.np_history);
  s.setItem('np_rosters', JSON.stringify({ 'Period 3': ['Dana New'] }));
  eq(await RO.writtenBack(s), ['hall-pass-log-sections', 'np_history'], 'writtenBack: last year\'s exact values are found, a reduced key\'s too; this year\'s roster is not');
  /* Clearing them again plans from the value now (it is the archive's). */
  const now = s.snapshot();
  const again = await RO.plan(A.id, now, now, { only: ['hall-pass-log-sections', 'np_history'], studentKeys: STUDENT });
  await RO.run(again, { storage: s });
  eq([s.getItem('hall-pass-log-sections'), s.getItem('np_history'), s.getItem('np_rosters')],
     [EXPECTED['hall-pass-log-sections'], null, '{"Period 3":["Dana New"]}'], 'clear again: reduces and deletes those two, leaves this year\'s roster');
}
{
  /* Keep, chosen for the free text: listed, never written. */
  const s = memStorage(LOCAL);
  const p = await planOf(s, { choices: { np_prompts: 'keep' } });
  eq(p.items.find(i => i.key === 'np_prompts').action, 'choose', 'plan: Keep chosen leaves the key out of the clear');
  await RO.run(p, fakeIo(s));
  eq(s.getItem('np_prompts'), LOCAL.np_prompts, 'run: ...and it is untouched');
}
{
  /* A key the archive does not hold, or holds another value of, stops the
     plan: it would be cleared without being in the archive. So does a
     photo saved since the archive. */
  const s = memStorage({ ...LOCAL, np_absent: '["Casey Lund"]', np_history: '[]' });
  const p = await planOf(s, { studentKeys: [...STUDENT, 'np_absent'], media: { seating: { ids: ['seating/a1', 'seating/new'], bytes: 22 } } });
  eq(p.problems.map(x => x.code + ':' + x.key).sort(), ['changed-since:np_history', 'not-archived:gvb-media:seating', 'not-archived:np_absent'],
     'plan: a key not in the archive, a key changed since and a photo saved since are problems');
  const res = await RO.run(p, fakeIo(s));
  ok(!res.done && res.removed === 0, 'run: a plan with problems writes nothing');
  eq(s.getItem('np_rosters'), LOCAL.np_rosters, 'run: ...not even the keys that were fine');
}
{
  /* A key saved between the plan and the run stops it with nothing written. */
  const s = memStorage(LOCAL);
  await startRun(s);
  const p = await planOf(s);
  s.setItem('hall-pass-log-sections', LOCAL['hall-pass-log-sections'].replace('Library', 'Office'));
  const res = await RO.run(p, fakeIo(s));
  eq([res.done, res.stale, res.removed], [false, ['hall-pass-log-sections'], 0], 'run: a key changed after the plan stops the run');
  eq(s.getItem('np_history'), LOCAL.np_history, 'run: ...with nothing removed');
  eq(RO.getRun(s, A.id).state, 'archived', 'run: ...and the journal still at archived');
}
{
  /* A key that will not parse is left as it is and named. */
  const s = memStorage({ ...LOCAL, 'hall-pass-log-sections': '{"sets": oops' });
  const local = s.snapshot();
  const p = await RO.plan(A.id, local, local, { studentKeys: STUDENT });
  eq([p.items.find(i => i.key === 'hall-pass-log-sections').action, p.notes.map(n => n.code + ':' + n.key)],
     ['keep', ['unreadable:hall-pass-log-sections']], 'plan: an unreadable key is kept and noted, not deleted');
}
/* A change refused at step k, for every k, leaves the journal at
   'clearing' with k done; planning again from the archive and finishing
   gives the same storage as a run that never failed. */
const STEPS = 7;
async function finishFrom(s, io) {
  const p = await planOf(s);
  eq(p.problems, [], '  finishing: the half-cleared storage plans with no problem');
  return RO.run(p, io);
}
for (let k = 0; k < 5; k++) {
  for (const mode of ['fail', 'keep']) {
    const s = memStorage(LOCAL, mode === 'fail' ? { failChangeAt: k } : { keepChangeAt: k });
    await startRun(s);
    const io = fakeIo(s);
    const res = await RO.run(await planOf(s), io);
    eq([res.done, res.removed], [false, k], `${mode} at change ${k}: stops with ${k} done`);
    const r = RO.resume(s);
    eq(r && [r.state, r.doneSteps, r.totalSteps], ['clearing', k, STEPS], `${mode} at change ${k}: the journal says clearing, ${k} of ${STEPS}`);
    const finish = await finishFrom(s, io);
    ok(finish.done, `${mode} at change ${k}: finishing completes`);
    eq(s.snapshot(), EXPECTED, `${mode} at change ${k}: finishing gives the uninterrupted result`);
    eq(RO.getRun(s, A.id).done, STEPS, `${mode} at change ${k}: the journal counts every step once`);
  }
}
for (const which of ['media', 'share']) {
  const s = memStorage(LOCAL);
  await startRun(s);
  const io = fakeIo(s, which === 'media' ? { mediaFails: true } : { shareFails: true });
  const res = await RO.run(await planOf(s), io);
  eq([res.done, res.failed], [false, which === 'media' ? 'media:seating' : 'share'], `${which}: a clear that fails stops the run there`);
  const io2 = fakeIo(s);
  if (which === 'share') io2.photos = [];
  const finish = await finishFrom(s, io2);
  ok(finish.done, `${which}: finishing completes`);
  eq(s.snapshot(), EXPECTED, `${which}: and gives the uninterrupted result`);
}
/* The journal refusing a write (a full disk) at step k stops the run there
   too, and never claims a step the storage does not show. */
for (let k = 1; k <= STEPS + 1; k++) {
  const s = memStorage(LOCAL, { failJournalAt: k });
  await startRun(s);   // journal write 0
  const io = fakeIo(s);
  const res = await RO.run(await planOf(s), io);
  ok(!res.done, `journal refused at write ${k}: the run stops`);
  const j = RO.getRun(s, A.id);
  const changed = Object.keys(LOCAL).filter(key => s.getItem(key) !== LOCAL[key]).length + (io.photos.length ? 0 : 1) + (io.shared ? 0 : 1);
  ok((j.done || 0) <= changed, `journal refused at write ${k}: the journal claims ${j.done || 0}, storage shows ${changed}`);
  const finish = await finishFrom(s, io);
  ok(finish.done, `journal refused at write ${k}: finishing completes`);
  eq(s.snapshot(), EXPECTED, `journal refused at write ${k}: and gives the uninterrupted result`);
}
/* A Keep choice survives an interruption: the journal names the key (and
   nothing else), and finishing with resume()'s choices keeps it. */
{
  const s = memStorage(LOCAL, { failChangeAt: 1 });
  await startRun(s);
  const choices = { np_prompts: 'keep' };
  await RO.run(await planOf(s, { choices }), fakeIo(s));
  const r = RO.resume(s);
  eq(r.choices, choices, 'interrupted: resume() gives back the Keep choice');
  ok(!s.getItem('br_rollover_v1').includes('Pair and share'), 'interrupted: ...as a key name, with no value');
  const finish = await RO.run(await planOf(s, { choices: r.choices }), fakeIo(s));
  ok(finish.done && s.getItem('np_prompts') === LOCAL.np_prompts, 'interrupted: finishing keeps what the teacher chose to keep');
}
/* The indexes are planned against what the steps before them leave. */
{
  const local = {
    'gvb-bracket:list': JSON.stringify(['Spelling', 'Gone']), 'gvb-bracket:current': 'Spelling',
    'gvb-bracket:data:Spelling': JSON.stringify({ name: 'Spelling', slots: [['Avery Stone']] }),
    'gtg:list': JSON.stringify(['P3', 'Old']), 'gtg:data:P3': JSON.stringify({ name: 'P3', names: 'Avery Stone' }), 'gtg:current': 'P3',
  };
  const p = await RO.plan('ro-ix', local, local, { studentKeys: Object.keys(local) });
  const after = Object.fromEntries(p.items.filter(i => i.action === 'write').map(i => [i.key, i.after]));
  eq(after['gvb-bracket:list'], '[]', 'index: a bracket list drops the bracket that goes and the one already gone');
  eq(p.items.find(i => i.key === 'gvb-bracket:current').action, 'delete', 'index: the open bracket, which is gone, is forgotten');
  eq(after['gtg:list'], '["P3"]', 'index: a class list keeps the reduced class and drops a dangling entry');
  ok(!p.items.some(i => i.key === 'gtg:current'), 'index: the open class, still there, is not touched');
  eq(p.items[p.items.length - 1].phase, 6, 'index: the indexes are the last steps');
}

/* ── the journal keeps three runs ─────────────────────────────────────── */
{
  const s = memStorage();
  for (let i = 1; i <= 5; i++) RO.recordRun(s, { id: 'ro-' + i, state: 'done' });
  eq(RO.readJournal(s).runs.map(r => r.id), ['ro-3', 'ro-4', 'ro-5'], 'journal: the last three runs');
  s.setItem('br_rollover_v1', '{not json');
  eq(RO.readJournal(s).runs, [], 'journal: an unreadable journal reads as empty, not a throw');
}

/* ── the other tabs (increment 3): the CLIENTS question and the names ── */
{
  const reply = (clients, type = 'CLIENTS') => ({ postMessage(msg, ports) {
    if (msg && msg.type === 'CLIENTS' && ports && ports[0]) ports[0].postMessage({ type, clients });
  } });
  const silent = { postMessage() {} };
  const T = { timeoutMs: 80, MessageChannel };
  eq(await RO.otherTabs(null, T), { seen: false, urls: [] }, 'tabs: no service worker container is "cannot see", never "none open"');
  eq(await RO.otherTabs({ controller: reply([{ url: 'http://x/Tools/a.html' }]) }, T), { seen: true, urls: ['http://x/Tools/a.html'] },
    'tabs: the controlling worker answers with the other windows');
  eq(await RO.otherTabs({ controller: reply([]) }, T), { seen: true, urls: [] }, 'tabs: an answer with no window is "none open"');
  eq(await RO.otherTabs({ controller: null, ready: Promise.resolve({ active: reply([{ url: 'http://x/index.html' }]) }) }, T),
    { seen: true, urls: ['http://x/index.html'] }, 'tabs: an uncontrolled page (a hard reload) asks the active worker');
  eq(await RO.otherTabs({ controller: silent }, T), { seen: false, urls: [] }, 'tabs: a worker from before v302 never answers, and that is "cannot see"');
  eq(await RO.otherTabs({ controller: reply([], 'PRECACHE_PROGRESS') }, T), { seen: false, urls: [] }, 'tabs: another message on the port is not an answer');
  eq(await RO.otherTabs({ controller: reply('nope') }, T), { seen: false, urls: [] }, 'tabs: an answer without a list is not an answer');
  eq(await RO.otherTabs({ controller: null, ready: Promise.reject(new Error('blocked')) }, T), { seen: false, urls: [] }, 'tabs: a refused registration is "cannot see"');
  eq(await RO.otherTabs({ controller: null, ready: Promise.resolve({ active: null }) }, T), { seen: false, urls: [] }, 'tabs: no active worker is "cannot see"');
  eq(await RO.otherTabs({ controller: null, ready: new Promise(() => {}) }, T), { seen: false, urls: [] }, 'tabs: a registration that never settles times out as "cannot see"');

  const root = 'https://aspermylessonplan.com/';
  const tools = window.ToolRegistry.tools;
  const named = RO.nameTabs([
    root + 'Tools/007-Name%20Picker.html',
    root + 'Tools/007-Name%20Picker.html?roster=1#top',
    root + 'Tools/009-backup-restore.html',
    root,
    root + 'index.html',
    root + 'Tools/old-page.html',
  ], root, tools);
  eq(named, [
    { title: 'Backup & Restore', count: 1 },
    { title: 'Name Picker', count: 2 },
    { title: 'The landing page', count: 2 },
    { title: 'Tools/old-page.html', count: 1 },
  ], 'tabs: windows named by the registry, counted per page, query and hash ignored, an unknown page by its path');
  eq(RO.nameTabs([], root, tools), [], 'tabs: no window, no row');
  const sub = RO.nameTabs(['http://127.0.0.1:8534/site/Tools/007-Name%20Picker.html'], 'http://127.0.0.1:8534/site/', tools);
  eq(sub, [{ title: 'Name Picker', count: 1 }], 'tabs: a site served under a folder is named from its own root');
  ok(tools.every(t => !t.file || RO.nameTabs([root + t.file], root, tools)[0].title === t.title), 'tabs: every registry page is named by its own title');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
