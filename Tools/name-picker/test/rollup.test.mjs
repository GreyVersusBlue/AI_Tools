// rollup.test.mjs — Name Picker: np-rollup.js and the np_daily key (Path 15 P2). Pure Node.
//
//   node Tools/name-picker/test/rollup.test.mjs
//
// The rollup is the picks the 500-entry np_history window let go, as per-day counts keyed on the student's id.
// These cases are the Verification line of Path 15: a fixture of 600 picks over three weeks gives the same totals as
// counting all 600 directly; an id keeps its count across a rename; np_history reads exactly as it did.

import * as R from '../np-rollup.js';
import { createStore, memoryStorage, MAX_HISTORY } from '../np-store.js';

let passed = 0, failed = 0;
const eq = (a, b, label) => {
  if (JSON.stringify(a) === JSON.stringify(b)) passed++;
  else { failed++; console.log('  FAIL ' + label + '\n    got  ' + JSON.stringify(a).slice(0, 400) + '\n    want ' + JSON.stringify(b).slice(0, 400)); }
};
const ok = (c, label) => { if (c) passed++; else { failed++; console.log('  FAIL ' + label); } };

/* ---- the fixture: three school weeks, 600 picks, a seeded sequence of 12 students ---- */
const STUDENTS = Array.from({ length: 12 }, (_, i) => 'Student ' + String.fromCharCode(65 + i));
const IDS = Object.fromEntries(STUDENTS.map((n, i) => [n, 'id' + (i + 1)]));
const idOf = n => IDS[n] || null;
let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const DAYS = []; for (let w = 0; w < 3; w++) for (let d = 0; d < 5; d++) DAYS.push(`2026-10-${String(5 + w * 7 + d).padStart(2, '0')}`);
const PICKS = Array.from({ length: 600 }, (_, i) => ({ name: STUDENTS[Math.floor(rnd() * 12)], time: '09:00 AM', date: DAYS[Math.floor(i / 40)] }));
const direct = {};   /* counting all 600 by hand: day -> id -> n */
for (const p of PICKS) { const d = (direct[p.date] = direct[p.date] || {}); d[IDS[p.name]] = (d[IDS[p.name]] || 0) + 1; }

