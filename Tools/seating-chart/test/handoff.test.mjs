// handoff.test.mjs — 005's live mode writing 008's and 001's storage (Path 14 P5,
// Devon's P5-route answer of 2026-11-03). Pure Node.
//
//   node Tools/seating-chart/test/handoff.test.mjs
//
// Pins what seating-chart/seating-handoff.mjs writes against the shapes 008 and 001
// keep (one point the way 008's default +1 chip gives it, team share included; one
// pass the way 001's sign-out makes it), which class it picks, every refusal (and
// that a refusal writes nothing), and that each undo is the owner's own undo.
import { awardPoint, undoPoint, startPass, undoPass } from '../seating-handoff.mjs';

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const NOW = new Date(2026, 10, 3, 10, 15);   // a Tuesday
const section = { id: 'sec1', name: 'Period 3', names: ['Avery Stone', 'Blake Rivers'] };
const pt = (raw, extra = {}) => awardPoint(raw, { section, student: 'Avery Stone', now: NOW, logId: 'evX', ...extra });
const ps = (raw, extra = {}) => startPass(raw, { section, student: 'Avery Stone', now: NOW, passId: 'evP', ...extra });

console.log('seating-handoff — 008 points');
{
  // missing data: a first class, named after the section, holding its students
  const r = pt(null);
  ok(r.ok && r.created, 'no 008 data at all: a class is made');
  const st = JSON.parse(r.raw);
  eq(st.current, 'Period 3', 'and is current');
  const set = st.sets['Period 3'];
  eq(set.namesText, 'Avery Stone\nBlake Rivers', 'holding the section\'s students');
  eq(set.points, { 'Avery Stone': 1 }, 'one point');
  eq(set.posCount, { 'Avery Stone': 1 }, 'counted as a positive');
  eq(set.log.length, 1, 'one log entry');
  const e = set.log[0];
  eq([e.id, e.name, e.tagLabel, e.cat, e.delta], ['evX', 'Avery Stone', 'Manual', 'other', 1], "the entry 008's default +1 chip writes");
  ok(typeof e.ts === 'string' && e.ts.length > 0, 'with a time');
  ok(!('team' in e), 'and no team field for a student with no team');
  ok(/\+1 point for Avery Stone \(category Other\)/.test(r.message) && /new class/.test(r.message), 'the message says what was given and that a class was made');
  ok(pt('').ok, 'an empty string reads as no data too');
}
{
  // old data: a class saved before points/log/teams existed
  const old = JSON.stringify({ current: 'Period 3', sets: { 'Period 3': { name: 'Period 3', namesText: 'Avery Stone\nBlake Rivers' } } });
  const r = pt(old);
  ok(r.ok && !r.created, 'a class saved with only names takes the point');
  const set = JSON.parse(r.raw).sets['Period 3'];
  eq([set.points, set.posCount, set.negCount, set.log.length], [{ 'Avery Stone': 1 }, { 'Avery Stone': 1 }, {}, 1], 'and gets the fields it lacked');
}
{
  // which class: pointed at this chart, then same name, then same roster
  const store = { current: 'Other', sets: {
    'Other': { name: 'Other', namesText: 'Avery Stone' },
    'Period 3': { name: 'Period 3', namesText: 'Avery Stone' },
    'Third': { name: 'Third', namesText: 'Avery Stone', seatingSectionId: 'sec1' },
  } };
  eq(pt(JSON.stringify(store)).className, 'Third', 'the class pointed at this chart section wins');
  delete store.sets.Third.seatingSectionId;
  eq(pt(JSON.stringify(store)).className, 'Period 3', 'then the class with the same name');
  delete store.sets['Period 3'];
  store.sets.Third.rosterName = 'Period 3';
  const r = pt(JSON.stringify(store));
  eq(r.className, 'Third', 'then the class following the roster of that name');
  eq(JSON.parse(r.raw).current, 'Other', "008's current class is left alone");
  delete store.sets.Third.rosterName;
  const none = pt(JSON.stringify(store));
  ok(!none.ok && /No Behavior & Points class is named "Period 3"/.test(none.message), 'no match on a store with classes: refused, no stray class');
}
{
  // teams: BPTeams.award()
  const store = { current: 'Period 3', sets: { 'Period 3': { name: 'Period 3', namesText: 'Avery Stone\nBlake Rivers',
    points: { 'Avery Stone': 4 }, posCount: { 'Avery Stone': 4 }, negCount: {}, log: [{ id: 'old', name: 'Blake Rivers', delta: 1 }],
    teams: [{ id: 'tA', name: 'Hawks', color: 'red' }], teamOf: { 'Avery Stone': 'tA' }, teamBank: { tA: 10 }, teamDay: { tA: 2 }, teamLog: [] } } };
  const r = pt(JSON.stringify(store));
  const set = JSON.parse(r.raw).sets['Period 3'];
  eq(set.points['Avery Stone'], 5, 'adds to the points already there');
  eq(set.teamDay.tA, 3, "and to the student's team for today");
  eq(set.teamBank.tA, 10, 'never to the bank');
  eq(set.log[0].team, 'tA', 'the entry carries the team');
  eq(set.log[1].id, 'old', 'the old entries stay, newest first');
  ok(/Today: 5 points/.test(r.message), 'the message gives today\'s total');
  const u = undoPoint(r.raw, { className: 'Period 3', entryId: 'evX' });
  ok(u.ok, 'undo finds the entry');
  eq(JSON.parse(u.raw), store, "undo puts 008's class back exactly (undoLogEntry + BPTeams.unaward)");
  const again = undoPoint(u.raw, { className: 'Period 3', entryId: 'evX' });
  ok(!again.ok && /no longer in Behavior & Points's log/.test(again.message), 'a second undo finds nothing and says so');
}
{
  // refusals write nothing
  const notListed = JSON.stringify({ sets: { 'Period 3': { name: 'Period 3', namesText: 'Blake Rivers' } } });
  const r = pt(notListed);
  ok(!r.ok && !('raw' in r) && /not on the Behavior & Points class "Period 3"/.test(r.message), 'a student the class does not list: refused');
  for (const [raw, what] of [
    ['{not json', 'unparseable data'],
    ['[1,2]', 'an array'],
    ['{"version":2,"sets":{}}', 'a version field (a newer tool)'],
    ['{"sets":[]}', 'sets that are not an object'],
  ]) {
    const x = pt(raw);
    ok(!x.ok && !('raw' in x) && /nothing was written/.test(x.message), `${what}: refused, nothing written`);
  }
  const odd = pt(JSON.stringify({ sets: { 'Period 3': { name: 'Period 3', namesText: 'Avery Stone', log: {} } } }));
  ok(!odd.ok && /newer version/.test(odd.message), 'a class whose log is not a list: refused');
  const odd2 = pt(JSON.stringify({ sets: { 'Period 3': { name: 'Period 3', namesText: 'Avery Stone', points: [] } } }));
  ok(!odd2.ok, 'a class whose points are not a map: refused');
}

console.log('seating-handoff — 001 passes');
{
  const r = ps(null);
  ok(r.ok && r.created, 'no 001 data at all: a section is made');
  const st = JSON.parse(r.raw);
  const set = st.sets['Period 3'];
  eq(st.current, 'Period 3', 'and is current');
  eq(set.outNow.length, 1, 'one student out');
  const e = set.outNow[0];
  eq([e.id, e.name, e.destId, e.destLabel, e.outMs, e.note], ['evP', 'Avery Stone', 'd1', 'Restroom', NOW.getTime(), ''], "001's default destination, now, no note");
  eq(set.destinations, [{ id: 'd1', label: 'Restroom', overtimeMin: 5, requiresNote: false }], "and the destination 001's own defaults start with");
  ok(/Avery Stone signed out to Restroom at/.test(r.message), 'the message says who went where and when');
}
{
  const store = { current: 'Period 3', sets: { 'Period 3': { name: 'Period 3', namesText: 'Avery Stone\nBlake Rivers',
    destinations: [{ id: 'd1', label: 'Restroom', overtimeMin: 5 }, { id: 'd5', label: 'Water fountain', overtimeMin: 5 }],
    armedDestId: 'd5', outNow: [], log: [], history: [] } } };
  const r = ps(JSON.stringify(store));
  eq(JSON.parse(r.raw).sets['Period 3'].outNow[0].destLabel, 'Water fountain', 'the armed destination is used');
  const twice = ps(r.raw, { passId: 'evQ' });
  ok(!twice.ok && /already has a pass out \(Water fountain, since/.test(twice.message), 'a student already out: refused politely');
  const u = undoPass(r.raw, { className: 'Period 3', entryId: 'evP' });
  eq(JSON.parse(u.raw), store, 'undo removes the pass exactly');
  ok(!undoPass(u.raw, { className: 'Period 3', entryId: 'evP' }).ok, 'and a second undo finds nothing');

  const blake = JSON.parse(r.raw);
  blake.sets['Period 3'].oneOutAtATime = true;
  const one = startPass(JSON.stringify(blake), { section, student: 'Blake Rivers', now: NOW, passId: 'evB' });
  ok(!one.ok && /Someone is already out \(Avery Stone\)/.test(one.message), 'one out at a time: refused while someone is out');

  const ap = JSON.parse(JSON.stringify(store));
  ap.sets['Period 3'].approvalNames = ['Avery Stone'];
  ok(!ps(JSON.stringify(ap)).ok, 'a student on the approval list: refused (001 would ask)');

  const bud = JSON.parse(JSON.stringify(store));
  bud.sets['Period 3'].weeklyBudget = 2;
  bud.sets['Period 3'].log = [{ id: 'l1', name: 'Avery Stone', outMs: NOW.getTime() - 3600e3 }];
  ok(ps(JSON.stringify(bud)).ok, 'one trip of a budget of two: allowed');
  bud.sets['Period 3'].history = [{ date: '2026-11-02', rows: [{ name: 'Avery Stone' }] }, { date: '2026-10-30', rows: [{ name: 'Avery Stone' }] }];
  const over = ps(JSON.stringify(bud));
  ok(!over.ok && /used 2 of 2/.test(over.message), "Monday's archived trip counts toward the week, last Friday's does not");

  const notListed = JSON.parse(JSON.stringify(store));
  notListed.sets['Period 3'].namesText = 'Blake Rivers';
  ok(!ps(JSON.stringify(notListed)).ok, 'a student the section does not list: refused');

  const done = JSON.parse(r.raw);
  done.sets['Period 3'].log.unshift(done.sets['Period 3'].outNow.shift());
  const gone = undoPass(JSON.stringify(done), { className: 'Period 3', entryId: 'evP' });
  ok(!gone.ok && /signed back in/.test(gone.message), 'a pass signed back in on 001 is not undone from here');
}
{
  ok(!ps('{"v":3}').ok, 'a version marker on 001\'s store: refused');
  ok(!ps(JSON.stringify({ sets: { 'Period 3': { name: 'Period 3', namesText: 'Avery Stone', outNow: {} } } })).ok, 'outNow that is not a list: refused');
  const other = ps(JSON.stringify({ sets: { 'Period 1': { name: 'Period 1', namesText: 'Avery Stone' } } }));
  ok(!other.ok && /No Hall Pass section is named "Period 3"/.test(other.message), 'no matching 001 section: refused, no stray section');
  const bySeat = ps(JSON.stringify({ sets: { 'P3': { name: 'P3', namesText: 'Avery Stone', seatingSectionId: 'sec1' } } }));
  ok(!bySeat.ok, '001 keeps no chart pointer, so a seatingSectionId there is not read');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