/* ---- the page's save step, run against the real store ---- */
function runPage(picks, ids = idOf) {
  const store = createStore({ storage: memoryStorage() });
  let history = [], rolledUp = 0;
  for (const p of picks) {
    history.push(p);
    const r = R.foldOverflow(store.get('daily'), history, rolledUp, MAX_HISTORY, ids);
    if (r.rolledUp !== rolledUp) { store.set('daily', r.doc); rolledUp = r.rolledUp; }
    store.set('history', history);
  }
  return store;
}
{
  const store = runPage(PICKS);
  eq(store.get('history').length, 500, '600 picks leave 500 in np_history');
  eq(store.get('history'), PICKS.slice(-500), 'np_history is the last 500, untouched');
  const doc = store.get('daily');
  eq(R.totals(doc) && Object.values(R.totals(doc)).reduce((a, b) => a + b, 0), 100, 'the rollup holds the 100 that left the window');
  const all = R.view(doc, store.get('history'), idOf);
  eq(all.days, direct, 'rollup + window = counting all 600 directly, day by day');
  eq(Object.values(R.totals(all)).reduce((a, b) => a + b, 0), 600, 'view totals 600');
  ok(Object.keys(R.view(doc, store.get('history'), idOf).days).length === 15, 'fifteen school days in the view');
}
/* nothing is counted twice: the page saves again and again with no new picks */
{
  const store = createStore({ storage: memoryStorage() });
  const history = PICKS.slice(0, 520); let rolledUp = 0;
  for (let i = 0; i < 6; i++) {
    const r = R.foldOverflow(store.get('daily'), history, rolledUp, MAX_HISTORY, idOf);
    if (r.rolledUp !== rolledUp) { store.set('daily', r.doc); rolledUp = r.rolledUp; }
  }
  eq(Object.values(R.totals(store.get('daily'))).reduce((a, b) => a + b, 0), 20, 'six saves of a 520 list fold the 20 overflow once');
  /* a reload reads the disk window, so the list is 500 again with nothing overflowing */
  const r2 = R.foldOverflow(store.get('daily'), PICKS.slice(20, 520), 0, MAX_HISTORY, idOf);
  eq(r2.rolledUp, 0, 'a freshly loaded 500 folds nothing');
}
/* undo: the list is cut back, then picks again; the front entries are not folded twice */
{
  const store = createStore({ storage: memoryStorage() });
  let history = PICKS.slice(0, 505), rolledUp = 0;
  let r = R.foldOverflow(store.get('daily'), history, rolledUp, MAX_HISTORY, idOf); store.set('daily', r.doc); rolledUp = r.rolledUp;
  history.length = 504;   /* undo of the last pick */
  r = R.foldOverflow(store.get('daily'), history, rolledUp, MAX_HISTORY, idOf); if (r.rolledUp !== rolledUp) { store.set('daily', r.doc); rolledUp = r.rolledUp; }
  history.push(PICKS[505]); history.push(PICKS[506]);
  r = R.foldOverflow(store.get('daily'), history, rolledUp, MAX_HISTORY, idOf); store.set('daily', r.doc); rolledUp = r.rolledUp;
  eq(Object.values(R.totals(store.get('daily'))).reduce((a, b) => a + b, 0), 6, 'undo then two more picks: 6 folded in all (the 6th entry out)');
  eq(rolledUp, 6, 'rolledUp follows the list');
}
/* ids and renames */
{
  const idsBefore = n => ({ 'Sam Q': 'idS' }[n] || null);
  let doc = R.fold(R.blank(), [{ name: 'Sam Q', date: '2026-10-05' }, { name: 'Sam Q', date: '2026-10-06' }], idsBefore);
  doc = R.fold(doc, [{ name: 'Samuel Q', date: '2026-10-07' }], n => ({ 'Sam Q': 'idS', 'Samuel Q': 'idS' }[n] || null));
  eq(R.totals(doc), { idS: 3 }, 'a student renamed in the roster keeps one count under the id');
  eq(doc.who.idS, 'Samuel Q', 'the name shown is the latest one seen');
  const noId = R.fold(R.blank(), [{ name: ' Alex   Kim ', date: '2026-10-05' }, { name: 'alex kim', date: '2026-10-05' }], () => null);
  eq(noId.days['2026-10-05'], { 'n:alex kim': 2 }, 'a name with no id folds under its normalised name, spacing and case aside');
  eq(R.keyFor('   ', idOf), null, 'a blank name has no key');
  eq(R.fold(R.blank(), [{ name: 'Student A' }, { name: 'Student A', date: 'yesterday' }], idOf).days, { '': { id1: 2 } }, 'an undated or badly dated entry folds into day ""');
}
/* merge, prune, fix */
{
  const a = R.fold(R.blank(), [{ name: 'Student A', date: '2026-10-05' }], idOf);
  const b = R.fold(R.blank(), [{ name: 'Student A', date: '2026-10-05' }, { name: 'Student B', date: '2026-10-06' }], idOf);
  eq(R.merge(a, b).days, { '2026-10-05': { id1: 2 }, '2026-10-06': { id2: 1 } }, 'merge adds cells');
  eq(a.days, { '2026-10-05': { id1: 1 } }, 'merge left its argument alone');
  const many = R.fold(R.blank(), Array.from({ length: 450 }, (_, i) => ({ name: 'Student A', date: new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10) })), idOf);
  eq(Object.keys(many.days).length, R.MAX_DAYS, 'the rollup keeps the last 400 days');
  ok(!('2025-01-01' in many.days) && '2026-03-26' in many.days, 'the oldest days are the ones pruned');
  const messy = R.fix({ days: { '2026-10-05': { id1: 2.7, bad: -1, id2: 'x', '': 3 }, 'nope': { id1: 1 }, '2026-10-06': 'x' }, who: { id1: ' Ann ', id2: 5 } });
  eq(messy, { days: { '2026-10-05': { id1: 2 } }, who: { id1: 'Ann' } }, 'fix keeps only whole positive counts on real days');
  eq(R.fix(null), R.blank(), 'a stored null reads as an empty rollup');
  eq(R.fix([1, 2]), R.blank(), 'a stored array reads as an empty rollup');
}
/* the store: np_daily is a records key, travels in a backup, and the erase buttons cover it */
{
  const store = runPage(PICKS);
  ok(store.keys.some(k => k.key === 'np_daily' && k.group === 'records'), 'np_daily is a records key');
  const snap = store.snapshot();
  ok(typeof snap.np_daily === 'object' && R.totals(snap.np_daily).id1 >= 0, 'a snapshot carries np_daily as an object');
  const text = JSON.stringify(store.snapshot().np_daily);
  ok(!/"__v"/.test(text), 'no version stamp leaks into np_daily');
  const other = createStore({ storage: memoryStorage() });
  other.restore(snap, { merge: false });
  eq(other.get('daily'), store.get('daily'), 'a full restore brings the rollup back');
  const base = runPage(PICKS.slice(0, 520));
  const before = Object.values(R.totals(base.get('daily'))).reduce((a, b) => a + b, 0);
  base.restore({ np_daily: R.fold(R.blank(), [{ name: 'Student A', date: '2026-09-01' }], idOf) }, { merge: true });
  eq(Object.values(R.totals(base.get('daily'))).reduce((a, b) => a + b, 0), before + 1, 'a merge restore adds the file\'s rollup to the teacher\'s');
  /* a merged backup that pushes history past 500 sends the overflow to the rollup */
  const s2 = runPage(PICKS.slice(0, 450));
  s2.restore({ np_history: PICKS.slice(450, 600) }, { merge: true, idOf });
  eq(s2.get('history').length, 500, 'a merge restore still keeps 500');
  eq(Object.values(R.totals(s2.get('daily'))).reduce((a, b) => a + b, 0), 100, 'the 100 it pushed out are in the rollup');
  eq(R.view(s2.get('daily'), s2.get('history'), idOf).days, direct, 'and the view is all 600 again (after the merge)');
  store.clearGroup('records');
  eq(store.get('daily'), R.blank(), 'the records erase empties the rollup');
}
/* old data: a store with only np_history, as every teacher has today, reads as before */
{
  const base = memoryStorage();
  base.setItem('np_history', JSON.stringify([{ name: 'Old One', time: '1:00 PM' }, { name: 'Old Two', time: '1:05 PM', date: '2026-09-01', prompt: 'Q' }]));
  const store = createStore({ storage: base });
  eq(store.get('history'), [{ name: 'Old One', time: '1:00 PM' }, { name: 'Old Two', time: '1:05 PM', date: '2026-09-01', prompt: 'Q' }], 'an old np_history reads unchanged');
  eq(store.get('daily'), R.blank(), 'with no np_daily the rollup is empty, not an error');
  ok(base.getItem('np_daily') === null, 'reading wrote nothing');
  eq(R.view(store.get('daily'), store.get('history'), () => null).days, { '': { 'n:old one': 1 }, '2026-09-01': { 'n:old two': 1 } }, 'view of an old history alone');
}

console.log(`rollup: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
